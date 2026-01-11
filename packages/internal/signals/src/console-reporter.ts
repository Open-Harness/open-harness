/**
 * ConsoleSignalReporter - Logs signals to console
 *
 * A simple reporter that outputs signal events to the console
 * with color-coded formatting for easy debugging.
 *
 * @example
 * ```ts
 * import { SignalBus, attachReporter } from "@internal/signals";
 * import { createConsoleReporter } from "@internal/signals/console-reporter";
 *
 * const bus = new SignalBus();
 * const reporter = createConsoleReporter({ verbose: true });
 *
 * attachReporter(bus, reporter);
 * ```
 */

import type { Signal } from "@internal/signals-core";
import type { SignalPattern } from "./patterns.js";
import type { ReporterContext, SignalReporter } from "./reporter.js";

/**
 * Options for configuring the console reporter
 */
export interface ConsoleReporterOptions {
	/**
	 * Signal patterns to report on.
	 * @default ["**"] (all signals)
	 */
	patterns?: SignalPattern[];

	/**
	 * Include signal payload in output.
	 * @default false
	 */
	verbose?: boolean;

	/**
	 * Include timestamp in output.
	 * @default false
	 */
	showTimestamp?: boolean;

	/**
	 * Prefix for all log messages.
	 * @default "[signal]"
	 */
	prefix?: string;

	/**
	 * Custom log function (defaults to console.log).
	 * Useful for testing or custom output targets.
	 */
	log?: (message: string) => void;
}

/**
 * Create a console signal reporter.
 *
 * @param options - Configuration options
 * @returns A SignalReporter that logs to console
 *
 * @example
 * ```ts
 * // Basic usage - log all signals
 * const reporter = createConsoleReporter();
 *
 * // Verbose mode with specific patterns
 * const reporter = createConsoleReporter({
 *   patterns: ["harness:*", "agent:activated"],
 *   verbose: true,
 * });
 * ```
 */
export function createConsoleReporter(options: ConsoleReporterOptions = {}): SignalReporter {
	const { patterns = ["**"], verbose = false, showTimestamp = false, prefix = "[signal]", log = console.log } = options;

	return {
		name: "console",
		patterns,

		onSignal(signal: Signal, ctx: ReporterContext): void {
			const parts: string[] = [prefix];

			// Add timestamp if requested
			if (showTimestamp) {
				parts.push(`[${signal.timestamp}]`);
			}

			// Add run ID if present
			if (ctx.runId) {
				parts.push(`[${ctx.runId.slice(0, 8)}]`);
			}

			// Add signal name
			parts.push(signal.name);

			// Add payload if verbose
			if (verbose && signal.payload !== undefined) {
				try {
					const payloadStr = JSON.stringify(signal.payload, null, 0);
					// Truncate long payloads
					const truncated = payloadStr.length > 100 ? `${payloadStr.slice(0, 100)}...` : payloadStr;
					parts.push(`→ ${truncated}`);
				} catch {
					parts.push("→ [non-serializable payload]");
				}
			}

			log(parts.join(" "));
		},

		onAttach(): void {
			if (verbose) {
				log(`${prefix} Console reporter attached`);
			}
		},

		onDetach(): void {
			if (verbose) {
				log(`${prefix} Console reporter detached`);
			}
		},
	};
}

/**
 * Pre-configured console reporter for common patterns.
 *
 * Logs harness lifecycle and agent activation signals.
 */
export const defaultConsoleReporter = createConsoleReporter({
	patterns: ["harness:*", "agent:activated"],
	showTimestamp: true,
});
