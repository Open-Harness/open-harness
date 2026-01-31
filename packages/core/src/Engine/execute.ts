/**
 * Public execute API for workflow execution.
 *
 * Provides an async iterator interface for consuming workflow events
 * in real-time, with support for HITL (respond/pause/resume).
 *
 * @module
 */

import { Effect, Fiber, Layer, Queue } from "effect"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import type { ProviderMode } from "../Domain/Provider.js"
import { EventStoreLive } from "../Layers/LibSQL.js"
import { EventBus, EventBusLive, type EventBusService } from "../Services/EventBus.js"
import { EventStore, type EventStoreService } from "../Services/EventStore.js"
import { ProviderModeContext } from "../Services/ProviderMode.js"
import { ProviderRecorder, type ProviderRecorderService } from "../Services/ProviderRecorder.js"

import type { SerializedEvent } from "../Domain/Events.js"
import { type ExecuteOptions, executeWorkflow } from "./runtime.js"
import { WorkflowAbortedError } from "./types.js"
import type { WorkflowError, WorkflowResult } from "./types.js"
import type { WorkflowDef } from "./workflow.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/**
 * Runtime configuration for workflow execution.
 *
 * Provides the required services for running workflows:
 * - mode: "live" for real API calls, "playback" for recordings
 * - recorder: Service for recording/replaying provider responses
 * - database: Storage URL for event persistence
 */
export interface RuntimeConfig {
  /**
   * Provider mode: "live" or "playback"
   * @default "live"
   */
  readonly mode?: ProviderMode

  /**
   * Provider recorder service for recording/playback.
   * If not provided, recordings are disabled (noop recorder).
   */
  readonly recorder?: ProviderRecorderService

  /**
   * EventStore service for persisting events.
   * If not provided, an in-memory store is used.
   */
  readonly eventStore?: EventStoreService

  /**
   * EventBus service for broadcasting events.
   * If not provided, an in-memory bus is used.
   */
  readonly eventBus?: EventBusService

  /**
   * Database URL for persistent storage (LibSQL connection string).
   * When provided (and `eventStore` is not), auto-constructs a LibSQL-backed EventStore.
   * When neither `database` nor `eventStore` is provided, defaults to
   * `file:~/.openscaffold/scaffold.db` (always persistent, no in-memory fallback).
   *
   * @default `file:${homedir()}/.openscaffold/scaffold.db`
   * @example "file:./my-project.db"
   * @example ":memory:" for tests
   */
  readonly database?: string
}

/**
 * Extended options for execute() that includes runtime configuration.
 */
export interface ExecuteWithRuntimeOptions<Input> extends ExecuteOptions<Input> {
  /**
   * Runtime configuration with providers and mode.
   * Required for actual workflow execution.
   */
  readonly runtime: RuntimeConfig
}

/**
 * A running workflow execution with async iterator for events.
 *
 * @template S - State type
 *
 * @example
 * ```typescript
 * const execution = execute(myWorkflow, {
 *   input: "Build API",
 *   runtime: { mode: "live" }
 * })
 *
 * // Iterate over events as they occur
 * for await (const event of execution) {
 *   console.log(event.name, event.payload)
 * }
 *
 * // Get final result
 * const result = await execution.result
 * console.log("Final state:", result.state)
 * ```
 */
export interface WorkflowExecution<S> {
  /**
   * Async iterator for consuming events as they occur.
   * Events are yielded in real-time during workflow execution.
   */
  [Symbol.asyncIterator](): AsyncIterator<SerializedEvent, undefined>

  /**
   * Promise that resolves when workflow completes.
   * Contains the final state and all events.
   */
  readonly result: Promise<WorkflowResult<S>>

  /**
   * Session ID for this execution.
   */
  readonly sessionId: string

  /**
   * Provide a response for HITL (human-in-the-loop) prompts.
   * Call this when the workflow emits an input:requested event.
   *
   * @param value - The human's response
   */
  respond(value: string): void

  /**
   * Pause workflow execution.
   * The workflow will stop at the next yield point.
   * Use resume() to continue.
   */
  pause(): Promise<void>

