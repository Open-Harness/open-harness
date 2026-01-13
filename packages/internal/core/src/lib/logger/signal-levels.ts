/**
 * Signal-to-Pino level mapping for v3.1 observability.
 *
 * Maps signal name patterns to appropriate log levels:
 * - error: Failures (*:error, error:*)
 * - warn: Interruptions (*:abort*, *:timeout, *:fail*)
 * - info: Lifecycle events (workflow:*, harness:start, harness:end, *:done, *:complete)
 * - debug: Tool calls, state changes (tool:*, state:*)
 * - trace: Streaming deltas (*:delta)
 */

import type { Level } from "pino";

/**
 * Pattern rule for signal-to-level mapping.
 * Uses glob-style patterns with * and ** wildcards.
 */
type PatternRule = {
	/** Glob pattern or exact match */
	pattern: string;
	/** Pino log level */
	level: Level;
};

/**
 * Signal-to-level mapping rules in priority order.
 *
 * Patterns are checked in order; first match wins.
 * More specific patterns should come before general ones.
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
	// This acts as the default for unmatched patterns
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
 * Get the appropriate log level for a signal name.
 *
 * Uses pattern matching against the signal-to-level rules.
 * Returns 'debug' for signals that don't match any pattern.
 *
 * @param signalName - The signal name (e.g., "harness:start", "tool:call")
 * @returns The Pino log level to use
 *
 * @example
 * ```ts
 * getSignalLevel("harness:start")    // "info"
 * getSignalLevel("tool:call")        // "debug"
 * getSignalLevel("text:delta")       // "trace"
 * getSignalLevel("agent:error")      // "error"
 * getSignalLevel("workflow:aborted") // "warn"
 * getSignalLevel("custom:signal")    // "debug"
 * ```
 */
export function getSignalLevel(signalName: string): Level {
	for (const rule of COMPILED_RULES) {
		if (rule.regex.test(signalName)) {
			return rule.level;
		}
	}
	return DEFAULT_LEVEL;
}

/**
 * Numeric values for log levels (higher = more severe).
 * Used to determine if a signal should be logged at the configured level.
 */
const LEVEL_VALUES: Record<Level, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
};

/**
 * Check if a signal should be logged at the configured level.
 *
 * @param signalName - The signal name
 * @param configuredLevel - The minimum configured log level
 * @returns true if the signal should be logged
 *
 * @example
 * ```ts
 * shouldLogSignal("harness:start", "info")  // true
 * shouldLogSignal("tool:call", "info")      // false (debug < info)
 * shouldLogSignal("agent:error", "debug")   // true (error > debug)
 * ```
 */
export function shouldLogSignal(
	signalName: string,
	configuredLevel: Level,
): boolean {
	const signalLevel = getSignalLevel(signalName);
	return LEVEL_VALUES[signalLevel] >= LEVEL_VALUES[configuredLevel];
}
