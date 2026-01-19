/**
 * Schema exports - Zod schemas and inferred types for PRD workflow
 *
 * This file re-exports from the co-located planner module for backward compatibility.
 * New code should import directly from "../planner/index.js".
 *
 * @deprecated Import from "../planner/index.js" instead
 */

// Re-export from new planner module location (backward compatibility)
export {
	type AttemptRecord,
	AttemptRecordSchema,
	type Milestone,
	MilestoneSchema,
	type PlanCreatedPayload,
	PlanCreatedPayloadSchema,
	type Task,
	TaskSchema,
	type TaskStatus,
	TaskStatusSchema,
} from "../planner/index.js";
