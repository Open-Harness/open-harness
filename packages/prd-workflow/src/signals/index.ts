/**
 * PRD Workflow Signal Definitions
 *
 * Defines all PRD workflow signals using defineSignal() with Zod schemas.
 * Signals are pure data structures - rendering is handled by adapters via renderer maps.
 *
 * These signal definitions provide:
 * - Type-safe signal creation via create()
 * - Type guards for signal matching via is()
 * - Zod schema validation for payloads
 *
 * NOTE: Due to Zod version differences between packages (signals-core uses Zod 3,
 * prd-workflow uses Zod 4), we use type assertions when passing schemas to defineSignal().
 * This is safe because the runtime schema validation works correctly; only TypeScript
 * types differ between Zod versions.
 *
 * @example
 * ```ts
 * import { PlanStart, PlanCreated, TaskReady } from "./signals";
 *
 * // Create signals with type-safe payloads
 * const signal = PlanCreated.create({
 *   tasks: [...],
 *   milestones: [...],
 *   taskOrder: ["T-001", "T-002"]
 * });
 *
 * // Type guard for signal matching
 * if (TaskReady.is(signal)) {
 *   console.log(signal.payload.title);
 * }
 * ```
 */

import { defineSignal } from "@internal/signals-core";
import { z } from "zod";
import { type Milestone, MilestoneSchema, type Task, TaskSchema } from "../planner/index.js";

// ============================================================================
// Type Compatibility Helper
// ============================================================================

/**
 * Cast Zod 4 schema to Zod 3 compatible type for defineSignal().
 * Runtime behavior is identical; only TypeScript types differ.
 *
 * We use `any` for the entire return type because:
 * 1. Zod 3's ZodType has internal properties (_type, _parse, etc.) that Zod 4 lacks
 * 2. The schema parameter's internal types (ZodTypeDef) also differ between versions
 * 3. Runtime validation works correctly regardless of these type differences
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod v3/v4 cross-compatibility
function asZodSchema<_T>(schema: unknown): any {
	return schema;
}

// ============================================================================
// Payload Types (inferred from schemas for type safety)
// ============================================================================

interface PlanStartPayload {
	prd?: string;
}

interface PlanCreatedPayload {
	tasks: Task[];
	milestones: Milestone[];
	taskOrder: string[];
}

interface DiscoveredTask {
	title: string;
	description: string;
	suggestedMilestoneId?: string;
	blocksTaskId?: string;
}

interface DiscoverySubmittedPayload {
	discoveries: DiscoveredTask[];
	count: number;
	sourceTaskId: string | null;
}

interface DiscoveryReviewedPayload {
	accepted: number;
	rejected: number;
	acceptedTasks?: Task[];
}

interface TaskReadyPayload {
	taskId: string;
	title: string;
	description: string;
	definitionOfDone: string[];
}

interface TaskCompletePayload {
	taskId: string;
	outcome: "success" | "failure" | "partial";
	summary: string;
	filesChanged?: string[];
	checkpointHash?: string;
}

interface TaskApprovedPayload {
	taskId: string | null;
	hadDiscoveries?: boolean;
}

interface FixRequiredPayload {
	taskId: string;
	milestoneId: string;
	error?: string;
	attempt: number;
}

interface MilestoneTestablePayload {
	milestoneId: string;
	taskIds: string[];
}

interface MilestonePassedPayload {
	milestoneId: string;
}

interface MilestoneFailedPayload {
	milestoneId: string;
	failingTaskId?: string;
	error?: string;
}

interface MilestoneRetryPayload {
	milestoneId: string;
	error?: string;
}

interface WorkflowCompletePayload {
	reason: string;
}

// ============================================================================
// Schemas (Zod 4)
// ============================================================================

const PlanStartSchema = z
	.object({
		prd: z.string().optional(),
	})
	.optional();

const PlanCreatedSchema = z.object({
	tasks: z.array(TaskSchema),
	milestones: z.array(MilestoneSchema),
	taskOrder: z.array(z.string()),
});

const DiscoveredTaskSchema = z.object({
	title: z.string(),
	description: z.string(),
	suggestedMilestoneId: z.string().optional(),
	blocksTaskId: z.string().optional(),
});

const DiscoverySubmittedSchema = z.object({
	discoveries: z.array(DiscoveredTaskSchema),
	count: z.number(),
	sourceTaskId: z.string().nullable(),
});

const DiscoveryReviewedSchema = z.object({
	accepted: z.number(),
	rejected: z.number(),
	acceptedTasks: z.array(TaskSchema).optional(),
});

const TaskReadySchema = z.object({
	taskId: z.string(),
	title: z.string(),
	description: z.string(),
	definitionOfDone: z.array(z.string()),
});

const TaskCompleteSchema = z.object({
	taskId: z.string(),
	outcome: z.enum(["success", "failure", "partial"]),
	summary: z.string(),
	filesChanged: z.array(z.string()).optional(),
	checkpointHash: z.string().optional(),
});

const TaskApprovedSchema = z.object({
	taskId: z.string().nullable(),
	hadDiscoveries: z.boolean().optional(),
});

const FixRequiredSchema = z.object({
	taskId: z.string(),
	milestoneId: z.string(),
	error: z.string().optional(),
	attempt: z.number(),
});

const MilestoneTestableSchema = z.object({
	milestoneId: z.string(),
	taskIds: z.array(z.string()),
});

const MilestonePassedSchema = z.object({
	milestoneId: z.string(),
});

const MilestoneFailedSchema = z.object({
	milestoneId: z.string(),
	failingTaskId: z.string().optional(),
	error: z.string().optional(),
});

const MilestoneRetrySchema = z.object({
	milestoneId: z.string(),
	error: z.string().optional(),
});

const WorkflowCompleteSchema = z.object({
	reason: z.string(),
});

// ============================================================================
// Planning Phase Signals
// ============================================================================

/**
 * plan:start - Begin the planning phase
 *
 * Emitted when the workflow starts planning. Optionally includes the PRD content.
 */
