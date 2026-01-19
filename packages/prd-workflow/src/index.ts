/**
 * PRD Workflow Package
 *
 * A reference implementation of a PRD-driven development workflow using
 * Open Harness's reactive signal architecture with CQRS pattern.
 *
 * @example
 * ```ts
 * import { createWorkflow } from "@internal/core";
 * import {
 *   reducers,
 *   processes,
 *   createInitialState,
 *   type PRDWorkflowState
 * } from "@internal/prd-workflow";
 *
 * const { agent, runReactive } = createWorkflow<PRDWorkflowState>();
 *
 * const result = await runReactive({
 *   agents: { planner, coder, reviewer },
 *   state: createInitialState(prdContent),
 *   reducers,
 *   processes,
 * });
 * ```
 */

// Process managers (CQRS query side - orchestration)
export { processes } from "./processes/index.js";
// Reducers (CQRS command side - state mutations)
export { planningReducers, reducers } from "./reducers/index.js";
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
