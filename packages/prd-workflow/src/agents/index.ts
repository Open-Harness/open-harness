/**
 * Agent exports for the PRD workflow
 *
 * This file re-exports from the co-located planner module for backward compatibility.
 * New code should import directly from "../planner/index.js".
 *
 * @deprecated Import from "../planner/index.js" instead
 */

// Re-export from new planner module location (backward compatibility)
export { createPlannerPrompt, type PlannerPromptContext, plannerAgent } from "../planner/index.js";
