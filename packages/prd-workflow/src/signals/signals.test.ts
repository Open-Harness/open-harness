/**
 * PRD Workflow Signal Definitions Tests
 *
 * Tests that signal definitions:
 * - Create valid signals with correct payloads
 * - Provide working type guards via is()
 * - Validate payloads against Zod schemas
 *
 * Note: Display/rendering is handled by adapters via renderer maps,
 * not by the signals themselves. Signals are pure data structures.
 */

import { describe, expect, it } from "bun:test";
import { isSignal, type Signal } from "@internal/signals-core";
import {
	DiscoveryReviewed,
	type DiscoveryReviewedPayload,
	DiscoverySubmitted,
	type DiscoverySubmittedPayload,
	FixRequired,
	type FixRequiredPayload,
	MilestoneFailed,
	type MilestoneFailedPayload,
	MilestonePassed,
	type MilestonePassedPayload,
	MilestoneRetry,
	type MilestoneRetryPayload,
	MilestoneTestable,
	type MilestoneTestablePayload,
	PlanCreated,
	type PlanCreatedPayload,
	PlanStart,
	PRD_SIGNAL_NAMES,
	PRDSignals,
	TaskApproved,
	type TaskApprovedPayload,
	TaskComplete,
	type TaskCompletePayload,
	TaskReady,
	type TaskReadyPayload,
	WorkflowComplete,
	type WorkflowCompletePayload,
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

			// Access payload directly - create() returns typed Signal<PlanCreatedPayload>
			const payload = signal.payload as PlanCreatedPayload;
			expect(payload.tasks).toHaveLength(1);
			expect(payload.milestones).toHaveLength(1);
			expect(payload.taskOrder).toEqual(["T-001"]);
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
			const payload = signal.payload as TaskReadyPayload;
			expect(payload.taskId).toBe("T-001");
			expect(payload.title).toBe("Implement feature");
			expect(payload.definitionOfDone).toEqual(["Tests pass", "Lint clean"]);
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
			const payload = signal.payload as TaskCompletePayload;
			expect(payload.outcome).toBe("success");
			expect(payload.summary).toBe("Task completed successfully");
		});

		it("creates failure signal", () => {
			const signal = TaskComplete.create({
				taskId: "T-001",
				outcome: "failure",
				summary: "Tests failed",
			});

			const payload = signal.payload as TaskCompletePayload;
			expect(payload.outcome).toBe("failure");
		});

		it("creates partial signal", () => {
			const signal = TaskComplete.create({
				taskId: "T-001",
				outcome: "partial",
				summary: "Partial completion",
			});

			const payload = signal.payload as TaskCompletePayload;
			expect(payload.outcome).toBe("partial");
		});

		it("includes optional filesChanged", () => {
			const signal = TaskComplete.create({
				taskId: "T-001",
				outcome: "success",
				summary: "Done",
				filesChanged: ["src/index.ts", "tests/index.test.ts"],
			});

			const payload = signal.payload as TaskCompletePayload;
			expect(payload.filesChanged).toEqual(["src/index.ts", "tests/index.test.ts"]);
		});
	});

	describe("MilestonePassed", () => {
		it("creates signal with milestone ID", () => {
			const signal = MilestonePassed.create({ milestoneId: "M-001" });

			expect(signal.name).toBe("milestone:passed");
			const payload = signal.payload as MilestonePassedPayload;
			expect(payload.milestoneId).toBe("M-001");
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
			const payload = signal.payload as MilestoneFailedPayload;
			expect(payload.milestoneId).toBe("M-001");
			expect(payload.failingTaskId).toBe("T-002");
			expect(payload.error).toBe("Test assertion failed");
		});

		it("creates signal with minimal payload", () => {
			const signal = MilestoneFailed.create({ milestoneId: "M-001" });

			const payload = signal.payload as MilestoneFailedPayload;
			expect(payload.milestoneId).toBe("M-001");
			expect(payload.failingTaskId).toBeUndefined();
		});
	});

	describe("WorkflowComplete", () => {
		it("creates signal for all_milestones_passed", () => {
			const signal = WorkflowComplete.create({ reason: "all_milestones_passed" });

			expect(signal.name).toBe("workflow:complete");
			const payload = signal.payload as WorkflowCompletePayload;
			expect(payload.reason).toBe("all_milestones_passed");
		});

		it("creates signal for no_tasks", () => {
			const signal = WorkflowComplete.create({ reason: "no_tasks" });

			const payload = signal.payload as WorkflowCompletePayload;
			expect(payload.reason).toBe("no_tasks");
		});

		it("creates signal for custom reason", () => {
			const signal = WorkflowComplete.create({ reason: "user_cancelled" });

			const payload = signal.payload as WorkflowCompletePayload;
			expect(payload.reason).toBe("user_cancelled");
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
			const payload = signal.payload as DiscoverySubmittedPayload;
			expect(payload.count).toBe(1);
			expect(payload.sourceTaskId).toBe("T-001");
			expect(payload.discoveries).toHaveLength(1);
		});

		it("DiscoverySubmitted allows null sourceTaskId", () => {
			const signal = DiscoverySubmitted.create({
				discoveries: [{ title: "Task", description: "Desc" }],
				count: 1,
				sourceTaskId: null,
			});

			const payload = signal.payload as DiscoverySubmittedPayload;
			expect(payload.sourceTaskId).toBeNull();
		});

		it("DiscoveryReviewed creates with counts", () => {
			const signal = DiscoveryReviewed.create({
				accepted: 2,
				rejected: 1,
			});

			expect(signal.name).toBe("discovery:reviewed");
			const payload = signal.payload as DiscoveryReviewedPayload;
			expect(payload.accepted).toBe(2);
			expect(payload.rejected).toBe(1);
		});

		it("DiscoveryReviewed with no accepted tasks", () => {
			const signal = DiscoveryReviewed.create({
				accepted: 0,
				rejected: 3,
			});

			const payload = signal.payload as DiscoveryReviewedPayload;
			expect(payload.accepted).toBe(0);
			expect(payload.rejected).toBe(3);
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
			const payload = signal.payload as FixRequiredPayload;
			expect(payload.taskId).toBe("T-001");
			expect(payload.attempt).toBe(2);
			expect(payload.error).toBe("Test failed");
		});

		it("MilestoneRetry creates correctly", () => {
			const signal = MilestoneRetry.create({
				milestoneId: "M-001",
			});

			expect(signal.name).toBe("milestone:retry");
			const payload = signal.payload as MilestoneRetryPayload;
			expect(payload.milestoneId).toBe("M-001");
		});

		it("MilestoneRetry includes optional error", () => {
			const signal = MilestoneRetry.create({
				milestoneId: "M-001",
				error: "Retry due to flaky test",
			});

			const payload = signal.payload as MilestoneRetryPayload;
			expect(payload.error).toBe("Retry due to flaky test");
		});

		it("MilestoneTestable creates correctly", () => {
			const signal = MilestoneTestable.create({
				milestoneId: "M-001",
				taskIds: ["T-001", "T-002"],
			});

			expect(signal.name).toBe("milestone:testable");
			const payload = signal.payload as MilestoneTestablePayload;
			expect(payload.milestoneId).toBe("M-001");
			expect(payload.taskIds).toEqual(["T-001", "T-002"]);
		});

		it("TaskApproved creates correctly", () => {
			const signal = TaskApproved.create({
				taskId: "T-001",
				hadDiscoveries: true,
			});

			expect(signal.name).toBe("task:approved");
			const payload = signal.payload as TaskApprovedPayload;
			expect(payload.taskId).toBe("T-001");
			expect(payload.hadDiscoveries).toBe(true);
		});

		it("TaskApproved allows null taskId", () => {
			const signal = TaskApproved.create({
				taskId: null,
			});

			const payload = signal.payload as TaskApprovedPayload;
			expect(payload.taskId).toBeNull();
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

		it("validates payload optionally", () => {
			const signal = PlanCreated.create({
				tasks: [],
				milestones: [],
				taskOrder: [],
			});

			// Without validation (default)
			expect(PlanCreated.is(signal)).toBe(true);

			// With validation
			expect(PlanCreated.is(signal, true)).toBe(true);
		});

		it("narrows type correctly in conditional", () => {
			const signal: Signal<unknown> = PlanCreated.create({
				tasks: [],
				milestones: [],
				taskOrder: [],
			});

			// This demonstrates the type guard narrowing
			if (PlanCreated.is(signal)) {
				// Inside this block, TypeScript should know payload is PlanCreatedPayload
				// Note: Due to Zod v3/v4 differences, we use a type assertion here
				const payload = signal.payload as PlanCreatedPayload;
				expect(payload.tasks).toEqual([]);
			}
		});
	});
});
