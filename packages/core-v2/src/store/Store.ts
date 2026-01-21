/**
 * Store Service Definition
 *
 * The Store is responsible for persisting events and sessions.
 * This module defines the Store service tag and interface for the
 * Effect Layer pattern.
 *
 * @module @core-v2/store
 */

import { Context, type Effect, Schema } from "effect";
import type { AnyEvent, EventId } from "../event/Event.js";

// ============================================================================
// SessionId Branded Type
// ============================================================================

/**
 * SessionId schema - branded string for type safety.
 */
export const SessionIdSchema = Schema.String.pipe(Schema.brand("SessionId"));

/**
 * SessionId type - unique identifier for a session.
 * Branded at compile time for type safety.
 */
export type SessionId = typeof SessionIdSchema.Type;

/**
 * Creates a SessionId from a string.
 * At runtime this is just string identity, but provides compile-time branding.
 */
export function makeSessionId(id: string): SessionId {
	return id as SessionId;
}

/**
 * Generates a new unique SessionId using UUID v4.
 */
export function generateSessionId(): SessionId {
	return crypto.randomUUID() as SessionId;
}

// ============================================================================
// Session Metadata
// ============================================================================

/**
 * Session metadata returned by store.sessions().
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

// ============================================================================
// State Snapshot
// ============================================================================

/**
 * State snapshot at a specific position.
 * Used for optional caching/optimization in store implementations.
 */
export interface StateSnapshot<S = unknown> {
	/** The state data */
	readonly data: S;
	/** Event position this snapshot represents (0-based) */
	readonly position: number;
	/** ID of the event at this position */
	readonly lastEventId?: EventId;
}

// ============================================================================
// Store Error
// ============================================================================

/**
 * Store error codes for programmatic handling.
 */
export type StoreErrorCode = "NOT_FOUND" | "WRITE_FAILED" | "READ_FAILED" | "CORRUPTED";

/**
 * Store error class with typed error codes.
 * Used as Effect error channel type.
 */
export class StoreError extends Error {
	readonly _tag = "StoreError";

	constructor(
		/** Error code for programmatic handling */
		readonly code: StoreErrorCode,
		/** Human-readable error message */
		message: string,
		/** Original cause if available */
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "StoreError";
	}
}

// ============================================================================
// Store Service Interface (Effect Internal)
// ============================================================================

/**
 * Store service interface - defines operations for event persistence.
 *
 * @remarks
 * This is the internal Effect service interface. All methods return
 * Effect types. The public API wraps these with Promise-based methods.
 *
 * Operations:
 * - `append`: Persist an event to a session
 * - `events`: Retrieve all events for a session in order
 * - `sessions`: List all recorded sessions with metadata
 * - `clear`: Delete a session and all its events
 * - `snapshot`: (optional) Get cached state at a position
 */
export interface StoreService {
	/**
	 * Append an event to a session.
	 * Creates the session if it doesn't exist.
	 *
	 * @param sessionId - The session to append to
	 * @param event - The event to persist
	 * @returns Effect that succeeds with void or fails with StoreError
	 */
	readonly append: (sessionId: SessionId, event: AnyEvent) => Effect.Effect<void, StoreError>;

	/**
	 * Retrieve all events for a session in chronological order.
	 *
	 * @param sessionId - The session to retrieve
	 * @returns Effect with ordered array of events, or empty array if session not found
	 */
	readonly events: (sessionId: SessionId) => Effect.Effect<readonly AnyEvent[], StoreError>;

	/**
	 * List all recorded sessions with metadata.
	 *
	 * @returns Effect with array of session metadata
	 */
	readonly sessions: () => Effect.Effect<readonly SessionMetadata[], StoreError>;

	/**
	 * Delete a session and all its events.
	 *
	 * @param sessionId - The session to delete
	 * @returns Effect that succeeds with void (no-op if session doesn't exist)
	 */
	readonly clear: (sessionId: SessionId) => Effect.Effect<void, StoreError>;

	/**
	 * Get a state snapshot at a specific position.
	 *
	 * @remarks
	 * Optional method - implementations may return Effect.succeed(undefined)
	 * if snapshots are not supported. When not available, state is computed
	 * by replaying handlers.
	 *
	 * @param sessionId - The session
	 * @param position - Event position (0-based)
	 * @returns Effect with state snapshot or undefined if not available
	 */
	readonly snapshot: <S>(
		sessionId: SessionId,
		position: number,
	) => Effect.Effect<StateSnapshot<S> | undefined, StoreError>;
}

// ============================================================================
// Store Context Tag
// ============================================================================

/**
 * Store service tag for Effect dependency injection.
 *
 * @example
 * ```typescript
 * // Using the store in an Effect program
 * const program = Effect.gen(function* () {
 *   const store = yield* Store;
 *   yield* store.append(sessionId, event);
 *   const events = yield* store.events(sessionId);
 *   return events;
 * });
 *
 * // Providing the store layer
 * const runnable = program.pipe(Effect.provide(MemoryStoreLive));
 * ```
 */
export class Store extends Context.Tag("@core-v2/Store")<Store, StoreService>() {}

// ============================================================================
// Consumer-Facing Store Interface (Promise-based)
// ============================================================================

/**
 * Consumer-facing Store interface with Promise-based methods.
 * This is what the public API exposes - no Effect types.
 */
export interface PublicStore {
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
	 * @returns Ordered array of events (empty if session not found)
	 */
	events(sessionId: SessionId): Promise<readonly AnyEvent[]>;

	/**
	 * List all recorded sessions.
	 *
	 * @returns Array of session metadata
	 */
	sessions(): Promise<readonly SessionMetadata[]>;

	/**
	 * Delete a session and all its events.
	 *
	 * @param sessionId - The session to delete
	 */
	clear(sessionId: SessionId): Promise<void>;

	/**
	 * Get a state snapshot at a specific position.
	 *
	 * @remarks
	 * Optional - may return undefined if not supported.
	 *
	 * @param sessionId - The session
	 * @param position - Event position (0-based)
	 * @returns State snapshot or undefined
	 */
	snapshot?<S>(sessionId: SessionId, position: number): Promise<StateSnapshot<S> | undefined>;
}
