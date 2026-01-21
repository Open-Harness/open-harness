/**
 * EventBus Service Definition
 *
 * The EventBus provides a pub/sub mechanism for event emission and subscription.
 * This module defines the EventBus service tag and interface for the Effect Layer pattern.
 *
 * @module @core-v2/event
 */

import { Context, Effect, Fiber, Layer, Ref } from "effect";
import type { AnyEvent } from "./Event.js";

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * Unique identifier for a subscription.
 * Used to unsubscribe from events.
 */
export type SubscriptionId = string & { readonly __brand: "SubscriptionId" };

/**
 * Creates a SubscriptionId from a string.
 */
export function makeSubscriptionId(id: string): SubscriptionId {
	return id as SubscriptionId;
}

/**
 * Generates a new unique SubscriptionId.
 */
export function generateSubscriptionId(): SubscriptionId {
	return crypto.randomUUID() as SubscriptionId;
}

/**
 * Event filter function type.
 * Returns true if the event should be delivered to the subscriber.
 */
export type EventFilter = (event: AnyEvent) => boolean;

/**
 * Subscriber callback function type.
 * Called when a matching event is emitted.
 *
 * @remarks
 * The callback returns an Effect that will be forked (run in background).
 * This allows subscribers to perform async operations without blocking
 * the event loop.
 */
export type SubscriberCallback = (event: AnyEvent) => Effect.Effect<void, never, never>;

/**
 * Internal subscription record.
 */
export interface Subscription {
	/** Unique subscription identifier */
	readonly id: SubscriptionId;
	/** Optional filter to match events */
	readonly filter?: EventFilter;
	/** Callback to invoke when event matches */
	readonly callback: SubscriberCallback;
}

// ============================================================================
// EventBus Error
// ============================================================================

/**
 * EventBus error codes for programmatic handling.
 */
export type EventBusErrorCode = "SUBSCRIPTION_NOT_FOUND" | "EMIT_FAILED";

/**
 * EventBus error class with typed error codes.
 * Used as Effect error channel type.
 */
export class EventBusError extends Error {
	readonly _tag = "EventBusError";

	constructor(
		/** Error code for programmatic handling */
		readonly code: EventBusErrorCode,
		/** Human-readable error message */
		message: string,
		/** Original cause if available */
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "EventBusError";
	}
}

// ============================================================================
// EventBus Service Interface (Effect Internal)
// ============================================================================

/**
 * EventBus service interface - defines operations for event pub/sub.
 *
 * @remarks
 * This is the internal Effect service interface. All methods return
 * Effect types. The public API wraps these with Promise-based methods.
 *
 * Operations:
 * - `emit`: Publish an event to all matching subscribers
 * - `subscribe`: Register a callback to receive events
 * - `unsubscribe`: Remove a subscription
 */
export interface EventBusService {
	/**
	 * Emit an event to all subscribers.
	 *
	 * @remarks
	 * Subscribers are notified in parallel via forked fibers.
	 * The emit operation completes when the event has been dispatched,
	 * not when all subscribers have finished processing.
	 *
	 * @param event - The event to emit
	 * @returns Effect that succeeds with void
	 */
	readonly emit: (event: AnyEvent) => Effect.Effect<void>;

	/**
	 * Subscribe to events with an optional filter.
	 *
	 * @param callback - Function to call when matching events occur
	 * @param filter - Optional filter function (if omitted, receives all events)
	 * @returns Effect with the subscription ID for later unsubscription
	 */
	readonly subscribe: (callback: SubscriberCallback, filter?: EventFilter) => Effect.Effect<SubscriptionId>;

	/**
	 * Unsubscribe from events.
	 *
	 * @param subscriptionId - The subscription ID returned from subscribe
	 * @returns Effect that succeeds with void (no-op if not found)
	 */
	readonly unsubscribe: (subscriptionId: SubscriptionId) => Effect.Effect<void>;

	/**
	 * Get the current number of subscriptions.
	 * Useful for testing and monitoring.
	 *
	 * @returns Effect with the subscription count
	 */
	readonly subscriptionCount: () => Effect.Effect<number>;
}

// ============================================================================
// EventBus Context Tag
// ============================================================================

/**
 * EventBus service tag for Effect dependency injection.
 *
 * @example
 * ```typescript
 * // Using the EventBus in an Effect program
 * const program = Effect.gen(function* () {
 *   const eventBus = yield* EventBus;
 *
 *   // Subscribe to events
 *   const subId = yield* eventBus.subscribe((event) =>
 *     Effect.log(`Received: ${event.name}`)
 *   );
 *
 *   // Emit an event
 *   yield* eventBus.emit(createEvent("user:input", { text: "Hello" }));
 *
 *   // Unsubscribe when done
 *   yield* eventBus.unsubscribe(subId);
 * });
 *
 * // Providing the EventBus layer
 * const runnable = program.pipe(Effect.provide(EventBusLive));
 * ```
 */
export class EventBus extends Context.Tag("@core-v2/EventBus")<EventBus, EventBusService>() {}

// ============================================================================
// EventBus Live Implementation
// ============================================================================

