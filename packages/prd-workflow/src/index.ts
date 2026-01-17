/**
 * @open-harness/prd-workflow
 *
 * PRD-driven development workflow using Open Harness.
 *
 * A multi-agent system that takes a PRD and iteratively builds working software.
 */

// Agent factories (for advanced customization)
export {
	createCoderAgent,
	createDiscoveryProcessorAgent,
	createPlanCreatorAgent,
	createReviewerAgent,
} from "./agents/index.js";
// Reducers (for advanced customization)
export { reducers } from "./reducers/index.js";
// Schemas (for consumers who need structured output validation)
export {
	AcceptanceTestSchema,
	DiscoveredTaskSchema,
	type DiscoveryDecision,
	// Discovery schemas
	DiscoveryDecisionSchema,
	MilestoneSpecSchema,
	type PlanOutput,
	// Plan schemas
	PlanOutputSchema,
	type ReviewDecisionOutput,
	// Review schemas
	ReviewDecisionSchema,
	ReviewIssueSchema,
	SingleDiscoveryDecisionSchema,
	TaskChangeSchema,
	type TaskResult,
	// Task result schemas
	TaskResultSchema,
	TaskSpecSchema,
} from "./schemas.js";
// State factory
export {
	type CreateInitialStateOptions,
	createInitialState,
} from "./state.js";
// Types
export type {
	AcceptanceTest,
	// Discovery types
	DiscoveredTask,
	EscalationAction,
	ExecutionPhase,
	// History types
	HistoryEntry,
	HistoryEntryType,
	// Milestone types
	Milestone,
	MilestoneStatus,
	PlanningPhase,
	// State types
	PRDWorkflowState,
	// Review types
	ReviewDecision,
	ReviewDecisionType,
	ReviewIssue,
	ReviewPhase,
	// Task types
	Task,
	TaskAttempt,
	TaskChange,
	TaskStatus,
	WorkflowPhase,
} from "./types.js";
// Main workflow
export {
	createPRDWorkflow,
	type PRDWorkflow,
	type PRDWorkflowOptions,
	type PRDWorkflowResult,
} from "./workflow.js";
