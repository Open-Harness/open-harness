/**
 * Workflow definition for state-first DX.
 *
 * Two workflow shapes:
 * - SimpleWorkflow: Single agent running until completion
 * - PhaseWorkflow: State machine with explicit phases
 *
 * Both share the same execution model (events, recording, etc.)
 *
 * @module
 */

import type { AgentDef } from "./agent.js"
import type { PhaseDef } from "./phase.js"
import type { Draft } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Simple Workflow (Single Agent)
// ─────────────────────────────────────────────────────────────────

/**
 * Simple workflow definition - single agent running until completion.
 *
 * Use this when you don't need phase transitions, just want to run
 * an agent until some condition is met.
 *
 * @template S - State type
 * @template Input - Input type (defaults to string)
 *
 * @example
 * ```typescript
 * const chatWorkflow = workflow({
 *   name: "chat",
 *   initialState: { messages: [], done: false },
 *   start: (input, draft) => {
 *     draft.messages.push({ role: "user", content: input })
 *   },
 *   agent: chatAgent,
 *   until: (state) => state.done
 * })
 * ```
 */
export interface SimpleWorkflowDef<S, Input = string> {
  /** Unique name for this workflow */
  readonly name: string

  /** Initial state when workflow starts */
  readonly initialState: S

  /**
   * Process input and initialize state.
   * Called once at workflow start.
   *
   * @param input - User-provided input
   * @param draft - Immer draft of initial state
   */
  readonly start: (input: Input, draft: Draft<S>) => void

  /**
   * Agent to run repeatedly.
   * Runs in a loop until `until` returns true.
   *
   * Note: Uses `any` for output type - see phase.ts for rationale.
   */

  readonly agent: AgentDef<S, any, void>

  /**
   * Exit condition for the agent loop.
   * If not provided, agent runs once.
   *
   * @param state - Current state after agent update
   * @returns true to exit, false to continue
   */
  readonly until?: (state: S) => boolean
}

// ─────────────────────────────────────────────────────────────────
// Phase Workflow (State Machine)
// ─────────────────────────────────────────────────────────────────

/**
 * Phase workflow definition - state machine with explicit phases.
 *
 * Each phase can run agents, request human input, or both.
 * Transitions between phases based on `next` field.
 *
 * @template S - State type
 * @template Input - Input type (defaults to string)
 * @template Phases - Union of phase name literals
 *
 * @example
 * ```typescript
 * const scaffoldWorkflow = workflow({
 *   name: "planner-worker-judge",
 *   initialState: { goal: "", tasks: [], verdict: null },
 *   start: (input, draft) => { draft.goal = input },
 *   phases: {
 *     planning: { run: planner, until: (s, o) => o.done, next: "working" },
 *     working: { run: worker, parallel: 5, forEach: (s) => s.tasks, until: (s) => ..., next: "judging" },
 *     judging: { run: judge, next: (s) => s.verdict === "continue" ? "planning" : "done" },
 *     done: phase.terminal()
 *   }
 * })
 * ```
 */
export interface PhaseWorkflowDef<S, Input = string, Phases extends string = string> {
  /** Unique name for this workflow */
  readonly name: string

  /** Initial state when workflow starts */
  readonly initialState: S

  /**
   * Process input and initialize state.
   * Called once at workflow start.
   *
   * @param input - User-provided input
   * @param draft - Immer draft of initial state
   */
  readonly start: (input: Input, draft: Draft<S>) => void

  /**
   * Phase definitions keyed by phase name.
   * First phase in object order is the starting phase.
   *
   * Note: Uses `any` for context type - each phase can have different context.
   */

  readonly phases: { readonly [P in Phases]: PhaseDef<S, Phases, any> }

  /**
   * Optional starting phase override.
   * If not provided, uses first phase in `phases` object.
   */
  readonly startPhase?: Phases
}

// ─────────────────────────────────────────────────────────────────
// Discriminated Union
// ─────────────────────────────────────────────────────────────────

/**
 * Workflow definition - either simple or phased.
 *
 * Use type guards `isSimpleWorkflow` and `isPhaseWorkflow` to narrow.
 */
