import type { RuntimeEvent } from "../../core/events.js";

/**
 * Create a sample runtime event for testing.
 */
export function sampleRuntimeEvent(
	type: RuntimeEvent["type"],
	overrides?: Partial<RuntimeEvent>,
): RuntimeEvent {
	const base: RuntimeEvent = {
		type,
		timestamp: Date.now(),
		...overrides,
	} as RuntimeEvent;

	return base;
}
