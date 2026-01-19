/**
 * Terminal Adapter - Renders signals to stdout with ANSI colors
 *
 * Reads signal.display metadata to determine rendering:
 * - status: Persistent state with spinner/check
 * - progress: Progress bar or step counts
 * - notification: One-time event with icon
 * - stream: Streaming text (append mode)
 * - log: Structured log output
 *
 * Falls back to inferring display type from signal naming conventions:
 * - *:start → status (active)
 * - *:complete → notification (success)
 * - *:error → notification (error)
 * - *:delta → stream (append)
 *
 * @example
 * ```ts
 * import { terminalAdapter } from "@internal/signals/adapters";
 *
 * const adapter = terminalAdapter();
 * // Use with runReactive() or SignalBus
 * ```
 */

import type { Signal, SignalDisplay, SignalDisplayStatus, SignalDisplayType } from "@internal/signals-core";
import { createAdapter, type SignalAdapter } from "../adapter.js";

/**
 * ANSI color codes for terminal output
 */
const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",

	// Foreground colors
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
	white: "\x1b[37m",
} as const;

/**
 * Status icons for terminal display
 */
const ICONS = {
	pending: "○",
	active: "●",
	success: "✓",
	error: "✗",
	warning: "⚠",
	info: "ℹ",
	stream: "→",
} as const;

/**
 * Map display status to ANSI color
 */
function statusToColor(status: SignalDisplayStatus | undefined): string {
	switch (status) {
		case "success":
			return ANSI.green;
		case "error":
			return ANSI.red;
		case "active":
			return ANSI.yellow;
		case "warning":
			return ANSI.yellow;
		case "pending":
			return ANSI.blue;
		default:
			return ANSI.white;
	}
}

/**
 * Get icon for display status
 */
function statusToIcon(status: SignalDisplayStatus | undefined, type?: SignalDisplayType): string {
	if (type === "stream") {
		return ICONS.stream;
	}
	switch (status) {
		case "success":
			return ICONS.success;
		case "error":
			return ICONS.error;
		case "warning":
			return ICONS.warning;
		case "active":
			return ICONS.active;
		case "pending":
			return ICONS.pending;
		default:
			return ICONS.info;
	}
}

/**
 * Infer display type from signal name conventions
 *
 * Naming conventions:
 * - *:start → status (active)
 * - *:complete → notification (success)
 * - *:error → notification (error)
 * - *:delta → stream (append)
 */
function inferDisplayFromName(signalName: string): Partial<SignalDisplay> {
	// Extract suffix after last colon
	const suffix = signalName.split(":").pop()?.toLowerCase();

	switch (suffix) {
		case "start":
		case "started":
		case "begin":
			return { type: "status", status: "active" };

		case "complete":
		case "completed":
		case "done":
		case "success":
			return { type: "notification", status: "success" };

		case "error":
		case "failed":
		case "failure":
			return { type: "notification", status: "error" };

		case "warning":
		case "warn":
			return { type: "notification", status: "warning" };

		case "delta":
		case "chunk":
		case "stream":
			return { type: "stream", append: true };

		case "progress":
			return { type: "progress", status: "active" };

		default:
			return { type: "log" };
	}
}

/**
 * Resolve title from signal display config
 *
 * Title can be a static string or a function of payload
 */
function resolveTitle(signal: Signal): string {
	const display = signal.display;

	if (!display?.title) {
		return signal.name;
	}

	if (typeof display.title === "function") {
		try {
			return display.title(signal.payload);
		} catch {
			return signal.name;
		}
	}

	return display.title;
}

/**
 * Resolve subtitle from signal display config
 */
function resolveSubtitle(signal: Signal): string | undefined {
	const display = signal.display;

	if (!display?.subtitle) {
		return undefined;
	}

	if (typeof display.subtitle === "function") {
		try {
			return display.subtitle(signal.payload);
		} catch {
			return undefined;
		}
	}

	return display.subtitle;
}

/**
 * Format progress for display
 */
function formatProgress(progress: number | { current: number; total: number } | undefined): string {
	if (progress === undefined) {
		return "";
	}

	if (typeof progress === "number") {
		// Percentage progress
		const percent = Math.round(progress);
		const filled = Math.round(percent / 5); // 20 chars total
		const empty = 20 - filled;
		const bar = "█".repeat(filled) + "░".repeat(empty);
		return ` [${bar}] ${percent}%`;
	}

	// Step-based progress
	const { current, total } = progress;
	return ` (${current}/${total})`;
}

/**
 * Configuration options for terminalAdapter
 */
