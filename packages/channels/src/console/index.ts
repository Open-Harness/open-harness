/**
 * Console Channel - Colorful terminal output for harness events
 *
 * Uses defineChannel for state management, pattern matching, and lifecycle hooks.
 *
 * @module @openharness/channels/console
 */

import { defineChannel } from "@openharness/sdk";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Console channel options.
 */
export interface ConsoleChannelOptions {
	/** Enable ANSI colors (default: auto-detect TTY) */
	colors?: boolean;
	/** Show timestamps (default: false) */
	timestamps?: boolean;
	/** Show event context (session/phase/task) (default: true) */
	showContext?: boolean;
	/** Verbosity level (default: normal) */
	verbosity?: "minimal" | "normal" | "verbose";
}

/**
 * Console channel state.
 */
interface ConsoleState {
	formatter: ConsoleFormatter;
	startTime: number;
}

// ============================================================================
// ANSI COLORS
// ============================================================================

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
	magenta: "\x1b[35m",
} as const;

const SYMBOLS = {
	start: "▶",
	complete: "✓",
	failed: "✗",
	thinking: "💭",
	tool: "🔧",
	text: "📝",
	narrative: "📖",
	prompt: "❓",
	reply: "💬",
	abort: "⛔",
} as const;

// ============================================================================
// FORMATTER
// ============================================================================

class ConsoleFormatter {
	private useColors: boolean;
	private showTimestamps: boolean;
	private showContext: boolean;
	private verbosity: "minimal" | "normal" | "verbose";
	private startTime: number = Date.now();

	constructor(options: ConsoleChannelOptions = {}) {
		this.useColors = options.colors ?? (typeof process !== "undefined" && process.stdout?.isTTY) ?? false;
		this.showTimestamps = options.timestamps ?? false;
		this.showContext = options.showContext ?? true;
		this.verbosity = options.verbosity ?? "normal";
	}

	format(event: { event: { type: string; [key: string]: unknown }; timestamp: Date; context: Record<string, unknown> }): string | null {
		const { event: payload, context } = event;
		const type = payload.type;

		// Skip events based on verbosity
		if (this.verbosity === "minimal" && !this.isImportantEvent(type)) {
			return null;
		}

		const prefix = this.getPrefix(event);
		const contextStr = this.showContext ? this.formatContext(context) : "";

		switch (type) {
			// Phase lifecycle
			case "phase": {
				const e = payload as unknown as { name: string; status: string; phaseNumber?: number };
				if (e.status === "start") {
					return `${prefix}${this.c("cyan")}Phase ${e.phaseNumber ?? ""}: ${e.name}${this.c("reset")}`;
				} else if (e.status === "complete") {
					return `${prefix}${this.c("green")}${SYMBOLS.complete} Phase complete: ${e.name}${this.c("reset")}`;
				}
				return null;
			}

			// Task lifecycle
			case "task": {
				const e = payload as unknown as { id: string; status: string; error?: string };
				if (e.status === "start") {
					return `${prefix}${this.c("blue")}${SYMBOLS.start} Task ${e.id}${this.c("reset")}`;
				} else if (e.status === "complete") {
					return `${prefix}${this.c("green")}${SYMBOLS.complete} Task ${e.id}${this.c("reset")}`;
				} else if (e.status === "failed") {
					return `${prefix}${this.c("red")}${SYMBOLS.failed} Task ${e.id}: ${e.error || "error"}${this.c("reset")}`;
				}
				return null;
			}

			// Agent events
			case "agent:start": {
				const e = payload as unknown as { agentName: string };
				if (this.verbosity === "verbose") {
					return `${prefix}${this.c("magenta")}${SYMBOLS.start} Agent ${e.agentName}${this.c("reset")}`;
				}
				return null;
			}
			case "agent:thinking": {
				const e = payload as unknown as { content: string };
				if (this.verbosity === "verbose") {
					const truncated = e.content.length > 100 ? `${e.content.slice(0, 100)}...` : e.content;
					return `${prefix}${this.c("dim")}${SYMBOLS.thinking} ${truncated}${this.c("reset")}`;
				}
				return null;
			}
			case "agent:text": {
				const e = payload as unknown as { content: string };
				if (this.verbosity === "verbose") {
					return `${prefix}${this.c("dim")}${SYMBOLS.text} ${e.content}${this.c("reset")}`;
				}
				return null;
			}
			case "agent:tool:start": {
				const e = payload as unknown as { toolName: string };
				return `${prefix}${this.c("yellow")}${SYMBOLS.tool} ${e.toolName}${this.c("reset")}`;
			}
			case "agent:tool:complete": {
				const e = payload as unknown as { toolName: string; isError?: boolean };
				const symbol = e.isError ? SYMBOLS.failed : SYMBOLS.complete;
				const color = e.isError ? "red" : "green";
				return `${prefix}${this.c(color)}${symbol} ${e.toolName}${this.c("reset")}`;
			}
			case "agent:complete": {
				const e = payload as unknown as { agentName: string; success: boolean };
				if (this.verbosity === "verbose") {
					const symbol = e.success ? SYMBOLS.complete : SYMBOLS.failed;
					const color = e.success ? "green" : "red";
					return `${prefix}${this.c(color)}${symbol} Agent ${e.agentName} done${this.c("reset")}`;
				}
				return null;
			}

			// Narrative
			case "narrative": {
				const e = payload as unknown as { text: string; importance: string };
				return `${prefix}${this.c("cyan")}${SYMBOLS.narrative} ${e.text}${this.c("reset")}`;
			}

			// Session events
			case "session:prompt": {
				const e = payload as unknown as { prompt: string };
				return `${prefix}${this.c("yellow")}${SYMBOLS.prompt} ${e.prompt}${this.c("reset")}`;
			}
			case "session:reply": {
				const e = payload as unknown as { content: string };
				return `${prefix}${this.c("green")}${SYMBOLS.reply} ${e.content}${this.c("reset")}`;
			}
			case "session:abort": {
				const e = payload as unknown as { reason?: string };
				return `${prefix}${this.c("red")}${SYMBOLS.abort} Aborted${e.reason ? `: ${e.reason}` : ""}${this.c("reset")}`;
			}

			default:
				if (this.verbosity === "verbose") {
					return `${prefix}${this.c("dim")}[${type}]${this.c("reset")}`;
				}
				return null;
		}
	}

