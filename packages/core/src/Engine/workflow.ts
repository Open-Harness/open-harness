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

import { Schema } from "effect"

import type { AgentDef } from "./agent.js"
import type { PhaseDef } from "./phase.js"
import type { Draft } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Workflow Definition Schema (ADR-005: Runtime Validation)
// ─────────────────────────────────────────────────────────────────

/**
 * Base fields shared by both SimpleWorkflow and PhaseWorkflow.
 * Note: initialState uses Schema.UndefinedOr(Schema.Unknown) with filter
 * to reject explicit `undefined` while accepting any other value.
 */
const WorkflowBaseSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.nonEmptyString()),
  initialState: Schema.Unknown.pipe(
    Schema.filter((v): v is unknown => v !== undefined, {
      message: () => "initialState cannot be undefined"
    })
  ),
  start: Schema.Unknown
})

/**
 * Schema for SimpleWorkflow (has 'agent', no 'phases').
 * Discriminated by the presence of the 'agent' field.
 */
const SimpleWorkflowSchema = Schema.Struct({
  ...WorkflowBaseSchema.fields,
  agent: Schema.Unknown,
  until: Schema.optional(Schema.Unknown)
})

/**
 * Schema for PhaseWorkflow (has 'phases', no 'agent').
 * Discriminated by the presence of the 'phases' field.
 */
const PhaseWorkflowSchema = Schema.Struct({
  ...WorkflowBaseSchema.fields,
  phases: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  startPhase: Schema.optional(Schema.String)
})

/**
 * Discriminated union schema for WorkflowDef.
 *
 * Uses structural discrimination: SimpleWorkflow has 'agent',
 * PhaseWorkflow has 'phases'. The schemas are mutually exclusive
 * since a valid workflow has exactly one of these fields.
 */
export const WorkflowDefSchema = Schema.Union(SimpleWorkflowSchema, PhaseWorkflowSchema)

/**
 * Type derived from WorkflowDefSchema for validation result.
 */
type WorkflowDefInput = Schema.Schema.Type<typeof WorkflowDefSchema>

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
// Validation Function (accepts unknown for testing)
// ─────────────────────────────────────────────────────────────────

/**
 * Validate a workflow definition from unknown input.
 *
 * Use this function when testing validation logic or when input
 * comes from an untrusted source (e.g., JSON parsing, user input).
 *
 * @param input - Untyped input to validate
 * @returns Validated workflow definition
 * @throws Error with user-friendly message if validation fails
 *
 * @example Testing validation errors:
 * ```typescript
 * it("throws if initialState is undefined", () => {
 *   expect(() => validateWorkflowDef({
 *     name: "test",
 *     initialState: undefined,
 *     start: () => {},
 *     agent: someAgent
 *   })).toThrow("Workflow \"test\" requires 'initialState' field")
 * })
 * ```
 */
export function validateWorkflowDef(input: unknown): WorkflowDef<unknown, unknown, string> {
  // Cast to SimpleWorkflowDef to match one overload - the implementation
  // will validate and potentially throw if it's actually a PhaseWorkflowDef
  // or has other issues. This is safe because we're testing validation.
  return workflow(input as SimpleWorkflowDef<unknown, unknown>)
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
  // Check for presence of discriminating fields on the input
  // (before schema validation to provide better error messages)
  const hasAgent = "agent" in def
  const hasPhases = "phases" in def

  // Mutual exclusivity check must happen first (before schema validation)
  // because Schema.Union will fail on inputs with both fields
  if (hasAgent && hasPhases) {
    // Need to extract name for error message
    const name = (def as { name?: string }).name ?? "unknown"
    throw new Error(`Workflow "${name}" cannot have both 'agent' and 'phases'`)
  }

  // Validate using WorkflowDefSchema (ADR-005: replaces double cast)
  // Schema.decodeUnknownSync throws ParseError if validation fails
  let validated: WorkflowDefInput
  try {
    validated = Schema.decodeUnknownSync(WorkflowDefSchema)(def)
  } catch {
    // Schema validation failed - provide user-friendly messages
    // Extract name for contextual errors (may be empty/undefined)
    const name = (def as { name?: string }).name

    if (!name) {
      throw new Error("Workflow requires 'name' field")
    }
    if ((def as { initialState?: unknown }).initialState === undefined) {
      throw new Error(`Workflow "${name}" requires 'initialState' field`)
    }
    if ((def as { start?: unknown }).start === undefined) {
      throw new Error(`Workflow "${name}" requires 'start' function`)
    }
    if (!hasAgent && !hasPhases) {
      throw new Error(`Workflow "${name}" requires either 'agent' or 'phases'`)
    }
    // Generic fallback for other schema errors
    throw new Error(`Workflow "${name}" validation failed`)
  }

  const { name } = validated

  // Validate start is a function (Schema validates presence, not type)
  if (typeof validated.start !== "function") {
    throw new Error(`Workflow "${name}" requires 'start' function`)
  }

  // Discriminate workflow type using type guards
  // Schema.Union validates the discriminated union; type guards narrow for further checks
  const isSimple = isSimpleWorkflow(def)
  const isPhased = isPhaseWorkflow(def)

  // This should not happen after schema validation, but explicit check for clarity
  if (!isSimple && !isPhased) {
    throw new Error(`Workflow "${name}" requires either 'agent' or 'phases'`)
  }

  // Validate simple workflow
  if (isSimple) {
    if (!def.agent) {
      throw new Error(`Workflow "${name}" has 'agent' but it's undefined`)
    }
  }

  // Validate phase workflow
  if (isPhased) {
    const phases = def.phases as Record<string, { terminal?: boolean }>
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
