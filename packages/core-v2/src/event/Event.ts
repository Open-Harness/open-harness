/**
 * Event Primitives
 *
 * This module defines the core Event types, schemas, and factories for the
 * event-sourced workflow system. Events are immutable facts representing
 * something that happened.
 *
 * @module @core-v2/event
 */

import { Schema } from "effect";

// ============================================================================
// Event ID
// ============================================================================

/**
 * EventId branded type - a UUID v4 string with compile-time branding.
 * Uses @effect/schema for validation and branding.
 */
export const EventIdSchema = Schema.UUID.pipe(Schema.brand("EventId"));

/**
 * EventId type - unique identifier for events.
 * Branded string at compile time, plain string at runtime for consumers.
 */
export type EventId = typeof EventIdSchema.Type;

// ============================================================================
// Timestamp
// ============================================================================

/**
 * Timestamp schema - Date parsed from ISO string.
 */
export const TimestampSchema = Schema.DateFromString;

// ============================================================================
// Event Schema Factory
// ============================================================================

/**
 * Creates a typed Event schema for a specific event type.
 *
 * @param name - The literal event name (e.g., "user:input")
 * @param payloadSchema - Schema for the event payload
 * @returns An Effect Schema for the complete event structure
 *
 * @example
 * ```typescript
 * const UserInputSchema = EventSchema("user:input", Schema.Struct({
 *   text: Schema.String,
 *   sessionId: Schema.optional(Schema.String),
 * }));
 * ```
 */
export const EventSchema = <Name extends string, P extends Schema.Schema.Any>(name: Name, payloadSchema: P) =>
	Schema.Struct({
		id: EventIdSchema,
		name: Schema.Literal(name),
		payload: payloadSchema,
		timestamp: TimestampSchema,
		causedBy: Schema.optional(EventIdSchema),
	});

// ============================================================================
// Event Interface (Consumer-facing)
// ============================================================================

/**
 * Base Event interface - all events extend this.
 *
 * Events are immutable facts representing something that happened.
 * The `name` field uses convention:
 * - Past tense for facts: `task:completed`, `agent:started`
 * - Present tense for streaming: `text:delta`
 */
export interface Event<Name extends string = string, Payload = unknown> {
	/** Unique event identifier (UUID v4) */
	readonly id: EventId;
	/** Event type name (e.g., "user:input", "text:delta") */
	readonly name: Name;
	/** Event-specific payload data */
	readonly payload: Payload;
	/** When the event occurred */
	readonly timestamp: Date;
	/** ID of the event that caused this one (for causality tracking) */
	readonly causedBy?: EventId;
}

/**
 * Helper type to extract payload type from an event.
 */
export type EventPayload<E extends Event> = E["payload"];

/**
 * Generic event with unknown payload (for collections and runtime handling).
 */
export type AnyEvent = Event<string, unknown>;

// ============================================================================
// Event Factory
// ============================================================================

/**
 * Creates a new event with a generated ID and timestamp.
 *
 * @param name - The event type name
 * @param payload - The event payload data
 * @param causedBy - Optional ID of the event that caused this one
 * @returns A new immutable Event
 *
 * @example
 * ```typescript
 * const event = createEvent("user:input", { text: "Hello" });
 * // { id: "550e8400-...", name: "user:input", payload: { text: "Hello" }, timestamp: Date }
 * ```
 */
export function createEvent<Name extends string, Payload>(
	name: Name,
	payload: Payload,
	causedBy?: EventId,
): Event<Name, Payload> {
	return {
		id: crypto.randomUUID() as EventId,
		name,
		payload,
		timestamp: new Date(),
		causedBy,
	};
}

// ============================================================================
// Built-in Event Types - Schemas
// ============================================================================

/**
 * User input event schema - represents user-provided text input.
 */
export const UserInputEventSchema = EventSchema(
	"user:input",
	Schema.Struct({
		text: Schema.String,
		sessionId: Schema.optional(Schema.String),
	}),
);

/**
 * User input event type.
 */
export interface UserInputEvent
	extends Event<
		"user:input",
		{
			readonly text: string;
			readonly sessionId?: string;
		}
	> {}

/**
 * Text streaming delta schema - a chunk of streaming text from an agent.
 */
export const TextDeltaEventSchema = EventSchema(
	"text:delta",
	Schema.Struct({
		delta: Schema.String,
		agentName: Schema.optional(Schema.String),
	}),
);

/**
 * Text delta event type.
 */
export interface TextDeltaEvent
	extends Event<
		"text:delta",
		{
			readonly delta: string;
			readonly agentName?: string;
		}
	> {}

