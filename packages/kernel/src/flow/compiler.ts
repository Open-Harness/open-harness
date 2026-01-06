// Flow compiler (DAG validation + topological sort)
// Implements docs/flow/execution.md (sequential scheduling rules)

import type { Edge, FlowYaml, NodeSpec } from "../protocol/flow.js";
import { validateFlowYaml } from "./validator.js";

export interface CompiledFlow {
	nodes: NodeSpec[];
	order: NodeSpec[];
	adjacency: Map<string, string[]>;
	edges: Edge[];
}

/**
 * Identify child nodes that are referenced in container node body arrays.
 * These nodes should be excluded from the main execution order.
 */
function findChildNodeIds(nodes: NodeSpec[]): Set<string> {
	const childIds = new Set<string>();

	for (const node of nodes) {
		// Check if node has a body property (container nodes like control.foreach)
		const input = node.input as Record<string, unknown> | undefined;
		if (input?.body && Array.isArray(input.body)) {
			for (const childId of input.body) {
				if (typeof childId === "string") {
					childIds.add(childId);
				}
			}
		}
	}

	return childIds;
}

export function compileFlow(flow: FlowYaml): CompiledFlow {
	const validated = validateFlowYaml(flow);
	const nodes = validated.nodes;

	// Identify child nodes to exclude from main order
	const childNodeIds = findChildNodeIds(nodes);

	// Filter to nodes that should be in the main execution order
	const mainNodes = nodes.filter((node) => !childNodeIds.has(node.id));

	const adjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	for (const node of mainNodes) {
		adjacency.set(node.id, []);
		inDegree.set(node.id, 0);
	}

	// Only process edges between main nodes
	const mainEdges = validated.edges.filter(
		(edge) => !childNodeIds.has(edge.from) && !childNodeIds.has(edge.to),
	);

	for (const edge of mainEdges) {
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

	if (orderedIds.length !== mainNodes.length) {
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

	// Return all nodes (for child lookup) but only main nodes in order
	return { nodes, order, adjacency, edges: validated.edges };
}
