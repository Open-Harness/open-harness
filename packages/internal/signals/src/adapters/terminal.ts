/**
 * Terminal Adapter - Renders signals to stdout with ANSI colors
 *
 * Uses a renderer map pattern where the adapter defines how to render each signal type.
 * Signals without a renderer in the map are silently skipped (no output, no error).
 *
 * @example
 * ```ts
 * import { terminalAdapter, type RendererMap } from "@internal/signals/adapters";
 *
 * const renderers: RendererMap = {
 *   "task:start": (signal) => `▶ Starting ${signal.payload.title}`,
 *   "task:complete": (signal) => `✓ Completed ${signal.payload.title}`,
 * };
 *
 * const adapter = terminalAdapter({ renderers });
 * // Use with runReactive() or SignalBus
 * // Signals not in the renderers map are silently skipped
 * ```
 */

import type { Signal } from "@internal/signals-core";
import { createAdapter, type SignalAdapter } from "../adapter.js";

// ============================================================================
// Renderer Types
// ============================================================================

/**
 * A function that renders a signal to a terminal string.
 *
 * Renderers receive the full Signal object and return a string that will be
 * written to the terminal. The adapter handles adding newlines and formatting.
 *
 * @typeParam T - The payload type of the signal (defaults to unknown)
 *
 * @example
 * ```ts
 * // Simple renderer
 * const taskStartRenderer: SignalRenderer = (signal) =>
 *   `▶ Starting task: ${signal.name}`;
 *
 * // Typed renderer with payload access
 * const taskCompleteRenderer: SignalRenderer<{ title: string; outcome: string }> = (signal) =>
 *   `${signal.payload.outcome === "success" ? "✓" : "✗"} ${signal.payload.title}`;
 * ```
 */
export type SignalRenderer<T = unknown> = (signal: Signal<T>) => string;

/**
 * A map of signal names to their renderer functions.
 *
 * Signals are looked up by their exact name. If a signal's name is not in the
 * map, it is silently skipped (no output, no error). This allows adapters to
 * be selective about which signals they render.
 *
 * @example
 * ```ts
 * const renderers: RendererMap = {
 *   "plan:start": () => "📋 Planning...",
 *   "plan:created": (s) => `✓ Created plan with ${s.payload.tasks.length} tasks`,
 *   "task:ready": (s) => `▶ ${s.payload.title}`,
 *   "task:complete": (s) => `${s.payload.outcome === "success" ? "✓" : "✗"} Done`,
 * };
 *
 * // Pass to terminalAdapter
 * const adapter = terminalAdapter({ renderers });
 * ```
 */
export type RendererMap = Record<string, SignalRenderer>;

// ============================================================================
// Terminal Adapter Options
// ============================================================================

/**
 * Configuration options for terminalAdapter
 */
export interface TerminalAdapterOptions {
	/**
	 * Map of signal names to renderer functions.
	 *
	 * Signals without a renderer in this map are silently skipped.
	 * This is the primary way to control what gets rendered to the terminal.
	 */
	renderers: RendererMap;

	/**
	 * Custom write function for output.
	 * Defaults to process.stdout.write
	 */
	write?: (text: string) => void;

	/**
	 * Whether to include timestamp prefix in output.
	 * @default false
	 */
	showTimestamp?: boolean;

	/**
	 * Whether to use ANSI colors in timestamp (when showTimestamp is true).
	 * Note: Color formatting within rendered strings is the renderer's responsibility.
	 * @default true
	 */
	colors?: boolean;

	/**
	 * Patterns to subscribe to.
	 * @default ["*"]
	 */
	patterns?: string[];
}

// ============================================================================
// ANSI Formatting (for timestamps only)
// ============================================================================

/**
 * ANSI color codes for timestamp formatting
 */
const ANSI = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
} as const;

// ============================================================================
// Terminal Adapter
// ============================================================================

/**
 * Create a terminal signal adapter
 *
 * Renders signals to stdout using a renderer map pattern. Signals are looked up
 * by exact name in the renderers map. If a renderer exists, it's called and the
 * result is written to stdout. If no renderer exists, the signal is silently skipped.
 *
 * @param options - Configuration options including the required renderers map
 * @returns A SignalAdapter for terminal output
 *
 * @example
 * ```ts
 * // Define renderers for signals you care about
 * const renderers: RendererMap = {
 *   "plan:start": () => "📋 Planning...",
 *   "plan:created": (s) => `✓ Created plan with ${s.payload.tasks.length} tasks`,
 *   "task:ready": (s) => `▶ ${s.payload.title}`,
 *   "task:complete": (s) => {
 *     const icon = s.payload.outcome === "success" ? "✓" : "✗";
 *     return `${icon} Task ${s.payload.taskId} ${s.payload.outcome}`;
 *   },
 * };
 *
 * // Create adapter with renderers
 * const adapter = terminalAdapter({ renderers });
 *
 * // With options
 * const adapter = terminalAdapter({
 *   renderers,
 *   showTimestamp: true,
 *   colors: process.stdout.isTTY,
 * });
 *
 * // Use with a signal bus or runReactive()
 * bus.subscribe("*", adapter.onSignal);
 * ```
 */
export function terminalAdapter(options: TerminalAdapterOptions): SignalAdapter {
	const {
		renderers,
		write = (text: string) => process.stdout.write(text),
		showTimestamp = false,
		colors = true,
		patterns = ["**"],
	} = options;

	return createAdapter({
		name: "terminal",
		patterns,

		onSignal(signal: Signal) {
			// Look up renderer by exact signal name
			const renderer = renderers[signal.name];

			// If no renderer exists, skip silently (no output, no error)
			if (!renderer) {
				return;
			}

			// Call the renderer to get the output string
			const output = renderer(signal);

			// Build the final output with optional timestamp
			const parts: string[] = [];

			if (showTimestamp) {
				const time = new Date(signal.timestamp).toLocaleTimeString();
				const dim = colors ? ANSI.dim : "";
				const reset = colors ? ANSI.reset : "";
				parts.push(`${dim}[${time}]${reset}`);
			}

			parts.push(output);

			// Write with newline
			write(`${parts.join(" ")}\n`);
		},
	});
}
