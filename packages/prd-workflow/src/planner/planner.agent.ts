/**
 * Planner Agent - Extracts structured plan from PRD
 *
 * This agent analyzes a Product Requirements Document (PRD) and emits
 * a structured plan with tasks, milestones, and execution order.
 *
 * Uses the defineAgent utility for Zod → JSON Schema conversion,
 * enabling Claude's structured output feature for type-safe responses.
 *
 * Architecture:
 * - Prompt logic is extracted to `planner.prompt.ts` for testability
 * - Schema is defined in `planner.schema.ts`
 * - Agent definition is minimal and declarative
 *
 * @example
 * ```ts
 * import { plannerAgent } from "./planner/index.js";
 *
 * const result = await runPRDWorkflow({
 *   prd: prdContent,
 *   agents: { planner: plannerAgent },
 *   harness,
 * });
 * ```
 */

import { defineAgent } from "@internal/core";
import type { PRDWorkflowState } from "../types.js";
import { createPlannerPrompt } from "./planner.prompt.js";
import { type PlanCreatedPayload, PlanCreatedPayloadSchema } from "./planner.schema.js";

/**
 * The planner agent extracts a structured plan from a PRD.
 *
 * Activation: "workflow:start"
 * Emits: "plan:created" with PlanCreatedPayload
 *
 * The agent uses Claude's structured output to guarantee the response
 * matches the PlanCreatedPayloadSchema, eliminating parsing errors.
 *
 * Note: When using `outputSchema`, the harness automatically instructs Claude
 * to respond with structured JSON - no manual JSON instructions needed in the prompt.
 */
export const plannerAgent = defineAgent<PlanCreatedPayload, PRDWorkflowState>({
	// Prompt extracted to separate file for testability and iteration
	prompt: (ctx) => createPlannerPrompt({ prd: ctx.state.planning.prd }),

	activateOn: ["workflow:start"],

	emits: ["plan:created"],

	// Schema enables structured output - Claude will return validated JSON
	outputSchema: PlanCreatedPayloadSchema,

	when: (ctx) => ctx.state.planning.phase === "idle",
});
