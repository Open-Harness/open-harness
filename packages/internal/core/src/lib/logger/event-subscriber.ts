import type { Logger } from "pino";
import type { RuntimeEvent, Unsubscribe } from "../../state/events.js";
import type { EventBus } from "../../runtime/execution/runtime.js";
import { getEventLevel } from "./levels.js";

/**
 * Subscribe a Pino logger to an EventBus.
 *
 * Automatically maps RuntimeEvent types to appropriate log levels:
 * - ERROR: agent:error, node:error
 * - WARN: flow:aborted, agent:aborted
 * - INFO: lifecycle events (start, complete, text)
 * - DEBUG: tool calls, state patches, edge fires
 * - TRACE: streaming deltas
 *
 * @param eventBus - The event bus to subscribe to
 * @param logger - The Pino logger instance
 * @returns Unsubscribe function to stop logging
 *
 * @example
 * ```ts
 * const logger = createLogger();
 * const runtime = createRuntime({ ... });
 *
 * // Start logging events
 * const unsubscribe = subscribeLogger(runtime, logger);
 *
 * // Run the workflow
 * await runtime.run();
 *
 * // Optionally stop logging
 * unsubscribe();
 * ```
 */
export function subscribeLogger(eventBus: EventBus, logger: Logger): Unsubscribe {
	return eventBus.subscribe((event: RuntimeEvent) => {
		const level = getEventLevel(event.type);

		// Log with the event type as the message, event data as context
		// This makes logs easy to grep/filter by event type
		logger[level](formatEventForLog(event), event.type);
	});
}

/**
 * Format an event for logging.
 *
 * Extracts key fields and structures them for queryability.
 * Keeps the raw event data while adding computed fields.
 */
function formatEventForLog(event: RuntimeEvent): Record<string, unknown> {
	const { type, timestamp, ...rest } = event;

	// Base log entry with consistent field ordering
	const entry: Record<string, unknown> = {
		eventType: type,
		ts: timestamp,
	};

	// Add correlation IDs if present (most events have these)
	if ("runId" in rest) {
		entry.runId = rest.runId;
	}
	if ("nodeId" in rest) {
		entry.nodeId = rest.nodeId;
	}
	if ("sessionId" in rest) {
		entry.sessionId = rest.sessionId;
	}

	// Add remaining event-specific data
	Object.assign(entry, rest);

	return entry;
}

/**
 * Create a logger subscriber that only logs specific event types.
 *
 * Useful for focused debugging of specific areas.
 *
 * @param eventBus - The event bus to subscribe to
 * @param logger - The Pino logger instance
 * @param eventTypes - Array of event types to log
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * // Only log tool calls and errors
 * const unsubscribe = subscribeLoggerFiltered(
 *   eventBus,
 *   logger,
 *   ['agent:tool', 'agent:error', 'node:error']
 * );
 * ```
 */
export function subscribeLoggerFiltered(
	eventBus: EventBus,
	logger: Logger,
	eventTypes: RuntimeEvent["type"][],
): Unsubscribe {
	const allowedTypes = new Set(eventTypes);

	return eventBus.subscribe((event: RuntimeEvent) => {
		if (!allowedTypes.has(event.type)) {
			return;
		}

		const level = getEventLevel(event.type);
		logger[level](formatEventForLog(event), event.type);
	});
}

/**
 * Create a logger subscriber for a specific run.
 *
 * Only logs events matching the given runId.
 * Useful for debugging a specific execution.
 *
 * @param eventBus - The event bus to subscribe to
 * @param logger - The Pino logger instance
 * @param runId - The run ID to filter for
 * @returns Unsubscribe function
 */
export function subscribeLoggerForRun(
	eventBus: EventBus,
	logger: Logger,
	runId: string,
): Unsubscribe {
	return eventBus.subscribe((event: RuntimeEvent) => {
		// Skip events without runId or with different runId
		if (!("runId" in event) || event.runId !== runId) {
			// Still log flow-level events (they don't have runId)
			if (!event.type.startsWith("flow:")) {
				return;
			}
		}

		const level = getEventLevel(event.type);
		logger[level](formatEventForLog(event), event.type);
	});
}
