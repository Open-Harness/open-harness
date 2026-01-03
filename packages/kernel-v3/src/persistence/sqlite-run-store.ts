import type { Database } from "bun:sqlite";
import type { RuntimeEvent } from "../core/events.js";
import type { RunSnapshot } from "../runtime/snapshot.js";
import type { RunStore } from "./run-store.js";

/**
 * Options for SQLite-backed run store.
 *
 * @property {string} [filename] - SQLite filename.
 * @property {Database} [db] - Pre-configured Database instance.
 */
export interface SqliteRunStoreOptions {
	filename?: string;
	db?: Database;
}

/**
 * SQLite-backed RunStore implementation.
 */
export declare class SqliteRunStore implements RunStore {
	/**
	 * Create a SQLite run store.
	 * @param options - Store options.
	 */
	constructor(options?: SqliteRunStoreOptions);
	/**
	 * Append an event for a run.
	 * @param runId - Run identifier.
	 * @param event - Event to append.
	 */
	appendEvent(runId: string, event: RuntimeEvent): void;
	/**
	 * Save a full snapshot for a run.
	 * @param runId - Run identifier.
	 * @param snapshot - Snapshot to save.
	 */
	saveSnapshot(runId: string, snapshot: RunSnapshot): void;
	/**
	 * Load the most recent snapshot for a run.
	 * @param runId - Run identifier.
	 * @returns Snapshot or null if none exists.
	 */
	loadSnapshot(runId: string): RunSnapshot | null;
	/**
	 * Load events after a sequence number.
	 * @param runId - Run identifier.
	 * @param afterSeq - Optional sequence cursor.
	 * @returns List of events.
	 */
	loadEvents(runId: string, afterSeq?: number): RuntimeEvent[];
}
