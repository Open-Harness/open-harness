/**
 * PRD Workflow Signal Definitions Tests
 *
 * Tests that signal definitions:
 * - Create valid signals with correct payloads
 * - Attach display metadata correctly
 * - Provide working type guards via is()
 * - Have appropriate display types and statuses
 */

import { describe, expect, it } from "bun:test";
import { isSignal } from "@internal/signals-core";
import {
	DiscoveryReviewed,
	DiscoverySubmitted,
	FixRequired,
	MilestoneFailed,
	MilestonePassed,
	MilestoneRetry,
	MilestoneTestable,
	PlanCreated,
	PlanStart,
	PRD_SIGNAL_NAMES,
	PRDSignals,
	TaskApproved,
	TaskComplete,
	TaskReady,
	WorkflowComplete,
} from "./index.js";

describe("PRD Signal Definitions", () => {
	describe("PlanStart", () => {
		it("creates signal with empty payload", () => {
			const signal = PlanStart.create(undefined);

			expect(isSignal(signal)).toBe(true);
			expect(signal.name).toBe("plan:start");
			expect(signal.payload).toBeUndefined();
		});

		it("creates signal with optional prd", () => {
			const signal = PlanStart.create({ prd: "# My PRD" });

			expect(signal.payload).toEqual({ prd: "# My PRD" });
		});

		it("has correct display metadata", () => {
			const signal = PlanStart.create(undefined);

			expect(signal.display?.type).toBe("status");
			expect(signal.display?.title).toBe("Planning...");
			expect(signal.display?.status).toBe("active");
			expect(signal.display?.icon).toBe("📋");
		});

		it("is() type guard works", () => {
			const signal = PlanStart.create(undefined);
			const otherSignal = WorkflowComplete.create({ reason: "test" });

			expect(PlanStart.is(signal)).toBe(true);
			expect(PlanStart.is(otherSignal)).toBe(false);
		});
	});

	describe("PlanCreated", () => {
		const validPayload = {
			tasks: [
				{
					id: "T-001",
					title: "Task 1",
					description: "First task",
					milestoneId: "M-001",
					status: "pending" as const,
					attempt: 0,
					definitionOfDone: ["Item passes"],
					attemptHistory: [],
				},
			],
			milestones: [
				{
					id: "M-001",
					title: "Milestone 1",
					taskIds: ["T-001"],
					passed: false,
				},
			],
			taskOrder: ["T-001"],
		};

		it("creates signal with tasks and milestones", () => {
			const signal = PlanCreated.create(validPayload);

			expect(isSignal(signal)).toBe(true);
			expect(signal.name).toBe("plan:created");
			expect(signal.payload.tasks).toHaveLength(1);
			expect(signal.payload.milestones).toHaveLength(1);
		});

		it("has dynamic display title", () => {
			const signal = PlanCreated.create(validPayload);

			// Title is a function that resolves from payload
			expect(signal.display?.type).toBe("notification");
			expect(signal.display?.status).toBe("success");

			// Resolve dynamic title
			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("Plan created with 1 tasks");
			} else {
				throw new Error("Expected title to be a function");
			}
		});

		it("validates payload against schema", () => {
			// Invalid payload should throw
			expect(() =>
				PlanCreated.create({
					tasks: "not an array" as unknown as [],
					milestones: [],
					taskOrder: [],
				}),
			).toThrow();
		});
	});

	describe("TaskReady", () => {
		const validPayload = {
			taskId: "T-001",
			title: "Implement feature",
			description: "Add the feature",
			definitionOfDone: ["Tests pass", "Lint clean"],
		};

		it("creates signal with task details", () => {
			const signal = TaskReady.create(validPayload);

			expect(signal.name).toBe("task:ready");
			expect(signal.payload.taskId).toBe("T-001");
			expect(signal.payload.title).toBe("Implement feature");
		});

		it("has active status display", () => {
			const signal = TaskReady.create(validPayload);

			expect(signal.display?.type).toBe("status");
			expect(signal.display?.status).toBe("active");
			expect(signal.display?.icon).toBe("▶");

			// Dynamic title from payload
			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("Implement feature");
			}
		});
	});

	describe("TaskComplete", () => {
		it("creates success signal", () => {
			const signal = TaskComplete.create({
				taskId: "T-001",
				outcome: "success",
				summary: "Task completed successfully",
			});

			expect(signal.name).toBe("task:complete");
			expect(signal.payload.outcome).toBe("success");

			// Display has static values in simplified version
			expect(signal.display?.type).toBe("notification");
			expect(signal.display?.status).toBe("success");
			expect(signal.display?.icon).toBe("✓");
		});

		it("creates failure signal", () => {
			const signal = TaskComplete.create({
				taskId: "T-001",
				outcome: "failure",
				summary: "Tests failed",
			});

			expect(signal.payload.outcome).toBe("failure");
			// Title is dynamic and shows outcome
			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("Task T-001 failure");
			}
		});

		it("creates partial signal", () => {
			const signal = TaskComplete.create({
				taskId: "T-001",
				outcome: "partial",
				summary: "Partial completion",
			});

			expect(signal.payload.outcome).toBe("partial");
		});
	});

	describe("MilestonePassed", () => {
		it("creates signal with milestone ID", () => {
			const signal = MilestonePassed.create({ milestoneId: "M-001" });

			expect(signal.name).toBe("milestone:passed");
			expect(signal.payload.milestoneId).toBe("M-001");
			expect(signal.display?.type).toBe("notification");
			expect(signal.display?.status).toBe("success");
		});
	});

	describe("MilestoneFailed", () => {
		it("creates signal with error details", () => {
			const signal = MilestoneFailed.create({
				milestoneId: "M-001",
				failingTaskId: "T-002",
				error: "Test assertion failed",
			});

			expect(signal.name).toBe("milestone:failed");
			expect(signal.display?.status).toBe("error");
			expect(signal.display?.icon).toBe("✗");
		});
	});

	describe("WorkflowComplete", () => {
		it("creates signal for all_milestones_passed", () => {
			const signal = WorkflowComplete.create({ reason: "all_milestones_passed" });

			expect(signal.name).toBe("workflow:complete");

			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("Workflow complete - all milestones passed");
			}
		});

		it("creates signal for no_tasks", () => {
			const signal = WorkflowComplete.create({ reason: "no_tasks" });

			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("Workflow complete - no tasks to execute");
			}
		});

		it("creates signal for custom reason", () => {
			const signal = WorkflowComplete.create({ reason: "user_cancelled" });

			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("Workflow complete - user_cancelled");
			}
		});
	});

	describe("Discovery signals", () => {
		it("DiscoverySubmitted creates correctly", () => {
			const signal = DiscoverySubmitted.create({
				discoveries: [{ title: "New task", description: "Found during work" }],
				count: 1,
				sourceTaskId: "T-001",
			});

			expect(signal.name).toBe("discovery:submitted");
			expect(signal.display?.status).toBe("warning");
		});

		it("DiscoveryReviewed with accepted tasks", () => {
			const signal = DiscoveryReviewed.create({
				accepted: 2,
				rejected: 1,
			});

			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("2 tasks added to plan");
			}
		});

		it("DiscoveryReviewed with no accepted tasks", () => {
			const signal = DiscoveryReviewed.create({
				accepted: 0,
				rejected: 3,
			});

			const title = signal.display?.title;
			if (typeof title === "function") {
				expect(title(signal.payload)).toBe("No tasks added");
			}
		});
	});

	describe("Fix and retry signals", () => {
		it("FixRequired creates with attempt info", () => {
			const signal = FixRequired.create({
				taskId: "T-001",
				milestoneId: "M-001",
				error: "Test failed",
				attempt: 2,
			});

			expect(signal.name).toBe("fix:required");
			expect(signal.display?.status).toBe("warning");
		});

		it("MilestoneRetry creates correctly", () => {
			const signal = MilestoneRetry.create({
				milestoneId: "M-001",
			});

			expect(signal.name).toBe("milestone:retry");
			expect(signal.display?.icon).toBe("🔄");
		});

		it("MilestoneTestable creates correctly", () => {
			const signal = MilestoneTestable.create({
				milestoneId: "M-001",
				taskIds: ["T-001", "T-002"],
			});

			expect(signal.name).toBe("milestone:testable");
			expect(signal.display?.status).toBe("active");
		});

		it("TaskApproved creates correctly", () => {
			const signal = TaskApproved.create({
				taskId: "T-001",
				hadDiscoveries: true,
			});

			expect(signal.name).toBe("task:approved");
			expect(signal.display?.status).toBe("success");
		});
	});

	describe("Signal registry", () => {
		it("PRDSignals contains all signal definitions", () => {
			expect(Object.keys(PRDSignals)).toHaveLength(13);
			expect(PRDSignals.PlanStart).toBe(PlanStart);
			expect(PRDSignals.PlanCreated).toBe(PlanCreated);
			expect(PRDSignals.TaskReady).toBe(TaskReady);
			expect(PRDSignals.WorkflowComplete).toBe(WorkflowComplete);
		});

		it("PRD_SIGNAL_NAMES has correct values", () => {
			expect(PRD_SIGNAL_NAMES.PLAN_START).toBe("plan:start");
			expect(PRD_SIGNAL_NAMES.PLAN_CREATED).toBe("plan:created");
			expect(PRD_SIGNAL_NAMES.WORKFLOW_COMPLETE).toBe("workflow:complete");
		});
	});

	describe("is() type guards", () => {
		it("correctly identifies matching signals", () => {
			const planCreated = PlanCreated.create({
				tasks: [],
				milestones: [],
				taskOrder: [],
			});
			const taskReady = TaskReady.create({
				taskId: "T-001",
				title: "Test",
				description: "Desc",
				definitionOfDone: [],
			});

			expect(PlanCreated.is(planCreated)).toBe(true);
			expect(TaskReady.is(taskReady)).toBe(true);

			// Cross-check should fail
			expect(PlanCreated.is(taskReady)).toBe(false);
			expect(TaskReady.is(planCreated)).toBe(false);
		});

		it("rejects non-signals", () => {
			expect(PlanCreated.is(null)).toBe(false);
			expect(PlanCreated.is(undefined)).toBe(false);
			expect(PlanCreated.is({ name: "plan:created" })).toBe(false);
			expect(PlanCreated.is("plan:created")).toBe(false);
		});
	});
});
