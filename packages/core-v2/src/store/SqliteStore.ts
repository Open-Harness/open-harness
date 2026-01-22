/**
 * SqliteStore Implementation
 *
 * Persistent store implementation using better-sqlite3 for SQLite database storage.
 * Events are stored in a single `events` table with session metadata derived from queries.
 *
 * @module @core-v2/store
 */

import Database from "better-sqlite3";
import { Effect, Layer } from "effect";
import type { AnyEvent, EventId } from "../event/Event.js";
import {
	makeSessionId,
	type PublicStore,
	type SessionId,
	type SessionMetadata,
	type StateSnapshot,
	Store,
	StoreError,
	type StoreService,
} from "./Store.js";

// ============================================================================
// Database Schema
// ============================================================================

/**
 * SQL statements for table creation and queries.
 */
const SQL = {
	/**
	 * Create events table if it doesn't exist.
	 * Stores events with JSON-serialized payload.
	 */
	createEventsTable: `
		CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			name TEXT NOT NULL,
			payload TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			caused_by TEXT,
			position INTEGER NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`,

	/**
	 * Create index for efficient session queries.
	 */
	createSessionIndex: `
		CREATE INDEX IF NOT EXISTS idx_events_session_id
		ON events (session_id, position)
	`,

	/**
	 * Insert a new event.
	 */
	insertEvent: `
		INSERT INTO events (id, session_id, name, payload, timestamp, caused_by, position)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`,

	/**
	 * Get all events for a session in order.
	 */
	getEventsBySession: `
		SELECT id, session_id, name, payload, timestamp, caused_by
		FROM events
		WHERE session_id = ?
		ORDER BY position ASC
	`,

	/**
	 * Get session metadata (computed from events).
	 */
	getSessionMetadata: `
		SELECT
			session_id as id,
			MIN(timestamp) as created_at,
			MAX(timestamp) as last_event_at,
			COUNT(*) as event_count
		FROM events
		GROUP BY session_id
	`,

	/**
	 * Get next position for a session.
	 */
	getNextPosition: `
		SELECT COALESCE(MAX(position) + 1, 0) as next_position
		FROM events
		WHERE session_id = ?
	`,

	/**
	 * Delete all events for a session.
	 */
	clearSession: `
		DELETE FROM events WHERE session_id = ?
	`,
} as const;

// ============================================================================
// Event Serialization
// ============================================================================

/**
 * Raw event row from database.
 */
interface EventRow {
	id: string;
	session_id: string;
	name: string;
	payload: string;
	timestamp: string;
	caused_by: string | null;
}

/**
 * Session metadata row from database.
 */
interface SessionRow {
	id: string;
	created_at: string;
	last_event_at: string;
	event_count: number;
}

/**
 * Serialize an event for database storage.
 */
function serializeEvent(
	event: AnyEvent,
	sessionId: SessionId,
	position: number,
): [string, string, string, string, string, string | null, number] {
	return [
		event.id,
		sessionId,
		event.name,
		JSON.stringify(event.payload),
		event.timestamp.toISOString(),
		event.causedBy ?? null,
		position,
	];
}

/**
 * Deserialize an event from database row.
 */
function deserializeEvent(row: EventRow): AnyEvent {
	return {
		id: row.id as EventId,
		name: row.name,
		payload: JSON.parse(row.payload),
		timestamp: new Date(row.timestamp),
		causedBy: row.caused_by ? (row.caused_by as EventId) : undefined,
	};
}

/**
 * Convert session row to metadata.
 */
function rowToMetadata(row: SessionRow): SessionMetadata {
	return {
		id: makeSessionId(row.id),
		createdAt: new Date(row.created_at),
		lastEventAt: row.last_event_at ? new Date(row.last_event_at) : undefined,
		eventCount: row.event_count,
	};
}

// ============================================================================
// SqliteStore Configuration
// ============================================================================

/**
 * Configuration options for SqliteStore.
 */
export interface SqliteStoreConfig {
	/**
	 * Path to the SQLite database file.
	 * Use ":memory:" for an in-memory database.
	 */
	readonly path: string;

	/**
	 * Whether to enable WAL mode for better concurrency.
	 * Defaults to true for file-based databases.
	 */
	readonly walMode?: boolean;
}

// ============================================================================
// SqliteStore Service Implementation
// ============================================================================

/**
 * Creates the live SqliteStore service.
 *
 * @remarks
 * This implementation:
 * - Uses `better-sqlite3` for synchronous SQLite operations
 * - Stores events in a single `events` table with JSON-serialized payloads
 * - Derives session metadata from event queries (no separate sessions table)
 * - Supports both file-based and in-memory databases
 * - Does NOT implement snapshot caching (returns undefined)
 *
 * @param config - Configuration for the SQLite database
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* Store;
 *   yield* store.append(sessionId, event);
 *   const events = yield* store.events(sessionId);
 * });
 *
 * const SqliteStoreLive = makeSqliteStoreLive({ path: "./data/store.db" });
 * const runnable = program.pipe(Effect.provide(SqliteStoreLive));
 * ```
 */
