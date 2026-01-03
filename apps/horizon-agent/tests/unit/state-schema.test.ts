/**
 * Unit tests for Horizon Agent State Schema
 */

import { describe, expect, test } from "bun:test";
import {
	CompletedTaskSchema,
	HorizonStateSchema,
	INITIAL_STATE,
	ReviewFeedbackSchema,
	ReviewIterationSchema,
	TaskSchema,
	WorkflowStatusSchema,
	horizonStateDefinition,
} from "../../src/runtime/state-schema.js";

describe("TaskSchema", () => {
	test("validates valid task", () => {
		const task = {
			id: "task-1",
			title: "Implement feature",
			description: "Add the new feature",
			dependencies: ["task-0"],
		};
		const result = TaskSchema.safeParse(task);
		expect(result.success).toBe(true);
	});

	test("applies default dependencies", () => {
		const task = {
			id: "task-1",
			title: "Implement feature",
			description: "Add the new feature",
		};
		const result = TaskSchema.parse(task);
		expect(result.dependencies).toEqual([]);
	});

	test("rejects task without required fields", () => {
		const task = { id: "task-1" };
		const result = TaskSchema.safeParse(task);
		expect(result.success).toBe(false);
	});
});

describe("ReviewFeedbackSchema", () => {
	test("validates passing review", () => {
		const feedback = {
			passed: true,
			feedback: "LGTM",
			issues: [],
		};
		const result = ReviewFeedbackSchema.safeParse(feedback);
		expect(result.success).toBe(true);
	});

	test("validates failing review with issues", () => {
		const feedback = {
			passed: false,
			feedback: "Needs work",
			issues: ["Missing error handling", "No tests"],
		};
		const result = ReviewFeedbackSchema.parse(feedback);
		expect(result.passed).toBe(false);
		expect(result.issues).toHaveLength(2);
	});

	test("applies default issues array", () => {
		const feedback = {
			passed: true,
			feedback: "LGTM",
		};
		const result = ReviewFeedbackSchema.parse(feedback);
		expect(result.issues).toEqual([]);
	});
});

describe("ReviewIterationSchema", () => {
	test("validates iteration record", () => {
		const iteration = {
			iteration: 1,
			timestamp: "2025-01-03T12:00:00Z",
			passed: false,
			feedback: "Needs improvement",
			issues: ["Missing validation"],
		};
		const result = ReviewIterationSchema.safeParse(iteration);
		expect(result.success).toBe(true);
	});
});

describe("CompletedTaskSchema", () => {
	test("validates completed task with history", () => {
		const completed = {
			task: {
				id: "task-1",
				title: "Implement feature",
				description: "Add the new feature",
				dependencies: [],
			},
			completedAt: "2025-01-03T12:30:00Z",
			totalIterations: 2,
			reviewHistory: [
				{
					iteration: 1,
					timestamp: "2025-01-03T12:00:00Z",
					passed: false,
					feedback: "Needs work",
					issues: ["Missing tests"],
				},
				{
					iteration: 2,
					timestamp: "2025-01-03T12:30:00Z",
					passed: true,
					feedback: "LGTM",
					issues: [],
				},
			],
		};
		const result = CompletedTaskSchema.safeParse(completed);
		expect(result.success).toBe(true);
	});
});

describe("WorkflowStatusSchema", () => {
	test("accepts valid statuses", () => {
		const statuses = ["idle", "planning", "executing", "paused", "completed", "failed"];
		for (const status of statuses) {
			const result = WorkflowStatusSchema.safeParse(status);
			expect(result.success).toBe(true);
		}
	});

	test("rejects invalid status", () => {
		const result = WorkflowStatusSchema.safeParse("running");
		expect(result.success).toBe(false);
	});
});

describe("HorizonStateSchema", () => {
	test("validates full state", () => {
		const state = {
			tasks: [
				{
					id: "task-1",
					title: "First task",
					description: "Do something",
					dependencies: [],
				},
			],
			planCreatedAt: "2025-01-03T12:00:00Z",
			currentTaskIndex: 0,
			currentIteration: 1,
			reviewFeedback: {
				passed: false,
				feedback: "Needs work",
				issues: ["Issue 1"],
			},
			completedTasks: [],
			startedAt: "2025-01-03T12:00:00Z",
			completedAt: null,
			status: "executing",
		};
		const result = HorizonStateSchema.safeParse(state);
		expect(result.success).toBe(true);
	});

	test("applies all defaults for minimal input", () => {
		const state = {};
		const result = HorizonStateSchema.parse(state);
		expect(result.tasks).toEqual([]);
		expect(result.planCreatedAt).toBeNull();
		expect(result.currentTaskIndex).toBe(0);
		expect(result.currentIteration).toBe(0);
		expect(result.reviewFeedback).toBeNull();
		expect(result.completedTasks).toEqual([]);
		expect(result.startedAt).toBeNull();
		expect(result.completedAt).toBeNull();
		expect(result.status).toBe("idle");
	});
});

describe("INITIAL_STATE", () => {
	test("matches schema defaults", () => {
		const result = HorizonStateSchema.safeParse(INITIAL_STATE);
		expect(result.success).toBe(true);
	});

	test("has all expected fields", () => {
		expect(INITIAL_STATE.tasks).toEqual([]);
		expect(INITIAL_STATE.planCreatedAt).toBeNull();
		expect(INITIAL_STATE.currentTaskIndex).toBe(0);
		expect(INITIAL_STATE.currentIteration).toBe(0);
		expect(INITIAL_STATE.reviewFeedback).toBeNull();
		expect(INITIAL_STATE.completedTasks).toEqual([]);
		expect(INITIAL_STATE.startedAt).toBeNull();
		expect(INITIAL_STATE.completedAt).toBeNull();
		expect(INITIAL_STATE.status).toBe("idle");
	});
});

describe("horizonStateDefinition", () => {
	test("has initial property", () => {
		expect(horizonStateDefinition.initial).toBeDefined();
	});

	test("initial matches INITIAL_STATE", () => {
		expect(horizonStateDefinition.initial).toEqual(INITIAL_STATE);
	});
});
