/**
 * Review Handlers
 *
 * Unified handlers for review-related signals.
 * Combines state mutations (from reducers) with signal emissions (from process managers)
 * into single, cohesive handler functions.
 *
 * Handler Pattern:
 * - Receive state and signal
 * - Mutate state directly (Immer handles immutability)
 * - Return signals to emit (or void for no emissions)
 *
 * Signals handled:
 * - task:approved - Mark task as approved and advance workflow
 * - milestone:failed - Handle failed milestone test
 * - milestone:retry - Reset milestone for retry
 * - workflow:complete - Mark workflow as complete
 */

import type { SignalHandler } from "@internal/core";
import { createSignal } from "@internal/signals-core";
import {
	createHandler,
	type MilestoneFailedPayload,
	type MilestoneRetryPayload,
	type PRDWorkflowState,
	type Task,
	type TaskApprovedPayload,
	type WorkflowCompletePayload,
} from "../types.js";

/**
 * Helper: Find the next pending task after the current one
 */
function findNextPendingTask(state: Readonly<PRDWorkflowState>): Task | null {
	const currentIdx = state.execution.currentTaskId
		? state.planning.taskOrder.indexOf(state.execution.currentTaskId)
		: -1;

	for (let i = currentIdx + 1; i < state.planning.taskOrder.length; i++) {
		const taskId = state.planning.taskOrder[i];
		if (taskId) {
			const task = state.planning.allTasks[taskId];
			if (task && task.status === "pending") {
				return task;
			}
		}
	}
	return null;
}

/**
 * Helper: Check if all tasks in a milestone are complete
 */
function isMilestoneComplete(milestone: { taskIds: readonly string[] }, tasks: Record<string, Task>): boolean {
	return milestone.taskIds.every((taskId) => {
		const task = tasks[taskId];
		return task && task.status === "complete";
	});
}

/**
 * Helper: Find the milestone that contains a given task
 */
function findMilestoneForTask(
	taskId: string,
	state: Readonly<PRDWorkflowState>,
): { id: string; taskIds: readonly string[] } | null {
	for (const milestone of state.planning.milestones) {
		if (milestone.taskIds.includes(taskId)) {
			return milestone;
		}
	}
	return null;
}

/**
 * Helper: Find the next untested milestone with all tasks complete
 */
function findNextUntestedMilestone(
	state: Readonly<PRDWorkflowState>,
): { id: string; taskIds: readonly string[] } | null {
	for (const milestone of state.planning.milestones) {
		if (state.review.passedMilestones.includes(milestone.id)) {
			continue;
		}
		if (isMilestoneComplete(milestone, state.planning.allTasks)) {
			return milestone;
		}
	}
	return null;
}

/**
 * Helper: Check if all milestones have passed
 */
function allMilestonesPassed(state: Readonly<PRDWorkflowState>): boolean {
	return state.planning.milestones.every((milestone) => state.review.passedMilestones.includes(milestone.id));
}

/**
 * Handler: task:approved
 *
 * Handles when a task passes review and advances the workflow.
 * Combines:
 * - Mutation: Clear current task, update phases
 * - Emission: milestone:testable if milestone complete, else task:ready for next
 */
export const taskApprovedHandler = createHandler<TaskApprovedPayload>((draft, payload) => {
	// Get the task ID (from payload or current execution state)
	const taskId = payload.taskId ?? draft.execution.currentTaskId;

	// MUTATION: Clear current task and reset phases
	draft.execution.currentTaskId = null;
	draft.execution.phase = "idle";
	draft.review.phase = "idle";

	// EMISSION: Determine next step based on workflow state
	// Cast to readonly for helper functions
	const readOnlyState = draft as unknown as PRDWorkflowState;

	if (!taskId) {
		return [];
	}

	// Find the milestone for this task
	const milestone = findMilestoneForTask(taskId, readOnlyState);

	if (milestone && isMilestoneComplete(milestone, readOnlyState.planning.allTasks)) {
		// All tasks in milestone complete - time to test
		return [
			createSignal("milestone:testable", {
				milestoneId: milestone.id,
				taskIds: milestone.taskIds,
			}),
		];
	}

	// Find next pending task
	const nextTask = findNextPendingTask(readOnlyState);
	if (nextTask) {
		return [
			createSignal("task:ready", {
				taskId: nextTask.id,
				title: nextTask.title,
				description: nextTask.description,
				definitionOfDone: nextTask.definitionOfDone,
			}),
		];
	}

	// No more tasks - check if all milestones tested
	if (allMilestonesPassed(readOnlyState)) {
		return [
			createSignal("workflow:complete", {
				reason: "all_milestones_passed",
			}),
		];
	}

	// Still have untested milestones
	const untestedMilestone = findNextUntestedMilestone(readOnlyState);
	if (untestedMilestone) {
		return [
			createSignal("milestone:testable", {
				milestoneId: untestedMilestone.id,
				taskIds: untestedMilestone.taskIds,
			}),
		];
	}

	return [];
});

