/**
 * EventStore implementation using LibSQL.
 *
 * @module
 */

import { SqlClient } from "@effect/sql"
import { LibsqlClient } from "@effect/sql-libsql"
import { EventIdSchema, parseSessionId, type SerializedEvent, type SessionId, StoreError } from "@open-scaffold/core"
import { Services } from "@open-scaffold/core/internal"
import { Effect, Layer, Redacted, Schema } from "effect"

import type { LibSQLConfig } from "./Config.js"
import { runMigrations } from "./Migrations.js"

// ─────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────

interface EventRow {
  readonly id: string
  readonly session_id: string
  readonly position: number
  readonly name: string
  readonly payload: string
  readonly timestamp: string
  readonly caused_by: string | null
}

// ─────────────────────────────────────────────────────────────────
// StoredEvent Schema (ADR-005: Type Safety at Store Boundaries)
// ─────────────────────────────────────────────────────────────────

/**
 * Schema for the fully parsed stored event.
 * Used to validate the combination of row fields after JSON.parse.
 * Note: timestamp is stored as ISO string in DB, converted to Unix ms on read.
 */
const StoredEventSchema = Schema.Struct({
  id: EventIdSchema,
  name: Schema.String,
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  timestamp: Schema.DateFromString, // Parsed as Date, then converted to number
  causedBy: Schema.optional(EventIdSchema)
})

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Decode a stored event row into a SerializedEvent using Schema validation.
 * Maps decode errors to StoreError per ADR-005.
 */
const decodeStoredEvent = Schema.decodeUnknown(StoredEventSchema)

/**
 * Convert a database row to a SerializedEvent with Schema validation.
 * Returns an Effect that fails with StoreError if validation fails.
 */
const rowToEvent = (row: EventRow): Effect.Effect<SerializedEvent, StoreError> => {
  // Parse the JSON payload first - this can throw
  const parsedPayload = Effect.try({
    try: () => JSON.parse(row.payload),
    catch: (error) => new StoreError({ operation: "read", cause: `Invalid JSON in event payload: ${error}` })
  })

  return parsedPayload.pipe(
    Effect.flatMap((payload) => {
      // Build the object to validate (transform snake_case to camelCase)
      const toValidate = {
        id: row.id,
        name: row.name,
        payload,
        timestamp: row.timestamp,
        ...(row.caused_by !== null ? { causedBy: row.caused_by } : {})
      }

      return decodeStoredEvent(toValidate).pipe(
        Effect.mapError((parseError) =>
          new StoreError({ operation: "read", cause: `Invalid stored event: ${parseError}` })
        ),
        Effect.map((validated): SerializedEvent => {
          // Build SerializedEvent with numeric timestamp, only including causedBy if present
          // (for exactOptionalPropertyTypes compatibility)
          const event: SerializedEvent = {
            id: validated.id,
            name: validated.name,
            payload: validated.payload,
            timestamp: validated.timestamp.getTime() // Convert Date to Unix ms
          }
          if (validated.causedBy !== undefined) {
            return { ...event, causedBy: validated.causedBy }
          }
          return event
        })
      )
    })
  )
}

/**
 * Get the next position for a session's event log.
 */
const getNextPosition = (
  sql: SqlClient.SqlClient,
  sessionId: SessionId
): Effect.Effect<number, StoreError> =>
  Effect.gen(function*() {
    const result = yield* sql<{ next_pos: number }>`
      SELECT COALESCE(MAX(position), -1) + 1 as next_pos
      FROM events
      WHERE session_id = ${sessionId}
    `
    return result[0]?.next_pos ?? 0
  }).pipe(
    Effect.mapError((cause) => new StoreError({ operation: "read", cause }))
  )

// ─────────────────────────────────────────────────────────────────
// EventStore Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Create an EventStore layer backed by LibSQL.
 *
 * @example
 * ```typescript
 * const eventStore = EventStoreLive({ url: "file:./events.db" })
 *
 * const program = myProgram.pipe(
 *   Effect.provide(eventStore)
 * )
 * ```
 */
