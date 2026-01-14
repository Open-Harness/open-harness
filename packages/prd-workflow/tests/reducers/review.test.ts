/**
 * Tests for Review Reducers
 *
 * Reducers are the "command" side of CQRS - they mutate state in response
 * to signals. These tests verify that state is correctly updated by each reducer.
 *
 * Note: Tests use Immer's produce() to wrap reducers, simulating
 * how they're called in the actual workflow engine.
 */

import { describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { produce } from "immer";
import {
	milestoneFailedReducer,
	milestoneRetryReducer,
	reviewReducers,
	taskApprovedReducer,
	workflowCompleteReducer,
} from "../../src/reducers/review.js";
import { createInitialState, type Milestone, type PRDWorkflowState, type Task } from "../../src/types.js";

/**
 * Helper to create a task for testing
 */
function createTask(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		title: "Test Task",
		description: "A test task",
		definitionOfDone: ["Test passes"],
		milestoneId: "milestone-1",
		status: "pending",
		attempt: 0,
		attemptHistory: [],
		...overrides,
	};
}

/**
 * Helper to create a milestone for testing
 */
function createMilestone(overrides: Partial<Milestone> = {}): Milestone {
	return {
		id: "milestone-1",
		title: "Test Milestone",
		taskIds: ["task-1"],
		passed: false,
		...overrides,
	};
}

/**
 * Helper to create state with tasks and milestones
 */
function createStateWithTasks(): PRDWorkflowState {
	const state = createInitialState("Test PRD");
	state.planning.allTasks = {
		T001: createTask({ id: "T001", title: "Task 1", milestoneId: "M1" }),
		T002: createTask({ id: "T002", title: "Task 2", milestoneId: "M1" }),
		T003: createTask({ id: "T003", title: "Task 3", milestoneId: "M2" }),
	};
	state.planning.milestones = [
		createMilestone({ id: "M1", title: "Milestone 1", taskIds: ["T001", "T002"] }),
		createMilestone({ id: "M2", title: "Milestone 2", taskIds: ["T003"] }),
	];
	state.planning.taskOrder = ["T001", "T002", "T003"];
	state.planning.phase = "plan_complete";
	return state;
}

/**
 * Apply reducer with Immer (simulates workflow engine behavior)
 */
function applyReducer(
	state: PRDWorkflowState,
	reducer: (state: PRDWorkflowState, signal: ReturnType<typeof createSignal>) => void,
	signal: ReturnType<typeof createSignal>,
): PRDWorkflowState {
	return produce(state, (draft) => {
		reducer(draft, signal);
	});
}

