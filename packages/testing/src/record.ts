#!/usr/bin/env tsx
/**
 * Record test sessions to the shared recordings database.
 *
 * Run with: pnpm --filter @open-harness/testing record
 *
 * This script records real API responses that can be replayed
 * deterministically in tests across all packages.
 *
 * @module
 */

import { Effect, Stream } from "effect"
import { z } from "zod"

import type { AgentStreamEvent, ProviderRunOptions } from "@open-harness/core"
import { Services } from "@open-harness/core/internal"
import { AnthropicProvider, ProviderRecorderLive } from "@open-harness/server"

import { recordingsDbUrl } from "./index.js"

// ─────────────────────────────────────────────────────────────────
// Test Schemas (same as used in actual tests)
// ─────────────────────────────────────────────────────────────────

const SimpleOutputSchema = z.object({
  message: z.string(),
  confidence: z.number().min(0).max(1)
})

const TaskOutputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    priority: z.enum(["high", "medium", "low"])
  })),
  complete: z.boolean()
})

// ─────────────────────────────────────────────────────────────────
// Recording Sessions
// ─────────────────────────────────────────────────────────────────

interface RecordingSession {
  name: string
  prompt: string
  schema: z.ZodType<unknown>
}

const sessions: Array<RecordingSession> = [
  {
    name: "simple-message",
    prompt: "Say hello and rate your confidence from 0 to 1.",
    schema: SimpleOutputSchema
  },
  {
    name: "task-planning",
    prompt: "Create 2-3 simple tasks for building a hello world program. Mark complete as true.",
    schema: TaskOutputSchema
  }
]

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

const main = async () => {
  console.log("Recording test sessions to:", recordingsDbUrl)
  console.log()

  const recorderLayer = ProviderRecorderLive({ url: recordingsDbUrl })
  const provider = AnthropicProvider({ model: "claude-haiku-4-5" })

  for (const session of sessions) {
    console.log(`Recording: ${session.name}`)

    const providerOptions: ProviderRunOptions = {
      prompt: session.prompt,
      outputSchema: session.schema,
      providerOptions: { maxTokens: 512 }
    }

    // Simple hash for the recording
    const hash = `test-${session.name}`

    const recordedEvents: Array<AgentStreamEvent> = []
    let result: Extract<AgentStreamEvent, { _tag: "Result" }> | undefined

    const program = Effect.gen(function*() {
      const recorder = yield* Services.ProviderRecorder

      // Check if already recorded
      const existing = yield* recorder.load(hash)
      if (existing) {
        console.log(`  Already recorded, skipping`)
        return
      }

      // Start incremental recording (crash-safe)
      const recordingId = yield* recorder.startRecording(hash, {
        prompt: providerOptions.prompt,
        provider: provider.name
      })

      let eventCount = 0

      // Stream from real provider with incremental recording
      yield* provider.stream(providerOptions).pipe(
        Stream.tap((event) =>
          Effect.gen(function*() {
            // Append event incrementally (crash-safe)
            yield* recorder.appendEvent(recordingId, event)
            eventCount++

            recordedEvents.push(event)
            if (event._tag === "Result") {
              result = event
            }
            if (event._tag === "TextDelta") {
              process.stdout.write(".")
            }
          })
        ),
        Stream.runDrain
      )

      console.log()

      if (!result) {
        throw new Error("No result received from provider")
      }

      // Finalize recording after stream completes
      yield* recorder.finalizeRecording(recordingId, {
        stopReason: result.stopReason,
        output: result.output,
        ...(result.text ? { text: result.text } : {}),
        ...(result.usage ? { usage: result.usage } : {})
      })

      console.log(`  Recorded ${eventCount} events`)
      console.log(`  Output:`, JSON.stringify(result.output, null, 2))
    }).pipe(Effect.provide(recorderLayer))

    await Effect.runPromise(program)
    console.log()
  }

  console.log("Done!")
}

main().catch((err) => {
  console.error("Recording failed:", err)
  process.exit(1)
})
