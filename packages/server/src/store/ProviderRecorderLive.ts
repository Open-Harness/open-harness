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
import { type AgentStreamEvent, StoreError } from "@open-scaffold/core"
import { decodeAgentRunResult, decodeAgentStreamEvent, Services } from "@open-scaffold/core/internal"
import { Effect, Layer, Option, Redacted, Ref } from "effect"

import type { LibSQLConfig } from "./Config.js"
import { runMigrations } from "./Migrations.js"

// Service types from Services namespace
const { ProviderRecorder } = Services
type RecordingEntryMeta = Services.RecordingEntryMeta

// ─────────────────────────────────────────────────────────────────
// Internal Types
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