describe("Review Reducers", () => {
	describe("taskApprovedReducer", () => {
		it("clears current task ID", () => {
			const state = createStateWithTasks();
			state.execution.currentTaskId = "T001";

			const signal = createSignal("task:approved", {
				taskId: "T001",
				hadDiscoveries: false,
			});

			const newState = applyReducer(state, taskApprovedReducer, signal);

			expect(newState.execution.currentTaskId).toBeNull();
		});

		it("transitions execution phase to 'idle'", () => {
			const state = createStateWithTasks();
			state.execution.phase = "awaiting_review";

			const signal = createSignal("task:approved", {
				taskId: "T001",
			});

			const newState = applyReducer(state, taskApprovedReducer, signal);

			expect(newState.execution.phase).toBe("idle");
		});

		it("transitions review phase to 'idle'", () => {
			const state = createStateWithTasks();
			state.review.phase = "reviewing_task";

			const signal = createSignal("task:approved", {
				taskId: "T001",
			});

			const newState = applyReducer(state, taskApprovedReducer, signal);

			expect(newState.review.phase).toBe("idle");
		});

		it("handles task approval with discoveries", () => {
			const state = createStateWithTasks();
			state.execution.currentTaskId = "T001";
			state.execution.phase = "awaiting_review";
			state.review.phase = "reviewing_task";

			const signal = createSignal("task:approved", {
				taskId: "T001",
				hadDiscoveries: true,
			});

			const newState = applyReducer(state, taskApprovedReducer, signal);

			expect(newState.execution.currentTaskId).toBeNull();
			expect(newState.execution.phase).toBe("idle");
			expect(newState.review.phase).toBe("idle");
		});

		it("handles null taskId in payload", () => {
			const state = createStateWithTasks();
			state.execution.currentTaskId = "T001";

			const signal = createSignal("task:approved", {
				taskId: null,
			});

			const newState = applyReducer(state, taskApprovedReducer, signal);

			// Should still clear state
			expect(newState.execution.currentTaskId).toBeNull();
			expect(newState.execution.phase).toBe("idle");
		});
	});

	describe("milestoneFailedReducer", () => {
		it("sets current milestone ID", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:failed", {
				milestoneId: "M1",
				failingTaskId: "T001",
				error: "Test failed",
			});

			const newState = applyReducer(state, milestoneFailedReducer, signal);

			expect(newState.review.currentMilestoneId).toBe("M1");
		});

		it("transitions review phase to 'reviewing_milestone'", () => {
			const state = createStateWithTasks();
			state.review.phase = "idle";

			const signal = createSignal("milestone:failed", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestoneFailedReducer, signal);

			expect(newState.review.phase).toBe("reviewing_milestone");
		});

		it("resets failing task status to 'pending'", () => {
			const state = createStateWithTasks();
			const task = state.planning.allTasks.T001;
			if (task) {
				task.status = "complete";
			}

			const signal = createSignal("milestone:failed", {
				milestoneId: "M1",
				failingTaskId: "T001",
				error: "Test failed",
			});

			const newState = applyReducer(state, milestoneFailedReducer, signal);

			expect(newState.planning.allTasks.T001?.status).toBe("pending");
		});

		it("handles milestone failure without failing task", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:failed", {
				milestoneId: "M1",
				error: "Test failed",
			});

			const newState = applyReducer(state, milestoneFailedReducer, signal);

			expect(newState.review.currentMilestoneId).toBe("M1");
			expect(newState.review.phase).toBe("reviewing_milestone");
		});

		it("handles nonexistent failing task gracefully", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:failed", {
				milestoneId: "M1",
				failingTaskId: "NONEXISTENT",
				error: "Test failed",
			});

			const newState = applyReducer(state, milestoneFailedReducer, signal);

			// Should still update milestone state
			expect(newState.review.currentMilestoneId).toBe("M1");
			expect(newState.review.phase).toBe("reviewing_milestone");
		});
	});

	describe("milestoneRetryReducer", () => {
		it("sets current milestone ID", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:retry", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestoneRetryReducer, signal);

			expect(newState.review.currentMilestoneId).toBe("M1");
		});

		it("transitions review phase to 'reviewing_milestone'", () => {
			const state = createStateWithTasks();
			state.review.phase = "idle";

			const signal = createSignal("milestone:retry", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestoneRetryReducer, signal);

			expect(newState.review.phase).toBe("reviewing_milestone");
		});

		it("resets all tasks in milestone to 'pending'", () => {
			const state = createStateWithTasks();
			// Mark all tasks in M1 as complete
			const task1 = state.planning.allTasks.T001;
			const task2 = state.planning.allTasks.T002;
			if (task1) task1.status = "complete";
			if (task2) task2.status = "complete";

			const signal = createSignal("milestone:retry", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestoneRetryReducer, signal);

			expect(newState.planning.allTasks.T001?.status).toBe("pending");
			expect(newState.planning.allTasks.T002?.status).toBe("pending");
			// T003 is in M2, should be unchanged
			expect(newState.planning.allTasks.T003?.status).toBe("pending");
		});

		it("handles retry with error message", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:retry", {
				milestoneId: "M1",
				error: "Previous attempt failed due to timeout",
			});

			const newState = applyReducer(state, milestoneRetryReducer, signal);

			expect(newState.review.currentMilestoneId).toBe("M1");
			expect(newState.review.phase).toBe("reviewing_milestone");
		});

		it("handles nonexistent milestone gracefully", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:retry", {
				milestoneId: "NONEXISTENT",
			});

			const newState = applyReducer(state, milestoneRetryReducer, signal);

			// Should still set milestone ID
			expect(newState.review.currentMilestoneId).toBe("NONEXISTENT");
			expect(newState.review.phase).toBe("reviewing_milestone");
		});
	});

	describe("workflowCompleteReducer", () => {
		it("transitions review phase to 'complete'", () => {
			const state = createStateWithTasks();
			state.review.phase = "idle";

			const signal = createSignal("workflow:complete", {
				reason: "all_milestones_passed",
			});

			const newState = applyReducer(state, workflowCompleteReducer, signal);

			expect(newState.review.phase).toBe("complete");
		});

		it("clears current milestone ID", () => {
			const state = createStateWithTasks();
			state.review.currentMilestoneId = "M1";

			const signal = createSignal("workflow:complete", {
				reason: "all_milestones_passed",
			});

			const newState = applyReducer(state, workflowCompleteReducer, signal);

			expect(newState.review.currentMilestoneId).toBeNull();
		});

		it("transitions execution phase to 'idle'", () => {
			const state = createStateWithTasks();
			state.execution.phase = "executing_task";

			const signal = createSignal("workflow:complete", {
				reason: "all_milestones_passed",
			});

			const newState = applyReducer(state, workflowCompleteReducer, signal);

			expect(newState.execution.phase).toBe("idle");
		});

		it("clears current task ID", () => {
			const state = createStateWithTasks();
			state.execution.currentTaskId = "T001";

			const signal = createSignal("workflow:complete", {
				reason: "all_milestones_passed",
			});

			const newState = applyReducer(state, workflowCompleteReducer, signal);

			expect(newState.execution.currentTaskId).toBeNull();
		});

		it("handles 'no_tasks' completion reason", () => {
			const state = createStateWithTasks();

			const signal = createSignal("workflow:complete", {
				reason: "no_tasks",
				state: state,
			});

			const newState = applyReducer(state, workflowCompleteReducer, signal);

			expect(newState.review.phase).toBe("complete");
		});

		it("handles completion with finalState in payload", () => {
			const state = createStateWithTasks();
			state.execution.phase = "executing_task";
			state.execution.currentTaskId = "T001";
			state.review.currentMilestoneId = "M1";

			const signal = createSignal("workflow:complete", {
				reason: "all_milestones_passed",
				finalState: state,
			});

			const newState = applyReducer(state, workflowCompleteReducer, signal);

			expect(newState.review.phase).toBe("complete");
			expect(newState.review.currentMilestoneId).toBeNull();
			expect(newState.execution.phase).toBe("idle");
			expect(newState.execution.currentTaskId).toBeNull();
		});
	});

	describe("reviewReducers export", () => {
		it("exports all review reducers", () => {
			expect(reviewReducers["task:approved"]).toBe(taskApprovedReducer);
			expect(reviewReducers["milestone:failed"]).toBe(milestoneFailedReducer);
			expect(reviewReducers["milestone:retry"]).toBe(milestoneRetryReducer);
			expect(reviewReducers["workflow:complete"]).toBe(workflowCompleteReducer);
		});

		it("has exactly 4 reducers", () => {
			expect(Object.keys(reviewReducers)).toHaveLength(4);
		});
	});
});
