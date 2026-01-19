/**
 * PRD Workflow State Types
 *
 * Defines the state shape for PRD-driven development workflows.
 * Follows CQRS pattern: state is updated by reducers, signals emitted by process managers.
 */

/**
 * Phases of the planning stage
 */
export type PlanningPhase = "idle" | "planning" | "plan_complete" | "discovery_review";

/**
 * Phases of the execution stage
 */
export type ExecutionPhase = "idle" | "executing_task" | "awaiting_review" | "fixing";

/**
 * Phases of the review stage
 */
export type ReviewPhase = "idle" | "reviewing_task" | "reviewing_milestone" | "complete";

/**
 * Task status in the workflow
 */
export type TaskStatus = "pending" | "in_progress" | "complete" | "blocked";

/**
 * Definition of a single task in the PRD
 */
export interface Task {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly definitionOfDone: readonly string[];
	readonly milestoneId: string;
	status: TaskStatus;
	attempt: number;
	attemptHistory: readonly AttemptRecord[];
}

/**
 * Record of a task execution attempt
 */
export interface AttemptRecord {
	readonly attempt: number;
	readonly timestamp: string;
	readonly outcome: "success" | "failure" | "partial";
	readonly summary: string;
	readonly filesChanged?: readonly string[];
	readonly checkpointHash?: string;
}

/**
 * Milestone containing multiple tasks
 */
export interface Milestone {
	readonly id: string;
	readonly title: string;
	readonly taskIds: readonly string[];
	readonly testCommand?: string;
	passed: boolean;
}

/**
 * Discovered task during execution (emergent work)
 */
export interface DiscoveredTask {
	readonly title: string;
	readonly description: string;
	readonly suggestedMilestoneId?: string;
	readonly blocksTaskId?: string;
}

/**
 * Planning state slice
 */
export interface PlanningState {
	phase: PlanningPhase;
	readonly prd: string;
	allTasks: Record<string, Task>;
	milestones: readonly Milestone[];
	taskOrder: readonly string[];
}

/**
 * Execution state slice
 */
export interface ExecutionState {
	phase: ExecutionPhase;
	currentTaskId: string | null;
	pendingDiscoveries: readonly DiscoveredTask[];
}

/**
 * Review state slice
 */
export interface ReviewState {
	phase: ReviewPhase;
	currentMilestoneId: string | null;
	passedMilestones: readonly string[];
}

/**
 * Complete PRD Workflow State
 */
export interface PRDWorkflowState {
	planning: PlanningState;
	execution: ExecutionState;
	review: ReviewState;
}

/**
 * Create initial PRD workflow state
 */
export function createInitialState(prd: string): PRDWorkflowState {
	return {
		planning: {
			phase: "idle",
			prd,
			allTasks: {},
			milestones: [],
			taskOrder: [],
		},
		execution: {
			phase: "idle",
			currentTaskId: null,
			pendingDiscoveries: [],
		},
		review: {
			phase: "idle",
			currentMilestoneId: null,
			passedMilestones: [],
		},
	};
}
