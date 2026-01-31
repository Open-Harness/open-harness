/**
 * observeEvents - Subscribe to live event stream for SSE.
 *
 * Optionally includes historical events first (for catch-up).
 *
 * Mental model: This is the SSE endpoint's data source.
 * Client connects, gets history (optional), then live updates.
 *
 * Resource Management:
 * Uses Stream.unwrapScoped so resources (EventBus subscription) are:
 * - Acquired when stream is first consumed
 * - Released when stream completes, errors, or is interrupted
 *
 * @module
 */

import { Effect, Stream } from "effect"

import { type SerializedEvent, type SessionId, type SessionNotFound, type StoreError } from "@open-harness/core"
import { Services } from "@open-harness/core/internal"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ObserveEventsOptions {
  readonly sessionId: SessionId
  /** If true, include historical events before live stream */
  readonly includeHistory?: boolean
  /** Start from this position if includeHistory is true */
  readonly fromPosition?: number
}

// ─────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to live events for a session.
 *
 * Returns a Stream directly (not Effect<Stream>). Resources are managed
 * by the stream lifecycle — acquired on first pull, released on completion.
 */
export const observeEvents = (
  options: ObserveEventsOptions
): Stream.Stream<SerializedEvent, SessionNotFound | StoreError, Services.EventBus | Services.EventStore> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const { fromPosition = 0, includeHistory = false, sessionId } = options
      const bus = yield* Services.EventBus

      // Get live stream — subscription resources tied to this scope
      const liveStream = bus.subscribe(sessionId)

      if (!includeHistory) {
        yield* Effect.logDebug("observeEvents: live only", { sessionId })
        return liveStream
      }

      // Get historical events
      const store = yield* Services.EventStore
      const historicalEvents = yield* store.getEventsFrom(sessionId, fromPosition)

      yield* Effect.logDebug("observeEvents: history + live", {
        sessionId,
        historyCount: historicalEvents.length,
        fromPosition
      })

      // Combine: historical first, then live
      const historyStream = Stream.fromIterable(historicalEvents)
      return Stream.concat(historyStream, liveStream)
    }).pipe(
      Effect.withSpan("observeEvents", {
        attributes: { sessionId: options.sessionId, includeHistory: options.includeHistory }
      })
    )
  )
