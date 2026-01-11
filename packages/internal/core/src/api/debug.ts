/**
 * Debug utilities for signal flow visualization.
 *
 * These utilities help understand the causality chain and
 * visualize how signals flow through a reactive harness.
 *
 * @example
 * ```ts
 * const result = await runReactive({ agents, state, provider })
 *
 * // Print a tree view of signal flow
 * console.log(formatSignalTree(result.signals))
 *
 * // Get causality chain for a specific signal
 * const chain = getCausalityChain(result.signals, "sig_abc123")
 * ```
 */

import type { Signal } from "@internal/signals-core";

/**
 * Build a map of signal ID to signal for quick lookup.
 */
function buildSignalMap(signals: readonly Signal[]): Map<string, Signal> {
	const map = new Map<string, Signal>();
	for (const signal of signals) {
		map.set(signal.id, signal);
	}
	return map;
}

/**
 * Get the causality chain for a signal.
 *
 * Returns an array of signals from root to the target signal,
 * following the parent chain.
 *
 * @param signals - All signals from a run
 * @param signalId - ID of the signal to trace
 * @returns Array of signals from root to target
 */
export function getCausalityChain(
	signals: readonly Signal[],
	signalId: string,
): Signal[] {
	const signalMap = buildSignalMap(signals);
	const chain: Signal[] = [];

	let current = signalMap.get(signalId);
	while (current) {
		chain.unshift(current); // Add to front to maintain root-first order
		const parentId = current.source?.parent;
		current = parentId ? signalMap.get(parentId) : undefined;
	}

	return chain;
}

/**
 * Get all signals emitted by a specific agent.
 */
export function getAgentSignals(
	signals: readonly Signal[],
	agentName: string,
): Signal[] {
	return signals.filter((s) => s.source?.agent === agentName);
}

/**
 * Get all child signals that were triggered by a parent signal.
 */
export function getChildSignals(
	signals: readonly Signal[],
	parentId: string,
): Signal[] {
	return signals.filter((s) => s.source?.parent === parentId);
}

/**
 * Build a tree structure from signals based on causality.
 */
export type SignalNode = {
	signal: Signal;
	children: SignalNode[];
};

/**
 * Build a tree structure from flat signal array.
 */
export function buildSignalTree(signals: readonly Signal[]): SignalNode[] {
	const childMap = new Map<string | undefined, Signal[]>();

	// Group signals by parent
	for (const signal of signals) {
		const parentId = signal.source?.parent;
		const siblings = childMap.get(parentId) ?? [];
		siblings.push(signal);
		childMap.set(parentId, siblings);
	}

	// Build tree recursively
	function buildNode(signal: Signal): SignalNode {
		const children = childMap.get(signal.id) ?? [];
		return {
			signal,
			children: children.map(buildNode),
		};
	}

	// Get root signals (no parent)
	const roots = childMap.get(undefined) ?? [];
	return roots.map(buildNode);
}

/**
 * Format a signal tree as an ASCII tree for console output.
 *
 * @example
 * ```
 * harness:start
 * └─ agent:activated (analyst)
 *    ├─ harness:start
 *    ├─ text:delta
 *    ├─ harness:end
 *    └─ analysis:complete
 *       └─ agent:activated (executor)
 *          ├─ harness:start
 *          └─ harness:end
 * ```
 */
export function formatSignalTree(signals: readonly Signal[]): string {
	const trees = buildSignalTree(signals);
	const lines: string[] = [];

	function formatNode(node: SignalNode, prefix: string, isLast: boolean): void {
		const connector = isLast ? "└─ " : "├─ ";
		const agent = node.signal.source?.agent;
		const agentSuffix = agent ? ` (${agent})` : "";

		lines.push(`${prefix}${connector}${node.signal.name}${agentSuffix}`);

		const childPrefix = prefix + (isLast ? "   " : "│  ");
		node.children.forEach((child, i) => {
			formatNode(child, childPrefix, i === node.children.length - 1);
		});
	}

	trees.forEach((tree, i) => {
		if (i === 0) {
			// First root - no connector
			const agent = tree.signal.source?.agent;
			const agentSuffix = agent ? ` (${agent})` : "";
			lines.push(`${tree.signal.name}${agentSuffix}`);
			tree.children.forEach((child, j) => {
				formatNode(child, "", j === tree.children.length - 1);
			});
		} else {
			formatNode(tree, "", i === trees.length - 1);
		}
	});

	return lines.join("\n");
}

/**
 * Get a summary of signals by type.
 */
export function getSignalSummary(
	signals: readonly Signal[],
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const signal of signals) {
		counts[signal.name] = (counts[signal.name] ?? 0) + 1;
	}
	return counts;
}

/**
 * Filter signals by name pattern.
 *
 * @param signals - All signals
 * @param pattern - Glob pattern or regex
 * @returns Matching signals
 */
export function filterSignals(
	signals: readonly Signal[],
	pattern: string | RegExp,
): Signal[] {
	if (pattern instanceof RegExp) {
		return signals.filter((s) => pattern.test(s.name));
	}

	// Convert glob to regex
	const regexPattern = pattern
		.replace(/\*\*/g, ".*")
		.replace(/\*/g, "[^:]*")
		.replace(/\?/g, ".");

	const regex = new RegExp(`^${regexPattern}$`);
	return signals.filter((s) => regex.test(s.name));
}
