/**
 * Preset Agents - Pre-configured agents for common use cases
 *
 * Import from this module for zero-configuration agent usage:
 *
 * ```typescript
 * import { CodingAgent, ReviewAgent, PlannerAgent } from "@openharness/anthropic/presets";
 *
 * // Use immediately with typed input/output
 * const code = await CodingAgent.execute({ task: "Write a hello world function" });
 * ```
 *
 * @module presets
 */

// ============================================================================
// Preset Agents
// ============================================================================

export { CodingAgent } from "./coding-agent.js";
export { PlannerAgent } from "./planner-agent.js";
export { ReviewAgent } from "./review-agent.js";

// ============================================================================
// Prompt Templates
// ============================================================================

export {
	CODING_TEMPLATE,
	CodingPromptTemplate,
} from "./prompts/coding.js";
export {
	PLANNER_TEMPLATE,
	PlannerPromptTemplate,
} from "./prompts/planner.js";
export {
	REVIEW_TEMPLATE,
	ReviewPromptTemplate,
} from "./prompts/review.js";

// ============================================================================
// Schemas
// ============================================================================

export {
	CodingInputSchema,
	CodingOutputSchema,
} from "./prompts/coding.js";
export {
	PlannerInputSchema,
	PlannerOutputSchema,
	PlannerTaskSchema,
} from "./prompts/planner.js";
export {
	ReviewInputSchema,
	ReviewIssueSchema,
	ReviewOutputSchema,
} from "./prompts/review.js";

// ============================================================================
// Types
// ============================================================================

export type {
	CodingInput,
	CodingOutput,
	PlannerInput,
	PlannerOutput,
	PlannerTask,
	ReviewInput,
	ReviewIssue,
	ReviewOutput,
} from "../provider/types.js";
