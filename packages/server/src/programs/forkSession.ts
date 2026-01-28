/**
 * forkSession - Create a new session by copying events from an existing one.
 *
 * Constraint: Can only fork from current/paused position.
 * Cannot time-travel back and fork from arbitrary past position.
 * Why? Re-running agents would give different results.
 *
 * Mental model: This is like "COPY TAPE" on VCR - but only from current spot.
 *
 * @module
 */

import { Effect } from "effect"

import {
  type EventId,
  makeEventId,
  Services,
  type SessionId,
  type SessionNotFound,
  type StoreError
} from "@open-scaffold/core"

import { loadSession } from "./loadSession.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ForkResult {
  readonly originalSessionId: SessionId
  readonly newSessionId: SessionId
  readonly eventsCopied: number
}

// ─────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────

/**
 * Fork a session at its current position.
 *
 * Creates a new session with a copy of all events up to current position.
 */
export const forkSession = (
  originalSessionId: SessionId
): Effect.Effect<
  ForkResult,
  StoreError | SessionNotFound,
  Services.EventStore | Services.EventBus
> =>
  Effect.gen(function*() {
    // Load original session
    const { events } = yield* loadSession(originalSessionId)

    // Generate new session ID
    const newSessionId = crypto.randomUUID() as SessionId

    const store = yield* Services.EventStore

    const idMap = new Map<EventId, EventId>()

    // Copy all events to new session
    for (const event of events) {
      const newId = yield* makeEventId()
      idMap.set(event.id, newId)

      const mappedCausedBy = event.causedBy
        ? idMap.get(event.causedBy) ?? event.causedBy
        : undefined

      const baseEvent = {
        id: newId,
        name: event.name,
        payload: event.payload,
        timestamp: event.timestamp
      }

      const newEvent = mappedCausedBy ? { ...baseEvent, causedBy: mappedCausedBy } : baseEvent

      yield* store.append(newSessionId, newEvent)
    }

    yield* Effect.log("Session forked", {
      originalSessionId,
      newSessionId,
      eventsCopied: events.length
    })

    return {
      originalSessionId,
      newSessionId,
      eventsCopied: events.length
    }
  }).pipe(
    Effect.withSpan("forkSession", {
      attributes: { originalSessionId }
    })
  )
