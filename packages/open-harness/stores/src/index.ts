/**
 * @open-harness/stores
 *
 * v0.3.0: All legacy stores deleted.
 *
 * For signal recording, use:
 * - MemorySignalStore from @open-harness/core (in-memory)
 * - Future: FileSignalStore, SqliteSignalStore
 *
 * For run persistence:
 * - Use @open-harness/core persistence interfaces
 * - Future: SqliteRunStore
 */

// Re-export signal stores from core for convenience
export { MemorySignalStore, type SignalStore } from "@open-harness/core";
