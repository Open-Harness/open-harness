import type { Level } from "pino";
import type { RuntimeEvent } from "../../state/events.js";

/**
 * Maps RuntimeEvent types to Pino log levels.
 *
 * Level strategy:
 * - ERROR: Failures that need attention
 * - WARN: Interruptions (abort, pause issues)
 * - INFO: Lifecycle events you always want to see
 * - DEBUG: Details useful when investigating
 * - TRACE: Streaming deltas (very verbose)
 */
const EVENT_LEVELS: Record<RuntimeEvent["type"], Level> = {
	// ERROR - Always surface
	"agent:error": "error",
	"node:error": "error",

	// WARN - Interruptions
	"flow:aborted": "warn",
	"agent:aborted": "warn",

	// INFO - Core lifecycle (default visibility)
	"agent:start": "info",
	"agent:text": "info",
	"agent:complete": "info",
	"node:start": "info",
	"node:complete": "info",
	"flow:start": "info",
	"flow:complete": "info",
	"flow:paused": "info",
	"flow:resumed": "info",

	// DEBUG - Useful when investigating
	"agent:tool": "debug",
	"agent:thinking": "debug",
	"agent:paused": "debug",
	"edge:fire": "debug",
	"state:patch": "debug",
	"recording:linked": "debug",
	"node:skipped": "debug",
	"loop:iterate": "debug",
	"command:received": "debug",

	// TRACE - Streaming (very verbose)
	"agent:text:delta": "trace",
	"agent:thinking:delta": "trace",
};

/**
 * Get the log level for a given event type.
 *
 * @param eventType - The RuntimeEvent type
 * @returns The appropriate Pino log level
 */
export function getEventLevel(eventType: RuntimeEvent["type"]): Level {
	return EVENT_LEVELS[eventType] ?? "debug";
}

/**
 * Check if an event type should be logged at the given level.
 *
 * @param eventType - The RuntimeEvent type
 * @param configuredLevel - The configured minimum log level
 * @returns true if the event should be logged
 */
export function shouldLog(
	eventType: RuntimeEvent["type"],
	configuredLevel: Level,
): boolean {
	const eventLevel = getEventLevel(eventType);
	return LEVEL_VALUES[eventLevel] >= LEVEL_VALUES[configuredLevel];
}

/**
 * Numeric values for log levels (higher = more severe).
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
 * Get all event types that would be logged at a given level.
 * Useful for documentation and debugging.
 */
export function getEventsAtLevel(level: Level): RuntimeEvent["type"][] {
	const minValue = LEVEL_VALUES[level];
	return (Object.entries(EVENT_LEVELS) as [RuntimeEvent["type"], Level][])
		.filter(([, eventLevel]) => LEVEL_VALUES[eventLevel] >= minValue)
		.map(([type]) => type);
}
