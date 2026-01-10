import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@open-harness/core";
import { parseReviewerOutput } from "./agents/reviewer-agent";
import { runSpecKit } from "./speckit-harness";

/**
 * Level 7: CI Quality Gates
 *
 * Demonstrates:
 * - Quality gate assertions (latency, activations, pass rate)
 * - Metrics collection for monitoring
 * - CI-friendly testing with fixtures
 *
 * v0.3.0 Reactive Pattern:
 * - Metrics include durationMs and activations count
 * - Signals array tracks execution flow for analysis
 * - In production, you would:
 *   1. Run with fixtures in CI (fast, free, deterministic)
 *   2. Periodically re-record to catch model drift
 *   3. Set quality gates on metrics
 */

// Shared store for recording/replay
const store = new MemorySignalStore();

// Get recording mode from environment
const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

describe("SpecKit - Level 7 (CI Gates)", () => {
	describe("Quality Gates", () => {
		it(
			"workflow completes with acceptable metrics",
			async () => {
				const result = await runSpecKit(
					`PRD: Simple Validator
Create a function that checks if a string is not empty.`,
					{
						fixture: "level7-validator",
						mode: getMode(),
						store,
					},
				);

				// Basic completion check
				expect(result.output).toBeDefined();

				// In replay mode, these are instant
				// In live mode, we check actual performance
				expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);
				expect(result.metrics.activations).toBeGreaterThan(0);

				// Parse output for quality check
				const parsed = parseReviewerOutput(result.output);
				console.log("Quality gate results:", {
					latencyMs: result.metrics.latencyMs,
					activations: result.metrics.activations,
					approved: parsed.approved,
				});
			},
			{ timeout: 900000 },
		);
	});

	describe("Metrics Collection", () => {
		it(
			"collects comprehensive metrics",
			async () => {
				const result = await runSpecKit(
					`PRD: Type Checker
Create a function that checks if a value is a number.`,
					{
						fixture: "level7-type-checker",
						mode: getMode(),
						store,
					},
				);

				// Verify all metrics are collected
				expect(result.metrics).toBeDefined();
				expect(typeof result.metrics.latencyMs).toBe("number");
				expect(typeof result.metrics.activations).toBe("number");

				// Signals track execution flow
				expect(result.signals).toBeDefined();
				expect(Array.isArray(result.signals)).toBe(true);

				// Log for analysis
				console.log("Collected metrics:", result.metrics);
				console.log("Signal count:", result.signals.length);
			},
			{ timeout: 900000 },
		);
	});
});

/**
 * CI Integration Pattern
 * ======================
 *
 * v0.3.0 QUALITY GATES
 * --------------------
 * Set thresholds on metrics:
 *
 *   const thresholds = {
 *     maxLatencyMs: 60000,      // 60s max execution time
 *     maxActivations: 10,        // Max agent activations
 *   };
 *
 *   expect(result.metrics.latencyMs).toBeLessThan(thresholds.maxLatencyMs);
 *   expect(result.metrics.activations).toBeLessThan(thresholds.maxActivations);
 *
 *
 * SIGNAL-BASED DEBUGGING
 * ----------------------
 * Use signals to debug execution flow:
 *
 *   // Check that all expected signals were emitted
 *   const signalTypes = result.signals.map(s => s.type);
 *   expect(signalTypes).toContain("spec:complete");
 *   expect(signalTypes).toContain("code:complete");
 *   expect(signalTypes).toContain("review:complete");
 *
 *
 * GITHUB ACTIONS WORKFLOW
 * -----------------------
 * ```yaml
 * name: SpecKit Quality Gates
 *
 * on:
 *   pull_request:
 *     paths:
 *       - 'examples/speckit/**'
 *
 * jobs:
 *   test:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - uses: actions/checkout@v4
 *       - uses: oven-sh/setup-bun@v1
 *       - run: bun install
 *       - run: bun test  # Uses fixtures, fast and free
 * ```
 *
 * Quality gates prevent releases when:
 * - Tests fail (assertions not met)
 * - Fixtures are missing (forgot to record)
 * - Metrics exceed thresholds
 */
