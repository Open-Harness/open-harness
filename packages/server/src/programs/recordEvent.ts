/**
 * recordEvent - Append event to store and broadcast to live subscribers.
 *
 * This is the fundamental "write" operation. Every event goes through here.
 *
 * @module
 */

import { Effect } from "effect"

import { type SerializedEvent, type SessionId, type StoreError } from "@open-harness/core"
import { Services } from "@open-harness/core/internal"

/**
 * Append an event to the store and broadcast to live subscribers.
 */
export const recordEvent = (
  sessionId: SessionId,
  event: SerializedEvent
): Effect.Effect<void, StoreError, Services.EventStore | Services.EventBus> =>
  Effect.gen(function*() {
    const store = yield* Services.EventStore
    const bus = yield* Services.EventBus

    // Persist to store (tape) - this is the source of truth
    yield* store.append(sessionId, event)

    // Broadcast to live subscribers (SSE clients)
    yield* bus.publish(sessionId, event)

    yield* Effect.log("Event recorded", {
      sessionId,
      eventName: event.name,
      eventId: event.id
    })
  }).pipe(
    Effect.withSpan("recordEvent", {
      attributes: { sessionId, eventName: event.name }
    })
  )
