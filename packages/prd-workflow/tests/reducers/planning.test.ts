/**
 * Tests for Planning Reducers
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
	discoveryReviewedReducer,
	discoverySubmittedReducer,
	planCreatedReducer,
	planningReducers,
	planStartReducer,
} from "../../src/reducers/planning.js";
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

describe("Planning Reducers", () => {
	describe("planStartReducer", () => {
		it("transitions phase to 'planning'", () => {
			const state = createInitialState("Initial PRD");
			const signal = createSignal("plan:start", {});

			const newState = applyReducer(state, planStartReducer, signal);

			expect(newState.planning.phase).toBe("planning");
		});

		it("updates PRD when provided in payload", () => {
			const state = createInitialState("Initial PRD");
			const signal = createSignal("plan:start", { prd: "Updated PRD content" });

			const newState = applyReducer(state, planStartReducer, signal);

			expect(newState.planning.phase).toBe("planning");
			expect(newState.planning.prd).toBe("Updated PRD content");
		});

		it("preserves existing PRD when not provided", () => {
			const state = createInitialState("Original PRD");
			const signal = createSignal("plan:start", {});

			const newState = applyReducer(state, planStartReducer, signal);

			expect(newState.planning.prd).toBe("Original PRD");
		});
	});

	describe("planCreatedReducer", () => {
		it("stores tasks in allTasks map", () => {
			const state = createInitialState("Test PRD");
			const tasks = [createTask({ id: "T001", title: "Task 1" }), createTask({ id: "T002", title: "Task 2" })];
			const milestones = [createMilestone({ taskIds: ["T001", "T002"] })];
			const signal = createSignal("plan:created", {
				tasks,
				milestones,
				taskOrder: ["T001", "T002"],
			});

			const newState = applyReducer(state, planCreatedReducer, signal);

			expect(newState.planning.allTasks.T001).toBeDefined();
			expect(newState.planning.allTasks.T001?.title).toBe("Task 1");
			expect(newState.planning.allTasks.T002).toBeDefined();
			expect(newState.planning.allTasks.T002?.title).toBe("Task 2");
		});

		it("stores milestones", () => {
			const state = createInitialState("Test PRD");
			const milestones = [
				createMilestone({ id: "M1", title: "Milestone 1" }),
				createMilestone({ id: "M2", title: "Milestone 2" }),
			];
			const signal = createSignal("plan:created", {
				tasks: [],
				milestones,
				taskOrder: [],
			});

			const newState = applyReducer(state, planCreatedReducer, signal);

			expect(newState.planning.milestones).toHaveLength(2);
			expect(newState.planning.milestones[0]?.id).toBe("M1");
			expect(newState.planning.milestones[1]?.id).toBe("M2");
		});

		it("stores task order", () => {
			const state = createInitialState("Test PRD");
			const signal = createSignal("plan:created", {
				tasks: [createTask({ id: "T001" }), createTask({ id: "T002" })],
				milestones: [],
				taskOrder: ["T001", "T002"],
			});

			const newState = applyReducer(state, planCreatedReducer, signal);

			expect(newState.planning.taskOrder).toEqual(["T001", "T002"]);
		});

		it("transitions phase to 'plan_complete'", () => {
			const state = createInitialState("Test PRD");
			const signal = createSignal("plan:created", {
				tasks: [],
				milestones: [],
				taskOrder: [],
			});

			const newState = applyReducer(state, planCreatedReducer, signal);

			expect(newState.planning.phase).toBe("plan_complete");
		});
	});

	describe("discoverySubmittedReducer", () => {
		it("stores discoveries in execution state", () => {
			const state = createInitialState("Test PRD");
			const discoveries = [
				{ title: "Bug Found", description: "A bug was discovered" },
				{ title: "Refactor Needed", description: "Code needs refactoring" },
			];
			const signal = createSignal("discovery:submitted", {
				discoveries,
				count: 2,
				sourceTaskId: "T001",
			});

			const newState = applyReducer(state, discoverySubmittedReducer, signal);

			expect(newState.execution.pendingDiscoveries).toHaveLength(2);
			expect(newState.execution.pendingDiscoveries[0]?.title).toBe("Bug Found");
		});

		it("transitions planning phase to 'discovery_review'", () => {
			const state = createInitialState("Test PRD");
			const signal = createSignal("discovery:submitted", {
				discoveries: [{ title: "Discovery", description: "Test" }],
				count: 1,
				sourceTaskId: "T001",
			});

			const newState = applyReducer(state, discoverySubmittedReducer, signal);

			expect(newState.planning.phase).toBe("discovery_review");
		});
	});

	describe("discoveryReviewedReducer", () => {
		it("adds accepted tasks to allTasks", () => {
			const state = createInitialState("Test PRD");
			state.planning.milestones = [createMilestone({ id: "M1", taskIds: [] })];
			const acceptedTask = createTask({
				id: "T-NEW",
				title: "New Task from Discovery",
				milestoneId: "M1",
			});
			const signal = createSignal("discovery:reviewed", {
				accepted: 1,
				rejected: 0,
				acceptedTasks: [acceptedTask],
			});

			const newState = applyReducer(state, discoveryReviewedReducer, signal);

			expect(newState.planning.allTasks["T-NEW"]).toBeDefined();
			expect(newState.planning.allTasks["T-NEW"]?.title).toBe("New Task from Discovery");
		});

		it("adds accepted tasks to task order", () => {
			const state = createInitialState("Test PRD");
			state.planning.taskOrder = ["T001"];
			const acceptedTask = createTask({ id: "T-NEW" });
			const signal = createSignal("discovery:reviewed", {
				accepted: 1,
				rejected: 0,
				acceptedTasks: [acceptedTask],
			});

			const newState = applyReducer(state, discoveryReviewedReducer, signal);

			expect(newState.planning.taskOrder).toContain("T-NEW");
		});

		it("adds accepted tasks to their milestone", () => {
			const state = createInitialState("Test PRD");
			state.planning.milestones = [createMilestone({ id: "M1", taskIds: ["T001"] })];
			const acceptedTask = createTask({
				id: "T-NEW",
				milestoneId: "M1",
			});
			const signal = createSignal("discovery:reviewed", {
				accepted: 1,
				rejected: 0,
				acceptedTasks: [acceptedTask],
			});

			const newState = applyReducer(state, discoveryReviewedReducer, signal);

			expect(newState.planning.milestones[0]?.taskIds).toContain("T-NEW");
		});

		it("clears pending discoveries", () => {
			const state = createInitialState("Test PRD");
			state.execution.pendingDiscoveries = [{ title: "Discovery", description: "Test" }];
			const signal = createSignal("discovery:reviewed", {
				accepted: 0,
				rejected: 1,
			});

			const newState = applyReducer(state, discoveryReviewedReducer, signal);

			expect(newState.execution.pendingDiscoveries).toHaveLength(0);
		});

		it("transitions planning phase to 'plan_complete'", () => {
			const state = createInitialState("Test PRD");
			state.planning.phase = "discovery_review";
			const signal = createSignal("discovery:reviewed", {
				accepted: 0,
				rejected: 0,
			});

			const newState = applyReducer(state, discoveryReviewedReducer, signal);

			expect(newState.planning.phase).toBe("plan_complete");
		});
	});

	describe("planningReducers export", () => {
		it("exports all planning reducers", () => {
			expect(planningReducers["plan:start"]).toBe(planStartReducer);
			expect(planningReducers["plan:created"]).toBe(planCreatedReducer);
			expect(planningReducers["discovery:submitted"]).toBe(discoverySubmittedReducer);
			expect(planningReducers["discovery:reviewed"]).toBe(discoveryReviewedReducer);
		});

		it("has exactly 4 reducers", () => {
			expect(Object.keys(planningReducers)).toHaveLength(4);
		});
	});
});
