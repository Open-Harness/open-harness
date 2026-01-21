/**
 * Workflow Module - Public Exports
 *
 * This module exports the workflow-related types and utilities.
 * Effect types are intentionally NOT exported - consumers use the
 * Promise-based PublicWorkflowRuntime interface.
 *
 * @module @core-v2/workflow
 */

// WorkflowRuntime service exports
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