export const EventStoreLive = (config: LibSQLConfig): Layer.Layer<Services.EventStore, StoreError> => {
  const makeService = Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    // Run migrations if autoMigrate is enabled (default: true)
    if (config.autoMigrate !== false) {
      yield* runMigrations(sql).pipe(
        Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
      )
    }

    return Services.EventStore.of({
      append: (sessionId, event) =>
        Effect.gen(function*() {
          const position = yield* getNextPosition(sql, sessionId)
          // SerializedEvent.timestamp is Unix ms, convert to ISO string for storage
          const timestamp = new Date(event.timestamp).toISOString()
          const payload = JSON.stringify(event.payload)

          // Ensure session row exists (created_at set on first event)
          yield* sql`
            INSERT OR IGNORE INTO sessions (id, created_at)
            VALUES (${sessionId}, ${timestamp})
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
          )

          yield* sql`
            INSERT INTO events (id, session_id, position, name, payload, timestamp, caused_by)
            VALUES (
              ${event.id},
              ${sessionId},
              ${position},
              ${event.name},
              ${payload},
              ${timestamp},
              ${event.causedBy ?? null}
            )
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
          )
        }).pipe(
          Effect.withSpan("EventStore.append", { attributes: { sessionId, eventName: event.name } })
        ),

      getEvents: (sessionId) =>
        Effect.gen(function*() {
          const rows = yield* sql<EventRow>`
            SELECT id, session_id, position, name, payload, timestamp, caused_by
            FROM events
            WHERE session_id = ${sessionId}
            ORDER BY position ASC
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "read", cause }))
          )
          // Validate each row using Schema (ADR-005)
          return yield* Effect.forEach(rows, rowToEvent)
        }).pipe(
          Effect.withSpan("EventStore.getEvents", { attributes: { sessionId } })
        ),

      getEventsFrom: (sessionId, position) =>
        Effect.gen(function*() {
          const rows = yield* sql<EventRow>`
            SELECT id, session_id, position, name, payload, timestamp, caused_by
            FROM events
            WHERE session_id = ${sessionId}
            AND position >= ${position}
            ORDER BY position ASC
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "read", cause }))
          )
          // Validate each row using Schema (ADR-005)
          return yield* Effect.forEach(rows, rowToEvent)
        }).pipe(
          Effect.withSpan("EventStore.getEventsFrom", { attributes: { sessionId, position } })
        ),

      listSessions: () =>
        Effect.gen(function*() {
          const rows = yield* sql<{ id: string }>`
            SELECT id
            FROM sessions
            ORDER BY created_at DESC
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "read", cause }))
          )
          // Validate each session ID using Schema (ADR-005)
          return yield* Effect.forEach(rows, (row) =>
            parseSessionId(row.id).pipe(
              Effect.mapError((parseError) =>
                new StoreError({ operation: "read", cause: `Invalid session ID: ${parseError}` })
              )
            ))
        }).pipe(
          Effect.withSpan("EventStore.listSessions")
        ),

      deleteSession: (sessionId) =>
        Effect.gen(function*() {
          yield* sql`
            DELETE FROM events
            WHERE session_id = ${sessionId}
          `
          yield* sql`
            DELETE FROM sessions
            WHERE id = ${sessionId}
          `
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "delete", cause })),
          Effect.withSpan("EventStore.deleteSession", { attributes: { sessionId } })
        )
    })
  })

  // Build the layer with LibSQL client
  // Note: LibsqlClient.layer requires authToken to be Redacted
  const libsqlLayer = config.authToken
    ? LibsqlClient.layer({
      url: config.url,
      authToken: Redacted.make(config.authToken)
    })
    : LibsqlClient.layer({ url: config.url })

  return Layer.effect(Services.EventStore, makeService).pipe(
    Layer.provide(libsqlLayer),
    Layer.mapError((cause) => new StoreError({ operation: "read", cause }))
  )
}
