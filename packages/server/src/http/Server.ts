/**
 * ServerService - HTTP server abstraction.
 *
 * @module
 */

import * as http from "node:http"
import { URL } from "node:url"

import type {
  AgentProvider,
  AgentRunResult,
  AgentStreamEvent,
  ProviderMode,
  SessionId,
  WorkflowDef
} from "@open-scaffold/core"
import { Services, SessionNotFound, ValidationError } from "@open-scaffold/core"
import { Cause, Context, Data, Effect, Exit, Fiber, Layer, ManagedRuntime, Option, Stream } from "effect"

import { DEFAULT_HOST, DEFAULT_PORT } from "../constants.js"
import { EventBusLive } from "../services/EventBusLive.js"
import type { RouteEnvironment, RouteResponse } from "./Routes.js"
import {
  createSessionRoute,
  deleteRecordingRoute,
  deleteSessionRoute,
  forkSessionRoute,
  getProviderStatusRoute,
  getRecordingRoute,
  getSessionEventsRoute,
  getSessionRoute,
  getSessionStateRoute,
  listRecordingsRoute,
  listSessionsRoute,
  pauseSessionRoute,
  postSessionInputRoute,
  resumeSessionRoute
} from "./Routes.js"
import { SSE_HEADERS } from "./SSE.js"

// ─────────────────────────────────────────────────────────────────
// In-memory ProviderRecorder (default fallback)
// ─────────────────────────────────────────────────────────────────

/**
 * Create an in-memory ProviderRecorder layer.
 * Recordings are stored for server lifetime only - lost on restart.
 * For persistent recording, use ProviderRecorderLive.
 *
 * @example
 * ```typescript
 * // Only use for quick local development - NOT for CI
 * createServer({
 *   providerRecorder: makeInMemoryRecorderLayer()
 * })
 * ```
 */
export const makeInMemoryRecorderLayer = (): Layer.Layer<Services.ProviderRecorder> => {
  const store = new Map<string, {
    hash: string
    prompt: string
    provider: string
    streamData: ReadonlyArray<AgentStreamEvent>
    result: AgentRunResult
    recordedAt: Date
  }>()

  // In-memory incremental recording storage
  const incrementalRecordings = new Map<
    string,
    {
      hash: string
      prompt: string
      provider: string
      events: Array<AgentStreamEvent>
      status: "in_progress" | "complete"
      result?: AgentRunResult
      createdAt: Date
    }
  >()

  return Layer.succeed(
    Services.ProviderRecorder,
    Services.ProviderRecorder.of({
      load: (hash) =>
        Effect.sync(() => {
          // First check legacy store
          const entry = store.get(hash)
          if (entry) return entry

          // Then check incremental recordings (only completed)
          for (const recording of incrementalRecordings.values()) {
            if (recording.hash === hash && recording.status === "complete" && recording.result) {
              return {
                hash: recording.hash,
                prompt: recording.prompt,
                provider: recording.provider,
                streamData: recording.events,
                result: recording.result,
                recordedAt: recording.createdAt
              }
            }
          }
          return null
        }),
      save: (entry) =>
        Effect.sync(() => {
          store.set(entry.hash, { ...entry, recordedAt: new Date() })
        }),
      delete: (hash) =>
        Effect.sync(() => {
          store.delete(hash)
        }),
      list: () =>
        Effect.sync(() =>
          Array.from(store.values()).map((e) => ({
            hash: e.hash,
            prompt: e.prompt,
            provider: e.provider,
            recordedAt: e.recordedAt
          }))
        ),
      // Incremental recording API
      startRecording: (hash, metadata) =>
        Effect.sync(() => {
          const recordingId = crypto.randomUUID()
          // Delete any existing incomplete recording for this hash
          for (const [id, recording] of incrementalRecordings.entries()) {
            if (recording.hash === hash && recording.status === "in_progress") {
              incrementalRecordings.delete(id)
            }
          }
          incrementalRecordings.set(recordingId, {
            hash,
            prompt: metadata.prompt,
            provider: metadata.provider,
            events: [],
            status: "in_progress",
            createdAt: new Date()
          })
          return recordingId
        }),
      appendEvent: (recordingId, event) =>
        Effect.sync(() => {
          const recording = incrementalRecordings.get(recordingId)
          if (recording) {
            recording.events.push(event)
          }
        }),
      finalizeRecording: (recordingId, result) =>
        Effect.sync(() => {
          const recording = incrementalRecordings.get(recordingId)
          if (recording) {
            recording.status = "complete"
            recording.result = result
          }
        })
    })
  )
}

/**
 * Server configuration.
 */
export interface ServerConfig {
  readonly port: number
  readonly host?: string
}

/**
 * Server error.
 */
export class ServerError extends Data.TaggedError("ServerError")<{
  readonly operation: "start" | "stop" | "request"
  readonly cause: unknown
}> {}

/**
 * ServerService operations.
 */
