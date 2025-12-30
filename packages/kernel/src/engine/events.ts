// Engine: Events
// Implements docs/spec/events.md

import { randomUUID } from "node:crypto";
import type {
	BaseEvent,
	EventContext,
	EventFilter,
	EnrichedEvent,
} from "../protocol/events.js";

/**
 * Creates an enriched event envelope.
 */
export function createEnrichedEvent<T extends BaseEvent>(
	event: T,
	context: EventContext,
	override?: Partial<EventContext>,
): EnrichedEvent<T> {
	return {
		id: randomUUID(),
		timestamp: new Date(),
		context: { ...context, ...override },
		event,
	};
}

/**
 * Matches an event type against a filter pattern.
 */
export function matchesFilter(eventType: string, filter: EventFilter): boolean {
	if (filter === "*") return true;
	if (typeof filter === "string") {
		// Simple prefix matching: "agent:*" matches "agent:start", "agent:text", etc.
		if (filter.endsWith("*")) {
			const prefix = filter.slice(0, -1);
			return eventType.startsWith(prefix);
		}
		return eventType === filter;
	}
	if (Array.isArray(filter)) {
		return filter.some((f) => matchesFilter(eventType, f));
	}
	return false;
}
