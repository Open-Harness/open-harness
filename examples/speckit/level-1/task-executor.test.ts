import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { taskExecutor } from "./task-executor";

/**
 * Level 1: Basic Agent
 *
 * The simplest possible agent - just prompt + run.
 * This level intentionally has no fixtures to keep the example minimal.
 *
 * See Level 2 for fixture recording/replay (the recommended pattern).
 *
 * Demonstrates:
 * - Creating an agent with agent()
 * - Running an agent with run()
 * - Getting text output and metrics
 */
describe("Task Executor - Level 1", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	it(
		"creates a plan for a clear task and returns metrics",
		async () => {
			const result = await run(taskExecutor, {
				prompt: "Implement a function that validates email addresses",
			});

			// Basic output validation
			expect(result.output).toBeDefined();
			expect(typeof result.output).toBe("string");
			expect((result.output as string).length).toBeGreaterThan(0);

			// Should have implementation steps (numbered list)
			expect(result.output as string).toMatch(/1\./);

			// Metrics are always collected
			expect(result.metrics).toBeDefined();
			expect(result.metrics.latencyMs).toBeGreaterThan(0);
		},
		{ timeout: 180000 },
	);

	it(
		"handles unclear tasks appropriately",
		async () => {
			const result = await run(taskExecutor, {
				prompt: "Make it better",
			});

			const output = result.output as string;

			// Agent produces meaningful output even for vague prompts
			expect(output.length).toBeGreaterThan(0);
			expect(typeof output).toBe("string");
		},
		{ timeout: 180000 },
	);
});
