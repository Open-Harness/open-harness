/**
 * MemoryStore Implementation
 *
 * In-memory store implementation using Effect Ref for thread-safe storage.
 * Events are stored in a Map keyed by session ID, with session metadata
 * tracked separately.
 *
 * @module @core-v2/store
 */

import { Effect, Layer, Ref } from "effect";
import type { AnyEvent } from "../event/Event.js";
import { type SessionId, type SessionMetadata, type StateSnapshot, Store, type StoreService } from "./Store.js";

// ============================================================================
// Internal Session State
// ============================================================================

/**
 * Internal session state tracking events and metadata.
 */
interface SessionState {
	/** Events in chronological order */
	readonly events: readonly AnyEvent[];
	/** Session metadata */
	readonly metadata: SessionMetadata;
}

/**
 * Internal store state - all sessions keyed by ID.
 */
type StoreState = ReadonlyMap<SessionId, SessionState>;

// ============================================================================
// MemoryStore Service Implementation
// ============================================================================

/**
 * Creates the live MemoryStore service using Effect Ref for storage.
 *
 * @remarks
 * This implementation:
 * - Uses `Ref` for thread-safe session storage
 * - Stores events as append-only arrays per session
 * - Tracks metadata (event count, timestamps) automatically
 * - Does NOT implement snapshot caching (returns undefined)
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* Store;
 *   yield* store.append(sessionId, event);
 *   const events = yield* store.events(sessionId);
 * });
 *
 * const runnable = program.pipe(Effect.provide(MemoryStoreLive));
 * ```
 */
export const makeMemoryStoreService = Effect.gen(function* () {
	// Store sessions in a Ref (thread-safe mutable reference)
	const storeRef = yield* Ref.make<StoreState>(new Map());

	const service: StoreService = {
		append: (sessionId: SessionId, event: AnyEvent) =>
			Effect.gen(function* () {
				yield* Ref.update(storeRef, (state) => {
					const newState = new Map(state);
					const existing = state.get(sessionId);

					if (existing) {
						// Update existing session
						const updatedState: SessionState = {
							events: [...existing.events, event],
							metadata: {
								...existing.metadata,
								lastEventAt: event.timestamp,
								eventCount: existing.events.length + 1,
							},
						};
						newState.set(sessionId, updatedState);
					} else {
						// Create new session
						const newSession: SessionState = {
							events: [event],
							metadata: {
								id: sessionId,
								createdAt: event.timestamp,
								lastEventAt: event.timestamp,
								eventCount: 1,
							},
						};
						newState.set(sessionId, newSession);
					}

					return newState;
				});
			}),

		events: (sessionId: SessionId) =>
			Effect.gen(function* () {
				const state = yield* Ref.get(storeRef);
				const session = state.get(sessionId);
				// Return empty array if session not found (per spec FR-023)
				return session?.events ?? [];
			}),

		sessions: () =>
			Effect.gen(function* () {
				const state = yield* Ref.get(storeRef);
				// Extract metadata from all sessions
				return Array.from(state.values()).map((session) => session.metadata);
			}),

		clear: (sessionId: SessionId) =>
			Ref.update(storeRef, (state) => {
				const newState = new Map(state);
				newState.delete(sessionId);
				return newState;
			}),

		snapshot: <S>(_sessionId: SessionId, _position: number) =>
			// MemoryStore does not implement snapshot caching
			// State is computed by replaying handlers when needed
			Effect.succeed(undefined as StateSnapshot<S> | undefined),
	};

	return service;
});

/**
 * Live MemoryStore layer for dependency injection.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* Store;
 *   yield* store.append(makeSessionId("test"), event);
 * });
 *
 * const runnable = program.pipe(Effect.provide(MemoryStoreLive));
 * await Effect.runPromise(runnable);
 * ```
 */
export const MemoryStoreLive = Layer.effect(Store, makeMemoryStoreService);

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new MemoryStore instance wrapped in an Effect.
 *
 * @remarks
 * This factory is useful for testing or when you need direct access
 * to the store service without going through the Layer system.
 *
 * @returns Effect that produces a StoreService
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* createMemoryStore();
 *   yield* store.append(sessionId, event);
 * });
 *
 * await Effect.runPromise(program);
 * ```
 */
export const createMemoryStore = (): Effect.Effect<StoreService> => makeMemoryStoreService;
