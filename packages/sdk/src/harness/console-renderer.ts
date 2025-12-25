/**
 * ConsoleRenderer - Simple console-based harness renderer
 *
 * Provides basic terminal output for task execution progress.
 * Uses ANSI colors for status indication.
 *
 * @module harness/console-renderer
 */

import { BaseHarnessRenderer } from "./base-renderer.js";
import type { PhaseRenderState, RendererConfig, TaskRenderState } from "./renderer-interface.js";
import type { HarnessSummary, ParsedTask } from "./task-harness-types.js";

// ANSI color codes
const COLORS = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
} as const;

// Status symbols
const SYMBOLS = {
	pending: "○",
	running: "◐",
	complete: "✓",
	failed: "✗",
	skipped: "⊘",
	retrying: "↻",
	validation: {
		pending: "○",
		running: "…",
		passed: "✓",
		failed: "✗",
	},
} as const;

/**
 * ConsoleRenderer - Outputs task progress to stdout.
 *
 * @example
 * ```typescript
 * const renderer = new ConsoleRenderer();
 * const harness = createTaskHarness({
 *   config: { ... },
 *   renderer,
 * });
 *
 * await harness.run();
 * ```
 */
export class ConsoleRenderer extends BaseHarnessRenderer {
	private useColors: boolean;
	private showTimestamps: boolean;
	private startTime: number = 0;

