/**
 * Tests for PRD Workflow Process Managers
 *
 * Process managers are pure functions that receive read-only state
 * and return signals for orchestration.
 */

import { describe, expect, it } from "bun:test";
import { createSignal, type Signal } from "@internal/signals-core";
import { processes } from "../src/processes/index.js";
import { createInitialState, type PRDWorkflowState, type Task } from "../src/types.js";

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
 * Helper to create a state with tasks for testing
 */
function createStateWithTasks(tasks: Task[]): PRDWorkflowState {
	const state = createInitialState("Test PRD");

	const allTasks: Record<string, Task> = {};
	const taskOrder: string[] = [];

	for (const task of tasks) {
		allTasks[task.id] = task;
		taskOrder.push(task.id);
	}

	return {
		...state,
		planning: {
			...state.planning,
			allTasks,
			taskOrder,
			milestones: [
				{
					id: "milestone-1",
					title: "Milestone 1",
					taskIds: tasks.map((t) => t.id),
					passed: false,
				},
			],
		},
	};
}

/**
 * Helper to safely get first signal from result array
 */
function getFirstSignal(result: Signal[] | undefined): Signal {
	expect(result).toBeDefined();
	expect(result).toHaveLength(1);
	const first = result?.[0];
	expect(first).toBeDefined();
	return first as Signal;
}

describe("processes", () => {
	describe("plan:created", () => {
		it("emits task:ready for first pending task", () => {
			const task = createTask({ id: "T001", title: "First Task" });
			const state = createStateWithTasks([task]);
			const signal = createSignal("plan:created", { plan: {} });

			const result = processes["plan:created"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("task:ready");
			expect(emitted.payload).toMatchObject({
				taskId: "T001",
				title: "First Task",
			});
		});

		it("skips completed tasks and finds first pending", () => {
			const task1 = createTask({ id: "T001", title: "Completed", status: "complete" });
			const task2 = createTask({ id: "T002", title: "Pending" });
			const state = createStateWithTasks([task1, task2]);
			const signal = createSignal("plan:created", { plan: {} });

			const result = processes["plan:created"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("task:ready");
			expect(emitted.payload).toMatchObject({
				taskId: "T002",
				title: "Pending",
			});
		});

		it("emits workflow:complete when no tasks exist", () => {
			const state = createInitialState("Empty PRD");
			const signal = createSignal("plan:created", { plan: {} });

			const result = processes["plan:created"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("workflow:complete");
			expect(emitted.payload).toMatchObject({
				reason: "no_tasks",
			});
		});
	});

	describe("task:complete", () => {
		it("emits discovery:submitted when discoveries exist", () => {
			const state = createStateWithTasks([createTask()]);
			state.execution.currentTaskId = "task-1";
			state.execution.pendingDiscoveries = [
				{
					title: "Discovered Bug",
					description: "Found a bug during implementation",
				},
			];
			const signal = createSignal("task:complete", { output: {} });

			const result = processes["task:complete"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("discovery:submitted");
			expect(emitted.payload).toMatchObject({
				count: 1,
				sourceTaskId: "task-1",
			});
		});

		it("emits nothing when no discoveries", () => {
			const state = createStateWithTasks([createTask()]);
			state.execution.currentTaskId = "task-1";
			const signal = createSignal("task:complete", { output: {} });

			const result = processes["task:complete"]?.(state, signal);

			expect(result).toBeDefined();
			expect(result).toHaveLength(0);
		});
	});

	describe("task:approved", () => {
		it("emits milestone:testable when all tasks complete", () => {
			const task = createTask({ id: "T001", status: "complete" });
			const state = createStateWithTasks([task]);
			state.execution.currentTaskId = "T001";
			const signal = createSignal("task:approved", { taskId: "T001" });

			const result = processes["task:approved"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("milestone:testable");
			expect(emitted.payload).toMatchObject({
				milestoneId: "milestone-1",
			});
		});

		it("emits task:ready for next pending task", () => {
			const task1 = createTask({ id: "T001", status: "complete" });
			const task2 = createTask({ id: "T002", title: "Next Task" });
			const state = createStateWithTasks([task1, task2]);
			state.execution.currentTaskId = "T001";
			// Update milestone to include both tasks
			state.planning.milestones = [
				{
					id: "milestone-1",
					title: "Milestone 1",
					taskIds: ["T001", "T002"],
					passed: false,
				},
			];
			const signal = createSignal("task:approved", { taskId: "T001" });

			const result = processes["task:approved"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("task:ready");
			expect(emitted.payload).toMatchObject({
				taskId: "T002",
				title: "Next Task",
			});
		});
	});

	describe("milestone:passed", () => {
		it("emits workflow:complete when all milestones passed", () => {
			const task = createTask({ id: "T001", status: "complete" });
			const state = createStateWithTasks([task]);
			state.review.passedMilestones = ["milestone-1"];
			const signal = createSignal("milestone:passed", { milestoneId: "milestone-1" });

			const result = processes["milestone:passed"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("workflow:complete");
			expect(emitted.payload).toMatchObject({
				reason: "all_milestones_passed",
			});
		});

		it("emits task:ready for next pending task", () => {
			const task1 = createTask({ id: "T001", status: "complete", milestoneId: "milestone-1" });
			const task2 = createTask({ id: "T002", title: "Next", milestoneId: "milestone-2" });
			const state = createStateWithTasks([task1, task2]);
			state.planning.milestones = [
				{ id: "milestone-1", title: "M1", taskIds: ["T001"], passed: false },
				{ id: "milestone-2", title: "M2", taskIds: ["T002"], passed: false },
			];
			state.review.passedMilestones = ["milestone-1"];
			const signal = createSignal("milestone:passed", { milestoneId: "milestone-1" });

			const result = processes["milestone:passed"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("task:ready");
			expect(emitted.payload).toMatchObject({
				taskId: "T002",
			});
		});
	});

	describe("milestone:failed", () => {
		it("emits fix:required for failing task", () => {
			const task = createTask({ id: "T001", attempt: 1 });
			const state = createStateWithTasks([task]);
			const signal = createSignal("milestone:failed", {
				milestoneId: "milestone-1",
				failingTaskId: "T001",
				error: "Test failed",
			});

			const result = processes["milestone:failed"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("fix:required");
			expect(emitted.payload).toMatchObject({
				taskId: "T001",
				milestoneId: "milestone-1",
				error: "Test failed",
				attempt: 2,
			});
		});

		it("emits milestone:retry when no specific failing task", () => {
			const state = createStateWithTasks([createTask()]);
			const signal = createSignal("milestone:failed", {
				milestoneId: "milestone-1",
				error: "Unknown failure",
			});

			const result = processes["milestone:failed"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("milestone:retry");
			expect(emitted.payload).toMatchObject({
				milestoneId: "milestone-1",
			});
		});
	});

	describe("discovery:reviewed", () => {
		it("emits task:approved after discovery review", () => {
			const state = createStateWithTasks([createTask()]);
			state.execution.currentTaskId = "task-1";
			const signal = createSignal("discovery:reviewed", {
				accepted: 2,
				rejected: 1,
			});

			const result = processes["discovery:reviewed"]?.(state, signal);
			const emitted = getFirstSignal(result);

			expect(emitted.name).toBe("task:approved");
			expect(emitted.payload).toMatchObject({
				taskId: "task-1",
				hadDiscoveries: true,
			});
		});
	});
});
