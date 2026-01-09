import { harness } from "@open-harness/core";
import { codingAgent, type ValidationResult } from "./coding-agent";
import { specAgent, type Task } from "./spec-agent";

/**
 * SpecKit Harness - Level 4
 *
 * Coordinates Spec Agent and Coding Agent in a workflow:
 * 1. Spec Agent: PRD → tasks[]
 * 2. Coding Agent: tasks[currentTaskIndex] → code + validation
 *
 * This level introduces:
 * - Multi-agent coordination via harness()
 * - Shared state accessible to all agents
 * - Edge conditions using JSONata for control flow
 *
 * State Design: Option B (Task Queue)
 * - Spec agent populates tasks[]
 * - Coding agent processes tasks[currentTaskIndex]
 * - Edge conditions reference state fields
 */

/**
 * Coder output stored in shared state for edge evaluation
 */
export interface CoderOutput {
	taskId: string;
	code: string;
	selfValidation: ValidationResult;
	status: "complete" | "needs_revision" | "blocked";
}

/**
 * Shared harness state
 *
 * This state is accessible to all agents and edge conditions.
 * The runtime maintains this state and passes it to edges for evaluation.
 */
export interface SpecKitState {
	// Task queue (populated by spec agent)
	tasks: Task[];
	currentTaskIndex: number;

	// Iteration tracking
	currentAttempts: number;
	maxAttempts: number;

	// Coder output (for edge condition evaluation)
	coderOutput: CoderOutput | null;

	// Metrics
	metrics: {
		tasksCompleted: number;
		tasksFailed: number;
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
	currentAttempts: 0,
	maxAttempts: 3,
	coderOutput: null,
	metrics: {
		tasksCompleted: 0,
		tasksFailed: 0,
		totalAttempts: 0,
	},
};

/**
 * SpecKit Harness
 *
 * Declarative multi-agent workflow:
 * - `agents`: Named agents in this workflow
 * - `edges`: Control flow between agents with optional conditions
 * - `state`: Shared state accessible to all agents and edges
 *
 * Edge conditions use JSONata expressions to evaluate state.
 */
export const specKit = harness({
	agents: {
		spec: specAgent,
		coder: codingAgent,
	},

	edges: [
		// Edge: Spec → Coder (always fires after spec completes)
		// This is a simple linear flow - spec runs first, then coder
		// No condition means the edge always fires
		{
			from: "spec",
			to: "coder",
		},
		// Note: Self-loop edges (coder → coder) for retry logic
		// are introduced in Level 5 where we also add state updates
	],

	state: initialState,
});

/**
 * Type export for consumers
 */
export type { Task, ValidationResult };
