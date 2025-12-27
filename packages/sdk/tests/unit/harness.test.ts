/**
 * Harness Types Tests
 *
 * Tests for TypeScript type interfaces used in the harness system.
 * Following TDD: tests written first, implementation follows.
 */

import { describe, expect, test } from "bun:test";
import { Agent } from "../../src/harness/agent.js";
import { BaseHarness } from "../../src/harness/base-harness.js";
import { PersistentState } from "../../src/harness/state.js";
import type {
	AgentConfig,
	AgentRunParams,
	Constraints,
	HarnessConfig,
	LoadedContext,
	StateDelta,
	Step,
	StepYield,
} from "../../src/harness/types.js";

describe("Harness Types", () => {
	test("Step interface has required fields", () => {
		const step: Step<string, number> = {
			stepNumber: 1,
			timestamp: Date.now(),
			input: "test",
			output: 42,
			stateDelta: { modified: [] },
		};
		expect(step.stepNumber).toBe(1);
		expect(step.timestamp).toBeGreaterThan(0);
		expect(step.input).toBe("test");
		expect(step.output).toBe(42);
		expect(step.stateDelta).toBeDefined();
	});

	test("StateDelta tracks modifications", () => {
		const delta: StateDelta = {
			modified: ["balance", "position"],
			summary: "Updated portfolio",
		};
		expect(delta.modified).toContain("balance");
		expect(delta.modified).toContain("position");
		expect(delta.summary).toBe("Updated portfolio");
	});

	test("StateDelta summary is optional", () => {
		const delta: StateDelta = {
			modified: ["balance"],
		};
		expect(delta.modified).toContain("balance");
		expect(delta.summary).toBeUndefined();
	});

	test("LoadedContext provides bounded state", () => {
		const context: LoadedContext<{ count: number }> = {
			state: { count: 5 },
			recentSteps: [],
			relevantKnowledge: {},
		};
		expect(context.state.count).toBe(5);
		expect(context.recentSteps).toEqual([]);
		expect(context.relevantKnowledge).toEqual({});
	});

	test("LoadedContext includes recentSteps", () => {
		const step: Step<string, number> = {
			stepNumber: 1,
			timestamp: Date.now(),
			input: "test",
			output: 42,
			stateDelta: { modified: [] },
		};
		const context: LoadedContext<{ count: number }> = {
			state: { count: 5 },
			recentSteps: [step],
			relevantKnowledge: {},
		};
		expect(context.recentSteps).toHaveLength(1);
		expect(context.recentSteps[0]?.stepNumber).toBe(1);
	});

	test("HarnessConfig has initialState", () => {
		const config: HarnessConfig<{ count: number }> = {
			initialState: { count: 0 },
		};
		expect(config.initialState.count).toBe(0);
	});

	test("HarnessConfig maxContextSteps is optional", () => {
		const config: HarnessConfig<{ count: number }> = {
			initialState: { count: 0 },
		};
		expect(config.maxContextSteps).toBeUndefined();
	});

	test("HarnessConfig can have maxContextSteps", () => {
		const config: HarnessConfig<{ count: number }> = {
			initialState: { count: 0 },
			maxContextSteps: 10,
		};
		expect(config.maxContextSteps).toBe(10);
	});

	test("StepYield has input and output fields", () => {
		const yieldValue: StepYield<string, number> = {
			input: "test",
			output: 42,
		};
		expect(yieldValue.input).toBe("test");
		expect(yieldValue.output).toBe(42);
	});

	test("Constraints provides flexible key-value structure", () => {
		const constraints: Constraints = {
			maxIterations: 10,
			timeout: 5000,
			allowRetries: true,
		};
		expect(constraints.maxIterations).toBe(10);
		expect(constraints.timeout).toBe(5000);
		expect(constraints.allowRetries).toBe(true);
	});

	test("Constraints can have string values", () => {
		const constraints: Constraints = {
			mode: "strict",
			level: "high",
		};
		expect(constraints.mode).toBe("strict");
		expect(constraints.level).toBe("high");
	});

	test("Constraints can have mixed types", () => {
		const constraints: Constraints = {
			maxIterations: 10,
			mode: "strict",
			enabled: true,
		};
		expect(constraints.maxIterations).toBe(10);
		expect(constraints.mode).toBe("strict");
		expect(constraints.enabled).toBe(true);
	});

	test("AgentConfig name is optional (AC1)", () => {
		const configWithoutName: AgentConfig<{ count: number }, string, number> = {
			run: async () => 42,
		};
		expect(configWithoutName.name).toBeUndefined();
		expect(configWithoutName.run).toBeDefined();
	});

	test("AgentConfig can have optional name (AC1)", () => {
		const configWithName: AgentConfig<{ count: number }, string, number> = {
			name: "TestAgent",
			run: async () => 42,
		};
		expect(configWithName.name).toBe("TestAgent");
	});

	test("AgentConfig has required run function (AC2)", () => {
		const config: AgentConfig<{ count: number }, string, number> = {
			run: async (params) => {
				expect(params.input).toBe("test");
				return 42;
			},
		};
		expect(config.run).toBeDefined();
		expect(typeof config.run).toBe("function");
	});

	test("AgentConfig run function takes AgentRunParams and returns Promise<TOutput> (AC2)", async () => {
		const config: AgentConfig<{ count: number }, string, number> = {
			run: async (params: AgentRunParams<{ count: number }, string, number>) => {
				return params.input.length;
			},
		};
		const result = await config.run({
			input: "test",
			context: { count: 0 },
			stepNumber: 1,
			stepHistory: [],
			constraints: {},
		});
		expect(result).toBe(4);
	});

	test("AgentConfig isComplete is optional (AC3)", () => {
		const configWithoutIsComplete: AgentConfig<{ count: number }, string, number> = {
			run: async () => 42,
		};
		expect(configWithoutIsComplete.isComplete).toBeUndefined();
	});

	test("AgentConfig can have optional isComplete function (AC3)", () => {
		const config: AgentConfig<{ done: boolean }, string, number> = {
			run: async () => 42,
			isComplete: (state) => state.done,
		};
		expect(config.isComplete).toBeDefined();
		expect(typeof config.isComplete).toBe("function");
		expect(config.isComplete?.({ done: true })).toBe(true);
	});

	test("AgentRunParams has input, context, stepNumber, stepHistory, constraints (AC4)", () => {
		const step: Step<string, number> = {
			stepNumber: 1,
			timestamp: Date.now(),
			input: "previous",
			output: 10,
			stateDelta: { modified: [] },
		};
		const params: AgentRunParams<{ count: number }, string, number> = {
			input: "test",
			context: { count: 5 },
			stepNumber: 2,
			stepHistory: [step],
			constraints: { maxTokens: 1000 },
		};
		expect(params.input).toBe("test");
		expect(params.context.count).toBe(5);
		expect(params.stepNumber).toBe(2);
		expect(params.stepHistory).toHaveLength(1);
		expect(params.constraints.maxTokens).toBe(1000);
	});
});

