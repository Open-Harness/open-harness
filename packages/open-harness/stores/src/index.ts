/**
 * @open-harness/stores
 *
 * Persistence implementations for signal storage.
 *
 * These stores have runtime-specific dependencies and are kept separate
 * from @open-harness/core to avoid bundling issues:
 * - SqliteSignalStore requires bun:sqlite (Bun runtime)
 * - FileSignalStore requires node:fs/promises (Node.js/Bun)
 *
 * For in-memory storage (no external dependencies), use:
 * - MemorySignalStore from @open-harness/core
 */

// Re-export base types from core
export { MemorySignalStore, type SignalStore } from "@open-harness/core";

// File-based persistence (requires node:fs/promises)
// Imported via subpath export to avoid bundling in @open-harness/core
export { FileSignalStore, type FileSignalStoreOptions } from "@internal/signals/file-store";

// SQLite-based persistence (requires bun:sqlite)
// Imported via subpath export to avoid bundling in @open-harness/core
export { SqliteSignalStore, type SqliteSignalStoreOptions } from "@internal/signals/sqlite-store";
