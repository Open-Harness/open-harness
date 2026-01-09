import { harness } from "@open-harness/core";
import { codingAgent, type ValidationResult } from "./coding-agent";
import { type CriterionResult, type ReviewIssue, reviewerAgent } from "./reviewer-agent";
import { specAgent, type Task } from "./spec-agent";

/**
 * SpecKit Harness - Level 5 (Full 3-Agent System)
 *
 * Complete workflow:
 * 1. Spec Agent: PRD → tasks[]
 * 2. Coding Agent: tasks[currentTaskIndex] → code + self-validation
 * 3. Reviewer Agent: code → approval (validates against spec)
 *
 * This level demonstrates:
 * - Three-agent coordination
 * - Linear workflow (spec → coder → reviewer)
 * - Shared state tracking metrics
 *
 * State Design: Option B (Task Queue)
 * - Spec agent populates tasks[]
 * - Coding agent processes current task
 * - Reviewer agent validates the implementation
 */

/**
 * Coder output for tracking
 */
export interface CoderOutput {
	taskId: string;
	code: string;
	selfValidation: ValidationResult;
	status: "complete" | "needs_revision" | "blocked";
}

/**
 * Reviewer output for tracking
 */
export interface ReviewerOutput {
	taskId: string;
	approved: boolean;
	criteriaResults: CriterionResult[];
	issues: ReviewIssue[];
}

/**
 * Shared harness state for the full system
 */
export interface SpecKitState {
	// Task queue (populated by spec agent)
	tasks: Task[];
	currentTaskIndex: number;

	// Agent outputs (for edge conditions and tracking)
	coderOutput: CoderOutput | null;
	reviewerOutput: ReviewerOutput | null;

	// Metrics
	metrics: {
		tasksCompleted: number;
		tasksFailed: number;
		reviewsCompleted: number;
		totalAttempts: number;
	};

	[key: string]: unknown;
}

/**
 * Initial state for a fresh SpecKit run
 */
export const initialState: SpecKitState = {
	tasks: [],
	currentTaskIndex: 0,
	coderOutput: null,
	reviewerOutput: null,
	metrics: {
		tasksCompleted: 0,
		tasksFailed: 0,
		reviewsCompleted: 0,
		totalAttempts: 0,
	},
};

/**
 * SpecKit Harness - Full 3-Agent System
 *
 * This is the complete SpecKit workflow:
 * PRD → [Spec Agent] → tasks → [Coding Agent] → code → [Reviewer Agent] → approval
 *
 * Edge conditions use JSONata expressions for control flow.
 * In a production system, you'd add loop edges for:
 * - Coder retry on failed self-validation
 * - Coder revision on reviewer rejection
 */
export const specKit = harness({
	agents: {
		spec: specAgent,
		coder: codingAgent,
		reviewer: reviewerAgent,
	},

	edges: [
		// Edge 1: Spec → Coder (always fires after spec completes)
		{
			from: "spec",
			to: "coder",
		},

		// Edge 2: Coder → Reviewer (always fires after coder completes)
		// In a full system, you'd add a condition here:
		// when: 'coderOutput.selfValidation.passed = true'
		{
			from: "coder",
			to: "reviewer",
		},

		// Future edges for production system:
		// - Coder self-loop: when: 'coderOutput.selfValidation.passed = false'
		// - Reviewer rejection: when: 'reviewerOutput.approved = false'
		// - Next task: when: 'reviewerOutput.approved = true and currentTaskIndex < $count(tasks) - 1'
	],

	state: initialState,
});

/**
 * Type exports for consumers
 */
export type { Task, ValidationResult, ReviewIssue, CriterionResult };
