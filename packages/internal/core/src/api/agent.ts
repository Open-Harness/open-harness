/**
 * Agent factory function.
 *
 * Creates an Agent from configuration. Agents are the fundamental building
 * blocks of Open Harness - they have identity, make decisions, and
 * optionally maintain state.
 *
 * @example
 * ```ts
 * // Simple agent
 * const helper = agent({ prompt: "You are a helpful assistant." })
 *
 * // Agent with state
 * const chatbot = agent({
 *   prompt: "You are a conversational assistant.",
 *   state: { history: [] },
 * })
 *
 * // Agent with structured output
 * const analyzer = agent({
 *   prompt: "Analyze the input and return structured data.",
 *   output: { schema: z.object({ sentiment: z.string() }) },
 * })
 * ```
 */

import type { Agent, AgentConfig } from "./types.js";

/**
 * Create an agent from configuration.
 *
 * The returned Agent can be:
 * - Passed to `run()` for execution
 * - Included in a harness via `harness({ agents: { ... } })`
 *
 * @param config - Agent configuration including prompt and optional state/output
 * @returns An Agent instance ready for execution
 *
 * @example
 * ```ts
 * import { agent, run } from "@open-harness/core"
 *
 * const myAgent = agent({ prompt: "You are helpful." })
 * const result = await run(myAgent, { prompt: "Hello!" })
 * ```
 */
export function agent<TOutput = unknown, TState = Record<string, unknown>>(
	config: AgentConfig<TOutput, TState>,
): Agent<TOutput, TState> {
	return {
		_tag: "Agent",
		config,
	} as const;
}
