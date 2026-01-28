/**
 * loadSession - Load an existing session from the event store.
 *
 * Does NOT compute state - that's computeStateAt's job.
 * This just retrieves the raw event tape.
 *
 * @module
 */

import { Effect } from "effect"

import { type AnyEvent, Services, type SessionId, SessionNotFound, type StoreError } from "@open-scaffold/core"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface LoadedSession {
  readonly sessionId: SessionId
  readonly events: ReadonlyArray<AnyEvent>
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
