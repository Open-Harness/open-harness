/**
 * Grouped hooks for workflow operations.
 *
 * Per ADR-013: These compose the primitive hooks into higher-level
 * abstractions that are exported as the public API.
 *
 * @module
 */

// Unified hook (Tier 2 - main public API)
export type { UseWorkflowResult } from "./useWorkflow.js"
export { useWorkflow } from "./useWorkflow.js"

// Data access (Tier 1)
export type { WorkflowDataResult, WorkflowDataStatus } from "./useWorkflowData.js"
export { useWorkflowData } from "./useWorkflowData.js"

// Actions (Tier 1)
export type { WorkflowActionsResult } from "./useWorkflowActions.js"
export { useWorkflowActions } from "./useWorkflowActions.js"

// VCR controls (Tier 1)
export type { WorkflowVCRResult } from "./useWorkflowVCR.js"
export { useWorkflowVCR } from "./useWorkflowVCR.js"

// HITL interactions (Tier 1)
export type { PendingInteraction, WorkflowHITLResult } from "./useWorkflowHITL.js"
export { useWorkflowHITL } from "./useWorkflowHITL.js"
