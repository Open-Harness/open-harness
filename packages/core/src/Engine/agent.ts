/**
 * Agent definition for state-first DX.
 *
 * Agents are AI actors that:
 * - Receive state (read-only)
 * - Generate structured output (via Zod schema)
 * - Update state via Immer-style draft mutations
 *
 * Provider-agnostic: just specify model string, everything else passes through.
 *
 * @module
 */

import type { z } from "zod"

import type { Draft } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Agent Definition
// ─────────────────────────────────────────────────────────────────

/**
 * Agent definition - describes an AI actor that transforms state.
 *
 * @template S - State type the agent operates on
 * @template O - Output type from the agent (validated by Zod schema)
 * @template Ctx - Optional context type passed from phase forEach
 *
 * @example
 * ```typescript
 * const planner = agent({
 *   name: "planner",
 *   model: "claude-sonnet-4-5",
 *   output: z.object({ tasks: z.array(TaskSchema) }),
 *   prompt: (state) => `Create tasks for: ${state.goal}`,
 *   update: (output, draft) => {
 *     draft.tasks.push(...output.tasks)
 *   }
 * })
 * ```
 */
export interface AgentDef<S = unknown, O = unknown, Ctx = void> {
  /**
   * Unique name for this agent.
   * Used for identification in events and debugging.
   */
  readonly name: string

  /**
   * Model identifier string.
   * Passed through to the provider (e.g., "claude-sonnet-4-5", "gpt-4o").
   * Provider-agnostic: the runtime maps this to the appropriate provider.
   */
  readonly model: string

  /**
   * Provider-specific options.
   * Passed through to the SDK (tools, permissions, temperature, etc.)
   */
  readonly options?: Record<string, unknown>

  /**
   * Zod schema for structured output.
   * The agent's response is validated against this schema.
   */
  readonly output: z.ZodType<O>

  /**
   * Generate prompt from state (and optional context).
   *
   * For agents used with `forEach`, context is passed from each iteration.
   * For simple agents, only state is passed (Ctx = void).
   */
  readonly prompt: Ctx extends void ? (state: S) => string
    : (state: S, ctx: Ctx) => string

  /**
   * Update state based on agent output.
   *
   * Uses Immer draft - mutate directly, no need to return.
   * The framework wraps this in produce() internally.
   *
   * @param output - Validated output from the agent
   * @param draft - Immer draft of state (mutable)
   * @param ctx - Optional context from forEach
   */
  readonly update: Ctx extends void ? (output: O, draft: Draft<S>) => void
    : (output: O, draft: Draft<S>, ctx: Ctx) => void
}

// ─────────────────────────────────────────────────────────────────
// Agent Factory
// ─────────────────────────────────────────────────────────────────

/**
 * Create an agent definition with validation.
 *
 * This is a factory function that validates the agent configuration
 * and returns a typed AgentDef.
 *
 * @param def - Agent definition object
 * @returns Validated agent definition
 * @throws Error if required fields are missing
 *
 * @example Simple agent (no context):
 * ```typescript
 * const planner = agent({
 *   name: "planner",
 *   model: "claude-sonnet-4-5",
 *   output: z.object({ tasks: z.array(z.string()) }),
 *   prompt: (state) => `Plan: ${state.goal}`,
 *   update: (output, draft) => {
 *     draft.tasks = output.tasks
 *   }
 * })
 * ```
 *
 * @example Agent with context (for forEach):
 * ```typescript
 * interface TaskContext { task: Task }
 *
 * const worker = agent<State, WorkerOutput, TaskContext>({
 *   name: "worker",
 *   model: "claude-sonnet-4-5",
 *   output: z.object({ result: z.string() }),
 *   prompt: (state, ctx) => `Do: ${ctx.task.description}`,
 *   update: (output, draft, ctx) => {
 *     const task = draft.tasks.find(t => t.id === ctx.task.id)
 *     if (task) task.result = output.result
 *   }
 * })
 * ```
 */
export function agent<S, O, Ctx = void>(
  def: AgentDef<S, O, Ctx>
): AgentDef<S, O, Ctx> {
  // Validate required fields
  if (!def.name) {
    throw new Error("Agent requires 'name' field")
  }
  if (!def.model) {
    throw new Error(`Agent "${def.name}" requires 'model' field`)
  }
  if (!def.output) {
    throw new Error(`Agent "${def.name}" requires 'output' schema`)
  }
  if (!def.prompt) {
    throw new Error(`Agent "${def.name}" requires 'prompt' function`)
  }
  if (!def.update) {
    throw new Error(`Agent "${def.name}" requires 'update' function`)
  }

  // Return as-is (factory validates but doesn't transform)
  return def
}