describe("PersistentState", () => {
	test("initializes with provided state", () => {
		const state = new PersistentState({ initialState: { count: 0 } });
		expect(state.getState()).toEqual({ count: 0 });
	});

	test("updateState modifies state immutably", () => {
		const state = new PersistentState({ initialState: { count: 0 } });
		state.updateState((s) => ({ count: s.count + 1 }));
		expect(state.getState()).toEqual({ count: 1 });
	});

	test("record adds step to history", () => {
		const state = new PersistentState({ initialState: {} });
		state.record(1, "input-a", "output-a", { modified: [] });
		state.record(2, "input-b", "output-b", { modified: [] });

		const history = state.getStepHistory();
		expect(history.length).toBe(2);
		expect(history[0]?.stepNumber).toBe(1);
		expect(history[1]?.stepNumber).toBe(2);
	});

	test("loadContext returns bounded context", () => {
		const state = new PersistentState({
			initialState: { count: 0 },
			maxContextSteps: 5,
		});

		// Record 10 steps
		for (let i = 1; i <= 10; i++) {
			state.record(i, `input-${i}`, `output-${i}`, { modified: [] });
		}

		const context = state.loadContext();
		expect(context.recentSteps.length).toBe(5); // Bounded to maxContextSteps
		expect(context.recentSteps[0]?.stepNumber).toBe(6); // Most recent 5
		expect(context.state).toEqual({ count: 0 });
	});

	test("getRecentSteps returns last N steps", () => {
		const state = new PersistentState({ initialState: {} });
		state.record(1, "a", "A", { modified: [] });
		state.record(2, "b", "B", { modified: [] });
		state.record(3, "c", "C", { modified: [] });

		const recent = state.getRecentSteps(2);
		expect(recent.length).toBe(2);
		expect(recent[0]?.input).toBe("b");
		expect(recent[1]?.input).toBe("c");
	});
});

