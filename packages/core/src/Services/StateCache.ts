/**
 * StateCache - Typed state cache using Effect.Cache.
 *
 * Provides type-safe state access without casting.
 * The generic S is preserved throughout - no `as S` needed.
 *
 * @module
 */

import { Cache, Duration, Effect, SubscriptionRef } from "effect"

import type { HandlerError, SessionNotFound, StoreError } from "../Domain/Errors.js"
import { SessionNotFound as SessionNotFoundError } from "../Domain/Errors.js"
import type { SessionId } from "../Domain/Ids.js"
import { computeStateAt } from "../Engine/utils.js"
import { EventStore } from "./EventStore.js"
import type { StateSnapshot } from "./StateSnapshotStore.js"
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
 * Create a typed state cache.
 *
 * The cache:
 * - Returns typed S (no casting)
 * - Recomputes from snapshot + events on cache miss
 * - Saves snapshots periodically for large event volumes
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
): Effect.Effect<StateCache<S>, never, EventStore | StateSnapshotStore> =>
  Effect.gen(function*() {
    const eventStore = yield* EventStore
    const snapshotStore = yield* StateSnapshotStore
    const { capacity = 100, initialState, snapshotEvery = 1000 } = config

    // SubscriptionRefs for reactive updates (per session)
    const subscriptions = new Map<string, SubscriptionRef.SubscriptionRef<S>>()

    // In-memory state for sessions that haven't been persisted yet
    const pendingStates = new Map<string, S>()

    // Recompute state from snapshot + events
    const recomputeState = (
      sessionId: SessionId
    ): Effect.Effect<S, SessionNotFound | StoreError | HandlerError, never> =>
      Effect.gen(function*() {
        // 1. Get latest snapshot (if any)
        const snapshot = yield* snapshotStore.getLatest(sessionId)
        const startPosition = snapshot?.position ?? 0

        // 2. Get events from snapshot position
        const events = yield* eventStore.getEventsFrom(sessionId, startPosition)

        if (events.length === 0 && !snapshot) {
          return yield* Effect.fail(new SessionNotFoundError({ sessionId }))
        }

        // 3. Scan for last state:updated event to compute current state
        const totalPosition = startPosition + events.length
        const computed = computeStateAt<S>(events, events.length)
        const state = computed ?? (snapshot?.state as S | undefined) ?? initialState

        // 4. Save snapshot if we replayed many events
        if (events.length >= snapshotEvery) {
          yield* snapshotStore.save({
            sessionId,
            state,
            position: totalPosition,
            createdAt: new Date()
          } as StateSnapshot)
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
