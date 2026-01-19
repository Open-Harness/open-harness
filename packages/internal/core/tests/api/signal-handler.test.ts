/**
 * Unit tests for SignalHandler type (unified pattern)
 *
 * SignalHandler combines state mutations and signal emission in a single function.
 * This is the preferred pattern for workflows where these concerns are naturally coupled.
 */

import { describe, test, expect } from "bun:test";
import {
	createWorkflow,
	type SignalHandler,
	type SignalHandlers,
} from "../../src/api/create-workflow.js";
import {
	createSignal,
	HARNESS_SIGNALS,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";

// ============================================================================
// Test Types
// ============================================================================

interface TestState {
	count: number;
	tasks: { id: string; status: string }[];
	currentTaskId: string | null;
	messages: string[];
}

// ============================================================================
// Mock Harness
// ============================================================================

function createMockHarness(response: string): Harness {
	return {
		type: "mock",
		displayName: "Mock Harness",
		capabilities: {
			streaming: true,
			structuredOutput: false,
			tools: false,
			resume: false,
		},
		async *run(
			input: HarnessInput,
			ctx: RunContext,
		): AsyncGenerator<Signal, HarnessOutput> {
			yield createSignal(HARNESS_SIGNALS.START, { input });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: response });
			yield createSignal(HARNESS_SIGNALS.TEXT_COMPLETE, { content: response });
			yield createSignal(HARNESS_SIGNALS.END, {
				output: { content: response },
				durationMs: 100,
			});
			return {
				content: response,
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			};
		},
	};
}

// ============================================================================
// Type-only Tests (compile-time verification)
// ============================================================================

describe("SignalHandler type", () => {
	test("accepts handler that mutates state and returns signals", () => {
		// This is a compile-time test - if it compiles, types are correct
		const handler: SignalHandler<TestState> = (state, signal) => {
			// Direct mutation
			state.count++;

			// Return signals
			return [{ name: "count:incremented", payload: { count: state.count } }];
		};

		expect(handler).toBeDefined();
	});

	test("accepts handler that only mutates state (returns void)", () => {
		const handler: SignalHandler<TestState> = (state, _signal) => {
			state.count++;
			// No return - implicitly void
		};

		expect(handler).toBeDefined();
	});

	test("accepts handler that returns undefined", () => {
		const handler: SignalHandler<TestState> = (state, _signal) => {
			state.count++;
			return undefined;
		};

		expect(handler).toBeDefined();
	});

	test("accepts SignalHandlers map type", () => {
		const handlers: SignalHandlers<TestState> = {
			"task:ready": (state, signal) => {
				const taskId = (signal.payload as { taskId: string }).taskId;
				state.currentTaskId = taskId;
				const task = state.tasks.find((t) => t.id === taskId);
				if (task) task.status = "in_progress";
			},
			"task:complete": (state, signal) => {
				const taskId = (signal.payload as { taskId: string }).taskId;
				const task = state.tasks.find((t) => t.id === taskId);
				if (task) task.status = "complete";
				state.currentTaskId = null;

				// Return signal for next task
				const nextTask = state.tasks.find((t) => t.status === "pending");
				if (nextTask) {
					return [{ name: "task:ready", payload: { taskId: nextTask.id } }];
				}
				return [];
			},
		};

		expect(handlers).toBeDefined();
		expect(handlers["task:ready"]).toBeDefined();
		expect(handlers["task:complete"]).toBeDefined();
	});
});

// ============================================================================
// Runtime Integration Tests
// ============================================================================

