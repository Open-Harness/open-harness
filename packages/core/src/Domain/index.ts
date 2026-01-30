/**
 * Domain types - the core building blocks.
 *
 * @module
 */

// IDs
export type { AgentId, EventId, SessionId, WorkflowId } from "./Ids.js"
export {
  AgentIdSchema,
  EventIdSchema,
  makeEventId,
  makeSessionId,
  parseEventId,
  parseSessionId,
  SessionIdSchema,
  WorkflowIdSchema
} from "./Ids.js"

// Events (ADR-004: Data.TaggedClass event definitions)
export {
  AgentCompleted,
  AgentStarted,
  InputReceived,
  InputRequested,
  PhaseEntered,
  PhaseExited,
  SessionForked,
  StateCheckpoint,
  StateIntent,
  TextDelta,
  ThinkingDelta,
  ToolCalled,
  ToolResult,
  WorkflowCompleted,
  WorkflowStarted
} from "./Events.js"
export type { WorkflowEvent, WorkflowEventTag } from "./Events.js"

// Context
export type { SessionContext } from "./Context.js"
export { getSessionContext, getSessionContextOptional, SessionContextRef, withSessionContext } from "./Context.js"

// Errors
export {
  AgentError,
  HandlerError,
  ProviderError,
  RecordingNotFound,
  SessionNotFound,
  StoreError,
  ValidationError,
  WorkflowNotFound
} from "./Errors.js"

// Hash utilities
export { hashProviderRequest } from "./Hash.js"

// Provider types (renamed from Agent.ts)
export type { AgentProvider, AgentRunResult, AgentStreamEvent, ProviderMode, ProviderRunOptions } from "./Provider.js"
