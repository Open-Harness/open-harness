/**
 * Tests for schemas/index.ts exports
 *
 * Verifies that all schemas and types are properly exported from the index file.
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Import from index (the barrel export)
import {
	type AttemptRecord,
	AttemptRecordSchema,
	type Milestone,
	MilestoneSchema,
	type PlanCreatedPayload,
	PlanCreatedPayloadSchema,
	type Task,
	TaskSchema,
	// Types - import to ensure they're exported
	type TaskStatus,
	// Schemas
	TaskStatusSchema,
} from "./index.js";

describe("schemas/index.ts exports", () => {
	describe("Schema exports", () => {
		it("should export TaskStatusSchema", () => {
			expect(TaskStatusSchema).toBeDefined();
			expect(TaskStatusSchema.parse("pending")).toBe("pending");
		});

		it("should export AttemptRecordSchema", () => {
			expect(AttemptRecordSchema).toBeDefined();
			const record = AttemptRecordSchema.parse({
				attempt: 1,
				timestamp: "2026-01-19T16:00:00Z",
				outcome: "success",
				summary: "Test",
			});
			expect(record.attempt).toBe(1);
		});

		it("should export TaskSchema", () => {
			expect(TaskSchema).toBeDefined();
			const task = TaskSchema.parse({
				id: "task-1",
				title: "Test",
				description: "A test task",
				definitionOfDone: ["Done"],
				milestoneId: "m-1",
			});
			expect(task.id).toBe("task-1");
			expect(task.status).toBe("pending"); // default
		});

		it("should export MilestoneSchema", () => {
			expect(MilestoneSchema).toBeDefined();
			const milestone = MilestoneSchema.parse({
				id: "m-1",
				title: "Milestone 1",
				taskIds: ["task-1"],
			});
			expect(milestone.id).toBe("m-1");
			expect(milestone.passed).toBe(false); // default
		});

		it("should export PlanCreatedPayloadSchema", () => {
			expect(PlanCreatedPayloadSchema).toBeDefined();
			const payload = PlanCreatedPayloadSchema.parse({
				tasks: [
					{
						id: "task-1",
						title: "Test",
						description: "A test",
						definitionOfDone: ["Done"],
						milestoneId: "m-1",
					},
				],
				milestones: [{ id: "m-1", title: "M1", taskIds: ["task-1"] }],
				taskOrder: ["task-1"],
			});
			expect(payload.tasks.length).toBe(1);
		});
	});

	describe("Type inference", () => {
		it("should have correct TaskStatus type", () => {
			// Type-level test - if this compiles, types are correct
			const status: TaskStatus = "pending";
			expect(status).toBe("pending");
		});

		it("should have correct Task type", () => {
			// Type-level test - if this compiles, types are correct
			const task: Task = {
				id: "task-1",
				title: "Test",
				description: "Test task",
				definitionOfDone: ["Done"],
				milestoneId: "m-1",
				status: "pending",
				attempt: 0,
				attemptHistory: [],
			};
			expect(task.id).toBe("task-1");
		});

		it("should have correct Milestone type", () => {
			// Type-level test - if this compiles, types are correct
			const milestone: Milestone = {
				id: "m-1",
				title: "Milestone 1",
				taskIds: ["task-1"],
				passed: false,
			};
			expect(milestone.id).toBe("m-1");
		});

		it("should have correct PlanCreatedPayload type", () => {
			// Type-level test - if this compiles, types are correct
			const payload: PlanCreatedPayload = {
				tasks: [],
				milestones: [],
				taskOrder: [],
			};
			expect(payload.tasks).toEqual([]);
		});

		it("should have correct AttemptRecord type", () => {
			// Type-level test - if this compiles, types are correct
			const record: AttemptRecord = {
				attempt: 1,
				timestamp: "2026-01-19T16:00:00Z",
				outcome: "success",
				summary: "Test",
			};
			expect(record.attempt).toBe(1);
		});
	});

	describe("JSON Schema generation from exports", () => {
		it("should generate JSON Schema from exported PlanCreatedPayloadSchema", () => {
			const jsonSchema = z.toJSONSchema(PlanCreatedPayloadSchema);
			expect(jsonSchema.type).toBe("object");
			expect(jsonSchema.properties).toBeDefined();
			// Verify it has the expected properties
			const props = jsonSchema.properties as Record<string, unknown>;
			expect(props.tasks).toBeDefined();
			expect(props.milestones).toBeDefined();
			expect(props.taskOrder).toBeDefined();
		});
	});
});
