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

import { InMemoryEventBus } from "../Layers/InMemory.js"
import { EventStoreLive } from "../Layers/LibSQL.js"
import { EventBus } from "../Services/EventBus.js"
import { EventStore } from "../Services/EventStore.js"
import { ProviderModeContext } from "../Services/ProviderMode.js"
import { ProviderRecorder, type ProviderRecorderService } from "../Services/ProviderRecorder.js"

import type { RuntimeConfig } from "./execute.js"
import { makeInMemoryProviderRegistry, ProviderRegistry } from "./provider.js"
import { executeWorkflow } from "./runtime.js"
import { type WorkflowObserver, type WorkflowResult } from "./types.js"
import type { WorkflowDef } from "./workflow.js"

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
}

/**
 * Result from run() including execution metadata.
 */
export interface RunResult<S> extends WorkflowResult<S> {
  /** Total execution duration in milliseconds */
  readonly durationMs: number
}

// ─────────────────────────────────────────────────────────────────
// Run Function
// ─────────────────────────────────────────────────────────────────

/**
 * Run a workflow and return the result.
 *
 * This is a simpler alternative to execute() that uses the observer
 * protocol for event handling.
 *
 * @template S - State type
 * @template Input - Input type
 *
 * @param workflow - The workflow definition to execute
 * @param options - Run options including input and observer
 * @returns Promise resolving to the workflow result
 *
 * @example Basic usage with observer:
 * ```typescript
 * const result = await run(myWorkflow, {
 *   input: "Build a REST API",
 *   runtime: myRuntime,
 *   observer: {
 *     event: (event) => console.log(event.name),
 *     stateChanged: (state) => console.log("State:", state),
 *   },
 * })
 *
 * console.log("Final state:", result.state)
 * ```
 */
// Noop recorder for when no recorder is provided
const noopRecorder: ProviderRecorderService = {
  load: () => Effect.succeed(null),
  save: () => Effect.void,
  delete: () => Effect.void,
  list: () => Effect.succeed([]),
  startRecording: () => Effect.succeed("noop"),
  appendEvent: () => Effect.void,
  finalizeRecording: () => Effect.void
}

export async function run<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: RunOptions<S, Input>
): Promise<RunResult<S>> {
  const startTime = Date.now()

  // Generate session ID
  const sessionId = options.sessionId ?? crypto.randomUUID()

  // Build service layers from runtime config
  const { runtime } = options
  const registryService = makeInMemoryProviderRegistry()

  const ProviderRegistryLayer = Layer.effect(
    ProviderRegistry,
    Effect.gen(function*() {
      for (const [model, provider] of Object.entries(runtime.providers)) {
        yield* registryService.registerProvider(model, provider)
      }
      return registryService
    })
  )

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
    : InMemoryEventBus

  const runtimeLayer = Layer.mergeAll(
    ProviderRegistryLayer,
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
      ...(options.observer ? { observer: options.observer } : {})
    })

    return result
  }).pipe(Effect.provide(runtimeLayer))

  // If an abort signal is provided, use runFork with signal listener
  if (options.signal) {
    const fiber = Effect.runFork(program)

    // Wire abort signal to interrupt the fiber
    const abortListener = () => {
      Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
    }

    // Check if already aborted
    if (options.signal.aborted) {
      Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
      throw new Error("Workflow aborted")
    }

    // Add listener for future abort
    options.signal.addEventListener("abort", abortListener, { once: true })

    try {
      const result = await Effect.runPromise(Fiber.join(fiber))
      return {
        ...result,
        durationMs: Date.now() - startTime
      }
    } catch (error) {
      // Check if this was an abort-triggered interruption
      if (options.signal.aborted) {
        throw new Error("Workflow aborted")
      }
      throw error
    } finally {
      options.signal.removeEventListener("abort", abortListener)
    }
  }

  // No abort signal - run directly
  const result = await Effect.runPromise(program)

  return {
    ...result,
    durationMs: Date.now() - startTime
  }
}

// ─────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Run a workflow with minimal options.
 *
 * Convenience wrapper when you just need the result without callbacks.
 *
 * @example
 * ```typescript
 * const result = await runSimple(myWorkflow, "Build an API", {
 *   providers: { "claude-sonnet-4-5": anthropicProvider }
 * })
 * console.log(result.state)
 * ```
 */
export async function runSimple<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  input: Input,
  runtime: RuntimeConfig
): Promise<WorkflowResult<S>> {
  return run(workflow, { input, runtime })
}

/**
 * Run a workflow and collect all text output.
 *
 * Convenience wrapper for text generation workflows.
 *
 * @example
 * ```typescript
 * const { text, result } = await runWithText(myWorkflow, "Generate code", {
 *   providers: { "claude-sonnet-4-5": anthropicProvider }
 * })
 * console.log("Generated:", text)
 * ```
 */
export async function runWithText<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  input: Input,
  runtime: RuntimeConfig
): Promise<{ text: string; result: WorkflowResult<S> }> {
  const chunks: Array<string> = []

  const result = await run(workflow, {
    input,
    runtime,
    observer: {
      onTextDelta(info) {
        chunks.push(info.delta)
      }
    }
  })

  return {
    text: chunks.join(""),
    result
  }
}
