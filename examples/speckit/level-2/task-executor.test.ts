import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@open-harness/core";
import { runTaskExecutor } from "./task-executor";

/**
 * Level 2: Harness with State + Signal Recording
 *
 * This level introduces TWO core concepts:
 *
 * 1. HARNESS-LEVEL STATE
 *    State lives on the harness, not agents. Even for single-agent workflows,
 *    wrap the agent in a harness when you need state tracking.
 *
 * 2. SIGNAL RECORDING (v0.3.0)
 *    Recording agent signals is a CORE feature, not an advanced one.
 *    It enables:
 *    - Fast CI (no LLM calls)
 *    - Deterministic tests (same input -> same output)
 *    - Cost control (record once, replay forever)
 *    - Debugging (inspect signal flow)
 *
 * Recording Modes:
 * - "replay": Load saved signals. Fails if recording missing.
 * - "record": Execute live, save signals to store.
 *
 * v0.3.0 Migration:
 * - Uses MemorySignalStore instead of FileRecordingStore
 * - Uses recording: { mode, store, name } in runReactive
 * - Signal-based recording captures full execution trace
 */

// Shared store for recording/replay
const store = new MemorySignalStore();

// Get recording mode from environment
const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

describe("Task Executor - Level 2 (Harness with State + Recording)", () => {
	it(
		"harness returns output and state",
		async () => {
			const result = await runTaskExecutor("Add a login button", {
				fixture: "task-executor-login",
				mode: getMode(),
				store,
			});

			// Output should be defined
			expect(result.output).toBeDefined();
			expect(typeof result.output).toBe("string");

			// State includes the prompt we passed in
			expect(result.state.prompt).toBe("Add a login button");

			// Plan should be populated
			expect(result.state.plan).not.toBeNull();

			// Metrics available
			expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);
		},
		{ timeout: 180000 },
	);

	it(
		"recordings enable deterministic testing",
		async () => {
			// Same fixture name = same recorded response
			const result1 = await runTaskExecutor("Create a dashboard widget", {
				fixture: "task-executor-dashboard",
				mode: getMode(),
				store,
			});

			const result2 = await runTaskExecutor("Create a dashboard widget", {
				fixture: "task-executor-dashboard",
				mode: getMode(),
				store,
			});

			// In replay mode, outputs are identical (same recording)
			if (getMode() === "replay") {
				expect(result1.output).toEqual(result2.output);
			}
		},
		{ timeout: 180000 },
	);
});

/**
 * Signal Recording Workflow (v0.3.0)
 * ===================================
 *
 * RECORDING NEW FIXTURES
 * ----------------------
 * When you add new tests or change prompts:
 *
 *   FIXTURE_MODE=record bun test
 *
 * This executes live and saves signals to the store.
 *
 *
 * REPLAYING FIXTURES (DEFAULT)
 * ----------------------------
 * Normal test runs use recorded signals:
 *
 *   bun test
 *
 * This is fast (~milliseconds) and free (no API calls).
 *
 *
 * SIGNAL INSPECTION
 * -----------------
 * Use the Player API to inspect recorded signals:
 *
 *   const player = new Player(recording);
 *   player.step();  // Step through signals
 *   player.snapshot; // Get state at current position
 *
 *
 * CI INTEGRATION
 * --------------
 * For CI with persistent recordings, use FileSignalStore or SqliteSignalStore:
 *
 *   import { FileSignalStore } from "@open-harness/stores";
 *   const store = new FileSignalStore({ directory: "./fixtures" });
 */
