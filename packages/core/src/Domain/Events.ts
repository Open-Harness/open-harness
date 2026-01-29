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
 */
export class StateIntent extends Data.TaggedClass("StateIntent")<{
  readonly intentId: string
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