/**
 * Creates the live EventBus service using Effect Ref for subscriber storage.
 *
 * @remarks
 * This implementation:
 * - Uses `Ref` for thread-safe subscriber management
 * - Forks subscriber callbacks to avoid blocking the event loop
 * - Supports filtering via optional filter functions
 */
export const makeEventBusService = Effect.gen(function* () {
	// Store subscribers in a Ref (thread-safe mutable reference)
	const subscribersRef = yield* Ref.make<ReadonlyMap<SubscriptionId, Subscription>>(new Map());

	const service: EventBusService = {
		emit: (event: AnyEvent) =>
			Effect.gen(function* () {
				const subscribers = yield* Ref.get(subscribersRef);

				// Find matching subscribers and fork their callbacks
				const fibers: Fiber.Fiber<void, never>[] = [];

				for (const subscription of subscribers.values()) {
					// Check if filter matches (or no filter = match all)
					const matches = subscription.filter ? subscription.filter(event) : true;

					if (matches) {
						// Fork the callback to run in background
						const fiber = yield* Effect.fork(subscription.callback(event));
						fibers.push(fiber);
					}
				}

				// Wait for all subscriber callbacks to complete
				// This ensures emit is "fire and complete" not "fire and forget"
				yield* Fiber.joinAll(fibers);
			}),

		subscribe: (callback: SubscriberCallback, filter?: EventFilter) =>
			Effect.gen(function* () {
				const id = generateSubscriptionId();
				const subscription: Subscription = { id, filter, callback };

				yield* Ref.update(subscribersRef, (subs) => {
					const newSubs = new Map(subs);
					newSubs.set(id, subscription);
					return newSubs;
				});

				return id;
			}),

		unsubscribe: (subscriptionId: SubscriptionId) =>
			Ref.update(subscribersRef, (subs) => {
				const newSubs = new Map(subs);
				newSubs.delete(subscriptionId);
				return newSubs;
			}),

		subscriptionCount: () =>
			Effect.gen(function* () {
				const subscribers = yield* Ref.get(subscribersRef);
				return subscribers.size;
			}),
	};

	return service;
});

/**
 * Live EventBus layer for dependency injection.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const bus = yield* EventBus;
 *   yield* bus.emit(someEvent);
 * });
 *
 * const runnable = program.pipe(Effect.provide(EventBusLive));
 * await Effect.runPromise(runnable);
 * ```
 */
export const EventBusLive = Layer.effect(EventBus, makeEventBusService);

// ============================================================================
// Consumer-Facing EventBus Interface (Promise-based)
// ============================================================================

/**
 * Consumer-facing EventBus interface with Promise-based methods.
 * This is what the public API exposes - no Effect types.
 */
export interface PublicEventBus {
	/**
	 * Emit an event to all subscribers.
	 *
	 * @param event - The event to emit
	 */
	emit(event: AnyEvent): Promise<void>;

	/**
	 * Subscribe to events with an optional filter.
	 *
	 * @param callback - Function to call when matching events occur
	 * @param filter - Optional filter function
	 * @returns Subscription ID for later unsubscription
	 */
	subscribe(callback: (event: AnyEvent) => void | Promise<void>, filter?: EventFilter): Promise<SubscriptionId>;

	/**
	 * Unsubscribe from events.
	 *
	 * @param subscriptionId - The subscription ID returned from subscribe
	 */
	unsubscribe(subscriptionId: SubscriptionId): Promise<void>;

	/**
	 * Get the current number of subscriptions.
	 */
	subscriptionCount(): Promise<number>;
}

// ============================================================================
// Utility: Pattern-based Filter
// ============================================================================

/**
 * Creates an event filter that matches events by name pattern.
 *
 * Supports:
 * - Exact match: `"user:input"` matches only "user:input"
 * - Wildcard suffix: `"error:*"` matches "error:occurred", "error:fatal", etc.
 * - Wildcard prefix: `"*:completed"` matches "task:completed", "agent:completed", etc.
 * - Catch-all: `"*"` matches all events
 *
 * @param pattern - The pattern to match against event names
 * @returns An EventFilter function
 *
 * @example
 * ```typescript
 * const errorFilter = createPatternFilter("error:*");
 * bus.subscribe(callback, errorFilter);
 * ```
 */
export function createPatternFilter(pattern: string): EventFilter {
	// Catch-all
	if (pattern === "*") {
		return () => true;
	}

	// Wildcard suffix: "error:*"
	if (pattern.endsWith(":*")) {
		const prefix = pattern.slice(0, -1); // "error:"
		return (event) => event.name.startsWith(prefix);
	}

	// Wildcard prefix: "*:completed"
	if (pattern.startsWith("*:")) {
		const suffix = pattern.slice(1); // ":completed"
		return (event) => event.name.endsWith(suffix);
	}

	// Exact match
	return (event) => event.name === pattern;
}

/**
 * Creates an event filter from multiple patterns (OR logic).
 *
 * @param patterns - Array of patterns to match
 * @returns An EventFilter that matches if ANY pattern matches
 *
 * @example
 * ```typescript
 * const filter = createMultiPatternFilter(["error:*", "text:complete"]);
 * ```
 */
export function createMultiPatternFilter(patterns: readonly string[]): EventFilter {
	const filters = patterns.map(createPatternFilter);
	return (event) => filters.some((f) => f(event));
}
