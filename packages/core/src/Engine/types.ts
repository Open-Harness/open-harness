/**
 * State-first workflow engine types.
 *
 * Core types for the new workflow API where state is prime.
 * Users define state, agents transform state, workflows compose phases.
 *
 * @module
 */

import { Data, Effect } from "effect"
import type { Draft as ImmerDraft } from "immer"

import type { InputReceivedPayload, InputRequestedPayload, SerializedEvent } from "../Domain/Events.js"
import { type EventId, EventIdSchema, makeEventId, parseEventId } from "../Domain/Ids.js"

// Re-export EventId types from Domain/Ids.ts (canonical location)
export { type EventId, EventIdSchema, makeEventId, parseEventId }

// ─────────────────────────────────────────────────────────────────
// Draft Type (Re-export from Immer)
// ─────────────────────────────────────────────────────────────────

/**
 * Draft type for Immer-style state updates.
 *
 * Re-exported from Immer for convenience. Users import from here,
 * so we control the API surface.
 *
 * @example
 * ```typescript
 * update: (output, draft: Draft<State>) => {
 *   draft.tasks.push(...output.tasks)
 * }
 * ```
 */
export type { Draft as ImmerDraft } from "immer"

/**
 * Convenience alias for Draft type.
 * Users can use either `Draft<T>` or `ImmerDraft<T>`.
 */
export type Draft<T> = ImmerDraft<T>

// ─────────────────────────────────────────────────────────────────
// Internal Event Interface
// ─────────────────────────────────────────────────────────────────

/**
 * Internal event type - framework-generated, users don't create these.
 *
 * Events are the fundamental unit of the event log. They're used for:
 * - Recording/playback (deterministic replay)
 * - UI rendering (show what's happening)
 * - Debugging (trace execution)
 *
 * @template N - The event name literal type
 * @template P - The payload type
 */
export interface Event<N extends string = string, P = unknown> {
  /** Unique event identifier (UUID v4) */
  readonly id: EventId
  /** Event name (e.g., "workflow:started", "agent:completed") */
  readonly name: N
  /** Event-specific payload data */
  readonly payload: P
  /** When this event was created */
  readonly timestamp: Date
  /** ID of the event that caused this one (for causality tracking) */
  readonly causedBy?: EventId
}

/**
 * Any event (for generic handling).
 */
export type AnyEvent = Event<string, unknown>

/**
 * Create a SerializedEvent with proper ID generation.
 * Uses Effect.sync to generate UUID.
 *
 * Returns SerializedEvent (numeric timestamp) - the canonical event format.
 */
export const makeEvent = <N extends string, P extends Record<string, unknown>>(
  name: N,
  payload: P,
  causedBy?: EventId
): Effect.Effect<SerializedEvent> =>
  Effect.map(makeEventId(), (id) => ({
    id,
    name,
    payload,
    timestamp: Date.now(),
    ...(causedBy !== undefined ? { causedBy } : {})
  }))

// ─────────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────────

/** Payload for workflow:started */
export interface WorkflowStartedPayload {
  readonly sessionId: string
  /** Short workflow name per ADR-008 */
  readonly workflow: string
  readonly input: unknown
}

/** Payload for workflow:completed */
export interface WorkflowCompletedPayload {
  readonly sessionId: string
  readonly finalState: unknown
  readonly exitPhase?: string
}

/** Payload for phase:entered */
export interface PhaseEnteredPayload {
  readonly phase: string
  readonly fromPhase?: string
}

/** Payload for phase:exited */
export interface PhaseExitedPayload {
  readonly phase: string
  readonly reason: "next" | "terminal" | "error"
}

/** Payload for agent:started */
export interface AgentStartedPayload {
  readonly agent: string
  readonly phase?: string
  /** Context passed to agent (from forEach) */
  readonly context?: unknown
}

/** Payload for agent:completed */
export interface AgentCompletedPayload {
  readonly agent: string
  readonly output: unknown
  readonly durationMs: number
}

