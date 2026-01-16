/**
 * Schema exports - Zod schemas and inferred types for PRD workflow
 *
 * This is the single source of truth for:
 * - Schema definitions (Zod)
 * - Inferred TypeScript types
 *
 * Both agents (outputSchema) and handlers (type safety) import from here.
 */

// Plan-related schemas and types
export {
	type AttemptRecord,
	AttemptRecordSchema,
	type Milestone,
	MilestoneSchema,
	type PlanCreatedPayload,
	PlanCreatedPayloadSchema,
	type Task,
	TaskSchema,
	// Inferred types
	type TaskStatus,
	// Schemas
	TaskStatusSchema,
} from "./plan.schema.js";
