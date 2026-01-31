/**
 * Integration test: Provider instance on agent (ADR-010).
 *
 * Exercises the pattern where agents own their provider directly.
 * Tests runAgentDef with provider instance.
 *
 * Per ADR-010: ProviderRegistry has been removed entirely.
 * Agents now own their providers directly at definition time.
 */

import { Effect, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { tagToEventName } from "../src/Domain/Events.js"
import type { AgentProvider, AgentStreamEvent, ProviderRunOptions } from "../src/Domain/Provider.js"
import { agent } from "../src/Engine/agent.js"
import { type AgentExecutionResult, runAgentDef } from "../src/Engine/provider.js"
import { ProviderModeContext } from "../src/Services/ProviderMode.js"
import { ProviderRecorder, type ProviderRecorderService } from "../src/Services/ProviderRecorder.js"

// ─────────────────────────────────────────────────────────────────
// Test provider that returns stream events
// ─────────────────────────────────────────────────────────────────

const createTestProvider = (modelName: string, outputData: unknown): AgentProvider => ({
  name: "test-provider",
  model: modelName,
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
  delete: () => Effect.void,
  list: () => Effect.succeed([]),
  startRecording: () => Effect.succeed("noop"),
  appendEvent: () => Effect.void,
  finalizeRecording: () => Effect.void
}

// Base layer for tests (no ProviderRegistry needed per ADR-010)
const baseLayer = Layer.mergeAll(
  Layer.succeed(ProviderModeContext, { mode: "live" }),
  Layer.succeed(ProviderRecorder, noopRecorder)
)

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("Agent with provider instance (ADR-010)", () => {
  it("executes agent with provider instance directly", async () => {
    const provider = createTestProvider("claude-sonnet-4-5", { answer: "forty-two" })

    // Per ADR-010: Agent owns provider directly
    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "direct-provider-agent",
      provider,
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
      ).pipe(Effect.provide(baseLayer)) as Effect.Effect<AgentExecutionResult<{ answer: string }>>
    )

    // Verify the output was parsed through the Zod schema
    expect(result.output).toEqual({ answer: "forty-two" })

    // Verify streaming events were captured
    expect(result.events.length).toBeGreaterThan(0)

    const eventNames = result.events.map((e: { name: string }) => e.name)
    expect(eventNames).toContain(tagToEventName.AgentStarted)
    expect(eventNames).toContain(tagToEventName.TextDelta)
    expect(eventNames).toContain(tagToEventName.AgentCompleted)

    // Verify text was captured
    expect(result.text).toBe("Hello World")

    // Verify duration was tracked
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("pipelines multiple agents with different providers", async () => {
    const providerA = createTestProvider("model-a", { step: "planned" })
    const providerB = createTestProvider("model-b", { step: "executed" })

    // Per ADR-010: Each agent owns its provider
    const agentA = agent<{ data: string }, { step: string }>({
      name: "agent-a",
      provider: providerA,
      output: z.object({ step: z.string() }),
      prompt: (s: { data: string }) => s.data,
      update: (o: { step: string }, d: { data: string }) => {
        d.data = o.step
      }
    })

    const agentB = agent<{ data: string }, { step: string }>({
      name: "agent-b",
      provider: providerB,
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
    }).pipe(Effect.provide(baseLayer)) as Effect.Effect<{ a: { step: string }; b: { step: string } }>

    const result = await Effect.runPromise(program)

    expect(result.a).toEqual({ step: "planned" })
    expect(result.b).toEqual({ step: "executed" })
  })

  it("uses provider.model for hash computation", async () => {
    // The provider's model is used for hash computation (for recording/playback)
    const provider = createTestProvider("my-model-123", { answer: "test" })

    const testAgent = agent<{ input: string }, { answer: string }>({
      name: "model-hash-agent",
      provider,
      output: z.object({ answer: z.string() }),
      prompt: () => "test",
      update: () => {}
    })

    expect(testAgent.provider.model).toBe("my-model-123")
    expect(testAgent.provider.name).toBe("test-provider")
  })
})

// Note: ProviderRegistry tests removed per ADR-010.
// Agents now own their providers directly, so there's no registry lookup.
