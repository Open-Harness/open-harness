/**
 * Phase definition for state-first DX.
 *
 * Phases are the units of a workflow state machine:
 * - Each phase can run an agent, request human input, or both
 * - `forEach` enables parallel execution with typed context
 * - `until` predicate controls when phase exits
 * - `next` determines the transition (static or dynamic)
 *
 * @module
 */

import type { AgentDef } from "./agent.js"
import type { Draft } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Human-in-the-Loop Configuration
// ─────────────────────────────────────────────────────────────────

/**
 * Configuration for requesting human input during a phase.
 *
 * @template S - State type
 */
export interface HumanConfig<S> {
  /**
   * Generate the prompt shown to the human.
   * Receives current state to build context-aware prompts.
   */
  readonly prompt: (state: S) => string

  /**
   * Type of input expected:
   * - "freeform": Open text input
   * - "approval": Yes/No decision
   * - "choice": Select from options
   */
  readonly type: "freeform" | "approval" | "choice"

  /**
   * Available options for "choice" type.
   * Required when type is "choice".
   */
  readonly options?: ReadonlyArray<string>
}

// ─────────────────────────────────────────────────────────────────
// Phase Definition
// ─────────────────────────────────────────────────────────────────

/**
 * Phase definition - describes a step in the workflow state machine.
 *
 * @template S - State type
 * @template Phases - Union of phase name literals
 * @template Ctx - Context type for forEach (void if not using forEach)
 * @template O - Output type from the agent (inferred from run)
 *
 * @example Simple agent phase:
 * ```typescript
 * const planning = phase<State, "planning" | "working" | "done">({
 *   run: planner,
 *   until: (state, output) => output.done,
 *   next: "working"
 * })
 * ```
 *
 * @example Parallel agent phase:
 * ```typescript
 * const working = phase<State, Phases, { task: Task }>({
 *   run: worker,
 *   parallel: 5,
 *   forEach: (state) => state.tasks.filter(t => t.status === "pending").map(t => ({ task: t })),
 *   until: (state) => state.tasks.every(t => t.status === "completed"),
 *   next: "judging"
 * })
 * ```
 *
 * @example Human-in-the-loop phase:
 * ```typescript
 * const review = phase<State, Phases>({
 *   human: {
 *     prompt: (state) => `Review: ${state.draft}`,
 *     type: "approval"
 *   },
 *   onResponse: (response, draft) => {
 *     draft.approved = response === "approve"
 *   },
 *   next: (state) => state.approved ? "done" : "revise"
 * })
 * ```
 */

export interface PhaseDef<S = unknown, Phases extends string = string, Ctx = void> {
  /**
   * Agent to run in this phase.
   * If using forEach, agent receives context from each iteration.
   *
   * Note: Uses `any` for output type to allow any agent regardless of its
   * specific output type. Type safety is enforced at the agent definition
   * level, not the phase level. This is a deliberate variance escape hatch.
   */

  readonly run?: Ctx extends void ? AgentDef<S, any, void>
    : AgentDef<S, any, Ctx>

  /**
   * Human input configuration.
   * Mutually exclusive with `run` in most cases, but both can be present
   * for agent-assisted human decisions.
   */
  readonly human?: HumanConfig<S>

  /**
   * Process human response and update state.
   * Only used when `human` is configured.
   */
  readonly onResponse?: (response: string, draft: Draft<S>) => void

  /**
   * Maximum concurrent agent executions.
   * Only applies when `forEach` is also specified.
   * Default: 1 (sequential)
   */
  readonly parallel?: number

  /**
   * Generate context items for parallel agent execution.
   * Each item becomes the context for one agent run.
   * Agent must accept context type Ctx.
   */
  readonly forEach?: (state: S) => ReadonlyArray<Ctx>

  /**
   * Condition to check if phase should continue or exit.
   *
   * For agent phases: called after each agent run with the output.
   * For human phases: called after response is processed.
   *
   * Return true to exit the phase.
   * If not provided, phase exits after single run.
   *
   * @param state - Current state
   * @param output - Agent output (if agent phase)
   */
  readonly until?: (state: S, output?: unknown) => boolean

  /**
   * Next phase to transition to.
   *
   * Can be:
   * - Static string: always go to this phase
   * - Function: dynamically choose based on state
   *
   * Not needed for terminal phases.
   */
  readonly next?: Phases | ((state: S) => Phases)

  /**
   * Mark this phase as terminal (workflow ends here).
   * Mutually exclusive with `next`.
   */
  readonly terminal?: boolean
}

// ─────────────────────────────────────────────────────────────────
// Phase Factory
// ─────────────────────────────────────────────────────────────────

/**
 * Create a phase definition.
 *
 * This is primarily for type inference - it returns the definition as-is
 * but helps TypeScript infer the correct types.
 *
 * @param def - Phase definition object
 * @returns The phase definition (typed)
 */
export function phase<S, Phases extends string, Ctx = void>(
  def: PhaseDef<S, Phases, Ctx>
): PhaseDef<S, Phases, Ctx> {
  // Validate mutually exclusive options
  if (def.terminal && def.next !== undefined) {
    throw new Error("Phase cannot have both 'terminal: true' and 'next'")
  }

  if (!def.terminal && def.next === undefined && !def.human) {
    throw new Error("Phase requires 'next' transition or 'terminal: true'")
  }

  if (def.parallel !== undefined && def.forEach === undefined) {
    throw new Error("Phase 'parallel' requires 'forEach'")
  }

  if (def.onResponse !== undefined && def.human === undefined) {
    throw new Error("Phase 'onResponse' requires 'human' configuration")
  }

  return def
}

/**
 * Create a terminal phase definition.
 *
 * Shorthand for `phase({ terminal: true })`.
 *
 * @example
 * ```typescript
 * phases: {
 *   planning: { run: planner, next: "working" },
 *   working: { run: worker, next: "done" },
 *   done: phase.terminal()
 * }
 * ```
 */
phase.terminal = <S, Phases extends string>(): PhaseDef<S, Phases, void> => ({
  terminal: true
})
