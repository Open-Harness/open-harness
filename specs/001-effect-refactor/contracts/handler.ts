/**
 * Handler Contracts - Public API Types
 *
 * These interfaces define the public API surface for Handlers.
 * Handlers are pure functions that react to events.
 *
 * @module @core-v2/handler
 */

import type { Event, AnyEvent } from "./event";

/**
 * Result returned by a handler after processing an event.
 *
 * @typeParam S - The state type
 */
export interface HandlerResult<S> {
  /** The new state after processing the event */
  readonly state: S;
  /** Zero or more events to emit as a result */
  readonly events: readonly AnyEvent[];
}

/**
 * A pure handler function signature.
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
export type Handler<E extends Event, S> = (
  event: E,
  state: S
) => HandlerResult<S>;

/**
 * Handler definition with metadata for registration.
 *
 * @typeParam E - The event type this handler processes
 * @typeParam S - The state type
 */
export interface HandlerDefinition<
  E extends Event = AnyEvent,
  S = unknown,
> {
  /** Unique name for this handler */
  readonly name: string;
  /** The event name this handler processes */
  readonly handles: E["name"];
  /** The handler function */
  readonly handler: Handler<E, S>;
}

/**
 * Handler registry - maps event names to handlers.
 *
 * @typeParam S - The state type
 */
export type HandlerRegistry<S> = ReadonlyMap<string, Handler<AnyEvent, S>>;

// ============================================================================
// Handler Factory Types
// ============================================================================

/**
 * Options for `defineHandler()` factory function.
 */
export interface DefineHandlerOptions<E extends Event, S> {
  /** Unique handler name */
  readonly name: string;
  /** The handler function */
  readonly handler: Handler<E, S>;
}
