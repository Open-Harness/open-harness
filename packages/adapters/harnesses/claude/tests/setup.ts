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

	while (true) {
		const next = await generator.next();
		if (next.done) {
			return { signals, result: next.value };
		}
		signals.push(next.value);
	}
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
