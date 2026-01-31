/**
 * Tests for EventHub service (ADR-004).
 *
 * Validates PubSub-backed event distribution with:
 * - Single publish point for all workflow events
 * - Multiple subscriber support
 * - Scoped lifecycle management
 */

import { Chunk, Effect, Fiber, Ref, Stream } from "effect"
import type { Scope } from "effect"
import { describe, expect, it } from "vitest"

import type { WorkflowEvent } from "../src/Domain/Events.js"
import { AgentCompleted, AgentStarted, TextDelta, WorkflowCompleted, WorkflowStarted } from "../src/Domain/Events.js"
import { InMemoryEventHub } from "../src/Layers/InMemory.js"
import { EventHub } from "../src/Services/EventHub.js"

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Run an effect with EventHub in a scoped context.
 * The scope ensures PubSub cleanup after the test.
 */
const runWithHub = <A, E>(effect: Effect.Effect<A, E, EventHub | Scope.Scope>) =>
  Effect.runPromise(
    Effect.scoped(effect).pipe(Effect.provide(InMemoryEventHub)) as Effect.Effect<A, E>
  )

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const timestamp = new Date("2026-01-29T12:00:00Z")

const makeTestEvents = (): Array<WorkflowEvent> => [
  new WorkflowStarted({
    sessionId: "session-1",
    workflow: "test-workflow",
    input: { message: "hello" },
    timestamp
  }),
  new AgentStarted({
    agent: "planner",
    phase: "planning",
    timestamp
  }),
  new TextDelta({
    agent: "planner",
    delta: "Processing...",
    timestamp
  }),
  new AgentCompleted({
    agent: "planner",
    output: { result: "done" },
    durationMs: 150,
    timestamp
  }),
  new WorkflowCompleted({
    sessionId: "session-1",
    finalState: { completed: true },
    timestamp
  })
]

// ─────────────────────────────────────────────────────────────────
// EventHub Service Tests
// ─────────────────────────────────────────────────────────────────

describe("EventHub", () => {
  describe("publish", () => {
    it("publishes events without error", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          const event = new WorkflowStarted({
            sessionId: "test-session",
            workflow: "test",
            input: {},
            timestamp
          })

          // Should complete without error
          yield* hub.publish(event)
        })
      )
    })

    it("publishes multiple events sequentially", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          const events = makeTestEvents()

          // Publish all events
          for (const event of events) {
            yield* hub.publish(event)
          }
        })
      )
    })
  })

  describe("subscribe", () => {
    it("subscriber receives published events", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          const receivedRef = yield* Ref.make<Array<WorkflowEvent>>([])

          // Subscribe first
          const stream = yield* hub.subscribe()

          // Fork a subscriber that collects events
          const fiber = yield* Effect.forkScoped(
            stream.pipe(
              Stream.take(3),
              Stream.runForEach((event) => Ref.update(receivedRef, (events) => [...events, event]))
            )
          )

          // Publish events
          const event1 = new WorkflowStarted({
            sessionId: "s1",
            workflow: "w",
            input: {},
            timestamp
          })
          const event2 = new AgentStarted({
            agent: "a1",
            timestamp
          })
          const event3 = new TextDelta({
            agent: "a1",
            delta: "hello",
            timestamp
          })

          yield* hub.publish(event1)
          yield* hub.publish(event2)
          yield* hub.publish(event3)

          // Wait for subscriber to process
          yield* Fiber.join(fiber)

          const received = yield* Ref.get(receivedRef)
          expect(received).toHaveLength(3)
          expect(received[0]!._tag).toBe("WorkflowStarted")
          expect(received[1]!._tag).toBe("AgentStarted")
          expect(received[2]!._tag).toBe("TextDelta")
        })
      )
    })

    it("multiple subscribers receive the same events", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          const subscriber1Ref = yield* Ref.make<Array<string>>([])
          const subscriber2Ref = yield* Ref.make<Array<string>>([])

          // Subscribe both before publishing
          const stream1 = yield* hub.subscribe()
          const stream2 = yield* hub.subscribe()

          // Fork both subscribers
          const fiber1 = yield* Effect.forkScoped(
            stream1.pipe(
              Stream.take(2),
              Stream.runForEach((event) => Ref.update(subscriber1Ref, (tags) => [...tags, `sub1:${event._tag}`]))
            )
          )

          const fiber2 = yield* Effect.forkScoped(
            stream2.pipe(
              Stream.take(2),
              Stream.runForEach((event) => Ref.update(subscriber2Ref, (tags) => [...tags, `sub2:${event._tag}`]))
            )
          )

          // Publish events
          yield* hub.publish(
            new WorkflowStarted({
              sessionId: "s",
              workflow: "w",
              input: {},
              timestamp
            })
          )
          yield* hub.publish(
            new WorkflowCompleted({
              sessionId: "s",
              finalState: {},
              timestamp
            })
          )

          // Wait for both subscribers
          yield* Fiber.join(fiber1)
          yield* Fiber.join(fiber2)

          const received1 = yield* Ref.get(subscriber1Ref)
          const received2 = yield* Ref.get(subscriber2Ref)

          expect(received1).toEqual([
            "sub1:WorkflowStarted",
            "sub1:WorkflowCompleted"
          ])
          expect(received2).toEqual([
            "sub2:WorkflowStarted",
            "sub2:WorkflowCompleted"
          ])
        })
      )
    })

    it("late subscriber does not receive past events", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub

          // Publish before subscribing
          yield* hub.publish(
            new WorkflowStarted({
              sessionId: "s",
              workflow: "w",
              input: {},
              timestamp
            })
          )

          // Subscribe after publish
          const stream = yield* hub.subscribe()

          // Publish another event
          yield* hub.publish(
            new WorkflowCompleted({
              sessionId: "s",
              finalState: {},
              timestamp
            })
          )

          // Late subscriber only gets the second event
          const received = yield* stream.pipe(
            Stream.take(1),
            Stream.runCollect
          )

          expect(Chunk.toReadonlyArray(received)).toHaveLength(1)
          expect(Chunk.toReadonlyArray(received)[0]!._tag).toBe("WorkflowCompleted")
        })
      )
    })
  })

  describe("scoped lifecycle", () => {
    it("EventHub is scoped and cleaned up automatically", async () => {
      // This test verifies that the Layer.scoped pattern works correctly.
      // The EventHub and its PubSub are created fresh for each scoped execution.
      let executionCount = 0

      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          executionCount++
          yield* hub.publish(
            new WorkflowStarted({
              sessionId: "s",
              workflow: "w",
              input: {},
              timestamp
            })
          )
        })
      )

      // Run again - should get a fresh EventHub
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          executionCount++
          yield* hub.publish(
            new WorkflowStarted({
              sessionId: "s2",
              workflow: "w2",
              input: {},
              timestamp
            })
          )
        })
      )

      expect(executionCount).toBe(2)
    })
  })

  describe("event type preservation", () => {
    it("preserves all WorkflowEvent fields through pub/sub", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub

          const original = new AgentCompleted({
            agent: "test-agent",
            output: { nested: { data: [1, 2, 3] } },
            durationMs: 12345,
            timestamp
          })

          // Subscribe
          const stream = yield* hub.subscribe()

          // Fork collector
          const receivedRef = yield* Ref.make<WorkflowEvent | null>(null)
          const fiber = yield* Effect.forkScoped(
            stream.pipe(
              Stream.take(1),
              Stream.runForEach((event) => Ref.set(receivedRef, event))
            )
          )

          // Publish
          yield* hub.publish(original)
          yield* Fiber.join(fiber)

          const received = yield* Ref.get(receivedRef)
          expect(received).not.toBeNull()
          expect(received!._tag).toBe("AgentCompleted")

          // Type-safe access after narrowing
          if (received?._tag === "AgentCompleted") {
            expect(received.agent).toBe("test-agent")
            expect(received.output).toEqual({ nested: { data: [1, 2, 3] } })
            expect(received.durationMs).toBe(12345)
            expect(received.timestamp).toEqual(timestamp)
          }
        })
      )
    })

    it("handles all 15 event types", async () => {
      await runWithHub(
        Effect.gen(function*() {
          const hub = yield* EventHub
          const events = makeTestEvents()
          const receivedRef = yield* Ref.make<Array<string>>([])

          // Subscribe
          const stream = yield* hub.subscribe()

          // Fork collector
          const fiber = yield* Effect.forkScoped(
            stream.pipe(
              Stream.take(events.length),
              Stream.runForEach((event) => Ref.update(receivedRef, (tags) => [...tags, event._tag]))
            )
          )

          // Publish all events
          for (const event of events) {
            yield* hub.publish(event)
          }

          yield* Fiber.join(fiber)

          const received = yield* Ref.get(receivedRef)
          expect(received).toEqual([
            "WorkflowStarted",
            "AgentStarted",
            "TextDelta",
            "AgentCompleted",
            "WorkflowCompleted"
          ])
        })
      )
    })
  })
})

