// Flow compiler (DAG validation + topological sort)
// Implements docs/flow/execution.md (sequential scheduling rules)

import type { FlowYaml, NodeSpec } from "../protocol/flow.js";
import { validateFlowYaml } from "./validator.js";

export interface CompiledFlow {
	nodes: NodeSpec[];
	order: NodeSpec[];
	adjacency: Map<string, string[]>;
}

export function compileFlow(flow: FlowYaml): CompiledFlow {
	const validated = validateFlowYaml(flow);
	const nodes = validated.nodes;

	const adjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	for (const node of nodes) {
		adjacency.set(node.id, []);
		inDegree.set(node.id, 0);
	}

	for (const edge of validated.edges) {
		const list = adjacency.get(edge.from);
		if (list) {
			list.push(edge.to);
		}
		inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
	}

	const queue: string[] = [];
	for (const [id, count] of inDegree.entries()) {
		if (count === 0) queue.push(id);
	}

	const orderedIds: string[] = [];
	while (queue.length > 0) {
		const id = queue.shift();
		if (!id) continue;
		orderedIds.push(id);
		for (const next of adjacency.get(id) ?? []) {
			const updated = (inDegree.get(next) ?? 0) - 1;
			inDegree.set(next, updated);
			if (updated === 0) {
				queue.push(next);
			}
		}
	}

	if (orderedIds.length !== nodes.length) {
		throw new Error("Flow contains a cycle");
	}

	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const order = orderedIds.map((id) => {
		const node = nodeById.get(id);
		if (!node) {
			throw new Error(`Unknown node id in order: ${id}`);
		}
		return node;
	});

	return { nodes, order, adjacency };
}
