/**
 * Coding Agent Preset
 *
 * Pre-configured agent for coding tasks.
 * Uses the factory API with type-safe prompt template.
 *
 * @example
 * ```typescript
 * import { CodingAgent } from "@openharness/anthropic/presets";
 *
 * const result = await CodingAgent.execute({
 *   task: "Write a function that adds two numbers"
 * });
 *
 * console.log(result.code);
 * ```
 *
 * @module presets/coding-agent
 */

import { defineAnthropicAgent } from "../provider/factory.js";
import { CodingInputSchema, CodingOutputSchema, CodingPromptTemplate } from "./prompts/coding.js";

/**
 * Pre-configured coding agent.
 *
 * Features:
 * - Type-safe input: `{ task: string }`
 * - Structured output: `{ code: string, explanation?: string, language?: string }`
 * - Git commit workflow built into prompt
 */
export const CodingAgent = defineAnthropicAgent({
	name: "CodingAgent",
	prompt: CodingPromptTemplate,
	inputSchema: CodingInputSchema,
	outputSchema: CodingOutputSchema,
});

// Re-export types for convenience
export { CodingInputSchema, CodingOutputSchema, CodingPromptTemplate };
export type { CodingInput, CodingOutput } from "../provider/types.js";
