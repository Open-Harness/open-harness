/**
 * TaskList Component
 *
 * Displays the list of tasks with completion status.
 * Shows pending, active, and completed tasks with visual indicators.
 */

import blessed from "blessed";
import type contrib from "blessed-contrib";
import { colors, symbols, truncate } from "../theme.js";
import type { Task, CompletedTask } from "../../runtime/state-schema.js";

export type TaskStatus = "pending" | "active" | "complete" | "failed";

interface TaskDisplay {
	task: Task;
	status: TaskStatus;
	iterations?: number;
}

export class TaskList {
	private box: blessed.Widgets.BoxElement;
	private tasks: TaskDisplay[] = [];

	constructor(
		grid: contrib.grid,
		row: number,
		col: number,
		rowSpan: number,
		colSpan: number,
	) {
		this.box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
			label: " Tasks ",
			border: "line",
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: " ",
				track: { bg: "gray" },
				style: { bg: "white" },
			},
			style: {
				border: { fg: colors.border },
			},
		}) as blessed.Widgets.BoxElement;
	}

	/**
	 * Update the task list from current state.
	 */
	update(
		tasks: Task[],
		currentTaskIndex: number,
		completedTasks: CompletedTask[],
	): void {
		const completedIds = new Set(completedTasks.map((ct) => ct.task.id));

		this.tasks = tasks.map((task, index) => {
			const completed = completedTasks.find((ct) => ct.task.id === task.id);
			let status: TaskStatus;

			if (completed) {
				status = "complete";
			} else if (index === currentTaskIndex) {
				status = "active";
			} else {
				status = "pending";
			}

			return {
				task,
				status,
				iterations: completed?.totalIterations,
			};
		});

		this.render();
	}

	private render(): void {
		const lines: string[] = [];
		const maxWidth = 30; // Approximate width for task titles

		for (const { task, status, iterations } of this.tasks) {
			const symbol = this.getSymbol(status);
			const color = this.getColor(status);
			const title = truncate(task.title, maxWidth);
			const iterInfo = iterations ? ` (${iterations}x)` : "";

			lines.push(`{${color}-fg}${symbol} ${title}${iterInfo}{/${color}-fg}`);
		}

		if (lines.length === 0) {
			lines.push(`{${colors.muted}-fg}No tasks yet{/${colors.muted}-fg}`);
		}

		this.box.setContent(lines.join("\n"));
	}

	private getSymbol(status: TaskStatus): string {
		switch (status) {
			case "pending":
				return symbols.taskPending;
			case "active":
				return symbols.taskActive;
			case "complete":
				return symbols.taskComplete;
			case "failed":
				return symbols.error;
		}
	}

	private getColor(status: TaskStatus): string {
		switch (status) {
			case "pending":
				return colors.taskPending;
			case "active":
				return colors.taskActive;
			case "complete":
				return colors.taskComplete;
			case "failed":
				return colors.error;
		}
	}
}
