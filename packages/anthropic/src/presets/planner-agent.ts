/**
 * Planner Agent Preset
 *
 * Pre-configured agent for breaking down PRDs into tasks.
 * Uses the factory API with type-safe prompt template.
 *
 * @example
 * ```typescript
 * import { PlannerAgent } from "@openharness/anthropic/presets";
 *
 * const result = await PlannerAgent.execute({
 *   prd: "Build a todo list app with add, complete, and delete functionality"
 * });
 *
 * for (const task of result.tasks) {
 *   console.log(`${task.id}: ${task.title}`);
 * }
 * ```
 *
 * @module presets/planner-agent
 */

import { defineAnthropicAgent } from "../provider/factory.js";
import { PlannerInputSchema, PlannerOutputSchema, PlannerPromptTemplate } from "./prompts/planner.js";

/**
 * Pre-configured planner agent.
 *
 * Features:
 * - Type-safe input: `{ prd: string }`
 * - Structured output: `{ tasks: PlannerTask[] }`
 * - Dependency-aware task ordering
 */
export const PlannerAgent = defineAnthropicAgent({
	name: "PlannerAgent",
	prompt: PlannerPromptTemplate,
	inputSchema: PlannerInputSchema,
	outputSchema: PlannerOutputSchema,
});

// Re-export types for convenience
export { PlannerInputSchema, PlannerOutputSchema, PlannerPromptTemplate };
export type { PlannerInput, PlannerOutput, PlannerTask } from "../provider/types.js";
