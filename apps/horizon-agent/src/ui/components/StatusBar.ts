/**
 * StatusBar Component
 *
 * Displays current workflow status, task progress, iteration count, and elapsed time.
 */

import blessed from "blessed";
import type contrib from "blessed-contrib";
import { colors, formatDuration, formatTime, symbols } from "../theme.js";

export type WorkflowStatus = "idle" | "planning" | "executing" | "paused" | "completed" | "failed";

export interface StatusBarState {
	status: WorkflowStatus;
	currentTask: number;
	totalTasks: number;
	iteration: number;
	maxIterations: number;
	elapsedMs: number;
	currentNodeId?: string;
}

export class StatusBar {
	private box: blessed.Widgets.BoxElement;
	private state: StatusBarState = {
		status: "idle",
		currentTask: 0,
		totalTasks: 0,
		iteration: 0,
		maxIterations: 5,
		elapsedMs: 0,
	};

	constructor(grid: contrib.grid, row: number, col: number, rowSpan: number, colSpan: number) {
		this.box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
			label: " Status ",
			border: "line",
			tags: true,
			content: this.render(),
			style: {
				border: { fg: colors.border },
			},
		}) as blessed.Widgets.BoxElement;
	}

	setStatus(status: WorkflowStatus): void {
		this.state.status = status;
		this.update();
	}

	setTaskProgress(current: number, total: number): void {
		this.state.currentTask = current;
		this.state.totalTasks = total;
		this.update();
	}

	setIteration(iteration: number, max?: number): void {
		this.state.iteration = iteration;
		if (max !== undefined) {
			this.state.maxIterations = max;
		}
		this.update();
	}

	setElapsedTime(ms: number): void {
		this.state.elapsedMs = ms;
		this.update();
	}

	setCurrentNode(nodeId: string): void {
		this.state.currentNodeId = nodeId;
		this.update();
	}

	private render(): string {
		const lines: string[] = [];

		// Status line with colored indicator
		const statusColor = this.getStatusColor();
		const statusSymbol = this.getStatusSymbol();
		lines.push(`{bold}Status:{/bold} {${statusColor}-fg}${statusSymbol} ${this.state.status}{/${statusColor}-fg}`);

		// Task progress
		if (this.state.totalTasks > 0) {
			lines.push(`{bold}Task:{/bold} ${this.state.currentTask + 1}/${this.state.totalTasks}`);
		}

		// Current node
		if (this.state.currentNodeId) {
			lines.push(`{bold}Node:{/bold} ${this.state.currentNodeId}`);
		}

		// Iteration (for coder/reviewer loop)
		if (this.state.iteration > 0) {
			lines.push(`{bold}Iter:{/bold} ${this.state.iteration}/${this.state.maxIterations}`);
		}

		// Elapsed time
		lines.push(`{bold}Time:{/bold} ${formatDuration(this.state.elapsedMs)}`);

		// Current time
		lines.push(`{gray-fg}${formatTime()}{/gray-fg}`);

		return lines.join("\n");
	}

	private getStatusColor(): string {
		switch (this.state.status) {
			case "idle":
				return colors.muted;
			case "planning":
			case "executing":
				return colors.warning;
			case "paused":
				return colors.info;
			case "completed":
				return colors.success;
			case "failed":
				return colors.error;
		}
	}

	private getStatusSymbol(): string {
		switch (this.state.status) {
			case "idle":
				return symbols.pending;
			case "planning":
			case "executing":
				return symbols.running;
			case "paused":
				return symbols.paused;
			case "completed":
				return symbols.complete;
			case "failed":
				return symbols.error;
		}
	}

	private update(): void {
		this.box.setContent(this.render());
	}
}
