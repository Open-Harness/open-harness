/**
 * Signal Adapters - Output renderers for signals
 *
 * Adapters receive signals and render them to different outputs (terminal, logs, web).
 * This module provides pre-built adapters and a factory for creating custom ones.
 *
 * @example
 * ```ts
 * import {
 *   terminalAdapter,
 *   logsAdapter,
 *   createAdapter,
 *   defaultAdapters,
 * } from "@internal/signals/adapters";
 * import { getLogger } from "@internal/core";
 *
 * // Use default adapters (terminal + logs)
 * const adapters = defaultAdapters({ logger: getLogger() });
 *
 * // Use individual adapters
 * const terminal = terminalAdapter();
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
import { type TerminalAdapterOptions, terminalAdapter } from "./terminal.js";

// Re-export createAdapter from parent for convenience
export { type CreateAdapterConfig, createAdapter, type SignalAdapter } from "../adapter.js";
export { type LogsAdapterOptions, logsAdapter } from "./logs.js";
// Re-export adapters
export { type TerminalAdapterOptions, terminalAdapter } from "./terminal.js";

/**
 * Configuration options for defaultAdapters()
 */
export interface DefaultAdaptersOptions {
	/**
	 * Pino logger instance for the logs adapter.
	 *
	 * Required for the logs adapter to be included.
	 * If not provided, only the terminal adapter is returned.
	 *
	 * @example
	 * ```ts
	 * import { getLogger } from "@internal/core";
	 * const adapters = defaultAdapters({ logger: getLogger() });
	 * ```
	 */
	logger?: Logger;

	/**
	 * Options for the terminal adapter
	 */
	terminal?: Omit<TerminalAdapterOptions, "patterns">;

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
 * This is a convenience function for getting a sensible default set of
 * adapters that covers terminal output and structured logging.
 *
 * @param options - Configuration options (logger required for logs adapter)
 * @returns Array of SignalAdapter instances
 *
 * @example
 * ```ts
 * import { getLogger } from "@internal/core";
 * import { defaultAdapters } from "@internal/signals/adapters";
 *
 * // Full default adapters with logging
 * const adapters = defaultAdapters({ logger: getLogger() });
 *
 * // Terminal only (no logger available)
 * const terminalOnly = defaultAdapters({});
 *
 * // With custom options
 * const custom = defaultAdapters({
 *   logger: getLogger(),
 *   terminal: { showTimestamp: true },
 *   logs: { includePayload: false },
 * });
 *
 * // Use with runReactive or similar
 * await runReactive({ adapters, ... });
 * ```
 */
export function defaultAdapters(options: DefaultAdaptersOptions = {}): SignalAdapter[] {
	const { logger, terminal: terminalOptions, logs: logsOptions } = options;

	const adapters: SignalAdapter[] = [];

	// Always include terminal adapter
	adapters.push(terminalAdapter(terminalOptions));

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
