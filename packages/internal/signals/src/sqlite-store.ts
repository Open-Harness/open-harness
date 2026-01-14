/**
 * SqliteSignalStore - SQLite-based implementation of SignalStore
 *
 * Uses Bun's built-in SQLite for fast, ACID-compliant signal storage.
 *
 * Schema:
 * - recordings: metadata for each recording
 * - signals: individual signals with foreign key to recording
 * - checkpoints: named positions within recordings
 *
 * @example
 * ```ts
 * const store = new SqliteSignalStore({ dbPath: ".recordings/signals.db" });
 *
 * const id = await store.create({ name: "test" });
 * await store.append(id, signal1);
 * await store.append(id, signal2);
 * await store.finalize(id);
 *
 * const recording = await store.load(id);
 * ```
 */

import { Database } from "bun:sqlite";
import type { Signal } from "@internal/signals-core";
import type { Checkpoint, Recording, RecordingMetadata, RecordingQuery, SignalStore } from "./store.js";

// ============================================================================
// Types
// ============================================================================

export interface SqliteSignalStoreOptions {
	/** Path to SQLite database file. Use ":memory:" for in-memory database. */
	dbPath: string;
}

// ============================================================================
// SqliteSignalStore
// ============================================================================

/**
 * SQLite-based SignalStore implementation.
 *
 * Provides ACID-compliant storage with efficient querying capabilities.
 * Suitable for production use with larger recording volumes.
 */
export class SqliteSignalStore implements SignalStore {
	private readonly db: Database;
	private nextId = 1;

	constructor(options: SqliteSignalStoreOptions) {
		this.db = new Database(options.dbPath);
		this.initSchema();
	}

	/**
	 * Initialize database schema
	 */
	private initSchema(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS recordings (
				id TEXT PRIMARY KEY,
				created_at TEXT NOT NULL,
				name TEXT,
				tags TEXT,
				harness_type TEXT,
				signal_count INTEGER DEFAULT 0,
				duration_ms INTEGER,
				finalized INTEGER DEFAULT 0
			);

			CREATE TABLE IF NOT EXISTS signals (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				recording_id TEXT NOT NULL,
				signal_id TEXT NOT NULL,
				name TEXT NOT NULL,
				payload TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				source TEXT,
				seq INTEGER NOT NULL,
				FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS checkpoints (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				recording_id TEXT NOT NULL,
				name TEXT NOT NULL,
				signal_index INTEGER NOT NULL,
				timestamp TEXT NOT NULL,
				FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_signals_recording ON signals(recording_id);
			CREATE INDEX IF NOT EXISTS idx_signals_name ON signals(name);
			CREATE INDEX IF NOT EXISTS idx_checkpoints_recording ON checkpoints(recording_id);
		`);
	}

	/**
	 * Generate a unique recording ID
	 */
	private generateId(): string {
		return `rec_${Date.now()}_${this.nextId++}`;
	}

	async create(options?: { name?: string; tags?: string[]; harnessType?: string }): Promise<string> {
		const id = this.generateId();
		const now = new Date().toISOString();
		const tags = options?.tags ? JSON.stringify(options.tags) : null;

		this.db.run(
			`INSERT INTO recordings (id, created_at, name, tags, harness_type, signal_count, finalized)
			 VALUES (?, ?, ?, ?, ?, 0, 0)`,
			[id, now, options?.name ?? null, tags, options?.harnessType ?? null],
		);

		return id;
	}

	async append(recordingId: string, signal: Signal): Promise<void> {
		// Check recording exists and not finalized
		const recording = this.db
			.query<{ finalized: number; signal_count: number }, [string]>(
				`SELECT finalized, signal_count FROM recordings WHERE id = ?`,
			)
			.get(recordingId);

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (recording.finalized) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		const seq = recording.signal_count;

		// Insert signal
		this.db.run(
			`INSERT INTO signals (recording_id, signal_id, name, payload, timestamp, source, seq)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				recordingId,
				signal.id,
				signal.name,
				JSON.stringify(signal.payload),
				signal.timestamp,
				signal.source ? JSON.stringify(signal.source) : null,
				seq,
			],
		);

		// Update signal count
		this.db.run(`UPDATE recordings SET signal_count = signal_count + 1 WHERE id = ?`, [recordingId]);
	}

