/**
 * StateProjection service - Derives state from events using SubscriptionRef.
 *
 * Per ADR-006: Events are the single source of truth. State is always derived
 * from events, never mutated directly. This service maintains a reactive
 * projection of state by subscribing to EventHub and applying patches from
 * StateIntent events or setting state directly from StateCheckpoint events.
 *
 * @module
 */

import { Context, Effect, Layer, Match, Stream, SubscriptionRef } from "effect"
import type { Scope } from "effect"

import type { StateCheckpoint, StateIntent } from "../Domain/Events.js"
import { EventHub } from "./EventHub.js"

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface StateProjectionService<S> {
  /**
   * Get current derived state.
   *
   * Returns the state as computed from all events received so far.
   * This is a snapshot at the current moment.
   */
  readonly get: Effect.Effect<S>

  /**
   * Stream of state changes.
   *
   * Emits whenever state is updated (from StateIntent or StateCheckpoint events).
   * The SubscriptionRef backs this, providing reactive updates.
   */
  readonly changes: Stream.Stream<S>
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

/**
 * StateProjection service tag.
 *
 * Note: Uses `unknown` as the state type since Context.Tag doesn't support
 * type parameters. The actual state type is preserved through makeStateProjection.
 */
export class StateProjection extends Context.Tag("@open-scaffold/StateProjection")<
  StateProjection,
  StateProjectionService<unknown>
>() {}

// ─────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Create a StateProjection that maintains state derived from events.
 *
 * Spawns a background fiber that subscribes to EventHub and:
 * - Applies patches from StateIntent events
 * - Sets state directly from StateCheckpoint events
 * - Ignores all other event types
 *
 * The fiber is scoped - it will be cleaned up when the caller's scope closes.
 *
 * @param initial - Initial state value
 * @returns Effect that yields a StateProjectionService
 *
 * @example
 * ```typescript
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const projection = yield* makeStateProjection({ count: 0 })
 *
 *     // Get current state
 *     const state = yield* projection.get
 *     console.log(state) // { count: 0 }
 *
 *     // Subscribe to changes
 *     yield* projection.changes.pipe(
 *       Stream.take(5),
 *       Stream.runForEach((s) => Effect.log(`State: ${JSON.stringify(s)}`))
 *     )
 *   })
 * )
 * ```
 */
export const makeStateProjection = <S>(
  initial: S
): Effect.Effect<StateProjectionService<S>, never, EventHub | Scope.Scope> =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const stateRef = yield* SubscriptionRef.make(initial)

    // Subscribe to events from EventHub
    const stream = yield* hub.subscribe()

    // Fork fiber that updates state when events arrive
    // The fiber is scoped - cleaned up when caller's scope closes
    yield* stream.pipe(
      Stream.runForEach((event) =>
        Match.value(event).pipe(
          Match.tag("StateIntent", (e: StateIntent) =>
            // Apply state from intent
            // Note: StateIntent includes full state for observer compatibility
            // per ADR-006 backward compatibility with observer.onStateChanged
            SubscriptionRef.set(stateRef, e.state as S)),
          Match.tag("StateCheckpoint", (e: StateCheckpoint) =>
            // Set state directly from checkpoint
            SubscriptionRef.set(stateRef, e.state as S)),
          Match.orElse(() => Effect.void) // Ignore other events
        )
      ),
      Effect.forkScoped
    )

    return {
      get: SubscriptionRef.get(stateRef),
      changes: stateRef.changes
    } satisfies StateProjectionService<S>
  })

// ─────────────────────────────────────────────────────────────────
// Layer Factory
// ─────────────────────────────────────────────────────────────────

/**
 * Create a StateProjection layer with initial state.
 *
 * This layer is scoped - the projection fiber is created when the layer
 * is used and automatically cleaned up when the scope closes.
 *
 * @param initial - Initial state value
 * @returns Layer providing StateProjection service
 *
 * @example
 * ```typescript
 * interface AppState {
 *   count: number
 *   items: string[]
 * }
 *
 * const initialState: AppState = { count: 0, items: [] }
 *
 * const program = Effect.gen(function*() {
 *   const projection = yield* StateProjection
 *   const state = yield* projection.get
 *   console.log(state) // { count: 0, items: [] }
 * })
 *
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(StateProjectionLive(initialState)),
 *     Effect.provide(EventHubLive),
 *     Effect.scoped
 *   )
 * )
 * ```
 */
export const StateProjectionLive = <S>(
  initial: S
): Layer.Layer<StateProjection, never, EventHub | Scope.Scope> =>
  Layer.scoped(StateProjection, makeStateProjection(initial))
