/**
 * Signal Definition Factory
 *
 * Provides a type-safe way to define reusable signal types with:
 * - Zod schema for payload validation and type inference
 * - Display metadata attached to all created signals
 * - Type-safe create() and is() methods
 *
 * @example
 * ```ts
 * import { defineSignal } from "@internal/signals-core";
 * import { z } from "zod";
 *
 * // Define a signal with schema and display metadata
 * const PlanCreated = defineSignal({
 *   name: "plan:created",
 *   schema: z.object({ taskCount: z.number() }),
 *   display: {
 *     type: "notification",
 *     title: (p) => `Plan created with ${p.taskCount} tasks`,
 *     status: "success",
 *   },
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
import {
	createSignal,
	isSignal,
	type Signal,
	type SignalDisplay,
	type SignalDisplayStatus,
	type SignalDisplayType,
	type SignalSource,
} from "./signal.js";

/**
 * Configuration options for defining a signal
 */
export interface DefineSignalConfig<TPayload, TInput = TPayload> {
	/** Signal name - uses colon-separated namespacing (e.g., "plan:created") */
	readonly name: string;

	/** Zod schema for payload validation and type inference */
	readonly schema: ZodType<TPayload, ZodTypeDef, TInput>;

	/**
	 * Signal metadata - additional categorization for routing/filtering
	 *
	 * Common meta fields:
	 * - level: Log level for log adapters (trace, debug, info, warn, error)
	 * - category: Signal category for filtering (lifecycle, data, error, etc.)
	 */
	readonly meta?: SignalMeta;

	/**
	 * Display configuration for adapters
	 *
	 * Unlike SignalDisplay (which uses `unknown` for variance), this config
	 * uses the actual payload type `TPayload` for better DX when defining signals.
	 */
	readonly display?: SignalDisplayConfig<TPayload>;
}

/**
 * Signal metadata for categorization and routing
 */
export interface SignalMeta {
	/** Log level for log adapters */
	readonly level?: "trace" | "debug" | "info" | "warn" | "error";

	/** Signal category for filtering */
	readonly category?: string;

	/** Additional metadata fields */
	readonly [key: string]: unknown;
}

/**
 * Type-safe display configuration for signal definitions
 *
 * Uses the actual payload type for title/subtitle functions,
 * providing better type inference during signal definition.
 */
export interface SignalDisplayConfig<TPayload> {
	/** Display type determines rendering strategy */
	readonly type?: SignalDisplayType;

	/** Primary display text - can be static string or function of payload */
	readonly title?: string | ((payload: TPayload) => string);

	/** Secondary display text - additional context below title */
	readonly subtitle?: string | ((payload: TPayload) => string);

	/** Icon or emoji for visual identification */
	readonly icon?: string;

	/** Current status for visual styling (colors, animations) */
	readonly status?: SignalDisplayStatus;

	/**
	 * Progress information for progress-type displays
	 * Can be 0-100 percentage or { current, total } for step-based progress
	 */
	readonly progress?: number | { current: number; total: number };

	/**
	 * Whether to append content for stream-type displays
	 * When true, new content is appended rather than replacing
	 */
	readonly append?: boolean;
}

/**
 * Options for creating a signal from a definition
 */
export interface CreateFromDefinitionOptions {
	/** Source tracking for debugging and causality */
	readonly source?: SignalSource;

	/** Override display metadata for this specific signal instance */
	readonly display?: Partial<SignalDisplay>;
}

/**
 * Signal Definition - a factory for creating typed signals
 *
 * Created by defineSignal(), provides:
 * - `create()`: Type-safe signal creation with validation
 * - `is()`: Type guard for matching signals by name
 * - `name`: The signal name for pattern matching
 * - `schema`: The Zod schema for external validation
 * - `meta`: Signal metadata for routing/filtering
 * - `displayConfig`: Display configuration for adapters
 *
 * @typeParam TPayload - The output type after schema parsing/transformation
 * @typeParam TInput - The input type accepted by create() (defaults to TPayload)
 */
export interface SignalDefinition<TPayload, TInput = TPayload> {
	/** Signal name - uses colon-separated namespacing */
	readonly name: string;

	/** Zod schema for payload validation */
	readonly schema: ZodType<TPayload, ZodTypeDef, TInput>;

	/** Signal metadata for categorization */
	readonly meta?: SignalMeta;

	/** Display configuration for adapters */
	readonly displayConfig?: SignalDisplayConfig<TPayload>;

	/**
	 * Create a new signal instance with the given payload
	 *
	 * @param payload - The signal payload (validated against schema)
	 * @param options - Optional source and display overrides
	 * @returns A new Signal<TPayload> with display metadata attached
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
 * Convert typed SignalDisplayConfig to SignalDisplay (with unknown payload)
 *
 * This handles the variance conversion - typed display configs use TPayload
 * but Signal.display uses unknown for variance compatibility.
 */
function convertToSignalDisplay<TPayload>(config: SignalDisplayConfig<TPayload>): SignalDisplay {
	return {
		type: config.type,
		title: config.title as SignalDisplay["title"],
		subtitle: config.subtitle as SignalDisplay["subtitle"],
		icon: config.icon,
		status: config.status,
		progress: config.progress,
		append: config.append,
	};
}

/**
 * Define a reusable signal type with schema validation and display metadata
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
 *   display: {
 *     type: "notification",
 *     title: (p) => `Task ${p.taskId} completed`,
 *     status: "success",
 *   },
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
	const { name, schema, meta, display: displayConfig } = config;

	// Pre-compute the display metadata for attachment to signals
	const baseDisplay = displayConfig ? convertToSignalDisplay(displayConfig) : undefined;

	return {
		name,
		schema,
		meta,
		displayConfig,

		create(payload: TInput, options?: CreateFromDefinitionOptions): Signal<TPayload> {
			// Validate payload against schema
			const validatedPayload = schema.parse(payload);

			// Merge base display with any overrides
			let finalDisplay: SignalDisplay | undefined;
			if (baseDisplay || options?.display) {
				finalDisplay = {
					...baseDisplay,
					...options?.display,
				};
			}

			return createSignal<TPayload>(name, validatedPayload, {
				source: options?.source,
				display: finalDisplay,
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
