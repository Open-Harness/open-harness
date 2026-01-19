/**
 * PRD Workflow Handlers
 *
 * Unified handlers combining state mutations and signal emissions.
 * This is the preferred pattern - use handlers over separate reducers/processes.
 *
 * Handler Pattern:
 * - Receive state and signal
 * - Mutate state directly (Immer handles immutability)
 * - Return signals to emit (or void for no emissions)
 *
 * Signal Flow:
 * 1. plan:start → planning begins
 * 2. plan:created → task:ready (first task)
 * 3. task:ready → agent executes
 * 4. task:complete → await review (or discovery:submitted if discoveries)
 * 5. task:approved → milestone:testable or task:ready (next)
 * 6. milestone:passed → workflow:complete or task:ready (next)
 * 7. milestone:failed → fix:required or milestone:retry
 */

import type { SignalHandler } from "@internal/core";
import type { PRDWorkflowState } from "../types.js";
import { executionHandlers } from "./execution.js";
// Import individual handler modules
import { planningHandlers } from "./planning.js";
import { reviewHandlers } from "./review.js";

export {
	executionHandlers,
	fixRequiredHandler,
	milestonePassedHandler,
	milestoneTestableHandler,
	taskCompleteHandler,
	taskReadyHandler,
} from "./execution.js";
// Re-export individual handlers for granular testing
// Re-export individual handler functions for direct imports
export {
	discoveryReviewedHandler,
	discoverySubmittedHandler,
	planCreatedHandler,
	planningHandlers,
	planStartHandler,
} from "./planning.js";
export {
	milestoneFailedHandler,
	milestoneRetryHandler,
	reviewHandlers,
	taskApprovedHandler,
	workflowCompleteHandler,
} from "./review.js";

/**
 * PRD Workflow Handlers (Unified)
 *
 * Complete map of all signal handlers for the PRD workflow.
 * Use this with runReactive's `handlers` option.
 *
 * @example
 * ```ts
 * import { PRDWorkflowHandlers } from "@internal/prd-workflow";
 *
 * const result = await runReactive({
 *   agents: { coder },
 *   state: initialState,
 *   handlers: PRDWorkflowHandlers,
 *   harness: myHarness,
 * });
 * ```
 */
export const PRDWorkflowHandlers: Record<string, SignalHandler<PRDWorkflowState>> = {
	// Planning signals
	...planningHandlers,

	// Execution signals
	...executionHandlers,

	// Review signals
	...reviewHandlers,
};
