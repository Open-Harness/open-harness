/**
 * Signal Console - Clean, color-coded console output for signals
 *
 * Provides human-readable signal output for development and debugging.
 *
 * ## Levels
 *
 * - `quiet`: Minimal output - just workflow:start and workflow:end
 * - `normal`: Default - all signals with truncated content
 * - `verbose`: Full content including streaming deltas
 *
 * ## Format
 *
 * ```
 * HH:MM:SS signal:name [details]
 * ```
 *
 * ## Colors
 *
 * - workflow:* = cyan
 * - agent:* = green
 * - harness:* = magenta
 * - tool:* = yellow
 * - text:* = dim
 * - error:* = red
 * - thinking:* = blue
 */

import pc from "picocolors";
import type { Signal } from "@internal/signals-core";

// ============================================================================
// Types
// ============================================================================

export type SignalConsoleLevel = "quiet" | "normal" | "verbose";

/** @deprecated Use "quiet" | "normal" | "verbose" instead */
export type LegacyLevel = "info" | "debug" | "trace";

/** Pino log levels that can be mapped to signal console levels */
export type PinoLevel = "error" | "warn" | "info" | "debug" | "trace";

export interface SignalConsoleOptions {
	/**
	 * Output verbosity level.
	 *
	 * - `quiet`: Minimal - workflow start/end only
	 * - `normal`: All signals with truncated content (default)
	 * - `verbose`: All signals with full content + streaming deltas
	 *
	 * Legacy Pino levels are also accepted and mapped:
	 * - `error`/`warn` → `quiet`
	 * - `info` → `normal`
	 * - `debug`/`trace` → `verbose`
	 *
	 * @default "normal"
	 */
	level?: SignalConsoleLevel | LegacyLevel | PinoLevel;

	/**
	 * Enable/disable colors.
	 * @default true (auto-detect TTY)
	 */
	colors?: boolean;

	/**
	 * Custom output function (defaults to console.log).
	 * Useful for testing.
	 */
	output?: (message: string) => void;
}

// ============================================================================
// Level Configuration
// ============================================================================

/**
 * Map legacy/Pino level names to signal console levels
 */
function normalizeLevel(
	level: SignalConsoleLevel | LegacyLevel | PinoLevel,
): SignalConsoleLevel {
	switch (level) {
		// Pino high-severity levels → quiet (minimal output)
		case "error":
		case "warn":
			return "quiet";
		// info → normal (see what happened, truncated)
		case "info":
			return "normal";
		// debug/trace → verbose (full content)
		case "debug":
		case "trace":
			return "verbose";
		// New levels pass through
		default:
			return level;
	}
}

/**
 * Determine if a signal should be shown at the given level
 */
function shouldShow(signalName: string, level: SignalConsoleLevel): boolean {
	// Quiet: only workflow start/end and errors
	if (level === "quiet") {
		return (
			signalName === "workflow:start" ||
			signalName === "workflow:end" ||
			signalName.startsWith("error:")
		);
	}

	// Normal: everything except text:delta
	if (level === "normal") {
		return signalName !== "text:delta";
	}

	// Verbose: everything
	return true;
}

// ============================================================================
// Truncation Utilities
// ============================================================================

const TRUNCATE_LIMITS = {
	toolInput: 60,
	toolResult: 80,
	textComplete: 80,
	thinking: 60,
};

/**
 * Truncate a string to max length with ellipsis
 */
function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen - 3) + "...";
}

/**
 * Truncate multiline text, showing first line + line count hint
 */
function truncateMultiline(text: string, maxLen: number): string {
	const lines = text.split("\n");
	const firstLine = truncate(lines[0], maxLen);

	if (lines.length > 1) {
		return `${firstLine} (${lines.length} lines)`;
	}
	return firstLine;
}

/**
 * Format content for verbose mode with indentation
 */
