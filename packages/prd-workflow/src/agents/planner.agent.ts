/**
 * Planner Agent - Extracts structured plan from PRD
 *
 * This agent analyzes a Product Requirements Document (PRD) and emits
 * a structured plan with tasks, milestones, and execution order.
 *
 * Uses the defineAgent utility for Zod → JSON Schema conversion,
 * enabling Claude's structured output feature for type-safe responses.
 *
 * @example
 * ```ts
 * import { plannerAgent } from "./agents/planner.agent.js";
 *
 * const result = await runPRDWorkflow({
 *   prd: prdContent,
 *   agents: { planner: plannerAgent },
 *   harness,
 * });
 * ```
 */

import { defineAgent } from "@internal/core";
import { PlanCreatedPayloadSchema } from "../schemas/index.js";
import type { PRDWorkflowState } from "../types.js";

/**
 * The planner agent extracts a structured plan from a PRD.
 *
 * Activation: "workflow:start"
 * Emits: "plan:created" with PlanCreatedPayload
 *
 * The agent uses Claude's structured output to guarantee the response
 * matches the PlanCreatedPayloadSchema, eliminating parsing errors.
 */
export const plannerAgent = defineAgent<typeof PlanCreatedPayloadSchema._output, PRDWorkflowState>({
	prompt: (ctx) => `You are analyzing a Product Requirements Document (PRD) for implementation.

PRD Content:
${ctx.state.planning.prd}

Your task:
1. Extract ALL tasks mentioned in the PRD as discrete, implementable units
2. Group related tasks into milestones
3. Determine the optimal execution order based on dependencies

For each task, provide:
- A unique ID (e.g., "task-1", "task-2")
- A short, descriptive title
- A detailed description of what needs to be done
- Clear definition of done criteria (checkable items)
- The milestone ID it belongs to

For each milestone, provide:
- A unique ID (e.g., "milestone-1", "milestone-2")
- A short, descriptive title
- The IDs of tasks belonging to this milestone (in order)
- Optionally, a test command to verify milestone completion

Return the complete taskOrder array with all task IDs in execution order.

Be thorough and extract every actionable item from the PRD.`,

	activateOn: ["workflow:start"],

	emits: ["plan:created"],

	outputSchema: PlanCreatedPayloadSchema,

	when: (ctx) => ctx.state.planning.phase === "idle",
});
