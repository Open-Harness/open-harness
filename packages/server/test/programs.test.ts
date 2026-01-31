/**
 * Server programs tests.
 *
 * Uses real LibSQL :memory: implementations (no mocks).
 * Tests: recordEvent, forkSession, computeStateAt, loadSession.
 *
 * @module
 */

import { Effect, Fiber, Layer, Stream } from "effect"
import { describe, expect, it } from "vitest"

import { computeStateAt, makeEvent, type SerializedEvent, type SessionId, tagToEventName } from "@open-scaffold/core"
import { Services } from "@open-scaffold/core/internal"
import { EventBusLive } from "../src/index.js"
import { EventStoreLive, forkSession, loadSession, recordEvent } from "../src/internal.js"

// Helper to create events synchronously
const mkEvent = (name: string, payload: Record<string, unknown>): SerializedEvent =>
  Effect.runSync(makeEvent(name, payload))

const makeTestLayer = (url = ":memory:") =>
  Layer.mergeAll(
    EventStoreLive({ url }),
    Layer.effect(Services.EventBus, EventBusLive)
  )

describe("Programs (Effect)", () => {
  it("recordEvent persists and publishes", async () => {
    const layer = makeTestLayer()
    const sessionId = crypto.randomUUID() as SessionId
    const event = mkEvent(tagToEventName.AgentStarted, { agent: "test-agent" })

    const program = Effect.gen(function*() {
      const bus = yield* Services.EventBus
      const store = yield* Services.EventStore
      const collectFiber = yield* Effect.fork(
        Stream.runCollect(bus.subscribe(sessionId).pipe(Stream.take(1)))
      )
      yield* Effect.yieldNow()

      yield* recordEvent(sessionId, event)

      const collected = yield* Fiber.join(collectFiber)
      const events = yield* store.getEvents(sessionId)
      return { collected, events }
    }).pipe(Effect.provide(layer))

    const result = await Effect.runPromise(program)

    expect(result.collected).toHaveLength(1)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].name).toBe(tagToEventName.AgentStarted)
  })

  it("computeStateAt is deterministic", () => {
    const state1 = { count: 1 }
    const state2 = { count: 2 }
    const state3 = { count: 3 }

    const events: Array<SerializedEvent> = [
      mkEvent(tagToEventName.WorkflowStarted, { sessionId: "s1", workflowName: "test", input: "go" }),
      mkEvent(tagToEventName.StateIntent, { state: state1 }),
      mkEvent(tagToEventName.AgentStarted, { agent: "a1" }),
      mkEvent(tagToEventName.StateIntent, { state: state2 }),
      mkEvent(tagToEventName.AgentCompleted, { agent: "a1", output: "done", durationMs: 50 }),
      mkEvent(tagToEventName.StateIntent, { state: state3 })
    ]

    // Full replay returns last state
    expect(computeStateAt(events, events.length)).toEqual(state3)

    // Partial replay returns correct state
    expect(computeStateAt(events, 2)).toEqual(state1)
    expect(computeStateAt(events, 4)).toEqual(state2)

    // Position 0 returns undefined (no events scanned)
    expect(computeStateAt(events, 0)).toBeUndefined()

    // Re-running returns the same result (deterministic)
    expect(computeStateAt(events, events.length)).toEqual(state3)
  })

  it("forkSession copies events to a new session", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )
      yield* recordEvent(sessionId, mkEvent(tagToEventName.StateIntent, { state: { count: 1 } }))

      const result = yield* forkSession(sessionId)

      const store = yield* Services.EventStore
      const originalEvents = yield* store.getEvents(result.originalSessionId)
      const forkedEvents = yield* store.getEvents(result.newSessionId)

      return { result, originalEvents, forkedEvents }
    }).pipe(Effect.provide(layer))

    const output = await Effect.runPromise(program)

    expect(output.result.eventsCopied).toBe(2)
    expect(output.originalEvents).toHaveLength(2)
    expect(output.forkedEvents).toHaveLength(2)
    // Forked events have new IDs but same names/payloads
    expect(output.forkedEvents[0].name).toBe(output.originalEvents[0].name)
    expect(output.forkedEvents[1].name).toBe(output.originalEvents[1].name)
    expect(output.forkedEvents[0].id).not.toBe(output.originalEvents[0].id)
  })

  it("loadSession returns events for existing session", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )
      yield* recordEvent(sessionId, mkEvent(tagToEventName.StateIntent, { state: { count: 1 } }))

      const loaded = yield* loadSession(sessionId)
      return loaded
    }).pipe(Effect.provide(layer))

    const result = await Effect.runPromise(program)

    expect(result.sessionId).toBeDefined()
    expect(result.events).toHaveLength(2)
    expect(result.eventCount).toBe(2)
  })

  it("loadSession fails for non-existent session", async () => {
    const layer = makeTestLayer()
    const sessionId = crypto.randomUUID() as SessionId

    const program = loadSession(sessionId).pipe(
      Effect.provide(layer),
      Effect.flip // flip so the error becomes the success value
    )

    const error = await Effect.runPromise(program)
    expect(error._tag).toBe("SessionNotFound")
  })
})
