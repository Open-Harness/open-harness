/**
 * HITL (Human-in-the-Loop) Integration Tests.
 *
 * Tests input:requested / input:response event flow through
 * the server routes. Uses real LibSQL :memory: stores.
 *
 * The new HITL pattern:
 * 1. Workflow emits input:requested event
 * 2. Client sees the event via SSE
 * 3. Client posts input:response via POST /sessions/:id/input
 * 4. The input:response event is persisted and broadcast via EventBus
 *
 * @module
 */

import { Effect, Fiber, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"

import { type AnyEvent, EVENTS, makeEvent, Services, type SessionId } from "@open-scaffold/core"
import { EventBusLive, EventStoreLive } from "../src/index.js"
import { recordEvent } from "../src/programs/recordEvent.js"

// Helper to create events synchronously
const mkEvent = (name: string, payload: Record<string, unknown>): AnyEvent => Effect.runSync(makeEvent(name, payload))

const makeTestLayer = () =>
  Layer.mergeAll(
    EventStoreLive({ url: ":memory:" }),
    Layer.effect(Services.EventBus, EventBusLive)
  )

describe("HITL Integration Tests", () => {
  it("input:response event is persisted and broadcast after input:requested", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      const store = yield* Services.EventStore
      const bus = yield* Services.EventBus

      // Simulate workflow emitting input:requested
      const requestEvent = mkEvent(EVENTS.INPUT_REQUESTED, {
        promptText: "Do you approve this plan?",
        inputType: "approval"
      })
      yield* recordEvent(sessionId, requestEvent)

      // Subscribe to bus for the response event
      const responseFiber = yield* Effect.fork(
        Stream.runCollect(bus.subscribe(sessionId).pipe(Stream.take(1)))
      )
      yield* Effect.yieldNow()

      // Simulate client posting input:response
      const responseEvent = mkEvent(EVENTS.INPUT_RESPONSE, { response: "approved" })
      yield* recordEvent(sessionId, responseEvent)

      const collected = yield* Fiber.join(responseFiber)
      const events = yield* store.getEvents(sessionId)

      return { collected, events }
    }).pipe(Effect.provide(layer))

    const { collected, events } = await Effect.runPromise(program)

    // Should have both events persisted
    expect(events).toHaveLength(2)
    expect(events[0].name).toBe(EVENTS.INPUT_REQUESTED)
    expect(events[1].name).toBe(EVENTS.INPUT_RESPONSE)

    // The response event should have been broadcast
    const items = Array.from(collected)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe(EVENTS.INPUT_RESPONSE)
    expect((items[0].payload as { response: string }).response).toBe("approved")
  })

  it("rejection response transitions to rejected state pattern", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId

      // Simulate workflow requesting approval
      yield* recordEvent(
        sessionId,
        mkEvent(EVENTS.INPUT_REQUESTED, {
          promptText: "Approve deployment?",
          inputType: "approval"
        })
      )

      // Simulate client rejecting
      yield* recordEvent(
        sessionId,
        mkEvent(EVENTS.INPUT_RESPONSE, {
          response: "rejected"
        })
      )

      // Verify the events are correctly persisted
      const store = yield* Services.EventStore
      const events = yield* store.getEvents(sessionId)

      return events
    }).pipe(Effect.provide(layer))

    const events = await Effect.runPromise(program)

    expect(events).toHaveLength(2)
    expect(events[0].name).toBe(EVENTS.INPUT_REQUESTED)
    expect(events[1].name).toBe(EVENTS.INPUT_RESPONSE)
    expect((events[1].payload as { response: string }).response).toBe("rejected")
  })

  it("observer receives input events via EventBus subscription", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      const bus = yield* Services.EventBus

      // Start observing before events are emitted
      const observerFiber = yield* Effect.fork(
        Stream.runCollect(bus.subscribe(sessionId).pipe(Stream.take(3)))
      )
      yield* Effect.sleep("25 millis")

      // Emit a sequence of events
      yield* recordEvent(
        sessionId,
        mkEvent(EVENTS.WORKFLOW_STARTED, {
          sessionId,
          workflowName: "hitl-test",
          input: "start"
        })
      )
      yield* recordEvent(
        sessionId,
        mkEvent(EVENTS.INPUT_REQUESTED, {
          promptText: "What next?",
          inputType: "freeform"
        })
      )
      yield* recordEvent(
        sessionId,
        mkEvent(EVENTS.INPUT_RESPONSE, {
          response: "continue with plan B"
        })
      )

      return yield* Fiber.join(observerFiber)
    }).pipe(Effect.provide(layer))

    const collected = await Effect.runPromise(program)
    const items = Array.from(collected)

    expect(items).toHaveLength(3)
    expect(items[0].name).toBe(EVENTS.WORKFLOW_STARTED)
    expect(items[1].name).toBe(EVENTS.INPUT_REQUESTED)
    expect(items[2].name).toBe(EVENTS.INPUT_RESPONSE)
  }, 10000)
})