	async appendBatch(recordingId: string, signals: Signal[]): Promise<void> {
		if (signals.length === 0) return;

		// Check recording exists and not finalized
		const recording = this.db
			.query<{ finalized: number; signal_count: number }, [string]>(
				`SELECT finalized, signal_count FROM recordings WHERE id = ?`,
			)
			.get(recordingId);

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}
		if (recording.finalized) {
			throw new Error(`Recording is finalized: ${recordingId}`);
		}

		// Use transaction for batch insert
		const insertStmt = this.db.prepare(
			`INSERT INTO signals (recording_id, signal_id, name, payload, timestamp, source, seq)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		);

		const transaction = this.db.transaction((sigs: Signal[]) => {
			let seq = recording.signal_count;
			for (const signal of sigs) {
				insertStmt.run(
					recordingId,
					signal.id,
					signal.name,
					JSON.stringify(signal.payload),
					signal.timestamp,
					signal.source ? JSON.stringify(signal.source) : null,
					seq++,
				);
			}
			this.db.run(`UPDATE recordings SET signal_count = signal_count + ? WHERE id = ?`, [sigs.length, recordingId]);
		});

		transaction(signals);
	}

	async checkpoint(recordingId: string, name: string): Promise<void> {
		// Check recording exists
		const recording = this.db
			.query<{ signal_count: number }, [string]>(`SELECT signal_count FROM recordings WHERE id = ?`)
			.get(recordingId);

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const now = new Date().toISOString();
		const index = recording.signal_count - 1;

		this.db.run(
			`INSERT INTO checkpoints (recording_id, name, signal_index, timestamp)
			 VALUES (?, ?, ?, ?)`,
			[recordingId, name, index, now],
		);
	}

	async getCheckpoints(recordingId: string): Promise<Checkpoint[]> {
		// Check recording exists
		const exists = this.db.query<{ id: string }, [string]>(`SELECT id FROM recordings WHERE id = ?`).get(recordingId);

		if (!exists) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const rows = this.db
			.query<{ name: string; signal_index: number; timestamp: string }, [string]>(
				`SELECT name, signal_index, timestamp FROM checkpoints
			 WHERE recording_id = ? ORDER BY id`,
			)
			.all(recordingId);

		return rows.map((row) => ({
			name: row.name,
			index: row.signal_index,
			timestamp: row.timestamp,
		}));
	}

	async finalize(recordingId: string, durationMs?: number): Promise<void> {
		const recording = this.db
			.query<{ id: string }, [string]>(`SELECT id FROM recordings WHERE id = ?`)
			.get(recordingId);

		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		if (durationMs !== undefined) {
			this.db.run(`UPDATE recordings SET finalized = 1, duration_ms = ? WHERE id = ?`, [durationMs, recordingId]);
		} else {
			this.db.run(`UPDATE recordings SET finalized = 1 WHERE id = ?`, [recordingId]);
		}
	}

	async load(recordingId: string): Promise<Recording | null> {
		// Load metadata
		const row = this.db
			.query<
				{
					id: string;
					created_at: string;
					name: string | null;
					tags: string | null;
					harness_type: string | null;
					signal_count: number;
					duration_ms: number | null;
				},
				[string]
			>(
				`SELECT id, created_at, name, tags, harness_type, signal_count, duration_ms
			 FROM recordings WHERE id = ?`,
			)
			.get(recordingId);

		if (!row) {
			return null;
		}

		// Load signals
		const signalRows = this.db
			.query<
				{
					signal_id: string;
					name: string;
					payload: string;
					timestamp: string;
					source: string | null;
				},
				[string]
			>(
				`SELECT signal_id, name, payload, timestamp, source FROM signals
			 WHERE recording_id = ? ORDER BY seq`,
			)
			.all(recordingId);

		const signals: Signal[] = signalRows.map((s) => ({
			id: s.signal_id,
			name: s.name,
			payload: JSON.parse(s.payload),
			timestamp: s.timestamp,
			source: s.source ? JSON.parse(s.source) : undefined,
		}));

		const metadata: RecordingMetadata = {
			id: row.id,
			createdAt: row.created_at,
			name: row.name ?? undefined,
			tags: row.tags ? JSON.parse(row.tags) : undefined,
			harnessType: row.harness_type ?? undefined,
			signalCount: row.signal_count,
			durationMs: row.duration_ms ?? undefined,
		};

		return { metadata, signals };
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
		const exists = this.db.query<{ id: string }, [string]>(`SELECT id FROM recordings WHERE id = ?`).get(recordingId);

		if (!exists) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		const from = options?.fromIndex ?? 0;
		const to = options?.toIndex;

		let query = `SELECT signal_id, name, payload, timestamp, source FROM signals
					 WHERE recording_id = ? AND seq >= ?`;
		const params: (string | number)[] = [recordingId, from];

		if (to !== undefined) {
			query += ` AND seq < ?`;
			params.push(to);
		}

		query += ` ORDER BY seq`;

		const signalRows = this.db
			.query<
				{
					signal_id: string;
					name: string;
					payload: string;
					timestamp: string;
					source: string | null;
				},
				(string | number)[]
			>(query)
			.all(...params);

		let signals: Signal[] = signalRows.map((s) => ({
			id: s.signal_id,
			name: s.name,
			payload: JSON.parse(s.payload),
			timestamp: s.timestamp,
			source: s.source ? JSON.parse(s.source) : undefined,
		}));

		// Apply pattern filter (in memory, could be optimized with SQL LIKE)
		if (options?.patterns && options.patterns.length > 0) {
			const regexes = options.patterns.map((p) => patternToRegex(p));
			signals = signals.filter((s) => regexes.some((r) => r.test(s.name)));
		}

		return signals;
	}

	async list(query?: RecordingQuery): Promise<RecordingMetadata[]> {
		let sql = `SELECT id, created_at, name, tags, harness_type, signal_count, duration_ms
				   FROM recordings WHERE 1=1`;
		const params: (string | number)[] = [];

		// Filter by harness type
		if (query?.harnessType) {
			sql += ` AND harness_type = ?`;
			params.push(query.harnessType);
		}

		// Sort by creation time (newest first)
		sql += ` ORDER BY created_at DESC`;

		// Apply pagination
		if (query?.limit) {
			sql += ` LIMIT ?`;
			params.push(query.limit);
		}
		if (query?.offset) {
			sql += ` OFFSET ?`;
			params.push(query.offset);
		}

		const rows = this.db
			.query<
				{
					id: string;
					created_at: string;
					name: string | null;
					tags: string | null;
					harness_type: string | null;
					signal_count: number;
					duration_ms: number | null;
				},
				(string | number)[]
			>(sql)
			.all(...params);

		let results: RecordingMetadata[] = rows.map((row) => ({
			id: row.id,
			createdAt: row.created_at,
			name: row.name ?? undefined,
			tags: row.tags ? JSON.parse(row.tags) : undefined,
			harnessType: row.harness_type ?? undefined,
			signalCount: row.signal_count,
			durationMs: row.duration_ms ?? undefined,
		}));

		// Filter by tags (in memory - could be optimized with JSON functions)
		if (query?.tags && query.tags.length > 0) {
			const queryTags = query.tags;
			results = results.filter((m) => m.tags?.some((t) => queryTags.includes(t)));
		}

		return results;
	}

	async delete(recordingId: string): Promise<void> {
		// Signals and checkpoints are deleted via CASCADE
		this.db.run(`DELETE FROM recordings WHERE id = ?`, [recordingId]);
	}

	async exists(recordingId: string): Promise<boolean> {
		const result = this.db.query<{ id: string }, [string]>(`SELECT id FROM recordings WHERE id = ?`).get(recordingId);
		return result !== null;
	}

	/**
	 * Clear all recordings (useful for testing)
	 */
	clear(): void {
		this.db.exec(`
			DELETE FROM signals;
			DELETE FROM checkpoints;
			DELETE FROM recordings;
		`);
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		this.db.close();
	}

	/**
	 * Get database file path (useful for debugging)
	 */
	get path(): string {
		return this.db.filename;
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