export interface TerminalAdapterOptions {
	/**
	 * Custom write function for output.
	 * Defaults to process.stdout.write
	 */
	write?: (text: string) => void;

	/**
	 * Whether to include timestamp in output.
	 * @default false
	 */
	showTimestamp?: boolean;

	/**
	 * Whether to use ANSI colors.
	 * @default true
	 */
	colors?: boolean;

	/**
	 * Patterns to subscribe to.
	 * @default ["*"]
	 */
	patterns?: string[];
}

/**
 * Create a terminal signal adapter
 *
 * Renders signals to stdout with ANSI colors and formatting based on
 * signal display metadata or naming convention inference.
 *
 * @param options - Configuration options
 * @returns A SignalAdapter for terminal output
 *
 * @example
 * ```ts
 * // Basic usage
 * const adapter = terminalAdapter();
 *
 * // Custom options
 * const adapter = terminalAdapter({
 *   showTimestamp: true,
 *   colors: process.stdout.isTTY,
 * });
 *
 * // Use with a signal bus or runReactive()
 * bus.subscribe("*", adapter.onSignal);
 * ```
 */
export function terminalAdapter(options: TerminalAdapterOptions = {}): SignalAdapter {
	const {
		write = (text: string) => process.stdout.write(text),
		showTimestamp = false,
		colors = true,
		patterns = ["*"],
	} = options;

	// Track streaming state per signal name for append mode
	const streamingState = new Map<string, boolean>();

	/**
	 * Format a signal for terminal output
	 */
	function formatSignal(signal: Signal): string {
		// Get display metadata or infer from name
		const explicitDisplay = signal.display ?? {};
		const inferredDisplay = inferDisplayFromName(signal.name);
		const display = { ...inferredDisplay, ...explicitDisplay };

		const type = display.type ?? "log";
		const status = display.status;
		const icon = display.icon ?? statusToIcon(status, type);
		const color = colors ? statusToColor(status) : "";
		const reset = colors ? ANSI.reset : "";
		const dim = colors ? ANSI.dim : "";

		const title = resolveTitle(signal);
		const subtitle = resolveSubtitle(signal);
		const progress = formatProgress(display.progress);

		// Build output parts
		const parts: string[] = [];

		// Timestamp (optional)
		if (showTimestamp) {
			const time = new Date(signal.timestamp).toLocaleTimeString();
			parts.push(`${dim}[${time}]${reset}`);
		}

		// Format based on display type
		switch (type) {
			case "status": {
				parts.push(`${color}${icon}${reset} ${title}${progress}`);
				break;
			}

			case "progress": {
				parts.push(`${color}${icon}${reset} ${title}${progress}`);
				break;
			}

			case "notification": {
				parts.push(`${color}${icon}${reset} ${title}`);
				break;
			}

			case "stream": {
				// For streaming, check if this is continuation (append mode)
				const isAppending = streamingState.get(signal.name);
				if (display.append && isAppending) {
					// Just append content without prefix for continuation
					return String(signal.payload ?? "");
				}
				// First stream signal - mark as streaming and output with icon
				streamingState.set(signal.name, true);
				parts.push(`${color}${icon}${reset} ${title}`);
				break;
			}

			default: {
				// Includes "log" type and any unrecognized types
				parts.push(`${dim}[${signal.name}]${reset} ${title}`);
				break;
			}
		}

		// Add subtitle if present
		if (subtitle) {
			parts.push(`\n  ${dim}${subtitle}${reset}`);
		}

		return parts.join(" ");
	}

	return createAdapter({
		name: "terminal",
		patterns,

		onStart() {
			streamingState.clear();
		},

		onSignal(signal: Signal) {
			// Check streaming state BEFORE formatting (formatSignal will update it)
			const wasStreaming = streamingState.get(signal.name);

			const output = formatSignal(signal);

			// Determine line ending
			const display = signal.display ?? {};
			const inferredDisplay = inferDisplayFromName(signal.name);
			const effectiveDisplay = { ...inferredDisplay, ...display };

			// Stream signals in append mode don't get newlines (caller controls spacing)
			const isStreamAppend = effectiveDisplay.type === "stream" && effectiveDisplay.append;

			if (isStreamAppend && wasStreaming) {
				// Just write content directly for streaming continuation
				write(output);
			} else {
				// Normal output with newline
				write(`${output}\n`);
			}
		},

		onStop() {
			// Ensure any pending streams get a final newline
			if (streamingState.size > 0) {
				streamingState.clear();
			}
		},
	});
}
