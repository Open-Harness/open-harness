/**
 * Custom Vitest matchers for Open Harness run results.
 *
 * These matchers allow asserting on performance and cost metrics
 * of agent runs in a fluent, readable way.
 *
 * @example
 * ```ts
 * import { test, expect } from 'vitest'
 * import { run, agent, setupMatchers } from '@open-harness/vitest'
 *
 * setupMatchers()
 *
 * test('agent responds quickly and cheaply', async () => {
 *   const result = await run(myAgent, { prompt: 'Hello' })
 *
 *   expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
 *   expect(result).toCostUnder(0.01)         // < $0.01
 *   expect(result).toHaveTokensUnder(1000)   // < 1000 total tokens
 * })
 * ```
 */
import type { RunResult } from "@open-harness/core";

/**
 * Custom matchers for RunResult assertions.
 */
export const matchers = {
	/**
	 * Assert that the run completed within the given latency threshold.
	 *
	 * @param received - The RunResult from running an agent/harness
	 * @param threshold - Maximum allowed latency in milliseconds
	 *
	 * @example
	 * ```ts
	 * expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
	 * ```
	 */
	toHaveLatencyUnder(received: RunResult, threshold: number) {
		const latencyMs = received.metrics.latencyMs;
		const pass = latencyMs < threshold;
		return {
			pass,
			message: () =>
				pass
					? `Expected latency >= ${threshold}ms, got ${latencyMs}ms`
					: `Expected latency < ${threshold}ms, got ${latencyMs}ms`,
		};
	},

	/**
	 * Assert that the run cost less than the given USD amount.
	 *
	 * @param received - The RunResult from running an agent/harness
	 * @param maxUsd - Maximum allowed cost in USD
	 *
	 * @example
	 * ```ts
	 * expect(result).toCostUnder(0.01)  // < $0.01
	 * ```
	 */
	toCostUnder(received: RunResult, maxUsd: number) {
		const cost = received.metrics.cost;
		const pass = cost < maxUsd;
		return {
			pass,
			message: () => (pass ? `Expected cost >= $${maxUsd}, got $${cost}` : `Expected cost < $${maxUsd}, got $${cost}`),
		};
	},

	/**
	 * Assert that the run used fewer than the given total tokens.
	 *
	 * @param received - The RunResult from running an agent/harness
	 * @param maxTokens - Maximum allowed total tokens (input + output)
	 *
	 * @example
	 * ```ts
	 * expect(result).toHaveTokensUnder(1000)  // < 1000 total tokens
	 * ```
	 */
	toHaveTokensUnder(received: RunResult, maxTokens: number) {
		const total = received.metrics.tokens.input + received.metrics.tokens.output;
		const pass = total < maxTokens;
		return {
			pass,
			message: () =>
				pass ? `Expected tokens >= ${maxTokens}, got ${total}` : `Expected tokens < ${maxTokens}, got ${total}`,
		};
	},
};

/**
 * Register Open Harness matchers with Vitest's expect.
 *
 * Call this in your setupFiles or at the start of tests:
 *
 * @example Auto-setup via vitest.config.ts:
 * ```ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@open-harness/vitest/setup'],
 *   }
 * })
 * ```
 *
 * @example Manual setup:
 * ```ts
 * import { setupMatchers } from '@open-harness/vitest'
 * setupMatchers()
 * ```
 */
export function setupMatchers(): void {
	// Vitest/bun globals provide expect.extend
	// Cast through unknown to access runtime global
	const expectGlobal = (
		globalThis as unknown as {
			expect: { extend: (matchers: Record<string, unknown>) => void };
		}
	).expect;
	expectGlobal.extend(matchers);
}
