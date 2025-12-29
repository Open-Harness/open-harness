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
import { PlannerInputSchema, PlannerOutputSchema, PlannerPromptTemplate } from "./prompts/planner.js";
/**
 * Pre-configured planner agent.
 *
 * Features:
 * - Type-safe input: `{ prd: string }`
 * - Structured output: `{ tasks: PlannerTask[] }`
 * - Dependency-aware task ordering
 */
export declare const PlannerAgent: import("../index.js").AnthropicAgent<{
    prd: string;
}, {
    tasks: {
        id: string;
        title: string;
        description: string;
        dependencies: string[];
    }[];
}>;
export { PlannerInputSchema, PlannerOutputSchema, PlannerPromptTemplate };
export type { PlannerInput, PlannerOutput, PlannerTask } from "../provider/types.js";