export interface ServerService {
  /** The port the server is configured to listen on. */
  readonly port: number
  /** Start the server. */
  readonly start: () => Effect.Effect<void, ServerError>
  /** Stop the server gracefully. */
  readonly stop: () => Effect.Effect<void, ServerError>
  /** Get the server's address. */
  readonly address: () => Effect.Effect<{ host: string; port: number }, ServerError>
}

/**
 * Context.Tag for ServerService.
 */
export class Server extends Context.Tag("@open-scaffold/Server")<
  Server,
  ServerService
>() {}

export interface CreateServerOptions<S> extends ServerConfig {
  readonly workflow: WorkflowDef<S, string, string>
  readonly eventStore: Layer.Layer<Services.EventStore, unknown>
  readonly snapshotStore: Layer.Layer<Services.StateSnapshotStore, unknown>
  /**
   * Provider mode: "live" or "playback" (REQUIRED - no default).
   * - "live": Call API and record results
   * - "playback": Replay from recorded results, never call API
   */
  readonly providerMode: ProviderMode
  /**
   * Provider recorder layer for deterministic replay.
   * Required - forces explicit choice of recording strategy.
   *
   * @example
   * ```typescript
   * import { ProviderRecorderLive } from "@open-scaffold/server"
   *
   * // Persistent recording (recommended for CI)
   * createServer({
   *   providerRecorder: ProviderRecorderLive({ url: "file:./recordings.db" })
   * })
   *
   * // In-memory recording (for quick local dev only)
   * import { makeInMemoryRecorderLayer } from "@open-scaffold/server"
   * createServer({
   *   providerRecorder: makeInMemoryRecorderLayer()
   * })
   * ```
   */
  readonly providerRecorder: Layer.Layer<Services.ProviderRecorder, unknown>
  readonly providerStatus?: {
    readonly name: string
    /** Provider mode: "live" (call API) or "playback" (replay recordings) */
    readonly mode: ProviderMode
    readonly model?: string
    readonly connected: boolean
  }
  /**
   * Named providers map.
   * Keys are model strings (e.g., "claude-sonnet-4-20250514"),
   * values are AgentProvider implementations.
   *
   * Note: Per ADR-010, agents now own their providers directly.
   * This map is kept for backward compatibility but will be removed
   * in Task 5.4.
   */
  readonly providers?: Record<string, AgentProvider>
}

