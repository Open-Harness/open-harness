/**
 * Plan Schema - Zod schemas for planning-related payloads
 *
 * These schemas define the structured output format for agents.
 * They are used by both agents (for outputSchema) and handlers (for type safety).
 *
 * The schemas match the interfaces in types.ts exactly.
 */

import { z } from "zod";

// ============================================================================
// Task Status Schema
// ============================================================================

/**
 * Task status enum - matches TaskStatus type in types.ts
 */
export const TaskStatusSchema = z
	.enum(["pending", "in_progress", "complete", "blocked"])
	.describe("Current status of the task in the workflow");

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// ============================================================================
// Attempt Record Schema
// ============================================================================

/**
 * Record of a task execution attempt - matches AttemptRecord in types.ts
 */
export const AttemptRecordSchema = z
	.object({
		attempt: z.number().int().positive().describe("Attempt number (1-indexed)"),
		timestamp: z.string().describe("ISO-8601 timestamp of the attempt"),
		outcome: z.enum(["success", "failure", "partial"]).describe("Result of this attempt"),
		summary: z.string().describe("Brief description of what happened"),
		filesChanged: z.array(z.string()).optional().describe("List of files modified during this attempt"),
		checkpointHash: z.string().optional().describe("Git commit hash for rollback"),
	})
	.describe("Record of a single task execution attempt");

export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

// ============================================================================
// Task Schema
// ============================================================================

/**
 * Task schema - matches Task interface in types.ts
 */
export const TaskSchema = z
	.object({
		id: z.string().describe("Unique identifier for the task"),
		title: z.string().describe("Short, descriptive title"),
		description: z.string().describe("Detailed description of what needs to be done"),
		definitionOfDone: z.array(z.string()).describe("Checkable criteria that define completion"),
		milestoneId: z.string().describe("ID of the milestone this task belongs to"),
		status: TaskStatusSchema.default("pending"),
		attempt: z.number().int().nonnegative().default(0).describe("Current attempt count"),
		attemptHistory: z.array(AttemptRecordSchema).default([]).describe("History of all attempts"),
	})
	.describe("A single task in the PRD workflow");

export type Task = z.infer<typeof TaskSchema>;

// ============================================================================
// Milestone Schema
// ============================================================================

/**
 * Milestone schema - matches Milestone interface in types.ts
 */
export const MilestoneSchema = z
	.object({
		id: z.string().describe("Unique identifier for the milestone"),
		title: z.string().describe("Short, descriptive title"),
		taskIds: z.array(z.string()).describe("IDs of tasks in this milestone, in order"),
		testCommand: z.string().optional().describe("Command to run to verify milestone completion"),
		passed: z.boolean().default(false).describe("Whether all tasks passed verification"),
	})
	.describe("A milestone containing related tasks");

export type Milestone = z.infer<typeof MilestoneSchema>;

// ============================================================================
// Plan Created Payload Schema (Agent Output)
// ============================================================================

/**
 * Payload emitted by the planner agent when a plan is created.
 * This is the structured output that will be passed to handlers.
 *
 * Matches PlanCreatedPayload interface in types.ts
 */
export const PlanCreatedPayloadSchema = z
	.object({
		tasks: z.array(TaskSchema).describe("All tasks extracted from the PRD"),
		milestones: z.array(MilestoneSchema).describe("Milestones grouping related tasks"),
		taskOrder: z.array(z.string()).describe("Task IDs in execution order"),
	})
	.describe("Structured plan output from the planner agent");

export type PlanCreatedPayload = z.infer<typeof PlanCreatedPayloadSchema>;
