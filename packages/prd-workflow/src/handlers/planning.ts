/**
 * Planning Handlers
 *
 * Unified handlers for planning-related signals.
 * Combines state mutations (from reducers) with signal emissions (from process managers)
 * into single, cohesive handler functions.
 *
 * Handler Pattern:
 * - Receive state and signal
 * - Mutate state directly (Immer handles immutability)
 * - Return signals to emit (or void for no emissions)
 *
 * Signals handled:
 * - plan:start - Begin planning phase
 * - plan:created - Plan with tasks and milestones created
 * - discovery:submitted - New tasks discovered during execution
 * - discovery:reviewed - Discovered tasks accepted or rejected
 */

import type { SignalHandler } from "@internal/core";
import { createSignal } from "@internal/signals-core";
import {
	createHandler,
	type DiscoveryReviewedPayload,
	type DiscoverySubmittedPayload,
	type PlanCreatedPayload,
	type PlanStartPayload,
	type PRDWorkflowState,
} from "../types.js";

/**
 * Handler: plan:start
 *
 * Transitions planning phase to "planning" and optionally updates the PRD.
 * No signals emitted - planning agent will handle the actual planning.
 */
export const planStartHandler = createHandler<PlanStartPayload | undefined>((draft, payload) => {
	draft.planning.phase = "planning";

	// Update PRD if provided in signal payload
	if (payload?.prd) {
		draft.planning.prd = payload.prd;
	}

	// No signals to emit - planning agent handles next steps
});

/**
 * Handler: plan:created
 *
 * Stores the generated plan and emits task:ready for the first pending task.
 * Combines:
 * - Mutation: Store tasks, milestones, taskOrder; transition to plan_complete
 * - Emission: task:ready for first task, or workflow:complete if no tasks
 */
export const planCreatedHandler = createHandler<PlanCreatedPayload>((draft, payload) => {
	// MUTATION: Store tasks as a map by ID for O(1) lookup
	for (const task of payload.tasks) {
		draft.planning.allTasks[task.id] = task;
	}

	// Store milestones and task order
	draft.planning.milestones = payload.milestones;
	draft.planning.taskOrder = payload.taskOrder;

	// Transition to plan_complete
	draft.planning.phase = "plan_complete";

	// EMISSION: Start execution with first pending task
	const firstTaskId = payload.taskOrder[0];
	if (firstTaskId) {
		const firstTask = payload.tasks.find((t) => t.id === firstTaskId);
		if (firstTask) {
			return [
				createSignal("task:ready", {
					taskId: firstTask.id,
					title: firstTask.title,
					description: firstTask.description,
					definitionOfDone: firstTask.definitionOfDone,
				}),
			];
		}
	}

	// No tasks to execute
	return [
		createSignal("workflow:complete", {
			reason: "no_tasks",
		}),
	];
});

/**
 * Handler: discovery:submitted
 *
 * Stores discovered tasks for review and transitions to discovery_review phase.
 * No signals emitted - human/agent review needed.
 */
export const discoverySubmittedHandler = createHandler<DiscoverySubmittedPayload>((draft, payload) => {
	// Store discoveries for review
	draft.execution.pendingDiscoveries = payload.discoveries;

	// Transition to discovery review phase
	draft.planning.phase = "discovery_review";

	// No signals to emit - awaiting review
});

/**
 * Handler: discovery:reviewed
 *
 * Processes reviewed discoveries and emits task:approved to continue workflow.
 * Combines:
 * - Mutation: Add accepted tasks to plan, clear pending discoveries
 * - Emission: task:approved to resume workflow
 */
export const discoveryReviewedHandler = createHandler<DiscoveryReviewedPayload>((draft, payload) => {
	// MUTATION: Add accepted tasks to the plan
	if (payload.acceptedTasks) {
		for (const task of payload.acceptedTasks) {
			draft.planning.allTasks[task.id] = task;
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

	// EMISSION: Continue workflow with task:approved
	return [
		createSignal("task:approved", {
			taskId: draft.execution.currentTaskId,
			hadDiscoveries: payload.accepted > 0,
		}),
	];
});

/**
 * Planning handlers map
 *
 * Maps signal patterns to their unified handler functions.
 */
export const planningHandlers: Record<string, SignalHandler<PRDWorkflowState>> = {
	"plan:start": planStartHandler,
	"plan:created": planCreatedHandler,
	"discovery:submitted": discoverySubmittedHandler,
	"discovery:reviewed": discoveryReviewedHandler,
};