	constructor(options?: { colors?: boolean; timestamps?: boolean }) {
		super();
		this.useColors = options?.colors ?? process.stdout.isTTY ?? false;
		this.showTimestamps = options?.timestamps ?? false;
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	protected onInitialize(_tasks: ParsedTask[], config: RendererConfig): void {
		this.startTime = Date.now();
		this.showTimestamps = config.showTimestamps ?? this.showTimestamps;
	}

	protected onFinalize(summary: HarnessSummary): void {
		this.renderSummary(summary);
	}

	// =========================================================================
	// Render Methods
	// =========================================================================

	protected renderHarnessStart(tasks: ParsedTask[]): void {
		const mode = this.state.mode === "replay" ? " (replay)" : "";
		this.log(`\n${this.color("bold")}TaskHarness${mode}${this.color("reset")}`);
		this.log(`${this.color("gray")}Session: ${this.state.sessionId}${this.color("reset")}`);
		this.log(`${this.color("gray")}Tasks: ${tasks.length}${this.color("reset")}\n`);
	}

	protected renderHarnessError(error: Error): void {
		this.log(`\n${this.color("red")}${SYMBOLS.failed} Harness Error: ${error.message}${this.color("reset")}`);
	}

	protected renderPhaseStart(phase: PhaseRenderState): void {
		this.log(
			`\n${this.color("cyan")}Phase ${phase.phaseNumber}: ${phase.name}${this.color("reset")} (${phase.taskIds.length} tasks)`,
		);
	}

	protected renderPhaseComplete(phase: PhaseRenderState): void {
		this.log(`${this.color("green")}${SYMBOLS.complete} Phase ${phase.phaseNumber} complete${this.color("reset")}`);
	}

	protected renderTaskStart(task: ParsedTask, _state: TaskRenderState): void {
		const prefix = this.getTimestamp();
		this.log(`${prefix}${this.color("blue")}${SYMBOLS.running} ${task.id}${this.color("reset")} - ${task.description}`);
	}

	protected renderNarrative(taskState: TaskRenderState): void {
		if (taskState.narrative) {
			const prefix = this.getTimestamp();
			this.log(`${prefix}  ${this.color("dim")}${taskState.narrative}${this.color("reset")}`);
		}
	}

	protected renderTaskComplete(state: TaskRenderState): void {
		const duration = state.endTime && state.startTime ? this.formatDuration(state.endTime - state.startTime) : "";
		const prefix = this.getTimestamp();
		this.log(
			`${prefix}${this.color("green")}${SYMBOLS.complete} ${state.task.id}${this.color("reset")}${duration ? ` ${this.color("gray")}(${duration})${this.color("reset")}` : ""}`,
		);
	}

	protected renderTaskFailed(state: TaskRenderState): void {
		const prefix = this.getTimestamp();
		this.log(`${prefix}${this.color("red")}${SYMBOLS.failed} ${state.task.id} FAILED${this.color("reset")}`);
	}

	protected renderTaskSkipped(state: TaskRenderState, reason: string): void {
		const prefix = this.getTimestamp();
		this.log(
			`${prefix}${this.color("yellow")}${SYMBOLS.skipped} ${state.task.id} skipped: ${reason}${this.color("reset")}`,
		);
	}

	protected renderTaskRetry(state: TaskRenderState, attempt: number, maxAttempts: number): void {
		const prefix = this.getTimestamp();
		this.log(
			`${prefix}${this.color("yellow")}${SYMBOLS.retrying} ${state.task.id} retry ${attempt}/${maxAttempts}${this.color("reset")}`,
		);
	}

	protected renderValidationStart(taskState: TaskRenderState): void {
		const prefix = this.getTimestamp();
		this.log(
			`${prefix}  ${this.color("gray")}${SYMBOLS.validation.running} Validating ${taskState.task.id}...${this.color("reset")}`,
		);
	}

	protected renderValidationComplete(taskState: TaskRenderState): void {
		const prefix = this.getTimestamp();
		const passed = taskState.validationStatus === "passed";
		const symbol = passed ? SYMBOLS.validation.passed : SYMBOLS.validation.failed;
		const colorName = passed ? "green" : "red";
		const status = passed ? "PASSED" : "FAILED";
		this.log(`${prefix}  ${this.color(colorName)}${symbol} Validation ${status}${this.color("reset")}`);
	}

	protected renderValidationFailed(taskState: TaskRenderState): void {
		const prefix = this.getTimestamp();
		this.log(
			`${prefix}  ${this.color("red")}${SYMBOLS.validation.failed} Validation FAILED for ${taskState.task.id}${this.color("reset")}`,
		);
	}

	// =========================================================================
	// Private Helpers
	// =========================================================================

	private renderSummary(summary: HarnessSummary): void {
		const totalDuration = Date.now() - this.startTime;

		this.log(`\n${this.color("bold")}═══════════════════════════════════════${this.color("reset")}`);
		this.log(`${this.color("bold")}Summary${this.color("reset")}`);
		this.log(`${this.color("bold")}═══════════════════════════════════════${this.color("reset")}`);

		this.log(`Total tasks:     ${summary.totalTasks}`);
		this.log(`${this.color("green")}Validated:       ${summary.validatedTasks}${this.color("reset")}`);
		this.log(`${this.color("red")}Failed:          ${summary.failedTasks}${this.color("reset")}`);
		this.log(`${this.color("yellow")}Skipped:         ${summary.skippedTasks}${this.color("reset")}`);

		if (summary.totalRetries > 0) {
			this.log(`${this.color("yellow")}Retries:         ${summary.totalRetries}${this.color("reset")}`);
		}

		this.log(`Duration:        ${this.formatDuration(totalDuration)}`);

		if (this.config.showTokenUsage && summary.tokenUsage) {
			this.log("");
			this.log(`${this.color("gray")}Token Usage:${this.color("reset")}`);
			this.log(`  Input:         ${summary.tokenUsage.inputTokens.toLocaleString()}`);
			this.log(`  Output:        ${summary.tokenUsage.outputTokens.toLocaleString()}`);
			if (summary.tokenUsage.cacheReadInputTokens) {
				this.log(`  Cache Read:    ${summary.tokenUsage.cacheReadInputTokens.toLocaleString()}`);
			}
		}

		// Final status
		const allPassed = summary.failedTasks === 0;
		const statusColor = allPassed ? "green" : "red";
		const statusSymbol = allPassed ? SYMBOLS.complete : SYMBOLS.failed;
		const statusText = allPassed ? "ALL TASKS VALIDATED" : "SOME TASKS FAILED";
		this.log(`\n${this.color(statusColor)}${statusSymbol} ${statusText}${this.color("reset")}\n`);
	}

	private log(message: string): void {
		console.log(message);
	}

	private color(name: keyof typeof COLORS): string {
		return this.useColors ? COLORS[name] : "";
	}

	private getTimestamp(): string {
		if (!this.showTimestamps) return "";
		const elapsed = Date.now() - this.startTime;
		return `${this.color("gray")}[${this.formatDuration(elapsed)}]${this.color("reset")} `;
	}

	private formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		const mins = Math.floor(ms / 60000);
		const secs = Math.round((ms % 60000) / 1000);
		return `${mins}m ${secs}s`;
	}
}