  /**
   * Resume a paused workflow.
   */
  resume(): Promise<void>

  /**
   * Check if the workflow is currently paused.
   */
  readonly isPaused: boolean

  /**
   * Abort the workflow execution.
   * The result promise will reject with an abort error.
   */
  abort(): void
}

// ─────────────────────────────────────────────────────────────────
// Noop Recorder (for when no recorder is provided)
// ─────────────────────────────────────────────────────────────────

const noopRecorder: ProviderRecorderService = {
  load: () => Effect.succeed(null),
  save: () => Effect.void,
  delete: () => Effect.void,
  list: () => Effect.succeed([]),
  startRecording: () => Effect.succeed("noop"),
  appendEvent: () => Effect.void,
  finalizeRecording: () => Effect.void
}

// ─────────────────────────────────────────────────────────────────
// Execute Function
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a workflow and return a handle for controlling it.
 *
 * This is the main entry point for running workflows with the new
 * state-first DX. It returns a WorkflowExecution that:
 * - Implements AsyncIterable for streaming events
 * - Provides pause/resume/respond methods for HITL
 * - Has a result promise for the final outcome
 *
 * @template S - State type
 * @template Input - Input type
 *
 * @param workflow - The workflow definition to execute
 * @param options - Execution options including runtime configuration
 * @returns A WorkflowExecution handle
 *
 * @example Basic usage:
 * ```typescript
 * const execution = execute(myWorkflow, {
 *   input: "Build API",
 *   runtime: { mode: "live" }
 * })
 *
 * for await (const event of execution) {
 *   if (event.name === "input:requested") {
 *     execution.respond("approved")
 *   }
 * }
 *
 * const result = await execution.result
 * ```
 */