describe("createWorkflow with handlers", () => {
	test("handlers mutate state correctly", async () => {
		const { agent, runReactive } = createWorkflow<TestState>();
		const harness = createMockHarness("test");

		const testAgent = agent({
			prompt: "Test agent",
			activateOn: ["workflow:start"],
			emits: ["test:done"],
			signalHarness: harness,
		});

		const result = await runReactive({
			agents: { testAgent },
			state: {
				count: 0,
				tasks: [],
				currentTaskId: null,
				messages: [],
			},
			harness,
			handlers: {
				"test:done": (state, _signal) => {
					state.messages.push("Handler executed");
					state.count = 42;
				},
			},
		});

		expect(result.state.count).toBe(42);
		expect(result.state.messages).toContain("Handler executed");
	});

	test("handlers emit signals correctly", async () => {
		const { agent, runReactive } = createWorkflow<TestState>();
		const harness = createMockHarness("test");

		const testAgent = agent({
			prompt: "Test agent",
			activateOn: ["workflow:start"],
			emits: ["test:done"],
			signalHarness: harness,
		});

		const result = await runReactive({
			agents: { testAgent },
			state: {
				count: 0,
				tasks: [],
				currentTaskId: null,
				messages: [],
			},
			harness,
			handlers: {
				"test:done": (state, _signal) => {
					state.count++;
					// Return a signal to emit
					return [
						{
							name: "handler:signal",
							payload: { emittedBy: "handler" },
						},
					];
				},
			},
		});

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("handler:signal");
	});

	test("handlers run after reducers", async () => {
		const { agent, runReactive } = createWorkflow<TestState>();
		const harness = createMockHarness("test");
		const executionOrder: string[] = [];

		const testAgent = agent({
			prompt: "Test agent",
			activateOn: ["workflow:start"],
			emits: ["test:done"],
			signalHarness: harness,
		});

		const result = await runReactive({
			agents: { testAgent },
			state: {
				count: 0,
				tasks: [],
				currentTaskId: null,
				messages: [],
			},
			harness,
			reducers: {
				"test:done": (state, _signal) => {
					executionOrder.push("reducer");
					state.count = 1;
				},
			},
			handlers: {
				"test:done": (state, _signal) => {
					executionOrder.push("handler");
					// Handler should see state from reducer
					state.count = state.count + 10;
				},
			},
		});

		// Reducer should run first, then handler
		expect(executionOrder).toEqual(["reducer", "handler"]);
		// Final state: reducer sets to 1, handler adds 10
		expect(result.state.count).toBe(11);
	});

	test("handlers run before process managers", async () => {
		const { agent, runReactive } = createWorkflow<TestState>();
		const harness = createMockHarness("test");
		const executionOrder: string[] = [];

		const testAgent = agent({
			prompt: "Test agent",
			activateOn: ["workflow:start"],
			emits: ["test:done"],
			signalHarness: harness,
		});

		const result = await runReactive({
			agents: { testAgent },
			state: {
				count: 0,
				tasks: [],
				currentTaskId: null,
				messages: [],
			},
			harness,
			handlers: {
				"test:done": (state, _signal) => {
					executionOrder.push("handler");
					state.count = 5;
				},
			},
			processes: {
				"test:done": (state, _signal) => {
					executionOrder.push("process");
					// Process manager should see state from handler
					return [
						{
							name: "process:signal",
							payload: { countFromProcess: state.count },
						},
					];
				},
			},
		});

		// Handler should run first, then process manager
		expect(executionOrder).toEqual(["handler", "process"]);

		// Process manager should have seen the handler's state update
		const processSignal = result.signals.find((s) => s.name === "process:signal");
		expect(processSignal).toBeDefined();
		expect((processSignal?.payload as { countFromProcess: number }).countFromProcess).toBe(5);
	});

	test("chained handler signals work correctly", async () => {
		const { agent, runReactive } = createWorkflow<TestState>();
		const harness = createMockHarness("test");

		const testAgent = agent({
			prompt: "Test agent",
			activateOn: ["workflow:start"],
			emits: ["chain:start"],
			signalHarness: harness,
		});

		const result = await runReactive({
			agents: { testAgent },
			state: {
				count: 0,
				tasks: [],
				currentTaskId: null,
				messages: [],
			},
			harness,
			handlers: {
				"chain:start": (state, _signal) => {
					state.messages.push("chain:start");
					return [{ name: "chain:middle", payload: {} }];
				},
				"chain:middle": (state, _signal) => {
					state.messages.push("chain:middle");
					return [{ name: "chain:end", payload: {} }];
				},
				"chain:end": (state, _signal) => {
					state.messages.push("chain:end");
					// No more signals to emit
				},
			},
		});

		// All handlers should have executed in chain
		expect(result.state.messages).toEqual(["chain:start", "chain:middle", "chain:end"]);

		// All signals should be in history
		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("chain:start");
		expect(signalNames).toContain("chain:middle");
		expect(signalNames).toContain("chain:end");
	});

	test("handler returning empty array emits no signals", async () => {
		const { agent, runReactive } = createWorkflow<TestState>();
		const harness = createMockHarness("test");

		const testAgent = agent({
			prompt: "Test agent",
			activateOn: ["workflow:start"],
			emits: ["test:done"],
			signalHarness: harness,
		});

		const result = await runReactive({
			agents: { testAgent },
			state: {
				count: 0,
				tasks: [],
				currentTaskId: null,
				messages: [],
			},
			harness,
			handlers: {
				"test:done": (state, _signal) => {
					state.count = 99;
					return []; // Empty array - no signals
				},
			},
		});

		expect(result.state.count).toBe(99);

		// Only the original signals should be present, no extras from handler
		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).not.toContain("handler:signal");
	});
});

// ============================================================================
// Export Verification
// ============================================================================

describe("SignalHandler exports", () => {
	test("SignalHandler type is exported from api", async () => {
		const exports = await import("../../src/api/index.js");
		// Type exports don't show at runtime, but we verify the module loads
		expect(exports.createWorkflow).toBeDefined();
	});
});