/** Payload for state:intent and state:checkpoint events */
export interface StateUpdatedPayload {
  /** The full state after update */
  readonly state: unknown
  /** Immer patches (for incremental replay) */
  readonly patches?: ReadonlyArray<unknown>
  /** Inverse patches (for undo) */
  readonly inversePatches?: ReadonlyArray<unknown>
}

/** Payload for text:delta */
export interface TextDeltaPayload {
  readonly agent: string
  readonly delta: string
}

/** Payload for thinking:delta */
export interface ThinkingDeltaPayload {
  readonly agent: string
  readonly delta: string
}

/** Payload for tool:called */
export interface ToolCalledPayload {
  readonly agent: string
  readonly toolId: string
  readonly toolName: string
  readonly input: unknown
}

/** Payload for tool:result */
export interface ToolResultPayload {
  readonly agent: string
  readonly toolId: string
  readonly output: unknown
  readonly isError: boolean
}

// HITL payload types - canonical definitions in Domain/Events.ts (ADR-008)
export type { InputReceivedPayload, InputRequestedPayload } from "../Domain/Events.js"

// ─────────────────────────────────────────────────────────────────
// Typed Event Helpers
// ─────────────────────────────────────────────────────────────────

/** Workflow started event */
export type WorkflowStartedEvent = Event<"workflow:started", WorkflowStartedPayload>

/** Workflow completed event */
export type WorkflowCompletedEvent = Event<"workflow:completed", WorkflowCompletedPayload>

/** Phase entered event */
export type PhaseEnteredEvent = Event<"phase:entered", PhaseEnteredPayload>

/** Phase exited event */
export type PhaseExitedEvent = Event<"phase:exited", PhaseExitedPayload>

/** Agent started event */
export type AgentStartedEvent = Event<"agent:started", AgentStartedPayload>

/** Agent completed event */
export type AgentCompletedEvent = Event<"agent:completed", AgentCompletedPayload>

/** State intent event */
export type StateIntentEvent = Event<"state:intent", StateUpdatedPayload>

/** State checkpoint event */
export type StateCheckpointEvent = Event<"state:checkpoint", StateUpdatedPayload>

/** Text delta event */
export type TextDeltaEvent = Event<"text:delta", TextDeltaPayload>

/** Thinking delta event */
export type ThinkingDeltaEvent = Event<"thinking:delta", ThinkingDeltaPayload>

/** Tool called event */
export type ToolCalledEvent = Event<"tool:called", ToolCalledPayload>

/** Tool result event */
export type ToolResultEvent = Event<"tool:result", ToolResultPayload>

/** Input requested event */
export type InputRequestedEvent = Event<"input:requested", InputRequestedPayload>

/** Input received event */
export type InputReceivedEvent = Event<"input:received", InputReceivedPayload>

// ─────────────────────────────────────────────────────────────────
// State Snapshot
// ─────────────────────────────────────────────────────────────────

/**
 * State snapshot with metadata.
 *
 * Saved at phase boundaries for:
 * - Resumption (load state at phase start)
 * - Debugging (inspect state at any point)
 * - UI rendering (show state history)
 *
 * @template S - The state type
 */
export interface StateSnapshot<S = unknown> {
  /** Session this snapshot belongs to */
  readonly sessionId: string
  /** The state data */
  readonly state: S
  /** Position in event log (event index after which this state exists) */
  readonly position: number
  /** Current phase name (if in phased workflow) */
  readonly phase?: string
  /** When this snapshot was created */
  readonly createdAt: Date
}

// ─────────────────────────────────────────────────────────────────
// Workflow Result
// ─────────────────────────────────────────────────────────────────

/**
 * Result from a completed workflow execution.
 *
 * Events are returned as SerializedEvent (the stable wire/JSON format).
 *
 * @template S - The state type
 */
export interface WorkflowResult<S> {
  /** Final state after workflow completion */
  readonly state: S
  /** Session ID for this execution */
  readonly sessionId: string
  /** All events generated during execution (wire format) */
  readonly events: ReadonlyArray<SerializedEvent>
  /** Whether workflow completed normally (vs error/abort) */
  readonly completed: boolean
  /** Final phase (for phased workflows) */
  readonly exitPhase?: string
}

