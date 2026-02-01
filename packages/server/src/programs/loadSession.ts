/**
 * loadSession - Load an existing session from the event store.
 *
 * Does NOT compute state - that's computeStateAt's job.
 * This just retrieves the raw event tape.
 *
 * @module
 */

import { Effect } from "effect"

import { type SerializedEvent, type SessionId, SessionNotFound, type StoreError } from "@open-harness/core"
import { Services } from "@open-harness/core/internal"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface LoadedSession {
  readonly sessionId: SessionId
  readonly events: ReadonlyArray<SerializedEvent>
  readonly eventCount: number
}

// ─────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────

/**
 * Load a session's events from the store.
 */
export const loadSession = (
  sessionId: SessionId
): Effect.Effect<LoadedSession, StoreError | SessionNotFound, Services.EventStore> =>
  Effect.gen(function*() {
    const store = yield* Services.EventStore

    const events = yield* store.getEvents(sessionId)

    if (events.length === 0) {
      return yield* Effect.fail(new SessionNotFound({ sessionId }))
    }

    yield* Effect.log("Session loaded", {
      sessionId,
      eventCount: events.length
    })

    return {
      sessionId,
      events,
      eventCount: events.length
    }
  }).pipe(
    Effect.withSpan("loadSession", {
      attributes: { sessionId }
    })
  )