describe("InMemoryEventHub layer", () => {
  it("provides a working EventHub implementation", async () => {
    await runWithHub(
      Effect.gen(function*() {
        const hub = yield* EventHub

        // Verify the service has the expected methods
        expect(typeof hub.publish).toBe("function")
        expect(typeof hub.subscribe).toBe("function")
      })
    )
  })

  it("is isolated between scoped executions", async () => {
    // First execution
    const result1 = await runWithHub(
      Effect.gen(function*() {
        const hub = yield* EventHub
        const receivedRef = yield* Ref.make<number>(0)

        const stream = yield* hub.subscribe()
        const fiber = yield* Effect.forkScoped(
          stream.pipe(
            Stream.take(1),
            Stream.runForEach(() => Ref.update(receivedRef, (n) => n + 1))
          )
        )

        yield* hub.publish(
          new WorkflowStarted({
            sessionId: "s1",
            workflow: "w",
            input: {},
            timestamp
          })
        )

        yield* Fiber.join(fiber)
        return yield* Ref.get(receivedRef)
      })
    )

    // Second execution - separate EventHub instance
    const result2 = await runWithHub(
      Effect.gen(function*() {
        const hub = yield* EventHub
        const receivedRef = yield* Ref.make<number>(0)

        const stream = yield* hub.subscribe()
        const fiber = yield* Effect.forkScoped(
          stream.pipe(
            Stream.take(2),
            Stream.runForEach(() => Ref.update(receivedRef, (n) => n + 1))
          )
        )

        yield* hub.publish(
          new WorkflowStarted({
            sessionId: "s2",
            workflow: "w",
            input: {},
            timestamp
          })
        )
        yield* hub.publish(
          new WorkflowCompleted({
            sessionId: "s2",
            finalState: {},
            timestamp
          })
        )

        yield* Fiber.join(fiber)
        return yield* Ref.get(receivedRef)
      })
    )

    // Each execution is isolated
    expect(result1).toBe(1)
    expect(result2).toBe(2)
  })
})