export const PlanStart = defineSignal({
	name: "plan:start",
	schema: asZodSchema<PlanStartPayload | undefined>(PlanStartSchema),
});

/**
 * plan:created - Plan has been generated with tasks and milestones
 *
 * Emitted when the planner agent produces a complete plan.
 * Contains the full task list, milestones, and execution order.
 */
export const PlanCreated = defineSignal({
	name: "plan:created",
	schema: asZodSchema<PlanCreatedPayload>(PlanCreatedSchema),
});

// ============================================================================
// Discovery Signals
// ============================================================================

/**
 * discovery:submitted - New tasks discovered during execution
 *
 * Emitted when emergent work is discovered while executing a task.
 */
export const DiscoverySubmitted = defineSignal({
	name: "discovery:submitted",
	schema: asZodSchema<DiscoverySubmittedPayload>(DiscoverySubmittedSchema),
});

/**
 * discovery:reviewed - Discovered tasks have been reviewed
 *
 * Emitted after human/agent review of discovered tasks.
 */
export const DiscoveryReviewed = defineSignal({
	name: "discovery:reviewed",
	schema: asZodSchema<DiscoveryReviewedPayload>(DiscoveryReviewedSchema),
});

// ============================================================================
// Task Execution Signals
// ============================================================================

/**
 * task:ready - A task is ready for execution
 *
 * Emitted when the workflow advances to a new task.
 */
export const TaskReady = defineSignal({
	name: "task:ready",
	schema: asZodSchema<TaskReadyPayload>(TaskReadySchema),
});

/**
 * task:complete - A task has been completed
 *
 * Emitted when task execution finishes (success, failure, or partial).
 */
export const TaskComplete = defineSignal({
	name: "task:complete",
	schema: asZodSchema<TaskCompletePayload>(TaskCompleteSchema),
});

/**
 * task:approved - A task has passed review
 *
 * Emitted when task output is approved and workflow advances.
 */
