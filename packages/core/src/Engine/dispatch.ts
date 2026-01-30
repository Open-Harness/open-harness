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

import type { AnyEvent, EventId, WorkflowObserver } from "./types.js"

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
  // Build object with optional phase only if defined (exactOptionalPropertyTypes)
  const info: { agent: string; phase?: string } = { agent: event.agent }
  if (event.phase !== undefined) info.phase = event.phase
  observer.onAgentStarted?.(info)
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
 * Calls onStateChanged with both state and patches for backward compatibility.
 */
const handleStateIntent = (
  observer: WorkflowObserver<unknown>,
  event: StateIntent
): void => {
  // StateIntent now includes state for observer compatibility
  observer.onStateChanged?.(event.state, event.patches)
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
 * Calls observer.onToolCalled with tool details.
 */
const handleToolCalled = (
  observer: WorkflowObserver<unknown>,
  event: ToolCalled
): void => {
  observer.onToolCalled?.({
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
/**
 * Convert WorkflowEvent to legacy AnyEvent format for onEvent callback.
 * Maps new field names to legacy names for backward compatibility.
 */
const toSerializedEvent = (event: WorkflowEvent): AnyEvent => {
  const { _tag, timestamp, ...payload } = event
  const nameMap: Record<WorkflowEvent["_tag"], string> = {
    WorkflowStarted: "workflow:started",
    WorkflowCompleted: "workflow:completed",
    PhaseEntered: "phase:entered",
    PhaseExited: "phase:exited",
    AgentStarted: "agent:started",
    AgentCompleted: "agent:completed",
    StateIntent: "state:updated",
    StateCheckpoint: "state:updated",
    SessionForked: "workflow:started",
    TextDelta: "text:delta",
    ThinkingDelta: "thinking:delta",
    ToolCalled: "tool:called",
    ToolResult: "tool:result",
    InputRequested: "input:requested",
    InputReceived: "input:response"
  }

  // Format payload for backward compatibility
  let finalPayload: unknown = payload
  if (_tag === "StateIntent") {
    const intentPayload = payload as { intentId: string; state: unknown; patches: unknown; inversePatches: unknown }
    finalPayload = {
      state: intentPayload.state,
      patches: intentPayload.patches,
      inversePatches: intentPayload.inversePatches
    }
  } else if (_tag === "InputRequested") {
    const reqPayload = payload as { id: string; prompt: string; type: string; options?: unknown }
    finalPayload = {
      promptText: reqPayload.prompt,
      inputType: reqPayload.type,
      options: reqPayload.options
    }
  } else if (_tag === "InputReceived") {
    const recPayload = payload as { id: string; value: string; approved?: boolean }
    finalPayload = {
      response: recPayload.value
    }
  }

  return {
    id: crypto.randomUUID() as EventId,
    name: nameMap[_tag],
    payload: finalPayload,
    timestamp
  }
}

export const dispatchToObserver = (
  observer: WorkflowObserver<unknown>,
  event: WorkflowEvent
): void => {
  // Always call onEvent first with serialized event (legacy format)
  observer.onEvent?.(toSerializedEvent(event))

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
