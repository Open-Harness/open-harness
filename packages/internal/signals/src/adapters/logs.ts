/**
 * Logs Adapter - Bridges signals to Pino structured logging
 *
 * Maps signals to appropriate Pino log levels:
 * - Uses signal.meta.level if explicitly set (from defineSignal())
 * - Falls back to inferring level from signal name conventions:
 *   - *:error → error
 *   - *:fail*, *:abort*, *:timeout → warn
 *   - workflow:*, harness:start, harness:end, *:done, *:complete → info
 *   - *:delta → trace
 *   - default → debug
 *
 * @example
 * ```ts
 * import { logsAdapter } from "@internal/signals/adapters";
 * import { getLogger } from "@internal/core";
 *
 * const adapter = logsAdapter({ logger: getLogger() });
 * // Use with runReactive() or SignalBus
 * ```
 */

import type { Signal } from "@internal/signals-core";
import type { Level, Logger } from "pino";
import { createAdapter, type SignalAdapter } from "../adapter.js";

/**
 * Valid Pino log levels
 */
type PinoLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Signal meta interface for level extraction
 * Signals created with defineSignal() can have meta.level set
 */
interface SignalWithMeta extends Signal {
	meta?: {
		level?: PinoLevel;
		[key: string]: unknown;
	};
}

/**
 * Pattern rule for signal-to-level mapping
 */
interface PatternRule {
	/** Glob pattern or exact match */
	pattern: string;
	/** Pino log level */
	level: Level;
}

/**
 * Signal-to-level mapping rules in priority order.
 *
 * Patterns are checked in order; first match wins.
 * More specific patterns should come before general ones.
 *
 * This mirrors the logic in @internal/core/lib/logger/signal-levels.ts
 * to avoid cyclic dependencies between @internal/signals and @internal/core.
 */
const SIGNAL_LEVEL_RULES: PatternRule[] = [
	// ERROR - Always surface failures
	{ pattern: "*:error", level: "error" },
	{ pattern: "error:*", level: "error" },

	// WARN - Interruptions and timeouts
	{ pattern: "*:abort*", level: "warn" },
	{ pattern: "*:timeout", level: "warn" },
	{ pattern: "*:fail*", level: "warn" },

	// INFO - Core lifecycle events
	{ pattern: "workflow:*", level: "info" },
	{ pattern: "harness:start", level: "info" },
	{ pattern: "harness:end", level: "info" },
	{ pattern: "*:done", level: "info" },
	{ pattern: "*:complete", level: "info" },
	{ pattern: "agent:activated", level: "info" },

	// TRACE - Streaming deltas (very verbose)
	{ pattern: "*:delta", level: "trace" },

	// DEBUG - Everything else (tool calls, state, custom signals)
	{ pattern: "tool:*", level: "debug" },
	{ pattern: "state:*", level: "debug" },
];

/**
 * Default level for signals that don't match any pattern.
 */
const DEFAULT_LEVEL: Level = "debug";

/**
 * Convert a glob pattern to a regex for matching.
 *
 * Supports:
 * - * matches any segment (non-colon characters)
 * - ** matches anything including colons
 *
 * @param pattern - Glob pattern string
 * @returns RegExp for matching
 */
function patternToRegex(pattern: string): RegExp {
	// Escape special regex characters except * and ?
	let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");

	// Replace ** with .* (match anything)
	regexStr = regexStr.replace(/\*\*/g, ".*");

	// Replace remaining * with [^:]* (match non-colon characters)
	regexStr = regexStr.replace(/\*/g, "[^:]*");

	// Anchor the pattern
	return new RegExp(`^${regexStr}$`);
}

// Pre-compile patterns for performance
const COMPILED_RULES = SIGNAL_LEVEL_RULES.map((rule) => ({
	regex: patternToRegex(rule.pattern),
	level: rule.level,
}));

/**
 * Infer log level from signal name using convention-based patterns.
 *
 * @param signalName - The signal name (e.g., "harness:start", "tool:call")
 * @returns The Pino log level to use
 */
function inferLevelFromName(signalName: string): Level {
	for (const rule of COMPILED_RULES) {
		if (rule.regex.test(signalName)) {
			return rule.level;
		}
	}
	return DEFAULT_LEVEL;
}

/**
 * Configuration options for logsAdapter
 */
export interface LogsAdapterOptions {
	/**
	 * Pino logger instance to write logs to.
	 *
	 * Required to avoid cyclic dependency with @internal/core.
	 * Use getLogger() from @internal/core when calling from application code.
	 *
	 * @example
	 * ```ts
	 * import { getLogger } from "@internal/core";
	 * const adapter = logsAdapter({ logger: getLogger() });
	 * ```
	 */
	logger: Logger;

