/**
 * LibSQL-backed EventStore layer.
 *
 * Provides persistent event storage using LibSQL/Turso.
 * Auto-creates sessions and events tables on first use.
 *
 * @module
 */

import { SqlClient } from "@effect/sql"
import { LibsqlClient } from "@effect/sql-libsql"
import { Effect, Layer, Redacted } from "effect"

import { StoreError } from "../Domain/Errors.js"
import type { EventId, SessionId } from "../Domain/Ids.js"
import type { AnyEvent } from "../Engine/types.js"
import { EventStore } from "../Services/EventStore.js"

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
// Migrations (sessions + events only)
// ─────────────────────────────────────────────────────────────────

const SESSIONS_DDL = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    workflow_name TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    metadata TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`
]

const EVENTS_DDL = [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    caused_by TEXT,
    UNIQUE(session_id, position)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_session_position ON events(session_id, position)`
]

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const rowToEvent = (row: EventRow): AnyEvent => {
  const event: AnyEvent = {
    id: row.id as EventId,
    name: row.name,
    payload: JSON.parse(row.payload) as unknown,
    timestamp: new Date(row.timestamp)
  }
  if (row.caused_by) {
    return { ...event, causedBy: row.caused_by as EventId }
  }
  return event
}

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
// Configuration
// ─────────────────────────────────────────────────────────────────

export interface LibSQLEventStoreConfig {
  readonly url: string
  readonly authToken?: string
}

// ─────────────────────────────────────────────────────────────────
// EventStoreLive
// ─────────────────────────────────────────────────────────────────

/**
 * Create an EventStore layer backed by LibSQL.
 *
 * Automatically creates sessions and events tables if they don't exist.
 *
 * @example
 * ```typescript
 * const layer = EventStoreLive({ url: "file:./events.db" })
 * const program = myProgram.pipe(Effect.provide(layer))
 * ```
 */
export const EventStoreLive = (config: LibSQLEventStoreConfig): Layer.Layer<EventStore, StoreError> => {
  const makeService = Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    // Run DDL migrations
    for (const stmt of [...SESSIONS_DDL, ...EVENTS_DDL]) {
      yield* sql.unsafe(stmt).pipe(
        Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
      )
    }

    return EventStore.of({
      append: (sessionId, event) =>
        Effect.gen(function*() {
          const position = yield* getNextPosition(sql, sessionId)
          const timestamp = event.timestamp.toISOString()
          const payload = JSON.stringify(event.payload)

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
        }),

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
          return rows.map(rowToEvent)
        }),

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
          return rows.map(rowToEvent)
        }),

      listSessions: () =>
        Effect.gen(function*() {
          const rows = yield* sql<{ id: string }>`
            SELECT id
            FROM sessions
            ORDER BY created_at DESC
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "read", cause }))
          )
          return rows.map((row) => row.id as SessionId)
        }),

      deleteSession: (sessionId) =>
        Effect.gen(function*() {
          yield* sql`
            DELETE FROM events
            WHERE session_id = ${sessionId}
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "delete", cause }))
          )
          yield* sql`
            DELETE FROM sessions
            WHERE id = ${sessionId}
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "delete", cause }))
          )
        })
    })
  })

  const libsqlLayer = config.authToken
    ? LibsqlClient.layer({
      url: config.url,
      authToken: Redacted.make(config.authToken)
    })
    : LibsqlClient.layer({ url: config.url })

  return Layer.effect(EventStore, makeService).pipe(
    Layer.provide(libsqlLayer),
    Layer.mapError((cause) => new StoreError({ operation: "read", cause }))
  )
}
