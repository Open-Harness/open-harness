/**
 * API Contract: AnthropicAgentDefinition
 *
 * Plain configuration object returned by defineAnthropicAgent().
 * Must be serializable (no methods, no closures).
 */

import type { z } from "zod";
import type { PromptTemplate } from "./prompt-template";

/**
 * Agent definition - pure configuration object.
 *
 * @template TInput - Input data type (inferred from inputSchema)
 * @template TOutput - Output data type (inferred from outputSchema)
 */
export interface AnthropicAgentDefinition<TInput, TOutput> {
	/**
	 * Agent identifier (e.g., "PlannerAgent", "CodingAgent").
	 * Used for logging and event emission.
	 */
	name: string;

	/**
	 * Prompt template with typed variables.
	 * Variables must match fields in TInput.
	 */
	prompt: PromptTemplate<TInput>;

	/**
	 * Zod schema for validating input before execution.
	 * Throws ZodError if validation fails.
	 */
	inputSchema: z.ZodSchema<TInput>;

	/**
	 * Zod schema for parsing LLM output.
	 * Uses structured output from LLM runner.
	 */
	outputSchema: z.ZodSchema<TOutput>;
}

/**
 * Factory function signature for defining agents.
 *
 * @param config - Agent configuration
 * @returns Plain configuration object (NOT executable yet)
 *
 * @example
 * ```typescript
 * const PlannerAgent = defineAnthropicAgent({
 *   name: "PlannerAgent",
 *   prompt: createPromptTemplate(`Break down: {{prd}}`),
 *   inputSchema: z.object({ prd: z.string() }),
 *   outputSchema: z.object({ tasks: z.array(TaskSchema) }),
 * });
 * // PlannerAgent is now a plain config object
 * ```
 */
export declare function defineAnthropicAgent<TInput, TOutput>(config: {
	name: string;
	prompt: PromptTemplate<TInput>;
	inputSchema: z.ZodSchema<TInput>;
	outputSchema: z.ZodSchema<TOutput>;
}): AnthropicAgentDefinition<TInput, TOutput>;

/**
 * Type guard for checking if value is an agent definition.
 *
 * @param value - Value to check
 * @returns True if value has required agent definition fields
 */
export function isAgentDefinition(value: unknown): value is AnthropicAgentDefinition<any, any> {
	return (
		typeof value === "object" &&
		value !== null &&
		"name" in value &&
		"prompt" in value &&
		"inputSchema" in value &&
		"outputSchema" in value
	);
}
