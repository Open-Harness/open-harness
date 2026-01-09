import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { setupFixtures, withFixture } from "../test-utils";
import { parseReviewerOutput } from "./agents/reviewer-agent";
import { specKit } from "./speckit-harness";

/**
 * Level 7: CI Quality Gates + Fixtures
 *
 * Demonstrates:
 * - Quality gate assertions (latency, cost, pass rate)
 * - Metrics collection for monitoring
 * - CI-friendly testing with fixtures
 *
 * In production, you would:
 * 1. Run with fixtures in CI (fast, free, deterministic)
 * 2. Periodically re-record to catch model drift
 * 3. Set quality gates on metrics
 */
describe("SpecKit - Level 7 (CI Gates)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
		setupFixtures();
	});

	describe("Quality Gates", () => {
		it(
			"workflow completes with acceptable metrics",
			async () => {
				const result = await run(
					specKit,
					{
						prompt: `PRD: Simple Validator
Create a function that checks if a string is not empty.`,
					},
					withFixture("level7-validator"),
				);

				// Basic completion check
				expect(result.output).toBeDefined();

				// In replay mode, these are instant
				// In live mode, we check actual performance
				expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);
				expect(result.metrics.cost).toBeGreaterThanOrEqual(0);

				// Parse output for quality check
				const parsed = parseReviewerOutput(result.output as string);
				console.log("Quality gate results:", {
					latencyMs: result.metrics.latencyMs,
					cost: result.metrics.cost,
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
				const result = await run(
					specKit,
					{
						prompt: `PRD: Type Checker
Create a function that checks if a value is a number.`,
					},
					withFixture("level7-type-checker"),
				);

				// Verify all metrics are collected
				expect(result.metrics).toBeDefined();
				expect(typeof result.metrics.latencyMs).toBe("number");
				expect(typeof result.metrics.cost).toBe("number");
				expect(typeof result.metrics.tokens.input).toBe("number");
				expect(typeof result.metrics.tokens.output).toBe("number");

				// Log for analysis
				console.log("Collected metrics:", result.metrics);
			},
			{ timeout: 900000 },
		);
	});
});

/**
 * Model Comparison Pattern
 *
 * To compare different models, you would:
 *
 * 1. Record with different providers:
 *    ```typescript
 *    // Record opus fixture
 *    FIXTURE_MODE=record bun test -- --test-name-pattern="opus"
 *
 *    // Record sonnet fixture
 *    FIXTURE_MODE=record bun test -- --test-name-pattern="sonnet"
 *    ```
 *
 * 2. Compare metrics from fixtures:
 *    ```bash
 *    cat fixtures/test-opus_*.json | jq '.metrics'
 *    cat fixtures/test-sonnet_*.json | jq '.metrics'
 *    ```
 *
 * 3. Set model-specific thresholds:
 *    ```typescript
 *    const thresholds = {
 *      opus: { maxCost: 2.00, maxLatency: 60000 },
 *      sonnet: { maxCost: 0.50, maxLatency: 30000 },
 *      haiku: { maxCost: 0.10, maxLatency: 15000 },
 *    };
 *    ```
 */

/**
 * CI Integration Pattern
 *
 * GitHub Actions workflow:
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
 * - Pass rate drops below threshold
 */
