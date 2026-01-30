/**
 * OpenScaffold - Public API facade that hides Effect internals.
 *
 * Users interact with this class using Promises and AsyncIterables,
 * never needing to know about Effect, Stream, or Layer.
 *
 * INTERNAL: Uses the existing createServer implementation. No duplication.
 * The conversion to Promise happens ONLY at the public API boundary.
 *
 * @module
 */

import type { AgentProvider, WorkflowDef } from "@open-scaffold/core"
import { Services } from "@open-scaffold/core"
import { Effect, Layer, ManagedRuntime } from "effect"

import { DEFAULT_HOST, DEFAULT_PORT } from "./constants.js"
import { createServer } from "./http/Server.js"
import { EventBusLive } from "./services/EventBusLive.js"
import { EventStoreLive } from "./store/EventStoreLive.js"
import { ProviderRecorderLive } from "./store/ProviderRecorderLive.js"
import { StateSnapshotStoreLive } from "./store/StateSnapshotStoreLive.js"

// ─────────────────────────────────────────────────────────────────
// Public Types (no Effect types exposed)
// ─────────────────────────────────────────────────────────────────

/**
 * Provider mode for caching behavior.
 * - "live": Call API and cache results (including errors)
 * - "playback": Use cached results, never call API
 */
export type ProviderMode = "live" | "playback"

/**
 * Configuration for OpenScaffold.
 */
export interface OpenScaffoldConfig {
  /** Path to SQLite database file (e.g., "./data/app.db") */
  readonly database: string
  /** Provider mode: "live" or "playback" (REQUIRED - no default) */
  readonly mode: ProviderMode
  /**
   * Named providers map for workflow context.
   * Keys are model strings (e.g., "claude-sonnet-4-20250514"),
   * values are AgentProvider implementations.
   *
   * Note: Per ADR-010, agents now own their providers directly.
   * This map is kept for backward compatibility but will be removed
   * in Task 5.4.
   */
  readonly providers?: Record<string, AgentProvider>
}

/**
 * Configuration for creating a server.
 */
export interface ServerOptions<S> {
  /** The workflow definition to run */
  readonly workflow: WorkflowDef<S, string, string>
  /** Server host (default: DEFAULT_HOST) */
  readonly host?: string
  /** Server port (default: DEFAULT_PORT) */
  readonly port?: number
}

/**
 * Server instance with Promise-based methods.
 */
export interface OpenScaffoldServer {
  /** The server's port (available after start). */
  readonly port: number
  /** Start the server. Returns when server is listening. */
  start(): Promise<void>
  /** Stop the server gracefully. */
  stop(): Promise<void>
  /** Get the server's address. */
  address(): Promise<{ host: string; port: number }>
}

/**
 * Session info returned by listSessions.
 */
export interface SessionInfo {
  id: string
  workflowName: string
  createdAt: Date
  eventCount: number
}

/**
 * Error thrown by OpenScaffold operations (public API).
 */
export class OpenScaffoldError extends Error {
  readonly operation: string
  override readonly cause: unknown

