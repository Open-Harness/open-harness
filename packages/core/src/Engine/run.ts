/**
 * Simple Promise-based run API for workflow execution.
 *
 * This provides a simpler alternative to execute() when you don't need
 * the full async iterator interface. Uses the observer protocol for
 * event handling.
 *
 * @module
 */

import { Effect, Fiber, Layer } from "effect"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { EventStoreLive } from "../Layers/LibSQL.js"
import { EventBus, EventBusLive } from "../Services/EventBus.js"
import { EventStore } from "../Services/EventStore.js"
import { ProviderModeContext } from "../Services/ProviderMode.js"
import { ProviderRecorder, type ProviderRecorderService } from "../Services/ProviderRecorder.js"

import type { HumanInputHandler } from "../helpers/humanInput.js"

// Re-export RuntimeConfig from execute.ts for use in RunOptions
// This is the primary export path per ADR-001
import type { RuntimeConfig } from "./execute.js"
import { executeWorkflow } from "./runtime.js"
import { type WorkflowObserver, type WorkflowResult } from "./types.js"
import type { WorkflowDef } from "./workflow.js"

export type { RuntimeConfig }

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/**
 * Options for the run() function.
 *
 * @template S - State type
 * @template Input - Input type
 */
export interface RunOptions<S, Input> {
  /** Input to the workflow's start() function */
  readonly input: Input

  /**
   * Runtime configuration with providers and mode.
   * Required for actual workflow execution.
   */
  readonly runtime: RuntimeConfig

  /** Optional session ID (generates new UUID if not provided) */
  readonly sessionId?: string

  /**
   * Abort signal for cancelling execution.
   */
  readonly signal?: AbortSignal

  /**
   * Observer for structured lifecycle callbacks.
   * Receives typed callbacks for all workflow lifecycle events.
   */
  readonly observer?: WorkflowObserver<S>

  /**
   * Human input handler for HITL (Human-in-the-Loop) interactions.
   *
   * Per ADR-002: Provides approval() and choice() callbacks for human input.
   * Use cliPrompt() for terminal-based prompts or autoApprove() for testing.
   *
   * @example
   * ```typescript
   * import { cliPrompt } from "@openscaffold/core"
   *
   * await run(workflow, {
   *   input: "Build API",
   *   runtime: myRuntime,
   *   humanInput: cliPrompt()
   * })
   * ```
   */
  readonly humanInput?: HumanInputHandler
}

/**
 * Result from run() including execution metadata.
 */
export interface RunResult<S> extends WorkflowResult<S> {
  /** Total execution duration in milliseconds */
  readonly durationMs: number
}

/**
 * A running workflow execution with control methods.
 *
 * Implements PromiseLike so it can be awaited directly:
 * ```typescript
 * const result = await run(workflow, options)
 * ```
 *
 * Or used with control methods:
 * ```typescript
 * const execution = run(workflow, options)
 * execution.pause()
 * execution.resume()
 * const result = await execution
 * ```
 *
 * Per ADR-001: This is the single public API for workflow execution,
 * consolidating execute(), runSimple(), and runWithText().
 *
 * @template S - State type
 */
export interface WorkflowExecution<S> extends PromiseLike<RunResult<S>> {
  /**
   * Session ID for this execution.
   */
  readonly sessionId: string

  /**
   * Whether the workflow is currently paused.
   */
  readonly isPaused: boolean

  /**
   * Pause workflow execution.
   * The workflow will stop at the next yield point.
   * Use resume() to continue.
   */
  pause(): void

  /**
   * Resume a paused workflow.
   */
  resume(): void

  /**
   * Abort the workflow execution.
   * The result promise will reject with an abort error.
   */
  abort(): void
}

// ─────────────────────────────────────────────────────────────────
// Run Function
// ─────────────────────────────────────────────────────────────────

// Noop recorder for when no recorder is provided
const noopRecorder: ProviderRecorderService = {
  load: () => Effect.succeed(null),
  delete: () => Effect.void,
  list: () => Effect.succeed([]),
  startRecording: () => Effect.succeed("noop"),
  appendEvent: () => Effect.void,
  finalizeRecording: () => Effect.void
}