/**
 * Text stream complete schema - signals end of a text stream.
 */
export const TextCompleteEventSchema = EventSchema(
	"text:complete",
	Schema.Struct({
		fullText: Schema.String,
		agentName: Schema.optional(Schema.String),
	}),
);

/**
 * Text complete event type.
 */
export interface TextCompleteEvent
	extends Event<
		"text:complete",
		{
			readonly fullText: string;
			readonly agentName?: string;
		}
	> {}

/**
 * Agent started schema - an AI agent has begun processing.
 */
export const AgentStartedEventSchema = EventSchema(
	"agent:started",
	Schema.Struct({
		agentName: Schema.String,
		reason: Schema.optional(Schema.String),
	}),
);

/**
 * Agent started event type.
 */
export interface AgentStartedEvent
	extends Event<
		"agent:started",
		{
			readonly agentName: string;
			readonly reason?: string;
		}
	> {}

/**
 * Agent completed schema - an AI agent has finished processing.
 */
export const AgentCompletedEventSchema = EventSchema(
	"agent:completed",
	Schema.Struct({
		agentName: Schema.String,
		outcome: Schema.Literal("success", "failure", "interrupted"),
	}),
);

/**
 * Agent completed event type.
 */
export interface AgentCompletedEvent
	extends Event<
		"agent:completed",
		{
			readonly agentName: string;
			readonly outcome: "success" | "failure" | "interrupted";
		}
	> {}

/**
 * Tool called schema - an agent has invoked a tool.
 */
export const ToolCalledEventSchema = EventSchema(
	"tool:called",
	Schema.Struct({
		toolName: Schema.String,
		toolId: Schema.String,
		input: Schema.Unknown,
	}),
);

/**
 * Tool called event type.
 */
export interface ToolCalledEvent
	extends Event<
		"tool:called",
		{
			readonly toolName: string;
			readonly toolId: string;
			readonly input: unknown;
		}
	> {}

/**
 * Tool result schema - the result of a tool invocation.
 */
export const ToolResultEventSchema = EventSchema(
	"tool:result",
	Schema.Struct({
		toolId: Schema.String,
		output: Schema.Unknown,
		isError: Schema.Boolean,
	}),
);

/**
 * Tool result event type.
 */
export interface ToolResultEvent
	extends Event<
		"tool:result",
		{
			readonly toolId: string;
			readonly output: unknown;
			readonly isError: boolean;
		}
	> {}

/**
 * Error occurred schema - an error happened during execution.
 */
export const ErrorOccurredEventSchema = EventSchema(
	"error:occurred",
	Schema.Struct({
		code: Schema.String,
		message: Schema.String,
		recoverable: Schema.Boolean,
		context: Schema.optional(Schema.Unknown),
	}),
);

/**
 * Error occurred event type.
 */
export interface ErrorOccurredEvent
	extends Event<
		"error:occurred",
		{
			readonly code: string;
			readonly message: string;
			readonly recoverable: boolean;
			readonly context?: unknown;
		}
	> {}

// ============================================================================
// Event Definition Factory (Developer Experience)
// ============================================================================

/**
 * Event definition - returned by defineEvent factory.
 * Provides type-safe create() and is() methods for working with events.
 */
export interface EventDefinition<Name extends string, Payload> {
	/** The event type name */
	readonly name: Name;
	/** Create a new event of this type */
	create: (payload: Payload, causedBy?: EventId) => Event<Name, Payload>;
	/** Type guard to check if an event is of this type */
	is: (event: AnyEvent) => event is Event<Name, Payload>;
}

/**
 * Defines a custom event type with type-safe factories.
 *
 * Note: This factory uses the event name and runtime type checking.
 * For schema validation during decoding, use the EventSchema directly.
 *
 * @param name - The event type name (e.g., "task:completed")
 * @returns An EventDefinition with create() and is() methods
 *
 * @example
 * ```typescript
 * const TaskCompleted = defineEvent<"task:completed", { taskId: string }>("task:completed");
 *
 * const event = TaskCompleted.create({ taskId: "123" });
 * if (TaskCompleted.is(someEvent)) {
 *   console.log(someEvent.payload.taskId);
 * }
 * ```
 */
export function defineEvent<Name extends string, Payload>(name: Name): EventDefinition<Name, Payload> {
	return {
		name,
		create: (payload: Payload, causedBy?: EventId) => createEvent(name, payload, causedBy),
		is: (event: AnyEvent): event is Event<Name, Payload> => event.name === name,
	};
}
