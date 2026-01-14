/**
 * Tests for Execution Reducers
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
	executionReducers,
	fixRequiredReducer,
	milestonePassedReducer,
	milestoneTestableReducer,
	taskCompleteReducer,
	taskReadyReducer,
} from "../../src/reducers/execution.js";
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
 * Helper to get a task from state, asserting it exists
 */
function getTask(state: PRDWorkflowState, taskId: string): Task {
	const task = state.planning.allTasks[taskId];
	if (!task) {
		throw new Error(`Test setup error: task ${taskId} not found`);
	}
	return task;
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

describe("Execution Reducers", () => {
	describe("taskReadyReducer", () => {
		it("sets current task ID", () => {
			const state = createStateWithTasks();
			const signal = createSignal("task:ready", {
				taskId: "T001",
				title: "Task 1",
				description: "First task",
				definitionOfDone: ["Test passes"],
			});

			const newState = applyReducer(state, taskReadyReducer, signal);

			expect(newState.execution.currentTaskId).toBe("T001");
		});

		it("transitions execution phase to 'executing_task'", () => {
			const state = createStateWithTasks();
			const signal = createSignal("task:ready", {
				taskId: "T001",
				title: "Task 1",
				description: "First task",
				definitionOfDone: [],
			});

			const newState = applyReducer(state, taskReadyReducer, signal);

			expect(newState.execution.phase).toBe("executing_task");
		});

		it("sets task status to 'in_progress'", () => {
			const state = createStateWithTasks();
			expect(state.planning.allTasks.T001?.status).toBe("pending");

			const signal = createSignal("task:ready", {
				taskId: "T001",
				title: "Task 1",
				description: "First task",
				definitionOfDone: [],
			});

			const newState = applyReducer(state, taskReadyReducer, signal);

			expect(newState.planning.allTasks.T001?.status).toBe("in_progress");
		});

		it("handles missing task gracefully", () => {
			const state = createStateWithTasks();
			const signal = createSignal("task:ready", {
				taskId: "NONEXISTENT",
				title: "Missing Task",
				description: "This task does not exist",
				definitionOfDone: [],
			});

			const newState = applyReducer(state, taskReadyReducer, signal);

			// Should still set current task ID
			expect(newState.execution.currentTaskId).toBe("NONEXISTENT");
			expect(newState.execution.phase).toBe("executing_task");
		});
	});

	describe("taskCompleteReducer", () => {
		it("marks task as complete", () => {
			const state = createStateWithTasks();
			getTask(state, "T001").status = "in_progress";
			state.execution.currentTaskId = "T001";

			const signal = createSignal("task:complete", {
				taskId: "T001",
				outcome: "success",
				summary: "Task completed successfully",
			});

			const newState = applyReducer(state, taskCompleteReducer, signal);

			expect(newState.planning.allTasks.T001?.status).toBe("complete");
		});

		it("increments attempt counter", () => {
			const state = createStateWithTasks();
			const task = getTask(state, "T001");
			task.status = "in_progress";
			task.attempt = 0;

			const signal = createSignal("task:complete", {
				taskId: "T001",
				outcome: "success",
				summary: "First attempt succeeded",
			});

			const newState = applyReducer(state, taskCompleteReducer, signal);

			expect(newState.planning.allTasks.T001?.attempt).toBe(1);
		});

		it("records attempt in history", () => {
			const state = createStateWithTasks();
			getTask(state, "T001").status = "in_progress";

			const signal = createSignal("task:complete", {
				taskId: "T001",
				outcome: "success",
				summary: "Task completed successfully",
				filesChanged: ["src/foo.ts", "src/bar.ts"],
				checkpointHash: "abc123",
			});

			const newState = applyReducer(state, taskCompleteReducer, signal);

			expect(newState.planning.allTasks.T001?.attemptHistory).toHaveLength(1);
			const record = newState.planning.allTasks.T001?.attemptHistory[0];
			expect(record?.attempt).toBe(1);
			expect(record?.outcome).toBe("success");
			expect(record?.summary).toBe("Task completed successfully");
			expect(record?.filesChanged).toEqual(["src/foo.ts", "src/bar.ts"]);
			expect(record?.checkpointHash).toBe("abc123");
		});

		it("transitions execution phase to 'awaiting_review'", () => {
			const state = createStateWithTasks();
			state.execution.phase = "executing_task";

			const signal = createSignal("task:complete", {
				taskId: "T001",
				outcome: "success",
				summary: "Done",
			});

			const newState = applyReducer(state, taskCompleteReducer, signal);

			expect(newState.execution.phase).toBe("awaiting_review");
		});

		it("handles partial outcome", () => {
			const state = createStateWithTasks();
			getTask(state, "T001").status = "in_progress";

			const signal = createSignal("task:complete", {
				taskId: "T001",
				outcome: "partial",
				summary: "Partially completed",
			});

			const newState = applyReducer(state, taskCompleteReducer, signal);

			expect(newState.planning.allTasks.T001?.attemptHistory[0]?.outcome).toBe("partial");
		});

		it("handles failure outcome", () => {
			const state = createStateWithTasks();
			getTask(state, "T001").status = "in_progress";

			const signal = createSignal("task:complete", {
				taskId: "T001",
				outcome: "failure",
				summary: "Task failed",
			});

			const newState = applyReducer(state, taskCompleteReducer, signal);

			expect(newState.planning.allTasks.T001?.status).toBe("complete");
			expect(newState.planning.allTasks.T001?.attemptHistory[0]?.outcome).toBe("failure");
		});
	});

	describe("fixRequiredReducer", () => {
		it("sets current task to the failing task", () => {
			const state = createStateWithTasks();
			state.execution.currentTaskId = null;

			const signal = createSignal("fix:required", {
				taskId: "T001",
				milestoneId: "M1",
				error: "Test failed",
				attempt: 2,
			});

			const newState = applyReducer(state, fixRequiredReducer, signal);

			expect(newState.execution.currentTaskId).toBe("T001");
		});

		it("transitions execution phase to 'fixing'", () => {
			const state = createStateWithTasks();
			state.execution.phase = "idle";

			const signal = createSignal("fix:required", {
				taskId: "T001",
				milestoneId: "M1",
				attempt: 2,
			});

			const newState = applyReducer(state, fixRequiredReducer, signal);

			expect(newState.execution.phase).toBe("fixing");
		});

		it("sets task status back to 'in_progress'", () => {
			const state = createStateWithTasks();
			getTask(state, "T001").status = "complete";

			const signal = createSignal("fix:required", {
				taskId: "T001",
				milestoneId: "M1",
				attempt: 2,
			});

			const newState = applyReducer(state, fixRequiredReducer, signal);

			expect(newState.planning.allTasks.T001?.status).toBe("in_progress");
		});

		it("updates attempt counter to the provided value", () => {
			const state = createStateWithTasks();
			getTask(state, "T001").attempt = 1;

			const signal = createSignal("fix:required", {
				taskId: "T001",
				milestoneId: "M1",
				attempt: 2,
			});

			const newState = applyReducer(state, fixRequiredReducer, signal);

			expect(newState.planning.allTasks.T001?.attempt).toBe(2);
		});

		it("sets current milestone for review context", () => {
			const state = createStateWithTasks();

			const signal = createSignal("fix:required", {
				taskId: "T001",
				milestoneId: "M1",
				attempt: 2,
			});

			const newState = applyReducer(state, fixRequiredReducer, signal);

			expect(newState.review.currentMilestoneId).toBe("M1");
		});
	});

	describe("milestoneTestableReducer", () => {
		it("sets current milestone for review", () => {
			const state = createStateWithTasks();

			const signal = createSignal("milestone:testable", {
				milestoneId: "M1",
				taskIds: ["T001", "T002"],
			});

			const newState = applyReducer(state, milestoneTestableReducer, signal);

			expect(newState.review.currentMilestoneId).toBe("M1");
		});

		it("transitions review phase to 'reviewing_milestone'", () => {
			const state = createStateWithTasks();
			state.review.phase = "idle";

			const signal = createSignal("milestone:testable", {
				milestoneId: "M1",
				taskIds: ["T001", "T002"],
			});

			const newState = applyReducer(state, milestoneTestableReducer, signal);

			expect(newState.review.phase).toBe("reviewing_milestone");
		});

		it("clears execution phase (no active task during milestone review)", () => {
			const state = createStateWithTasks();
			state.execution.phase = "executing_task";
			state.execution.currentTaskId = "T002";

			const signal = createSignal("milestone:testable", {
				milestoneId: "M1",
				taskIds: ["T001", "T002"],
			});

			const newState = applyReducer(state, milestoneTestableReducer, signal);

			expect(newState.execution.phase).toBe("idle");
			// Note: currentTaskId is not cleared - milestone tests may need to know the last task
		});
	});

	describe("milestonePassedReducer", () => {
		it("marks milestone as passed in milestones array", () => {
			const state = createStateWithTasks();
			expect(state.planning.milestones[0]?.passed).toBe(false);

			const signal = createSignal("milestone:passed", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestonePassedReducer, signal);

			expect(newState.planning.milestones[0]?.passed).toBe(true);
		});

		it("adds milestone to passedMilestones list", () => {
			const state = createStateWithTasks();
			expect(state.review.passedMilestones).toHaveLength(0);

			const signal = createSignal("milestone:passed", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestonePassedReducer, signal);

			expect(newState.review.passedMilestones).toContain("M1");
		});

		it("clears current milestone after passing", () => {
			const state = createStateWithTasks();
			state.review.currentMilestoneId = "M1";

			const signal = createSignal("milestone:passed", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestonePassedReducer, signal);

			expect(newState.review.currentMilestoneId).toBeNull();
		});

		it("transitions review phase to 'idle'", () => {
			const state = createStateWithTasks();
			state.review.phase = "reviewing_milestone";

			const signal = createSignal("milestone:passed", {
				milestoneId: "M1",
			});

			const newState = applyReducer(state, milestonePassedReducer, signal);

			expect(newState.review.phase).toBe("idle");
		});

		it("accumulates passed milestones", () => {
			let state = createStateWithTasks();

			// Pass first milestone
			const signal1 = createSignal("milestone:passed", { milestoneId: "M1" });
			state = applyReducer(state, milestonePassedReducer, signal1);

			// Pass second milestone
			const signal2 = createSignal("milestone:passed", { milestoneId: "M2" });
			state = applyReducer(state, milestonePassedReducer, signal2);

			expect(state.review.passedMilestones).toEqual(["M1", "M2"]);
		});
	});

	describe("executionReducers export", () => {
		it("exports all execution reducers", () => {
			expect(executionReducers["task:ready"]).toBe(taskReadyReducer);
			expect(executionReducers["task:complete"]).toBe(taskCompleteReducer);
			expect(executionReducers["fix:required"]).toBe(fixRequiredReducer);
			expect(executionReducers["milestone:testable"]).toBe(milestoneTestableReducer);
			expect(executionReducers["milestone:passed"]).toBe(milestonePassedReducer);
		});

		it("has exactly 5 reducers", () => {
			expect(Object.keys(executionReducers)).toHaveLength(5);
		});
	});
});
