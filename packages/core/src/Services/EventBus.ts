/**
 * EventBus service - broadcasts events to subscribers (SSE).
 *
 * Provides pub/sub for live event streaming to connected clients.
 * Events are broadcast as SerializedEvent (the stable wire/JSON format).
 *
 * @module
 */

import type { Effect, Stream } from "effect"
import { Context } from "effect"

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

export class EventBus extends Context.Tag("@open-scaffold/EventBus")<
  EventBus,
  EventBusService
>() {}
