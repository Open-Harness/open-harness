/**
 * StateSnapshotStore implementation using LibSQL.
 *
 * @module
 */

import { SqlClient } from "@effect/sql"
import { LibsqlClient } from "@effect/sql-libsql"
import { Services, StoreError } from "@open-scaffold/core"
import { Effect, Layer, Redacted } from "effect"

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
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a database row to a StateSnapshot object.
 */
const rowToSnapshot = (row: SnapshotRow): Services.StateSnapshot => ({
  sessionId: row.session_id as Services.StateSnapshot["sessionId"],
  position: row.position,
  state: JSON.parse(row.state_json) as unknown,
  createdAt: new Date(row.created_at)
})

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
          `
          return rows.length === 0 ? null : rowToSnapshot(rows[0])
        }).pipe(
          Effect.mapError((cause) => new StoreError({ operation: "read", cause })),
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