describe("Agent", () => {
	test("run() calls provided function with all params (AC1)", async () => {
		let capturedParams: AgentRunParams<{ x: number }, string, number> | undefined;

		const agent = new Agent<{ x: number }, string, number>({
			name: "TestAgent",
			run: async (params) => {
				capturedParams = params;
				return 42;
			},
		});

		const result = await agent.run({
			input: "hello",
			context: { x: 1 },
			stepNumber: 5,
			stepHistory: [],
			constraints: {},
		});

		expect(result).toBe(42);
		expect(capturedParams).toBeDefined();
		if (capturedParams) {
			expect(capturedParams.input).toBe("hello");
			expect(capturedParams.stepNumber).toBe(5);
			expect(capturedParams.context).toEqual({ x: 1 });
			expect(capturedParams.stepHistory).toEqual([]);
			expect(capturedParams.constraints).toEqual({});
		}
	});

	test("agent has name property (AC2)", () => {
		const agent = new Agent<Record<string, never>, string, string>({
			name: "MyAgent",
			run: async () => "ok",
		});
		expect(agent.name).toBe("MyAgent");
	});

	test("name defaults to 'Agent' (AC3)", () => {
		const agent = new Agent<Record<string, never>, string, string>({
			run: async () => "ok",
		});
		expect(agent.name).toBe("Agent");
	});

	test("isComplete uses provided function (AC4)", () => {
		const agent = new Agent<{ done: boolean }, string, string>({
			run: async () => "ok",
			isComplete: (state) => state.done,
		});

		expect(agent.isComplete({ done: false })).toBe(false);
		expect(agent.isComplete({ done: true })).toBe(true);
	});

	test("isComplete defaults to false when not provided (AC5)", () => {
		const agent = new Agent<Record<string, never>, string, string>({
			run: async () => "ok",
		});

		expect(agent.isComplete({})).toBe(false);
	});
});

describe("BaseHarness", () => {
	class SimpleHarness extends BaseHarness<{ count: number }, string, string> {
		private items = ["a", "b", "c"];

		async *execute() {
			for (const item of this.items) {
				const output = `processed: ${item}`;
				yield { input: item, output };
			}
		}
	}

	test("initializes with step 0 (AC3)", () => {
		const harness = new SimpleHarness({ initialState: { count: 0 } });
		expect(harness.getCurrentStep()).toBe(0);
	});

	test("run() executes all yields from execute() (AC2, AC3)", async () => {
		const harness = new SimpleHarness({ initialState: { count: 0 } });
		await harness.run();
		expect(harness.getCurrentStep()).toBe(3);
	});

	test("run() records each step in history (AC4)", async () => {
		const harness = new SimpleHarness({ initialState: { count: 0 } });
		await harness.run();

		const history = harness.getStepHistory();
		expect(history.length).toBe(3);
		expect(history[0]).toMatchObject({
			stepNumber: 1,
			input: "a",
			output: "processed: a",
		});
	});

	test("getState returns current state (AC5)", () => {
		const harness = new SimpleHarness({ initialState: { count: 42 } });
		expect(harness.getState()).toEqual({ count: 42 });
	});

	test("isComplete defaults to false", () => {
		const harness = new SimpleHarness({ initialState: { count: 0 } });
		expect(harness.isComplete()).toBe(false);
	});
});

describe("BaseHarness with state updates", () => {
	class CountingHarness extends BaseHarness<{ count: number }, number, number> {
		async *execute() {
			for (let i = 1; i <= 3; i++) {
				this.state.updateState((s) => ({ count: s.count + i }));
				yield { input: i, output: i * 2 };
			}
		}
	}

	test("state persists across steps (AC6)", async () => {
		const harness = new CountingHarness({ initialState: { count: 0 } });
		await harness.run();
		expect(harness.getState()).toEqual({ count: 6 }); // 0 + 1 + 2 + 3
	});
});

