/**
 * Signal Adapters - Output renderers for signals
 *
 * Adapters receive signals and render them to different outputs (terminal, logs, web).
 * This module provides pre-built adapters and a factory for creating custom ones.
 *
 * The terminal adapter uses a renderer map pattern where you define how each signal
 * type should be rendered. Signals without a renderer are silently skipped.
 *
 * @example
 * ```ts
 * import {
 *   terminalAdapter,
 *   logsAdapter,
 *   createAdapter,
 *   type RendererMap,
 * } from "@internal/signals/adapters";
 * import { getLogger } from "@internal/core";
 *
 * // Define renderers for your signals
 * const renderers: RendererMap = {
 *   "task:start": (s) => `▶ Starting ${s.payload.title}`,
 *   "task:complete": (s) => `✓ ${s.payload.title} done`,
 * };
 *
 * // Use terminal adapter with renderers
 * const terminal = terminalAdapter({ renderers });
 *
 * // Use logs adapter (name-based log level routing)
 * const logs = logsAdapter({ logger: getLogger() });
 *
 * // Create a custom adapter
 * const custom = createAdapter({
 *   name: "my-adapter",
 *   onSignal: (signal) => { ... },
 * });
 * ```
 */

import type { Logger } from "pino";
import type { SignalAdapter } from "../adapter.js";
import { type LogsAdapterOptions, logsAdapter } from "./logs.js";
import { type RendererMap, type TerminalAdapterOptions, terminalAdapter } from "./terminal.js";

// Re-export createAdapter from parent for convenience
export { type CreateAdapterConfig, createAdapter, type SignalAdapter } from "../adapter.js";
export { type LogsAdapterOptions, logsAdapter } from "./logs.js";
// Re-export adapters and types
export { type RendererMap, type SignalRenderer, type TerminalAdapterOptions, terminalAdapter } from "./terminal.js";

/**
 * Configuration options for defaultAdapters()
 */
export interface DefaultAdaptersOptions {
	/**
	 * Renderer map for the terminal adapter.
	 *
	 * Defines how each signal type should be rendered to the terminal.
	 * Signals without a renderer are silently skipped.
	 *
	 * @example
	 * ```ts
	 * const renderers: RendererMap = {
	 *   "task:start": (s) => `▶ ${s.payload.title}`,
	 *   "task:complete": (s) => `✓ ${s.payload.title}`,
	 * };
	 * const adapters = defaultAdapters({ renderers });
	 * ```
	 */
	renderers: RendererMap;

	/**
	 * Pino logger instance for the logs adapter.
	 *
	 * If provided, a logs adapter is included that routes signals
	 * to appropriate log levels based on signal name conventions.
	 *
	 * @example
	 * ```ts
	 * import { getLogger } from "@internal/core";
	 * const adapters = defaultAdapters({ renderers, logger: getLogger() });
	 * ```
	 */
	logger?: Logger;

	/**
	 * Additional options for the terminal adapter (besides renderers)
	 */
	terminal?: Omit<TerminalAdapterOptions, "renderers" | "patterns">;

	/**
	 * Options for the logs adapter
	 */
	logs?: Omit<LogsAdapterOptions, "logger" | "patterns">;
}

/**
 * Get the default set of signal adapters.
 *
 * Returns [terminalAdapter, logsAdapter] when a logger is provided,
 * or just [terminalAdapter] when no logger is available.
 *
 * The terminal adapter requires a renderer map to define how signals
 * are rendered. Signals without a renderer are silently skipped.
 *
 * @param options - Configuration options (renderers required, logger optional)
 * @returns Array of SignalAdapter instances
 *
 * @example
 * ```ts
 * import { getLogger } from "@internal/core";
 * import { defaultAdapters, type RendererMap } from "@internal/signals/adapters";
 *
 * const renderers: RendererMap = {
 *   "plan:start": () => "📋 Planning...",
 *   "plan:created": (s) => `✓ Plan with ${s.payload.tasks.length} tasks`,
 *   "task:ready": (s) => `▶ ${s.payload.title}`,
 *   "task:complete": (s) => `✓ Task done`,
 *   "workflow:complete": () => "🎉 All done!",
 * };
 *
 * // Terminal with renderers only
 * const terminalOnly = defaultAdapters({ renderers });
 *
 * // Full adapters with logging
 * const adapters = defaultAdapters({ renderers, logger: getLogger() });
 *
 * // With custom options
 * const custom = defaultAdapters({
 *   renderers,
 *   logger: getLogger(),
 *   terminal: { showTimestamp: true },
 *   logs: { includePayload: false },
 * });
 *
 * // Use with runReactive or similar
 * await runReactive({ adapters, ... });
 * ```
 */
export function defaultAdapters(options: DefaultAdaptersOptions): SignalAdapter[] {
	const { renderers, logger, terminal: terminalOptions, logs: logsOptions } = options;

	const adapters: SignalAdapter[] = [];

	// Always include terminal adapter with the provided renderers
	adapters.push(terminalAdapter({ renderers, ...terminalOptions }));

	// Include logs adapter only when logger is provided
	if (logger) {
		adapters.push(
			logsAdapter({
				logger,
				...logsOptions,
			}),
		);
	}

	return adapters;
}
