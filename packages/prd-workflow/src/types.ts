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

// ============================================================================
// Signal Payload Types
// ============================================================================

/**
 * Payload for plan:start signal
 */
export interface PlanStartPayload {
	prd?: string;
}

/**
 * Payload for plan:created signal
 */
export interface PlanCreatedPayload {
	tasks: Task[];
	milestones: Milestone[];
	taskOrder: string[];
}

/**
 * Payload for discovery:submitted signal
 */
export interface DiscoverySubmittedPayload {
	discoveries: DiscoveredTask[];
	count: number;
	sourceTaskId: string | null;
}

/**
 * Payload for discovery:reviewed signal
 */
export interface DiscoveryReviewedPayload {
	accepted: number;
	rejected: number;
	acceptedTasks?: Task[];
}

/**
 * Payload for task:ready signal
 */
export interface TaskReadyPayload {
	taskId: string;
	title: string;
	description: string;
	definitionOfDone: readonly string[];
}

/**
 * Payload for task:complete signal
 */
export interface TaskCompletePayload {
	taskId: string;
	outcome: "success" | "failure" | "partial";
	summary: string;
	filesChanged?: string[];
	checkpointHash?: string;
}

/**
 * Payload for fix:required signal
 */
export interface FixRequiredPayload {
	taskId: string;
	milestoneId: string;
	error?: string;
	attempt: number;
}

/**
 * Payload for milestone:testable signal
 */
export interface MilestoneTestablePayload {
	milestoneId: string;
	taskIds: readonly string[];
}

/**
 * Payload for milestone:passed signal
 */
export interface MilestonePassedPayload {
	milestoneId: string;
}

/**
 * Payload for task:approved signal
 */
export interface TaskApprovedPayload {
	taskId: string | null;
	hadDiscoveries?: boolean;
}

/**
 * Payload for milestone:failed signal
 */
export interface MilestoneFailedPayload {
	milestoneId: string;
	failingTaskId?: string;
	error?: string;
}

/**
 * Payload for milestone:retry signal
 */
export interface MilestoneRetryPayload {
	milestoneId: string;
	error?: string;
}

/**
 * Payload for workflow:complete signal
 */
export interface WorkflowCompletePayload {
	reason: "no_tasks" | "all_milestones_passed" | string;
}

/**
 * Map of signal names to their payload types.
 * Used for type-safe signal handling.
 */
export interface PRDSignalPayloads {
	"plan:start": PlanStartPayload | undefined;
	"plan:created": PlanCreatedPayload;
	"discovery:submitted": DiscoverySubmittedPayload;
	"discovery:reviewed": DiscoveryReviewedPayload;
	"task:ready": TaskReadyPayload;
	"task:complete": TaskCompletePayload;
	"fix:required": FixRequiredPayload;
	"milestone:testable": MilestoneTestablePayload;
	"milestone:passed": MilestonePassedPayload;
	"task:approved": TaskApprovedPayload;
	"milestone:failed": MilestoneFailedPayload;
	"milestone:retry": MilestoneRetryPayload;
	"workflow:complete": WorkflowCompletePayload;
}

// ============================================================================
// Type-Safe Handler Utilities
// ============================================================================

import type { SignalHandler } from "@internal/core";
import type { Signal } from "@internal/signals-core";
import type { Draft } from "immer";

/**
 * Signal with typed payload.
 * Used internally by typed handler creator.
 */
export interface TypedSignal<T> extends Omit<Signal, "payload"> {
	payload: T;
}

/**
 * Draft state type - Immer removes readonly modifiers
 */
export type DraftState = Draft<PRDWorkflowState>;

/**
 * Type-safe handler function signature.
 * Receives the payload already typed, no casting needed.
 */
export type TypedHandler<TPayload> = (draft: DraftState, payload: TPayload, signal: Signal) => Signal[] | undefined;

/**
 * Creates a type-safe signal handler.
 *
 * This utility eliminates the need for `as FooPayload` casts by:
 * 1. Taking a handler function with explicitly typed payload parameter
 * 2. Returning a SignalHandler that extracts and casts the payload internally
 *
 * The cast happens exactly ONCE in this wrapper function, making the type
 * assertion centralized, documented, and auditable. Handler implementations
 * receive properly typed payloads without any casts.
 *
 * @example
 * ```ts
 * // Before (unsafe cast in every handler):
 * export const taskReadyHandler: SignalHandler<PRDWorkflowState> = (state, signal) => {
 *   const payload = signal.payload as TaskReadyPayload;  // ❌ Cast
 *   // ...
 * };
 *
 * // After (type-safe, no casts):
 * export const taskReadyHandler = createHandler<TaskReadyPayload>((draft, payload) => {
 *   // payload is TaskReadyPayload - no cast needed! ✅
 *   draft.execution.currentTaskId = payload.taskId;
 * });
 * ```
 *
 * @typeParam TPayload - The expected payload type for this signal
 * @param handler - Handler function receiving typed draft state and payload
 * @returns A SignalHandler compatible with the reactive workflow system
 */
export function createHandler<TPayload>(handler: TypedHandler<TPayload>): SignalHandler<PRDWorkflowState> {
	return (state, signal) => {
		// Single centralized type assertion - documented and auditable
		// The signal bus guarantees payloads match their signal names
		const payload = signal.payload as TPayload;
		const draft = state as DraftState;
		return handler(draft, payload, signal);
	};
}
