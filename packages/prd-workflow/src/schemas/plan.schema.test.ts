import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	AttemptRecordSchema,
	MilestoneSchema,
	PlanCreatedPayloadSchema,
	TaskSchema,
	TaskStatusSchema,
} from "./plan.schema.js";

describe("Plan Schemas", () => {
	describe("TaskStatusSchema", () => {
		it("should accept valid statuses", () => {
			expect(TaskStatusSchema.parse("pending")).toBe("pending");
			expect(TaskStatusSchema.parse("in_progress")).toBe("in_progress");
			expect(TaskStatusSchema.parse("complete")).toBe("complete");
			expect(TaskStatusSchema.parse("blocked")).toBe("blocked");
		});

		it("should reject invalid statuses", () => {
			expect(() => TaskStatusSchema.parse("invalid")).toThrow();
		});
	});

	describe("AttemptRecordSchema", () => {
		it("should parse valid attempt record", () => {
			const record = {
				attempt: 1,
				timestamp: "2026-01-19T15:00:00Z",
				outcome: "success" as const,
				summary: "Task completed successfully",
			};
			const parsed = AttemptRecordSchema.parse(record);
			expect(parsed.attempt).toBe(1);
			expect(parsed.outcome).toBe("success");
		});

		it("should accept optional fields", () => {
			const record = {
				attempt: 2,
				timestamp: "2026-01-19T15:00:00Z",
				outcome: "failure" as const,
				summary: "Task failed due to test errors",
				filesChanged: ["src/foo.ts", "src/bar.ts"],
				checkpointHash: "abc123",
			};
			const parsed = AttemptRecordSchema.parse(record);
			expect(parsed.filesChanged).toEqual(["src/foo.ts", "src/bar.ts"]);
			expect(parsed.checkpointHash).toBe("abc123");
		});
	});

	describe("TaskSchema", () => {
		it("should parse minimal task with defaults", () => {
			const task = {
				id: "task-1",
				title: "Implement feature",
				description: "Build the new feature",
				definitionOfDone: ["Tests pass", "Code reviewed"],
				milestoneId: "milestone-1",
			};
			const parsed = TaskSchema.parse(task);
			expect(parsed.status).toBe("pending");
			expect(parsed.attempt).toBe(0);
			expect(parsed.attemptHistory).toEqual([]);
		});

		it("should parse complete task", () => {
			const task = {
				id: "task-1",
				title: "Implement feature",
				description: "Build the new feature",
				definitionOfDone: ["Tests pass"],
				milestoneId: "milestone-1",
				status: "complete" as const,
				attempt: 2,
				attemptHistory: [
					{
						attempt: 1,
						timestamp: "2026-01-19T14:00:00Z",
						outcome: "failure" as const,
						summary: "Tests failed",
					},
					{
						attempt: 2,
						timestamp: "2026-01-19T15:00:00Z",
						outcome: "success" as const,
						summary: "All tests pass",
					},
				],
			};
			const parsed = TaskSchema.parse(task);
			expect(parsed.status).toBe("complete");
			expect(parsed.attemptHistory.length).toBe(2);
		});
	});

	describe("MilestoneSchema", () => {
		it("should parse milestone with defaults", () => {
			const milestone = {
				id: "milestone-1",
				title: "Core Features",
				taskIds: ["task-1", "task-2"],
			};
			const parsed = MilestoneSchema.parse(milestone);
			expect(parsed.passed).toBe(false);
			expect(parsed.testCommand).toBeUndefined();
		});

		it("should parse complete milestone", () => {
			const milestone = {
				id: "milestone-1",
				title: "Core Features",
				taskIds: ["task-1", "task-2"],
				testCommand: "bun run test",
				passed: true,
			};
			const parsed = MilestoneSchema.parse(milestone);
			expect(parsed.testCommand).toBe("bun run test");
			expect(parsed.passed).toBe(true);
		});
	});

	describe("PlanCreatedPayloadSchema", () => {
		it("should parse complete plan payload", () => {
			const payload = {
				tasks: [
					{
						id: "task-1",
						title: "Setup project",
						description: "Initialize the project structure",
						definitionOfDone: ["package.json exists"],
						milestoneId: "milestone-1",
					},
					{
						id: "task-2",
						title: "Add tests",
						description: "Write unit tests",
						definitionOfDone: ["Tests pass"],
						milestoneId: "milestone-1",
					},
				],
				milestones: [
					{
						id: "milestone-1",
						title: "Setup",
						taskIds: ["task-1", "task-2"],
						testCommand: "bun run test",
					},
				],
				taskOrder: ["task-1", "task-2"],
			};

			const parsed = PlanCreatedPayloadSchema.parse(payload);
			expect(parsed.tasks.length).toBe(2);
			expect(parsed.milestones.length).toBe(1);
			expect(parsed.taskOrder).toEqual(["task-1", "task-2"]);
			// Verify defaults were applied
			expect(parsed.tasks[0]?.status).toBe("pending");
			expect(parsed.milestones[0]?.passed).toBe(false);
		});

		it("should generate valid JSON Schema", () => {
			const jsonSchema = z.toJSONSchema(PlanCreatedPayloadSchema);
			expect(jsonSchema.type).toBe("object");
			expect(jsonSchema.properties).toBeDefined();
			expect(jsonSchema.description).toBe("Structured plan output from the planner agent");

			// Verify nested schema descriptions are preserved
			const tasksProp = jsonSchema.properties?.tasks as { items?: { description?: string } };
			expect(tasksProp?.items?.description).toBe("A single task in the PRD workflow");
		});
	});

	describe("JSON Schema generation", () => {
		it("should generate JSON Schema from TaskSchema", () => {
			const jsonSchema = z.toJSONSchema(TaskSchema);
			expect(jsonSchema.type).toBe("object");
			expect(jsonSchema.required).toContain("id");
			expect(jsonSchema.required).toContain("title");
		});

		it("should include descriptions in generated JSON Schema", () => {
			const jsonSchema = z.toJSONSchema(MilestoneSchema);
			expect(jsonSchema.description).toBe("A milestone containing related tasks");
		});
	});
});
