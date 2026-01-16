/**
 * Reducers Index
 *
 * Export all reducers combined into a single reducers object.
 */

import type { SignalReducers } from "@internal/core";
import type { PRDWorkflowState } from "../types.js";
// Execution reducers
import { fixRequiredReducer, taskBlockedReducer, taskCompleteReducer, taskReadyReducer } from "./execution.js";
// Planning reducers
import {
	discoveryProcessedReducer,
	discoverySubmittedReducer,
	planCreatedReducer,
	tasksQueuedReducer,
} from "./planning.js";

// Review reducers
import {
	milestoneCompleteReducer,
	milestoneFailedReducer,
	taskApprovedReducer,
	taskEscalateReducer,
	taskNeedsFixReducer,
} from "./review.js";

/**
 * All reducers for the PRD workflow.
 */
export const reducers: SignalReducers<PRDWorkflowState> = {
	// Planning layer
	"plan:created": planCreatedReducer,
	"tasks:queued": tasksQueuedReducer,
	"discovery:submitted": discoverySubmittedReducer,
	"discovery:processed": discoveryProcessedReducer,

	// Execution layer
	"task:ready": taskReadyReducer,
	"task:complete": taskCompleteReducer,
	"task:blocked": taskBlockedReducer,
	"fix:required": fixRequiredReducer,

	// Review layer
	"task:approved": taskApprovedReducer,
	"task:needs_fix": taskNeedsFixReducer,
	"task:escalate": taskEscalateReducer,
	"milestone:complete": milestoneCompleteReducer,
	"milestone:failed": milestoneFailedReducer,
};

// Re-export individual reducers for testing
export {
	planCreatedReducer,
	tasksQueuedReducer,
	discoverySubmittedReducer,
	discoveryProcessedReducer,
	taskReadyReducer,
	taskCompleteReducer,
	taskBlockedReducer,
	fixRequiredReducer,
	taskApprovedReducer,
	taskNeedsFixReducer,
	taskEscalateReducer,
	milestoneCompleteReducer,
	milestoneFailedReducer,
};

// Re-export utils
export { createSignal } from "./utils.js";
