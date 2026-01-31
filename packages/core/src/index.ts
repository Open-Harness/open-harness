/**
 * @open-harness/core - State-first workflow runtime.
 *
 * Primary API for defining and running AI agent workflows.
 *
 * @example
 * ```typescript
 * import { agent, workflow, phase, run } from "@open-harness/core"
 *
 * const myAgent = agent({ name: "assistant", model: "claude-sonnet-4-5", ... })
 * const myWorkflow = workflow({ name: "my-workflow", phases: { ... } })
 * const result = await run(myWorkflow, { input: "Hello" })
 * ```
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────
// State-First API (Primary)
// ─────────────────────────────────────────────────────────────────

// Agent definition
export type { AgentDef } from "./Engine/agent.js"
export { agent } from "./Engine/agent.js"

// Phase definition
export type { HumanConfig, PhaseDef } from "./Engine/phase.js"
export { phase } from "./Engine/phase.js"

// Workflow definition
export type { PhaseWorkflowDef, SimpleWorkflowDef, WorkflowDef } from "./Engine/workflow.js"
export { isPhaseWorkflow, isSimpleWorkflow, workflow } from "./Engine/workflow.js"

// Simple Promise API - PRIMARY PUBLIC API (ADR-001)
export type { RunOptions, RunResult, RuntimeConfig, WorkflowExecution } from "./Engine/run.js"
export { run } from "./Engine/run.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

// Draft type for Immer-style updates
export type { Draft, ImmerDraft } from "./Engine/types.js"

// Events (framework-generated)
export type {
  AgentCompletedEvent,
  AgentCompletedPayload,
  AgentStartedEvent,
  AgentStartedPayload,
  AnyEvent,
  Event,
  EventId,
  InputReceivedEvent,
  InputReceivedPayload,
  InputRequest,
  InputRequestedEvent,
  InputRequestedPayload,
  PhaseEnteredEvent,
  PhaseEnteredPayload,
  PhaseExitedEvent,
  PhaseExitedPayload,
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
  WorkflowError,
  WorkflowObserver,
  WorkflowResult,
  WorkflowStartedEvent,
  WorkflowStartedPayload
} from "./Engine/types.js"

// Event constants and utilities
export {
  EventIdSchema,
  makeEvent,
  makeEventId,
  parseEventId,
  WorkflowAbortedError,
  WorkflowAgentError,
  WorkflowPhaseError,
  WorkflowProviderError,
  WorkflowStoreError,
  WorkflowTimeoutError,
  WorkflowValidationError
} from "./Engine/types.js"

// Wire format deserialization (ADR-004)
export {
  decodeSerializedEvent,
  type EventName,
  generateEventId,
  type SerializedEvent,
  SerializedEventSchema,
  tagToEventName
} from "./Domain/Events.js"

// HITL payload schemas (ADR-008: Type-safe event parsing)
export {
  decodeInputReceivedPayload,
  decodeInputRequestedPayload,
  InputReceivedPayloadSchema,
  InputRequestedPayloadSchema
} from "./Domain/Events.js"

// Provider infrastructure
export type { AgentExecutionContext, AgentExecutionResult } from "./Engine/provider.js"
export { runAgentDef } from "./Engine/provider.js"

// ─────────────────────────────────────────────────────────────────
// Provider Types (used by server package)
// ─────────────────────────────────────────────────────────────────

export type {
  AgentProvider,
  AgentRunResult,
  AgentStreamEvent,
  ProviderMode,
  ProviderRunOptions
} from "./Domain/Provider.js"

// ─────────────────────────────────────────────────────────────────
// IDs
// ─────────────────────────────────────────────────────────────────

export type { AgentId } from "./Domain/Ids.js"
export type { SessionId, WorkflowId } from "./Domain/Ids.js"
export { AgentIdSchema, makeSessionId, parseSessionId, SessionIdSchema, WorkflowIdSchema } from "./Domain/Ids.js"

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export {
  AgentError,
  HandlerError,
  ProviderError,
  RecordingNotFound,
  SessionNotFound,
  StoreError,
  ValidationError,
  WorkflowNotFound
} from "./Domain/Errors.js"

// ─────────────────────────────────────────────────────────────────
// Internal Utilities (advanced use - prefer "@open-harness/core/internal")
// ─────────────────────────────────────────────────────────────────

// computeStateAt is kept in main export since it's useful for state derivation
export { computeStateAt } from "./Engine/utils.js"

// Session Context (FiberRef for ambient context) - kept for advanced workflow customization
export type { SessionContext } from "./Domain/Context.js"
export {
  getSessionContext,
  getSessionContextOptional,
  SessionContextRef,
  withSessionContext
} from "./Domain/Context.js"

// ─────────────────────────────────────────────────────────────────
// Helpers (HITL utilities per ADR-002)
// ─────────────────────────────────────────────────────────────────

export type { HumanInputHandler } from "./helpers/index.js"
export { autoApprove, cliPrompt } from "./helpers/index.js"
