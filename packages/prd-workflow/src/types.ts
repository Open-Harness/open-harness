/**
 * PRD Workflow State Types
 *
 * Defines the state shape for PRD-driven development workflows.
 * Follows CQRS pattern: state is updated by reducers, signals emitted by process managers.
 */

// Import types for local use in this file (only the ones used in local interfaces)
import type {
	Milestone as MilestoneType,
	PlanCreatedPayload as PlanCreatedPayloadType,
	Task as TaskType,
} from "./schemas/index.js";

// Re-export shared types from schemas (single source of truth)
// These are the canonical types - consumers should import from here or directly from schemas
export type { AttemptRecord, Milestone, PlanCreatedPayload, Task, TaskStatus } from "./schemas/index.js";

// Re-export schemas for direct use
export {
	AttemptRecordSchema,
	MilestoneSchema,
	PlanCreatedPayloadSchema,
	TaskSchema,
	TaskStatusSchema,
} from "./schemas/index.js";

// Local type aliases for use within this file
type Task = TaskType;
type Milestone = MilestoneType;
type PlanCreatedPayload = PlanCreatedPayloadType;

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
 *
 * Note: Arrays are NOT marked readonly here because Immer's Draft<T> handles
 * immutability externally. Using `readonly` on arrays causes type mismatches
 * when assigning from Zod-parsed payloads (which return mutable arrays).
 */
export interface PlanningState {
	phase: PlanningPhase;
	readonly prd: string;
	allTasks: Record<string, Task>;
	milestones: Milestone[];
	taskOrder: string[];
}

/**
 * Execution state slice
 */
export interface ExecutionState {
	phase: ExecutionPhase;
	currentTaskId: string | null;
	pendingDiscoveries: DiscoveredTask[];
}

/**
 * Review state slice
 */
export interface ReviewState {
	phase: ReviewPhase;
	currentMilestoneId: string | null;
	passedMilestones: string[];
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

// NOTE: PlanCreatedPayload is imported from ./schemas/index.js (single source of truth)

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
	definitionOfDone: string[];
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
	taskIds: string[];
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
 *
 * Returns Signal[] to emit follow-up signals, or void for state-only mutations.
 * Uses `void` to match SignalHandler from @internal/core which also uses void.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: void is required to match SignalHandler<TState> from @internal/core
export type TypedHandler<TPayload> = (draft: DraftState, payload: TPayload, signal: Signal) => Signal[] | void;

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
/**
 * Type guard to check if a payload is wrapped in agent output format.
 * Agent signals from create-workflow.ts emit: { agent: string, output: unknown }
 */
function isAgentOutputWrapper(payload: unknown): payload is { agent: string; output: unknown } {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"agent" in payload &&
		"output" in payload &&
		typeof (payload as { agent: unknown }).agent === "string"
	);
}

export function createHandler<TPayload>(handler: TypedHandler<TPayload>): SignalHandler<PRDWorkflowState> {
	return (state, signal) => {
		// Handle agent output wrapper: agents emit { agent, output } but handlers expect output directly
		// This defensive unwrapping bridges the contract between create-workflow.ts and handlers
		const rawPayload = signal.payload;
		const payload = isAgentOutputWrapper(rawPayload) ? (rawPayload.output as TPayload) : (rawPayload as TPayload);
		const draft = state as DraftState;
		return handler(draft, payload, signal);
	};
}

// ============================================================================
// Signal-Aware Handler Creator (Issue #6 Fix)
// ============================================================================

/**
 * Signal names that have registered payloads.
 */
export type PRDSignalName = keyof PRDSignalPayloads;

/**
 * Creates a signal-aware handler with payload type inferred from signal name.
 *
 * This utility uses the PRDSignalPayloads registry to automatically infer
 * the correct payload type based on the signal name, eliminating the need
 * to manually specify the type parameter.
 *
 * @example
 * ```ts
 * // Payload type is automatically inferred as TaskReadyPayload
 * export const taskReadyHandler = createSignalHandler("task:ready", (draft, payload) => {
 *   draft.execution.currentTaskId = payload.taskId;  // ✅ payload is TaskReadyPayload
 * });
 *
 * // Compare to createHandler which requires explicit type:
 * export const taskReadyHandler = createHandler<TaskReadyPayload>((draft, payload) => {
 *   // ...
 * });
 * ```
 *
 * @typeParam TSignal - The signal name (inferred from first argument)
 * @param _signalName - The signal name (used for type inference, not at runtime)
 * @param handler - Handler function receiving typed draft state and payload
 * @returns A SignalHandler compatible with the reactive workflow system
 */
export function createSignalHandler<TSignal extends PRDSignalName>(
	_signalName: TSignal,
	handler: TypedHandler<PRDSignalPayloads[TSignal]>,
): SignalHandler<PRDWorkflowState> {
	return (state, signal) => {
		const rawPayload = signal.payload;
		const payload = isAgentOutputWrapper(rawPayload)
			? (rawPayload.output as PRDSignalPayloads[TSignal])
			: (rawPayload as PRDSignalPayloads[TSignal]);
		const draft = state as DraftState;
		return handler(draft, payload, signal);
	};
}
