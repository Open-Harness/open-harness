/**
 * ProviderRecorder implementation using LibSQL.
 *
 * Persists provider recordings to SQLite for deterministic replay.
 * Replaces the in-memory recorder for production use.
 *
 * @module
 */

import { SqlClient } from "@effect/sql"
import { LibsqlClient } from "@effect/sql-libsql"
import { type AgentRunResult, type AgentStreamEvent, Services, StoreError } from "@open-scaffold/core"
import { Effect, Layer, Redacted, Ref } from "effect"

import type { LibSQLConfig } from "./Config.js"
import { runMigrations } from "./Migrations.js"

// Service types from Services namespace
const { ProviderRecorder } = Services
type RecordingEntry = Services.RecordingEntry
type RecordingEntryMeta = Services.RecordingEntryMeta

// ─────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────

interface RecordingRow {
  readonly id: string
  readonly request_hash: string
  readonly prompt: string
  readonly provider: string
  readonly response: string
  readonly stream_transcript: string | null
  readonly recorded_at: string
}

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
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a database row to a RecordingEntry.
 */
const rowToRecordingEntry = (row: RecordingRow): RecordingEntry => {
  const result = JSON.parse(row.response) as AgentRunResult
  const streamData = row.stream_transcript
    ? (JSON.parse(row.stream_transcript) as ReadonlyArray<AgentStreamEvent>)
    : []
  return {
    hash: row.request_hash,
    prompt: row.prompt,
    provider: row.provider,
    result,
    streamData,
    recordedAt: new Date(row.recorded_at)
  }
}

// ─────────────────────────────────────────────────────────────────
// ProviderRecorder Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Create a ProviderRecorder layer backed by LibSQL.
 *
 * @example
 * ```typescript
 * const recorder = ProviderRecorderLive({ url: "file:./data/recordings.db" })
 *
 * const program = myProgram.pipe(
 *   Effect.provide(recorder)
 * )
 * ```
 */
export const ProviderRecorderLive = (config: LibSQLConfig): Layer.Layer<Services.ProviderRecorder, StoreError> => {
  const makeService = Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    // Run migrations if autoMigrate is enabled (default: true)
    if (config.autoMigrate !== false) {
      yield* runMigrations(sql).pipe(
        Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
      )
    }

    // Track event indices for incremental recordings (in-memory, per-session)
    const eventIndexMap = yield* Ref.make<Map<string, number>>(new Map())

    return ProviderRecorder.of({
      load: (hash) =>
        Effect.gen(function*() {
          // First check legacy provider_recordings table
          const rows = yield* sql<RecordingRow>`
            SELECT id, request_hash, prompt, provider, response, stream_transcript, recorded_at
            FROM provider_recordings
            WHERE request_hash = ${hash}
            LIMIT 1
          `
          if (rows.length > 0) {
            return rowToRecordingEntry(rows[0])
          }

          // Then check incremental recording_sessions (only completed)
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

          const streamData = eventRows.map((row) => JSON.parse(row.event_data) as AgentStreamEvent)
          const result = session.response ? (JSON.parse(session.response) as AgentRunResult) : null

          if (!result) {
            return null
          }

          return {
            hash: session.request_hash,
            prompt: session.prompt,
            provider: session.provider,
            streamData,
            result,
            recordedAt: new Date(session.created_at)
          }
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
          Effect.withSpan("ProviderRecorder.load", { attributes: { hash } })
        ),

      save: (entry) =>
        Effect.gen(function*() {
          const id = crypto.randomUUID()
          const response = JSON.stringify(entry.result)
          const streamTranscript = JSON.stringify(entry.streamData)
          const recordedAt = new Date().toISOString()

          yield* sql`
            INSERT OR REPLACE INTO provider_recordings (
              id,
              request_hash,
              prompt,
              provider,
              response,
              stream_transcript,
              recorded_at
            )
            VALUES (
              ${id},
              ${entry.hash},
              ${entry.prompt},
              ${entry.provider},
              ${response},
              ${streamTranscript},
              ${recordedAt}
            )
          `
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("ProviderRecorder.save", { attributes: { hash: entry.hash } })
        ),

      delete: (hash) =>
        Effect.gen(function*() {
          yield* sql`
            DELETE FROM provider_recordings
            WHERE request_hash = ${hash}
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
            recorded_at: string
          }>`
            SELECT request_hash, prompt, provider, recorded_at
            FROM provider_recordings
            ORDER BY recorded_at DESC
          `
          return rows.map((row): RecordingEntryMeta => ({
            hash: row.request_hash,
            prompt: row.prompt,
            provider: row.provider,
            recordedAt: new Date(row.recorded_at)
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
