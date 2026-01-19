/**
 * Review Reducer
 *
 * Handles state mutations for review-related signals.
 * Uses Immer's produce pattern (called within Immer context by the workflow engine).
 *
 * CQRS Pattern:
 * - This reducer handles the "command" side: state mutations only
 * - Orchestration signals are handled by process managers in processes/index.ts
 *
 * Signals handled:
 * - task:approved - Mark task as approved and transition review state
 * - milestone:failed - Mark milestone as failed
 * - milestone:retry - Reset milestone for retry
 * - workflow:complete - Mark workflow as complete
 */

import type { SignalReducer } from "@internal/core";
import type { Draft } from "immer";
import type { PRDWorkflowState } from "../types.js";

/**
 * Draft state type - Immer removes readonly modifiers
 */
type DraftState = Draft<PRDWorkflowState>;

/**
 * Signal payload types for review reducers
 */
interface TaskApprovedPayload {
	taskId: string | null;
	hadDiscoveries?: boolean;
}

interface MilestoneFailedPayload {
	milestoneId: string;
	failingTaskId?: string;
	error?: string;
}

interface MilestoneRetryPayload {
	milestoneId: string;
	error?: string;
}

/**
 * Reducer: task:approved
 *
 * Handles when a task passes review.
 * Clears the current task from execution and transitions review state.
 * Direct mutation is safe - Immer wraps this in produce().
 */
export const taskApprovedReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const _payload = signal.payload as TaskApprovedPayload;

	// Clear current task since it's approved
	draft.execution.currentTaskId = null;

	// Move execution back to idle
	draft.execution.phase = "idle";

	// Update review phase to idle (review complete for this task)
	draft.review.phase = "idle";
};

/**
 * Reducer: milestone:failed
 *
 * Handles when a milestone fails its test.
 * Records the failure in review state for tracking.
 */
export const milestoneFailedReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as MilestoneFailedPayload;

	// Keep the failing milestone as current for tracking
	draft.review.currentMilestoneId = payload.milestoneId;

	// Update review phase to indicate failure state
	draft.review.phase = "reviewing_milestone";

	// If there's a failing task, mark it for retry
	if (payload.failingTaskId) {
		const task = draft.planning.allTasks[payload.failingTaskId];
		if (task) {
			// Reset task status to pending for re-execution
			task.status = "pending";
		}
	}
};

/**
 * Reducer: milestone:retry
 *
 * Handles when a milestone is being retried.
 * Resets milestone state for another attempt.
 */
export const milestoneRetryReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as MilestoneRetryPayload;

	// Set the milestone we're retrying
	draft.review.currentMilestoneId = payload.milestoneId;

	// Reset review phase to reviewing
	draft.review.phase = "reviewing_milestone";

	// Find the milestone and reset all its tasks to pending
	const milestone = draft.planning.milestones.find((m) => m.id === payload.milestoneId);
	if (milestone) {
		for (const taskId of milestone.taskIds) {
			const task = draft.planning.allTasks[taskId];
			if (task) {
				task.status = "pending";
			}
		}
	}
};

/**
 * Reducer: workflow:complete
 *
 * Handles workflow completion.
 * Transitions review phase to complete.
 */
export const workflowCompleteReducer: SignalReducer<PRDWorkflowState> = (state, _signal) => {
	const draft = state as DraftState;

	// Set review phase to complete
	draft.review.phase = "complete";

	// Clear any current milestone
	draft.review.currentMilestoneId = null;

	// Clear execution state
	draft.execution.phase = "idle";
	draft.execution.currentTaskId = null;
};

/**
 * Review reducers map
 *
 * Maps signal patterns to their reducer functions.
 * Used by the workflow engine to subscribe reducers to signals.
 */
export const reviewReducers: Record<string, SignalReducer<PRDWorkflowState>> = {
	"task:approved": taskApprovedReducer,
	"milestone:failed": milestoneFailedReducer,
	"milestone:retry": milestoneRetryReducer,
	"workflow:complete": workflowCompleteReducer,
};
