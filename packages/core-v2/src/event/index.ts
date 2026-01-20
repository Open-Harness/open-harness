/**
 * Event Module Public API
 *
 * Re-exports event primitives for consumer use.
 * NO @effect/schema internals are exported here.
 *
 * @module @core-v2/event
 */

// Core types and factories
// Built-in event types (interfaces only, no schemas)
export type {
	AgentCompletedEvent,
	AgentStartedEvent,
	AnyEvent,
	ErrorOccurredEvent,
	Event,
	EventDefinition,
	EventId,
	EventPayload,
	TextCompleteEvent,
	TextDeltaEvent,
	ToolCalledEvent,
	ToolResultEvent,
	UserInputEvent,
} from "./Event.js";
export { createEvent, defineEvent } from "./Event.js";
