/**
 * Store Module - Browser-Safe Public Exports
 *
 * Re-exports consumer-facing types for event persistence WITHOUT SqliteStore.
 * SqliteStore requires Node.js native modules (better-sqlite3) and is not
 * compatible with browser bundlers.
 *
 * Use the main entry point ("@open-harness/core-v2") in Node.js environments
 * to access SqliteStore functionality.
 *
 * @module @core-v2/store/browser
 */

// MemoryStore implementation (browser-safe)
export { createMemoryStore, createMemoryStoreEffect, MemoryStoreLive } from "./MemoryStore.js";
// SqliteStore types only (no implementation)
export type { SqliteStoreConfig } from "./SqliteStore.js";
// Types and interfaces (no runtime dependencies)
export type {
	PublicStore,
	SessionId,
	SessionMetadata,
	StateSnapshot,
	StoreErrorCode,
} from "./Store.js";
// Classes and errors (no native dependencies)
export { generateSessionId, makeSessionId, StoreError } from "./Store.js";

// NOTE: SqliteStore implementations are NOT exported here because they require
// Node.js native modules (better-sqlite3) which cannot be bundled for browsers.
// To use SqliteStore, import directly from "@open-harness/core-v2" in a Node.js environment.
