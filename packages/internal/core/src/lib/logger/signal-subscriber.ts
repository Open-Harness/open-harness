/**
 * Signal-to-Pino subscriber for v3.1 observability.
 *
 * Connects the SignalBus to the Pino logger, automatically
 * routing signals to appropriate log levels based on their names.
 *
 * This enables "batteries included" logging where infrastructure
 * events are logged automatically without user code changes.
 */

import type { Logger } from "pino";
import type { ISignalBus, Unsubscribe } from "@internal/signals";
import type { Signal } from "@internal/signals-core";
import { getSignalLevel } from "./signal-levels.js";

/**
 * Log entry structure for signals
 */
interface SignalLogEntry {
	/** Signal name */
	signal: string;
	/** Signal payload (if not too large) */
	payload?: unknown;
	/** Signal source info */
	source?: unknown;
	/** Signal timestamp */
	timestamp: string;
	/** Run ID for correlation */
	runId?: string;
}

/**
 * Options for signal logging subscriber
 */
export interface SignalSubscriberOptions {
	/**
	 * Maximum payload size to include in logs (bytes).
	 * Larger payloads are truncated or omitted.
	 * @default 1000
	 */
	maxPayloadSize?: number;

	/**
	 * Include full source metadata in logs.
	 * @default false
	 */
	includeSource?: boolean;

	/**
	 * Run ID to include in all log entries for correlation.
	 */
	runId?: string;
}

/**
 * Subscribe a Pino logger to a SignalBus for automatic logging.
 *
 * All signals emitted on the bus will be logged at the appropriate
 * level based on the signal-to-level mapping rules.
 *
 * @param bus - The SignalBus to subscribe to
 * @param logger - The Pino logger to write to
 * @param options - Optional configuration
 * @returns Unsubscribe function to stop logging
 *
 * @example
 * ```ts
 * import { SignalBus } from "@internal/signals";
 * import { createLogger, subscribeSignalLogger } from "@internal/core/lib/logger";
 *
 * const bus = new SignalBus();
 * const logger = createLogger({ console: true });
 *
 * // Start logging all signals
 * const unsubscribe = subscribeSignalLogger(bus, logger);
 *
 * // Emit signals - they're automatically logged
 * bus.emit(createSignal("harness:start", { agent: "analyst" }));
 * // -> [INFO] harness:start { signal: "harness:start", payload: { agent: "analyst" } }
 *
 * // Stop logging when done
 * unsubscribe();
 * ```
 */
export function subscribeSignalLogger(
	bus: ISignalBus,
	logger: Logger,
	options: SignalSubscriberOptions = {},
): Unsubscribe {
	const maxPayloadSize = options.maxPayloadSize ?? 1000;
	const includeSource = options.includeSource ?? false;
	const runId = options.runId;

	// Subscribe to all signals using ** pattern
	return bus.subscribe(["**"], (signal: Signal) => {
		const level = getSignalLevel(signal.name);

		// Build log entry
		const entry: SignalLogEntry = {
			signal: signal.name,
			timestamp: signal.timestamp,
		};

		// Include payload if not too large
		if (signal.payload !== undefined) {
			const payloadStr = JSON.stringify(signal.payload);
			if (payloadStr.length <= maxPayloadSize) {
				entry.payload = signal.payload;
			} else {
				// Truncate large payloads
				entry.payload = "[payload truncated]";
			}
		}

		// Include source if requested
		if (includeSource && signal.source) {
			entry.source = signal.source;
		}

		// Include run ID for correlation
		if (runId) {
			entry.runId = runId;
		}

		// Log at appropriate level
		logger[level](entry, signal.name);
	});
}
