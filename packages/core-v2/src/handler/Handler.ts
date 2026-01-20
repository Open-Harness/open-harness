/**
 * Handler System
 *
 * Handlers are pure functions that react to events and produce new state plus
 * optionally emit new events. They are the core building blocks of the
 * event-sourced workflow system.
 *
 * Key requirements (per spec FR-009 to FR-011):
 * - Handlers MUST be pure functions: (event, state) → { state, events[] }
 * - Handlers MUST NOT perform I/O, call APIs, or access anything outside inputs
 * - Handlers MUST be deterministic—same inputs always produce same outputs
 *
 * @module @core-v2/handler
 */

import type { AnyEvent, Event, EventDefinition, EventId } from "../event/index.js";

// ============================================================================
// Handler Result
// ============================================================================

/**
 * Result returned by a handler after processing an event.
 *
 * @typeParam S - The state type
 */
export interface HandlerResult<S> {
	/** The new state after processing the event */
	readonly state: S;
	/** Zero or more events to emit as a result of processing */
	readonly events: readonly AnyEvent[];
}

// ============================================================================
// Handler Function Type
// ============================================================================

/**
 * A pure handler function signature.
 *
 * Handlers are the fundamental building blocks of the event-sourced system.
 * They take an event and the current state, and return a new state plus any
 * events to emit.
 *
 * @remarks
 * Handlers MUST be:
 * - **Pure**: No side effects, no I/O, no API calls
 * - **Deterministic**: Same inputs always produce same outputs
 * - **Synchronous**: Return immediately (no async)
 *
 * @typeParam E - The event type this handler processes
 * @typeParam S - The state type
 *
 * @example
 * ```typescript
 * const handleUserInput: Handler<UserInputEvent, ChatState> = (event, state) => ({
 *   state: {
 *     ...state,
 *     messages: [...state.messages, { role: "user", content: event.payload.text }],
 *   },
 *   events: [],
 * });
 * ```
 */
export type Handler<E extends Event, S> = (event: E, state: S) => HandlerResult<S>;

// ============================================================================
// Handler Definition
// ============================================================================

/**
 * Handler definition with metadata for registration.
 *
 * This is the complete handler package including the handler function and
 * metadata needed for the workflow runtime to route events correctly.
 *
 * @typeParam E - The event type this handler processes
 * @typeParam S - The state type
 */
export interface HandlerDefinition<E extends Event = AnyEvent, S = unknown> {
	/** Unique name for this handler */
	readonly name: string;
	/** The event name this handler processes */
	readonly handles: E["name"];
	/** The handler function */
	readonly handler: Handler<E, S>;
}

// ============================================================================
// DefineHandler Factory Options
// ============================================================================

/**
 * Options for the defineHandler factory function.
 *
 * @typeParam E - The event type
 * @typeParam S - The state type
 */
export interface DefineHandlerOptions<E extends Event, S> {
	/** Unique handler name */
	readonly name: string;
	/** The handler function */
	readonly handler: Handler<E, S>;
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Creates a handler definition for a specific event type.
 *
 * This factory provides type safety by linking the handler to an EventDefinition,
 * ensuring the handler receives the correct event type.
 *
 * @param eventDef - The event definition this handler responds to
 * @param options - Handler options including name and handler function
 * @returns A HandlerDefinition ready for registration
 *
 * @example
 * ```typescript
 * const UserInput = defineEvent<"user:input", { text: string }>("user:input");
 *
 * const userInputHandler = defineHandler(UserInput, {
 *   name: "handleUserInput",
 *   handler: (event, state) => ({
 *     state: { ...state, lastInput: event.payload.text },
 *     events: [],
 *   }),
 * });
 * ```
 */
export function defineHandler<Name extends string, Payload, S>(
	eventDef: EventDefinition<Name, Payload>,
	options: DefineHandlerOptions<Event<Name, Payload>, S>,
): HandlerDefinition<Event<Name, Payload>, S> {
	return {
		name: options.name,
		handles: eventDef.name,
		handler: options.handler,
	};
}

// ============================================================================
// Handler Utilities
// ============================================================================

/**
 * Creates a handler result with no emitted events.
 *
 * Convenience function for handlers that only update state without
 * emitting new events.
 *
 * @param state - The new state
 * @returns A HandlerResult with empty events array
 *
 * @example
 * ```typescript
 * const handler: Handler<SomeEvent, State> = (event, state) =>
 *   stateOnly({ ...state, count: state.count + 1 });
 * ```
 */
export function stateOnly<S>(state: S): HandlerResult<S> {
	return { state, events: [] };
}

/**
 * Creates a handler result with state and emitted events.
 *
 * @param state - The new state
 * @param events - Events to emit
 * @returns A HandlerResult with state and events
 *
 * @example
 * ```typescript
 * const handler: Handler<SomeEvent, State> = (event, state) =>
 *   emit({ ...state, processed: true }, [
 *     { name: "processing:complete", payload: { success: true } }
 *   ]);
 * ```
 */
export function emit<S>(state: S, events: readonly AnyEvent[]): HandlerResult<S> {
	return { state, events };
}

/**
 * Creates a new event to be emitted by a handler.
 *
 * This is a convenience wrapper for creating events within handler code.
 * It generates a unique ID and timestamp for the new event.
 *
 * @param name - The event name
 * @param payload - The event payload
 * @param causedBy - Optional ID of the event that triggered this emission
 * @returns A new event ready to be included in HandlerResult.events
 *
 * @example
 * ```typescript
 * const handler: Handler<InputEvent, State> = (event, state) => ({
 *   state: { ...state, processed: true },
 *   events: [
 *     emitEvent("input:processed", { originalId: event.id }, event.id),
 *   ],
 * });
 * ```
 */
export function emitEvent<Name extends string, Payload>(
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
