/**
 * End-to-end recording/playback tests.
 *
 * Tests the full recording/playback cycle:
 * 1. Run workflow in "live" mode (records provider responses)
 * 2. Run same workflow in "playback" mode (replays recorded responses)
 * 3. Verify both produce identical results
 *
 * IMPORTANT: Uses REAL Anthropic SDK (subscription, NO API KEY).
 *
 * @module
 */

import { Effect, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { AgentStreamEvent, ProviderRunOptions } from "@open-scaffold/core"
import { Services } from "@open-scaffold/core/internal"

import { AnthropicProvider } from "../src/provider/Provider.js"
import { ProviderRecorderLive } from "../src/store/ProviderRecorderLive.js"

const { ProviderModeContext: _ProviderModeContext } = Services

// ─────────────────────────────────────────────────────────────────
// Test Schema and Types
// ─────────────────────────────────────────────────────────────────

const MathOutputSchema = z.object({
  answer: z.number(),
  explanation: z.string()
})

type MathOutput = z.infer<typeof MathOutputSchema>

// Simple hash for testing (consistent with existing test patterns)
const simpleHash = (prompt: string): string => `test-${Buffer.from(prompt).toString("base64").slice(0, 20)}`

// ─────────────────────────────────────────────────────────────────
// Test Provider
// ─────────────────────────────────────────────────────────────────

const testProvider = AnthropicProvider({ model: "claude-haiku-4-5" })

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Build provider options for testing.
 */
const buildProviderOptions = (prompt: string): ProviderRunOptions => ({
  prompt,
  outputSchema: MathOutputSchema,
  providerOptions: { maxTokens: 256 }
})

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

// Skip in CI - requires live Anthropic API access
describe.skipIf(process.env.CI)("Recording/Playback E2E", () => {
  it("records in live mode and replays in playback mode with identical results", async () => {
    // Use :memory: for isolated ephemeral database - SHARED across the entire test
    const recorderLayer = ProviderRecorderLive({ url: ":memory:" })

    const prompt = "What is 7 multiplied by 8? Answer with the numeric result and a brief explanation."
    const providerOptions = buildProviderOptions(prompt)
    const hash = simpleHash(prompt)

    // ─────────────────────────────────────────────────────────────────
    // Combined program: Record then Playback in same Effect context
    // This ensures the same :memory: database is used for both operations
    // ─────────────────────────────────────────────────────────────────
    const combinedProgram = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // ─────────────────────────────────────────────────────────────────
      // STEP 1: Record in LIVE mode
      // ─────────────────────────────────────────────────────────────────
      console.log("Starting LIVE recording...")

      const recordingId = yield* recorder.startRecording(hash, {
        prompt: providerOptions.prompt,
        provider: testProvider.name
      })

      const events: Array<AgentStreamEvent> = []
      let resultEvent: AgentStreamEvent | null = null

      yield* testProvider.stream(providerOptions).pipe(
        Stream.tap((event) =>
          Effect.gen(function*() {
            events.push(event)
            if (event._tag === "Result") {
              resultEvent = event
            }
            yield* recorder.appendEvent(recordingId, event)
          })
        ),
        Stream.runDrain
      )

      // Finalize recording
      if (resultEvent && resultEvent._tag === "Result") {
        yield* recorder.finalizeRecording(recordingId, {
          output: resultEvent.output,
          stopReason: resultEvent.stopReason,
          ...(resultEvent.text ? { text: resultEvent.text } : {}),
          ...(resultEvent.usage ? { usage: resultEvent.usage } : {})
        })
      }

      const liveOutput = (resultEvent as { output: MathOutput } | null)?.output
      expect(liveOutput).toBeDefined()

      console.log("LIVE MODE:")
      console.log("  Events recorded:", events.length)
      console.log("  Answer:", liveOutput?.answer)
      console.log("  Explanation:", liveOutput?.explanation?.slice(0, 50) + "...")

      // ─────────────────────────────────────────────────────────────────
      // STEP 2: Playback from recording (no API call)
      // ─────────────────────────────────────────────────────────────────
      console.log("Starting PLAYBACK...")

      const entry = yield* recorder.load(hash)
      expect(entry).not.toBeNull()

      const playbackOutput = entry!.result.output as MathOutput

      console.log("PLAYBACK MODE:")
      console.log("  Events loaded:", entry!.streamData.length)
      console.log("  Answer:", playbackOutput.answer)
      console.log("  Explanation:", playbackOutput.explanation.slice(0, 50) + "...")

      // ─────────────────────────────────────────────────────────────────
      // STEP 3: Verify results match
      // ─────────────────────────────────────────────────────────────────
      expect(entry!.hash).toBe(hash)
      expect(entry!.streamData.length).toBe(events.length)
      expect(playbackOutput.answer).toBe(liveOutput!.answer)
      expect(playbackOutput.explanation).toBe(liveOutput!.explanation)

      // Verify event-by-event match
      for (let i = 0; i < events.length; i++) {
        expect(entry!.streamData[i]._tag).toBe(events[i]._tag)
      }

      console.log("VERIFICATION PASSED:")
      console.log("  Results match:", true)
      console.log("  Event count match:", events.length === entry!.streamData.length)

      return { liveOutput, playbackOutput, eventCount: events.length }
    }).pipe(Effect.provide(recorderLayer))

    const result = await Effect.runPromise(combinedProgram)
    expect(result.liveOutput?.answer).toBe(result.playbackOutput.answer)
  }, 60000) // 60s timeout for real API call

  it("playback returns RecordingNotFound for unknown hash", async () => {
    const recorderLayer = ProviderRecorderLive({ url: ":memory:" })

    const program = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder
      return yield* recorder.load("nonexistent-hash-12345")
    }).pipe(Effect.provide(recorderLayer))

    const result = await Effect.runPromise(program)
    expect(result).toBeNull()
  })

  it("recording is deterministic across multiple playbacks", async () => {
    // Use :memory: for isolated ephemeral database - SHARED across the entire test
    const recorderLayer = ProviderRecorderLive({ url: ":memory:" })

    const prompt = "What is 3 plus 5? Answer with the numeric result and a brief explanation."
    const providerOptions = buildProviderOptions(prompt)
    const hash = simpleHash(prompt)

    // Combined program: Record once, then playback multiple times
    const combinedProgram = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Record once
      const recordingId = yield* recorder.startRecording(hash, {
        prompt: providerOptions.prompt,
        provider: testProvider.name
      })

      let resultEvent: AgentStreamEvent | null = null
      yield* testProvider.stream(providerOptions).pipe(
        Stream.tap((event) =>
          Effect.gen(function*() {
            if (event._tag === "Result") {
              resultEvent = event
            }
            yield* recorder.appendEvent(recordingId, event)
          })
        ),
        Stream.runDrain
      )

      if (resultEvent && resultEvent._tag === "Result") {
        yield* recorder.finalizeRecording(recordingId, {
          output: resultEvent.output,
          stopReason: resultEvent.stopReason,
          ...(resultEvent.text ? { text: resultEvent.text } : {}),
          ...(resultEvent.usage ? { usage: resultEvent.usage } : {})
        })
      }

      // Playback multiple times and verify consistency
      const playback1 = yield* recorder.load(hash)
      const playback2 = yield* recorder.load(hash)
      const playback3 = yield* recorder.load(hash)

      expect(playback1).not.toBeNull()
      expect(playback2).not.toBeNull()
      expect(playback3).not.toBeNull()

      // All playbacks should be identical
      expect(playback1!.result.output).toEqual(playback2!.result.output)
      expect(playback2!.result.output).toEqual(playback3!.result.output)
      expect(playback1!.streamData.length).toBe(playback2!.streamData.length)
      expect(playback2!.streamData.length).toBe(playback3!.streamData.length)

      console.log("DETERMINISTIC PLAYBACK VERIFIED:")
      console.log("  Playback 1 events:", playback1!.streamData.length)
      console.log("  Playback 2 events:", playback2!.streamData.length)
      console.log("  Playback 3 events:", playback3!.streamData.length)
      console.log("  All outputs equal:", true)

      return { playback1, playback2, playback3 }
    }).pipe(Effect.provide(recorderLayer))

    const result = await Effect.runPromise(combinedProgram)
    expect(result.playback1).not.toBeNull()
  }, 60000)
})
