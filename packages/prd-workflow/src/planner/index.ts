/**
 * Planner Module - Co-located planner agent code
 *
 * This module groups all planner-related code for better DX:
 * - Agent definition (planner.agent.ts)
 * - Prompt function (planner.prompt.ts)
 * - Schema definitions (planner.schema.ts)
 *
 * Consumers can import everything from this single entry point.
 *
 * @example
 * ```ts
 * import {
 *   plannerAgent,
 *   createPlannerPrompt,
 *   PlanCreatedPayloadSchema,
 *   type PlanCreatedPayload,
 * } from "./planner/index.js";
 * ```
 */

// Agent
export { plannerAgent } from "./planner.agent.js";

// Prompt
export { createPlannerPrompt, type PlannerPromptContext } from "./planner.prompt.js";

// Schemas and types
export {
	// Types
	type AttemptRecord,
	// Schemas
	AttemptRecordSchema,
	type Milestone,
	MilestoneSchema,
	type PlanCreatedPayload,
	PlanCreatedPayloadSchema,
	type Task,
	TaskSchema,
	type TaskStatus,
	TaskStatusSchema,
} from "./planner.schema.js";
