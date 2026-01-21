/**
 * HandlerRegistry Service Definition
 *
 * The HandlerRegistry manages handler registration and lookup by event name.
 * This module defines the HandlerRegistry service tag and interface for the
 * Effect Layer pattern.
 *
 * @module @core-v2/handler
 */

import { Context, Effect, Layer, Ref } from "effect";
import type { AnyEvent } from "../event/Event.js";
import type { Handler, HandlerDefinition } from "./Handler.js";

// ============================================================================
// HandlerRegistry Error
// ============================================================================

/**
 * HandlerRegistry error codes for programmatic handling.
 */
export type HandlerRegistryErrorCode = "HANDLER_NOT_FOUND" | "DUPLICATE_HANDLER" | "REGISTRATION_FAILED";

/**
 * HandlerRegistry error class with typed error codes.
 * Used as Effect error channel type.
 */
export class HandlerRegistryError extends Error {
	readonly _tag = "HandlerRegistryError";

	constructor(
		/** Error code for programmatic handling */
		readonly code: HandlerRegistryErrorCode,
		/** Human-readable error message */
		message: string,
		/** Original cause if available */
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "HandlerRegistryError";
	}
}

// ============================================================================
// HandlerRegistry Service Interface (Effect Internal)
// ============================================================================

/**
 * HandlerRegistry service interface - defines operations for handler management.
 *
 * @remarks
 * This is the internal Effect service interface. All methods return
 * Effect types. The public API wraps these with Promise-based methods.
 *
 * Operations:
 * - `register`: Add a handler for an event type
 * - `get`: Retrieve a handler by event name
 * - `has`: Check if a handler exists for an event name
 * - `getAll`: Get all registered handlers (for replay/debugging)
 * - `count`: Get the number of registered handlers
 *
 * @typeParam S - The state type that handlers operate on
 */
export interface HandlerRegistryService<S = unknown> {
	/**
	 * Register a handler for an event type.
	 *
	 * @remarks
	 * Each event name can only have one handler. Attempting to register
	 * a duplicate will fail with DUPLICATE_HANDLER error.
	 *
	 * @param definition - The handler definition including name and handles
	 * @returns Effect that succeeds with void or fails with HandlerRegistryError
	 */
	readonly register: (definition: HandlerDefinition<AnyEvent, S>) => Effect.Effect<void, HandlerRegistryError>;

	/**
	 * Get a handler by event name.
	 *
	 * @param eventName - The event name to look up
	 * @returns Effect with the handler or undefined if not found
	 */
	readonly get: (eventName: string) => Effect.Effect<Handler<AnyEvent, S> | undefined>;

	/**
	 * Check if a handler exists for an event name.
	 *
	 * @param eventName - The event name to check
	 * @returns Effect with true if handler exists, false otherwise
	 */
	readonly has: (eventName: string) => Effect.Effect<boolean>;

	/**
	 * Get all registered handler definitions.
	 *
	 * @remarks
	 * Useful for replay scenarios where we need to apply all handlers
	 * to recompute state.
	 *
	 * @returns Effect with readonly array of all handler definitions
	 */
	readonly getAll: () => Effect.Effect<readonly HandlerDefinition<AnyEvent, S>[]>;

	/**
	 * Get the number of registered handlers.
	 * Useful for testing and monitoring.
	 *
	 * @returns Effect with the handler count
	 */
	readonly count: () => Effect.Effect<number>;
}

// ============================================================================
// HandlerRegistry Context Tag
// ============================================================================

/**
 * HandlerRegistry service tag for Effect dependency injection.
 *
 * @example
 * ```typescript
 * // Using the HandlerRegistry in an Effect program
 * const program = Effect.gen(function* () {
 *   const registry = yield* HandlerRegistry;
 *
 *   // Register a handler
 *   yield* registry.register({
 *     name: "handleUserInput",
 *     handles: "user:input",
 *     handler: (event, state) => ({ state, events: [] }),
 *   });
 *
 *   // Get handler for an event
 *   const handler = yield* registry.get("user:input");
 *   if (handler) {
 *     const result = handler(event, currentState);
 *   }
 * });
 *
 * // Providing the HandlerRegistry layer
 * const runnable = program.pipe(Effect.provide(HandlerRegistryLive));
 * ```
 */
