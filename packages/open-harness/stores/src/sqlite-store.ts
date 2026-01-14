/**
 * SqliteSignalStore - SQLite implementation of SignalStore
 *
 * Provides persistent storage for signal recordings using Bun's native SQLite.
 *
 * Features:
 * - Persistent recordings across process restarts
 * - Efficient querying by harness type, tags
 * - Checkpoints for debugging/replay
 *
 * @example
 * ```ts
 * const store = new SqliteSignalStore("/path/to/recordings.db");
 *
 * const id = await store.create({ name: "test run", tags: ["integration"] });
 * await store.append(id, signal1);
 * await store.checkpoint(id, "after-analysis");
 * await store.finalize(id);
 *
 * // Later...
 * const recording = await store.load(id);
 * ```
 */

import { Database } from "bun:sqlite";
import type {
	Checkpoint,
	Recording,
	RecordingMetadata,
	RecordingQuery,
	Signal,
	SignalSource,
	SignalStore,
} from "@open-harness/core";

// ============================================================================
// SqliteSignalStore
// ============================================================================

/**
 * SQLite-backed SignalStore implementation
 *
 * Uses Bun's native SQLite for fast, persistent storage of recordings.
 */
export class SqliteSignalStore implements SignalStore {
	private db: Database;

	/**
	 * Create a new SqliteSignalStore
	 * @param dbPath - Path to SQLite database file
	 */
	constructor(dbPath: string) {
		this.db = new Database(dbPath, { create: true });
		this.initializeSchema();
	}

	/**
	 * Initialize database schema
	 */
	private initializeSchema(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS recordings (
				id TEXT PRIMARY KEY,
				name TEXT,
				tags TEXT,
				harness_type TEXT,
				created_at TEXT NOT NULL,
				finalized_at TEXT,
				duration_ms INTEGER,
				signal_count INTEGER DEFAULT 0
			);

			CREATE TABLE IF NOT EXISTS signals (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				recording_id TEXT NOT NULL,
				signal_index INTEGER NOT NULL,
				signal_id TEXT NOT NULL,
				name TEXT NOT NULL,
				payload TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				source TEXT,
				FOREIGN KEY (recording_id) REFERENCES recordings(id)
			);

			CREATE TABLE IF NOT EXISTS checkpoints (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				recording_id TEXT NOT NULL,
				name TEXT NOT NULL,
				signal_index INTEGER NOT NULL,
				timestamp TEXT NOT NULL,
				FOREIGN KEY (recording_id) REFERENCES recordings(id)
			);

			CREATE INDEX IF NOT EXISTS idx_signals_recording ON signals(recording_id);
			CREATE INDEX IF NOT EXISTS idx_checkpoints_recording ON checkpoints(recording_id);
		`);
	}

	/**
	 * Generate a unique recording ID
	 */
	private generateId(): string {
		return `rec_${crypto.randomUUID().slice(0, 8)}`;
	}

	async create(options?: { name?: string; tags?: string[]; harnessType?: string }): Promise<string> {
		const id = this.generateId();
		const now = new Date().toISOString();

		const stmt = this.db.prepare(`
			INSERT INTO recordings (id, name, tags, harness_type, created_at, signal_count)
			VALUES (?, ?, ?, ?, ?, 0)
		`);

		stmt.run(
			id,
			options?.name ?? null,
			options?.tags ? JSON.stringify(options.tags) : null,
			options?.harnessType ?? null,
			now,
		);

		return id;
	}

	async append(recordingId: string, signal: Signal): Promise<void> {
		// Check recording exists and is not finalized
		const recording = this.db
			.prepare("SELECT finalized_at, signal_count FROM recordings WHERE id = ?")
			.get(recordingId) as { finalized_at: string | null; signal_count: number } | undefined;

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (recording.finalized_at) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		const signalIndex = recording.signal_count;

		// Insert signal
		const insertStmt = this.db.prepare(`
			INSERT INTO signals (recording_id, signal_index, signal_id, name, payload, timestamp, source)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		insertStmt.run(
			recordingId,
			signalIndex,
			signal.id,
			signal.name,
			JSON.stringify(signal.payload),
			signal.timestamp,
			signal.source ? JSON.stringify(signal.source) : null,
		);

		// Update signal count
		this.db.prepare("UPDATE recordings SET signal_count = signal_count + 1 WHERE id = ?").run(recordingId);
	}

