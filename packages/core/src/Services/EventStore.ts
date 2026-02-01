/**
 * EventStore service - persists events (the tape).
 *
 * This is the internal Effect service for persisting workflow events.
 * Events are stored as SerializedEvent (the stable wire/JSON format).
 *
 * @module
 */

import type { Effect } from "effect"
import { Context } from "effect"

import type { StoreError } from "../Domain/Errors.js"
import type { SerializedEvent } from "../Domain/Events.js"
import type { SessionId } from "../Domain/Ids.js"

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface EventStoreService {
  /** Append event to session's event log */
  readonly append: (
    sessionId: SessionId,
    event: SerializedEvent
  ) => Effect.Effect<void, StoreError>

  /** Get all events for a session */
  readonly getEvents: (
    sessionId: SessionId
  ) => Effect.Effect<ReadonlyArray<SerializedEvent>, StoreError>

  /** Get events from a specific position */
  readonly getEventsFrom: (
    sessionId: SessionId,
    position: number
  ) => Effect.Effect<ReadonlyArray<SerializedEvent>, StoreError>

  /** List all sessions */
  readonly listSessions: () => Effect.Effect<ReadonlyArray<SessionId>, StoreError>

  /** Delete a session */
  readonly deleteSession: (
    sessionId: SessionId
  ) => Effect.Effect<void, StoreError>
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

export class EventStore extends Context.Tag("@open-harness/EventStore")<
  EventStore,
  EventStoreService
>() {}
