/**
 * Agent factory function.
 *
 * Creates an Agent from configuration. Agents are the fundamental building
 * blocks of Open Harness - they have identity and make decisions.
 *
 * Agents are stateless - state lives on the harness level.
 * Agents are guard-less - use specific signal patterns or harness edges for control flow.
 *
 * @example
 * ```ts
 * // Simple agent
 * const helper = agent({ prompt: "You are a helpful assistant." })
 *
 * // Agent with structured output
 * const analyzer = agent({
 *   prompt: "Analyze the input and return structured data.",
 *   output: { schema: z.object({ sentiment: z.string() }) },
 * })
 *
 * // Reactive agent (v0.3.0)
 * const trader = agent({
 *   prompt: "Execute trades based on analysis.",
 *   activateOn: ["analysis:complete"],
 *   emits: ["trade:executed"],
 * })
 * ```
 */

import type { Agent, AgentConfig, ReactiveAgent } from "./types.js";

/**
 * Create an agent from configuration.
 *
 * The returned Agent can be:
 * - Passed to `run()` for execution (v0.2.0)
 * - Passed to `runReactive()` for reactive execution (v0.3.0, requires activateOn)
 * - Included in a harness via `harness({ agents: { ... } })`
 *
 * When `activateOn` is specified, the agent becomes a ReactiveAgent that can
 * respond to signals in a reactive workflow.
 *
 * @param config - Agent configuration including prompt and optional output
 * @returns An Agent or ReactiveAgent instance ready for execution
 *
 * @example
 * ```ts
 * import { agent, run } from "@open-harness/core"
 *
 * // Regular agent
 * const myAgent = agent({ prompt: "You are helpful." })
 * const result = await run(myAgent, { prompt: "Hello!" })
 *
 * // Reactive agent
 * const reactiveAgent = agent({
 *   prompt: "Analyze data.",
 *   activateOn: ["harness:start"],
 *   emits: ["analysis:complete"],
 * })
 * const result = await runReactive(reactiveAgent, { data: "..." })
 * ```
 */
export function agent<TOutput = unknown>(
	config: AgentConfig<TOutput>,
): Agent<TOutput> | ReactiveAgent<TOutput> {
	// Base agent structure
	const base = {
		_tag: "Agent" as const,
		config,
	};

	// If activateOn is present, mark as reactive agent
	if (config.activateOn !== undefined) {
		return {
			...base,
			_reactive: true as const,
		};
	}

	return base;
}
