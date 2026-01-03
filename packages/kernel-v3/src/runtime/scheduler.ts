import type { CompiledFlow } from "./compiler.js";
import { edgeKey } from "./compiler.js";
import type { RunSnapshot } from "./snapshot.js";

/**
 * Scheduler determines which nodes are ready to execute next.
 */
export interface Scheduler {
	/**
	 * Return the ids of nodes ready to execute.
	 * @param state - Current run snapshot.
	 * @param graph - Compiled flow graph.
	 * @returns List of node ids.
	 */
	nextReadyNodes(state: RunSnapshot, graph: CompiledFlow): string[];
}

/** Default scheduler implementation. */
export class DefaultScheduler implements Scheduler {
	/**
	 * Return the ids of nodes ready to execute.
	 * @param state - Current run snapshot.
	 * @param graph - Compiled flow graph.
	 * @returns List of node ids.
	 */
	nextReadyNodes(state: RunSnapshot, graph: CompiledFlow): string[] {
		const ready: string[] = [];

		for (const node of graph.nodes) {
			const status = state.nodeStatus[node.id];
			if (status === "done" || status === "failed" || status === "running") {
				continue;
			}

			const incomingAll = graph.incoming.get(node.id) ?? [];
			const incoming = incomingAll.filter((edge) => !isLoopEdge(edge));
			if (incoming.length === 0) {
				ready.push(node.id);
				continue;
			}

			let hasPending = false;
			for (const edge of incoming) {
				const key = edgeKey(edge);
				const edgeStatus = state.edgeStatus[key] ?? "pending";
				if (edgeStatus === "pending") {
					hasPending = true;
					break;
				}
			}

			if (!hasPending) {
				ready.push(node.id);
			}
		}

		return ready;
	}
}

function isLoopEdge(edge: { maxIterations?: number }): boolean {
	return typeof edge.maxIterations === "number";
}
