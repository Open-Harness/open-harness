import { beforeAll, describe, expect, it } from "bun:test";
import { run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { setupFixtures, withFixture } from "../test-utils";
import { initialState, taskExecutor } from "./task-executor";

/**
 * Level 2: Agent with State + Fixtures
 *
 * This level introduces TWO core concepts:
 *
 * 1. AGENT STATE
 *    Agents can have state defined in their config, returned with each result.
 *
 * 2. FIXTURE RECORDING (the important one!)
 *    Recording agent responses is a CORE feature, not an advanced one.
 *    It enables:
 *    - Fast CI (no LLM calls)
 *    - Deterministic tests (same input -> same output)
 *    - Cost control (record once, replay forever)
 *    - Benchmarking (compare model versions)
 *
 * Fixture Modes:
 * - "replay" (default): Load saved responses. Fails if fixture missing.
 * - "record": Execute live, save responses to fixture store.
 * - "live": Execute live, don't save anything.
 *
 * Workflow:
 * 1. First run: `bun test:record` to capture fixtures
 * 2. Commit fixtures/ to git
 * 3. CI runs: `bun test` (defaults to replay)
 * 4. Update fixtures: Delete + re-record when prompts change
 */
describe("Task Executor - Level 2 (State + Fixtures)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode());
		setupFixtures(); // Sets default store + replay mode
	});

	it(
		"agent with state returns output and state",
		async () => {
			// withFixture() provides fixture name + store
			// Mode comes from setupFixtures() or FIXTURE_MODE env var
			const result = await run(
				taskExecutor,
				{ prompt: "Add a login button" },
				withFixture("task-executor-login"),
			);

			// Output should be defined
			expect(result.output).toBeDefined();
			expect(typeof result.output).toBe("string");

			// State should match initial state from agent config
			expect(result.state).toEqual(initialState);

			// In replay mode, latency is ~0 (instant fixture load)
			// In record/live mode, latency reflects actual API call
			expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);
		},
		{ timeout: 180000 }, // 3 min timeout for live/record mode
	);

	it(
		"fixtures enable deterministic testing",
		async () => {
			// Same fixture name = same recorded response
			// This is powerful for assertions that depend on exact output
			const result1 = await run(
				taskExecutor,
				{ prompt: "Create a dashboard widget" },
				withFixture("task-executor-dashboard"),
			);

			const result2 = await run(
				taskExecutor,
				{ prompt: "Create a dashboard widget" },
				withFixture("task-executor-dashboard"),
			);

			// In replay mode, outputs are identical (same fixture)
			// This enables reliable snapshot testing
			if (process.env.FIXTURE_MODE !== "record") {
				expect(result1.output).toEqual(result2.output);
			}
		},
		{ timeout: 180000 },
	);
});

/**
 * Fixture Workflow Documentation
 * ==============================
 *
 * RECORDING NEW FIXTURES
 * ----------------------
 * When you add new tests or change prompts:
 *
 *   bun test:record
 *
 * This executes live and saves responses to fixtures/ directory.
 *
 *
 * REPLAYING FIXTURES (DEFAULT)
 * ----------------------------
 * Normal test runs use recorded fixtures:
 *
 *   bun test
 *
 * This is fast (~seconds) and free (no API calls).
 *
 *
 * FORCING LIVE EXECUTION
 * ----------------------
 * To bypass fixtures entirely:
 *
 *   bun test:live
 *
 * Useful for one-off testing or when debugging prompts.
 *
 *
 * CI INTEGRATION
 * --------------
 * In your CI pipeline:
 *
 *   bun test  # Uses fixtures, fast and free
 *
 * The fixtures/ directory should be committed to git.
 */
