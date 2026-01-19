/**
 * Execution Reducer
 *
 * Handles state mutations for execution-related signals.
 * Uses Immer's produce pattern (called within Immer context by the workflow engine).
 *
 * CQRS Pattern:
 * - This reducer handles the "command" side: state mutations only
 * - Orchestration signals are handled by process managers in processes/index.ts
 *
 * Signals handled:
 * - task:ready - Set current task and begin execution
 * - task:complete - Mark task as complete with attempt record
 * - fix:required - Enter fixing phase for a failed task
 * - milestone:testable - Begin milestone testing
 * - milestone:passed - Mark milestone as passed
 */

import type { SignalReducer } from "@internal/core";
import type { Draft } from "immer";
import type { AttemptRecord, PRDWorkflowState } from "../types.js";

/**
 * Draft state type - Immer removes readonly modifiers
 */
type DraftState = Draft<PRDWorkflowState>;

/**
 * Signal payload types for execution reducers
 */
interface TaskReadyPayload {
	taskId: string;
	title: string;
	description: string;
	definitionOfDone: readonly string[];
}

interface TaskCompletePayload {
	taskId: string;
	outcome: "success" | "failure" | "partial";
	summary: string;
	filesChanged?: string[];
	checkpointHash?: string;
}

interface FixRequiredPayload {
	taskId: string;
	milestoneId: string;
	error?: string;
	attempt: number;
}

interface MilestoneTestablePayload {
	milestoneId: string;
	taskIds: readonly string[];
}

interface MilestonePassedPayload {
	milestoneId: string;
}

/**
 * Reducer: task:ready
 *
 * Sets the current task and transitions to executing phase.
 * Direct mutation is safe - Immer wraps this in produce().
 */
export const taskReadyReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as TaskReadyPayload;

	// Set current task
	draft.execution.currentTaskId = payload.taskId;
	draft.execution.phase = "executing_task";

	// Update task status to in_progress
	const task = draft.planning.allTasks[payload.taskId];
	if (task) {
		task.status = "in_progress";
	}
};

/**
 * Reducer: task:complete
 *
 * Marks the current task as complete and records the attempt.
 * Transitions execution to awaiting_review phase.
 */
export const taskCompleteReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as TaskCompletePayload;

	const task = draft.planning.allTasks[payload.taskId];
	if (task) {
		// Mark task as complete
		task.status = "complete";

		// Increment attempt counter
		task.attempt += 1;

		// Record the attempt
		const attemptRecord: AttemptRecord = {
			attempt: task.attempt,
			timestamp: new Date().toISOString(),
			outcome: payload.outcome,
			summary: payload.summary,
			filesChanged: payload.filesChanged,
			checkpointHash: payload.checkpointHash,
		};

		// Push to attempt history (Immer handles the readonly conversion)
		(task.attemptHistory as AttemptRecord[]).push(attemptRecord);
	}

	// Transition to awaiting review
	draft.execution.phase = "awaiting_review";
};

/**
 * Reducer: fix:required
 *
 * Enters fixing phase when a task/milestone fails.
 * Sets the failing task as current and increments attempt.
 */
export const fixRequiredReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as FixRequiredPayload;

	// Set the failing task as current
	draft.execution.currentTaskId = payload.taskId;
	draft.execution.phase = "fixing";

	// Update task status back to in_progress and increment attempt
	const task = draft.planning.allTasks[payload.taskId];
	if (task) {
		task.status = "in_progress";
		task.attempt = payload.attempt;
	}

	// Also set the milestone we're trying to fix
	draft.review.currentMilestoneId = payload.milestoneId;
};

/**
 * Reducer: milestone:testable
 *
 * Begins milestone testing phase.
 * Sets the current milestone for review.
 */
export const milestoneTestableReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as MilestoneTestablePayload;

	// Set milestone for review
	draft.review.currentMilestoneId = payload.milestoneId;
	draft.review.phase = "reviewing_milestone";

	// Clear execution state (no active task during milestone review)
	draft.execution.phase = "idle";
};

/**
 * Reducer: milestone:passed
 *
 * Marks milestone as passed and records it.
 * Clears current milestone and returns to idle.
 */
export const milestonePassedReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as MilestonePassedPayload;

	// Mark milestone as passed in the milestones array
	const milestone = draft.planning.milestones.find((m) => m.id === payload.milestoneId);
	if (milestone) {
		milestone.passed = true;
	}

	// Add to passed milestones list
	(draft.review.passedMilestones as string[]).push(payload.milestoneId);

	// Clear current milestone
	draft.review.currentMilestoneId = null;
	draft.review.phase = "idle";
};

/**
 * Execution reducers map
 *
 * Maps signal patterns to their reducer functions.
 * Used by the workflow engine to subscribe reducers to signals.
 */
export const executionReducers: Record<string, SignalReducer<PRDWorkflowState>> = {
	"task:ready": taskReadyReducer,
	"task:complete": taskCompleteReducer,
	"fix:required": fixRequiredReducer,
	"milestone:testable": milestoneTestableReducer,
	"milestone:passed": milestonePassedReducer,
};