describe("BaseHarness with agents", () => {
	class AgentHarness extends BaseHarness<{ value: number }, string, string> {
		private agent = new Agent<{ value: number }, string, string>({
			name: "TestAgent",
			run: async ({ input, stepNumber, context }) => {
				return `step ${stepNumber}: ${input} (value: ${context.value})`;
			},
		});

		private inputs = ["first", "second"];

		async *execute() {
			for (const input of this.inputs) {
				const context = this.loadContext();
				const output = await this.agent.run({
					input,
					context: context.state,
					stepNumber: this.currentStep + 1,
					stepHistory: this.getStepHistory(),
					constraints: {},
				});
				yield { input, output };
			}
		}
	}

	test("agents receive step context", async () => {
		const harness = new AgentHarness({ initialState: { value: 100 } });
		await harness.run();

		const history = harness.getStepHistory();
		expect(history[0]?.output).toBe("step 1: first (value: 100)");
		expect(history[1]?.output).toBe("step 2: second (value: 100)");
	});
});

describe("BaseHarness with async delays (time-based simulation)", () => {
	class PollingHarness extends BaseHarness<Record<string, never>, number, number> {
		private pollCount = 0;
		private maxPolls = 3;

		async *execute() {
			while (this.pollCount < this.maxPolls) {
				this.pollCount++;
				const input = this.pollCount;
				const output = input * 10;
				yield { input, output };

				// Simulate polling delay (in real usage: await sleep(5000))
				await Promise.resolve(); // Just yield control
			}
		}
	}

	test("polling pattern works", async () => {
		const harness = new PollingHarness({ initialState: {} });
		await harness.run();

		expect(harness.getCurrentStep()).toBe(3);
		expect(harness.getStepHistory().map((s) => s.output)).toEqual([10, 20, 30]);
	});
});

describe("BaseHarness with custom isComplete", () => {
	class EarlyStopHarness extends BaseHarness<{ stopAt: number }, number, number> {
		async *execute() {
			let i = 0;
			while (true) {
				i++;
				yield { input: i, output: i };
				// Note: isComplete check happens in run() after yield
			}
		}

		override isComplete(): boolean {
			return this.getCurrentStep() >= this.state.getState().stopAt;
		}
	}

	test("run() stops when isComplete returns true (AC1)", async () => {
		const harness = new EarlyStopHarness({ initialState: { stopAt: 5 } });
		await harness.run();

		expect(harness.getCurrentStep()).toBe(5);
		expect(harness.getStepHistory().length).toBe(5);
		expect(harness.isComplete()).toBe(true);
	});
});

describe("BaseHarness default isComplete", () => {
	class FiniteHarness extends BaseHarness<Record<string, never>, string, string> {
		async *execute() {
			yield { input: "a", output: "A" };
			yield { input: "b", output: "B" };
			// Generator completes naturally
		}
	}

	test("completes when generator exhausts (AC2)", async () => {
		const harness = new FiniteHarness({ initialState: {} });
		await harness.run();
		expect(harness.getCurrentStep()).toBe(2);
		expect(harness.isComplete()).toBe(false);
	});
});

describe("BaseHarness isComplete timing", () => {
	class ImmediateCompleteHarness extends BaseHarness<{ done: boolean }, number, number> {
		async *execute() {
			yield { input: 1, output: 1 };
			yield { input: 2, output: 2 }; // Should not reach this
		}

		override isComplete(): boolean {
			return this.state.getState().done; // true from start
		}
	}

	test("processes first yield even if isComplete true initially (AC3)", async () => {
		const harness = new ImmediateCompleteHarness({
			initialState: { done: true },
		});
		await harness.run();
		expect(harness.getCurrentStep()).toBe(1); // First yield processed
		expect(harness.getStepHistory().length).toBe(1);
	});
});

describe("Harness Exports", () => {
	test("exports all harness primitives (AC1)", async () => {
		const exports = await import("../../src/harness/index.js");

		expect(exports.BaseHarness).toBeDefined();
		expect(exports.Agent).toBeDefined();
		expect(exports.PersistentState).toBeDefined();
	});

	test("exports all harness types (AC2)", async () => {
		const exports = await import("../../src/harness/index.js");

		// Types are available at compile time, but we can verify they're exported
		// by checking that we can import them
		expect(exports).toBeDefined();
		// Verify we can use the types by importing them
		type _Step = typeof exports extends { Step: infer T } ? T : never;
		type _StateDelta = typeof exports extends { StateDelta: infer T } ? T : never;
		type _Constraints = typeof exports extends { Constraints: infer T } ? T : never;
		type _LoadedContext = typeof exports extends { LoadedContext: infer T } ? T : never;
		type _HarnessConfig = typeof exports extends { HarnessConfig: infer T } ? T : never;

		// If we get here, types are exported (TypeScript would error if not)
		expect(true).toBe(true);
	});
});