function formatVerboseContent(content: string): string {
	const lines = content.split("\n");
	if (lines.length === 1) {
		return ` ${content}`;
	}
	// Multiline: put on next line with indent
	return "\n" + lines.map((line) => `  ${line}`).join("\n");
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format timestamp as HH:MM:SS
 */
function formatTime(isoTimestamp: string): string {
	const date = new Date(isoTimestamp);
	return [
		date.getHours().toString().padStart(2, "0"),
		date.getMinutes().toString().padStart(2, "0"),
		date.getSeconds().toString().padStart(2, "0"),
	].join(":");
}

/**
 * Format tool:call payload
 */
function formatToolCall(payload: unknown, level: SignalConsoleLevel): string {
	const p = payload as { name?: string; input?: unknown };
	if (!p.name) return "";

	let inputStr = "";
	if (p.input !== undefined) {
		try {
			const json = JSON.stringify(p.input);
			if (level === "verbose") {
				inputStr = formatVerboseContent(json);
				return ` ${p.name}${inputStr}`;
			}
			inputStr = truncate(json, TRUNCATE_LIMITS.toolInput);
		} catch {
			inputStr = "[complex]";
		}
	}
	return ` ${p.name}(${inputStr})`;
}

/**
 * Format tool:result payload
 */
function formatToolResult(payload: unknown, level: SignalConsoleLevel): string {
	const p = payload as { result?: unknown; error?: unknown };

	if (p.error) {
		const errorStr = typeof p.error === "string" ? p.error : JSON.stringify(p.error);
		if (level === "verbose") {
			return formatVerboseContent(`error: ${errorStr}`);
		}
		return ` error: ${truncate(errorStr, TRUNCATE_LIMITS.toolResult)}`;
	}

	if (p.result !== undefined) {
		try {
			const resultStr = typeof p.result === "string" ? p.result : JSON.stringify(p.result);
			if (level === "verbose") {
				return formatVerboseContent(resultStr);
			}
			return ` "${truncateMultiline(resultStr, TRUNCATE_LIMITS.toolResult)}"`;
		} catch {
			return " [complex result]";
		}
	}
	return "";
}

/**
 * Format text:complete payload
 */
function formatTextComplete(payload: unknown, level: SignalConsoleLevel): string {
	const p = payload as { content?: string };
	if (typeof p.content !== "string" || p.content.length === 0) return "";

	if (level === "verbose") {
		return formatVerboseContent(p.content);
	}
	return ` "${truncateMultiline(p.content, TRUNCATE_LIMITS.textComplete)}"`;
}

/**
 * Format text:delta payload (verbose only)
 */
function formatTextDelta(payload: unknown): string {
	const p = payload as { content?: string };
	if (typeof p.content !== "string") return "";
	// Show the delta content, escape newlines for readability
	const escaped = p.content.replace(/\n/g, "\\n");
	return ` "${escaped}"`;
}

/**
 * Format thinking payload
 */
function formatThinking(payload: unknown, level: SignalConsoleLevel): string {
	const p = payload as { content?: string };
	if (typeof p.content !== "string" || p.content.length === 0) return "";

	if (level === "verbose") {
		return formatVerboseContent(p.content);
	}
	return ` "${truncateMultiline(p.content, TRUNCATE_LIMITS.thinking)}"`;
}

/**
 * Format duration from payload
 */
function formatDuration(payload: unknown): string {
	const p = payload as { durationMs?: number };
	if (typeof p.durationMs === "number") {
		return ` ${p.durationMs}ms`;
	}
	return "";
}

/**
 * Format agent source
 */
function formatSource(signal: Signal): string {
	const agent = signal.source?.agent;
	if (agent) {
		return ` [${agent}]`;
	}
	return "";
}

/**
 * Get color function for a signal name
 */
function getColorFn(name: string, useColors: boolean): (s: string) => string {
	if (!useColors) return (s: string) => s;

	if (name.startsWith("workflow:")) return pc.cyan;
	if (name.startsWith("agent:")) return pc.green;
	if (name.startsWith("harness:")) return pc.magenta;
	if (name.startsWith("tool:")) return pc.yellow;
	if (name.startsWith("text:")) return pc.dim;
	if (name.startsWith("error:")) return pc.red;
	if (name.startsWith("thinking:")) return pc.blue;
	if (name.startsWith("state:")) return pc.gray;

	return pc.white;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Create a signal console handler.
 *
 * Returns a function that can be used as a SignalBus subscriber
 * to output clean, color-coded signal logs.
 *
 * @param options - Configuration options
 * @returns Signal handler function
 *
 * @example
 * ```ts
 * // Default: normal level with truncated content
 * const signalConsole = createSignalConsole();
 *
 * // Quiet: minimal output
 * const quietConsole = createSignalConsole({ level: "quiet" });
 *
 * // Verbose: full content including streaming
 * const verboseConsole = createSignalConsole({ level: "verbose" });
 *
 * // Use with SignalBus
 * bus.subscribe(["**"], signalConsole);
 * ```
 */
export function createSignalConsole(options: SignalConsoleOptions = {}): (signal: Signal) => void {
	const level = normalizeLevel(options.level ?? "normal");
	const colors = options.colors ?? process.stdout.isTTY;
	const output = options.output ?? console.log;

	return (signal: Signal) => {
		// Check if signal should be shown at this level
		if (!shouldShow(signal.name, level)) {
			return;
		}

		// Build output
		const time = formatTime(signal.timestamp);
		const colorFn = getColorFn(signal.name, colors);

		let details = "";

		// Add signal-specific formatting
		switch (signal.name) {
			case "tool:call":
				details = formatToolCall(signal.payload, level);
				break;
			case "tool:result":
				details = formatToolResult(signal.payload, level);
				break;
			case "text:complete":
				details = formatTextComplete(signal.payload, level);
				break;
			case "text:delta":
				details = formatTextDelta(signal.payload);
				break;
			case "thinking:delta":
			case "thinking:complete":
				details = formatThinking(signal.payload, level);
				break;
			case "harness:end":
			case "workflow:end":
				details = formatDuration(signal.payload);
				break;
			case "agent:activated":
				details = formatSource(signal);
				break;
		}

		const message = `${time} ${colorFn(signal.name)}${details}`;
		output(message);
	};
}

/**
 * Pre-configured signal console for normal level output.
 */
export const defaultSignalConsole = createSignalConsole({ level: "normal" });
