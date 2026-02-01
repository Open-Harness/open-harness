/**
 * EventHub service - PubSub-backed event emission for workflow events.
 *
 * Per ADR-004: Single source of event emission using Effect PubSub.
 * All workflow events flow through EventHub, which broadcasts to subscribers
 * (EventStore, EventBus, Observer) running in separate fibers.
 *
 * @module
 */

import { Context, Effect, Layer, PubSub, Stream } from "effect"
import type { Scope } from "effect"

import type { WorkflowEvent } from "../Domain/Events.js"

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface EventHubService {
  /**
   * Publish event to all subscribers.
   *
   * This is the SINGLE emission point for all workflow events.
   * Events are broadcast to all active subscriptions.
   */
  readonly publish: (event: WorkflowEvent) => Effect.Effect<void>

  /**
   * Create a subscription to receive events.
   *
   * Returns a Stream that emits all events published to the hub.
   * The subscription is scoped - it will be cleaned up when the
   * caller's scope closes.
   *
   * @returns Stream of workflow events
   */
  readonly subscribe: () => Effect.Effect<
    Stream.Stream<WorkflowEvent>,
    never,
    Scope.Scope
  >
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

export class EventHub extends Context.Tag("@open-harness/EventHub")<
  EventHub,
  EventHubService
>() {}

// ─────────────────────────────────────────────────────────────────
// Live Implementation
// ─────────────────────────────────────────────────────────────────

/**
 * Create an EventHub backed by an unbounded PubSub.
 *
 * The PubSub is created fresh and scoped to the caller's scope.
 * When the scope closes, all subscriptions are automatically cleaned up.
 */
export const makeEventHub = Effect.gen(function*() {
  const pubsub = yield* PubSub.unbounded<WorkflowEvent>()

  return EventHub.of({
    publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),

    subscribe: () =>
      Effect.gen(function*() {
        const subscription = yield* PubSub.subscribe(pubsub)
        return Stream.fromQueue(subscription)
      })
  })
})

/**
 * EventHub layer backed by an unbounded PubSub.
 *
 * This layer is scoped - the PubSub is created when the layer is used
 * and automatically cleaned up when the scope closes.
 *
 * @example
 * ```typescript
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const hub = yield* EventHub
 *
 *     // Fork a subscriber fiber
 *     yield* Effect.forkScoped(
 *       Effect.gen(function*() {
 *         const stream = yield* hub.subscribe()
 *         yield* stream.pipe(
 *           Stream.runForEach((event) =>
 *             Effect.log(`Received: ${event._tag}`)
 *           )
 *         )
 *       })
 *     )
 *
 *     // Publish events
 *     yield* hub.publish(new WorkflowStarted({ ... }))
 *   })
 * )
 *
 * Effect.runPromise(program.pipe(Effect.provide(EventHubLive)))
 * ```
 */
export const EventHubLive: Layer.Layer<EventHub, never, Scope.Scope> = Layer.scoped(
  EventHub,
  makeEventHub
)
