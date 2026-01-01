/**
 * Event Filter Matching Utilities
 *
 * Provides pattern matching for event subscription filters.
 * Supports wildcards ('*'), prefix patterns ('task:*'), and exact matches.
 *
 * @module core/unified-events/filter
 */

import type { EventFilter } from "./types.js";

/**
 * Check if event type matches a filter pattern.
 *
 * Matching rules:
 * - '*' matches all event types
 * - 'prefix:*' matches any event type starting with 'prefix:'
 * - Exact string matches only that specific event type
 * - Array of patterns: returns true if ANY pattern matches
 *
 * @param eventType - Event type string (e.g., "task:start", "agent:tool:complete")
 * @param filter - Filter pattern(s) to match against
 * @returns True if the event type matches any pattern in the filter
 *
 * @example
 * ```typescript
 * matchesFilter('task:start', '*')           // true - wildcard matches all
 * matchesFilter('task:start', 'task:*')      // true - prefix match
 * matchesFilter('task:start', 'phase:*')     // false - different prefix
 * matchesFilter('narrative', 'narrative')    // true - exact match
 * matchesFilter('agent:tool:start', ['task:*', 'agent:*']) // true - array match
 * ```
 */
export function matchesFilter(eventType: string, filter: EventFilter): boolean {
	// Normalize filter to array for uniform processing
	const patterns = Array.isArray(filter) ? filter : [filter];

	return patterns.some((pattern) => {
		// Wildcard matches all
		if (pattern === "*") return true;

		// Prefix match (e.g., "task:*" matches "task:start")
		if (pattern.endsWith("*")) {
			const prefix = pattern.slice(0, -1);
			return eventType.startsWith(prefix);
		}

		// Exact match
		return eventType === pattern;
	});
}