export const createServer = <S>(options: CreateServerOptions<S>): ServerService => {
  const host = options.host ?? DEFAULT_HOST
  const port = options.port ?? DEFAULT_PORT

  let server: http.Server | null = null
  let address: { host: string; port: number } | null = null
  let runtime:
    | ManagedRuntime.ManagedRuntime<
      | Services.EventStore
      | Services.StateSnapshotStore
      | Services.EventBus
      | Services.ProviderRecorder
      | Services.ProviderModeContext,
      unknown
    >
    | null = null

  const sessions = new Map<SessionId, Fiber.RuntimeFiber<unknown, unknown>>()

  const makeEventBusLayer = () => Layer.effect(Services.EventBus, EventBusLive)

  // Provider mode layer from config (required - no default)
  const providerModeLayer = Layer.succeed(Services.ProviderModeContext, { mode: options.providerMode })

  // ProviderRecorder is required - forces explicit choice of recording strategy
  const providerRecorderLayer = options.providerRecorder

  const startServer = Effect.gen(function*() {
    if (server) return

    // Note: Per ADR-010, ProviderRegistry is no longer needed - agents own their providers directly
    const fullLayer = Layer.mergeAll(
      options.eventStore,
      options.snapshotStore,
      makeEventBusLayer(),
      providerModeLayer,
      providerRecorderLayer
    )

    runtime = ManagedRuntime.make(
      fullLayer as Layer.Layer<
        | Services.EventStore
        | Services.StateSnapshotStore
        | Services.EventBus
        | Services.ProviderRecorder
        | Services.ProviderModeContext
      >
    )

    const runtimeRef = runtime
    if (!runtimeRef) return

    const runPromise = runtimeRef.runPromise
    const runFork = runtimeRef.runFork
    const runPromiseExit = runtimeRef.runPromiseExit

    const runRoute = async (effect: Effect.Effect<RouteResponse, ServerError, RouteEnvironment>) => {
      const exit = await runPromiseExit(effect)
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause)
        const error = Option.isSome(failure) ? failure.value : exit.cause
        const mapped = mapErrorToResponse(error)
        return { status: mapped.status, body: mapped.body }
      }
      return exit.value
    }

    const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          })
          res.end()
          return
        }

        const url = new URL(req.url ?? "/", `http://${host}:${port}`)
        const path = url.pathname
        const query = Object.fromEntries(url.searchParams.entries())

        const body = await readJson(req)
        const baseContext = {
          query,
          body,
          workflow: options.workflow,
          sessions,
          ...(options.providerStatus ? { providerStatus: options.providerStatus } : {})
        }

        let response: RouteResponse | undefined

        if (req.method === "GET" && path === "/sessions") {
          response = await runRoute(listSessionsRoute({ ...baseContext, params: {} }))
        } else if (req.method === "POST" && path === "/sessions") {
          response = await runRoute(createSessionRoute({ ...baseContext, params: {} }))
        } else if (req.method === "GET" && path.match(/^\/sessions\/[^/]+$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(getSessionRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "GET" && path.match(/^\/sessions\/[^/]+\/events$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(getSessionEventsRoute({ ...baseContext, params: { id } }))
          const stream = response.body as Stream.Stream<string, unknown>

          res.writeHead(response.status, {
            "Access-Control-Allow-Origin": "*",
            ...SSE_HEADERS,
            ...(response.headers ?? {})
          })

          const fiber = runFork(
            Stream.runForEach(stream, (chunk) =>
              Effect.sync(() => {
                res.write(chunk)
              }))
          )

          res.on("close", () => {
            runPromise(Fiber.interrupt(fiber)).catch(() => {})
            res.end()
          })
          return
        } else if (req.method === "GET" && path.match(/^\/sessions\/[^/]+\/state$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(getSessionStateRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "POST" && path.match(/^\/sessions\/[^/]+\/input$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(postSessionInputRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "POST" && path.match(/^\/sessions\/[^/]+\/pause$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(pauseSessionRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "POST" && path.match(/^\/sessions\/[^/]+\/resume$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(resumeSessionRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "POST" && path.match(/^\/sessions\/[^/]+\/fork$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(forkSessionRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "DELETE" && path.match(/^\/sessions\/[^/]+$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(deleteSessionRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "GET" && path === "/recordings") {
          response = await runRoute(listRecordingsRoute({ ...baseContext, params: {} }))
        } else if (req.method === "GET" && path.match(/^\/recordings\/[^/]+$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(getRecordingRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "DELETE" && path.match(/^\/recordings\/[^/]+$/)) {
          const id = path.split("/")[2] ?? ""
          response = await runRoute(deleteRecordingRoute({ ...baseContext, params: { id } }))
        } else if (req.method === "GET" && path === "/providers/status") {
          response = await runRoute(getProviderStatusRoute({ ...baseContext, params: {} }))
        } else {
          res.writeHead(404, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Not Found" }))
          return
        }

        res.writeHead(response.status, {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          ...(response.headers ?? {})
        })
        res.end(JSON.stringify(response.body))
      } catch (cause) {
        const errorResponse = mapErrorToResponse(cause)
        res.writeHead(errorResponse.status, {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        })
        res.end(JSON.stringify(errorResponse.body))
      }
    }

    server = http.createServer(handleRequest)
    yield* Effect.promise(
      () =>
        new Promise<void>((resolve, reject) => {
          server?.listen(port, host, () => resolve())
          server?.on("error", reject)
        })
    )
    // Get actual port (important when port was 0 for ephemeral assignment)
    const actualAddress = server?.address()
    const actualPort = typeof actualAddress === "object" && actualAddress
      ? actualAddress.port
      : port
    address = { host, port: actualPort }
  }).pipe(Effect.mapError((cause) => new ServerError({ operation: "start", cause })))

  const stopServer = Effect.gen(function*() {
    if (!server) return
    // Interrupt all running session fibers before closing server
    if (runtime) {
      for (const [, fiber] of sessions) {
        yield* Effect.promise(() => runtime!.runPromise(Fiber.interrupt(fiber)).catch(() => {}))
      }
    }
    sessions.clear()
    yield* Effect.promise(
      () =>
        new Promise<void>((resolve, reject) => {
          server?.close((err?: Error) => (err ? reject(err) : resolve()))
        })
    )
    server = null
    if (runtime) {
      yield* Effect.promise(() => runtime!.dispose())
      runtime = null
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "stop", cause }))
  )

  const getAddress = Effect.sync(() => address ?? { host, port }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )

  return {
    port,
    start: () => startServer,
    stop: () => stopServer,
    address: () => getAddress
  }
}

const mapErrorToResponse = (
  cause: unknown
): { status: number; body: { error: string; sessionId?: string } } => {
  const matched = findKnownError(cause)

  if (matched instanceof ValidationError) {
    return { status: 400, body: { error: matched.message } }
  }

  if (matched instanceof SessionNotFound) {
    return { status: 404, body: { error: "Session not found", sessionId: matched.sessionId } }
  }

  return { status: 500, body: { error: "Server error" } }
}

const findKnownError = (cause: unknown): ValidationError | SessionNotFound | null => {
  const visited = new Set<unknown>()
  let current: unknown = cause

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current)

    if (Cause.isCause(current)) {
      const failure = Cause.failureOption(current)
      if (Option.isSome(failure)) {
        current = failure.value
        continue
      }
      return null
    }

    if (current instanceof ValidationError || current instanceof SessionNotFound) {
      return current
    }

    if (current instanceof ServerError) {
      current = current.cause
      continue
    }

    const next = (current as { cause?: unknown }).cause
    if (next) {
      current = next
      continue
    }

    break
  }

  return null
}

const readJson = async (req: http.IncomingMessage): Promise<unknown> => {
  if (!req || req.method === "GET") {
    return null
  }
  const chunks: Array<Buffer> = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return null
  const text = Buffer.concat(chunks).toString("utf8")
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
