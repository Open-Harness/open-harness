import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { agent } from "../../src/api/agent.js";
import { harness } from "../../src/api/harness.js";
import { run, generateFixtureId } from "../../src/api/run.js";
import type { FixtureStore } from "../../src/api/types.js";
import type { Recording, RecordingMetadata } from "../../src/recording/types.js";
import type { RecordingListQuery } from "../../src/recording/store.js";

/**
 * Mock fixture store for testing.
 */
class MockFixtureStore implements FixtureStore {
	private recordings = new Map<string, Recording<unknown>>();

	async save<T>(recording: Recording<T>): Promise<void> {
		this.recordings.set(recording.id, recording as Recording<unknown>);
	}

	async load<T>(id: string): Promise<Recording<T> | null> {
		return (this.recordings.get(id) as Recording<T>) ?? null;
	}

	async list(_query?: RecordingListQuery): Promise<RecordingMetadata[]> {
		return Array.from(this.recordings.values()).map((r) => r.metadata);
	}

	// Test helper
	getRecordingIds(): string[] {
		return Array.from(this.recordings.keys());
	}
}

describe("api/run", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.FIXTURE_MODE;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.FIXTURE_MODE;
		} else {
			process.env.FIXTURE_MODE = originalEnv;
		}
	});

	describe("run() with agent", () => {
		it("should execute an agent and return RunResult shape", async () => {
			const myAgent = agent({ prompt: "You are helpful." });

			const result = await run(myAgent, { prompt: "Hello!" });

			// Verify RunResult shape
			expect(result).toHaveProperty("output");
			expect(result).toHaveProperty("metrics");
			expect(result.metrics).toHaveProperty("latencyMs");
			expect(result.metrics).toHaveProperty("cost");
			expect(result.metrics).toHaveProperty("tokens");
			expect(result.metrics.tokens).toHaveProperty("input");
			expect(result.metrics.tokens).toHaveProperty("output");
		});

		it("should preserve agent state in result", async () => {
			const myAgent = agent({
				prompt: "Stateful agent",
				state: { counter: 0, history: [] },
			});

			const result = await run(myAgent, { prompt: "Test" });

			expect(result.state).toEqual({ counter: 0, history: [] });
		});

		it("should return undefined state for stateless agent", async () => {
			const myAgent = agent({ prompt: "Stateless agent" });

			const result = await run(myAgent, { prompt: "Test" });

			expect(result.state).toBeUndefined();
		});
	});

	describe("run() with harness", () => {
		it("should execute a harness and return RunResult shape", async () => {
			const workflow = harness({
				agents: {
					coder: agent({ prompt: "You code." }),
					reviewer: agent({ prompt: "You review." }),
				},
				edges: [{ from: "coder", to: "reviewer" }],
			});

			const result = await run(workflow, { task: "Build something" });

			expect(result).toHaveProperty("output");
			expect(result).toHaveProperty("metrics");
			expect(result.metrics).toHaveProperty("latencyMs");
		});

		it("should preserve harness state in result", async () => {
			const workflow = harness({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
				state: { iteration: 0, maxIterations: 5 },
			});

			const result = await run(workflow, { input: "test" });

			expect(result.state).toEqual({ iteration: 0, maxIterations: 5 });
		});
	});

	describe("fixture handling", () => {
		it("should include fixture IDs when recording agent", async () => {
			const myAgent = agent({ prompt: "Test agent" });
			const store = new MockFixtureStore();

			const result = await run(myAgent, { prompt: "Hello" }, {
				fixture: "my-test",
				mode: "record",
				store,
			});

			expect(result.fixtures).toBeDefined();
			expect(result.fixtures).toContain("my-test/agent/inv0");
		});

		it("should include fixture IDs for all agents when recording harness", async () => {
			const workflow = harness({
				agents: {
					alpha: agent({ prompt: "Alpha" }),
					beta: agent({ prompt: "Beta" }),
				},
				edges: [{ from: "alpha", to: "beta" }],
			});
			const store = new MockFixtureStore();

			const result = await run(workflow, { task: "Test" }, {
				fixture: "workflow-test",
				mode: "record",
				store,
			});

			expect(result.fixtures).toBeDefined();
			expect(result.fixtures).toContain("workflow-test/alpha/inv0");
			expect(result.fixtures).toContain("workflow-test/beta/inv0");
		});

		it("should not include fixtures when mode is live", async () => {
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(myAgent, { prompt: "Hello" }, {
				fixture: "my-test",
				mode: "live",
				store,
			});

			expect(result.fixtures).toBeUndefined();
		});

		it("should throw error when fixture specified without store in record mode", async () => {
			const myAgent = agent({ prompt: "Test" });

			await expect(
				run(myAgent, { prompt: "Hello" }, {
					fixture: "my-test",
					mode: "record",
				}),
			).rejects.toThrow("Store is required");
		});

		it("should throw error when fixture specified without store in replay mode", async () => {
			const myAgent = agent({ prompt: "Test" });

			await expect(
				run(myAgent, { prompt: "Hello" }, {
					fixture: "my-test",
					mode: "replay",
				}),
			).rejects.toThrow("Store is required");
		});
	});

	describe("FIXTURE_MODE env var", () => {
		it("should use FIXTURE_MODE=record from env when no explicit mode", async () => {
			process.env.FIXTURE_MODE = "record";
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(myAgent, { prompt: "Hello" }, {
				fixture: "env-test",
				store,
			});

			// Should have fixtures because env says "record"
			expect(result.fixtures).toBeDefined();
			expect(result.fixtures).toContain("env-test/agent/inv0");
		});

		it("should prefer explicit mode over FIXTURE_MODE env", async () => {
			process.env.FIXTURE_MODE = "record";
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(myAgent, { prompt: "Hello" }, {
				fixture: "env-test",
				mode: "live",
				store,
			});

			// Should NOT have fixtures because explicit mode is "live"
			expect(result.fixtures).toBeUndefined();
		});

		it("should default to live mode when FIXTURE_MODE not set", async () => {
			delete process.env.FIXTURE_MODE;
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(myAgent, { prompt: "Hello" }, {
				fixture: "env-test",
				store,
			});

			// Should NOT have fixtures because default is "live"
			expect(result.fixtures).toBeUndefined();
		});
	});

	describe("generateFixtureId", () => {
		it("should generate hierarchical fixture ID", () => {
			const id = generateFixtureId("my-test", "coder", 0);
			expect(id).toBe("my-test/coder/inv0");
		});

		it("should handle different invocation numbers", () => {
			expect(generateFixtureId("test", "agent", 0)).toBe("test/agent/inv0");
			expect(generateFixtureId("test", "agent", 1)).toBe("test/agent/inv1");
			expect(generateFixtureId("test", "agent", 42)).toBe("test/agent/inv42");
		});

		it("should handle complex fixture names", () => {
			const id = generateFixtureId("integration/code-review", "reviewer", 0);
			expect(id).toBe("integration/code-review/reviewer/inv0");
		});
	});

	describe("type dispatch", () => {
		it("should throw error for invalid target", async () => {
			const invalidTarget = { _tag: "Invalid" };

			await expect(
				run(invalidTarget as any, { prompt: "Hello" }),
			).rejects.toThrow("Target must be an Agent or Harness");
		});
	});

	describe("metrics", () => {
		it("should include latency in metrics", async () => {
			const myAgent = agent({ prompt: "Test" });

			const result = await run(myAgent, { prompt: "Hello" });

			expect(typeof result.metrics.latencyMs).toBe("number");
			expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);
		});

		it("should include cost in metrics", async () => {
			const myAgent = agent({ prompt: "Test" });

			const result = await run(myAgent, { prompt: "Hello" });

			expect(typeof result.metrics.cost).toBe("number");
		});

		it("should include token counts in metrics", async () => {
			const myAgent = agent({ prompt: "Test" });

			const result = await run(myAgent, { prompt: "Hello" });

			expect(typeof result.metrics.tokens.input).toBe("number");
			expect(typeof result.metrics.tokens.output).toBe("number");
		});
	});
});
