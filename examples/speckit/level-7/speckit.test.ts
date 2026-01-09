import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { parseReviewerOutput } from "./agents/reviewer-agent";
import { specKit } from "./speckit-harness";

/**
 * Level 7 Tests: Model Comparison + CI Gates
 *
 * Demonstrates:
 * - Basic workflow execution (foundation for comparison)
 * - Metrics collection for quality gates
 * - CI-friendly assertions
 *
 * In production, you would:
 * 1. Run with different model variants
 * 2. Compare cost, latency, and quality
 * 3. Set quality gates for CI
 */

describe("SpecKit - Level 7 (CI Gates)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	describe("Quality Gates", () => {
		it(
			"workflow completes with acceptable metrics",
			async () => {
				const result = await run(specKit, {
					prompt: `PRD: Simple Validator
Create a function that checks if a string is not empty.`,
				});

				// Basic completion check
				expect(result.output).toBeDefined();

				// Latency gate: should complete in reasonable time
				// Note: Claude Code SDK has high overhead, so we're lenient
				expect(result.metrics.latencyMs).toBeLessThan(300000); // 5 min max

				// Cost gate: should not exceed budget
				expect(result.metrics.cost).toBeLessThan(1.0); // $1 max

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
				const result = await run(specKit, {
					prompt: `PRD: Type Checker
Create a function that checks if a value is a number.`,
				});

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
 * 1. Run the same input with different providers:
 *    ```typescript
 *    const opusResult = await run(specKit, input, {
 *      provider: createClaudeNode({ model: 'claude-opus-4-5-20251101' })
 *    });
 *    const sonnetResult = await run(specKit, input, {
 *      provider: createClaudeNode({ model: 'claude-sonnet-4-20250514' })
 *    });
 *    ```
 *
 * 2. Compare metrics:
 *    - Cost: Haiku < Sonnet < Opus
 *    - Latency: Haiku < Sonnet < Opus
 *    - Quality: Opus >= Sonnet >= Haiku (for complex tasks)
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
 *       - run: FIXTURE_MODE=replay bun test examples/speckit/level-7/
 * ```
 *
 * Quality gates prevent releases when:
 * - Latency exceeds threshold
 * - Cost exceeds budget
 * - Pass rate drops below 95%
 */
