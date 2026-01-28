/**
 * @open-scaffold/server - LibSQL/Turso storage layers.
 *
 * @module
 */

// Config
export type { LibSQLConfig } from "./Config.js"

// EventStore
export { EventStoreLive } from "./EventStoreLive.js"

// StateSnapshotStore
export { StateSnapshotStoreLive } from "./StateSnapshotStoreLive.js"

// ProviderRecorder
export { ProviderRecorderLive } from "./ProviderRecorderLive.js"

// Migrations
export {
  CREATE_EVENTS_TABLE,
  CREATE_RECORDINGS_TABLE,
  CREATE_SESSIONS_TABLE,
  CREATE_STATE_SNAPSHOTS_TABLE,
  MIGRATIONS,
  runMigrations
} from "./Migrations.js"
