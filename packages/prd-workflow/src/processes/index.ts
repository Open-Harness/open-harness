/**
 * PRD Workflow Process Managers
 *
 * Process managers implement the CQRS "query" side - they observe state changes
 * and emit signals for orchestration, without mutating state.
 *
 * Pattern:
 * - Receive read-only state and triggering signal
 * - Return array of signals to emit
 * - Must be pure functions (deterministic, no side effects)
 *
 * Orchestration Rules:
 * - "plan:created" → emit "task:ready" for first pending task
 * - "task:complete" → emit "discovery:submitted" if discoveries exist
 * - "task:approved" → emit "milestone:testable" or "task:ready" for next task
 * - "milestone:passed" → emit "task:ready" for next milestone or "workflow:complete"
 */

import type { ProcessManagers } from "@internal/core";
import { createSignal, type Signal } from "@internal/signals-core";
import type { PRDWorkflowState, Task } from "../types.js";

/**
 * Find the first pending task in the workflow
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
 * Find the next pending task after the current one
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
 * Check if all tasks in a milestone are complete
 */
function isMilestoneComplete(milestone: { taskIds: readonly string[] }, tasks: Record<string, Task>): boolean {
	return milestone.taskIds.every((taskId) => {
		const task = tasks[taskId];
		return task && task.status === "complete";
	});
}

/**
 * Find the milestone that contains a given task
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
 * Find the next milestone that needs testing
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
		if (isMilestoneComplete(milestone, state.planning.allTasks)) {
			return milestone;
		}
	}
	return null;
}

/**
 * Check if all milestones have passed
 */
function allMilestonesPassed(state: Readonly<PRDWorkflowState>): boolean {
	return state.planning.milestones.every((milestone) => state.review.passedMilestones.includes(milestone.id));
}

/**
 * Process Managers for PRD Workflow
 *
 * Each process manager handles orchestration for a specific signal pattern.
 */
export const processes: ProcessManagers<PRDWorkflowState> = {
	/**
	 * When a plan is created, start execution with the first pending task
	 */
	"plan:created": (state, _signal): Signal[] => {
		const firstTask = findFirstPendingTask(state);
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
		// No tasks to execute
		return [
			createSignal("workflow:complete", {
				reason: "no_tasks",
				state,
			}),
		];
	},

	/**
	 * When a task completes, check for discoveries to submit
	 */
	"task:complete": (state, _signal): Signal[] => {
		// Check if there are pending discoveries from task execution
		if (state.execution.pendingDiscoveries.length > 0) {
			return [
				createSignal("discovery:submitted", {
					discoveries: state.execution.pendingDiscoveries,
					count: state.execution.pendingDiscoveries.length,
					sourceTaskId: state.execution.currentTaskId,
				}),
			];
		}
		// No discoveries - wait for task review
		return [];
	},

	/**
	 * When discoveries are reviewed, continue with appropriate action
	 */
	"discovery:reviewed": (state, signal): Signal[] => {
		// After discovery review, emit task:approved to continue workflow
		// The reducer should have already incorporated any accepted discoveries
		const payload = signal.payload as {
			accepted: number;
			rejected: number;
		};

		return [
			createSignal("task:approved", {
				taskId: state.execution.currentTaskId,
				hadDiscoveries: payload.accepted > 0,
			}),
		];
	},

	/**
	 * When a task is approved, check milestone or advance to next task
	 */
	"task:approved": (state, signal): Signal[] => {
		const payload = signal.payload as { taskId: string };
		const taskId = payload.taskId ?? state.execution.currentTaskId;

		if (!taskId) {
			return [];
		}

		// Find the milestone for this task
		const milestone = findMilestoneForTask(taskId, state);

		if (milestone && isMilestoneComplete(milestone, state.planning.allTasks)) {
			// All tasks in milestone complete - time to test
			return [
				createSignal("milestone:testable", {
					milestoneId: milestone.id,
					taskIds: milestone.taskIds,
				}),
			];
		}

		// Find next pending task
		const nextTask = findNextPendingTask(state);
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
		if (allMilestonesPassed(state)) {
			return [
				createSignal("workflow:complete", {
					reason: "all_milestones_passed",
					state,
				}),
			];
		}

		// Still have untested milestones
		const untestedMilestone = findNextUntestedMilestone(state);
		if (untestedMilestone) {
			return [
				createSignal("milestone:testable", {
					milestoneId: untestedMilestone.id,
					taskIds: untestedMilestone.taskIds,
				}),
			];
		}

		return [];
	},

	/**
	 * When a milestone passes, advance to next work or complete
	 */
	"milestone:passed": (state, _signal): Signal[] => {
		// Check if all milestones have passed
		if (allMilestonesPassed(state)) {
			return [
				createSignal("workflow:complete", {
					reason: "all_milestones_passed",
					finalState: state,
				}),
			];
		}

		// Find next pending task
		const nextTask = findFirstPendingTask(state);
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
		const untestedMilestone = findNextUntestedMilestone(state);
		if (untestedMilestone) {
			return [
				createSignal("milestone:testable", {
					milestoneId: untestedMilestone.id,
					taskIds: untestedMilestone.taskIds,
				}),
			];
		}

		return [];
	},

	/**
	 * When a milestone fails, emit fix signal for the failing task
	 */
	"milestone:failed": (state, signal): Signal[] => {
		const payload = signal.payload as {
			milestoneId: string;
			failingTaskId?: string;
			error?: string;
		};

		if (payload.failingTaskId) {
			const task = state.planning.allTasks[payload.failingTaskId];
			if (task) {
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
	},
};
