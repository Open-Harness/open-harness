/**
 * Database migrations for LibSQL stores.
 *
 * @module
 */

import type { SqlClient } from "@effect/sql"
import { Cause, Effect } from "effect"

/**
 * SQL to create the sessions table.
 */
export const CREATE_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workflow_name TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
`

/**
 * SQL to create the events table.
 */
export const CREATE_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  caused_by TEXT,
  UNIQUE(session_id, position)
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session_position ON events(session_id, position);
`

/**
 * SQL to create the state_snapshots table.
 */
export const CREATE_STATE_SNAPSHOTS_TABLE = `
CREATE TABLE IF NOT EXISTS state_snapshots (
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, position)
);

CREATE INDEX IF NOT EXISTS idx_state_snapshots_session ON state_snapshots(session_id);
`

/**
 * SQL to create the provider_recordings table.
 */
export const CREATE_RECORDINGS_TABLE = `
CREATE TABLE IF NOT EXISTS provider_recordings (
  id TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  provider TEXT NOT NULL,
  response TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  stream_transcript TEXT
);

CREATE INDEX IF NOT EXISTS idx_recordings_hash ON provider_recordings(request_hash);
`

/**
 * Migration to add stream transcript storage for streaming playback.
 *
 * SQLite does not support IF NOT EXISTS for ADD COLUMN, so we tolerate
 * duplicate-column failures in the migration runner below.
 */
export const ALTER_RECORDINGS_ADD_STREAM_TRANSCRIPT = `
ALTER TABLE provider_recordings ADD COLUMN stream_transcript TEXT;
`

/**
 * SQL to create the incremental recording sessions table.
 * Tracks in-progress and completed incremental recordings.
 */
export const CREATE_RECORDING_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS recording_sessions (
  recording_id TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  prompt TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  response TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_recording_sessions_hash ON recording_sessions(request_hash);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_status ON recording_sessions(status);
`

/**
 * SQL to create the incremental recording events table.
 * Stores individual stream events for crash-safe incremental recording.
 */
export const CREATE_RECORDING_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS recording_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recording_id TEXT NOT NULL,
  event_index INTEGER NOT NULL,
  event_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(recording_id, event_index),
  FOREIGN KEY (recording_id) REFERENCES recording_sessions(recording_id)
);

CREATE INDEX IF NOT EXISTS idx_recording_events_recording_id ON recording_events(recording_id);
`

/**
 * Migration to rename agent_fixtures to provider_recordings.
 * Only runs if the old table exists and the new table doesn't.
 */
export const RENAME_AGENT_FIXTURES_TO_PROVIDER_RECORDINGS = `
ALTER TABLE agent_fixtures RENAME TO provider_recordings;
ALTER INDEX idx_fixtures_hash RENAME TO idx_recordings_hash;
`

/**
 * All migrations in order.
 */
export const MIGRATIONS = [
  CREATE_SESSIONS_TABLE,
  CREATE_EVENTS_TABLE,
  CREATE_STATE_SNAPSHOTS_TABLE,
  CREATE_RECORDINGS_TABLE,
  CREATE_RECORDING_SESSIONS_TABLE,
  CREATE_RECORDING_EVENTS_TABLE
]

/**
 * Run all migrations using the provided SQL client.
 *
 * Migrations are idempotent (CREATE TABLE IF NOT EXISTS).
 */
export const runMigrations = (
  sql: SqlClient.SqlClient
): Effect.Effect<void, unknown> =>
  Effect.gen(function*() {
    const isDuplicateOrNoSuchCause = (cause: Cause.Cause<unknown>) => {
      const text = Cause.pretty(cause).toLowerCase()
      return (
        text.includes("duplicate column name") ||
        text.includes("already exists") ||
        text.includes("no such table") ||
        text.includes("no such index")
      )
    }

    // Check if we need to migrate from old table name
    const tables = (yield* sql.unsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('agent_fixtures', 'provider_recordings')"
    )) as Array<{ name: string }>
    const hasOldTable = tables.some((t) => t.name === "agent_fixtures")
    const hasNewTable = tables.some((t) => t.name === "provider_recordings")

    // Migrate old table to new name if needed
    if (hasOldTable && !hasNewTable) {
      yield* sql.unsafe("ALTER TABLE agent_fixtures RENAME TO provider_recordings").pipe(
        Effect.catchAllCause((cause) => (isDuplicateOrNoSuchCause(cause) ? Effect.void : Effect.failCause(cause)))
      )
      // Try to rename index (may fail if index doesn't exist with old name)
      yield* sql.unsafe("ALTER INDEX idx_fixtures_hash RENAME TO idx_recordings_hash").pipe(
        Effect.catchAllCause(() => Effect.void) // Index rename is optional
      )
    }

    // Run each migration as raw SQL
    // SQLite doesn't support multiple statements in a single exec,
    // so we need to split by semicolons and execute each separately
    for (const migration of MIGRATIONS) {
      // Split by semicolon, filter empty statements, execute each
      const statements = migration
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      for (const statement of statements) {
        yield* sql.unsafe(statement).pipe(
          Effect.catchAllCause((cause) => (isDuplicateOrNoSuchCause(cause) ? Effect.void : Effect.failCause(cause)))
        )
      }
    }
  })
