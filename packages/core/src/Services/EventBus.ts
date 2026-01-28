/**
 * EventBus service - broadcasts events to subscribers (SSE).
 *
 * Provides pub/sub for live event streaming to connected clients.
 *
 * @module
 */

import type { Effect, Stream } from "effect"
import { Context } from "effect"

import type { SessionId } from "../Domain/Ids.js"
import type { AnyEvent } from "../Engine/types.js"

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface EventBusService {
  /** Publish event to all subscribers of a session */
  readonly publish: (
    sessionId: SessionId,
    event: AnyEvent
  ) => Effect.Effect<void, never>

  /** Subscribe to events for a session */
  readonly subscribe: (
    sessionId: SessionId
  ) => Stream.Stream<AnyEvent, never>
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

export class EventBus extends Context.Tag("@open-scaffold/EventBus")<
  EventBus,
  EventBusService
>() {}