// ─────────────────────────────────────────────────────────────────
// Workflow Errors (Effect Data.TaggedError)
// ─────────────────────────────────────────────────────────────────

/**
 * Agent execution failed during workflow.
 */
export class WorkflowAgentError extends Data.TaggedError("WorkflowAgentError")<{
  readonly agent: string
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Output validation failed (Zod schema mismatch).
 */
export class WorkflowValidationError extends Data.TaggedError("WorkflowValidationError")<{
  readonly agent: string
  readonly message: string
  readonly path?: string
}> {}

/**
 * Phase transition failed.
 */
export class WorkflowPhaseError extends Data.TaggedError("WorkflowPhaseError")<{
  readonly fromPhase: string
  readonly toPhase: string
  readonly message: string
}> {}

/**
 * Storage operation failed during workflow.
 */
export class WorkflowStoreError extends Data.TaggedError("WorkflowStoreError")<{
  readonly operation: "read" | "write" | "snapshot"
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Provider (LLM) error during workflow.
 */
export class WorkflowProviderError extends Data.TaggedError("WorkflowProviderError")<{
  readonly agent: string
  readonly code: "RATE_LIMITED" | "CONTEXT_EXCEEDED" | "AUTH_FAILED" | "NETWORK" | "UNKNOWN"
  readonly message: string
  readonly retryable: boolean
}> {}

/**
 * Workflow execution timed out.
 */
export class WorkflowTimeoutError extends Data.TaggedError("WorkflowTimeoutError")<{
  readonly phase?: string
  readonly agent?: string
  readonly timeoutMs: number
}> {}

/**
 * Workflow execution was aborted.
 */
export class WorkflowAbortedError extends Data.TaggedError("WorkflowAbortedError")<{
  readonly phase?: string
  readonly reason: string
}> {}

/**
 * Union of all workflow errors.
 */
export type WorkflowError =
  | WorkflowAgentError
  | WorkflowValidationError
  | WorkflowPhaseError
  | WorkflowStoreError
  | WorkflowProviderError
  | WorkflowTimeoutError
  | WorkflowAbortedError

// ─────────────────────────────────────────────────────────────────
// WorkflowObserver Protocol
// ─────────────────────────────────────────────────────────────────

/**
 * A request for human input during workflow execution.
 */
export interface InputRequest {
  /** Correlation ID for matching request to response (ADR-008) */
  readonly id: string
  readonly prompt: string
  readonly type: "approval" | "choice"
  readonly options?: ReadonlyArray<string>
}

/**
 * Observer protocol for workflow execution.
 *
 * All methods are optional — implement only the callbacks you need.
 * This enables UIs, loggers, and other consumers to observe workflow
 * execution without coupling to the runtime.
 *
 * @template S - The workflow state type
 */
export interface WorkflowObserver<S> {
  // Lifecycle
  onStarted?(sessionId: string): void
  onCompleted?(result: { state: S; events: ReadonlyArray<SerializedEvent> }): void
  /** Called when workflow execution fails with an error */
  onError?(error: unknown): void

  // State
  onStateChanged?(state: S, patches?: ReadonlyArray<unknown>): void
  onPhaseChanged?(phase: string, from?: string): void

  // Agent lifecycle
  onAgentStarted?(info: { agent: string; phase?: string }): void
  onAgentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void

  // Streaming content
  onTextDelta?(info: { agent: string; delta: string }): void
  onThinkingDelta?(info: { agent: string; delta: string }): void

  // Tool events
  onToolCalled?(info: { agent: string; toolId: string; toolName: string; input: unknown }): void
  onToolResult?(info: { agent: string; toolId: string; output: unknown; isError: boolean }): void

  // HITL
  onInputRequested?(request: InputRequest): Promise<string>

  // Raw catch-all (wire format)
  onEvent?(event: SerializedEvent): void
}
