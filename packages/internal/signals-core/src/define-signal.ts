/**
 * Signal Definition Factory
 *
 * Provides a type-safe way to define reusable signal types with:
 * - Zod schema for payload validation and type inference
 * - Type-safe create() and is() methods
 *
 * Signals are pure data structures. Display/rendering is handled by adapters
 * via renderer maps, not by the signals themselves.
 *
 * @example
 * ```ts
 * import { defineSignal } from "@internal/signals-core";
 * import { z } from "zod";
 *
 * // Define a signal with schema
 * const PlanCreated = defineSignal({
 *   name: "plan:created",
 *   schema: z.object({ taskCount: z.number() }),
 * });
 *
 * // Create signals with type-safe payloads
 * const signal = PlanCreated.create({ taskCount: 5 });
 *
 * // Type guard for signal matching
 * if (PlanCreated.is(someSignal)) {
 *   console.log(someSignal.payload.taskCount); // TypeScript knows the type
 * }
 * ```
 */

import type { ZodType, ZodTypeDef } from "zod";
import { createSignal, isSignal, type Signal, type SignalSource } from "./signal.js";

/**
 * Configuration options for defining a signal
 */
export interface DefineSignalConfig<TPayload, TInput = TPayload> {
	/** Signal name - uses colon-separated namespacing (e.g., "plan:created") */
	readonly name: string;

	/** Zod schema for payload validation and type inference */
	readonly schema: ZodType<TPayload, ZodTypeDef, TInput>;
}

/**
 * Options for creating a signal from a definition
 */
export interface CreateFromDefinitionOptions {
	/** Source tracking for debugging and causality */
	readonly source?: SignalSource;
}

/**
 * Signal Definition - a factory for creating typed signals
 *
 * Created by defineSignal(), provides:
 * - `create()`: Type-safe signal creation with validation
 * - `is()`: Type guard for matching signals by name
 * - `name`: The signal name for pattern matching
 * - `schema`: The Zod schema for external validation
 *
 * @typeParam TPayload - The output type after schema parsing/transformation
 * @typeParam TInput - The input type accepted by create() (defaults to TPayload)
 */
export interface SignalDefinition<TPayload, TInput = TPayload> {
	/** Signal name - uses colon-separated namespacing */
	readonly name: string;

	/** Zod schema for payload validation */
	readonly schema: ZodType<TPayload, ZodTypeDef, TInput>;

	/**
	 * Create a new signal instance with the given payload
	 *
	 * @param payload - The signal payload (validated against schema)
	 * @param options - Optional source tracking
	 * @returns A new Signal<TPayload>
	 *
	 * @throws {z.ZodError} If payload validation fails
	 */
	create(payload: TInput, options?: CreateFromDefinitionOptions): Signal<TPayload>;

	/**
	 * Type guard to check if a signal matches this definition
	 *
	 * Checks signal name and optionally validates payload.
	 * If validation is skipped, the caller is responsible for ensuring
	 * the payload conforms to the expected type.
	 *
	 * @param signal - The signal to check
	 * @param validatePayload - Whether to validate payload against schema (default: false)
	 * @returns True if signal matches this definition
	 */
	is(signal: unknown, validatePayload?: boolean): signal is Signal<TPayload>;
}

/**
 * Define a reusable signal type with schema validation
 *
 * Signals are pure data structures. Display/rendering is handled by adapters
 * via renderer maps, not by the signals themselves.
 *
 * @param config - Signal definition configuration
 * @returns A SignalDefinition with create() and is() methods
 *
 * @example
 * ```ts
 * // Simple signal with schema
 * const TaskComplete = defineSignal({
 *   name: "task:complete",
 *   schema: z.object({
 *     taskId: z.string(),
 *     outcome: z.enum(["success", "error", "skipped"]),
 *   }),
 * });
 *
 * // Create a signal - TypeScript enforces payload type
 * const sig = TaskComplete.create({
 *   taskId: "T-001",
 *   outcome: "success",
 * });
 *
 * // Type guard in handlers
 * function handleSignal(signal: Signal) {
 *   if (TaskComplete.is(signal)) {
 *     // TypeScript knows signal.payload has taskId and outcome
 *     console.log(signal.payload.taskId);
 *   }
 * }
 * ```
 */
export function defineSignal<TPayload, TInput = TPayload>(
	config: DefineSignalConfig<TPayload, TInput>,
): SignalDefinition<TPayload, TInput> {
	const { name, schema } = config;

	return {
		name,
		schema,

		create(payload: TInput, options?: CreateFromDefinitionOptions): Signal<TPayload> {
			// Validate payload against schema
			const validatedPayload = schema.parse(payload);

			return createSignal<TPayload>(name, validatedPayload, {
				source: options?.source,
			});
		},

		is(signal: unknown, validatePayload = false): signal is Signal<TPayload> {
			// First check if it's a valid signal
			if (!isSignal(signal)) {
				return false;
			}

			// Check name match
			if (signal.name !== name) {
				return false;
			}

			// Optionally validate payload
			if (validatePayload) {
				const result = schema.safeParse(signal.payload);
				return result.success;
			}

			return true;
		},
	};
}