	async appendBatch(recordingId: string, signals: Signal[]): Promise<void> {
		// Check recording exists and is not finalized
		const recording = this.db
			.prepare("SELECT finalized_at, signal_count FROM recordings WHERE id = ?")
			.get(recordingId) as { finalized_at: string | null; signal_count: number } | undefined;

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (recording.finalized_at) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		let signalIndex = recording.signal_count;

		// Use transaction for atomic batch insert
		const insertStmt = this.db.prepare(`
			INSERT INTO signals (recording_id, signal_index, signal_id, name, payload, timestamp, source)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		const insertAll = this.db.transaction(() => {
			for (const signal of signals) {
				insertStmt.run(
					recordingId,
					signalIndex++,
					signal.id,
					signal.name,
					JSON.stringify(signal.payload),
					signal.timestamp,
					signal.source ? JSON.stringify(signal.source) : null,
				);
			}

			// Update signal count
			this.db
				.prepare("UPDATE recordings SET signal_count = signal_count + ? WHERE id = ?")
				.run(signals.length, recordingId);
		});

		insertAll();
	}

	async checkpoint(recordingId: string, name: string): Promise<void> {
		// Check recording exists
		const recording = this.db.prepare("SELECT signal_count FROM recordings WHERE id = ?").get(recordingId) as
			| { signal_count: number }
			| undefined;

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const stmt = this.db.prepare(`
			INSERT INTO checkpoints (recording_id, name, signal_index, timestamp)
			VALUES (?, ?, ?, ?)
		`);

		stmt.run(recordingId, name, recording.signal_count - 1, new Date().toISOString());
	}

	async getCheckpoints(recordingId: string): Promise<Checkpoint[]> {
		// Check recording exists
		const exists = this.db.prepare("SELECT 1 FROM recordings WHERE id = ?").get(recordingId);
		if (!exists) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const rows = this.db
			.prepare(
				`
			SELECT name, signal_index, timestamp
			FROM checkpoints
			WHERE recording_id = ?
			ORDER BY signal_index ASC
		`,
			)
			.all(recordingId) as Array<{ name: string; signal_index: number; timestamp: string }>;

		return rows.map((row) => ({
			name: row.name,
			index: row.signal_index,
			timestamp: row.timestamp,
		}));
	}

	async finalize(recordingId: string, durationMs?: number): Promise<void> {
		// Check recording exists
		const exists = this.db.prepare("SELECT 1 FROM recordings WHERE id = ?").get(recordingId);
		if (!exists) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const stmt = this.db.prepare(`
			UPDATE recordings
			SET finalized_at = ?, duration_ms = ?
			WHERE id = ?
		`);

		stmt.run(new Date().toISOString(), durationMs ?? null, recordingId);
	}

	async load(recordingId: string): Promise<Recording | null> {
		// Load recording metadata
		const row = this.db.prepare("SELECT * FROM recordings WHERE id = ?").get(recordingId) as
			| {
					id: string;
					name: string | null;
					tags: string | null;
					harness_type: string | null;
					created_at: string;
					finalized_at: string | null;
					duration_ms: number | null;
					signal_count: number;
			  }
			| undefined;

		if (!row) {
			return null;
		}

		// Load signals
		const signalRows = this.db
			.prepare(
				`
			SELECT signal_id, name, payload, timestamp, source
			FROM signals
			WHERE recording_id = ?
			ORDER BY signal_index ASC
		`,
			)
			.all(recordingId) as Array<{
			signal_id: string;
			name: string;
			payload: string;
			timestamp: string;
			source: string | null;
		}>;

		const signals: Signal[] = signalRows.map((s) => {
			const signal: Signal = {
				id: s.signal_id,
				name: s.name,
				payload: JSON.parse(s.payload),
				timestamp: s.timestamp,
			};
			if (s.source !== null) {
				(signal as { source?: SignalSource }).source = JSON.parse(s.source);
			}
			return signal;
		});

		const metadata: RecordingMetadata = {
			id: row.id,
			createdAt: row.created_at,
			signalCount: row.signal_count,
		};

		if (row.name !== null) {
			(metadata as { name?: string }).name = row.name;
		}
		if (row.tags !== null) {
			(metadata as { tags?: readonly string[] }).tags = JSON.parse(row.tags);
		}
		if (row.harness_type !== null) {
			(metadata as { harnessType?: string }).harnessType = row.harness_type;
		}
		if (row.duration_ms !== null) {
			(metadata as { durationMs?: number }).durationMs = row.duration_ms;
		}

		return {
			metadata,
			signals,
		};
	}

	async loadSignals(
		recordingId: string,
		options?: {
			fromIndex?: number;
			toIndex?: number;
			patterns?: string[];
		},
	): Promise<Signal[]> {
		// Check recording exists
		const exists = this.db.prepare("SELECT 1 FROM recordings WHERE id = ?").get(recordingId);
		if (!exists) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		// Build query with range filters
		let query = `
			SELECT signal_id, name, payload, timestamp, source
			FROM signals
			WHERE recording_id = ?
		`;
		const params: (string | number)[] = [recordingId];

		if (options?.fromIndex !== undefined) {
			query += " AND signal_index >= ?";
			params.push(options.fromIndex);
		}

		if (options?.toIndex !== undefined) {
			query += " AND signal_index < ?";
			params.push(options.toIndex);
		}

		query += " ORDER BY signal_index ASC";

		const rows = this.db.prepare(query).all(...params) as Array<{
			signal_id: string;
			name: string;
			payload: string;
			timestamp: string;
			source: string | null;
		}>;

		let signals: Signal[] = rows.map((s) => {
			const signal: Signal = {
				id: s.signal_id,
				name: s.name,
				payload: JSON.parse(s.payload),
				timestamp: s.timestamp,
			};
			if (s.source !== null) {
				(signal as { source?: SignalSource }).source = JSON.parse(s.source);
			}
			return signal;
		});

		// Apply pattern filter in memory (SQLite regex support is limited)
		if (options?.patterns && options.patterns.length > 0) {
			const regexes = options.patterns.map((p) => patternToRegex(p));
			signals = signals.filter((s) => regexes.some((r) => r.test(s.name)));
		}

		return signals;
	}

	async list(query?: RecordingQuery): Promise<RecordingMetadata[]> {
		let sql = "SELECT * FROM recordings WHERE 1=1";
		const params: (string | number)[] = [];

		// Filter by harness type
		if (query?.harnessType) {
			sql += " AND harness_type = ?";
			params.push(query.harnessType);
		}

		// Sort by creation time (newest first)
		sql += " ORDER BY created_at DESC";

		// Apply pagination
		// SQLite requires LIMIT before OFFSET, and OFFSET requires LIMIT
		if (query?.limit !== undefined || query?.offset !== undefined) {
			sql += " LIMIT ?";
			params.push(query?.limit ?? -1); // -1 means unlimited in SQLite
		}

		if (query?.offset !== undefined) {
			sql += " OFFSET ?";
			params.push(query.offset);
		}

		const rows = this.db.prepare(sql).all(...params) as Array<{
			id: string;
			name: string | null;
			tags: string | null;
			harness_type: string | null;
			created_at: string;
			finalized_at: string | null;
			duration_ms: number | null;
			signal_count: number;
		}>;

		let results: RecordingMetadata[] = rows.map((row) => {
			const metadata: RecordingMetadata = {
				id: row.id,
				createdAt: row.created_at,
				signalCount: row.signal_count,
			};

			if (row.name !== null) {
				(metadata as { name?: string }).name = row.name;
			}
			if (row.tags !== null) {
				(metadata as { tags?: readonly string[] }).tags = JSON.parse(row.tags);
			}
			if (row.harness_type !== null) {
				(metadata as { harnessType?: string }).harnessType = row.harness_type;
			}
			if (row.duration_ms !== null) {
				(metadata as { durationMs?: number }).durationMs = row.duration_ms;
			}

			return metadata;
		});

		// Filter by tags in memory (JSON array matching in SQL is complex)
		if (query?.tags && query.tags.length > 0) {
			const queryTags = query.tags;
			results = results.filter((m) => m.tags?.some((t) => queryTags.includes(t)));
		}

		return results;
	}

	async delete(recordingId: string): Promise<void> {
		// Use transaction to delete recording and related data
		const deleteAll = this.db.transaction(() => {
			this.db.prepare("DELETE FROM signals WHERE recording_id = ?").run(recordingId);
			this.db.prepare("DELETE FROM checkpoints WHERE recording_id = ?").run(recordingId);
			this.db.prepare("DELETE FROM recordings WHERE id = ?").run(recordingId);
		});

		deleteAll();
	}

	async exists(recordingId: string): Promise<boolean> {
		const result = this.db.prepare("SELECT 1 FROM recordings WHERE id = ?").get(recordingId);
		return result !== null;
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		this.db.close();
	}
}

// ============================================================================
// Helpers
// ============================================================================

function patternToRegex(pattern: string): RegExp {
	// Escape special regex characters except *
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
	// Replace * with .* for wildcard matching
	const regexStr = escaped.replace(/\*/g, ".*");
	return new RegExp(`^${regexStr}$`);
}
