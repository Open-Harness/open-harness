import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { initialState, taskExecutor } from "./task-executor";

/**
 * Level 2 Tests: Task Executor with State
 *
 * Demonstrates that agents can have state defined in their config,
 * which is returned with each run result.
 *
 * Note: Claude Code SDK tests can take 2-3 minutes due to subprocess overhead.
 * In production, use fixtures (Level 6) for fast CI runs.
 */
describe("Task Executor - Level 2 (State)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	it(
		"agent with state returns output and state",
		async () => {
			const result = await run(taskExecutor, {
				prompt: "Add a login button",
			});

			// Output should be defined
			expect(result.output).toBeDefined();
			expect(typeof result.output).toBe("string");

			// State should match initial state from agent config
			expect(result.state).toEqual(initialState);

			// Metrics tracked (latency from SDK)
			expect(result.metrics.latencyMs).toBeGreaterThan(0);
		},
		{ timeout: 180000 }, // 3 min timeout for Claude Code SDK
	);
});
