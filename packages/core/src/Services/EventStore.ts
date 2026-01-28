/**
 * EventStore service - persists events (the tape).
 *
 * This is the internal Effect service for persisting workflow events.
 *
 * @module
 */

import type { Effect } from "effect"
import { Context } from "effect"

import type { StoreError } from "../Domain/Errors.js"
import type { SessionId } from "../Domain/Ids.js"
import type { AnyEvent } from "../Engine/types.js"

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface EventStoreService {
  /** Append event to session's event log */
  readonly append: (
    sessionId: SessionId,
    event: AnyEvent
  ) => Effect.Effect<void, StoreError>

  /** Get all events for a session */
  readonly getEvents: (
    sessionId: SessionId
  ) => Effect.Effect<ReadonlyArray<AnyEvent>, StoreError>

  /** Get events from a specific position */
  readonly getEventsFrom: (
    sessionId: SessionId,
    position: number
  ) => Effect.Effect<ReadonlyArray<AnyEvent>, StoreError>

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

export class EventStore extends Context.Tag("@open-scaffold/EventStore")<
  EventStore,
  EventStoreService
>() {}
