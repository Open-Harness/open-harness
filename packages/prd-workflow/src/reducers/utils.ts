/**
 * Utility functions for reducers.
 */

import { createSignal as createSignalCore } from "@internal/signals-core";

/**
 * Create a signal with standard structure.
 * Re-exports the createSignal from signals-core for consistency.
 */
export function createSignal(
	name: string,
	payload: Record<string, unknown>,
	source?: { reducer?: string; parent?: string },
) {
	return createSignalCore(name, payload, source);
}
