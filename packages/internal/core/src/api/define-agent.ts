/**
 * Declarative agent definition utility.
 *
 * This module provides `defineAgent()` - a higher-level API for creating agents
 * with Zod schema validation that automatically converts to JSON Schema for
 * the harness layer.
 *
 * The key insight: Claude harness ALREADY supports structured outputs via JSON Schema.
 * This utility bridges the gap by:
 * 1. Accepting a Zod schema (developer-friendly, TypeScript-first)
 * 2. Converting to JSON Schema (what the harness needs)
 * 3. Returning a compiled agent ready for use in workflows
 *
 * @example
 * ```ts
 * import { defineAgent } from "@internal/core";
 * import { z } from "zod";
 *
 * const PlanPayload = z.object({
 *   tasks: z.array(z.object({
 *     id: z.string(),
 *     title: z.string(),
 *   })),
 *   milestones: z.array(z.string()),
 * });
 *
 * const plannerAgent = defineAgent({
 *   prompt: "Create a plan from the PRD",
 *   activateOn: ["workflow:start"],
 *   emits: ["plan:created"],
 *   outputSchema: PlanPayload,
 * });
 * ```
 */

import { z } from "zod";
import type { SignalPattern } from "@internal/signals";
import type { Harness } from "@internal/signals-core";
import type { ActivationContext } from "./create-workflow.js";

// ============================================================================
// Zod Type Compatibility
// ============================================================================

/**
 * Zod schema type compatible with both Zod 3 and Zod 4.
 *
 * Zod 4 changed the internal type system significantly:
 * - Zod 3: ZodType<Output, ZodTypeDef, Input>
 * - Zod 4: $ZodType<Output, Input, Internals>
 *
 * For maximum compatibility, we use a minimal interface that works with both.
 * Any Zod schema created with z.object(), z.string(), etc. satisfies this.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod 3/4 compatibility
type ZodSchema<T = any> = {
	/** Zod 4 internal marker */
	_zod?: unknown;
	/** Parse method available on all Zod schemas */
	parse: (data: unknown) => T;
	/** Safe parse method */
	safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown };
};

// ============================================================================
// Types
// ============================================================================

/**
 * JSON Schema representation for structured outputs.
 * This is the format that Claude harness expects.
 */
export type JSONSchema = {
	$schema?: string;
	type?: string;
	properties?: Record<string, JSONSchema>;
	required?: string[];
	items?: JSONSchema;
	additionalProperties?: boolean;
	description?: string;
	[key: string]: unknown;
};

/**
 * Configuration for defining an agent with structured output.
 *
 * @typeParam TOutput - The TypeScript type of the structured output (inferred from outputSchema)
 * @typeParam TState - The workflow state type (for `when` guards)
 */
export type AgentDefinition<
	TOutput = unknown,
	TState = unknown,
> = {
	/**
	 * System prompt that defines the agent's behavior.
	 * Can be a static string or a function that receives the activation context.
	 *
	 * @example Static prompt
	 * ```ts
	 * prompt: "You are a helpful assistant."
	 * ```
	 *
	 * @example Dynamic prompt
	 * ```ts
	 * prompt: (ctx) => `Analyze the following data: ${JSON.stringify(ctx.signal.payload)}`
	 * ```
	 */
	prompt: string | ((ctx: ActivationContext<TState>) => string);

	/**
	 * Signal patterns that trigger this agent.
	 * Uses glob syntax: "workflow:start", "state:*:changed", "trade:**"
	 */
	activateOn: SignalPattern[];

	/**
	 * Signals this agent declares it will emit.
	 * The structured output from outputSchema will be used as the signal payload.
	 */
	emits?: string[];

	/**
	 * Guard condition for activation.
	 * Return true to activate, false to skip.
	 */
	when?: (ctx: ActivationContext<TState>) => boolean;

	/**
	 * Zod schema for the agent's structured output.
	 * This will be converted to JSON Schema and passed to the harness.
	 *
	 * The harness will instruct Claude to respond with JSON matching this schema,
	 * and the response will be validated against it.
	 */
	outputSchema?: ZodSchema<TOutput>;

	/**
	 * Per-agent harness override.
	 */
	signalHarness?: Harness;

	/**
	 * State field to update with agent output.
	 * Simple shorthand for common case where agent output
	 * maps directly to a state field.
	 */
	updates?: keyof TState & string;
};

/**
 * A compiled agent ready for use in workflows.
 *
 * Contains both the original Zod schema (for TypeScript inference)
 * and the compiled JSON Schema (for the harness).
 */
export type CompiledAgent<
	TOutput = unknown,
	TState = unknown,
> = {
	/** Discriminator for type checking */
	readonly _tag: "Agent";

	/** Indicates this agent has reactive capabilities */
	readonly _reactive: true;

	/** The original Zod schema (for TypeScript type inference) */
	readonly zodSchema?: ZodSchema<TOutput>;

	/** The compiled JSON Schema (for the harness) */
	readonly jsonSchema?: JSONSchema;

	/** The agent configuration */
	readonly config: {
		prompt: string | ((ctx: ActivationContext<TState>) => string);
		activateOn: SignalPattern[];
		emits?: string[];
		when?: (ctx: ActivationContext<TState>) => boolean;
		signalHarness?: Harness;
		updates?: keyof TState & string;
	};
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Define an agent with Zod schema for structured outputs.
 *
 * This function creates a compiled agent that:
 * 1. Stores the original Zod schema for TypeScript inference
 * 2. Converts the schema to JSON Schema for the harness
 * 3. Returns an agent compatible with the workflow system
 *
 * The JSON Schema is automatically passed to the harness, which instructs
 * Claude to respond with structured JSON matching the schema.
 *
 * @param definition - Agent definition with Zod schema
 * @returns A compiled agent ready for use in workflows
 *
 * @example
 * ```ts
 * import { defineAgent } from "@internal/core";
 * import { z } from "zod";
 *
 * const TaskSchema = z.object({
 *   id: z.string(),
 *   title: z.string(),
 *   status: z.enum(["pending", "complete"]),
 * });
 *
 * const PlanPayload = z.object({
 *   tasks: z.array(TaskSchema),
 *   milestones: z.array(z.string()),
 * });
 *
 * const planner = defineAgent({
 *   prompt: "Create a plan from the PRD",
 *   activateOn: ["workflow:start"],
 *   emits: ["plan:created"],
 *   outputSchema: PlanPayload,
 * });
 *
 * // Use in workflow
 * const result = await runReactive({
 *   agents: { planner },
 *   state: initialState,
 *   harness: new ClaudeHarness(),
 * });
 * ```
 */
export function defineAgent<
	TOutput = unknown,
	TState = unknown,
>(
	definition: AgentDefinition<TOutput, TState>,
): CompiledAgent<TOutput, TState> {
	// Convert Zod schema to JSON Schema if provided
	// Uses Zod 4's native toJSONSchema() - no external library needed
	let jsonSchema: JSONSchema | undefined;
	if (definition.outputSchema) {
		// Cast to unknown first to satisfy Zod 4's strict internal types
		// Any valid Zod schema will work at runtime
		jsonSchema = z.toJSONSchema(definition.outputSchema as unknown as Parameters<typeof z.toJSONSchema>[0]) as JSONSchema;
	}

	return {
		_tag: "Agent",
		_reactive: true,
		zodSchema: definition.outputSchema,
		jsonSchema,
		config: {
			prompt: definition.prompt,
			activateOn: definition.activateOn,
			emits: definition.emits,
			when: definition.when,
			signalHarness: definition.signalHarness,
			updates: definition.updates,
		},
	};
}
