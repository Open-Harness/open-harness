/**
 * SignalStore - Persistent storage for signals
 *
 * SignalStore provides append-only storage for signals with checkpointing.
 * This enables:
 * - Recording: Capture all signals during a run
 * - Replay: Load signals and inject them during replay
 * - Debugging: Step through signal history
 */

import type { Signal } from "@signals/core";

// ============================================================================
// Recording Types
// ============================================================================

/**
 * Metadata about a recording
 */
export interface RecordingMetadata {
	/** Unique recording ID */
	readonly id: string;
	/** When the recording was created */
	readonly createdAt: string;
	/** Human-readable name/description */
	readonly name?: string;
	/** Tags for filtering */
	readonly tags?: readonly string[];
	/** Provider type used (e.g., "claude", "openai") */
	readonly providerType?: string;
	/** Total number of signals */
	readonly signalCount: number;
	/** Duration in milliseconds */
	readonly durationMs?: number;
}

/**
 * A complete recording of a harness run
 *
 * Recordings are the core artifact for:
 * - Deterministic replay in tests
 * - Debugging failed runs
 * - Creating fixtures
 */
export interface Recording {
	/** Recording metadata */
	readonly metadata: RecordingMetadata;
	/** All signals emitted during the run (ordered by timestamp) */
	readonly signals: readonly Signal[];
}

// ============================================================================
// Checkpoint Types
// ============================================================================

/**
 * A checkpoint in a recording
 *
 * Checkpoints mark specific points in signal history that can be
 * jumped to during replay or debugging.
 */
export interface Checkpoint {
	/** Checkpoint name */
	readonly name: string;
	/** Signal index at this checkpoint */
	readonly index: number;
	/** Timestamp when checkpoint was created */
	readonly timestamp: string;
}

// ============================================================================
// SignalStore Interface
// ============================================================================

/**
 * Query options for listing recordings
 */
export interface RecordingQuery {
	/** Filter by provider type */
	providerType?: string;
	/** Filter by tags (any match) */
	tags?: string[];
	/** Maximum results */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * SignalStore - Interface for signal persistence
 *
 * Implementations:
 * - MemorySignalStore: In-memory, ephemeral
 * - SqliteSignalStore: Persistent to SQLite
 * - FileSignalStore: Persistent to JSON files
 *
 * @example
 * ```ts
 * const store = new MemorySignalStore();
 *
 * // Start a new recording
 * const recordingId = await store.create({ name: "test run" });
 *
 * // Append signals as they occur
 * await store.append(recordingId, signal1);
 * await store.append(recordingId, signal2);
 *
 * // Create checkpoint
 * await store.checkpoint(recordingId, "after-analysis");
 *
 * // Finalize recording
 * await store.finalize(recordingId);
 *
 * // Load for replay
 * const recording = await store.load(recordingId);
 * ```
 */
export interface SignalStore {
	/**
	 * Create a new recording
	 * @param options - Recording options
	 * @returns Recording ID
	 */
	create(options?: { name?: string; tags?: string[]; providerType?: string }): Promise<string>;

	/**
	 * Append a signal to a recording
	 * @param recordingId - Recording to append to
	 * @param signal - Signal to append
	 */
	append(recordingId: string, signal: Signal): Promise<void>;

	/**
	 * Append multiple signals to a recording
	 * @param recordingId - Recording to append to
	 * @param signals - Signals to append
	 */
	appendBatch(recordingId: string, signals: Signal[]): Promise<void>;

	/**
	 * Create a checkpoint in a recording
	 * @param recordingId - Recording ID
	 * @param name - Checkpoint name
	 */
	checkpoint(recordingId: string, name: string): Promise<void>;

	/**
	 * Get checkpoints for a recording
	 * @param recordingId - Recording ID
	 * @returns List of checkpoints
	 */
	getCheckpoints(recordingId: string): Promise<Checkpoint[]>;

	/**
	 * Finalize a recording (mark as complete)
	 * @param recordingId - Recording ID
	 * @param durationMs - Optional duration
	 */
	finalize(recordingId: string, durationMs?: number): Promise<void>;

	/**
	 * Load a complete recording
	 * @param recordingId - Recording ID
	 * @returns Recording or null if not found
	 */
	load(recordingId: string): Promise<Recording | null>;

	/**
	 * Load signals from a recording
	 * @param recordingId - Recording ID
	 * @param options - Load options (range, patterns)
	 * @returns Signals
	 */
	loadSignals(
		recordingId: string,
		options?: {
			fromIndex?: number;
			toIndex?: number;
			patterns?: string[];
		},
	): Promise<Signal[]>;

	/**
	 * List recordings matching query
	 * @param query - Query options
	 * @returns Recording metadata list
	 */
	list(query?: RecordingQuery): Promise<RecordingMetadata[]>;

	/**
	 * Delete a recording
	 * @param recordingId - Recording ID
	 */
	delete(recordingId: string): Promise<void>;

	/**
	 * Check if a recording exists
	 * @param recordingId - Recording ID
	 */
	exists(recordingId: string): Promise<boolean>;
}
