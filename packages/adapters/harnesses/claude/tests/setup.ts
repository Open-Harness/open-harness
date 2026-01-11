/**
 * Test setup for @open-harness/claude
 */

import type { Signal } from "@internal/signals-core";

/**
 * Collect all signals from a harness run
 */
export async function collectSignals<T>(
	generator: AsyncGenerator<Signal, T>,
): Promise<{ signals: Signal[]; result: T }> {
	const signals: Signal[] = [];
	let result: T;

	let done = false;
	while (!done) {
		const next = await generator.next();
		if (next.done) {
			done = true;
			result = next.value;
		} else {
			signals.push(next.value);
		}
	}

	return { signals, result: result! };
}

/**
 * Create a test RunContext
 */
export function createTestContext(options?: { signal?: AbortSignal; runId?: string }) {
	const controller = new AbortController();
	return {
		signal: options?.signal ?? controller.signal,
		runId: options?.runId ?? `test_${Date.now()}`,
		abort: () => controller.abort(),
	};
}

/**
 * Check if we should run live tests
 */
export function isLiveTest(): boolean {
	return process.env.LIVE_SDK === "1" || process.env.LIVE_SDK === "true";
}

/**
 * Skip if not a live test
 */
export function skipIfNotLive(test: { skip: (reason: string) => void }) {
	if (!isLiveTest()) {
		test.skip("Set LIVE_SDK=1 to run live integration tests");
	}
}