export type WorkflowDef<S, Input = string, Phases extends string = string> =
  | SimpleWorkflowDef<S, Input>
  | PhaseWorkflowDef<S, Input, Phases>

/**
 * Type guard for simple workflows.
 */
export function isSimpleWorkflow<S, Input>(
  def: WorkflowDef<S, Input, string>
): def is SimpleWorkflowDef<S, Input> {
  return "agent" in def && !("phases" in def)
}

/**
 * Type guard for phase workflows.
 */
export function isPhaseWorkflow<S, Input, Phases extends string>(
  def: WorkflowDef<S, Input, Phases>
): def is PhaseWorkflowDef<S, Input, Phases> {
  return "phases" in def && !("agent" in def)
}

// ─────────────────────────────────────────────────────────────────
// Workflow Factory
// ─────────────────────────────────────────────────────────────────

/**
 * Create a simple workflow (single agent).
 */
export function workflow<S, Input = string>(
  def: SimpleWorkflowDef<S, Input>
): SimpleWorkflowDef<S, Input>

/**
 * Create a phase workflow (state machine).
 */
export function workflow<S, Input = string, Phases extends string = string>(
  def: PhaseWorkflowDef<S, Input, Phases>
): PhaseWorkflowDef<S, Input, Phases>

/**
 * Create a workflow definition with validation.
 *
 * Overloaded to support both simple and phase workflows.
 *
 * @param def - Workflow definition object
 * @returns Validated workflow definition
 * @throws Error if required fields are missing
 *
 * @example Simple workflow:
 * ```typescript
 * const chat = workflow({
 *   name: "chat",
 *   initialState: { messages: [] },
 *   start: (input, draft) => { draft.messages.push({ role: "user", content: input }) },
 *   agent: chatAgent,
 *   until: (state) => state.done
 * })
 * ```
 *
 * @example Phase workflow:
 * ```typescript
 * const scaffold = workflow({
 *   name: "scaffold",
 *   initialState: { goal: "", tasks: [] },
 *   start: (input, draft) => { draft.goal = input },
 *   phases: {
 *     planning: { run: planner, next: "working" },
 *     working: { run: worker, next: "done" },
 *     done: phase.terminal()
 *   }
 * })
 * ```
 */
export function workflow<S, Input = string, Phases extends string = string>(
  def: WorkflowDef<S, Input, Phases>
): WorkflowDef<S, Input, Phases> {
  // Cast to unknown then to Record for validation logic
  const d = def as unknown as Record<string, unknown>
  const name = d.name as string

  // Validate required fields
  if (!name) {
    throw new Error("Workflow requires 'name' field")
  }
  if (d.initialState === undefined) {
    throw new Error(`Workflow "${name}" requires 'initialState' field`)
  }
  if (!d.start) {
    throw new Error(`Workflow "${name}" requires 'start' function`)
  }

  // Validate workflow type
  const hasAgent = "agent" in d
  const hasPhases = "phases" in d

  if (hasAgent && hasPhases) {
    throw new Error(`Workflow "${name}" cannot have both 'agent' and 'phases'`)
  }

  if (!hasAgent && !hasPhases) {
    throw new Error(`Workflow "${name}" requires either 'agent' or 'phases'`)
  }

  // Validate simple workflow
  if (hasAgent) {
    if (!d.agent) {
      throw new Error(`Workflow "${name}" has 'agent' but it's undefined`)
    }
  }

  // Validate phase workflow
  if (hasPhases) {
    const phases = d.phases as Record<string, { terminal?: boolean }>
    const phaseNames = Object.keys(phases)

    if (phaseNames.length === 0) {
      throw new Error(`Workflow "${name}" has empty 'phases'`)
    }

    // Check for at least one terminal phase
    const hasTerminal = phaseNames.some((phaseName) => {
      const phaseObj = phases[phaseName]
      return phaseObj?.terminal === true
    })

    if (!hasTerminal) {
      throw new Error(`Workflow "${name}" must have at least one terminal phase`)
    }
  }

  return def
}