export class HandlerRegistry extends Context.Tag("@core-v2/HandlerRegistry")<
	HandlerRegistry,
	HandlerRegistryService
>() {}

// ============================================================================
// HandlerRegistry Live Implementation
// ============================================================================

/**
 * Internal storage type for handler registry.
 * Maps event names to handler definitions.
 */
type HandlerStore<S> = ReadonlyMap<string, HandlerDefinition<AnyEvent, S>>;

/**
 * Creates the live HandlerRegistry service using Effect Ref for handler storage.
 *
 * @remarks
 * This implementation:
 * - Uses `Ref` for thread-safe handler management
 * - Enforces single handler per event type
 * - Provides fast O(1) lookup by event name
 */
export const makeHandlerRegistryService = <S>() =>
	Effect.gen(function* () {
		// Store handlers in a Ref (thread-safe mutable reference)
		const handlersRef = yield* Ref.make<HandlerStore<S>>(new Map());

		const service: HandlerRegistryService<S> = {
			register: (definition: HandlerDefinition<AnyEvent, S>) =>
				Effect.gen(function* () {
					const handlers = yield* Ref.get(handlersRef);

					// Check for duplicate
					if (handlers.has(definition.handles)) {
						const existing = handlers.get(definition.handles);
						return yield* Effect.fail(
							new HandlerRegistryError(
								"DUPLICATE_HANDLER",
								`Handler for event "${definition.handles}" already registered as "${existing?.name}". Cannot register "${definition.name}".`,
							),
						);
					}

					// Add the handler
					yield* Ref.update(handlersRef, (current) => {
						const newHandlers = new Map(current);
						newHandlers.set(definition.handles, definition);
						return newHandlers;
					});
				}),

			get: (eventName: string) =>
				Effect.gen(function* () {
					const handlers = yield* Ref.get(handlersRef);
					const definition = handlers.get(eventName);
					return definition?.handler;
				}),

			has: (eventName: string) =>
				Effect.gen(function* () {
					const handlers = yield* Ref.get(handlersRef);
					return handlers.has(eventName);
				}),

			getAll: () =>
				Effect.gen(function* () {
					const handlers = yield* Ref.get(handlersRef);
					return Array.from(handlers.values());
				}),

			count: () =>
				Effect.gen(function* () {
					const handlers = yield* Ref.get(handlersRef);
					return handlers.size;
				}),
		};

		return service;
	});

/**
 * Live HandlerRegistry layer for dependency injection.
 *
 * @remarks
 * Creates a registry with unknown state type. For type-safe state,
 * use makeHandlerRegistryService<YourState>() directly.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const registry = yield* HandlerRegistry;
 *   yield* registry.register(myHandlerDefinition);
 * });
 *
 * const runnable = program.pipe(Effect.provide(HandlerRegistryLive));
 * await Effect.runPromise(runnable);
 * ```
 */
export const HandlerRegistryLive = Layer.effect(HandlerRegistry, makeHandlerRegistryService());

// ============================================================================
// Consumer-Facing HandlerRegistry Interface (Promise-based)
// ============================================================================

/**
 * Consumer-facing HandlerRegistry interface with Promise-based methods.
 * This is what the public API exposes - no Effect types.
 *
 * @typeParam S - The state type that handlers operate on
 */
export interface PublicHandlerRegistry<S = unknown> {
	/**
	 * Register a handler for an event type.
	 *
	 * @param definition - The handler definition
	 * @throws HandlerRegistryError if duplicate handler exists
	 */
	register(definition: HandlerDefinition<AnyEvent, S>): Promise<void>;

	/**
	 * Get a handler by event name.
	 *
	 * @param eventName - The event name to look up
	 * @returns The handler or undefined if not found
	 */
	get(eventName: string): Promise<Handler<AnyEvent, S> | undefined>;

	/**
	 * Check if a handler exists for an event name.
	 *
	 * @param eventName - The event name to check
	 * @returns True if handler exists
	 */
	has(eventName: string): Promise<boolean>;

	/**
	 * Get all registered handler definitions.
	 *
	 * @returns Array of all handler definitions
	 */
	getAll(): Promise<readonly HandlerDefinition<AnyEvent, S>[]>;

	/**
	 * Get the number of registered handlers.
	 */
	count(): Promise<number>;
}
