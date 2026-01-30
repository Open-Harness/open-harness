/**
 * Exhaustive event dispatch using Effect Match.
 *
 * Per ADR-004: Events use Effect's discriminated union pattern with _tag field.
 * Match.exhaustive provides compile-time safety - adding a new event type to
 * WorkflowEvent will cause a compile error until it's handled here.
 *
 * @module
 */

import { Match } from "effect"

import type {
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
  WorkflowEvent,
  WorkflowStarted
} from "../Domain/Events.js"

import type { WorkflowObserver } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Type-Safe Event Handlers
// ─────────────────────────────────────────────────────────────────

/**
 * Handler for WorkflowStarted events.
 * Calls observer.onStarted with the session ID.
 */
const handleWorkflowStarted = (
  observer: WorkflowObserver<unknown>,
  event: WorkflowStarted
): void => {
  observer.onStarted?.(event.sessionId)
}

/**
 * Handler for WorkflowCompleted events.
 * Note: onCompleted is called separately with the full WorkflowResult,
 * not during event dispatch, to include the full state and events array.
 */
const handleWorkflowCompleted = (
  _observer: WorkflowObserver<unknown>,
  _event: WorkflowCompleted
): void => {
  // onCompleted is called at workflow end with full result, not here
}

/**
 * Handler for PhaseEntered events.
 * Calls observer.onPhaseChanged with the new phase and previous phase.
 */
const handlePhaseEntered = (
  observer: WorkflowObserver<unknown>,
  event: PhaseEntered
): void => {
  observer.onPhaseChanged?.(event.phase, event.fromPhase)
}

/**
 * Handler for PhaseExited events.
 * No corresponding observer callback for phase exit.
 */
const handlePhaseExited = (
  _observer: WorkflowObserver<unknown>,
  _event: PhaseExited
): void => {
  // No observer callback for phase exit
}

/**
 * Handler for AgentStarted events.
 * Calls observer.onAgentStarted with agent name and optional phase.
 */
const handleAgentStarted = (
  observer: WorkflowObserver<unknown>,
  event: AgentStarted
): void => {
  observer.onAgentStarted?.({ agent: event.agent, phase: event.phase })
}

/**
 * Handler for AgentCompleted events.
 * Calls observer.onAgentCompleted with agent name, output, and duration.
 */
const handleAgentCompleted = (
  observer: WorkflowObserver<unknown>,
  event: AgentCompleted
): void => {
  observer.onAgentCompleted?.({
    agent: event.agent,
    output: event.output,
    durationMs: event.durationMs
  })
}

/**
 * Handler for StateIntent events.
 * Per ADR-006: State is derived from patches. The projection fiber
 * applies patches and notifies via onStateChanged.
 */
const handleStateIntent = (
  _observer: WorkflowObserver<unknown>,
  _event: StateIntent
): void => {
  // State derived from patches per ADR-006; observer receives derived state
  // via the projection fiber, not directly from this event
}

/**
 * Handler for StateCheckpoint events.
 * Checkpoints are for replay optimization and may trigger onStateChanged.
 */
const handleStateCheckpoint = (
  observer: WorkflowObserver<unknown>,
  event: StateCheckpoint
): void => {
  observer.onStateChanged?.(event.state)
}

/**
 * Handler for SessionForked events.
 * Internal lineage tracking event, no observer callback.
 */
const handleSessionForked = (
  _observer: WorkflowObserver<unknown>,
  _event: SessionForked
): void => {
  // Internal lineage event, no observer callback
}

/**
 * Handler for TextDelta events.
 * Calls observer.onTextDelta with agent name and delta text.
 */
const handleTextDelta = (
  observer: WorkflowObserver<unknown>,
  event: TextDelta
): void => {
  observer.onTextDelta?.({ agent: event.agent, delta: event.delta })
}

/**
 * Handler for ThinkingDelta events.
 * Calls observer.onThinkingDelta with agent name and delta text.
 */
