import { beforeAll, describe, expect, it } from "bun:test";
import { runTaskExecutor } from "./task-executor";

/**
 * Level 1: Basic Agent
 *
 * The simplest possible agent - prompt + runReactive.
 * This level intentionally has no fixtures to keep the example minimal.
 *
 * See Level 2 for fixture recording/replay (the recommended pattern).
 *
 * Demonstrates:
 * - Creating an agent with createHarness() factory
 * - Running an agent with runReactive()
 * - Getting text output and metrics
 *
 * v0.3.0 Migration:
 * - Uses runTaskExecutor() which wraps runReactive()
 * - State-based approach instead of direct agent.run()
 */
describe("Task Executor - Level 1", () => {
	it(
		"creates a plan for a clear task and returns metrics",
		async () => {
			const result = await runTaskExecutor("Implement a function that validates email addresses");

			// Basic output validation
			expect(result.output).toBeDefined();
			expect(typeof result.output).toBe("string");
			expect(result.output.length).toBeGreaterThan(0);

			// Should have implementation steps (numbered list)
			expect(result.output).toMatch(/1\./);

			// Metrics are always collected
			expect(result.metrics).toBeDefined();
			expect(result.metrics.latencyMs).toBeGreaterThan(0);

			// State should have the plan populated
			expect(result.state.plan).not.toBeNull();
		},
		{ timeout: 180000 },
	);

	it(
		"handles unclear tasks appropriately",
		async () => {
			const result = await runTaskExecutor("Make it better");

			// Agent produces meaningful output even for vague prompts
			expect(result.output.length).toBeGreaterThan(0);
			expect(typeof result.output).toBe("string");
		},
		{ timeout: 180000 },
	);
});
