/**
 * @open-scaffold/client - React bindings for workflows.
 *
 * Per ADR-013: Exports grouped hooks as the public API.
 * Primitive hooks are internal and NOT exported from this file.
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────

// Client Provider (ADR-013 - recommended)
export type { WorkflowClientContextValue, WorkflowClientProviderProps } from "./WorkflowClientProvider.js"
export { useWorkflowClient, WorkflowClientProvider } from "./WorkflowClientProvider.js"

// Legacy Provider (for backwards compatibility)
export type { WorkflowContextValue } from "./context.js"
export { WorkflowContext } from "./context.js"
export type { WorkflowProviderProps } from "./Provider.js"
export { WorkflowProvider } from "./Provider.js"

// ─────────────────────────────────────────────────────────────────
// Grouped Hooks (ADR-013 - Public API)
// ─────────────────────────────────────────────────────────────────

// Unified hook (Tier 2 - recommended for most use cases)
export type { UseWorkflowResult } from "./hooks/index.js"
export { useWorkflow } from "./hooks/index.js"

// Data access (Tier 1)
export type { WorkflowDataResult, WorkflowDataStatus } from "./hooks/index.js"
export { useWorkflowData } from "./hooks/index.js"

// Actions (Tier 1)
export type { WorkflowActionsResult } from "./hooks/index.js"
export { useWorkflowActions } from "./hooks/index.js"

// VCR controls (Tier 1)
export type { WorkflowVCRResult } from "./hooks/index.js"
export { useWorkflowVCR } from "./hooks/index.js"

// HITL interactions (Tier 1)
export type { PendingInteraction, WorkflowHITLResult } from "./hooks/index.js"
export { useWorkflowHITL } from "./hooks/index.js"

// ─────────────────────────────────────────────────────────────────
// NOTE: Primitive hooks are internal and NOT exported.
// They are located in ./primitives/ and used by grouped hooks.
// ─────────────────────────────────────────────────────────────────