export const TaskApproved = defineSignal({
	name: "task:approved",
	schema: asZodSchema<TaskApprovedPayload>(TaskApprovedSchema),
});

/**
 * fix:required - A task needs fixing
 *
 * Emitted when a task or milestone fails and needs retry.
 */
export const FixRequired = defineSignal({
	name: "fix:required",
	schema: asZodSchema<FixRequiredPayload>(FixRequiredSchema),
});

// ============================================================================
// Milestone Signals
// ============================================================================

/**
 * milestone:testable - A milestone is ready for testing
 *
 * Emitted when all tasks in a milestone are complete.
 */
export const MilestoneTestable = defineSignal({
	name: "milestone:testable",
	schema: asZodSchema<MilestoneTestablePayload>(MilestoneTestableSchema),
});

/**
 * milestone:passed - A milestone has passed all tests
 *
 * Emitted when milestone verification succeeds.
 */
export const MilestonePassed = defineSignal({
	name: "milestone:passed",
	schema: asZodSchema<MilestonePassedPayload>(MilestonePassedSchema),
});

/**
 * milestone:failed - A milestone has failed testing
 *
 * Emitted when milestone verification fails.
 */
export const MilestoneFailed = defineSignal({
	name: "milestone:failed",
	schema: asZodSchema<MilestoneFailedPayload>(MilestoneFailedSchema),
});

/**
 * milestone:retry - A milestone is being retried
 *
 * Emitted when all tasks in a milestone are reset for retry.
 */
export const MilestoneRetry = defineSignal({
	name: "milestone:retry",
	schema: asZodSchema<MilestoneRetryPayload>(MilestoneRetrySchema),
});

// ============================================================================
// Workflow Signals
// ============================================================================

/**
 * workflow:complete - The workflow has completed
 *
 * Emitted when all milestones pass or when there are no tasks.
 */
export const WorkflowComplete = defineSignal({
	name: "workflow:complete",
	schema: asZodSchema<WorkflowCompletePayload>(WorkflowCompleteSchema),
});

// ============================================================================
// Signal Registry
// ============================================================================

/**
 * All PRD workflow signal definitions for easy iteration
 */
export const PRDSignals = {
	// Planning
	PlanStart,
	PlanCreated,
	// Discovery
	DiscoverySubmitted,
	DiscoveryReviewed,
	// Tasks
	TaskReady,
	TaskComplete,
	TaskApproved,
	FixRequired,
	// Milestones
	MilestoneTestable,
	MilestonePassed,
	MilestoneFailed,
	MilestoneRetry,
	// Workflow
	WorkflowComplete,
} as const;

/**
 * Signal names for pattern matching
 */
export const PRD_SIGNAL_NAMES = {
	PLAN_START: "plan:start",
	PLAN_CREATED: "plan:created",
	DISCOVERY_SUBMITTED: "discovery:submitted",
	DISCOVERY_REVIEWED: "discovery:reviewed",
	TASK_READY: "task:ready",
	TASK_COMPLETE: "task:complete",
	TASK_APPROVED: "task:approved",
	FIX_REQUIRED: "fix:required",
	MILESTONE_TESTABLE: "milestone:testable",
	MILESTONE_PASSED: "milestone:passed",
	MILESTONE_FAILED: "milestone:failed",
	MILESTONE_RETRY: "milestone:retry",
	WORKFLOW_COMPLETE: "workflow:complete",
} as const;

// ============================================================================
// Re-export Payload Types for Consumers
// ============================================================================

export type {
	PlanStartPayload,
	PlanCreatedPayload,
	DiscoveredTask,
	DiscoverySubmittedPayload,
	DiscoveryReviewedPayload,
	TaskReadyPayload,
	TaskCompletePayload,
	TaskApprovedPayload,
	FixRequiredPayload,
	MilestoneTestablePayload,
	MilestonePassedPayload,
	MilestoneFailedPayload,
	MilestoneRetryPayload,
	WorkflowCompletePayload,
};
