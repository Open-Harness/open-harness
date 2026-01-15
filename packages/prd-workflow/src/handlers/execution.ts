/**
 * Execution Handlers
 *
 * Unified handlers for execution-related signals.
 * Combines state mutations (from reducers) with signal emissions (from process managers)
 * into single, cohesive handler functions.
 *
 * Handler Pattern:
 * - Receive state and signal
 * - Mutate state directly (Immer handles immutability)
 * - Return signals to emit (or void for no emissions)
 *
 * Signals handled:
 * - task:ready - Set current task and begin execution
 * - task:complete - Mark task as complete with attempt record
 * - fix:required - Enter fixing phase for a failed task
 * - milestone:testable - Begin milestone testing
 * - milestone:passed - Mark milestone as passed
 */

import type { SignalHandler } from "@internal/core";
import { createSignal } from "@internal/signals-core";
import {
	type AttemptRecord,
	createHandler,
	type FixRequiredPayload,
	type MilestonePassedPayload,
	type MilestoneTestablePayload,
	type PRDWorkflowState,
	type Task,
	type TaskCompletePayload,
	type TaskReadyPayload,
} from "../types.js";

/**
 * Helper: Find the first pending task in the workflow
 */
function findFirstPendingTask(state: Readonly<PRDWorkflowState>): Task | null {
	for (const taskId of state.planning.taskOrder) {
		const task = state.planning.allTasks[taskId];
		if (task && task.status === "pending") {
			return task;
		}
	}
	return null;
}

/**
 * Helper: Find the next untested milestone
 */
function findNextUntestedMilestone(
	state: Readonly<PRDWorkflowState>,
): { id: string; taskIds: readonly string[] } | null {
	for (const milestone of state.planning.milestones) {
		// Skip already passed milestones
		if (state.review.passedMilestones.includes(milestone.id)) {
			continue;
		}
		// Check if all tasks in this milestone are complete
		const allComplete = milestone.taskIds.every((taskId) => {
			const task = state.planning.allTasks[taskId];
			return task && task.status === "complete";
		});
		if (allComplete) {
			return milestone;
		}
	}
	return null;
}

/**
 * Handler: task:ready
 *
 * Sets the current task and transitions to executing phase.
 * No signals emitted - agent will execute the task.
 */
export const taskReadyHandler = createHandler<TaskReadyPayload>((draft, payload) => {
	// Set current task
	draft.execution.currentTaskId = payload.taskId;
	draft.execution.phase = "executing_task";

	// Update task status to in_progress
	const task = draft.planning.allTasks[payload.taskId];
	if (task) {
		task.status = "in_progress";
	}

	// No signals to emit - agent handles task execution
});

/**
 * Handler: task:complete
 *
 * Marks task as complete, records the attempt, and checks for discoveries.
 * Combines:
 * - Mutation: Update task status, record attempt history
 * - Emission: discovery:submitted if discoveries exist, else nothing (await review)
 */
export const taskCompleteHandler = createHandler<TaskCompletePayload>((draft, payload) => {
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

		// Push to attempt history
		(task.attemptHistory as AttemptRecord[]).push(attemptRecord);
	}

	// Transition to awaiting review
	draft.execution.phase = "awaiting_review";

	// EMISSION: Check for pending discoveries
	if (draft.execution.pendingDiscoveries.length > 0) {
		return [
			createSignal("discovery:submitted", {
				discoveries: draft.execution.pendingDiscoveries,
				count: draft.execution.pendingDiscoveries.length,
				sourceTaskId: draft.execution.currentTaskId,
			}),
		];
	}

	// No discoveries - wait for task review (no signal emitted)
});

/**
 * Handler: fix:required
 *
 * Enters fixing phase when a task/milestone fails.
 * No signals emitted - agent will fix the task.
 */
export const fixRequiredHandler = createHandler<FixRequiredPayload>((draft, payload) => {
	// Set the failing task as current
	draft.execution.currentTaskId = payload.taskId;
	draft.execution.phase = "fixing";

	// Update task status back to in_progress and set attempt
	const task = draft.planning.allTasks[payload.taskId];
	if (task) {
		task.status = "in_progress";
		task.attempt = payload.attempt;
	}

	// Set the milestone we're trying to fix
	draft.review.currentMilestoneId = payload.milestoneId;

	// No signals to emit - agent handles the fix
});

/**
 * Handler: milestone:testable
 *
 * Begins milestone testing phase.
 * No signals emitted - test runner will execute tests.
 */
export const milestoneTestableHandler = createHandler<MilestoneTestablePayload>((draft, payload) => {
	// Set milestone for review
	draft.review.currentMilestoneId = payload.milestoneId;
	draft.review.phase = "reviewing_milestone";

	// Clear execution state (no active task during milestone review)
	draft.execution.phase = "idle";

	// No signals to emit - test runner handles next steps
});

/**
 * Handler: milestone:passed
 *
 * Marks milestone as passed and advances workflow.
 * Combines:
 * - Mutation: Mark milestone passed, update passedMilestones
 * - Emission: workflow:complete if all done, else task:ready for next task
 */
export const milestonePassedHandler = createHandler<MilestonePassedPayload>((draft, payload) => {
	// MUTATION: Mark milestone as passed
	const milestone = draft.planning.milestones.find((m) => m.id === payload.milestoneId);
	if (milestone) {
		milestone.passed = true;
	}

	// Add to passed milestones list
	(draft.review.passedMilestones as string[]).push(payload.milestoneId);

	// Clear current milestone
	draft.review.currentMilestoneId = null;
	draft.review.phase = "idle";

	// EMISSION: Check if all milestones have passed
	// Note: We need to read from state before mutations for accurate check
	// But since we just pushed to passedMilestones, we can check current state
	const passedCount = draft.review.passedMilestones.length;
	const totalCount = draft.planning.milestones.length;

	if (passedCount >= totalCount) {
		return [
			createSignal("workflow:complete", {
				reason: "all_milestones_passed",
			}),
		];
	}

	// Find next pending task
	// Cast back to readonly for helper function
	const readOnlyState = draft as unknown as PRDWorkflowState;
	const nextTask = findFirstPendingTask(readOnlyState);
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

	// No more tasks but have untested milestones
	const untestedMilestone = findNextUntestedMilestone(readOnlyState);
	if (untestedMilestone) {
		return [
			createSignal("milestone:testable", {
				milestoneId: untestedMilestone.id,
				taskIds: untestedMilestone.taskIds,
			}),
		];
	}

	// Nothing left to do
	return [];
});

/**
 * Execution handlers map
 *
 * Maps signal patterns to their unified handler functions.
 */
export const executionHandlers: Record<string, SignalHandler<PRDWorkflowState>> = {
	"task:ready": taskReadyHandler,
	"task:complete": taskCompleteHandler,
	"fix:required": fixRequiredHandler,
	"milestone:testable": milestoneTestableHandler,
	"milestone:passed": milestonePassedHandler,
};
