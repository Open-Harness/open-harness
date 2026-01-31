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
import { Effect, Layer, Option, Redacted, Ref } from "effect"

import { StoreError } from "../Domain/Errors.js"
import type { SerializedEvent } from "../Domain/Events.js"
import type { EventId, SessionId } from "../Domain/Ids.js"
import { type AgentStreamEvent, decodeAgentRunResult, decodeAgentStreamEvent } from "../Domain/Provider.js"
import { EventStore } from "../Services/EventStore.js"
import { ProviderRecorder, type RecordingEntryMeta } from "../Services/ProviderRecorder.js"

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

/**
 * Convert a database row to SerializedEvent with validated JSON parsing.
 * Returns an Effect that fails with StoreError if JSON is malformed.
 */
const rowToEvent = (row: EventRow): Effect.Effect<SerializedEvent, StoreError> =>
  Effect.try({
    try: () => JSON.parse(row.payload) as Record<string, unknown>,
    catch: (error) => new StoreError({ operation: "read", cause: `Invalid JSON in event payload: ${error}` })
  }).pipe(
    Effect.map((payload): SerializedEvent => {
      const event: SerializedEvent = {
        id: row.id as EventId,
        name: row.name,
        payload,
        timestamp: new Date(row.timestamp).getTime()
      }
      if (row.caused_by) {
        return { ...event, causedBy: row.caused_by as EventId }
      }
      return event
    })
  )

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
// Provider Recordings Migrations
// ─────────────────────────────────────────────────────────────────

const PROVIDER_RECORDINGS_DDL = [
  `CREATE TABLE IF NOT EXISTS provider_recordings (
    id TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL UNIQUE,
    prompt TEXT NOT NULL,
    provider TEXT NOT NULL,
    response TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    stream_transcript TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_recordings_hash ON provider_recordings(request_hash)`
]

const RECORDING_SESSIONS_DDL = [
  `CREATE TABLE IF NOT EXISTS recording_sessions (
    recording_id TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    prompt TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    response TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_recording_sessions_hash ON recording_sessions(request_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_recording_sessions_status ON recording_sessions(status)`
]

const RECORDING_EVENTS_DDL = [
  `CREATE TABLE IF NOT EXISTS recording_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    event_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(recording_id, event_index),
    FOREIGN KEY (recording_id) REFERENCES recording_sessions(recording_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_recording_events_recording_id ON recording_events(recording_id)`
]

// ─────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────

/**
 * Configuration for LibSQL connection (used by all LibSQL-backed services).
 */
export interface LibSQLConfig {
  /**
   * Database URL.
   * - In-memory: ":memory:"
   * - Local file: "file:./data/events.db"
   * - Turso: "libsql://your-db.turso.io"
   */
  readonly url: string

  /**
   * Auth token for Turso cloud databases.
   */
  readonly authToken?: string