  constructor(operation: string, cause: unknown) {
    super(`OpenScaffold ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = "OpenScaffoldError"
    this.operation = operation
    this.cause = cause
  }
}

// ─────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────

type AppServices =
  | Services.EventStore
  | Services.StateSnapshotStore
  | Services.EventBus
  | Services.ProviderRecorder
  | Services.ProviderModeContext

// ─────────────────────────────────────────────────────────────────
// OpenScaffold Class
// ─────────────────────────────────────────────────────────────────

/**
 * OpenScaffold - The public API for running workflows.
 *
 * @example
 * ```typescript
 * import { OpenScaffold } from "@open-scaffold/server"
 *
 * // Create instance with explicit config (mode is REQUIRED)
 * const scaffold = OpenScaffold.create({
 *   database: "./data/app.db",
 *   mode: "live"  // REQUIRED: "live" or "playback"
 * })
 *
 * // Create and start server (uses DEFAULT_PORT)
 * const server = scaffold.createServer({
 *   workflow: myWorkflow
 * })
 * await server.start()
 *
 * // Clean up when done
 * await scaffold.dispose()
 * ```
 */
export class OpenScaffold {
  private readonly _eventStoreLayer: Layer.Layer<Services.EventStore, unknown>
  private readonly _snapshotStoreLayer: Layer.Layer<Services.StateSnapshotStore, unknown>
  private readonly _providerRecorderLayer: Layer.Layer<Services.ProviderRecorder, unknown>
  private readonly _runtime: ManagedRuntime.ManagedRuntime<AppServices, unknown>
  private readonly config: OpenScaffoldConfig

  private constructor(
    eventStoreLayer: Layer.Layer<Services.EventStore, unknown>,
    snapshotStoreLayer: Layer.Layer<Services.StateSnapshotStore, unknown>,
    providerRecorderLayer: Layer.Layer<Services.ProviderRecorder, unknown>,
    runtime: ManagedRuntime.ManagedRuntime<AppServices, unknown>,
    config: OpenScaffoldConfig
  ) {
    this._eventStoreLayer = eventStoreLayer
    this._snapshotStoreLayer = snapshotStoreLayer
    this._providerRecorderLayer = providerRecorderLayer
    this._runtime = runtime
    this.config = config
  }

  /**
   * Create a new OpenScaffold instance.
   */
  static create(config: OpenScaffoldConfig): OpenScaffold {
    // Create individual layers - all use same database for unified storage
    const eventStoreLayer = EventStoreLive({ url: config.database })
    const snapshotStoreLayer = StateSnapshotStoreLive({ url: config.database })
    const providerRecorderLayer = ProviderRecorderLive({ url: config.database })
    const eventBusLayer = Layer.effect(Services.EventBus, EventBusLive)

    // ProviderModeContext layer
    // Note: Per ADR-010, ProviderRegistry is no longer needed - agents own their providers directly
    const providerModeLayer = Layer.succeed(
      Services.ProviderModeContext,
      { mode: config.mode }
    )

    // Compose all layers
    const combinedLayer = Layer.mergeAll(
      eventStoreLayer,
      snapshotStoreLayer,
      providerRecorderLayer,
      eventBusLayer,
      providerModeLayer
    )

    const runtime = ManagedRuntime.make(combinedLayer)

    return new OpenScaffold(
      eventStoreLayer,
      snapshotStoreLayer,
      providerRecorderLayer,
      runtime,
      config
    )
  }

  /** Get the provider mode. */
  get mode(): ProviderMode {
    return this.config.mode
  }

  /** Get the database path. */
  get database(): string {
    return this.config.database
  }

  /**
   * Create an HTTP server for the workflow.
   */
  createServer<S>(options: ServerOptions<S>): OpenScaffoldServer {
    const mode = this.config.mode

    // Use the existing createServer function
    const server = createServer({
      workflow: options.workflow,
      eventStore: this._eventStoreLayer,
      snapshotStore: this._snapshotStoreLayer,
      providerMode: mode,
      providerRecorder: this._providerRecorderLayer,
      host: options.host ?? DEFAULT_HOST,
      port: options.port ?? DEFAULT_PORT,
      providerStatus: {
        name: "anthropic",
        mode,
        connected: mode === "live"
      },
      ...(this.config.providers ? { providers: this.config.providers } : {})
    })

    // Wrap Effect-returning methods with Promise-returning methods
    // Use Effect.mapError to convert errors, then runPromise
    return {
      port: server.port,

      start: () =>
        Effect.runPromise(
          server.start().pipe(
            Effect.mapError((e) => new OpenScaffoldError("start", e))
          )
        ),

      stop: () =>
        Effect.runPromise(
          server.stop().pipe(
            Effect.mapError((e) => new OpenScaffoldError("stop", e))
          )
        ),

      address: () =>
        Effect.runPromise(
          server.address().pipe(
            Effect.mapError((e) => new OpenScaffoldError("address", e))
          )
        )
    }
  }

  /**
   * List all sessions in the database.
   */
  async listSessions(): Promise<Array<SessionInfo>> {
    return this._runtime.runPromise(
      Effect.gen(function*() {
        const eventStore = yield* Services.EventStore
        const sessionIds = yield* eventStore.listSessions()

        // For each session, get event count and first event for metadata
        const sessions: Array<SessionInfo> = []
        for (const id of sessionIds) {
          const events = yield* eventStore.getEvents(id)
          const startEvent = events.find((e) => e.name === "workflow:started")

          // Extract workflowName from workflow:started event
          // - New runtime API: { workflowName, sessionId, input }
          // - Old createSession: { goal } (no workflowName)
          let workflowName = "unknown"
          if (startEvent?.payload) {
            const payload = startEvent.payload as { workflowName?: string }
            if (payload.workflowName) {
              workflowName = payload.workflowName
            }
          }

          sessions.push({
            id,
            workflowName,
            createdAt: events[0]?.timestamp ?? new Date(),
            eventCount: events.length
          })
        }
        return sessions
      })
    )
  }

  /**
   * Get the provider recorder service (for advanced use cases).
   * This allows workflows to access the recorder for inspecting/managing recordings.
   */
  async getProviderRecorder(): Promise<Services.ProviderRecorderService> {
    return this._runtime.runPromise(
      Effect.gen(function*() {
        return yield* Services.ProviderRecorder
      })
    )
  }

  /**
   * Dispose of the OpenScaffold instance and release resources.
   */
  async dispose(): Promise<void> {
    await this._runtime.dispose()
  }
}
