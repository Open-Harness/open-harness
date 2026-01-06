import type { RuntimeEvent } from "@internal/state";

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
