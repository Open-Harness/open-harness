import pino, { type Logger } from "pino";
import {
	type LoggerConfig,
	DEFAULT_CONFIG,
	loadConfigFromEnv,
	resolveConfig,
} from "./config.js";
import { createTransports, getLogFilePath, listLogFiles } from "./transports.js";
import { getEventLevel, getEventsAtLevel, shouldLog } from "./levels.js";
// v3.1: Signal-based logging via SignalBus
import { getSignalLevel, shouldLogSignal } from "./signal-levels.js";
import {
	subscribeSignalLogger,
	type SignalSubscriberOptions,
} from "./signal-subscriber.js";

// Re-export types and utilities
export type { LoggerConfig, SignalSubscriberOptions };
export {
	DEFAULT_CONFIG,
	loadConfigFromEnv,
	resolveConfig,
	getLogFilePath,
	listLogFiles,
	// Legacy event-based logging (RuntimeEvent)
	getEventLevel,
	getEventsAtLevel,
	shouldLog,
	// v3.1 Signal-based logging
	getSignalLevel,
	shouldLogSignal,
	subscribeSignalLogger,
};

/**
 * Singleton logger instance.
 * Created lazily on first access.
 */
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance.
 *
 * Configuration is loaded from environment variables on first call.
 * Use `createLogger()` for custom configuration.
 *
 * @returns The global Pino logger instance
 *
 * @example
 * ```ts
 * import { getLogger } from "@internal/core/lib/logger";
 *
 * const logger = getLogger();
 * logger.info({ runId: "abc" }, "Starting execution");
 * ```
 */
export function getLogger(): Logger {
	if (!globalLogger) {
		globalLogger = createLogger();
	}
	return globalLogger;
}

/**
 * Create a new logger instance with custom configuration.
 *
 * @param options - Partial configuration (merged with defaults and env)
 * @returns A new Pino logger instance
 *
 * @example
 * ```ts
 * // Use all defaults (file logging ON, console OFF)
 * const logger = createLogger();
 *
 * // Enable console output
 * const logger = createLogger({ console: true });
 *
 * // Custom log directory
 * const logger = createLogger({ logDir: "./my-logs" });
 *
 * // Debug level with console
 * const logger = createLogger({ level: "debug", console: true });
 * ```
 */
export function createLogger(options: Partial<LoggerConfig> = {}): Logger {
	// Merge: defaults < env < explicit options
	const envConfig = loadConfigFromEnv();
	const config = resolveConfig({ ...envConfig, ...options });

	// Return noop logger if disabled
	if (config.disabled) {
		return pino({ level: "silent" });
	}

	const transport = createTransports(config);

	return pino(
		{
			level: config.level,
			// Base fields included in every log entry
			base: {
				service: "open-harness",
			},
			// Timestamp format (ISO 8601)
			timestamp: pino.stdTimeFunctions.isoTime,
		},
		transport,
	);
}

/**
 * Create a child logger with additional context.
 *
 * Useful for adding runId, nodeId, or other context to all logs
 * within a specific scope.
 *
 * @param logger - Parent logger
 * @param bindings - Context to add to all child logs
 * @returns Child logger with bound context
 *
 * @example
 * ```ts
 * const logger = getLogger();
 * const runLogger = createChildLogger(logger, { runId: "abc-123" });
 *
 * // All logs from runLogger include runId
 * runLogger.info("Starting node execution");
 * // Output: { runId: "abc-123", msg: "Starting node execution", ... }
 * ```
 */
export function createChildLogger(
	logger: Logger,
	bindings: Record<string, unknown>,
): Logger {
	return logger.child(bindings);
}

/**
 * Reset the global logger.
 *
 * Useful for testing or reconfiguring after environment changes.
 */
export function resetLogger(): void {
	globalLogger = null;
}

/**
 * Quick logging functions using the global logger.
 *
 * Convenience exports for simple logging needs.
 */
export const log = {
	trace: (obj: object, msg?: string) => getLogger().trace(obj, msg),
	debug: (obj: object, msg?: string) => getLogger().debug(obj, msg),
	info: (obj: object, msg?: string) => getLogger().info(obj, msg),
	warn: (obj: object, msg?: string) => getLogger().warn(obj, msg),
	error: (obj: object, msg?: string) => getLogger().error(obj, msg),
	fatal: (obj: object, msg?: string) => getLogger().fatal(obj, msg),
};
