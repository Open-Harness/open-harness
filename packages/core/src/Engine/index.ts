/**
 * State-first workflow engine for Open Scaffold.
 *
 * This module provides a simplified API for defining workflows where:
 * - State is the primary concept
 * - Agents transform state via Immer-style updates
 * - Workflows are state machines with explicit phases
 * - Events are generated internally (not user-defined)
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type { Draft, ImmerDraft } from "./types.js"

export type {
  // Typed events
  AgentCompletedEvent,
  // Event payloads
  AgentCompletedPayload,
  AgentStartedEvent,
  AgentStartedPayload,
  AnyEvent,
  Event,
  EventId,
  EventName,
  // Observer protocol
  InputRequest,
  InputRequestedEvent,
  InputRequestedPayload,
  InputResponseEvent,
  InputResponsePayload,
  PhaseEnteredEvent,
  PhaseEnteredPayload,
  PhaseExitedEvent,
  PhaseExitedPayload,
  StateSnapshot,
  StateUpdatedEvent,
  StateUpdatedPayload,
  TextDeltaEvent,
  TextDeltaPayload,
  ThinkingDeltaEvent,
  ThinkingDeltaPayload,
  ToolCalledEvent,
  ToolCalledPayload,
  ToolResultEvent,
  ToolResultPayload,
  WorkflowCompletedEvent,
  WorkflowCompletedPayload,
  // Error union
  WorkflowError,
  WorkflowObserver,
  WorkflowResult,
  WorkflowStartedEvent,
  WorkflowStartedPayload
} from "./types.js"

export {
  EventIdSchema,
  EVENTS,
  makeEvent,
  makeEventId,
  parseEventId,
  // Errors
  WorkflowAbortedError,
  WorkflowAgentError,
  WorkflowPhaseError,
  WorkflowProviderError,
  WorkflowStoreError,
  WorkflowTimeoutError,
  WorkflowValidationError
} from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Agent
// ─────────────────────────────────────────────────────────────────

export type { AgentDef } from "./agent.js"
export { agent } from "./agent.js"

// ─────────────────────────────────────────────────────────────────
// Phase
// ─────────────────────────────────────────────────────────────────

export type { HumanConfig, PhaseDef } from "./phase.js"
export { phase } from "./phase.js"

// ─────────────────────────────────────────────────────────────────
// Workflow
// ─────────────────────────────────────────────────────────────────

export type { PhaseWorkflowDef, SimpleWorkflowDef, WorkflowDef } from "./workflow.js"
export { isPhaseWorkflow, isSimpleWorkflow, workflow } from "./workflow.js"

// ─────────────────────────────────────────────────────────────────
// Provider Infrastructure
// ─────────────────────────────────────────────────────────────────

export type { AgentExecutionContext, AgentExecutionResult, ProviderRegistryService } from "./provider.js"
export { makeInMemoryProviderRegistry, ProviderNotFoundError, ProviderRegistry, runAgentDef } from "./provider.js"

// ─────────────────────────────────────────────────────────────────
// Runtime (Effect-based)
// ─────────────────────────────────────────────────────────────────

export type { ExecuteOptions, WorkflowHandle } from "./runtime.js"
export { executeWorkflow, streamWorkflow } from "./runtime.js"

// ─────────────────────────────────────────────────────────────────
// Execute (Async Iterator API)
// ─────────────────────────────────────────────────────────────────

export type { ExecuteWithRuntimeOptions, RuntimeConfig, WorkflowExecution } from "./execute.js"
export { execute } from "./execute.js"

// ─────────────────────────────────────────────────────────────────
// Run (Simple Promise API)
// ─────────────────────────────────────────────────────────────────

export type { RunOptions, RunResult } from "./run.js"
export { run, runSimple, runWithText } from "./run.js"

// ─────────────────────────────────────────────────────────────────
// Utilities (pure functions)
// ─────────────────────────────────────────────────────────────────

export { computeStateAt } from "./utils.js"

// ─────────────────────────────────────────────────────────────────
// Event Dispatch (ADR-004: Match.exhaustive)
// ─────────────────────────────────────────────────────────────────

export { dispatchToObserver } from "./dispatch.js"
