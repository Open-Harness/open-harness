/**
 * Branded ID types for type-safe identifiers.
 *
 * These are strings at runtime but distinct types at compile time,
 * preventing accidental mixing of different ID types.
 *
 * @module
 */

import { Effect, Schema } from "effect"

// ─────────────────────────────────────────────────────────────────
// UUID Validation Pattern
// ─────────────────────────────────────────────────────────────────

/**
 * UUID v4 regex pattern for validation.
 * Matches: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─────────────────────────────────────────────────────────────────
// Public API Types (plain TypeScript)
// ─────────────────────────────────────────────────────────────────

/** Agent identifier (agent name at runtime, branded at compile time). */
export const AgentIdSchema = Schema.String.pipe(Schema.brand("AgentId"))
export type AgentId = Schema.Schema.Type<typeof AgentIdSchema>

// ─────────────────────────────────────────────────────────────────
// SessionId - UUID-validated branded type
// ─────────────────────────────────────────────────────────────────

/** Session ID Schema with UUID validation */
export const SessionIdSchema = Schema.String.pipe(
  Schema.pattern(UUID_PATTERN),
  Schema.brand("SessionId")
)
export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>

/**
 * Create a new SessionId with a fresh UUID.
 * Uses Effect.sync to wrap the side-effecting crypto.randomUUID call.
 *
 * @example
 * ```typescript
 * const sessionId = yield* makeSessionId()
 * ```
 */
export const makeSessionId = (): Effect.Effect<SessionId, never, never> =>
  Effect.sync(() => crypto.randomUUID() as SessionId)

/**
 * Parse and validate a string as SessionId.
 * Fails with ParseError if not a valid UUID.
 *
 * @example
 * ```typescript
 * const sessionId = yield* parseSessionId("abc123...")
 * ```
 */
export const parseSessionId = Schema.decodeUnknown(SessionIdSchema)

// ─────────────────────────────────────────────────────────────────
// EventId - UUID-validated branded type
// ─────────────────────────────────────────────────────────────────

/** Event ID Schema with UUID validation */
export const EventIdSchema = Schema.String.pipe(
  Schema.pattern(UUID_PATTERN),
  Schema.brand("EventId")
)
export type EventId = Schema.Schema.Type<typeof EventIdSchema>

/**
 * Create a new EventId with a fresh UUID.
 * Uses Effect.sync to wrap the side-effecting crypto.randomUUID call.
 *
 * @example
 * ```typescript
 * const eventId = yield* makeEventId()
 * ```
 */
export const makeEventId = (): Effect.Effect<EventId, never, never> => Effect.sync(() => crypto.randomUUID() as EventId)

/**
 * Parse and validate a string as EventId.
 * Fails with ParseError if not a valid UUID.
 */
export const parseEventId = Schema.decodeUnknown(EventIdSchema)

// ─────────────────────────────────────────────────────────────────
// WorkflowId - Simple branded string (not UUID)
// ─────────────────────────────────────────────────────────────────

/** Workflow ID Schema (not UUID - user-defined names like "task-planner") */
export const WorkflowIdSchema = Schema.String.pipe(Schema.brand("WorkflowId"))
export type WorkflowId = Schema.Schema.Type<typeof WorkflowIdSchema>
