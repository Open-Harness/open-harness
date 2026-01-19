/**
 * Tests for types.ts re-exports from schemas
 *
 * Verifies that types.ts properly re-exports schemas and types from ./schemas/index.js,
 * maintaining backward compatibility for existing consumers.
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Import from types.ts (the re-export point)
import {
	type AttemptRecord,
	AttemptRecordSchema,
	createInitialState,
	type ExecutionPhase,
	type Milestone,
	MilestoneSchema,
	type PlanCreatedPayload,
	PlanCreatedPayloadSchema,
	// Local types (not from schemas)
	type PlanningPhase,
	type PRDWorkflowState,
	type ReviewPhase,
	type Task,
	TaskSchema,
	// Re-exported types
	type TaskStatus,
	// Re-exported schemas
	TaskStatusSchema,
} from "./types.js";

describe("types.ts re-exports from schemas", () => {
	describe("Schema re-exports", () => {
		it("should re-export TaskStatusSchema from types.ts", () => {
			expect(TaskStatusSchema).toBeDefined();
			expect(TaskStatusSchema.parse("pending")).toBe("pending");
		});

		it("should re-export TaskSchema from types.ts", () => {
			expect(TaskSchema).toBeDefined();
			const task = TaskSchema.parse({
				id: "t-1",
				title: "Test",
				description: "Desc",
				definitionOfDone: ["Done"],
				milestoneId: "m-1",
			});
			expect(task.status).toBe("pending");
		});

		it("should re-export PlanCreatedPayloadSchema from types.ts", () => {
			expect(PlanCreatedPayloadSchema).toBeDefined();
			const payload = PlanCreatedPayloadSchema.parse({
				tasks: [],
				milestones: [],
				taskOrder: [],
			});
			expect(payload.tasks).toEqual([]);
		});

		it("should re-export AttemptRecordSchema from types.ts", () => {
			expect(AttemptRecordSchema).toBeDefined();
			const record = AttemptRecordSchema.parse({
				attempt: 1,
				timestamp: "2026-01-19T16:30:00Z",
				outcome: "success",
				summary: "Test passed",
			});
			expect(record.attempt).toBe(1);
		});

		it("should re-export MilestoneSchema from types.ts", () => {
			expect(MilestoneSchema).toBeDefined();
			const milestone = MilestoneSchema.parse({
				id: "m-1",
				title: "Milestone 1",
				taskIds: ["t-1"],
			});
			expect(milestone.passed).toBe(false);
		});
	});

	describe("Type re-exports", () => {
		it("should have correct TaskStatus type from re-export", () => {
			const status: TaskStatus = "in_progress";
			expect(status).toBe("in_progress");
		});

		it("should have correct Task type from re-export", () => {
			const task: Task = {
				id: "t-1",
				title: "Test",
				description: "Desc",
				definitionOfDone: ["Done"],
				milestoneId: "m-1",
				status: "pending",
				attempt: 0,
				attemptHistory: [],
			};
			expect(task.id).toBe("t-1");
		});

		it("should have correct AttemptRecord type from re-export", () => {
			const record: AttemptRecord = {
				attempt: 1,
				timestamp: "2026-01-19T16:30:00Z",
				outcome: "success",
				summary: "Test passed",
			};
			expect(record.attempt).toBe(1);
		});

		it("should have correct Milestone type from re-export", () => {
			const milestone: Milestone = {
				id: "m-1",
				title: "Milestone 1",
				taskIds: ["t-1"],
				passed: false,
			};
			expect(milestone.id).toBe("m-1");
		});

		it("should have correct PlanCreatedPayload type from re-export", () => {
			const payload: PlanCreatedPayload = {
				tasks: [],
				milestones: [],
				taskOrder: [],
			};
			expect(payload.taskOrder).toEqual([]);
		});
	});

	describe("Local types (not from schemas)", () => {
		it("should still export PlanningPhase", () => {
			const phase: PlanningPhase = "idle";
			expect(phase).toBe("idle");
		});

		it("should still export ExecutionPhase", () => {
			const phase: ExecutionPhase = "executing_task";
			expect(phase).toBe("executing_task");
		});

		it("should still export ReviewPhase", () => {
			const phase: ReviewPhase = "complete";
			expect(phase).toBe("complete");
		});

		it("should still export PRDWorkflowState and createInitialState", () => {
			const state: PRDWorkflowState = createInitialState("# Test PRD");
			expect(state.planning.phase).toBe("idle");
			expect(state.execution.phase).toBe("idle");
			expect(state.review.phase).toBe("idle");
		});
	});

	describe("JSON Schema generation via types.ts", () => {
		it("should generate JSON Schema from re-exported PlanCreatedPayloadSchema", () => {
			const jsonSchema = z.toJSONSchema(PlanCreatedPayloadSchema);
			expect(jsonSchema.type).toBe("object");
			expect(jsonSchema.description).toBe("Structured plan output from the planner agent");
		});
	});
});
