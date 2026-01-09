import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { agent } from "../../src/api/agent.js";
import { harness } from "../../src/api/harness.js";
import { run, generateFixtureId } from "../../src/api/run.js";
import { setDefaultProvider, resetDefaults } from "../../src/api/defaults.js";
import type { FixtureStore, Provider, AgentInput, AgentOutput } from "../../src/api/types.js";
import type { Recording, RecordingMetadata } from "../../src/recording/types.js";
import type { RecordingListQuery } from "../../src/recording/store.js";
import type { NodeRunContext } from "../../src/nodes/registry.js";

/**
 * Mock provider for testing.
 * Returns deterministic output based on input.
 */
function createMockProvider(options?: {
	responseText?: string;
	responseTime?: number;
	cost?: number;
	inputTokens?: number;
	outputTokens?: number;
}): Provider<AgentInput, AgentOutput> {
	const responseText = options?.responseText ?? "Hello! I'm a mock provider response.";
	const responseTime = options?.responseTime ?? 100;
	const cost = options?.cost ?? 0.001;
	const inputTokens = options?.inputTokens ?? 10;
	const outputTokens = options?.outputTokens ?? 20;

	return {
		type: "mock.provider",
		run: async (_ctx: NodeRunContext, _input: AgentInput): Promise<AgentOutput> => {
			// Simulate some async work
			await new Promise((resolve) => setTimeout(resolve, responseTime));

			return {
				text: responseText,
				usage: { inputTokens, outputTokens },
				totalCostUsd: cost,
				durationMs: responseTime,
			};
		},
	};
}

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
	const mockProvider = createMockProvider();

	beforeEach(() => {
		originalEnv = process.env.FIXTURE_MODE;
		// Set up default provider for all tests
		setDefaultProvider(mockProvider);
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.FIXTURE_MODE;
		} else {
			process.env.FIXTURE_MODE = originalEnv;
		}
		// Reset defaults after each test
		resetDefaults();
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

		it("should return actual output from provider", async () => {
			const customProvider = createMockProvider({
				responseText: "Custom response from mock",
			});
			const myAgent = agent({ prompt: "You are helpful." });

			const result = await run(myAgent, { prompt: "Hello!" }, { provider: customProvider });

			// Verify real output, not undefined
			expect(result.output).toBe("Custom response from mock");
		});

		it("should return real metrics from provider", async () => {
			const customProvider = createMockProvider({
				cost: 0.005,
				inputTokens: 50,
				outputTokens: 100,
				responseTime: 150,
			});
			const myAgent = agent({ prompt: "Test agent" });

			const result = await run(myAgent, { prompt: "Hello!" }, { provider: customProvider });

			expect(result.metrics.cost).toBe(0.005);
			expect(result.metrics.tokens.input).toBe(50);
			expect(result.metrics.tokens.output).toBe(100);
			expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(150);
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

		it("should throw error when no provider configured", async () => {
			resetDefaults(); // Clear the default provider
			const myAgent = agent({ prompt: "Test" });

			await expect(run(myAgent, { prompt: "Hello!" })).rejects.toThrow(
				"No provider configured",
			);
		});

		it("should use provider from options over default", async () => {
			const optionsProvider = createMockProvider({
				responseText: "From options provider",
			});
			const myAgent = agent({ prompt: "Test" });

			const result = await run(myAgent, { prompt: "Hello!" }, { provider: optionsProvider });

			expect(result.output).toBe("From options provider");
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

			// Harness state comes from runtime snapshot
			expect(result.state).toBeDefined();
		});
	});

	describe("fixture handling", () => {
		it("should include fixture IDs when recording agent", async () => {
			const myAgent = agent({ prompt: "Test agent" });
			const store = new MockFixtureStore();

			const result = await run(
				myAgent,
				{ prompt: "Hello" },
				{
					fixture: "my-test",
					mode: "record",
					store,
				},
			);

			expect(result.fixtures).toBeDefined();
			expect(result.fixtures).toContain("my-test_agent_inv0");
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

			const result = await run(
				workflow,
				{ task: "Test" },
				{
					fixture: "workflow-test",
					mode: "record",
					store,
				},
			);

			expect(result.fixtures).toBeDefined();
			expect(result.fixtures).toContain("workflow-test_harness_inv0");
		});

		it("should not include fixtures when mode is live", async () => {
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(
				myAgent,
				{ prompt: "Hello" },
				{
					fixture: "my-test",
					mode: "live",
					store,
				},
			);

			expect(result.fixtures).toBeUndefined();
		});

		it("should throw error when fixture specified without store in record mode", async () => {
			const myAgent = agent({ prompt: "Test" });

			await expect(
				run(
					myAgent,
					{ prompt: "Hello" },
					{
						fixture: "my-test",
						mode: "record",
					},
				),
			).rejects.toThrow("Store is required");
		});

		it("should throw error when fixture specified without store in replay mode", async () => {
			const myAgent = agent({ prompt: "Test" });

			await expect(
				run(
					myAgent,
					{ prompt: "Hello" },
					{
						fixture: "my-test",
						mode: "replay",
					},
				),
			).rejects.toThrow("Store is required");
		});
	});

	describe("FIXTURE_MODE env var", () => {
		it("should use FIXTURE_MODE=record from env when no explicit mode", async () => {
			process.env.FIXTURE_MODE = "record";
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(
				myAgent,
				{ prompt: "Hello" },
				{
					fixture: "env-test",
					store,
				},
			);

			// Should have fixtures because env says "record"
			expect(result.fixtures).toBeDefined();
			expect(result.fixtures).toContain("env-test_agent_inv0");
		});

		it("should prefer explicit mode over FIXTURE_MODE env", async () => {
			process.env.FIXTURE_MODE = "record";
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(
				myAgent,
				{ prompt: "Hello" },
				{
					fixture: "env-test",
					mode: "live",
					store,
				},
			);

			// Should NOT have fixtures because explicit mode is "live"
			expect(result.fixtures).toBeUndefined();
		});

		it("should default to live mode when FIXTURE_MODE not set", async () => {
			delete process.env.FIXTURE_MODE;
			const myAgent = agent({ prompt: "Test" });
			const store = new MockFixtureStore();

			const result = await run(
				myAgent,
				{ prompt: "Hello" },
				{
					fixture: "env-test",
					store,
				},
			);

			// Should NOT have fixtures because default is "live"
			expect(result.fixtures).toBeUndefined();
		});
	});

	describe("generateFixtureId", () => {
		it("should generate flat fixture ID with underscores", () => {
			const id = generateFixtureId("my-test", "coder", 0);
			expect(id).toBe("my-test_coder_inv0");
		});

		it("should handle different invocation numbers", () => {
			expect(generateFixtureId("test", "agent", 0)).toBe("test_agent_inv0");
			expect(generateFixtureId("test", "agent", 1)).toBe("test_agent_inv1");
			expect(generateFixtureId("test", "agent", 42)).toBe("test_agent_inv42");
		});

		it("should handle complex fixture names", () => {
			const id = generateFixtureId("integration-code-review", "reviewer", 0);
			expect(id).toBe("integration-code-review_reviewer_inv0");
		});
	});

	describe("type dispatch", () => {
		it("should throw error for invalid target", async () => {
			const invalidTarget = { _tag: "Invalid" };

			await expect(run(invalidTarget as Parameters<typeof run>[0], { prompt: "Hello" })).rejects.toThrow(
				"Target must be an Agent or Harness",
			);
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
			// With mock provider, should have non-zero cost
			expect(result.metrics.cost).toBeGreaterThan(0);
		});

		it("should include token counts in metrics", async () => {
			const myAgent = agent({ prompt: "Test" });

			const result = await run(myAgent, { prompt: "Hello" });

			expect(typeof result.metrics.tokens.input).toBe("number");
			expect(typeof result.metrics.tokens.output).toBe("number");
			// With mock provider, should have non-zero tokens
			expect(result.metrics.tokens.input).toBeGreaterThan(0);
			expect(result.metrics.tokens.output).toBeGreaterThan(0);
		});
	});

	describe("behavior verification", () => {
		it("should actually execute the provider", async () => {
			let providerCalled = false;
			const trackingProvider: Provider<AgentInput, AgentOutput> = {
				type: "tracking.provider",
				run: async () => {
					providerCalled = true;
					return {
						text: "Provider was called",
						usage: { inputTokens: 1, outputTokens: 1 },
						totalCostUsd: 0,
						durationMs: 1,
					};
				},
			};

			const myAgent = agent({ prompt: "Test" });
			await run(myAgent, { prompt: "Hello" }, { provider: trackingProvider });

			expect(providerCalled).toBe(true);
		});

		it("should pass correct input to provider", async () => {
			let receivedInput: AgentInput | undefined;
			const capturingProvider: Provider<AgentInput, AgentOutput> = {
				type: "capturing.provider",
				run: async (_ctx, input) => {
					receivedInput = input;
					return {
						text: "Captured",
						usage: { inputTokens: 1, outputTokens: 1 },
						totalCostUsd: 0,
						durationMs: 1,
					};
				},
			};

			const myAgent = agent({ prompt: "System prompt here" });
			await run(myAgent, { prompt: "User message" }, { provider: capturingProvider });

			expect(receivedInput).toBeDefined();
			// Should have messages with user content
			expect(receivedInput?.messages).toBeDefined();
			// Should have system prompt in options
			expect(receivedInput?.options).toHaveProperty("systemPrompt", "System prompt here");
		});

		it("should return non-undefined output", async () => {
			const myAgent = agent({ prompt: "Test" });
			const result = await run(myAgent, { prompt: "Hello" });

			// Critical: output must not be undefined
			expect(result.output).toBeDefined();
			expect(result.output).not.toBeUndefined();
		});
	});
});
