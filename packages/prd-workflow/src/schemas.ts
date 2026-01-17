/**
 * Zod Schemas for PRD Workflow
 *
 * Validation schemas for structured outputs from agents.
 * Based on PRD-AGENT-SYSTEM-DESIGN.md v0.5
 */

import { z } from "zod";

// ============================================================================
// Shared Schemas
// ============================================================================

/**
 * Schema for a specific change to a file.
 */
export const TaskChangeSchema = z.object({
	file: z.string(),
	changeType: z.enum(["modify", "create", "delete", "rename"]),
	description: z.string(),
	location: z.string().nullable(),
});

// ============================================================================
// Planning Agent Output Schemas
// ============================================================================

/**
 * Schema for a task specification in a plan.
 */
export const TaskSpecSchema = z.object({
	title: z.string(),
	description: z.string(),
	definitionOfDone: z.array(z.string()),
	technicalApproach: z.string().nullable(),
	filesToModify: z.array(z.string()),
	filesToCreate: z.array(z.string()),
	changes: z.array(TaskChangeSchema),
	context: z.string().nullable(),
	dependencies: z.array(z.string()), // References to other task titles
});

/**
 * Schema for acceptance test configuration.
 */
export const AcceptanceTestSchema = z.object({
	type: z.enum(["manual", "automated", "behavioral"]),
	description: z.string(),
	command: z.string().nullable(),
	expectedOutcome: z.string(),
});

/**
 * Schema for a milestone specification in a plan.
 */
export const MilestoneSpecSchema = z.object({
	title: z.string(),
	description: z.string(),
	acceptanceTest: AcceptanceTestSchema,
	tasks: z.array(TaskSpecSchema),
	dependencies: z.array(z.string()), // References to other milestone titles
});

/**
 * Schema for the complete plan output from the plan creator agent.
 */
export const PlanOutputSchema = z.object({
	milestones: z.array(MilestoneSpecSchema),
	approach: z.string(),
	reasoning: z.string(),
});

export type PlanOutput = z.infer<typeof PlanOutputSchema>;

// ============================================================================
// Coding Agent Output Schemas
// ============================================================================

/**
 * Schema for a task discovered during implementation.
 */
export const DiscoveredTaskSchema = z.object({
	title: z.string(),
	description: z.string(),
	definitionOfDone: z.array(z.string()),
	suggestedMilestoneId: z.string().nullable(),
	reason: z.string(),
	filesToModify: z.array(z.string()),
	filesToCreate: z.array(z.string()),
	changes: z.array(TaskChangeSchema),
});

/**
 * Schema for the task result output from the coding agent.
 */
export const TaskResultSchema = z.object({
	status: z.enum(["complete", "blocked"]),
	summary: z.string(),
	filesChanged: z.array(z.string()),
	checkpointName: z.string(),

	// Task discovery
	discoveredTasks: z.array(DiscoveredTaskSchema),

	// If blocked
	blockedReason: z.string().nullable(),
	blockedBy: z.string().nullable(),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;

// ============================================================================
// Review Agent Output Schemas
// ============================================================================

/**
 * Schema for a specific issue found during review.
 */
export const ReviewIssueSchema = z.object({
	file: z.string(),
	issue: z.string(),
	suggestion: z.string(),
});

/**
 * Schema for review decision output from the review agent.
 */
export const ReviewDecisionSchema = z.object({
	decision: z.enum(["approved", "needs_fix", "blocked", "escalate"]),
	reasoning: z.string(),

	// For needs_fix
	fixInstructions: z.string().nullable(),
	specificIssues: z.array(ReviewIssueSchema),

	// For escalate
	escalationReason: z.string().nullable(),
	recommendedAction: z.enum(["replan", "skip", "abort"]).nullable(),

	// Progress assessment (critical for termination decisions)
	progressMade: z.boolean(),
	lessonsLearned: z.string().nullable(),
});

export type ReviewDecisionOutput = z.infer<typeof ReviewDecisionSchema>;

// ============================================================================
// Discovery Processing Output Schemas
// ============================================================================

/**
 * Schema for a single discovery decision.
 */
export const SingleDiscoveryDecisionSchema = z.object({
	discoveredTaskTitle: z.string(),
	approved: z.boolean(),
	reason: z.string(),
	assignedMilestoneId: z.string().nullable(), // If approved
	modifications: z
		.object({
			// If approved with changes
			title: z.string().nullable(),
			definitionOfDone: z.array(z.string()).nullable(),
			dependencies: z.array(z.string()).nullable(),
		})
		.nullable(),
});

/**
 * Schema for discovery processing output from the discovery processor agent.
 */
export const DiscoveryDecisionSchema = z.object({
	decisions: z.array(SingleDiscoveryDecisionSchema),
});

export type DiscoveryDecision = z.infer<typeof DiscoveryDecisionSchema>;
