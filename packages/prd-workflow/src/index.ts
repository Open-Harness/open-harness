/**
 * PRD Workflow Package
 *
 * A reference implementation of a PRD-driven development workflow using
 * Open Harness's reactive signal architecture with the unified Handler pattern.
 *
 * @example
 * ```ts
 * import { createWorkflow } from "@internal/core";
 * import {
 *   PRDWorkflowHandlers,
 *   createInitialState,
 *   type PRDWorkflowState
 * } from "@internal/prd-workflow";
 *
 * const { agent, runReactive } = createWorkflow<PRDWorkflowState>();
 *
 * const result = await runReactive({
 *   agents: { planner, coder, reviewer },
 *   state: createInitialState(prdContent),
 *   handlers: PRDWorkflowHandlers,
 * });
 * ```
 */

// Unified handlers (Handler pattern - state mutations + signal emissions)
export { PRDWorkflowHandlers } from "./handlers/index.js";
// Types
export type {
	AttemptRecord,
	DiscoveredTask,
	ExecutionPhase,
	ExecutionState,
	Milestone,
	PlanningPhase,
	PlanningState,
	PRDWorkflowState,
	ReviewPhase,
	ReviewState,
	Task,
	TaskStatus,
} from "./types.js";
// Factory function
export { createInitialState } from "./types.js";
export type { PRDWorkflowConfig } from "./workflow.js";
// Workflow runner
export { createPRDWorkflow, runPRDWorkflow } from "./workflow.js";
