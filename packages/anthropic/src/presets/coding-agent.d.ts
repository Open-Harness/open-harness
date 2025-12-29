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
import { CodingInputSchema, CodingOutputSchema, CodingPromptTemplate } from "./prompts/coding.js";
/**
 * Pre-configured coding agent.
 *
 * Features:
 * - Type-safe input: `{ task: string }`
 * - Structured output: `{ code: string, explanation?: string, language?: string }`
 * - Git commit workflow built into prompt
 */
export declare const CodingAgent: import("../index.js").AnthropicAgent<{
    task: string;
}, {
    code: string;
    explanation?: string | undefined;
    language?: string | undefined;
}>;
export { CodingInputSchema, CodingOutputSchema, CodingPromptTemplate };
export type { CodingInput, CodingOutput } from "../provider/types.js";
