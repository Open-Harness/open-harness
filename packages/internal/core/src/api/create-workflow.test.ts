/**
 * Tests for createWorkflow and reducer signal emission.
 *
 * FE-001: Reducer Signal Emission
 */

import { describe, it, expect, vi } from "vitest";
import { createWorkflow, type ReducerContext } from "./create-workflow.js";
import type { Signal } from "@internal/signals-core";

// ============================================================================
// Mock Harness for testing
// ============================================================================

function createMockHarness(output: unknown = "test output") {
	return {
		*run() {
			yield {
				id: "sig-1",
				name: "harness:end",
				payload: { output },
				timestamp: Date.now(),
				source: { harness: "mock" },
			} as Signal;
		},
	};
}

// ============================================================================
// FE-001: Reducer Signal Emission Tests
// ============================================================================

describe("createWorkflow - reducers", () => {
	describe("basic reducer functionality", () => {
		it("reducer receives state and signal", async () => {
			type TestState = { count: number };
			const { agent, runReactive } = createWorkflow<TestState>();

			const receivedArgs: { state: TestState; signal: Signal }[] = [];

			const testAgent = agent({
				prompt: "test",
				activateOn: ["workflow:start"],
				emits: ["test:done"],
			});

			await runReactive({
				agents: { test: testAgent },
				state: { count: 0 },
				harness: createMockHarness(),
				reducers: {
					"test:done": (state, signal, _ctx) => {
						receivedArgs.push({ state: { ...state }, signal });
						state.count = 1;
					},
				},
			});

			expect(receivedArgs).toHaveLength(1);
			expect(receivedArgs[0]?.state.count).toBe(0);
			expect(receivedArgs[0]?.signal.name).toBe("test:done");
		});

		it("reducer mutates state", async () => {
			type TestState = { value: string };
			const { agent, runReactive } = createWorkflow<TestState>();

			const testAgent = agent({
				prompt: "test",
				activateOn: ["workflow:start"],
				emits: ["test:done"],
			});

			const result = await runReactive({
				agents: { test: testAgent },
				state: { value: "initial" },
				harness: createMockHarness(),
				reducers: {
					"test:done": (state, _signal, _ctx) => {
						state.value = "mutated";
					},
				},
			});

			expect(result.state.value).toBe("mutated");
		});
	});

	describe("FE-001: ctx.emit() functionality", () => {
		it("reducer receives context with emit function", async () => {
			type TestState = { count: number };
			const { agent, runReactive } = createWorkflow<TestState>();

			let contextReceived: ReducerContext | null = null;

			const testAgent = agent({
				prompt: "test",
				activateOn: ["workflow:start"],
				emits: ["test:done"],
			});

			await runReactive({
				agents: { test: testAgent },
				state: { count: 0 },
				harness: createMockHarness(),
				reducers: {
					"test:done": (state, _signal, ctx) => {
						contextReceived = ctx;
					},
				},
			});

			expect(contextReceived).not.toBeNull();
			expect(typeof contextReceived?.emit).toBe("function");
		});

		it("reducer can emit signal that appears in history", async () => {
			type TestState = { count: number };
			const { agent, runReactive } = createWorkflow<TestState>();

			const testAgent = agent({
				prompt: "test",
				activateOn: ["workflow:start"],
				emits: ["test:done"],
			});

			const result = await runReactive({
				agents: { test: testAgent },
				state: { count: 0 },
				harness: createMockHarness(),
				reducers: {
					"test:done": (_state, _signal, ctx) => {
						// Import createSignal dynamically to emit a signal
						ctx.emit({
							id: `reducer-emit-${Date.now()}`,
							name: "reducer:emitted",
							payload: { from: "reducer" },
							timestamp: Date.now(),
							source: { reducer: "test:done" },
						});
					},
				},
			});

			const emittedSignal = result.signals.find(
				(s) => s.name === "reducer:emitted",
			);
			expect(emittedSignal).toBeDefined();
			expect(emittedSignal?.payload).toEqual({ from: "reducer" });
		});

		it("reducer-emitted signal triggers another agent", async () => {
			type TestState = { steps: string[] };
			const { agent, runReactive } = createWorkflow<TestState>();

			const firstAgent = agent({
				prompt: "first",
				activateOn: ["workflow:start"],
				emits: ["first:done"],
			});

			const secondAgent = agent({
				prompt: "second",
				activateOn: ["reducer:triggered"],
				emits: ["second:done"],
			});

			const result = await runReactive({
				agents: { first: firstAgent, second: secondAgent },
				state: { steps: [] },
				harness: createMockHarness(),
				reducers: {
					"first:done": (state, _signal, ctx) => {
						state.steps.push("first");
						// Emit a signal that should trigger the second agent
						ctx.emit({
							id: `reducer-emit-${Date.now()}`,
							name: "reducer:triggered",
							payload: {},
							timestamp: Date.now(),
							source: { reducer: "first:done" },
						});
					},
					"second:done": (state, _signal, _ctx) => {
						state.steps.push("second");
					},
				},
			});

			// Check that the second agent was triggered
			const secondActivated = result.signals.some(
				(s) =>
					s.name === "agent:activated" &&
					(s.payload as { agent: string }).agent === "second",
			);
			expect(secondActivated).toBe(true);

			// Check state was updated by both reducers
			expect(result.state.steps).toContain("first");
			expect(result.state.steps).toContain("second");
		});

		it("multiple signals emitted from one reducer all process", async () => {
			type TestState = { received: string[] };
			const { agent, runReactive } = createWorkflow<TestState>();

			const testAgent = agent({
				prompt: "test",
				activateOn: ["workflow:start"],
				emits: ["test:done"],
			});

			const result = await runReactive({
				agents: { test: testAgent },
				state: { received: [] },
				harness: createMockHarness(),
				reducers: {
					"test:done": (_state, _signal, ctx) => {
						// Emit multiple signals
						ctx.emit({
							id: `emit-1-${Date.now()}`,
							name: "multi:one",
							payload: { n: 1 },
							timestamp: Date.now(),
							source: { reducer: "test:done" },
						});
						ctx.emit({
							id: `emit-2-${Date.now()}`,
							name: "multi:two",
							payload: { n: 2 },
							timestamp: Date.now(),
							source: { reducer: "test:done" },
						});
						ctx.emit({
							id: `emit-3-${Date.now()}`,
							name: "multi:three",
							payload: { n: 3 },
							timestamp: Date.now(),
							source: { reducer: "test:done" },
						});
					},
					"multi:one": (state, _signal, _ctx) => {
						state.received.push("one");
					},
					"multi:two": (state, _signal, _ctx) => {
						state.received.push("two");
					},
					"multi:three": (state, _signal, _ctx) => {
						state.received.push("three");
					},
				},
			});

			// All three emitted signals should have been processed
			expect(result.state.received).toContain("one");
			expect(result.state.received).toContain("two");
			expect(result.state.received).toContain("three");
		});

		it("chained reducer emissions work correctly", async () => {
			type TestState = { chain: string[] };
			const { agent, runReactive } = createWorkflow<TestState>();

			const testAgent = agent({
				prompt: "test",
				activateOn: ["workflow:start"],
				emits: ["chain:start"],
			});

			const result = await runReactive({
				agents: { test: testAgent },
				state: { chain: [] },
				harness: createMockHarness(),
				reducers: {
					"chain:start": (state, _signal, ctx) => {
						state.chain.push("start");
						ctx.emit({
							id: `chain-a-${Date.now()}`,
							name: "chain:a",
							payload: {},
							timestamp: Date.now(),
							source: { reducer: "chain:start" },
						});
					},
					"chain:a": (state, _signal, ctx) => {
						state.chain.push("a");
						ctx.emit({
							id: `chain-b-${Date.now()}`,
							name: "chain:b",
							payload: {},
							timestamp: Date.now(),
							source: { reducer: "chain:a" },
						});
					},
					"chain:b": (state, _signal, ctx) => {
						state.chain.push("b");
						ctx.emit({
							id: `chain-c-${Date.now()}`,
							name: "chain:c",
							payload: {},
							timestamp: Date.now(),
							source: { reducer: "chain:b" },
						});
					},
					"chain:c": (state, _signal, _ctx) => {
						state.chain.push("c");
						// End of chain - no more emissions
					},
				},
			});

			// Chain should execute in order
			expect(result.state.chain).toEqual(["start", "a", "b", "c"]);
		});
	});
});