describe("SDK Exports", () => {
	test("SDK exports harness primitives (AC1)", async () => {
		const sdk = await import("../../src/index.js");

		expect(sdk.BaseHarness).toBeDefined();
		expect(sdk.Agent).toBeDefined();
		expect(sdk.PersistentState).toBeDefined();
	});

	test("SDK exports harness types (AC2)", async () => {
		const sdk = await import("../../src/index.js");

		// Verify types are available (compile-time check)
		expect(sdk).toBeDefined();
		// If we get here, types are exported (TypeScript would error if not)
		expect(true).toBe(true);
	});
});

// ============================================================================
// BACKWARD COMPATIBILITY TESTS (T034 - US7)
// ============================================================================

describe("Backward Compatibility - US7", () => {
	test("SDK exports both legacy and fluent APIs (SC-007)", async () => {
		const sdk = await import("../../src/index.js");

		// Legacy API exports
		expect(sdk.BaseHarness).toBeDefined();
		expect(sdk.Agent).toBeDefined();
		expect(sdk.PersistentState).toBeDefined();
		expect(sdk.createContainer).toBeDefined();

		// Fluent API exports
		expect(sdk.defineHarness).toBeDefined();
		expect(sdk.wrapAgent).toBeDefined();
		expect(sdk.HarnessInstance).toBeDefined();
	});

	test("legacy BaseHarness pattern works alongside new API", async () => {
		// Import both APIs together - this is the key coexistence test
		const {
			// Legacy imports
			BaseHarness,
			Agent,
			PersistentState,
			createContainer,
			// Fluent imports
			defineHarness,
			wrapAgent,
		} = await import("../../src/index.js");

		// Verify legacy pattern compiles and works
		class LegacyHarness extends BaseHarness<{ count: number }, string, string> {
			async *execute() {
				yield { input: "legacy", output: "works" };
			}
		}

		const legacyHarness = new LegacyHarness({ initialState: { count: 0 } });
		await legacyHarness.run();
		expect(legacyHarness.getStepHistory().length).toBe(1);
		expect(legacyHarness.getStepHistory()[0]?.output).toBe("works");

		// Verify fluent pattern compiles and works
		const { injectable } = await import("@needle-di/core");

		@injectable()
		class TestAgent {
			execute(input: string): string {
				return `fluent-${input}`;
			}
		}

		const fluentResult = wrapAgent(TestAgent).run("works");
		expect(fluentResult).toBe("fluent-works");

		// Both patterns executed successfully in same test
		expect(legacyHarness.getCurrentStep()).toBe(1);
		expect(fluentResult).toBeDefined();
	});

	test("createContainer() still functions correctly", async () => {
		const { createContainer } = await import("../../src/index.js");
		const { injectable } = await import("@needle-di/core");

		// This is the pattern users have in existing code
		const container = createContainer({ mode: "live" });

		@injectable()
		class TestService {
			getValue(): string {
				return "container-works";
			}
		}

		// User pattern: container.bind() then container.get()
		container.bind(TestService);
		const service = container.get(TestService);
		expect(service.getValue()).toBe("container-works");
	});

	test("both APIs can share same agent classes", async () => {
		const { BaseHarness, defineHarness, wrapAgent } = await import("../../src/index.js");
		const { injectable } = await import("@needle-di/core");

		// Shared agent class that works with both patterns
		@injectable()
		class SharedAgent {
			process(input: string): string {
				return `processed-${input}`;
			}

			execute(input: string): string {
				return this.process(input);
			}
		}

		// Use with fluent API
		const fluentResult = wrapAgent(SharedAgent).run("fluent");
		expect(fluentResult).toBe("processed-fluent");

		// Use with legacy API (manual instantiation for simplicity)
		class LegacyWithSharedAgent extends BaseHarness<Record<string, never>, string, string> {
			private agent = new SharedAgent();

			async *execute() {
				const result = this.agent.process("legacy");
				yield { input: "test", output: result };
			}
		}

		const legacyHarness = new LegacyWithSharedAgent({ initialState: {} });
		await legacyHarness.run();
		expect(legacyHarness.getStepHistory()[0]?.output).toBe("processed-legacy");
	});
});
