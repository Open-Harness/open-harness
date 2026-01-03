/**
 * FlowGraph Component
 *
 * ASCII visualization of the workflow graph.
 * Shows nodes with their current execution status.
 */

import blessed from "blessed";
import type contrib from "blessed-contrib";
import { colors, symbols } from "../theme.js";

export type NodeStatus = "idle" | "running" | "complete" | "error" | "skipped";

interface GraphNode {
	id: string;
	label: string;
	status: NodeStatus;
}

export class FlowGraph {
	private box: blessed.Widgets.BoxElement;
	private nodes: Map<string, GraphNode> = new Map();
	private currentNodeId?: string;

	constructor(
		grid: contrib.grid,
		row: number,
		col: number,
		rowSpan: number,
		colSpan: number,
	) {
		this.box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
			label: " Flow ",
			border: "line",
			tags: true,
			style: {
				border: { fg: colors.border },
			},
		}) as blessed.Widgets.BoxElement;

		// Initialize with Horizon Agent flow structure
		this.initializeNodes();
		this.render();
	}

	private initializeNodes(): void {
		this.nodes.set("planner", {
			id: "planner",
			label: "PLANNER",
			status: "idle",
		});
		this.nodes.set("coder", { id: "coder", label: "CODER", status: "idle" });
		this.nodes.set("reviewer", {
			id: "reviewer",
			label: "REVIEWER",
			status: "idle",
		});
	}

	/**
	 * Highlight a node as currently running.
	 */
	highlightNode(nodeId: string): void {
		// Reset previous current node
		if (this.currentNodeId && this.nodes.has(this.currentNodeId)) {
			const prev = this.nodes.get(this.currentNodeId)!;
			if (prev.status === "running") {
				prev.status = "idle";
			}
		}

		this.currentNodeId = nodeId;
		const node = this.nodes.get(nodeId);
		if (node) {
			node.status = "running";
		}
		this.render();
	}

	/**
	 * Mark a node as complete.
	 */
	completeNode(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (node) {
			node.status = "complete";
		}
		this.render();
	}

	/**
	 * Mark a node as error.
	 */
	errorNode(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (node) {
			node.status = "error";
		}
		this.render();
	}

	/**
	 * Reset all nodes to idle.
	 */
	reset(): void {
		for (const node of this.nodes.values()) {
			node.status = "idle";
		}
		this.currentNodeId = undefined;
		this.render();
	}

	private render(): void {
		const planner = this.nodes.get("planner")!;
		const coder = this.nodes.get("coder")!;
		const reviewer = this.nodes.get("reviewer")!;

		// ASCII flow diagram
		const lines = [
			"",
			this.renderNode(planner),
			`      ${symbols.arrowDown}`,
			`  ┌───────────────┐`,
			`  │   forEach     │`,
			`  └───────────────┘`,
			`      ${symbols.arrowDown}`,
			this.renderNode(coder),
			`      ${symbols.arrowDown}`,
			this.renderNode(reviewer),
			`      ${symbols.arrowDown}     ${symbols.loop}`,
			`   passed? ──no──┘`,
			`      │`,
			`     yes`,
			`      ${symbols.arrowDown}`,
			`    [DONE]`,
		];

		this.box.setContent(lines.join("\n"));
	}

	private renderNode(node: GraphNode): string {
		const symbol = this.getStatusSymbol(node.status);
		const color = this.getStatusColor(node.status);
		const width = 14;
		const padding = Math.max(0, width - node.label.length - 2);
		const leftPad = Math.floor(padding / 2);
		const rightPad = padding - leftPad;

		return `  {${color}-fg}[${symbol}${" ".repeat(leftPad)}${node.label}${" ".repeat(rightPad)}]{/${color}-fg}`;
	}

	private getStatusSymbol(status: NodeStatus): string {
		switch (status) {
			case "idle":
				return symbols.pending;
			case "running":
				return symbols.running;
			case "complete":
				return symbols.complete;
			case "error":
				return symbols.error;
			case "skipped":
				return "-";
		}
	}

	private getStatusColor(status: NodeStatus): string {
		switch (status) {
			case "idle":
				return colors.nodeIdle;
			case "running":
				return colors.nodeRunning;
			case "complete":
				return colors.nodeComplete;
			case "error":
				return colors.nodeError;
			case "skipped":
				return colors.nodeSkipped;
		}
	}
}
