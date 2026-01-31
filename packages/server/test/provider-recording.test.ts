/**
 * Provider recording integration tests.
 *
 * Tests the full recording/playback cycle with persistent storage:
 * 1. Record real SDK responses to DB file
 * 2. Verify recordings are persisted
 * 3. Playback from DB produces identical events
 *
 * IMPORTANT: Uses REAL Anthropic SDK (subscription, NO API KEY).
 *
 * @module
 */

import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import * as path from "node:path"

import { Effect, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { ProviderRunOptions } from "@open-scaffold/core"
import { makeTextDelta, Services } from "@open-scaffold/core/internal"

import { AnthropicProvider } from "../src/index.js"
import { ProviderRecorderLive } from "../src/internal.js"

// Simple hash for testing (production uses hashProviderRequest from core internals)
const simpleHash = (prompt: string): string => `test-${Buffer.from(prompt).toString("base64").slice(0, 20)}`

/**
 * Simple output schema for testing.
 */
const TestOutputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1)
})

const makeTestDb = () => {
  const dir = path.join(tmpdir(), "open-scaffold-recording-tests")
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `recording-${crypto.randomUUID()}.db`)
  return { filePath, url: `file:${filePath}` }
}

// Skip in CI - requires live Anthropic API access
describe.skipIf(process.env.CI)("ProviderRecorderLive (Persistent Recording)", () => {
  it("records real SDK response to DB and replays it", async () => {
    const { filePath, url } = makeTestDb()
    const recorderLayer = ProviderRecorderLive({ url })

    const provider = AnthropicProvider({ model: "claude-haiku-4-5" })

    const providerOptions: ProviderRunOptions = {
      prompt: "What is 1 + 1? Answer briefly.",
      outputSchema: TestOutputSchema,
      providerOptions: { maxTokens: 256 }
    }

    const hash = simpleHash(providerOptions.prompt)

    // ─────────────────────────────────────────────────────────────────
    // STEP 1: Record real SDK response
    // ─────────────────────────────────────────────────────────────────
    const recordedEvents: Array<AgentStreamEvent> = []
    let recordedResult: Extract<AgentStreamEvent, { _tag: "Result" }> | undefined

    const recordProgram = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Stream from real provider
      yield* provider.stream(providerOptions).pipe(
        Stream.tap((event) =>
          Effect.sync(() => {
            recordedEvents.push(event)
            if (event._tag === "Result") {
              recordedResult = event
            }
          })
        ),
        Stream.runDrain
      )

      // Save to persistent DB using incremental API
      const recordingId = yield* recorder.startRecording(hash, {
        prompt: providerOptions.prompt,
        provider: provider.name
      })
      for (const event of recordedEvents) {
        yield* recorder.appendEvent(recordingId, event)
      }
      yield* recorder.finalizeRecording(recordingId, {
        stopReason: recordedResult!.stopReason,
        output: recordedResult!.output,
        ...(recordedResult!.text ? { text: recordedResult!.text } : {}),
        ...(recordedResult!.usage ? { usage: recordedResult!.usage } : {})
      })

      // Verify save worked
      const entries = yield* recorder.list()
      return entries
    }).pipe(Effect.provide(recorderLayer))

    const entries = await Effect.runPromise(recordProgram)

    expect(entries.length).toBe(1)
    expect(entries[0].hash).toBe(hash)
    expect(recordedEvents.length).toBeGreaterThan(0)
    expect(recordedResult).toBeDefined()

    console.log("Recorded events:", recordedEvents.length)
    console.log("Recorded result:", JSON.stringify(recordedResult!.output, null, 2))

    // ─────────────────────────────────────────────────────────────────
    // STEP 2: Playback from DB (no API call)
    // ─────────────────────────────────────────────────────────────────
    const playbackProgram = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Load from persistent DB
      const entry = yield* recorder.load(hash)
      return entry
    }).pipe(Effect.provide(recorderLayer))

    const loadedEntry = await Effect.runPromise(playbackProgram)

    expect(loadedEntry).not.toBeNull()
    expect(loadedEntry!.hash).toBe(hash)
    expect(loadedEntry!.streamData.length).toBe(recordedEvents.length)
    expect(loadedEntry!.result.output).toEqual(recordedResult!.output)

    console.log("Playback loaded events:", loadedEntry!.streamData.length)
    console.log(
      "Playback result matches:",
      JSON.stringify(loadedEntry!.result.output) === JSON.stringify(recordedResult!.output)
    )

    // Verify event-by-event match
    for (let i = 0; i < recordedEvents.length; i++) {
      expect(loadedEntry!.streamData[i]._tag).toBe(recordedEvents[i]._tag)
    }

    // Cleanup
    rmSync(filePath, { force: true })
  }, 30000)

  it("returns null for unknown hash", async () => {
    const { filePath, url } = makeTestDb()
    const recorderLayer = ProviderRecorderLive({ url })

    const program = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder
      return yield* recorder.load("nonexistent-hash")
    }).pipe(Effect.provide(recorderLayer))

    const result = await Effect.runPromise(program)
    expect(result).toBeNull()

    rmSync(filePath, { force: true })
  })

  it("can delete recorded entries", async () => {
    const { filePath, url } = makeTestDb()
    const recorderLayer = ProviderRecorderLive({ url })

    const program = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Save a dummy entry using incremental API
      const recordingId = yield* recorder.startRecording("test-hash", {
        prompt: "test prompt",
        provider: "test-provider"
      })
      yield* recorder.finalizeRecording(recordingId, {
        stopReason: "end_turn",
        output: { answer: "test", confidence: 1 }
      })

      // Verify it exists
      const before = yield* recorder.load("test-hash")
      expect(before).not.toBeNull()

      // Delete it
      yield* recorder.delete("test-hash")

      // Verify it's gone
      const after = yield* recorder.load("test-hash")
      return after
    }).pipe(Effect.provide(recorderLayer))

    const result = await Effect.runPromise(program)
    expect(result).toBeNull()

    rmSync(filePath, { force: true })
  })
})

