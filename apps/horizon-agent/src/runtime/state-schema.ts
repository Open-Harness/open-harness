/**
 * Horizon Agent State Schema
 *
 * Defines the state shape for the planner → coder ↔ reviewer workflow.
 * State is managed by kernel's StateStore with dot-path access.
 */

import type { StateSchemaDefinition } from "@open-harness/kernel";
import { z } from "zod";

/**
 * ISO-8601 datetime string schema.
 * Validates that string is a proper datetime format.
 */
const DateTimeString = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Individual task from the planner.
 */
export const TaskSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	dependencies: z.array(z.string()).default([]),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Review feedback from a single iteration.
 */
export const ReviewFeedbackSchema = z.object({
	passed: z.boolean(),
	feedback: z.string(),
	issues: z.array(z.string()).default([]),
});

export type ReviewFeedback = z.infer<typeof ReviewFeedbackSchema>;

/**
 * Single review iteration record for history tracking.
 */
export const ReviewIterationSchema = z.object({
	iteration: z.number(),
	timestamp: DateTimeString,
	passed: z.boolean(),
	feedback: z.string(),
	issues: z.array(z.string()).default([]),
});

export type ReviewIteration = z.infer<typeof ReviewIterationSchema>;

/**
 * Completed task record with review history.
 */
export const CompletedTaskSchema = z.object({
	task: TaskSchema,
	completedAt: DateTimeString,
	totalIterations: z.number(),
	reviewHistory: z.array(ReviewIterationSchema),
});

export type CompletedTask = z.infer<typeof CompletedTaskSchema>;

/**
 * Workflow status enum.
 */
export const WorkflowStatusSchema = z.enum(["idle", "planning", "executing", "paused", "completed", "failed"]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

/**
 * Full Horizon Agent state schema.
 *
 * - tasks: Immutable after planner completes
 * - currentTaskIndex: Which task is being worked on
 * - currentIteration: Review iteration within current task
 * - reviewFeedback: Latest review feedback for current task
 * - completedTasks: Tasks that have passed review
 * - status: Overall workflow status
 */
export const HorizonStateSchema = z.object({
	// Plan state (immutable after planner completes)
	tasks: z.array(TaskSchema).default([]),
	planCreatedAt: DateTimeString.nullable().default(null),

	// Current execution state
	currentTaskIndex: z.number().default(0),
	currentIteration: z.number().default(0),

	// Active task review feedback
	reviewFeedback: ReviewFeedbackSchema.nullable().default(null),

	// Completed tasks with full history
	completedTasks: z.array(CompletedTaskSchema).default([]),

	// Execution metadata
	startedAt: DateTimeString.nullable().default(null),
	completedAt: DateTimeString.nullable().default(null),
	status: WorkflowStatusSchema.default("idle"),
});

export type HorizonState = z.infer<typeof HorizonStateSchema>;

/**
 * Initial state for a new horizon agent run.
 */
export const INITIAL_STATE: HorizonState = {
	tasks: [],
	planCreatedAt: null,
	currentTaskIndex: 0,
	currentIteration: 0,
	reviewFeedback: null,
	completedTasks: [],
	startedAt: null,
	completedAt: null,
	status: "idle",
};

/**
 * Kernel state schema definition.
 * Used in FlowDefinition.state
 */
export const horizonStateDefinition: StateSchemaDefinition = {
	initial: INITIAL_STATE,
};
