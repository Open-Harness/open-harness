/**
 * StateCache - Typed state cache using Effect.Cache.
 *
 * Per ADR-006: Uses deriveState for event sourcing. Events are the single
 * source of truth. State is always derived from events, never stored directly.
 *
 * The cache:
 * - Loads latest snapshot + subsequent events
 * - Derives state using deriveStateOptimized
 * - Saves periodic snapshots for fast replay
 * - Invalidates on StateIntent events via EventHub subscription
 *
 * @module
 */

import { Cache, Duration, Effect, Match, Stream, SubscriptionRef } from "effect"
import type { Scope } from "effect"

import type { HandlerError, SessionNotFound, StoreError } from "../Domain/Errors.js"
import { SessionNotFound as SessionNotFoundError } from "../Domain/Errors.js"
import type { SessionId } from "../Domain/Ids.js"
import { deriveState } from "../Engine/utils.js"
import { EventHub } from "./EventHub.js"
import { EventStore } from "./EventStore.js"
import type { StoredStateSnapshot } from "./StateSnapshotStore.js"
import { StateSnapshotStore } from "./StateSnapshotStore.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a typed state cache.
 */
export interface StateCacheConfig<S> {
  readonly initialState: S
  readonly capacity?: number // Default: 100
  readonly snapshotEvery?: number // Save snapshot every N events (default: 1000)
}

/**
 * Typed state cache interface.
 * S is preserved - no casting needed.
 */
export interface StateCache<S> {
  /** Get current state (typed) */
  readonly get: (
    sessionId: SessionId
  ) => Effect.Effect<S, SessionNotFound | StoreError | HandlerError>

  /** Set state (typed) */
  readonly set: (sessionId: SessionId, state: S) => Effect.Effect<void, never>

  /** Subscribe to state changes (typed) */
  readonly subscribe: (
    sessionId: SessionId
  ) => Effect.Effect<
    SubscriptionRef.SubscriptionRef<S>,
    SessionNotFound | StoreError | HandlerError
  >

  /** Invalidate cache entry (force recompute on next get) */
  readonly invalidate: (sessionId: SessionId) => Effect.Effect<void, never>
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

/**
 * Create a typed state cache wired to EventHub for automatic invalidation.
 *
 * Per ADR-006 (Event Sourcing):
 * - Uses deriveState to compute state from events (single source of truth)
 * - Loads latest snapshot + subsequent events
 * - Saves snapshots periodically for fast replay
 * - Subscribes to EventHub and invalidates on StateIntent events
 *
 * The cache is scoped - EventHub subscription fiber is cleaned up when scope closes.
 *
 * @example
 * ```typescript
 * const stateCache = yield* makeStateCache({
 *   initialState: { tasks: [] }
 * })
 *
 * const state = yield* stateCache.get(sessionId) // Typed!
 * ```
 */
export const makeStateCache = <S>(
  config: StateCacheConfig<S>
): Effect.Effect<StateCache<S>, never, EventStore | StateSnapshotStore | EventHub | Scope.Scope> =>
  Effect.gen(function*() {
    const eventStore = yield* EventStore
    const snapshotStore = yield* StateSnapshotStore
    const hub = yield* EventHub
    const { capacity = 100, initialState, snapshotEvery = 1000 } = config

    // SubscriptionRefs for reactive updates (per session)
    const subscriptions = new Map<string, SubscriptionRef.SubscriptionRef<S>>()

    // In-memory state for sessions that haven't been persisted yet
    const pendingStates = new Map<string, S>()

    // Session ID tracking for invalidation (StateIntent events include sessionId in state)
    // We track which sessions have been accessed so we can invalidate on new events
    const knownSessions = new Set<string>()

    // Recompute state from snapshot + events using deriveState (ADR-006)
    const recomputeState = (
      sessionId: SessionId
    ): Effect.Effect<S, SessionNotFound | StoreError | HandlerError, never> =>
      Effect.gen(function*() {
        // Track this session for invalidation
        knownSessions.add(sessionId)

        // 1. Get latest snapshot (if any)
        const snapshot = yield* snapshotStore.getLatest(sessionId)
        const startPosition = snapshot?.position ?? 0

        // 2. Get events from snapshot position
        const events = yield* eventStore.getEventsFrom(sessionId, startPosition)

        if (events.length === 0 && !snapshot) {
          return yield* Effect.fail(new SessionNotFoundError({ sessionId }))
        }

        // 3. Derive state using deriveState (ADR-006)
        // This applies StateIntent, StateCheckpoint (new) or state:updated (old) events
        const baseState = (snapshot?.state as S | undefined) ?? initialState
        const state = deriveState(events, baseState)

        // 4. Save snapshot if we replayed many events
        const totalPosition = startPosition + events.length
        if (events.length >= snapshotEvery) {
          yield* snapshotStore.save({
            sessionId,
            state,
            position: totalPosition,
            createdAt: new Date()
          } as StoredStateSnapshot)
        }

        return state
      })

    // Internal cache using Effect.Cache
    const cache = yield* Cache.make<
      SessionId,
      S,
      SessionNotFound | StoreError | HandlerError
    >({
      capacity,
      timeToLive: Duration.infinity,
      lookup: recomputeState
    })

    // Subscribe to EventHub for automatic invalidation on StateIntent events (ADR-006)
    const eventStream = yield* hub.subscribe()
    yield* eventStream.pipe(
      Stream.runForEach((event) =>
        Match.value(event).pipe(
          Match.tag("StateIntent", () =>
            // Invalidate all known sessions when state changes
            // A more sophisticated implementation could track sessionId per event
            Effect.forEach(
              [...knownSessions],
              (sessionIdStr) =>
                Effect.gen(function*() {
                  // Clear pending state
                  pendingStates.delete(sessionIdStr)
                  // Invalidate cache (cast back to SessionId since knownSessions stores strings)
                  yield* cache.invalidate(sessionIdStr as SessionId)
                }),
              { discard: true }
            )),
          Match.orElse(() => Effect.void) // Ignore other events
        )
      ),
      Effect.forkScoped // Fork as scoped fiber - cleaned up when scope closes
    )

    return {
      get: (sessionId) =>
        Effect.gen(function*() {
          // Check pending states first (for newly created sessions)
          const pending = pendingStates.get(sessionId)
          if (pending !== undefined) {
            return pending
          }
          return yield* cache.get(sessionId)
        }),

      set: (sessionId, state) =>
        Effect.gen(function*() {
          // Store in pending states
          pendingStates.set(sessionId, state)
          // Track session
          knownSessions.add(sessionId)
          // Invalidate cache so next get uses pending or recomputes
          yield* cache.invalidate(sessionId)
          // Update subscription if exists
          const sub = subscriptions.get(sessionId)
          if (sub) {
            yield* SubscriptionRef.set(sub, state)
          }
        }),

      subscribe: (sessionId) =>
        Effect.gen(function*() {
          const existing = subscriptions.get(sessionId)
          if (existing) return existing

          // Get current state (from pending or cache)
          const pending = pendingStates.get(sessionId)
          const currentState = pending !== undefined ? pending : yield* cache.get(sessionId)

          const sub = yield* SubscriptionRef.make(currentState)
          subscriptions.set(sessionId, sub)
          return sub
        }),

      invalidate: (sessionId) =>
        Effect.gen(function*() {
          pendingStates.delete(sessionId)
          yield* cache.invalidate(sessionId)
        })
    }
  })