	/**
	 * Patterns to subscribe to.
	 * @default ["*"]
	 */
	patterns?: string[];

	/**
	 * Whether to include full payload in log output.
	 * When false, only logs signal name and timestamp.
	 * @default true
	 */
	includePayload?: boolean;

	/**
	 * Whether to include display metadata in log output.
	 * @default false
	 */
	includeDisplay?: boolean;
}

/**
 * Get log level for a signal
 *
 * Priority:
 * 1. Explicit meta.level from signal definition
 * 2. Inferred from signal name conventions
 *
 * @param signal - The signal to get level for
 * @returns Pino log level
 */
function getLogLevel(signal: Signal): Level {
	// Check for explicit meta.level from defineSignal()
	const signalWithMeta = signal as SignalWithMeta;
	if (signalWithMeta.meta?.level) {
		return signalWithMeta.meta.level;
	}

	// Fall back to convention-based inference from signal name
	return inferLevelFromName(signal.name);
}

/**
 * Create a logs signal adapter
 *
 * Bridges signals to Pino structured logging with appropriate log levels.
 * Signals are logged as structured JSONL with name, payload, and timestamp.
 *
 * @param options - Configuration options (logger is required)
 * @returns A SignalAdapter for Pino logging
 *
 * @example
 * ```ts
 * import { getLogger } from "@internal/core";
 * import { logsAdapter } from "@internal/signals/adapters";
 *
 * // Basic usage with global logger
 * const adapter = logsAdapter({ logger: getLogger() });
 *
 * // Custom logger instance
 * const adapter = logsAdapter({
 *   logger: createLogger({ level: "debug" }),
 * });
 *
 * // Filter to specific signal patterns
 * const adapter = logsAdapter({
 *   logger: getLogger(),
 *   patterns: ["task:*", "workflow:*"],
 * });
 *
 * // Minimal logging (name and timestamp only)
 * const adapter = logsAdapter({
 *   logger: getLogger(),
 *   includePayload: false,
 * });
 * ```
 */
export function logsAdapter(options: LogsAdapterOptions): SignalAdapter {
	const { logger, patterns = ["*"], includePayload = true, includeDisplay = false } = options;

	return createAdapter({
		name: "logs",
		patterns,

		onSignal(signal: Signal) {
			const level = getLogLevel(signal);

			// Build structured log object
			const logObj: Record<string, unknown> = {
				signalId: signal.id,
				signalName: signal.name,
				signalTimestamp: signal.timestamp,
			};

			// Include payload if enabled
			if (includePayload && signal.payload !== undefined) {
				logObj.payload = signal.payload;
			}

			// Include source if present
			if (signal.source) {
				logObj.source = signal.source;
			}

			// Include display metadata if enabled and present
			if (includeDisplay && signal.display) {
				// Only include serializable display properties
				// (skip function properties like title/subtitle functions)
				const displayObj: Record<string, unknown> = {};
				if (signal.display.type) displayObj.type = signal.display.type;
				if (signal.display.status) displayObj.status = signal.display.status;
				if (signal.display.icon) displayObj.icon = signal.display.icon;
				if (signal.display.progress) displayObj.progress = signal.display.progress;
				if (signal.display.append !== undefined) displayObj.append = signal.display.append;
				if (typeof signal.display.title === "string") displayObj.title = signal.display.title;
				if (typeof signal.display.subtitle === "string") displayObj.subtitle = signal.display.subtitle;

				if (Object.keys(displayObj).length > 0) {
					logObj.display = displayObj;
				}
			}

			// Log at the determined level
			switch (level) {
				case "trace":
					logger.trace(logObj, `signal: ${signal.name}`);
					break;
				case "debug":
					logger.debug(logObj, `signal: ${signal.name}`);
					break;
				case "info":
					logger.info(logObj, `signal: ${signal.name}`);
					break;
				case "warn":
					logger.warn(logObj, `signal: ${signal.name}`);
					break;
				case "error":
					logger.error(logObj, `signal: ${signal.name}`);
					break;
				case "fatal":
					logger.fatal(logObj, `signal: ${signal.name}`);
					break;
				default:
					// Default to debug for any unhandled level
					logger.debug(logObj, `signal: ${signal.name}`);
			}
		},

		onStart() {
			logger.debug({ adapter: "logs" }, "Logs adapter started");
		},

		onStop() {
			logger.debug({ adapter: "logs" }, "Logs adapter stopped");
		},
	});
}
