/**
 * AgentStream Component
 *
 * Scrollable log panel for real-time agent output streaming.
 * Shows text, thinking, tool use, and system messages.
 */

import contrib from "blessed-contrib";
import { colors, formatTime } from "../theme.js";

export class AgentStream {
	private logWidget: contrib.Widgets.LogElement;
	private textBuffer = "";
	private lastFlushTime = 0;
	private flushInterval = 100; // ms between buffer flushes

	constructor(grid: contrib.grid, row: number, col: number, rowSpan: number, colSpan: number) {
		this.logWidget = grid.set(row, col, rowSpan, colSpan, contrib.log, {
			label: " Agent Output ",
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
		}) as unknown as contrib.Widgets.LogElement;
	}

	/**
	 * Append streaming text from agent.
	 * Buffers text and flushes complete lines or on interval.
	 */
	appendText(content: string): void {
		this.textBuffer += content;

		// Flush complete lines immediately
		const lines = this.textBuffer.split("\n");
		if (lines.length > 1) {
			// Log all complete lines (all but the last)
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].trim();
				if (line) {
					this.logWidget.log(line);
				}
			}
			// Keep the incomplete line in the buffer
			this.textBuffer = lines[lines.length - 1];
		}

		// Also flush periodically for long lines without newlines
		const now = Date.now();
		if (now - this.lastFlushTime > this.flushInterval && this.textBuffer.length > 80) {
			this.flushBuffer();
		}
	}

	/**
	 * Flush any remaining buffered text to the log.
	 * Call this when the agent completes.
	 */
	flushBuffer(): void {
		if (this.textBuffer.trim()) {
			this.logWidget.log(this.textBuffer.trim());
			this.textBuffer = "";
			this.lastFlushTime = Date.now();
		}
	}

	/**
	 * Append thinking/reasoning content (usually dimmed or special color).
	 */
	appendThinking(content: string): void {
		this.logWidget.log(`{magenta-fg}${content}{/magenta-fg}`);
	}

	/**
	 * Log a tool use event.
	 */
	logTool(toolName: string, durationMs?: number): void {
		const duration = durationMs ? ` (${durationMs}ms)` : "";
		this.logWidget.log(`{cyan-fg}🔧 ${toolName}${duration}{/cyan-fg}`);
	}

	/**
	 * Log a system message with timestamp.
	 */
	log(message: string): void {
		const time = formatTime();
		this.logWidget.log(`{gray-fg}[${time}]{/gray-fg} ${message}`);
	}

	/**
	 * Log an info message.
	 */
	info(message: string): void {
		this.log(`{${colors.info}-fg}ℹ ${message}{/${colors.info}-fg}`);
	}

	/**
	 * Log a success message.
	 */
	success(message: string): void {
		this.log(`{${colors.success}-fg}✓ ${message}{/${colors.success}-fg}`);
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string): void {
		this.log(`{${colors.warning}-fg}⚠ ${message}{/${colors.warning}-fg}`);
	}

	/**
	 * Log an error message.
	 */
	error(message: string): void {
		this.log(`{${colors.error}-fg}✗ ${message}{/${colors.error}-fg}`);
	}

	/**
	 * Clear the log.
	 * Note: blessed-contrib's log widget doesn't expose a public clear() method,
	 * so we access the internal _log array. This may break with library updates.
	 */
	clear(): void {
		const widget = this.logWidget as unknown as { _log?: string[]; setContent?: (content: string) => void };
		if (widget._log) {
			widget._log = [];
		}
		// Also try setContent as a fallback if available
		if (widget.setContent) {
			widget.setContent("");
		}
	}
}
