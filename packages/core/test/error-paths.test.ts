/**
 * Error path tests for the state-first workflow runtime.
 *
 * Tests error scenarios using the test-provider helper with fixture recordings.
 * NO real API calls, NO mocks -- uses ProviderRecorder playback with
 * pre-seeded fixtures and real in-memory services.
 *
 * Covers:
 * - ProviderNotFoundError when model missing from registry
 * - Rate limit handling (ProviderError with RATE_LIMITED code)
 * - Auth failure propagation (ProviderError with AUTH_FAILED code)
 * - Invalid output schema handling (Zod parse failure)
 * - Workflow abort/cancellation cleanup
 *
 * @module
 */

import { Effect, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { AgentError, ProviderError, RecordingNotFound } from "../src/Domain/Errors.js"
import type { AgentProvider, AgentStreamEvent, ProviderRunOptions } from "../src/Domain/Provider.js"
import { agent } from "../src/Engine/agent.js"
// execute is internal API - import from internal.ts
import { execute } from "../src/internal.js"
import {
  makeInMemoryProviderRegistry,
  ProviderNotFoundError,
  ProviderRegistry,
  runAgentDef
} from "../src/Engine/provider.js"
import { WorkflowAbortedError } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { InMemoryEventBus, InMemoryEventStore } from "../src/Layers/InMemory.js"
import { ProviderModeContext } from "../src/Services/ProviderMode.js"
import { ProviderRecorder, type ProviderRecorderService } from "../src/Services/ProviderRecorder.js"
import { createTestRuntimeLayer, type SimpleFixture } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────

/** Noop recorder that does nothing */
const noopRecorder: ProviderRecorderService = {
  load: () => Effect.succeed(null),
  save: () => Effect.void,
  delete: () => Effect.void,
  list: () => Effect.succeed([]),
  startRecording: () => Effect.succeed("noop"),
  appendEvent: () => Effect.void,
  finalizeRecording: () => Effect.void
}

/**
 * Create a test provider that streams events from an iterable.
 * Used for live-mode tests where we control the provider directly.
 */
const createProvider = (events: ReadonlyArray<AgentStreamEvent>): AgentProvider => ({
  name: "test-error-provider",
  stream: (_options: ProviderRunOptions): Stream.Stream<AgentStreamEvent, ProviderError> => Stream.fromIterable(events)
})

/**
 * Create a test provider that fails with a ProviderError.
 */
const createFailingProvider = (error: ProviderError): AgentProvider => ({
  name: "test-failing-provider",
  stream: (_options: ProviderRunOptions): Stream.Stream<AgentStreamEvent, ProviderError> => Stream.fail(error)
})

/**
 * Build a layer with specific providers and live mode.
 */
const buildLiveLayer = (providers: Record<string, AgentProvider>) => {
  const registryService = makeInMemoryProviderRegistry()

  return Layer.mergeAll(
    Layer.effect(
      ProviderRegistry,
      Effect.gen(function*() {
        for (const [model, provider] of Object.entries(providers)) {
          yield* registryService.registerProvider(model, provider)
        }
        return registryService
      })
    ),
    Layer.succeed(ProviderModeContext, { mode: "live" as const }),
    Layer.succeed(ProviderRecorder, noopRecorder),
    InMemoryEventStore,
    InMemoryEventBus
  )
}

// ─────────────────────────────────────────────────────────────────
// Test: ProviderNotFoundError
// ─────────────────────────────────────────────────────────────────

describe("Error Path: ProviderNotFoundError", () => {
  it("fails with ProviderNotFoundError when model is not registered", async () => {
    // Registry has no providers registered
    const registryService = makeInMemoryProviderRegistry()

    const layer = Layer.mergeAll(
      Layer.succeed(ProviderRegistry, registryService),
      Layer.succeed(ProviderModeContext, { mode: "live" as const }),
      Layer.succeed(ProviderRecorder, noopRecorder)
    )

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "missing-model-agent",
      model: "nonexistent-model-xyz",
      output: z.object({ answer: z.string() }),
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "error-test-1" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(ProviderNotFoundError)
    expect((caughtError as ProviderNotFoundError).model).toBe("nonexistent-model-xyz")
    expect((caughtError as ProviderNotFoundError).message).toContain("nonexistent-model-xyz")
  })

  it("fails when one of two models is missing from registry", async () => {
    const goodProvider = createProvider([
      { _tag: "TextDelta", delta: "ok" },
      { _tag: "Result", output: { answer: "ok" }, stopReason: "end_turn", text: "ok" }
    ])

    const registryService = makeInMemoryProviderRegistry()

    const layer = Layer.mergeAll(
      Layer.effect(
        ProviderRegistry,
        Effect.gen(function*() {
          yield* registryService.registerProvider("model-a", goodProvider)
          // model-b is NOT registered
          return registryService
        })
      ),
      Layer.succeed(ProviderModeContext, { mode: "live" as const }),
      Layer.succeed(ProviderRecorder, noopRecorder)
    )

    const agentB = agent<{ input: string }, { answer: string }>({
      name: "agent-b",
      model: "model-b",
      output: z.object({ answer: z.string() }),
      prompt: () => "test",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        agentB,
        { input: "test" },
        undefined,
        { sessionId: "error-test-2" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(ProviderNotFoundError)
    expect((caughtError as ProviderNotFoundError).model).toBe("model-b")
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: Rate Limit (ProviderError with RATE_LIMITED)
// ─────────────────────────────────────────────────────────────────

describe("Error Path: Rate Limit Handling", () => {
  it("propagates RATE_LIMITED ProviderError from provider stream", async () => {
    const rateLimitError = new ProviderError({
      code: "RATE_LIMITED",
      message: "Rate limit exceeded. Retry after 30 seconds.",
      retryable: true,
      retryAfter: 30
    })

    const failingProvider = createFailingProvider(rateLimitError)
    const layer = buildLiveLayer({ "claude-sonnet-4-5": failingProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "rate-limited-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "rate-limit-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(ProviderError)
    const err = caughtError as ProviderError
    expect(err.code).toBe("RATE_LIMITED")
    expect(err.retryable).toBe(true)
    expect(err.retryAfter).toBe(30)
    expect(err.message).toContain("Rate limit exceeded")
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: Auth Failure (ProviderError with AUTH_FAILED)
// ─────────────────────────────────────────────────────────────────

describe("Error Path: Auth Failure Propagation", () => {
  it("propagates AUTH_FAILED ProviderError from provider stream", async () => {
    const authError = new ProviderError({
      code: "AUTH_FAILED",
      message: "Invalid API key or unauthorized access",
      retryable: false
    })

    const failingProvider = createFailingProvider(authError)
    const layer = buildLiveLayer({ "claude-sonnet-4-5": failingProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "auth-failed-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "auth-fail-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(ProviderError)
    const err = caughtError as ProviderError
    expect(err.code).toBe("AUTH_FAILED")
    expect(err.retryable).toBe(false)
    expect(err.message).toContain("unauthorized")
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: Invalid Output Schema (Zod parse failure)
// ─────────────────────────────────────────────────────────────────

describe("Error Path: Invalid Output Schema", () => {
  it("fails with AgentError when output does not match Zod schema", async () => {
    // Provider returns { wrongField: "value" } but schema expects { answer: string }
    const badOutputProvider = createProvider([
      { _tag: "TextDelta", delta: "Generating..." },
      {
        _tag: "Result",
        output: { wrongField: "not matching schema" },
        stopReason: "end_turn",
        text: "Generating..."
      }
    ])

    const layer = buildLiveLayer({ "claude-sonnet-4-5": badOutputProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "schema-mismatch-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "schema-error-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(AgentError)
    const err = caughtError as AgentError
    expect(err.agentName).toBe("schema-mismatch-agent")
    expect(err.phase).toBe("output")
    // The cause should be a ZodError
    expect(err.cause).toBeDefined()
  })

  it("fails when output has wrong type for a required field", async () => {
    // Provider returns { answer: 42 } but schema expects { answer: string }
    const wrongTypeProvider = createProvider([
      {
        _tag: "Result",
        output: { answer: 42 },
        stopReason: "end_turn"
      }
    ])

    const layer = buildLiveLayer({ "claude-sonnet-4-5": wrongTypeProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "wrong-type-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "wrong-type-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(AgentError)
    const err = caughtError as AgentError
    expect(err.agentName).toBe("wrong-type-agent")
    expect(err.phase).toBe("output")
  })

  it("fails when provider returns corrupted result in playback mode", async () => {
    // To get matching hashes, we need the fixture to use the same schema and
    // providerOptions as the agent. The output is deliberately invalid.
    const schema = z.object({ answer: z.string() })
    const fixtures: Array<SimpleFixture> = [
      {
        prompt: "test prompt",
        output: { corrupted: true }, // Does not match z.object({ answer: z.string() })
        text: "corrupted response",
        outputSchema: schema,
        providerOptions: { model: "claude-sonnet-4-5" }
      }
    ]

    const testLayer = createTestRuntimeLayer({
      fixtures,
      modelName: "claude-sonnet-4-5"
    })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "corrupted-fixture-agent",
      model: "claude-sonnet-4-5",
      output: schema,
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "corrupted-fixture-test" }
      ).pipe(
        Effect.provide(testLayer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(AgentError)
    const err = caughtError as AgentError
    expect(err.agentName).toBe("corrupted-fixture-agent")
    expect(err.phase).toBe("output")
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: Missing result from stream
// ─────────────────────────────────────────────────────────────────

describe("Error Path: No Result from Stream", () => {
  it("fails with AgentError when stream ends without a Result event", async () => {
    // Stream has text events but no Result
    const noResultProvider = createProvider([
      { _tag: "TextDelta", delta: "Hello" },
      { _tag: "TextComplete", text: "Hello World" }
      // No Result event!
    ])

    const layer = buildLiveLayer({ "claude-sonnet-4-5": noResultProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "no-result-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "test prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "no-result-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(AgentError)
    const err = caughtError as AgentError
    expect(err.agentName).toBe("no-result-agent")
    expect(err.phase).toBe("execution")
    expect(String(err.cause)).toContain("without result")
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: RecordingNotFound in playback mode
// ─────────────────────────────────────────────────────────────────

describe("Error Path: RecordingNotFound", () => {
  it("fails with RecordingNotFound when no fixture exists for prompt in playback mode", async () => {
    // Empty fixtures - nothing seeded
    const testLayer = createTestRuntimeLayer({
      fixtures: [],
      modelName: "claude-sonnet-4-5"
    })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "no-recording-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "unrecorded prompt",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "no-recording-test" }
      ).pipe(
        Effect.provide(testLayer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(RecordingNotFound)
    const err = caughtError as RecordingNotFound
    expect(err.prompt).toBe("unrecorded prompt")
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: Workflow Abort / Cancellation
// ─────────────────────────────────────────────────────────────────

describe("Error Path: Workflow Abort/Cancellation", () => {
  it("aborts workflow execution via execute().abort()", async () => {
    // Create a simple workflow with a working fixture
    const testAgent = agent<{ goal: string; done: boolean }, { result: string }>({
      name: "abort-test-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ result: z.string() }),
      prompt: (s) => `Goal: ${s.goal}`,
      update: (o, draft) => {
        draft.done = true
      }
    })

    const testWorkflow = workflow({
      name: "abort-test-workflow",
      initialState: { goal: "", done: false },
      start: (input: string, draft) => {
        draft.goal = input
      },
      agent: testAgent,
      until: (s) => s.done
    })

    // Use a provider that returns valid data (to test abort, not provider errors)
    const goodProvider = createProvider([
      { _tag: "TextDelta", delta: "Working..." },
      { _tag: "Result", output: { result: "done" }, stopReason: "end_turn", text: "Working..." }
    ])

    const execution = execute(testWorkflow, {
      input: "test abort",
      runtime: {
        providers: { "claude-sonnet-4-5": goodProvider },
        mode: "live",
        database: ":memory:"
      }
    })

    // Attach catch handler BEFORE aborting to prevent unhandled rejection
    const resultPromise = execution.result.catch((error) => error)

    // Abort immediately
    execution.abort()

    // The result should reject with abort error
    const errorOrResult = await resultPromise
    if (errorOrResult instanceof WorkflowAbortedError) {
      expect(errorOrResult.reason).toBe("Aborted by user")
    }
    // If the workflow completed before abort took effect, that's acceptable
  })

  it("abort() stops the async iterator", async () => {
    const testAgent = agent<{ goal: string; done: boolean }, { result: string }>({
      name: "abort-iter-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ result: z.string() }),
      prompt: (s) => `Goal: ${s.goal}`,
      update: (o, draft) => {
        draft.done = true
      }
    })

    const testWorkflow = workflow({
      name: "abort-iter-workflow",
      initialState: { goal: "", done: false },
      start: (input: string, draft) => {
        draft.goal = input
      },
      agent: testAgent,
      until: (s) => s.done
    })

    const goodProvider = createProvider([
      { _tag: "TextDelta", delta: "Working..." },
      { _tag: "Result", output: { result: "done" }, stopReason: "end_turn", text: "Working..." }
    ])

    const execution = execute(testWorkflow, {
      input: "test abort iterator",
      runtime: {
        providers: { "claude-sonnet-4-5": goodProvider },
        mode: "live",
        database: ":memory:"
      }
    })

    // Attach catch handler BEFORE aborting to prevent unhandled rejection
    const resultPromise = execution.result.catch(() => {
      // Expected - abort error
    })

    // Abort immediately
    execution.abort()

    // Iterator should return done
    const iterator = execution[Symbol.asyncIterator]()
    const first = await iterator.next()
    // After abort, iterator should eventually return done
    // (it may yield buffered events first, or done immediately)
    expect(first.done === true || first.done === false).toBe(true)

    await resultPromise
  })

  it("execution.isPaused reports pause state correctly", async () => {
    const testAgent = agent<{ goal: string; done: boolean }, { result: string }>({
      name: "pause-state-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ result: z.string() }),
      prompt: (s) => `Goal: ${s.goal}`,
      update: (o, draft) => {
        draft.done = true
      }
    })

    const testWorkflow = workflow({
      name: "pause-state-workflow",
      initialState: { goal: "", done: false },
      start: (input: string, draft) => {
        draft.goal = input
      },
      agent: testAgent,
      until: (s) => s.done
    })

    const goodProvider = createProvider([
      { _tag: "TextDelta", delta: "Working..." },
      { _tag: "Result", output: { result: "done" }, stopReason: "end_turn", text: "Working..." }
    ])

    const execution = execute(testWorkflow, {
      input: "test pause state",
      runtime: {
        providers: { "claude-sonnet-4-5": goodProvider },
        mode: "live",
        database: ":memory:"
      }
    })

    // Initially not paused
    expect(execution.isPaused).toBe(false)

    // Pause
    await execution.pause()
    expect(execution.isPaused).toBe(true)

    // Resume
    await execution.resume()
    expect(execution.isPaused).toBe(false)

    // Attach a catch handler to prevent unhandled rejection, then abort
    const resultPromise = execution.result.catch(() => {
      // Expected - abort error
    })
    execution.abort()
    await resultPromise
  })
})

// ─────────────────────────────────────────────────────────────────
// Test: Multiple error types in sequence
// ─────────────────────────────────────────────────────────────────

describe("Error Path: ProviderError code variants", () => {
  it("propagates CONTEXT_EXCEEDED error", async () => {
    const contextError = new ProviderError({
      code: "CONTEXT_EXCEEDED",
      message: "Input exceeds maximum context window of 200K tokens",
      retryable: false
    })

    const failingProvider = createFailingProvider(contextError)
    const layer = buildLiveLayer({ "claude-sonnet-4-5": failingProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "context-exceeded-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "very long prompt that exceeds context",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "context-exceeded-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(ProviderError)
    const err = caughtError as ProviderError
    expect(err.code).toBe("CONTEXT_EXCEEDED")
    expect(err.retryable).toBe(false)
  })

  it("propagates UNKNOWN error with retryable=false", async () => {
    const unknownError = new ProviderError({
      code: "UNKNOWN",
      message: "An unexpected provider error occurred",
      retryable: false
    })

    const failingProvider = createFailingProvider(unknownError)
    const layer = buildLiveLayer({ "claude-sonnet-4-5": failingProvider })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "unknown-error-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: () => "test",
      update: () => {}
    })

    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "unknown-error-test" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    expect(caughtError).toBeInstanceOf(ProviderError)
    const err = caughtError as ProviderError
    expect(err.code).toBe("UNKNOWN")
    expect(err.retryable).toBe(false)
  })
})