	private isImportantEvent(type: string): boolean {
		return type === "phase" || type === "task" || type === "narrative";
	}

	private getPrefix(event: { timestamp: Date }): string {
		if (!this.showTimestamps) return "";
		const elapsed = event.timestamp.getTime() - this.startTime;
		return `${this.c("gray")}[${this.formatDuration(elapsed)}]${this.c("reset")} `;
	}

	private formatContext(context: {
		phase?: { name: string };
		task?: { id: string };
		agent?: { name: string };
	}): string {
		const parts: string[] = [];
		if (context.phase) parts.push(`phase:${context.phase.name}`);
		if (context.task) parts.push(`task:${context.task.id}`);
		if (context.agent) parts.push(`agent:${context.agent.name}`);

		if (parts.length === 0) return "";
		return ` ${this.c("dim")}(${parts.join(", ")})${this.c("reset")}`;
	}

	private formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		const mins = Math.floor(ms / 60000);
		const secs = Math.round((ms % 60000) / 1000);
		return `${mins}m ${secs}s`;
	}

	private c(name: keyof typeof COLORS): string {
		return this.useColors ? COLORS[name] : "";
	}
}

// ============================================================================
// CHANNEL FACTORY
// ============================================================================

/**
 * Create a console channel that outputs formatted events to stdout.
 *
 * Uses defineChannel pattern with:
 * - State management for formatter and timing
 * - Wildcard pattern matching for all events
 * - Lifecycle hooks for initialization
 *
 * @param options - Channel options
 * @returns Attachment for use with harness.attach()
 *
 * @example
 * ```typescript
 * import { defineHarness } from "@openharness/sdk";
 * import { consoleChannel } from "@openharness/channels";
 *
 * const harness = defineHarness({ ... })
 *   .attach(consoleChannel({ colors: true, timestamps: true }));
 *
 * await harness.run();
 * ```
 */
export function consoleChannel(options: ConsoleChannelOptions = {}) {
	return defineChannel({
		name: "Console",
		state: (): ConsoleState => ({
			formatter: new ConsoleFormatter(options),
			startTime: Date.now(),
		}),
		on: {
			"*": ({ state, event }: any) => {
				const formatted = state.formatter.format(event);
				if (formatted) {
					console.log(formatted);
				}
			},
		},
	});
}

// Re-export types
export type { ConsoleChannelOptions as ConsoleOptions };
