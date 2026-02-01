/**
 * EventBus service - broadcasts events to subscribers (SSE).
 *
 * Provides pub/sub for live event streaming to connected clients.
 * Events are broadcast as SerializedEvent (the stable wire/JSON format).
 *
 * @module
 */

import { Context, Effect, PubSub, Stream } from "effect"

import type { SerializedEvent } from "../Domain/Events.js"
import type { SessionId } from "../Domain/Ids.js"

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface EventBusService {
  /** Publish event to all subscribers of a session */
  readonly publish: (
    sessionId: SessionId,
    event: SerializedEvent
  ) => Effect.Effect<void, never>

  /** Subscribe to events for a session */
  readonly subscribe: (
    sessionId: SessionId
  ) => Stream.Stream<SerializedEvent, never>
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

export class EventBus extends Context.Tag("@open-harness/EventBus")<
  EventBus,
  EventBusService
>() {}

// ─────────────────────────────────────────────────────────────────
// Live Implementation (PubSub-backed)
// ─────────────────────────────────────────────────────────────────

/**
 * Live EventBus backed by an unbounded PubSub.
 *
 * Publishes all events into a single bus and filters by sessionId at
 * subscription time to keep the EventBus interface simple.
 *
 * This is the only implementation - no mocks or stubs per CLAUDE.md.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function*() {
 *   const bus = yield* EventBus
 *   yield* bus.publish(sessionId, event)
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(Layer.effect(EventBus, EventBusLive))))
 * ```
 */
export const EventBusLive = Effect.gen(function*() {
  const bus = yield* PubSub.unbounded<{ sessionId: SessionId; event: SerializedEvent }>()

  return EventBus.of({
    publish: (sessionId, event) => PubSub.publish(bus, { sessionId, event }).pipe(Effect.asVoid),
    subscribe: (sessionId) =>
      Stream.unwrapScoped(
        PubSub.subscribe(bus).pipe(
          Effect.map((queue) =>
            Stream.fromQueue(queue).pipe(
              Stream.filter((item) => item.sessionId === sessionId),
              Stream.map((item) => item.event)
            )
          )
        )
      )
  })
})