/**
 * Handler: milestone:failed
 *
 * Handles when a milestone fails its test.
 * Combines:
 * - Mutation: Update milestone state, mark failing task for retry
 * - Emission: fix:required for specific task, or milestone:retry for whole milestone
 */
export const milestoneFailedHandler = createHandler<MilestoneFailedPayload>((draft, payload) => {
	// MUTATION: Keep the failing milestone as current
	draft.review.currentMilestoneId = payload.milestoneId;
	draft.review.phase = "reviewing_milestone";

	// If there's a failing task, mark it for retry
	if (payload.failingTaskId) {
		const task = draft.planning.allTasks[payload.failingTaskId];
		if (task) {
			task.status = "pending";

			// EMISSION: fix:required for specific failing task
			return [
				createSignal("fix:required", {
					taskId: payload.failingTaskId,
					milestoneId: payload.milestoneId,
					error: payload.error,
					attempt: task.attempt + 1,
				}),
			];
		}
	}

	// No specific failing task - retry the milestone
	return [
		createSignal("milestone:retry", {
			milestoneId: payload.milestoneId,
			error: payload.error,
		}),
	];
});

/**
 * Handler: milestone:retry
 *
 * Handles when a milestone is being retried.
 * Resets all tasks in the milestone to pending and emits task:ready for first.
 */
export const milestoneRetryHandler = createHandler<MilestoneRetryPayload>((draft, payload) => {
	// MUTATION: Set the milestone we're retrying
	draft.review.currentMilestoneId = payload.milestoneId;
	draft.review.phase = "reviewing_milestone";

	// Find the milestone and reset all its tasks to pending
	const milestone = draft.planning.milestones.find((m) => m.id === payload.milestoneId);
	let firstTask: Task | null = null;

	if (milestone) {
		for (const taskId of milestone.taskIds) {
			const task = draft.planning.allTasks[taskId];
			if (task) {
				task.status = "pending";
				// Track first task for emission
				if (!firstTask) {
					firstTask = task as Task;
				}
			}
		}
	}

	// EMISSION: Start with first task in milestone
	if (firstTask) {
		return [
			createSignal("task:ready", {
				taskId: firstTask.id,
				title: firstTask.title,
				description: firstTask.description,
				definitionOfDone: firstTask.definitionOfDone,
			}),
		];
	}

	return [];
});

/**
 * Handler: workflow:complete
 *
 * Handles workflow completion.
 * Pure mutation - no signals emitted (terminal state).
 */
export const workflowCompleteHandler = createHandler<WorkflowCompletePayload>((draft, _payload) => {
	// MUTATION: Set terminal state
	draft.review.phase = "complete";
	draft.review.currentMilestoneId = null;
	draft.execution.phase = "idle";
	draft.execution.currentTaskId = null;

	// No signals to emit - workflow is complete
});

/**
 * Review handlers map
 *
 * Maps signal patterns to their unified handler functions.
 */
export const reviewHandlers: Record<string, SignalHandler<PRDWorkflowState>> = {
	"task:approved": taskApprovedHandler,
	"milestone:failed": milestoneFailedHandler,
	"milestone:retry": milestoneRetryHandler,
	"workflow:complete": workflowCompleteHandler,
};
