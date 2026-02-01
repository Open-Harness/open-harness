/**
 * @internal
 * Advanced/internal exports for @open-harness/core
 *
 * These are implementation details and may change without notice.
 * Use for:
 * - Building custom layers
 * - Advanced runtime configurations
 * - Library authoring
 * - Testing infrastructure
 *
 * For most use cases, prefer the public API from "@open-harness/core".
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────
// Services (Effect Context.Tag) - for building custom layers
// ─────────────────────────────────────────────────────────────────

export * as Services from "./Services/index.js"

// ─────────────────────────────────────────────────────────────────
// Layers - runtime configurations (loggers, in-memory, LibSQL)
// ─────────────────────────────────────────────────────────────────

export * as Layers from "./Layers/index.js"

// ─────────────────────────────────────────────────────────────────
// Internal utilities (pure functions for state derivation)
// ─────────────────────────────────────────────────────────────────

export { computeStateAt, deriveState } from "./Engine/utils.js"

// ─────────────────────────────────────────────────────────────────
// Provider Infrastructure (for library authors)
// ─────────────────────────────────────────────────────────────────

export { mapStreamEventToInternal, runAgentDef } from "./Engine/provider.js"
export type { AgentExecutionContext, AgentExecutionResult } from "./Engine/provider.js"

// ─────────────────────────────────────────────────────────────────
// Schema Decoders (for boundary validation in server/test code)
// ─────────────────────────────────────────────────────────────────

export {
  AgentRunResultSchema,
  AgentStreamEventSchema,
  decodeAgentRunResult,
  decodeAgentStreamEvent
} from "./Domain/Provider.js"

// ─────────────────────────────────────────────────────────────────
// Factory Functions (for type-safe event construction in tests)
// ─────────────────────────────────────────────────────────────────

export {
  makeResult,
  makeSessionInit,
  makeStop,
  makeTextComplete,
  makeTextDelta,
  makeThinkingComplete,
  makeThinkingDelta,
  makeToolCall,
  makeToolResult,
  makeUsage
} from "./Domain/Provider.js"

// ─────────────────────────────────────────────────────────────────
// Session Context (FiberRef for ambient context)
// ─────────────────────────────────────────────────────────────────

export type { SessionContext } from "./Domain/Context.js"
export {
  getSessionContext,
  getSessionContextOptional,
  SessionContextRef,
  withSessionContext
} from "./Domain/Context.js"

// ─────────────────────────────────────────────────────────────────
// Runtime/Execute (internal - for server, advanced testing)
// ─────────────────────────────────────────────────────────────────

// These are removed from public API per ADR-001 but kept for internal use
// by the server package and advanced testing scenarios.

// executeWorkflow - Effect-based core execution (used by server)
export type { ExecuteOptions, WorkflowHandle } from "./Engine/runtime.js"
export { executeWorkflow, streamWorkflow } from "./Engine/runtime.js"

// execute - async iterator API (for advanced testing scenarios)
export type { ExecuteWithRuntimeOptions, WorkflowExecution as ExecuteWorkflowExecution } from "./Engine/execute.js"
export { execute } from "./Engine/execute.js"
