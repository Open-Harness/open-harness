/**
 * In-memory EventHub implementation using Effect PubSub.
 *
 * This is a REAL implementation - not a mock or stub.
 * Uses Effect's PubSub for broadcasting events to multiple subscribers.
 *
 * Note: Map-based stubs (InMemoryEventStore, InMemoryEventBus, InMemoryProviderRecorder)
 * have been removed per CLAUDE.md "NO MOCKS" policy. Use LibSQL :memory: implementations
 * from LibSQL.ts instead:
 * - EventStoreLive({ url: ":memory:" })
 * - ProviderRecorderLive({ url: ":memory:" })
 * - EventBusLive (from Services/EventBus.ts)
 *
 * @module
 */

import { Effect, Layer, PubSub, Stream } from "effect"
import type { Scope } from "effect"

import type { WorkflowEvent } from "../Domain/Events.js"
import { EventHub } from "../Services/EventHub.js"

// ─────────────────────────────────────────────────────────────────
// InMemoryEventHub
// ─────────────────────────────────────────────────────────────────

/**
 * In-memory EventHub implementation backed by PubSub.
 *
 * Per ADR-004: Single emission point for all workflow events.
 * Uses Effect's unbounded PubSub for broadcasting events to subscribers.
 *
 * This is the primary event distribution mechanism - all workflow events
 * flow through EventHub and are broadcast to:
 * - EventStore (persistence)
 * - EventBus (SSE subscribers)
 * - Observer callbacks
 *
 * The layer is scoped, meaning the PubSub is created fresh for each
 * workflow execution and automatically cleaned up when the scope closes.
 *
 * @example
 * ```typescript
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const hub = yield* EventHub
 *
 *     // Fork a subscriber
 *     yield* Effect.forkScoped(
 *       Effect.gen(function* () {
 *         const stream = yield* hub.subscribe()
 *         yield* stream.pipe(
 *           Stream.runForEach((event) =>
 *             Effect.log(`Event: ${event._tag}`)
 *           )
 *         )
 *       })
 *     )
 *
 *     // Publish event
 *     yield* hub.publish(new WorkflowStarted({ ... }))
 *   })
 * )
 *
 * Effect.runPromise(program.pipe(Effect.provide(InMemoryEventHub)))
 * ```
 */
export const InMemoryEventHub: Layer.Layer<EventHub, never, Scope.Scope> = Layer.scoped(
  EventHub,
  Effect.gen(function*() {
    const pubsub = yield* PubSub.unbounded<WorkflowEvent>()

    return EventHub.of({
      publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),

      subscribe: () =>
        Effect.gen(function*() {
          const subscription = yield* PubSub.subscribe(pubsub)
          return Stream.fromQueue(subscription)
        })
    })
  })
)