export function execute<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: ExecuteWithRuntimeOptions<Input>
): WorkflowExecution<S> {
  // Generate session ID upfront so we can return it immediately
  const sessionId = options.sessionId ?? crypto.randomUUID()

  // Create shared state for the execution
  let isPaused = false
  let isAborted = false

  // AbortController for cancelling provider HTTP requests (Level 3)
  const abortController = new AbortController()

  // Fiber reference for interrupting the Effect (Level 2)
  // Type is unknown for error since executeWorkflow has a complex union type
  // Note: definite assignment assertion (!) is used because fiber is assigned
  // synchronously before any usage in the code flow below
  let fiber!: Fiber.RuntimeFiber<WorkflowResult<S>, unknown>

  // Done result for async iterator - properly typed to avoid casts
  const DONE: IteratorReturnResult<undefined> = { value: undefined, done: true }

  // Event queue for streaming - will be populated by the runtime
  const eventBuffer: Array<SerializedEvent> = []
  const eventWaiters: Array<{
    resolve: (value: IteratorResult<SerializedEvent, undefined>) => void
    reject: (error: unknown) => void
  }> = []
  let isComplete = false
  let completionError: WorkflowError | undefined

  // HITL input queue: shared between respond() and the runtime's Queue.take()
  // Created eagerly so respond() can feed into it synchronously
  const inputQueue = Effect.runSync(Queue.unbounded<string>())

  // Pause/resume state
  let pauseResolver: (() => void) | undefined

  // Result handling
  let resultPromiseResolve: (value: WorkflowResult<S>) => void
  let resultPromiseReject: (error: WorkflowError) => void
  const resultPromise = new Promise<WorkflowResult<S>>((resolve, reject) => {
    resultPromiseResolve = resolve
    resultPromiseReject = reject
  })

  // Helper to emit an event to the stream
  const emitEvent = (event: SerializedEvent): void => {
    if (eventWaiters.length > 0) {
      const waiter = eventWaiters.shift()!
      waiter.resolve({ value: event, done: false })
    } else {
      eventBuffer.push(event)
    }
  }

  // Helper to signal completion
  const signalComplete = (result?: WorkflowResult<S>, error?: WorkflowError): void => {
    isComplete = true
    completionError = error

    // Resolve/reject all waiting iterators
    while (eventWaiters.length > 0) {
      const waiter = eventWaiters.shift()!
      if (error) {
        waiter.reject(error)
      } else {
        waiter.resolve(DONE)
      }
    }

    // Resolve/reject the result promise
    if (error) {
      resultPromiseReject(error)
    } else if (result) {
      resultPromiseResolve(result)
    }
  }

  // Build the service layer from runtime config
  const { runtime } = options

  // Build layers
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

  // Run the workflow using Effect runtime
  const program = Effect.gen(function*() {
    // Execute the workflow, passing the shared inputQueue for HITL wiring
    // and an onEvent callback for real-time event streaming
    const result = yield* executeWorkflow(workflow, {
      ...options,
      sessionId,
      inputQueue,
      onEvent: emitEvent
    })

    return result
  }).pipe(Effect.provide(runtimeLayer))

  // Start execution using runFork to get fiber reference for interruption
  // eslint-disable-next-line prefer-const -- fiber is declared outside this scope for use in abort handlers
  fiber = Effect.runFork(program)

  // Observe fiber completion to signal result
  fiber.addObserver((exit) => {
    if (exit._tag === "Success") {
      signalComplete(exit.value)
    } else if (exit._tag === "Failure") {
      // Check if this was an interruption (from abort)
      const cause = exit.cause
      if (cause._tag === "Interrupt") {
        // Already handled by abort() - don't double-signal
        if (!isAborted) {
          signalComplete(undefined, new WorkflowAbortedError({ reason: "Interrupted" }))
        }
      } else if (cause._tag === "Fail") {
        signalComplete(undefined, cause.error as WorkflowError)
      } else {
        // Die or other unexpected cause
        signalComplete(undefined, new WorkflowAbortedError({ reason: "Unexpected error" }))
      }
    }
  })

  // Create the async iterator
  const asyncIterator = (): AsyncIterator<SerializedEvent, undefined> => ({
    next: (): Promise<IteratorResult<SerializedEvent, undefined>> => {
      // Check if aborted
      if (isAborted) {
        return Promise.resolve(DONE)
      }

      // If we have buffered events, return immediately
      if (eventBuffer.length > 0) {
        const event = eventBuffer.shift()!
        return Promise.resolve({ value: event, done: false })
      }

      // If complete, return done
      if (isComplete) {
        if (completionError) {
          return Promise.reject(completionError)
        }
        return Promise.resolve(DONE)
      }

      // Wait for next event
      return new Promise((resolve, reject) => {
        eventWaiters.push({ resolve, reject })
      })
    },

    // Handle early termination (break from for-await loop)
    return: (): Promise<IteratorResult<SerializedEvent, undefined>> => {
      // Cancel provider HTTP request
      abortController.abort()
      // Interrupt the Effect fiber
      if (fiber) {
        Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
      }
      return Promise.resolve(DONE)
    }
  })

  // Create the execution handle
  const execution: WorkflowExecution<S> = {
    [Symbol.asyncIterator]: asyncIterator,

    result: resultPromise,

    sessionId,

    respond(value: string): void {
      // Feed the response into the runtime's Effect Queue so that
      // Queue.take(ctx.inputQueue) in the runtime unblocks.
      Effect.runSync(Queue.offer(inputQueue, value))
    },

    async pause(): Promise<void> {
      if (isPaused) return
      isPaused = true
      // The actual pause is handled in the runtime's executePhase/executeSimpleWorkflow
      // by checking isPausedRef and awaiting pauseDeferred
    },

    async resume(): Promise<void> {
      if (!isPaused) return
      isPaused = false
      if (pauseResolver) {
        pauseResolver()
        pauseResolver = undefined
      }
    },

    get isPaused(): boolean {
      return isPaused
    },

    abort(): void {
      isAborted = true
      // Level 3: Cancel SDK HTTP request
      abortController.abort()
      // Level 2: Interrupt Effect fiber
      if (fiber) {
        Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
      }
      // Level 1: Signal completion with abort error
      signalComplete(undefined, new WorkflowAbortedError({ reason: "Aborted by user" }))
    }
  }

  return execution
}
