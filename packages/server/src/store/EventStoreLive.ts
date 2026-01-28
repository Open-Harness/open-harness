/**
 * EventStore implementation using LibSQL.
 *
 * @module
 */

import { SqlClient } from "@effect/sql"
import { LibsqlClient } from "@effect/sql-libsql"
import { type AnyEvent, type EventId, Services, type SessionId, StoreError } from "@open-scaffold/core"
import { Effect, Layer, Redacted } from "effect"

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
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a database row to an Event object.
 */
const rowToEvent = (row: EventRow): AnyEvent => {
  const event: AnyEvent = {
    id: row.id as EventId,
    name: row.name,
    payload: JSON.parse(row.payload) as unknown,
    timestamp: new Date(row.timestamp)
  }
  // Only add causedBy if it exists (exactOptionalPropertyTypes compatibility)
  if (row.caused_by) {
    return { ...event, causedBy: row.caused_by as EventId }
  }
  return event
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
          const timestamp = event.timestamp.toISOString()
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
          `
          return rows.map(rowToEvent)
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
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
          `
          return rows.map(rowToEvent)
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
          Effect.withSpan("EventStore.getEventsFrom", { attributes: { sessionId, position } })
        ),

      listSessions: () =>
        Effect.gen(function*() {
          const rows = yield* sql<{ id: string }>`
            SELECT id
            FROM sessions
            ORDER BY created_at DESC
          `
          return rows.map((row) => row.id as SessionId)
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
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
