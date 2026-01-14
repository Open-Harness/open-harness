/**
 * Planning Reducer
 *
 * Handles state mutations for planning-related signals.
 * Uses Immer's produce pattern (called within Immer context by the workflow engine).
 *
 * CQRS Pattern:
 * - This reducer handles the "command" side: state mutations only
 * - Orchestration signals are handled by process managers in processes/index.ts
 *
 * Signals handled:
 * - plan:start - Begin planning phase
 * - plan:created - Plan with tasks and milestones created
 * - discovery:submitted - New tasks discovered during execution
 * - discovery:reviewed - Discovered tasks accepted or rejected
 */

import type { SignalReducer } from "@internal/core";
import type { Draft } from "immer";
import type { DiscoveredTask, Milestone, PRDWorkflowState, Task } from "../types.js";

/**
 * Draft state type - Immer removes readonly modifiers
 */
type DraftState = Draft<PRDWorkflowState>;

/**
 * Signal payload types for planning reducers
 */
interface PlanStartPayload {
	prd?: string;
}

interface PlanCreatedPayload {
	tasks: Task[];
	milestones: Milestone[];
	taskOrder: string[];
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

/**
 * Reducer: plan:start
 *
 * Transitions planning phase to "planning" and optionally updates the PRD.
 * Direct mutation is safe - Immer wraps this in produce().
 */
export const planStartReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as PlanStartPayload | undefined;

	draft.planning.phase = "planning";

	// Update PRD if provided in signal payload
	if (payload?.prd) {
		draft.planning.prd = payload.prd;
	}
};

/**
 * Reducer: plan:created
 *
 * Stores the generated plan: tasks, milestones, and task order.
 * Transitions planning phase to "plan_complete".
 */
export const planCreatedReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as PlanCreatedPayload;

	// Store tasks as a map by ID for O(1) lookup
	// Cast tasks to Draft<Task> since we're assigning to a draft state
	for (const task of payload.tasks) {
		draft.planning.allTasks[task.id] = task as Draft<Task>;
	}

	// Store milestones and task order
	// Cast to draft types for Immer compatibility
	draft.planning.milestones = payload.milestones as Draft<Milestone>[];
	draft.planning.taskOrder = payload.taskOrder;

	// Transition to plan_complete
	draft.planning.phase = "plan_complete";
};

/**
 * Reducer: discovery:submitted
 *
 * Stores discovered tasks in execution state for review.
 * Transitions planning phase to "discovery_review".
 */
export const discoverySubmittedReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as DiscoverySubmittedPayload;

	// Store discoveries for review
	// Cast to draft type for Immer compatibility
	draft.execution.pendingDiscoveries = payload.discoveries as Draft<DiscoveredTask>[];

	// Transition to discovery review phase
	draft.planning.phase = "discovery_review";
};

/**
 * Reducer: discovery:reviewed
 *
 * Processes reviewed discoveries:
 * - Accepted tasks are added to the plan
 * - Pending discoveries are cleared
 * - Phase transitions back to plan_complete
 */
export const discoveryReviewedReducer: SignalReducer<PRDWorkflowState> = (state, signal) => {
	const draft = state as DraftState;
	const payload = signal.payload as DiscoveryReviewedPayload;

	// Add accepted tasks to the plan
	if (payload.acceptedTasks) {
		for (const task of payload.acceptedTasks) {
			// Cast to Draft<Task> for Immer compatibility
			draft.planning.allTasks[task.id] = task as Draft<Task>;

			// Add to task order
			draft.planning.taskOrder.push(task.id);

			// Add to appropriate milestone if specified
			if (task.milestoneId) {
				const milestone = draft.planning.milestones.find((m) => m.id === task.milestoneId);
				if (milestone) {
					milestone.taskIds.push(task.id);
				}
			}
		}
	}

	// Clear pending discoveries
	draft.execution.pendingDiscoveries = [];

	// Return to plan_complete phase
	draft.planning.phase = "plan_complete";
};

/**
 * Planning reducers map
 *
 * Maps signal patterns to their reducer functions.
 * Used by the workflow engine to subscribe reducers to signals.
 */
export const planningReducers: Record<string, SignalReducer<PRDWorkflowState>> = {
	"plan:start": planStartReducer,
	"plan:created": planCreatedReducer,
	"discovery:submitted": discoverySubmittedReducer,
	"discovery:reviewed": discoveryReviewedReducer,
};
