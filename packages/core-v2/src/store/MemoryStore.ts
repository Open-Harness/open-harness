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
import {
	type PublicStore,
	type SessionId,
	type SessionMetadata,
	type StateSnapshot,
	Store,
	type StoreService,
} from "./Store.js";

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
 * Creates a new MemoryStore instance for Effect composition.
 *
 * @remarks
 * This factory returns an Effect and is useful for internal Effect programs.
 * For the Promise-based public API, use `createMemoryStore()`.
 *
 * @returns Effect that produces a StoreService
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* createMemoryStoreEffect();
 *   yield* store.append(sessionId, event);
 * });
 *
 * await Effect.runPromise(program);
 * ```
 */
export const createMemoryStoreEffect = (): Effect.Effect<StoreService> => makeMemoryStoreService;

/**
 * Creates a new MemoryStore instance with a Promise-based API.
 *
 * @remarks
 * This is the public API factory that hides all Effect types.
 * Returns a PublicStore interface that consumers can use directly.
 *
 * @returns Promise resolving to a PublicStore instance
 *
 * @example
 * ```typescript
 * const store = await createMemoryStore();
 * await store.append(sessionId, event);
 * const events = await store.events(sessionId);
 * ```
 */
export async function createMemoryStore(): Promise<PublicStore> {
	// Run the Effect to get the internal service
	const service = await Effect.runPromise(makeMemoryStoreService);

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
