/**
 * HITL (Human-in-the-Loop) Integration Tests.
 *
 * Tests input:requested / input:received event flow through
 * the server routes. Uses real LibSQL :memory: stores.
 *
 * The canonical HITL pattern per ADR-002/ADR-008:
 * 1. Workflow emits input:requested event
 * 2. Client sees the event via SSE
 * 3. Client posts input:received via POST /sessions/:id/input
 * 4. The input:received event is persisted and broadcast via EventBus
 *
 * @module
 */

import { Effect, Fiber, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"

import { makeEvent, type SerializedEvent, type SessionId, tagToEventName } from "@open-scaffold/core"
import { Services } from "@open-scaffold/core/internal"
import { EventBusLive } from "../src/index.js"
import { EventStoreLive, recordEvent } from "../src/internal.js"

// Helper to create events synchronously
const mkEvent = (name: string, payload: Record<string, unknown>): SerializedEvent =>
  Effect.runSync(makeEvent(name, payload))

const makeTestLayer = () =>
  Layer.mergeAll(
    EventStoreLive({ url: ":memory:" }),
    Layer.effect(Services.EventBus, EventBusLive)
  )

describe("HITL Integration Tests", () => {
  it("input:received event is persisted and broadcast after input:requested", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      const store = yield* Services.EventStore
      const bus = yield* Services.EventBus

      // Simulate workflow emitting input:requested (ADR-008 canonical format)
      const requestEvent = mkEvent(tagToEventName.InputRequested, {
        id: "req-1",
        prompt: "Do you approve this plan?",
        type: "approval"
      })
      yield* recordEvent(sessionId, requestEvent)

      // Subscribe to bus for the response event
      const responseFiber = yield* Effect.fork(
        Stream.runCollect(bus.subscribe(sessionId).pipe(Stream.take(1)))
      )
      yield* Effect.yieldNow()

      // Simulate client posting input:received (ADR-008 canonical format)
      const responseEvent = mkEvent(tagToEventName.InputReceived, {
        id: "req-1",
        value: "approve",
        approved: true
      })
      yield* recordEvent(sessionId, responseEvent)

      const collected = yield* Fiber.join(responseFiber)
      const events = yield* store.getEvents(sessionId)

      return { collected, events }
    }).pipe(Effect.provide(layer))

    const { collected, events } = await Effect.runPromise(program)

    // Should have both events persisted
    expect(events).toHaveLength(2)
    expect(events[0].name).toBe(tagToEventName.InputRequested)
    expect(events[1].name).toBe(tagToEventName.InputReceived)

    // The response event should have been broadcast
    const items = Array.from(collected)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe(tagToEventName.InputReceived)
    expect((items[0].payload as { id: string; value: string }).value).toBe("approve")
  })

  it("rejection response transitions to rejected state pattern", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId

      // Simulate workflow requesting approval (ADR-008 canonical format)
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.InputRequested, {
          id: "req-deploy",
          prompt: "Approve deployment?",
          type: "approval"
        })
      )

      // Simulate client rejecting (ADR-008 canonical format)
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.InputReceived, {
          id: "req-deploy",
          value: "reject",
          approved: false
        })
      )

      // Verify the events are correctly persisted
      const store = yield* Services.EventStore
      const events = yield* store.getEvents(sessionId)

      return events
    }).pipe(Effect.provide(layer))

    const events = await Effect.runPromise(program)

    expect(events).toHaveLength(2)
    expect(events[0].name).toBe(tagToEventName.InputRequested)
    expect(events[1].name).toBe(tagToEventName.InputReceived)
    const payload = events[1].payload as { id: string; value: string; approved: boolean }
    expect(payload.value).toBe("reject")
    expect(payload.approved).toBe(false)
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

      // Emit a sequence of events (ADR-008 canonical format)
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, {
          sessionId,
          workflowName: "hitl-test",
          input: "start"
        })
      )
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.InputRequested, {
          id: "choice-1",
          prompt: "What next?",
          type: "choice",
          options: ["Plan A", "Plan B", "Plan C"]
        })
      )
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.InputReceived, {
          id: "choice-1",
          value: "Plan B"
        })
      )

      return yield* Fiber.join(observerFiber)
    }).pipe(Effect.provide(layer))

    const collected = await Effect.runPromise(program)
    const items = Array.from(collected)

    expect(items).toHaveLength(3)
    expect(items[0].name).toBe(tagToEventName.WorkflowStarted)
    expect(items[1].name).toBe(tagToEventName.InputRequested)
    expect(items[2].name).toBe(tagToEventName.InputReceived)
  }, 10000)
})
