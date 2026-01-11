/**
 * Workflow factory function.
 *
 * Creates a Workflow from configuration. Workflows coordinate multiple
 * agents - they own shared state, decide which agent runs next via edges,
 * and coordinate recordings.
 *
 * The workflow doesn't "execute" - agents execute. The workflow coordinates.
 * See SDK_DX_DECISIONS.md Decision #8.
 *
 * @example
 * ```ts
 * const myWorkflow = workflow({
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
import type { Workflow, WorkflowConfig, Edge, Agent } from "./types.js";

/**
 * Internal type for the flow definition built from workflow config.
 * This extends the Workflow type with the computed flow.
 */
export type WorkflowWithFlow<TState = Record<string, unknown>> = Workflow<TState> & {
	/**
	 * Internal flow definition built from the workflow config.
	 * Used by the runtime to execute the workflow.
	 */
	readonly _flow: FlowDefinition;
};

/**
 * Default node type for agents in a workflow.
 * This maps to the agent node type in the registry.
 */
const AGENT_NODE_TYPE = "agent";

/**
 * Build a NodeDefinition from an Agent and its key.
 * Note: Agents are stateless. State lives on the workflow level.
 */
function buildNodeDefinition(agentId: string, agentDef: Agent): NodeDefinition {
	return {
		id: agentId,
		type: AGENT_NODE_TYPE,
		input: {
			prompt: agentDef.config.prompt,
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
 * Build a FlowDefinition from WorkflowConfig.
 *
 * Transforms the user-friendly workflow config into the internal
 * flow definition used by the runtime.
 */
function buildFlowDefinition<TState>(config: WorkflowConfig<TState>): FlowDefinition {
	const nodes: NodeDefinition[] = Object.entries(config.agents).map(
		([id, agent]) => buildNodeDefinition(id, agent),
	);

	const edges: EdgeDefinition[] = config.edges.map((edge, index) =>
		buildEdgeDefinition(edge, index),
	);

	return {
		name: "workflow",
		nodes,
		edges,
		state: config.state
			? { initial: config.state as Record<string, unknown> }
			: undefined,
	};
}

/**
 * Create a workflow from configuration.
 *
 * The returned Workflow can be passed to `run()` for execution.
 * It coordinates multiple agents through defined edges.
 *
 * @param config - Workflow configuration including agents and edges
 * @returns A Workflow instance ready for execution
 *
 * @example
 * ```ts
 * import { agent, workflow, run } from "@open-harness/core"
 *
 * const coder = agent({ prompt: "You write code." })
 * const reviewer = agent({ prompt: "You review code." })
 *
 * const myWorkflow = workflow({
 *   agents: { coder, reviewer },
 *   edges: [{ from: "coder", to: "reviewer" }],
 *   state: { iterations: 0 },
 * })
 *
 * const result = await run(myWorkflow, { task: "Build a CLI" })
 * ```
 */
export function workflow<TState = Record<string, unknown>>(
	config: WorkflowConfig<TState>,
): WorkflowWithFlow<TState> {
	const flow = buildFlowDefinition(config);

	return {
		_tag: "Workflow",
		config,
		_flow: flow,
	} as const;
}
