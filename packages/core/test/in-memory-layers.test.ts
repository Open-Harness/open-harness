/**
 * Tests for InMemoryEventStore and InMemoryEventBus layers.
 *
 * Validates that in-memory implementations actually store and retrieve data.
 */

import { Effect, Stream } from "effect"
import { describe, expect, it } from "vitest"

import { makeSessionId } from "../src/Domain/Ids.js"
import { makeEvent } from "../src/Engine/types.js"
import { InMemoryEventBus, InMemoryEventStore } from "../src/Layers/InMemory.js"
import { EventBus } from "../src/Services/EventBus.js"
import { EventStore } from "../src/Services/EventStore.js"

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const runWithStore = <A, E>(effect: Effect.Effect<A, E, EventStore>) =>
  Effect.runPromise(effect.pipe(Effect.provide(InMemoryEventStore)) as Effect.Effect<A, E>)

const runWithBus = <A, E>(effect: Effect.Effect<A, E, EventBus>) =>
  Effect.runPromise(effect.pipe(Effect.provide(InMemoryEventBus)) as Effect.Effect<A, E>)

// ─────────────────────────────────────────────────────────────────
// InMemoryEventStore
// ─────────────────────────────────────────────────────────────────

describe("InMemoryEventStore", () => {
  it("appends and retrieves events for a session", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const sessionId = yield* makeSessionId()

        const event1 = yield* makeEvent("test:first", { n: 1 })
        const event2 = yield* makeEvent("test:second", { n: 2 })

        yield* store.append(sessionId, event1)
        yield* store.append(sessionId, event2)

        const events = yield* store.getEvents(sessionId)
        expect(events).toHaveLength(2)
        expect(events[0]!.name).toBe("test:first")
        expect(events[1]!.name).toBe("test:second")
      })
    )
  })

  it("returns empty array for unknown session", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const sessionId = yield* makeSessionId()

        const events = yield* store.getEvents(sessionId)
        expect(events).toEqual([])
      })
    )
  })

  it("getEventsFrom returns events starting at position", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const sessionId = yield* makeSessionId()

        const event1 = yield* makeEvent("a", {})
        const event2 = yield* makeEvent("b", {})
        const event3 = yield* makeEvent("c", {})

        yield* store.append(sessionId, event1)
        yield* store.append(sessionId, event2)
        yield* store.append(sessionId, event3)

        const fromPos1 = yield* store.getEventsFrom(sessionId, 1)
        expect(fromPos1).toHaveLength(2)
        expect(fromPos1[0]!.name).toBe("b")
        expect(fromPos1[1]!.name).toBe("c")

        const fromPos2 = yield* store.getEventsFrom(sessionId, 2)
        expect(fromPos2).toHaveLength(1)
        expect(fromPos2[0]!.name).toBe("c")

        const fromPos3 = yield* store.getEventsFrom(sessionId, 3)
        expect(fromPos3).toHaveLength(0)
      })
    )
  })

  it("isolates events between sessions", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const session1 = yield* makeSessionId()
        const session2 = yield* makeSessionId()

        const event1 = yield* makeEvent("session1:event", { s: 1 })
        const event2 = yield* makeEvent("session2:event", { s: 2 })

        yield* store.append(session1, event1)
        yield* store.append(session2, event2)

        const events1 = yield* store.getEvents(session1)
        const events2 = yield* store.getEvents(session2)

        expect(events1).toHaveLength(1)
        expect(events1[0]!.name).toBe("session1:event")
        expect(events2).toHaveLength(1)
        expect(events2[0]!.name).toBe("session2:event")
      })
    )
  })

  it("listSessions returns all session IDs", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const session1 = yield* makeSessionId()
        const session2 = yield* makeSessionId()

        const event = yield* makeEvent("test", {})

        yield* store.append(session1, event)
        yield* store.append(session2, event)

        const sessions = yield* store.listSessions()
        expect(sessions).toHaveLength(2)
        expect(sessions).toContain(session1)
        expect(sessions).toContain(session2)
      })
    )
  })

  it("listSessions returns empty array when no sessions exist", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const sessions = yield* store.listSessions()
        expect(sessions).toEqual([])
      })
    )
  })

  it("deleteSession removes all events for a session", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const sessionId = yield* makeSessionId()

        const event = yield* makeEvent("test", { v: 1 })
        yield* store.append(sessionId, event)

        // Verify it exists
        const before = yield* store.getEvents(sessionId)
        expect(before).toHaveLength(1)

        // Delete
        yield* store.deleteSession(sessionId)

        // Verify it's gone
        const after = yield* store.getEvents(sessionId)
        expect(after).toEqual([])

        const sessions = yield* store.listSessions()
        expect(sessions).not.toContain(sessionId)
      })
    )
  })

  it("deleteSession is a noop for unknown session", async () => {
    await runWithStore(
      Effect.gen(function*() {
        const store = yield* EventStore
        const sessionId = yield* makeSessionId()

        // Should not throw
        yield* store.deleteSession(sessionId)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────
// InMemoryEventBus
// ─────────────────────────────────────────────────────────────────

describe("InMemoryEventBus", () => {
  it("publish succeeds (noop)", async () => {
    await runWithBus(
      Effect.gen(function*() {
        const bus = yield* EventBus
        const sessionId = yield* makeSessionId()
        const event = yield* makeEvent("test:event", { data: 1 })

        // Should complete without error
        yield* bus.publish(sessionId, event)
      })
    )
  })

  it("subscribe returns an empty stream", async () => {
    await runWithBus(
      Effect.gen(function*() {
        const bus = yield* EventBus
        const sessionId = yield* makeSessionId()

        const events = yield* Stream.runCollect(bus.subscribe(sessionId))
        expect(Array.from(events)).toEqual([])
      })
    )
  })
})
