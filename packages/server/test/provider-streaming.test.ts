/**
 * Provider streaming integration tests.
 *
 * IMPORTANT: These tests use the REAL Anthropic SDK.
 * We have an Anthropic subscription - NO API KEY NEEDED.
 *
 * The tests validate:
 * 1. Provider streams events incrementally (not buffered)
 * 2. Events include TextDelta, Stop, Result
 * 3. Structured output is returned correctly
 *
 * @module
 */

import { Effect, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { AgentStreamEvent } from "@open-scaffold/core"

import { AnthropicProvider } from "../src/provider/Provider.js"

/**
 * Simple output schema for testing.
 */
const TestOutputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1)
})

describe("AnthropicProvider (Real SDK)", () => {
  it("streams events from real Anthropic API", async () => {
    const provider = AnthropicProvider({
      model: "claude-haiku-4-5"
    })

    const events: Array<AgentStreamEvent> = []
    let resultEvent: Extract<AgentStreamEvent, { _tag: "Result" }> | undefined

    const program = provider
      .stream({
        prompt: "What is 2 + 2? Be brief.",
        outputSchema: TestOutputSchema,
        providerOptions: {
          maxTokens: 256
        }
      })
      .pipe(
        Stream.tap((event) =>
          Effect.sync(() => {
            events.push(event)
            if (event._tag === "Result") {
              resultEvent = event
            }
          })
        ),
        Stream.runDrain
      )

    await Effect.runPromise(program)

    // Verify we received events
    expect(events.length).toBeGreaterThan(0)

    // Verify we got streaming text deltas (not buffered)
    const textDeltas = events.filter((e) => e._tag === "TextDelta")
    expect(textDeltas.length).toBeGreaterThan(0)

    // Verify we got a Stop event
    const stopEvents = events.filter((e) => e._tag === "Stop")
    expect(stopEvents.length).toBeGreaterThan(0)

    // Verify we got a Result with structured output
    expect(resultEvent).toBeDefined()
    expect(resultEvent!.output).toBeDefined()
    expect(typeof resultEvent!.output.answer).toBe("string")
    expect(typeof resultEvent!.output.confidence).toBe("number")

    // Log for debugging (visible in test output)
    console.log("Events received:", events.length)
    console.log("Text deltas:", textDeltas.length)
    console.log("Result:", JSON.stringify(resultEvent!.output, null, 2))
  }, 30000) // 30s timeout for API call

  it("handles streaming incrementally (events arrive before completion)", async () => {
    const provider = AnthropicProvider({
      model: "claude-haiku-4-5"
    })

    const eventTimestamps: Array<{ tag: string; time: number }> = []
    const startTime = Date.now()

    const program = provider
      .stream({
        prompt: "Count from 1 to 5, one number per line.",
        outputSchema: TestOutputSchema,
        providerOptions: {
          maxTokens: 256
        }
      })
      .pipe(
        Stream.tap((event) =>
          Effect.sync(() => {
            eventTimestamps.push({
              tag: event._tag,
              time: Date.now() - startTime
            })
          })
        ),
        Stream.runDrain
      )

    await Effect.runPromise(program)

    // Verify events arrived over time, not all at once
    const firstEventTime = eventTimestamps[0]?.time ?? 0
    const lastEventTime = eventTimestamps[eventTimestamps.length - 1]?.time ?? 0
    const timeSpread = lastEventTime - firstEventTime

    console.log("Event timestamps:", eventTimestamps)
    console.log("Time spread (ms):", timeSpread)

    // Events should be spread over time (not all at t=0)
    // This proves streaming is working, not buffering
    expect(eventTimestamps.length).toBeGreaterThan(1)
    // At least some time should pass between first and last event
    // (buffered would have them all at nearly the same time)
    expect(timeSpread).toBeGreaterThan(0)
  }, 30000)
})
