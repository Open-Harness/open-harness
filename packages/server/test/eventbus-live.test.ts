/**
 * EventBusLive tests.
 *
 * Uses real PubSub-backed EventBusLive (no mocks).
 * Validates publish/subscribe filtering by session.
 *
 * @module
 */

import { Effect, Fiber, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"

import { type AnyEvent, EVENTS, makeEvent, Services, type SessionId } from "@open-scaffold/core"
import { EventBusLive } from "../src/services/EventBusLive.js"

// Helper to create events synchronously
const mkEvent = (name: string, payload: Record<string, unknown>): AnyEvent => Effect.runSync(makeEvent(name, payload))

describe("EventBusLive", () => {
  it("publishes and filters by session", async () => {
    const sessionA = crypto.randomUUID() as SessionId
    const sessionB = crypto.randomUUID() as SessionId
    const eventA = mkEvent(EVENTS.AGENT_STARTED, { agent: "agent-a" })
    const eventB = mkEvent(EVENTS.AGENT_STARTED, { agent: "agent-b" })

    const program = Effect.gen(function*() {
      const bus = yield* Services.EventBus
      const fiber = yield* Effect.fork(
        Stream.runCollect(bus.subscribe(sessionA).pipe(Stream.take(1)))
      )
      // Give the subscription fiber time to start pulling.
      yield* Effect.sleep("25 millis")

      yield* bus.publish(sessionB, eventB)
      yield* bus.publish(sessionA, eventA)

      return yield* Fiber.join(fiber)
    }).pipe(Effect.provide(Layer.effect(Services.EventBus, EventBusLive)))

    const collected = await Effect.runPromise(program)
    const items = Array.from(collected)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(eventA.id)
  }, 10000)
})