  /**
   * Whether to run migrations automatically on connect.
   * @default true
   */
  readonly autoMigrate?: boolean
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
export const EventStoreLive = (config: LibSQLConfig): Layer.Layer<EventStore, StoreError> => {
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
          // SerializedEvent.timestamp is a Unix timestamp (number), convert to ISO string for storage
          const timestamp = new Date(event.timestamp).toISOString()
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
          return yield* Effect.forEach(rows, rowToEvent)
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
          return yield* Effect.forEach(rows, rowToEvent)
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

// ─────────────────────────────────────────────────────────────────
// ProviderRecorderLive - Internal Types
// ─────────────────────────────────────────────────────────────────

interface RecordingSessionRow {
  readonly recording_id: string
  readonly request_hash: string
  readonly prompt: string
  readonly provider: string
  readonly status: string
  readonly response: string | null
  readonly created_at: string
  readonly completed_at: string | null
}

interface RecordingEventRow {
  readonly id: number
  readonly recording_id: string
  readonly event_index: number
  readonly event_data: string
  readonly created_at: string
}

// ─────────────────────────────────────────────────────────────────
// ProviderRecorderLive
// ─────────────────────────────────────────────────────────────────

/**
 * Create a ProviderRecorder layer backed by LibSQL.
 *
 * Provides persistent storage for provider recordings used in playback mode.
 * Supports both batch recording (save entire recording at once) and
 * incremental recording (crash-safe, event-by-event).
 *
 * @example
 * ```typescript
 * const recorder = ProviderRecorderLive({ url: ":memory:" })
 * const program = myProgram.pipe(Effect.provide(recorder))
 * ```
 */
export const ProviderRecorderLive = (config: LibSQLConfig): Layer.Layer<ProviderRecorder, StoreError> => {
  const makeService = Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    // Run migrations if autoMigrate is enabled (default: true)
    if (config.autoMigrate !== false) {
      for (const stmt of [...PROVIDER_RECORDINGS_DDL, ...RECORDING_SESSIONS_DDL, ...RECORDING_EVENTS_DDL]) {
        yield* sql.unsafe(stmt).pipe(
          Effect.catchAll(() => Effect.void), // Tolerate "already exists" errors
          Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
        )
      }
    }

    // Track event indices for incremental recordings (in-memory, per-session)
    const eventIndexMap = yield* Ref.make<Map<string, number>>(new Map())

    return ProviderRecorder.of({
      load: (hash) =>
        Effect.gen(function*() {
          // Load from recording_sessions (only completed)
          const sessions = yield* sql<RecordingSessionRow>`
            SELECT recording_id, request_hash, prompt, provider, status, response, created_at, completed_at
            FROM recording_sessions
            WHERE request_hash = ${hash} AND status = 'complete'
            ORDER BY completed_at DESC
            LIMIT 1
          `
          if (sessions.length === 0) {
            return null
          }

          const session = sessions[0]

          // Load events for this recording
          const eventRows = yield* sql<RecordingEventRow>`
            SELECT id, recording_id, event_index, event_data, created_at
            FROM recording_events
            WHERE recording_id = ${session.recording_id}
            ORDER BY event_index ASC
          `

          // Parse and validate events with Effect Schema (skip malformed)
          const streamData: Array<AgentStreamEvent> = []
          for (const row of eventRows) {
            const parsed = decodeAgentStreamEvent(JSON.parse(row.event_data))
            if (Option.isSome(parsed)) {
              streamData.push(parsed.value)
            }
          }

          // Parse and validate result with Effect Schema
          if (!session.response) {
            return null
          }
          const parsedResult = decodeAgentRunResult(JSON.parse(session.response))
          if (Option.isNone(parsedResult)) {
            return null
          }

          return {
            hash: session.request_hash,
            prompt: session.prompt,
            provider: session.provider,
            streamData,
            result: parsedResult.value,
            recordedAt: new Date(session.created_at)
          }
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
          Effect.withSpan("ProviderRecorder.load", { attributes: { hash } })
        ),

      save: (entry) =>
        Effect.gen(function*() {
          const recordingId = crypto.randomUUID()
          const createdAt = new Date().toISOString()
          const response = JSON.stringify(entry.result)

          // Delete any existing recording for this hash
          yield* sql`
            DELETE FROM recording_events
            WHERE recording_id IN (
              SELECT recording_id FROM recording_sessions WHERE request_hash = ${entry.hash}
            )
          `
          yield* sql`
            DELETE FROM recording_sessions WHERE request_hash = ${entry.hash}
          `

          // Create a completed recording session
          yield* sql`
            INSERT INTO recording_sessions (
              recording_id, request_hash, prompt, provider, status, response, created_at, completed_at
            )
            VALUES (
              ${recordingId}, ${entry.hash}, ${entry.prompt}, ${entry.provider},
              'complete', ${response}, ${createdAt}, ${createdAt}
            )
          `

          // Insert all events
          let eventIndex = 0
          for (const event of entry.streamData) {
            const eventData = JSON.stringify(event)
            yield* sql`
              INSERT INTO recording_events (recording_id, event_index, event_data, created_at)
              VALUES (${recordingId}, ${eventIndex}, ${eventData}, ${createdAt})
            `
            eventIndex++
          }
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("ProviderRecorder.save", { attributes: { hash: entry.hash } })
        ),

      delete: (hash) =>
        Effect.gen(function*() {
          // Delete events first (foreign key relationship)
          yield* sql`
            DELETE FROM recording_events
            WHERE recording_id IN (
              SELECT recording_id FROM recording_sessions WHERE request_hash = ${hash}
            )
          `
          // Delete sessions
          yield* sql`
            DELETE FROM recording_sessions WHERE request_hash = ${hash}
          `
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("ProviderRecorder.delete", { attributes: { hash } })
        ),

      list: () =>
        Effect.gen(function*() {
          const rows = yield* sql<{
            request_hash: string
            prompt: string
            provider: string
            created_at: string
          }>`
            SELECT request_hash, prompt, provider, created_at
            FROM recording_sessions
            WHERE status = 'complete'
            ORDER BY completed_at DESC
          `
          return rows.map((row): RecordingEntryMeta => ({
            hash: row.request_hash,
            prompt: row.prompt,
            provider: row.provider,
            recordedAt: new Date(row.created_at)
          }))
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
          Effect.withSpan("ProviderRecorder.list")
        ),

      // ─────────────────────────────────────────────────────────────────
      // Incremental Recording API (crash-safe)
      // ─────────────────────────────────────────────────────────────────

      startRecording: (hash, metadata) =>
        Effect.gen(function*() {
          const recordingId = crypto.randomUUID()
          const createdAt = new Date().toISOString()

          // Delete any existing incomplete recording for this hash
          yield* sql`
            DELETE FROM recording_events
            WHERE recording_id IN (
              SELECT recording_id FROM recording_sessions
              WHERE request_hash = ${hash} AND status = 'in_progress'
            )
          `
          yield* sql`
            DELETE FROM recording_sessions
            WHERE request_hash = ${hash} AND status = 'in_progress'
          `

          // Create new recording session
          yield* sql`
            INSERT INTO recording_sessions (
              recording_id,
              request_hash,
              prompt,
              provider,
              status,
              created_at
            )
            VALUES (
              ${recordingId},
              ${hash},
              ${metadata.prompt},
              ${metadata.provider},
              'in_progress',
              ${createdAt}
            )
          `

          // Initialize event index tracker
          yield* Ref.update(eventIndexMap, (m) => new Map(m).set(recordingId, 0))

          return recordingId
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("ProviderRecorder.startRecording", { attributes: { hash } })
        ),

      appendEvent: (recordingId, event) =>
        Effect.gen(function*() {
          // Get and increment event index
          const currentIndex = yield* Ref.modify(eventIndexMap, (m) => {
            const current = m.get(recordingId) ?? 0
            const updated = new Map(m).set(recordingId, current + 1)
            return [current, updated]
          })

          const eventData = JSON.stringify(event)
          const createdAt = new Date().toISOString()

          yield* sql`
            INSERT INTO recording_events (
              recording_id,
              event_index,
              event_data,
              created_at
            )
            VALUES (
              ${recordingId},
              ${currentIndex},
              ${eventData},
              ${createdAt}
            )
          `
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("ProviderRecorder.appendEvent", { attributes: { recordingId } })
        ),

      finalizeRecording: (recordingId, result) =>
        Effect.gen(function*() {
          const response = JSON.stringify(result)
          const completedAt = new Date().toISOString()

          yield* sql`
            UPDATE recording_sessions
            SET status = 'complete',
                response = ${response},
                completed_at = ${completedAt}
            WHERE recording_id = ${recordingId}
          `

          // Clean up event index tracker
          yield* Ref.update(eventIndexMap, (m) => {
            const updated = new Map(m)
            updated.delete(recordingId)
            return updated
          })
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("ProviderRecorder.finalizeRecording", { attributes: { recordingId } })
        )
    })
  })

  // Build the layer with LibSQL client
  const libsqlLayer = config.authToken
    ? LibsqlClient.layer({
      url: config.url,
      authToken: Redacted.make(config.authToken)
    })
    : LibsqlClient.layer({ url: config.url })

  return Layer.effect(ProviderRecorder, makeService).pipe(
    Layer.provide(libsqlLayer),
    Layer.mapError((cause) => new StoreError({ operation: "read", cause }))
  )
}
