/**
 * EventLog - Append-only Event Storage
 *
 * Internal module for managing an append-only log of events.
 * Uses Effect Ref for thread-safe, immutable state management.
 *
 * @internal
 * @module @core-v2/event
 */

import { Effect, Ref } from "effect";
import type { AnyEvent, EventId } from "./Event.js";

/**
 * EventLog interface - append-only event storage.
 *
 * @internal
 */
export interface EventLog {
	/** Append an event to the log */
	readonly append: (event: AnyEvent) => Effect.Effect<void>;
	/** Get all events in order */
	readonly events: () => Effect.Effect<readonly AnyEvent[]>;
	/** Get event by ID */
	readonly get: (id: EventId) => Effect.Effect<AnyEvent | undefined>;
	/** Get the number of events */
	readonly length: () => Effect.Effect<number>;
	/** Clear all events (for testing) */
	readonly clear: () => Effect.Effect<void>;
}

/**
 * Creates a new EventLog backed by an Effect Ref.
 *
 * The log is append-only - events cannot be modified or removed
 * (except via clear() for testing purposes).
 *
 * @returns An Effect that produces an EventLog
 *
 * @internal
 */
export function createEventLog(): Effect.Effect<EventLog> {
	return Effect.gen(function* () {
		const ref = yield* Ref.make<readonly AnyEvent[]>([]);

		const eventLog: EventLog = {
			append: (event: AnyEvent) => Ref.update(ref, (events) => [...events, event]),

			events: () => Ref.get(ref),

			get: (id: EventId) =>
				Effect.gen(function* () {
					const events = yield* Ref.get(ref);
					return events.find((e) => e.id === id);
				}),

			length: () =>
				Effect.gen(function* () {
					const events = yield* Ref.get(ref);
					return events.length;
				}),

			clear: () => Ref.set(ref, []),
		};

		return eventLog;
	});
}
