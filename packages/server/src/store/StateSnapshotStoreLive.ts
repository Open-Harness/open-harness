/**
 * StateSnapshotStore implementation using LibSQL.
 *
 * @module
 */

import { SqlClient } from "@effect/sql"
import { LibsqlClient } from "@effect/sql-libsql"
import { parseSessionId, Services, StoreError } from "@open-scaffold/core"
import { Effect, Layer, Redacted, Schema } from "effect"

import type { LibSQLConfig } from "./Config.js"
import { runMigrations } from "./Migrations.js"

// ─────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────

interface SnapshotRow {
  readonly session_id: string
  readonly position: number
  readonly state_json: string
  readonly created_at: string
}

// ─────────────────────────────────────────────────────────────────
// StateCheckpoint Schema (ADR-005: Type Safety at Store Boundaries)
// ─────────────────────────────────────────────────────────────────

/**
 * Schema for validating parsed state from database.
 *
 * The state is stored as JSON and can be any valid JSON value.
 * We validate that the parsed result is valid JSON structure.
 */
const StateCheckpointSchema = Schema.Struct({
  state: Schema.Unknown, // The parsed state (generic - any valid JSON)
  position: Schema.Number,
  createdAt: Schema.instanceOf(Date)
})

/**
 * Decode a state checkpoint using Schema validation.
 */
const decodeStateCheckpoint = Schema.decodeUnknown(StateCheckpointSchema)

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a database row to a StoredStateSnapshot object with Schema validation.
 * Returns an Effect that fails with StoreError if validation fails.
 */
const rowToSnapshot = (row: SnapshotRow): Effect.Effect<Services.StoredStateSnapshot, StoreError> => {
  // Parse the JSON state first - this can throw
  const parsedState = Effect.try({
    try: () => JSON.parse(row.state_json),
    catch: (error) => new StoreError({ operation: "read", cause: `Invalid JSON in state_json: ${error}` })
  })

  return parsedState.pipe(
    Effect.flatMap((state) => {
      // Validate the session ID
      const validatedSessionId = parseSessionId(row.session_id).pipe(
        Effect.mapError((parseError) =>
          new StoreError({ operation: "read", cause: `Invalid session ID: ${parseError}` })
        )
      )

      // Build the object to validate
      const toValidate = {
        state,
        position: row.position,
        createdAt: new Date(row.created_at)
      }

      // Validate checkpoint structure
      const validatedCheckpoint = decodeStateCheckpoint(toValidate).pipe(
        Effect.mapError((parseError) =>
          new StoreError({ operation: "read", cause: `Invalid state checkpoint: ${parseError}` })
        )
      )

      // Combine both validations
      return Effect.all([validatedSessionId, validatedCheckpoint]).pipe(
        Effect.map(([sessionId, checkpoint]): Services.StoredStateSnapshot => ({
          sessionId,
          state: checkpoint.state,
          position: checkpoint.position,
          createdAt: checkpoint.createdAt
        }))
      )
    })
  )
}

// ─────────────────────────────────────────────────────────────────
// StateSnapshotStore Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Create a StateSnapshotStore layer backed by LibSQL.
 *
 * @example
 * ```typescript
 * const snapshotStore = StateSnapshotStoreLive({ url: "file:./events.db" })
 *
 * const program = myProgram.pipe(
 *   Effect.provide(snapshotStore)
 * )
 * ```
 */
export const StateSnapshotStoreLive = (
  config: LibSQLConfig
): Layer.Layer<Services.StateSnapshotStore, StoreError> => {
  const makeService = Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    // Run migrations if autoMigrate is enabled (default: true)
    if (config.autoMigrate !== false) {
      yield* runMigrations(sql).pipe(
        Effect.mapError((cause) => new StoreError({ operation: "write", cause }))
      )
    }

    return Services.StateSnapshotStore.of({
      getLatest: (sessionId) =>
        Effect.gen(function*() {
          const rows = yield* sql<SnapshotRow>`
            SELECT session_id, position, state_json, created_at
            FROM state_snapshots
            WHERE session_id = ${sessionId}
            ORDER BY position DESC
            LIMIT 1
          `.pipe(
            Effect.mapError((cause) => new StoreError({ operation: "read", cause }))
          )
          if (rows.length === 0) {
            return null
          }
          // Validate row using Schema (ADR-005)
          return yield* rowToSnapshot(rows[0])
        }).pipe(
          Effect.withSpan("StateSnapshotStore.getLatest", { attributes: { sessionId } })
        ),

      save: (snapshot) =>
        Effect.gen(function*() {
          const createdAt = snapshot.createdAt.toISOString()
          const stateJson = JSON.stringify(snapshot.state)

          yield* sql`
            INSERT OR REPLACE INTO state_snapshots (session_id, position, state_json, created_at)
            VALUES (${snapshot.sessionId}, ${snapshot.position}, ${stateJson}, ${createdAt})
          `
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "write", cause })),
          Effect.withSpan("StateSnapshotStore.save", {
            attributes: { sessionId: snapshot.sessionId, position: snapshot.position }
          })
        ),

      delete: (sessionId) =>
        Effect.gen(function*() {
          yield* sql`
            DELETE FROM state_snapshots
            WHERE session_id = ${sessionId}
          `
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "delete", cause })),
          Effect.withSpan("StateSnapshotStore.delete", { attributes: { sessionId } })
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

  return Layer.effect(Services.StateSnapshotStore, makeService).pipe(
    Layer.provide(libsqlLayer),
    Layer.mapError((cause) => new StoreError({ operation: "read", cause }))
  )
}
