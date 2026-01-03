/**
 * Horizon Agent
 *
 * Multi-agent implementation system with:
 * - Planner: Breaks features into tasks
 * - Coder: Implements each task
 * - Reviewer: Reviews and provides feedback
 *
 * Uses kernel-v3 runtime with loop edges for controlled coder↔reviewer cycles.
 */

// Runtime
export {
	createHorizonRuntime,
	type HorizonInput,
	type HorizonRuntime,
	type HorizonRuntimeOptions,
} from "./runtime/horizon-runtime.js";
export { createHorizonRegistry } from "./runtime/node-registry.js";
export {
	type CompletedTask,
	type HorizonState,
	horizonStateDefinition,
	INITIAL_STATE,
	type ReviewFeedback,
	type Task,
	type WorkflowStatus,
} from "./runtime/state-schema.js";

// Server
export type { HorizonServerConfig } from "./server.js";
export { createHorizonServer } from "./server.js";

// UI
export { HorizonTui, type HorizonTuiOptions } from "./ui/HorizonTui.js";
