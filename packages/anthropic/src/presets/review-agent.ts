/**
 * Review Agent Preset
 *
 * Pre-configured agent for code review tasks.
 * Uses the factory API with type-safe prompt template.
 *
 * @example
 * ```typescript
 * import { ReviewAgent } from "@openharness/anthropic/presets";
 *
 * const result = await ReviewAgent.execute({
 *   task: "Write a function that adds two numbers",
 *   implementationSummary: "Created add() function. commit:abc123..."
 * });
 *
 * console.log(result.approved);
 * console.log(result.issues);
 * ```
 *
 * @module presets/review-agent
 */

import { defineAnthropicAgent } from "../provider/factory.js";
import { ReviewInputSchema, ReviewOutputSchema, ReviewPromptTemplate } from "./prompts/review.js";

/**
 * Pre-configured review agent.
 *
 * Features:
 * - Type-safe input: `{ task: string, implementationSummary: string }`
 * - Structured output: `{ approved: boolean, issues: ReviewIssue[], suggestions?: string[] }`
 * - Inspects actual git commits for review
 */
export const ReviewAgent = defineAnthropicAgent({
	name: "ReviewAgent",
	prompt: ReviewPromptTemplate,
	inputSchema: ReviewInputSchema,
	outputSchema: ReviewOutputSchema,
});

// Re-export types for convenience
export { ReviewInputSchema, ReviewOutputSchema, ReviewPromptTemplate };
export type { ReviewInput, ReviewIssue, ReviewOutput } from "../provider/types.js";
