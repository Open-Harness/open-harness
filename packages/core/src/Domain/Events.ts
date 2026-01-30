/**
 * Workflow event definitions using Effect's Data.TaggedClass.
 *
 * Per ADR-004: Events use Effect's discriminated union pattern with _tag field.
 * This enables compile-time exhaustive matching via Match.exhaustive.
 *
 * @module
 */

import { Data } from "effect"

// ═══════════════════════════════════════════════════════════════
// Workflow Lifecycle Events
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted when workflow execution begins.
 */
export class WorkflowStarted extends Data.TaggedClass("WorkflowStarted")<{
  readonly sessionId: string
  /** Short workflow name per ADR-008 */
  readonly workflow: string
  readonly input: unknown
  readonly timestamp: Date
}> {}

/**
 * Emitted when workflow execution completes successfully.
 */
export class WorkflowCompleted extends Data.TaggedClass("WorkflowCompleted")<{
  readonly sessionId: string
  readonly finalState: unknown
  readonly exitPhase?: string
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Phase Lifecycle Events
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted when entering a new phase.
 */
export class PhaseEntered extends Data.TaggedClass("PhaseEntered")<{
  readonly phase: string
  readonly fromPhase?: string
  readonly timestamp: Date
}> {}

/**
 * Emitted when exiting a phase.
 */
export class PhaseExited extends Data.TaggedClass("PhaseExited")<{
  readonly phase: string
  readonly reason: "next" | "terminal" | "error"
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Agent Lifecycle Events
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted when an agent begins execution.
 */
export class AgentStarted extends Data.TaggedClass("AgentStarted")<{
  /** Short agent name per ADR-008 */
  readonly agent: string
  readonly phase?: string
  readonly context?: unknown
  readonly timestamp: Date
}> {}

/**
 * Emitted when an agent completes execution.
 */
export class AgentCompleted extends Data.TaggedClass("AgentCompleted")<{
  /** Short agent name per ADR-008 */
  readonly agent: string
  readonly output: unknown
  readonly durationMs: number
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// State Events (ADR-006: Event Sourcing)
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted when state changes via Immer patches.
 * This is the source of truth for state changes per ADR-006.
 *
 * Includes full state for backward compatibility with observer.onStateChanged.
 * Pure event sourcing systems can ignore the state and derive from patches.
 */
export class StateIntent extends Data.TaggedClass("StateIntent")<{
  readonly intentId: string
  /** The new state after applying patches (for observer compatibility) */
  readonly state: unknown
  readonly patches: ReadonlyArray<unknown>
  readonly inversePatches: ReadonlyArray<unknown>
  readonly timestamp: Date
}> {}

/**
 * Emitted for replay optimization (snapshot at phase boundaries).
 * Per ADR-006: Snapshots speed up state derivation on replay.
 */
export class StateCheckpoint extends Data.TaggedClass("StateCheckpoint")<{
  readonly state: unknown
  readonly position: number
  readonly phase: string
  readonly timestamp: Date
}> {}

/**
 * Emitted when a session is forked for alternative exploration.
 * Tracks lineage for fork/resume per ADR-006.
 */
export class SessionForked extends Data.TaggedClass("SessionForked")<{
  readonly parentSessionId: string
  readonly forkIndex: number
  readonly initialState: unknown
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Streaming Content Events
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted for streaming text output from an agent.
 */
export class TextDelta extends Data.TaggedClass("TextDelta")<{
  /** Short agent name per ADR-008 */
  readonly agent: string
  readonly delta: string
  readonly timestamp: Date
}> {}

/**
 * Emitted for streaming thinking/reasoning output from an agent.
 */
export class ThinkingDelta extends Data.TaggedClass("ThinkingDelta")<{
  /** Short agent name per ADR-008 */
  readonly agent: string
  readonly delta: string
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Tool Events
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted when an agent calls a tool.
 */
export class ToolCalled extends Data.TaggedClass("ToolCalled")<{
  /** Short agent name per ADR-008 */
  readonly agent: string
  readonly toolId: string
  readonly toolName: string
  readonly input: unknown
  readonly timestamp: Date
}> {}

/**
 * Emitted when a tool returns its result.
 */
export class ToolResult extends Data.TaggedClass("ToolResult")<{
  /** Short agent name per ADR-008 */
  readonly agent: string
  readonly toolId: string
  readonly output: unknown
  readonly isError: boolean
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Human-in-the-Loop (HITL) Events
// ═══════════════════════════════════════════════════════════════

/**
 * Emitted when human input is requested.
 */
export class InputRequested extends Data.TaggedClass("InputRequested")<{
  /** Correlation ID for matching request to response */
  readonly id: string
  /** Short prompt per ADR-008 */
  readonly prompt: string
  readonly type: "approval" | "choice"
  readonly options?: ReadonlyArray<string>
  readonly timestamp: Date
}> {}

/**
 * Emitted when human input is received.
 */
export class InputReceived extends Data.TaggedClass("InputReceived")<{
  /** Correlates to InputRequested.id */
  readonly id: string
  readonly value: string
  readonly approved?: boolean
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Union Type
// ═══════════════════════════════════════════════════════════════

/**
 * Union of all workflow events.
 *
 * Use with Match.value().pipe(Match.tag(...), Match.exhaustive) for
 * compile-time exhaustive handling of all event types.
 *
 * @example
 * ```typescript
 * import { Match } from "effect"
 *
 * const handleEvent = (event: WorkflowEvent) =>
 *   Match.value(event).pipe(
 *     Match.tag("WorkflowStarted", (e) => console.log(`Started: ${e.sessionId}`)),
 *     Match.tag("AgentCompleted", (e) => console.log(`Agent ${e.agent} done`)),
 *     // ... handle all other tags
 *     Match.exhaustive  // Compile error if any tag missing!
 *   )
 * ```
 */
export type WorkflowEvent =
  | WorkflowStarted
  | WorkflowCompleted
  | PhaseEntered
  | PhaseExited
  | AgentStarted
  | AgentCompleted
  | StateIntent
  | StateCheckpoint
  | SessionForked
  | TextDelta
  | ThinkingDelta
  | ToolCalled
  | ToolResult
  | InputRequested
  | InputReceived

/**
 * Extract the _tag literal type from WorkflowEvent.
 * Useful for type-level operations.
 */
export type WorkflowEventTag = WorkflowEvent["_tag"]

// ═══════════════════════════════════════════════════════════════
// Serialization (JSON Boundary) - ADR-004
// ═══════════════════════════════════════════════════════════════

/**
 * Branded EventId type for type safety.
 * Uses UUID v4 format at runtime.
 */
export type EventId = string & { readonly _brand: "EventId" }

/**
 * Generate a new EventId synchronously.
 * Uses crypto.randomUUID() which is available in Node.js 19+ and modern browsers.
 */
export const generateEventId = (): EventId => crypto.randomUUID() as EventId

/**
 * JSON-friendly event format for storage and SSE.
 *
 * Per ADR-004: This is the serialized format sent over the wire
 * and persisted to EventStore. The internal WorkflowEvent (Data.TaggedClass)
 * is converted to this format at serialization boundaries.
 */
export interface SerializedEvent {
  /** Unique event identifier (UUID v4) */
  readonly id: EventId
  /** Colon-separated event name, e.g., "workflow:started", "agent:completed" */
  readonly name: string
  /** Event-specific payload (all fields except _tag and timestamp) */
  readonly payload: Record<string, unknown>
  /** Unix timestamp in milliseconds */
  readonly timestamp: number
  /** ID of the event that caused this one (for causality tracking) */
  readonly causedBy?: EventId
}

/**
 * Map from Data.TaggedClass _tag to colon-separated event name.
 *
 * Per ADR-004: Convert internal _tag values to external event names
 * like "workflow:started" for storage/SSE compatibility.
 */
export const tagToEventName: Record<WorkflowEventTag, string> = {
  WorkflowStarted: "workflow:started",
  WorkflowCompleted: "workflow:completed",
  PhaseEntered: "phase:entered",
  PhaseExited: "phase:exited",
  AgentStarted: "agent:started",
  AgentCompleted: "agent:completed",
  StateIntent: "state:intent",
  StateCheckpoint: "state:checkpoint",
  SessionForked: "session:forked",
  TextDelta: "text:delta",
  ThinkingDelta: "thinking:delta",
  ToolCalled: "tool:called",
  ToolResult: "tool:result",
  InputRequested: "input:requested",
  InputReceived: "input:received"
}

/**
 * Convert WorkflowEvent (Data.TaggedClass) to SerializedEvent (JSON format).
 *
 * Per ADR-004: Serialization layer for storage and SSE. The EventId is
 * generated at serialization time, not at event creation time.
 *
 * @param event - The WorkflowEvent to serialize
 * @param id - Optional EventId (generated if not provided)
 * @param causedBy - Optional ID of the event that caused this one
 * @returns SerializedEvent ready for storage/transmission
 *
 * @example
 * ```typescript
 * const serialized = toSerializedEvent(new WorkflowStarted({
 *   sessionId: "abc-123",
 *   workflow: "task-planner",
 *   input: { query: "hello" },
 *   timestamp: new Date()
 * }))
 * // { id: "uuid...", name: "workflow:started", payload: {...}, timestamp: 1234567890 }
 * ```
 */
export const toSerializedEvent = (
  event: WorkflowEvent,
  id?: EventId,
  causedBy?: EventId
): SerializedEvent => {
  const { _tag, timestamp, ...payload } = event
  return {
    id: id ?? generateEventId(),
    name: tagToEventName[_tag],
    payload: payload as Record<string, unknown>,
    timestamp: timestamp.getTime(),
    ...(causedBy !== undefined ? { causedBy } : {})
  }
}
