/**
 * Initial State Factory for PRD Workflow
 *
 * Creates the initial state for a PRD workflow run.
 */

import type { PRDWorkflowState } from "./types.js";

/**
 * Options for creating initial state.
 */
export interface CreateInitialStateOptions {
	/**
	 * Maximum number of replans allowed before terminal failure.
	 * @default 2
	 */
	maxReplans?: number;
}

/**
 * Create the initial state for a PRD workflow.
 *
 * @param prd - The PRD document to build from
 * @param options - Configuration options
 * @returns Initial workflow state
 */
export function createInitialState(prd: string, options: CreateInitialStateOptions = {}): PRDWorkflowState {
	const { maxReplans = 2 } = options;

	return {
		// === Input ===
		prd,

		// === Planning Layer ===
		planning: {
			phase: "analyzing",

			// The plan (empty until plan:created signal)
			milestones: [],
			approach: "",
			reasoning: "",

			// Task management
			allTasks: {},
			taskQueue: [],

			// Discovery handling
			pendingDiscoveries: [],
			rejectedDiscoveries: [],

			// Iteration tracking
			replanCount: 0,
			maxReplans,
		},

		// === Execution Layer ===
		execution: {
			phase: "idle",

			// Current work
			activeTasks: [],
			currentTaskId: null,
			currentTask: null,

			// Progress tracking
			completedTaskIds: [],
			blockedTaskIds: [],
			skippedTaskIds: [],

			// Current milestone context
			currentMilestoneId: null,
		},

		// === Review Layer ===
		review: {
			phase: "idle",

			// What's being reviewed
			taskUnderReview: null,
			milestoneUnderReview: null,

			// Pre-computed for template access
			currentTaskForReview: null,

			// Last decision
			lastDecision: null,
		},

		// === Global State ===
		history: [],
		terminalFailure: null,
		workflowPhase: "planning",
	};
}