/**
 * Run a workflow and return a WorkflowExecution handle.
 *
 * Per ADR-001: This is the single public API for workflow execution.
 * It returns a WorkflowExecution that:
 * - Implements PromiseLike (can be awaited directly)
 * - Has pause(), resume(), abort() methods
 * - Uses observer callbacks for events
 *
 * @template S - State type
 * @template Input - Input type
 *
 * @param workflow - The workflow definition to execute
 * @param options - Run options including input and observer
 * @returns WorkflowExecution handle that can be awaited or controlled
 *
 * @example Simple usage (just await):
 * ```typescript
 * const result = await run(myWorkflow, {
 *   input: "Build a REST API",
 *   runtime: myRuntime
 * })
 * console.log("Final state:", result.state)
 * ```
 *
 * @example With observer callbacks:
 * ```typescript
 * const result = await run(myWorkflow, {
 *   input: "Build a REST API",
 *   runtime: myRuntime,
 *   observer: {
 *     onTextDelta: ({ delta }) => process.stdout.write(delta),
 *     onStateChanged: (state) => console.log("State:", state),
 *   },
 * })
 * ```
 *
 * @example With pause/resume:
 * ```typescript
 * const execution = run(myWorkflow, { input: "Hello", runtime })
 * execution.pause()
 * // ... later
 * execution.resume()
 * const result = await execution
 * ```
 */
export function run<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: RunOptions<S, Input>
): WorkflowExecution<S> {
  const startTime = Date.now()

  // Generate session ID upfront so it's available immediately
  const sessionId = options.sessionId ?? crypto.randomUUID()

  // Mutable state for pause/resume/abort
  let isPaused = false
  let isAborted = false

  // Build service layers from runtime config
  const { runtime } = options

  const ProviderModeLayer = Layer.succeed(ProviderModeContext, {
    mode: runtime.mode ?? "live"
  })

  const ProviderRecorderLayer = Layer.succeed(
    ProviderRecorder,
    runtime.recorder ?? noopRecorder
  )

  const defaultDbUrl = (() => {
    const dir = join(homedir(), ".openscaffold")
    mkdirSync(dir, { recursive: true })
    return `file:${join(dir, "scaffold.db")}`
  })()

  const EventStoreLayer = runtime.eventStore
    ? Layer.succeed(EventStore, runtime.eventStore)
    : EventStoreLive({ url: runtime.database ?? defaultDbUrl })

  const EventBusLayer = runtime.eventBus
    ? Layer.succeed(EventBus, runtime.eventBus)
    : Layer.effect(EventBus, EventBusLive)

  const runtimeLayer = Layer.mergeAll(
    ProviderModeLayer,
    ProviderRecorderLayer,
    EventStoreLayer,
    EventBusLayer
  )

  // Create the Effect program
  const program = Effect.gen(function*() {
    const result = yield* executeWorkflow(workflow, {
      input: options.input,
      sessionId,
      ...(options.observer ? { observer: options.observer } : {}),
      ...(options.humanInput ? { humanInput: options.humanInput } : {})
    })

    return result
  }).pipe(Effect.provide(runtimeLayer))

  // Start execution with runFork to get fiber for interruption
  const fiber = Effect.runFork(program)

  // Wire external AbortSignal if provided
  if (options.signal) {
    const abortListener = () => {
      isAborted = true
      Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
    }

    if (options.signal.aborted) {
      isAborted = true
      Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
    } else {
      options.signal.addEventListener("abort", abortListener, { once: true })
    }
  }

  // Create the result promise that resolves when fiber completes
  const resultPromise = Effect.runPromise(Fiber.join(fiber)).then(
    (result): RunResult<S> => ({
      ...result,
      durationMs: Date.now() - startTime
    }),
    (error) => {
      // Check if this was an abort-triggered interruption
      if (isAborted || options.signal?.aborted) {
        throw new Error("Workflow aborted")
      }
      throw error
    }
  )

  // Create the WorkflowExecution handle
  const execution: WorkflowExecution<S> = {
    sessionId,

    get isPaused(): boolean {
      return isPaused
    },

    pause(): void {
      if (isPaused) return
      isPaused = true
      // Note: The actual pause is handled in the runtime's executePhase/executeSimpleWorkflow
      // by checking isPausedRef and awaiting pauseDeferred. Currently this sets local state
      // but doesn't wire to the runtime's Ref. Full pause/resume wiring requires exposing
      // the runtime's isPausedRef and pauseDeferred, which will be done in a follow-up task.
    },

    resume(): void {
      if (!isPaused) return
      isPaused = false
      // Note: Same as pause() - full wiring to runtime's Deferred.succeed(pauseDeferred)
      // requires exposing those from executeWorkflow. This is a stub for now.
    },

    abort(): void {
      if (isAborted) return
      isAborted = true
      Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
    },

    // PromiseLike implementation
    then<TResult1 = RunResult<S>, TResult2 = never>(
      onfulfilled?: ((value: RunResult<S>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return resultPromise.then(onfulfilled, onrejected)
    }
  }

  return execution
}