const handleThinkingDelta = (
  observer: WorkflowObserver<unknown>,
  event: ThinkingDelta
): void => {
  observer.onThinkingDelta?.({ agent: event.agent, delta: event.delta })
}

/**
 * Handler for ToolCalled events.
 * Calls observer.onToolCall with tool details.
 */
const handleToolCalled = (
  observer: WorkflowObserver<unknown>,
  event: ToolCalled
): void => {
  observer.onToolCall?.({
    agent: event.agent,
    toolId: event.toolId,
    toolName: event.toolName,
    input: event.input
  })
}

/**
 * Handler for ToolResult events.
 * Calls observer.onToolResult with result details.
 */
const handleToolResult = (
  observer: WorkflowObserver<unknown>,
  event: ToolResult
): void => {
  observer.onToolResult?.({
    agent: event.agent,
    toolId: event.toolId,
    output: event.output,
    isError: event.isError
  })
}

/**
 * Handler for InputRequested events.
 * HITL is handled via ADR-002's humanInput handler, not observer dispatch.
 */
const handleInputRequested = (
  _observer: WorkflowObserver<unknown>,
  _event: InputRequested
): void => {
  // HITL handled via ADR-002's humanInput handler, not observer dispatch
}

/**
 * Handler for InputReceived events.
 * Internal correlation event, no observer callback.
 */
const handleInputReceived = (
  _observer: WorkflowObserver<unknown>,
  _event: InputReceived
): void => {
  // Internal correlation event, no observer callback
}

// ─────────────────────────────────────────────────────────────────
// Exhaustive Dispatch Function
// ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a WorkflowEvent to observer callbacks using Match.exhaustive.
 *
 * This function provides compile-time exhaustiveness checking. If a new
 * event type is added to the WorkflowEvent union, TypeScript will error
 * here until a handler is added for that event type.
 *
 * Per ADR-004: Uses Effect's discriminated union pattern with _tag field
 * and Match.exhaustive for compile-time safety.
 *
 * @param observer - The workflow observer with optional callbacks
 * @param event - The workflow event to dispatch
 *
 * @example
 * ```typescript
 * const observer: WorkflowObserver<MyState> = {
 *   onStarted: (sessionId) => console.log(`Started: ${sessionId}`),
 *   onAgentCompleted: ({ agent }) => console.log(`${agent} done`)
 * }
 *
 * dispatchToObserver(observer, new WorkflowStarted({
 *   sessionId: "abc123",
 *   workflow: "myWorkflow",
 *   input: {},
 *   timestamp: new Date()
 * }))
 * ```
 */
export const dispatchToObserver = (
  observer: WorkflowObserver<unknown>,
  event: WorkflowEvent
): void => {
  // Exhaustive matching - compile error if any _tag is missing!
  Match.value(event).pipe(
    Match.tag("WorkflowStarted", (e) => handleWorkflowStarted(observer, e)),
    Match.tag("WorkflowCompleted", (e) => handleWorkflowCompleted(observer, e)),
    Match.tag("PhaseEntered", (e) => handlePhaseEntered(observer, e)),
    Match.tag("PhaseExited", (e) => handlePhaseExited(observer, e)),
    Match.tag("AgentStarted", (e) => handleAgentStarted(observer, e)),
    Match.tag("AgentCompleted", (e) => handleAgentCompleted(observer, e)),
    Match.tag("StateIntent", (e) => handleStateIntent(observer, e)),
    Match.tag("StateCheckpoint", (e) => handleStateCheckpoint(observer, e)),
    Match.tag("SessionForked", (e) => handleSessionForked(observer, e)),
    Match.tag("TextDelta", (e) => handleTextDelta(observer, e)),
    Match.tag("ThinkingDelta", (e) => handleThinkingDelta(observer, e)),
    Match.tag("ToolCalled", (e) => handleToolCalled(observer, e)),
    Match.tag("ToolResult", (e) => handleToolResult(observer, e)),
    Match.tag("InputRequested", (e) => handleInputRequested(observer, e)),
    Match.tag("InputReceived", (e) => handleInputReceived(observer, e)),
    Match.exhaustive
  )
}
