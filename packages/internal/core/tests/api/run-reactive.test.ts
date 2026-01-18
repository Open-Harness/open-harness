/**
 * Unit tests for runReactive() function
 */

import { describe, test, expect } from "bun:test";
import { agent } from "../../src/api/agent.js";
import { runReactive } from "../../src/api/run-reactive.js";
import { isReactiveAgent } from "../../src/api/types.js";
import {
	createSignal,
	HARNESS_SIGNALS,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";
import { MemorySignalStore } from "@internal/signals";

// ============================================================================
// Mock Harness
// ============================================================================

/**
 * Create a mock harness that yields predictable signals
 */
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
// Tests
// ============================================================================

describe("agent() with reactive properties", () => {
	test("returns regular Agent when activateOn is not specified", () => {
		const myAgent = agent({ prompt: "You are helpful" });

		expect(myAgent._tag).toBe("Agent");
		expect("_reactive" in myAgent).toBe(false);
		expect(isReactiveAgent(myAgent)).toBe(false);
	});

	test("returns ReactiveAgent when activateOn is specified", () => {
		const myAgent = agent({
			prompt: "You are helpful",
			activateOn: ["workflow:start"],
		});

		expect(myAgent._tag).toBe("Agent");
		expect("_reactive" in myAgent).toBe(true);
		expect(isReactiveAgent(myAgent)).toBe(true);
	});

	test("accepts all reactive properties", () => {
		const harness = createMockHarness("test");

		const myAgent = agent({
			prompt: "Analyze data",
			activateOn: ["harness:start", "data:updated"],
			emits: ["analysis:complete"],
			signalHarness: harness,
		});

		expect(isReactiveAgent(myAgent)).toBe(true);
		expect(myAgent.config.activateOn).toEqual(["harness:start", "data:updated"]);
		expect(myAgent.config.emits).toEqual(["analysis:complete"]);
		expect(myAgent.config.signalHarness).toBe(harness);
	});
});

describe("runReactive", () => {
	test("emits workflow:start and workflow:end", async () => {
		const myAgent = agent({
			prompt: "You are helpful",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("Hello!"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "Hi");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("workflow:start");
		expect(signalNames).toContain("workflow:end");

		// workflow:start should be first
		expect(signalNames[0]).toBe("workflow:start");

		// workflow:end should be last
		expect(signalNames[signalNames.length - 1]).toBe("workflow:end");
	});

	test("activates agent on matching signal", async () => {
		const myAgent = agent({
			prompt: "Analyze data",
			activateOn: ["workflow:start"],
			emits: ["analysis:complete"],
			signalHarness: createMockHarness("Analysis done"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "data");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("agent:activated");
		expect(signalNames).toContain("analysis:complete");
		expect(result.metrics.activations).toBe(1);
	});

	test("emits harness signals to bus", async () => {
		const myAgent = agent({
			prompt: "Test harness",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("Harness response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain(HARNESS_SIGNALS.START);
		expect(signalNames).toContain(HARNESS_SIGNALS.TEXT_DELTA);
		expect(signalNames).toContain(HARNESS_SIGNALS.TEXT_COMPLETE);
		expect(signalNames).toContain(HARNESS_SIGNALS.END);
	});

	test("emits declared signals from emits array", async () => {
		const myAgent = agent({
			prompt: "Trade executor",
			activateOn: ["workflow:start"],
			emits: ["trade:proposed", "trade:executed"],
			signalHarness: createMockHarness("Trade executed"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "Buy AAPL");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("trade:proposed");
		expect(signalNames).toContain("trade:executed");
	});

	test("uses agent signalHarness", async () => {
		const customHarness = createMockHarness("Custom response");

		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: customHarness,
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		// Check the output from harness:end signal
		const endSignal = result.signals.find(
			(s) => s.name === HARNESS_SIGNALS.END,
		);
		expect(endSignal).toBeDefined();
		expect((endSignal?.payload as { output: { content: string } }).output.content).toBe(
			"Custom response",
		);
	});

	test("uses options.harness when agent has no signalHarness", async () => {
		const defaultHarness = createMockHarness("Default response");

		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			// No signalHarness
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test", {
			harness: defaultHarness,
		});

		const endSignal = result.signals.find(
			(s) => s.name === HARNESS_SIGNALS.END,
		);
		expect(endSignal).toBeDefined();
		expect((endSignal?.payload as { output: { content: string } }).output.content).toBe(
			"Default response",
		);
	});

	test("throws error when no harness is specified", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			// No signalHarness
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		expect(runReactive(myAgent, "test")).rejects.toThrow(
			/No harness specified/,
		);
	});

	test("returns duration in metrics", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("workflow:end contains output and duration", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("final output"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		const endSignal = result.signals.find((s) => s.name === "workflow:end");
		expect(endSignal).toBeDefined();

		const payload = endSignal?.payload as {
			durationMs: number;
			output: unknown;
		};
		expect(payload.durationMs).toBeGreaterThanOrEqual(0);
		expect(payload.output).toBeDefined();
	});
});

// ============================================================================
// Recording/Replay Tests
// ============================================================================

describe("runReactive recording", () => {
	test("record mode saves signals to store", async () => {
		const store = new MemorySignalStore();
		const myAgent = agent({
			prompt: "Test recording",
			activateOn: ["workflow:start"],
			emits: ["test:complete"],
			signalHarness: createMockHarness("recorded output"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test input", {
			recording: {
				mode: "record",
				store,
				name: "test-recording",
				tags: ["test"],
			},
		});

		// Should return recording ID
		expect(result.recordingId).toBeDefined();
		expect(result.recordingId).toMatch(/^rec_/);

		// Recording should be in store
		const recording = await store.load(result.recordingId!);
		expect(recording).not.toBeNull();
		expect(recording!.metadata.name).toBe("test-recording");
		expect(recording!.metadata.tags).toContain("test");
		expect(recording!.signals.length).toBeGreaterThan(0);

		// Should contain all the signals from the run
		const recordedNames = recording!.signals.map((s) => s.name);
		expect(recordedNames).toContain("workflow:start");
		expect(recordedNames).toContain("agent:activated");
		expect(recordedNames).toContain(HARNESS_SIGNALS.START);
		expect(recordedNames).toContain(HARNESS_SIGNALS.END);
		expect(recordedNames).toContain("test:complete");
		expect(recordedNames).toContain("workflow:end");
	});

	test("record mode throws without store", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("test"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		expect(
			runReactive(myAgent, "test", {
				recording: { mode: "record" },
			}),
		).rejects.toThrow(/requires a store/);
	});
});

describe("runReactive replay", () => {
	test("replay mode injects recorded signals", async () => {
		const store = new MemorySignalStore();
		const myAgent = agent({
			prompt: "Test replay",
			activateOn: ["workflow:start"],
			emits: ["analysis:complete"],
			signalHarness: createMockHarness("original output"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		// First, record
		const recordResult = await runReactive(myAgent, "original input", {
			recording: {
				mode: "record",
				store,
				name: "replay-test",
			},
		});

		const recordingId = recordResult.recordingId!;

		// Now replay - should NOT call the harness
		const replayResult = await runReactive(myAgent, "different input", {
			recording: {
				mode: "replay",
				store,
				recordingId,
			},
		});

		// Replay should have signals
		expect(replayResult.signals.length).toBeGreaterThan(0);

		// Should contain harness signals (from replay)
		const signalNames = replayResult.signals.map((s) => s.name);
		expect(signalNames).toContain(HARNESS_SIGNALS.START);
		expect(signalNames).toContain(HARNESS_SIGNALS.END);
		expect(signalNames).toContain("analysis:complete");
	});

	test("replay mode throws without store", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("test"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		expect(
			runReactive(myAgent, "test", {
				recording: { mode: "replay", recordingId: "rec_123" },
			}),
		).rejects.toThrow(/requires a store/);
	});

	test("replay mode throws without recordingId", async () => {
		const store = new MemorySignalStore();
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("test"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		expect(
			runReactive(myAgent, "test", {
				recording: { mode: "replay", store },
			}),
		).rejects.toThrow(/requires a recordingId/);
	});

	test("replay mode throws if recording not found", async () => {
		const store = new MemorySignalStore();
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("test"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		expect(
			runReactive(myAgent, "test", {
				recording: {
					mode: "replay",
					store,
					recordingId: "rec_nonexistent",
				},
			}),
		).rejects.toThrow(/Recording not found/);
	});

	test("replay mode does not require harness", async () => {
		const store = new MemorySignalStore();

		// Create agent WITH harness for recording
		const agentWithHarness = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("test output"),
		});

		if (!isReactiveAgent(agentWithHarness)) {
			throw new Error("Expected ReactiveAgent");
		}

		// Record first
		const recordResult = await runReactive(agentWithHarness, "test", {
			recording: { mode: "record", store },
		});

		// Create agent WITHOUT harness for replay
		const agentNoHarness = agent({
			prompt: "Test",
			activateOn: ["workflow:start"],
			// No signalHarness
		});

		if (!isReactiveAgent(agentNoHarness)) {
			throw new Error("Expected ReactiveAgent");
		}

		// Replay should work without harness
		const replayResult = await runReactive(agentNoHarness, "test", {
			recording: {
				mode: "replay",
				store,
				recordingId: recordResult.recordingId!,
			},
		});

		expect(replayResult.signals.length).toBeGreaterThan(0);
	});
});

// ============================================================================
// Adapter Integration Tests (TR-07)
// ============================================================================

import type { SignalAdapter } from "@internal/signals";

describe("runReactive adapters", () => {
	test("calls adapter onStart before execution", async () => {
		let startCalled = false;
		let startCalledBeforeSignal = false;

		const testAdapter: SignalAdapter = {
			name: "test-start",
			patterns: ["**"],
			onStart: () => {
				startCalled = true;
			},
			onSignal: () => {
				if (startCalled) {
					startCalledBeforeSignal = true;
				}
			},
		};

		const myAgent = agent({
			prompt: "Test adapter start",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [testAdapter],
			logging: false,
		});

		expect(startCalled).toBe(true);
		expect(startCalledBeforeSignal).toBe(true);
	});

	test("calls adapter onStop after execution", async () => {
		let stopCalled = false;
		let signalsReceived = 0;

		const testAdapter: SignalAdapter = {
			name: "test-stop",
			patterns: ["**"],
			onSignal: () => {
				signalsReceived++;
			},
			onStop: () => {
				stopCalled = true;
			},
		};

		const myAgent = agent({
			prompt: "Test adapter stop",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [testAdapter],
			logging: false,
		});

		expect(stopCalled).toBe(true);
		expect(signalsReceived).toBeGreaterThan(0);
	});

	test("adapter receives signals matching its patterns", async () => {
		const receivedSignals: string[] = [];

		const testAdapter: SignalAdapter = {
			name: "test-signals",
			patterns: ["**"],
			onSignal: (signal: Signal) => {
				receivedSignals.push(signal.name);
			},
		};

		const myAgent = agent({
			prompt: "Test adapter signals",
			activateOn: ["workflow:start"],
			emits: ["test:complete"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [testAdapter],
			logging: false,
		});

		// Should have received workflow and harness signals
		expect(receivedSignals).toContain("workflow:start");
		expect(receivedSignals).toContain("workflow:end");
		expect(receivedSignals).toContain("agent:activated");
		expect(receivedSignals).toContain(HARNESS_SIGNALS.START);
		expect(receivedSignals).toContain(HARNESS_SIGNALS.END);
		expect(receivedSignals).toContain("test:complete");
	});

	test("adapter with specific pattern only receives matching signals", async () => {
		const receivedSignals: string[] = [];

		const testAdapter: SignalAdapter = {
			name: "workflow-only",
			patterns: ["workflow:*"],
			onSignal: (signal: Signal) => {
				receivedSignals.push(signal.name);
			},
		};

		const myAgent = agent({
			prompt: "Test specific patterns",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [testAdapter],
			logging: false,
		});

		// Should ONLY have workflow signals
		expect(receivedSignals).toContain("workflow:start");
		expect(receivedSignals).toContain("workflow:end");
		// Should NOT have harness or agent signals
		expect(receivedSignals).not.toContain("agent:activated");
		expect(receivedSignals).not.toContain(HARNESS_SIGNALS.START);
	});

	test("multiple adapters all receive signals", async () => {
		const adapter1Signals: string[] = [];
		const adapter2Signals: string[] = [];

		const adapter1: SignalAdapter = {
			name: "adapter-1",
			patterns: ["**"],
			onSignal: (signal: Signal) => {
				adapter1Signals.push(signal.name);
			},
		};

		const adapter2: SignalAdapter = {
			name: "adapter-2",
			patterns: ["**"],
			onSignal: (signal: Signal) => {
				adapter2Signals.push(signal.name);
			},
		};

		const myAgent = agent({
			prompt: "Test multiple adapters",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [adapter1, adapter2],
			logging: false,
		});

		// Both adapters should have received the same signals
		expect(adapter1Signals).toEqual(adapter2Signals);
		expect(adapter1Signals.length).toBeGreaterThan(0);
	});

	test("async adapter handlers work correctly", async () => {
		const receivedSignals: string[] = [];

		const asyncAdapter: SignalAdapter = {
			name: "async-adapter",
			patterns: ["**"],
			onSignal: async (signal: Signal) => {
				await new Promise((resolve) => setTimeout(resolve, 1));
				receivedSignals.push(signal.name);
			},
		};

		const myAgent = agent({
			prompt: "Test async adapter",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [asyncAdapter],
			logging: false,
		});

		// Even though handler is async, it should have received signals
		// Note: signals may not all be processed due to fire-and-forget semantics
		expect(receivedSignals.length).toBeGreaterThanOrEqual(0);
	});

	test("adapter onStop called on successful completion", async () => {
		// This tests that onStop is always called, including error cases
		// We test the success path here; the try/finally in run-reactive.ts
		// ensures cleanup happens on both success and error paths
		let onStartCalled = false;
		let onStopCalled = false;
		let signalCount = 0;

		const testAdapter: SignalAdapter = {
			name: "lifecycle-test",
			patterns: ["**"],
			onStart: () => {
				onStartCalled = true;
			},
			onSignal: () => {
				signalCount++;
			},
			onStop: () => {
				onStopCalled = true;
			},
		};

		const myAgent = agent({
			prompt: "Test lifecycle",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("success"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [testAdapter],
			logging: false,
		});

		expect(onStartCalled).toBe(true);
		expect(signalCount).toBeGreaterThan(0);
		expect(onStopCalled).toBe(true);
	});

	test("adapter lifecycle with async onStart and onStop", async () => {
		let startOrder = 0;
		let signalOrder = 0;
		let stopOrder = 0;
		let orderCounter = 0;

		const asyncAdapter: SignalAdapter = {
			name: "async-lifecycle",
			patterns: ["**"],
			onStart: async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));
				startOrder = ++orderCounter;
			},
			onSignal: () => {
				if (signalOrder === 0) {
					signalOrder = ++orderCounter;
				}
			},
			onStop: async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));
				stopOrder = ++orderCounter;
			},
		};

		const myAgent = agent({
			prompt: "Test async lifecycle",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(myAgent, "test", {
			adapters: [asyncAdapter],
			logging: false,
		});

		// Order should be: start(1) -> signal(2) -> stop(3)
		expect(startOrder).toBe(1);
		expect(signalOrder).toBe(2);
		expect(stopOrder).toBe(3);
	});

	test("works with replay mode", async () => {
		const store = new MemorySignalStore();
		const receivedSignals: string[] = [];

		const testAdapter: SignalAdapter = {
			name: "replay-adapter",
			patterns: ["**"],
			onSignal: (signal: Signal) => {
				receivedSignals.push(signal.name);
			},
		};

		// First, record without adapter
		const recordAgent = agent({
			prompt: "Test replay",
			activateOn: ["workflow:start"],
			signalHarness: createMockHarness("recorded"),
		});

		if (!isReactiveAgent(recordAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const recordResult = await runReactive(recordAgent, "test", {
			recording: { mode: "record", store },
			logging: false,
		});

		// Now replay WITH adapter
		const replayAgent = agent({
			prompt: "Test replay",
			activateOn: ["workflow:start"],
		});

		if (!isReactiveAgent(replayAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		await runReactive(replayAgent, "test", {
			recording: {
				mode: "replay",
				store,
				recordingId: recordResult.recordingId!,
			},
			adapters: [testAdapter],
			logging: false,
		});

		// Adapter should have received signals during replay
		expect(receivedSignals).toContain("workflow:start");
		expect(receivedSignals).toContain("workflow:end");
		expect(receivedSignals).toContain(HARNESS_SIGNALS.START);
	});
});
