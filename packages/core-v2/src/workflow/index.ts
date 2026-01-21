/**
 * Workflow Module - Public Exports
 *
 * This module exports the workflow-related types and utilities.
 * Effect types are intentionally NOT exported - consumers use the
 * Promise-based interfaces.
 *
 * @module @core-v2/workflow
 */

// Workflow exports (consumer-facing)
export {
	// Factory function
	createWorkflow,
	type RunOptions,
	// Interfaces
	type Workflow,
	type WorkflowCallbacks,
	type WorkflowDefinition,
	type WorkflowResult,
} from "./Workflow.js";

// WorkflowRuntime service exports (for advanced users)
export {
	// Consumer-facing interface (Promise-based)
	type PublicWorkflowRuntime,
	// Configuration types
	type RuntimeCallbacks,
	type RuntimeResult,
	type RuntimeRunOptions,
	// Error handling
	WorkflowRuntimeError,
	type WorkflowRuntimeErrorCode,
} from "./WorkflowRuntime.js";
