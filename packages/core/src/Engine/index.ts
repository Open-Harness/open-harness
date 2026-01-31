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
  InputReceivedEvent,
  InputReceivedPayload,
  InputRequest,
  InputRequestedEvent,
  InputRequestedPayload,
  PhaseEnteredEvent,
  PhaseEnteredPayload,
  PhaseExitedEvent,
  PhaseExitedPayload,
  // Canonical state event names (ADR-008)
  StateCheckpointEvent,
  StateIntentEvent,
  StateSnapshot,
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

export type { AgentExecutionContext, AgentExecutionResult } from "./provider.js"
export { runAgentDef } from "./provider.js"

// ─────────────────────────────────────────────────────────────────
// Run (Simple Promise API) - PRIMARY PUBLIC API (ADR-001)
// ─────────────────────────────────────────────────────────────────

export type { RunOptions, RunResult, WorkflowExecution } from "./run.js"
export { run } from "./run.js"

// Re-export RuntimeConfig type from execute.ts (used by run.ts)
export type { RuntimeConfig } from "./execute.js"

// ─────────────────────────────────────────────────────────────────
// Utilities (pure functions)
// ─────────────────────────────────────────────────────────────────

export { computeStateAt } from "./utils.js"

// ─────────────────────────────────────────────────────────────────
// Event Dispatch (ADR-004: Match.exhaustive)
// ─────────────────────────────────────────────────────────────────

export { dispatchToObserver } from "./dispatch.js"
