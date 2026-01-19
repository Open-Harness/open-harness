/**
 * PRD Workflow Reducers
 *
 * Reducers handle the "command" side of CQRS - they mutate state in response
 * to signals. Each reducer receives a mutable draft state (via Immer) and
 * applies changes directly.
 *
 * Pattern:
 * - Reducers: State mutations (this file)
 * - Process managers: Signal emission (processes/index.ts)
 *
 * Reducer signature: (state: TState, signal: Signal) => void
 * - No ctx parameter (orchestration moved to process managers)
 * - Direct mutations allowed (Immer handles immutability)
 */

import type { SignalReducers } from "@internal/core";
import type { PRDWorkflowState } from "../types.js";

// Import individual reducer modules
import { planningReducers } from "./planning.js";

/**
 * Combined reducers for the PRD workflow
 *
 * Merges all reducer maps into a single SignalReducers object.
 * The workflow engine uses this to subscribe reducers to their signals.
 *
 * @example
 * ```ts
 * import { createWorkflow } from "@internal/core";
 * import { reducers, processes } from "@internal/prd-workflow";
 *
 * const { runReactive } = createWorkflow<PRDWorkflowState>();
 *
 * await runReactive({
 *   agents: { planner, executor },
 *   state: createInitialState(prd),
 *   reducers,
 *   processes,
 * });
 * ```
 */
export const reducers: SignalReducers<PRDWorkflowState> = {
	...planningReducers,
	// Future: add execution and review reducers
	// ...executionReducers,
	// ...reviewReducers,
};

// Re-export individual reducer modules for granular testing
export { planningReducers } from "./planning.js";
