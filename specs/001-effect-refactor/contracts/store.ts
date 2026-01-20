/**
 * Store Contracts - Public API Types
 *
 * These interfaces define the public API surface for the Store.
 * The Store handles persistence of events and sessions.
 *
 * @module @core-v2/store
 */

import type { AnyEvent, EventId } from "./event";

/**
 * Unique identifier for a session.
 */
export type SessionId = string & { readonly __brand: "SessionId" };

/**
 * Session metadata returned by `store.sessions()`.
 */
export interface SessionMetadata {
  /** Session identifier */
  readonly id: SessionId;
  /** When the session was created */
  readonly createdAt: Date;
  /** When the last event was recorded */
  readonly lastEventAt?: Date;
  /** Total number of events in this session */
  readonly eventCount: number;
  /** Workflow name (if recorded) */
  readonly workflowName?: string;
}

/**
 * State snapshot at a specific position.
 */
export interface StateSnapshot<S = unknown> {
  /** The state data */
  readonly data: S;
  /** Event position this snapshot represents */
  readonly position: number;
  /** ID of the event at this position */
  readonly lastEventId?: EventId;
}

/**
 * Store error with typed error codes.
 */
export interface StoreError extends Error {
  /** Error code for programmatic handling */
  readonly code: "NOT_FOUND" | "WRITE_FAILED" | "READ_FAILED" | "CORRUPTED";
  /** Original cause if available */
  readonly cause?: unknown;
}

/**
 * Store interface - persistence for events and sessions.
 *
 * @remarks
 * The Store is responsible for:
 * - Persisting events to durable storage
 * - Retrieving events for replay
 * - Managing session lifecycle
 *
 * Implementations:
 * - `MemoryStore` - In-memory (tests)
 * - `SqliteStore` - SQLite-backed (production)
 *
 * @example
 * ```typescript
 * const store = createSqliteStore({ path: "./sessions.db" });
 *
 * // Append events
 * await store.append(sessionId, event);
 *
 * // Retrieve all events
 * const events = await store.events(sessionId);
 *
 * // List sessions
 * const sessions = await store.sessions();
 * ```
 */
export interface Store {
  /**
   * Append an event to a session.
   *
   * @param sessionId - The session to append to
   * @param event - The event to persist
   * @throws StoreError if write fails
   */
  append(sessionId: SessionId, event: AnyEvent): Promise<void>;

  /**
   * Retrieve all events for a session in order.
   *
   * @param sessionId - The session to retrieve
   * @returns Ordered array of events
   * @throws StoreError if session not found or read fails
   */
  events(sessionId: SessionId): Promise<readonly AnyEvent[]>;

  /**
   * List all recorded sessions.
   *
   * @returns Array of session metadata
   * @throws StoreError if read fails
   */
  sessions(): Promise<readonly SessionMetadata[]>;

  /**
   * Delete a session and all its events.
   *
   * @param sessionId - The session to delete
   * @throws StoreError if delete fails
   */
  clear(sessionId: SessionId): Promise<void>;

  /**
   * Get a state snapshot at a specific position.
   *
   * @remarks
   * Optional method - may not be implemented by all stores.
   * If not available, state is computed by replaying handlers.
   *
   * @param sessionId - The session
   * @param position - Event position (0-based)
   * @returns State snapshot at that position
   */
  snapshot?<S>(sessionId: SessionId, position: number): Promise<StateSnapshot<S>>;
}

// ============================================================================
// Store Factory Types
// ============================================================================

/**
 * Options for creating a MemoryStore.
 */
export interface MemoryStoreOptions {
  /** Optional initial sessions to seed the store */
  readonly initialSessions?: ReadonlyMap<SessionId, readonly AnyEvent[]>;
}

/**
 * Options for creating a SqliteStore.
 */
export interface SqliteStoreOptions {
  /** Path to the SQLite database file */
  readonly path: string;
  /** Whether to create the database if it doesn't exist (default: true) */
  readonly createIfNotExists?: boolean;
  /** Whether to run migrations on startup (default: true) */
  readonly migrate?: boolean;
}
