/**
 * Harness factory function.
 *
 * Creates a Harness from configuration. Harnesses coordinate multiple
 * agents - they own shared state, decide which agent runs next via edges,
 * and coordinate recordings.
 *
 * The harness doesn't "execute" - agents execute. The harness coordinates.
 * See SDK_DX_DECISIONS.md Decision #8.
 *
 * @example
 * ```ts
 * const workflow = harness({
 *   agents: {
 *     coder: agent({ prompt: "You are a coder." }),
 *     reviewer: agent({ prompt: "You are a code reviewer." }),
 *   },
 *   edges: [
 *     { from: "coder", to: "reviewer" },
 *   ],
 * })
 * ```
 */

import type { FlowDefinition, EdgeDefinition, NodeDefinition } from "../state/types.js";
import type { Harness, HarnessConfig, Edge, Agent } from "./types.js";

/**
 * Internal type for the flow definition built from harness config.
 * This extends the Harness type with the computed flow.
 */
export type HarnessWithFlow<TState = Record<string, unknown>> = Harness<TState> & {
	/**
	 * Internal flow definition built from the harness config.
	 * Used by the runtime to execute the harness.
	 */
	readonly _flow: FlowDefinition;
};

/**
 * Default node type for agents in a harness.
 * This maps to the agent node type in the registry.
 */
const AGENT_NODE_TYPE = "agent";

/**
 * Build a NodeDefinition from an Agent and its key.
 */
function buildNodeDefinition(agentId: string, agentDef: Agent): NodeDefinition {
	return {
		id: agentId,
		type: AGENT_NODE_TYPE,
		input: {
			prompt: agentDef.config.prompt,
			state: agentDef.config.state,
			output: agentDef.config.output,
		},
	};
}

/**
 * Build an EdgeDefinition from an Edge.
 */
function buildEdgeDefinition(edge: Edge, index: number): EdgeDefinition {
	return {
		id: `edge-${index}`,
		from: edge.from,
		to: edge.to,
		when: edge.when,
	};
}

/**
 * Build a FlowDefinition from HarnessConfig.
 *
 * Transforms the user-friendly harness config into the internal
 * flow definition used by the runtime.
 */
function buildFlowDefinition<TState>(config: HarnessConfig<TState>): FlowDefinition {
	const nodes: NodeDefinition[] = Object.entries(config.agents).map(
		([id, agent]) => buildNodeDefinition(id, agent),
	);

	const edges: EdgeDefinition[] = config.edges.map((edge, index) =>
		buildEdgeDefinition(edge, index),
	);

	return {
		name: "harness",
		nodes,
		edges,
		state: config.state
			? { initial: config.state as Record<string, unknown> }
			: undefined,
	};
}

/**
 * Create a harness from configuration.
 *
 * The returned Harness can be passed to `run()` for execution.
 * It coordinates multiple agents through defined edges.
 *
 * @param config - Harness configuration including agents and edges
 * @returns A Harness instance ready for execution
 *
 * @example
 * ```ts
 * import { agent, harness, run } from "@open-harness/core"
 *
 * const coder = agent({ prompt: "You write code." })
 * const reviewer = agent({ prompt: "You review code." })
 *
 * const workflow = harness({
 *   agents: { coder, reviewer },
 *   edges: [{ from: "coder", to: "reviewer" }],
 *   state: { iterations: 0 },
 * })
 *
 * const result = await run(workflow, { task: "Build a CLI" })
 * ```
 */
export function harness<TState = Record<string, unknown>>(
	config: HarnessConfig<TState>,
): HarnessWithFlow<TState> {
	const flow = buildFlowDefinition(config);

	return {
		_tag: "Harness",
		config,
		_flow: flow,
	} as const;
}