export const makeSqliteStoreService = (config: SqliteStoreConfig) =>
	Effect.gen(function* () {
		// Create database connection
		const db = new Database(config.path);

		// Enable WAL mode for better concurrency (default for file databases)
		if (config.walMode !== false && config.path !== ":memory:") {
			db.pragma("journal_mode = WAL");
		}

		// Enable foreign keys
		db.pragma("foreign_keys = ON");

		// Create tables
		db.exec(SQL.createEventsTable);
		db.exec(SQL.createSessionIndex);

		// Prepare statements for better performance
		const insertStmt = db.prepare(SQL.insertEvent);
		const getEventsStmt = db.prepare(SQL.getEventsBySession);
		const getSessionsStmt = db.prepare(SQL.getSessionMetadata);
		const getNextPositionStmt = db.prepare(SQL.getNextPosition);
		const clearSessionStmt = db.prepare(SQL.clearSession);

		const service: StoreService = {
			append: (sessionId: SessionId, event: AnyEvent) =>
				Effect.gen(function* () {
					try {
						// Get next position for this session
						const positionRow = getNextPositionStmt.get(sessionId) as {
							next_position: number;
						};
						const position = positionRow.next_position;

						// Insert the event
						const params = serializeEvent(event, sessionId, position);
						insertStmt.run(...params);
					} catch (error) {
						return yield* Effect.fail(
							new StoreError("WRITE_FAILED", `Failed to append event: ${String(error)}`, error),
						);
					}
				}),

			events: (sessionId: SessionId) =>
				Effect.gen(function* () {
					try {
						const rows = getEventsStmt.all(sessionId) as EventRow[];
						return rows.map(deserializeEvent);
					} catch (error) {
						return yield* Effect.fail(new StoreError("READ_FAILED", `Failed to read events: ${String(error)}`, error));
					}
				}),

			sessions: () =>
				Effect.gen(function* () {
					try {
						const rows = getSessionsStmt.all() as SessionRow[];
						return rows.map(rowToMetadata);
					} catch (error) {
						return yield* Effect.fail(
							new StoreError("READ_FAILED", `Failed to read sessions: ${String(error)}`, error),
						);
					}
				}),

			clear: (sessionId: SessionId) =>
				Effect.gen(function* () {
					try {
						clearSessionStmt.run(sessionId);
					} catch (error) {
						return yield* Effect.fail(
							new StoreError("WRITE_FAILED", `Failed to clear session: ${String(error)}`, error),
						);
					}
				}),

			snapshot: <S>(_sessionId: SessionId, _position: number) =>
				// SqliteStore does not implement snapshot caching
				// State is computed by replaying handlers when needed
				Effect.succeed(undefined as StateSnapshot<S> | undefined),
		};

		return service;
	});

/**
 * Creates a SqliteStoreLive Layer with the given configuration.
 *
 * @param config - Configuration for the SQLite database
 * @returns Layer that provides Store service
 *
 * @example
 * ```typescript
 * const SqliteStoreLive = makeSqliteStoreLive({ path: "./data/store.db" });
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* Store;
 *   yield* store.append(makeSessionId("test"), event);
 * });
 *
 * await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreLive)));
 * ```
 */
export const makeSqliteStoreLive = (config: SqliteStoreConfig) => Layer.effect(Store, makeSqliteStoreService(config));

/**
 * Pre-configured in-memory SqliteStore for testing.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* Store;
 *   yield* store.append(sessionId, event);
 * });
 *
 * await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));
 * ```
 */
export const SqliteStoreMemoryLive = makeSqliteStoreLive({ path: ":memory:" });

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new SqliteStore instance for Effect composition.
 *
 * @remarks
 * This factory returns an Effect and is useful for internal Effect programs.
 * For the Promise-based public API, use `createSqliteStore()`.
 *
 * @param config - Configuration for the SQLite database
 * @returns Effect that produces a StoreService
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* createSqliteStoreEffect({ path: ":memory:" });
 *   yield* store.append(sessionId, event);
 * });
 *
 * await Effect.runPromise(program);
 * ```
 */
export const createSqliteStoreEffect = (config: SqliteStoreConfig): Effect.Effect<StoreService> =>
	makeSqliteStoreService(config);

/**
 * Creates a new SqliteStore instance with a Promise-based API.
 *
 * @remarks
 * This is the public API factory that hides all Effect types.
 * Returns a PublicStore interface that consumers can use directly.
 *
 * @param config - Configuration for the SQLite database
 * @returns Promise resolving to a PublicStore instance
 *
 * @example
 * ```typescript
 * const store = await createSqliteStore({ path: "./sessions.db" });
 * await store.append(sessionId, event);
 * const events = await store.events(sessionId);
 * ```
 */
export async function createSqliteStore(config: SqliteStoreConfig): Promise<PublicStore> {
	// Run the Effect to get the internal service
	const service = await Effect.runPromise(makeSqliteStoreService(config));

	// Wrap in Promise-based PublicStore interface
	return wrapStoreService(service);
}

/**
 * Wraps an internal StoreService with the public Promise-based API.
 *
 * @param service - Internal Effect-based store service
 * @returns Public Promise-based store interface
 */
function wrapStoreService(service: StoreService): PublicStore {
	return {
		append: (sessionId, event) => Effect.runPromise(service.append(sessionId, event)),
		events: (sessionId) => Effect.runPromise(service.events(sessionId)),
		sessions: () => Effect.runPromise(service.sessions()),
		clear: (sessionId) => Effect.runPromise(service.clear(sessionId)),
		snapshot: (sessionId, position) => Effect.runPromise(service.snapshot(sessionId, position)),
	};
}
