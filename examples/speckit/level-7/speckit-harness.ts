import { harness } from "@open-harness/core";
import { codingAgent, type ValidationResult } from "./agents/coding-agent";
import { type CriterionResult, type ReviewIssue, reviewerAgent } from "./agents/reviewer-agent";
import { specAgent, type Task } from "./agents/spec-agent";

/**
 * SpecKit Harness - Level 6 (Fixtures + Replay)
 *
 * Same 3-agent workflow as Level 5, but now with fixture support
 * for deterministic testing.
 *
 * Fixtures enable:
 * - Recording agent responses during initial runs
 * - Replaying those responses in CI (no API calls)
 * - Deterministic test results
 * - Fast CI execution
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
 * Shared harness state
 */
export interface SpecKitState {
	tasks: Task[];
	currentTaskIndex: number;
	coderOutput: CoderOutput | null;
	reviewerOutput: ReviewerOutput | null;
	metrics: {
		tasksCompleted: number;
		tasksFailed: number;
		reviewsCompleted: number;
		totalAttempts: number;
	};
	[key: string]: unknown;
}

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
 * SpecKit Harness for fixture-based testing
 */
export const specKit = harness({
	agents: {
		spec: specAgent,
		coder: codingAgent,
		reviewer: reviewerAgent,
	},

	edges: [
		{ from: "spec", to: "coder" },
		{ from: "coder", to: "reviewer" },
	],

	state: initialState,
});

/**
 * Re-export types
 */
export type { Task, ValidationResult, ReviewIssue, CriterionResult };
