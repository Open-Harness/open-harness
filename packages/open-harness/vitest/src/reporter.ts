/**
 * Vitest reporter for Open Harness test runs.
 *
 * Tracks pass/fail rates and evaluates quality gates at the end of the run.
 * Use this to enforce pass rate thresholds in CI.
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config'
 * import { OpenHarnessReporter } from '@open-harness/vitest'
 *
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@open-harness/vitest/setup'],
 *     reporters: ['default', new OpenHarnessReporter({ passRate: 0.8 })],
 *   }
 * })
 * ```
 */
import type { File, Reporter, TaskResultPack } from "vitest";

/**
 * Configuration for Open Harness quality gates.
 */
export interface GateConfig {
	/**
	 * Minimum required pass rate (0-1).
	 * Tests with pass rate below this threshold will fail the run.
	 *
	 * @default 0.8 (80%)
	 */
	passRate?: number;

	/**
	 * Maximum allowed latency in milliseconds.
	 * Not currently enforced, reserved for future use.
	 */
	maxLatencyMs?: number;

	/**
	 * Maximum allowed cost in USD.
	 * Not currently enforced, reserved for future use.
	 */
	maxCostUsd?: number;
}

/**
 * Vitest reporter that tracks pass/fail rates and enforces quality gates.
 *
 * This reporter:
 * 1. Tracks pass/fail counts during test execution
 * 2. Outputs a summary at the end of the run
 * 3. Sets process.exitCode = 1 if pass rate is below threshold
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     reporters: ['default', new OpenHarnessReporter({ passRate: 0.9 })],
 *   }
 * })
 * ```
 */
export class OpenHarnessReporter implements Reporter {
	private passed = 0;
	private failed = 0;
	private config: Required<Pick<GateConfig, "passRate">> & GateConfig;

	constructor(config: GateConfig = {}) {
		this.config = { passRate: 0.8, ...config };
	}

	/**
	 * Called when task results are updated during test execution.
	 * Tracks pass/fail counts.
	 */
	onTaskUpdate(packs: TaskResultPack[]): void {
		for (const pack of packs) {
			const result = pack[1];
			if (result?.state === "pass") this.passed++;
			if (result?.state === "fail") this.failed++;
		}
	}

	/**
	 * Called when all tests have finished.
	 * Outputs summary and evaluates quality gates.
	 */
	onFinished(_files?: File[]): void {
		const total = this.passed + this.failed;
		if (total === 0) return;

		const passRate = this.passed / total;

		console.log("\n------------------------------------");
		console.log(`Open Harness: ${this.passed}/${total} passed (${(passRate * 100).toFixed(1)}%)`);

		if (passRate < this.config.passRate) {
			console.error(
				`GATE FAILED: pass rate ${(passRate * 100).toFixed(1)}% < ${(this.config.passRate * 100).toFixed(1)}%`,
			);
			process.exitCode = 1;
			return;
		}

		console.log("All gates passed");
		console.log("------------------------------------\n");
	}
}