// Skip in CI - requires live Anthropic API access
describe.skipIf(process.env.CI)("ProviderRecorderLive (Incremental Recording)", () => {
  it("records events incrementally and can replay them", async () => {
    const { filePath, url } = makeTestDb()
    const recorderLayer = ProviderRecorderLive({ url })

    const provider = AnthropicProvider({ model: "claude-haiku-4-5" })

    const providerOptions: ProviderRunOptions = {
      prompt: "What is 3 + 3? Answer briefly.",
      outputSchema: TestOutputSchema,
      providerOptions: { maxTokens: 256 }
    }

    const hash = simpleHash(providerOptions.prompt)

    // ─────────────────────────────────────────────────────────────────
    // STEP 1: Record using incremental API (crash-safe)
    // ─────────────────────────────────────────────────────────────────
    const recordedEvents: Array<AgentStreamEvent> = []
    let recordedResult: Extract<AgentStreamEvent, { _tag: "Result" }> | undefined

    const recordProgram = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Start incremental recording
      const recordingId = yield* recorder.startRecording(hash, {
        prompt: providerOptions.prompt,
        provider: provider.name
      })

      console.log("Started incremental recording:", recordingId)

      // Stream from real provider, appending events incrementally
      yield* provider.stream(providerOptions).pipe(
        Stream.tap((event) =>
          Effect.gen(function*() {
            recordedEvents.push(event)
            if (event._tag === "Result") {
              recordedResult = event
            }
            // Append each event immediately (crash-safe)
            yield* recorder.appendEvent(recordingId, event)
          })
        ),
        Stream.runDrain
      )

      // Finalize the recording
      yield* recorder.finalizeRecording(recordingId, {
        stopReason: recordedResult!.stopReason,
        output: recordedResult!.output,
        ...(recordedResult!.text ? { text: recordedResult!.text } : {}),
        ...(recordedResult!.usage ? { usage: recordedResult!.usage } : {})
      })

      return recordingId
    }).pipe(Effect.provide(recorderLayer))

    const recordingId = await Effect.runPromise(recordProgram)

    expect(recordingId).toBeDefined()
    expect(recordedEvents.length).toBeGreaterThan(0)
    expect(recordedResult).toBeDefined()

    console.log("Incrementally recorded events:", recordedEvents.length)
    console.log("Recorded result:", JSON.stringify(recordedResult!.output, null, 2))

    // ─────────────────────────────────────────────────────────────────
    // STEP 2: Playback from incremental recording (no API call)
    // ─────────────────────────────────────────────────────────────────
    const playbackProgram = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Load from incremental recording tables
      const entry = yield* recorder.load(hash)
      return entry
    }).pipe(Effect.provide(recorderLayer))

    const loadedEntry = await Effect.runPromise(playbackProgram)

    expect(loadedEntry).not.toBeNull()
    expect(loadedEntry!.hash).toBe(hash)
    expect(loadedEntry!.streamData.length).toBe(recordedEvents.length)
    expect(loadedEntry!.result.output).toEqual(recordedResult!.output)

    console.log("Playback loaded events:", loadedEntry!.streamData.length)
    console.log(
      "Playback result matches:",
      JSON.stringify(loadedEntry!.result.output) === JSON.stringify(recordedResult!.output)
    )

    // Verify event-by-event match
    for (let i = 0; i < recordedEvents.length; i++) {
      expect(loadedEntry!.streamData[i]._tag).toBe(recordedEvents[i]._tag)
    }

    // Cleanup
    rmSync(filePath, { force: true })
  }, 30000)

  it("incomplete recordings are not returned by load", async () => {
    const { filePath, url } = makeTestDb()
    const recorderLayer = ProviderRecorderLive({ url })

    const hash = "test-incomplete-hash"

    const program = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Start recording but DON'T finalize (simulates crash)
      const recordingId = yield* recorder.startRecording(hash, {
        prompt: "test prompt",
        provider: "test-provider"
      })

      // Append some events
      yield* recorder.appendEvent(recordingId, makeTextDelta("Hello"))
      yield* recorder.appendEvent(recordingId, makeTextDelta(" World"))

      // DO NOT finalize - this simulates a crash

      // Try to load - should return null because recording is incomplete
      const entry = yield* recorder.load(hash)
      return entry
    }).pipe(Effect.provide(recorderLayer))

    const result = await Effect.runPromise(program)
    expect(result).toBeNull()

    console.log("Incomplete recording correctly returns null")

    rmSync(filePath, { force: true })
  })

  it("starting a new recording cleans up incomplete recordings for same hash", async () => {
    const { filePath, url } = makeTestDb()
    const recorderLayer = ProviderRecorderLive({ url })

    const hash = "test-cleanup-hash"

    const program = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Start first recording (simulate crash - don't finalize)
      const firstRecordingId = yield* recorder.startRecording(hash, {
        prompt: "test prompt",
        provider: "test-provider"
      })
      yield* recorder.appendEvent(firstRecordingId, makeTextDelta("First attempt"))

      // Start second recording - should clean up the first one
      const secondRecordingId = yield* recorder.startRecording(hash, {
        prompt: "test prompt",
        provider: "test-provider"
      })
      yield* recorder.appendEvent(secondRecordingId, makeTextDelta("Second attempt"))

      // Finalize the second one
      yield* recorder.finalizeRecording(secondRecordingId, {
        stopReason: "end_turn",
        output: { answer: "test", confidence: 1 }
      })

      // Load should return the second recording
      const entry = yield* recorder.load(hash)
      return { entry, firstRecordingId, secondRecordingId }
    }).pipe(Effect.provide(recorderLayer))

    const { entry, firstRecordingId, secondRecordingId } = await Effect.runPromise(program)

    expect(entry).not.toBeNull()
    expect(entry!.streamData.length).toBe(1) // Only the second recording's event
    expect((entry!.streamData[0] as { delta: string }).delta).toBe("Second attempt")

    console.log("First recording ID:", firstRecordingId)
    console.log("Second recording ID:", secondRecordingId)
    console.log("Cleanup worked - only second recording's events loaded")

    rmSync(filePath, { force: true })
  })
})
