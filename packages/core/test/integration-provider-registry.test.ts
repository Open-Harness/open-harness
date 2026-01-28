/**
 * Integration test: ProviderRegistry pipeline.
 *
 * Exercises the full pipeline: registry lookup -> provider.stream() -> agent result.
 * Uses the mock provider through the real ProviderRegistry service and runAgentDef.
 */

import { Effect, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { AgentProvider, AgentStreamEvent, ProviderRunOptions } from "../src/Domain/Provider.js"
import { agent } from "../src/Engine/agent.js"
import {
  type AgentExecutionResult,
  makeInMemoryProviderRegistry,
  ProviderNotFoundError,
  ProviderRegistry,
  runAgentDef
} from "../src/Engine/provider.js"
import { EVENTS } from "../src/Engine/types.js"
import { ProviderModeContext } from "../src/Services/ProviderMode.js"
import { ProviderRecorder, type ProviderRecorderService } from "../src/Services/ProviderRecorder.js"

// ─────────────────────────────────────────────────────────────────
// Mock provider that returns stream events
// ─────────────────────────────────────────────────────────────────

const createTestProvider = (outputData: unknown): AgentProvider => ({
  name: "test-registry-provider",
  stream: (_options: ProviderRunOptions): Stream.Stream<AgentStreamEvent, never> => {
    return Stream.fromIterable([
      { _tag: "TextDelta" as const, delta: "Hello" },
      { _tag: "TextComplete" as const, text: "Hello World" },
      {
        _tag: "Result" as const,
        output: outputData,
        stopReason: "end_turn" as const,
        text: "Hello World"
      }
    ])
  }
})

// Noop recorder
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
// Tests
// ─────────────────────────────────────────────────────────────────

describe("ProviderRegistry pipeline integration", () => {
  it("resolves provider from registry and streams result through runAgentDef", async () => {
    const provider = createTestProvider({ answer: "forty-two" })

    // Build real ProviderRegistry with registered provider
    const registryService = makeInMemoryProviderRegistry()

    const layer = Layer.mergeAll(
      Layer.effect(
        ProviderRegistry,
        Effect.gen(function*() {
          yield* registryService.registerProvider("claude-sonnet-4-5", provider)
          return registryService
        })
      ),
      Layer.succeed(ProviderModeContext, { mode: "live" }),
      Layer.succeed(ProviderRecorder, noopRecorder)
    )

    // Define an agent that uses the registered model
    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "registry-test-agent",
      model: "claude-sonnet-4-5",
      output: z.object({ answer: z.string() }),
      prompt: (state: { input: string }) => `Input: ${state.input}`,
      update: (output: { answer: string }, draft: { input: string }) => {
        draft.input = output.answer
      }
    })

    // Execute the agent through the full pipeline
    const result = await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "What is the answer?" },
        undefined,
        { sessionId: "test-session-1" }
      ).pipe(Effect.provide(layer)) as Effect.Effect<AgentExecutionResult<{ answer: string }>>
    )

    // Verify the output was parsed through the Zod schema
    expect(result.output).toEqual({ answer: "forty-two" })

    // Verify streaming events were captured
    expect(result.events.length).toBeGreaterThan(0)

    const eventNames = result.events.map((e: { name: string }) => e.name)
    expect(eventNames).toContain(EVENTS.AGENT_STARTED)
    expect(eventNames).toContain(EVENTS.TEXT_DELTA)
    expect(eventNames).toContain(EVENTS.AGENT_COMPLETED)

    // Verify text was captured
    expect(result.text).toBe("Hello World")

    // Verify duration was tracked
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("fails with ProviderNotFoundError for unregistered model", async () => {
    const registryService = makeInMemoryProviderRegistry()

    const layer = Layer.mergeAll(
      Layer.succeed(ProviderRegistry, registryService),
      Layer.succeed(ProviderModeContext, { mode: "live" }),
      Layer.succeed(ProviderRecorder, noopRecorder)
    )

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "missing-model-agent",
      model: "non-existent-model",
      output: z.object({ answer: z.string() }),
      prompt: () => "test",
      update: () => {}
    })

    // Use catchAll to inspect the error without crashing
    let caughtError: unknown = null
    await Effect.runPromise(
      runAgentDef(
        testAgent,
        { input: "test" },
        undefined,
        { sessionId: "test-session-2" }
      ).pipe(
        Effect.provide(layer),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            caughtError = error
          })
        )
      )
    )

    // Should fail with ProviderNotFoundError
    expect(caughtError).toBeInstanceOf(ProviderNotFoundError)
    expect((caughtError as ProviderNotFoundError).model).toBe("non-existent-model")
  })

  it("lists registered models from the registry", async () => {
    const registryService = makeInMemoryProviderRegistry()

    const provider1 = createTestProvider({ v: 1 })
    const provider2 = createTestProvider({ v: 2 })

    await Effect.runPromise(
      Effect.gen(function*() {
        yield* registryService.registerProvider("model-a", provider1)
        yield* registryService.registerProvider("model-b", provider2)
      }) as Effect.Effect<void>
    )

    const models = await Effect.runPromise(registryService.listModels())

    expect(models).toContain("model-a")
    expect(models).toContain("model-b")
    expect(models).toHaveLength(2)
  })

  it("pipelines multiple agents through the same registry", async () => {
    const providerA = createTestProvider({ step: "planned" })
    const providerB = createTestProvider({ step: "executed" })

    const registryService = makeInMemoryProviderRegistry()

    const layer = Layer.mergeAll(
      Layer.effect(
        ProviderRegistry,
        Effect.gen(function*() {
          yield* registryService.registerProvider("model-a", providerA)
          yield* registryService.registerProvider("model-b", providerB)
          return registryService
        })
      ),
      Layer.succeed(ProviderModeContext, { mode: "live" }),
      Layer.succeed(ProviderRecorder, noopRecorder)
    )

    const agentA = agent<{ data: string }, { step: string }>({
      name: "agent-a",
      model: "model-a",
      output: z.object({ step: z.string() }),
      prompt: (s: { data: string }) => s.data,
      update: (o: { step: string }, d: { data: string }) => {
        d.data = o.step
      }
    })

    const agentB = agent<{ data: string }, { step: string }>({
      name: "agent-b",
      model: "model-b",
      output: z.object({ step: z.string() }),
      prompt: (s: { data: string }) => s.data,
      update: (o: { step: string }, d: { data: string }) => {
        d.data = o.step
      }
    })

    const program = Effect.gen(function*() {
      const resultA = yield* runAgentDef(
        agentA,
        { data: "start" },
        undefined,
        { sessionId: "pipeline-session" }
      )

      const resultB = yield* runAgentDef(
        agentB,
        { data: resultA.output.step },
        undefined,
        { sessionId: "pipeline-session", causedBy: resultA.events.at(-1)?.id }
      )

      return { a: resultA.output, b: resultB.output }
    }).pipe(Effect.provide(layer)) as Effect.Effect<{ a: { step: string }; b: { step: string } }>

    const result = await Effect.runPromise(program)

    expect(result.a).toEqual({ step: "planned" })
    expect(result.b).toEqual({ step: "executed" })
  })
})
