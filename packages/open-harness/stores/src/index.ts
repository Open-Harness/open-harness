/**
 * @open-harness/stores
 *
 * v0.3.0: All legacy stores deleted.
 * v0.3.1: Added SqliteSignalStore for persistent recordings.
 *
 * For signal recording, use:
 * - MemorySignalStore from @open-harness/core (in-memory, ephemeral)
 * - SqliteSignalStore (persistent to SQLite file)
 *
 * For run persistence:
 * - Use @open-harness/core persistence interfaces
 * - Future: SqliteRunStore
 */

// Re-export signal stores from core for convenience
export { MemorySignalStore, type SignalStore } from "@open-harness/core";

// SQLite-backed stores
export { SqliteSignalStore } from "./sqlite-store.js";
