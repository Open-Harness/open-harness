/**
 * Unit tests for runReactive() function
 */

import { describe, test, expect } from "bun:test";
import { agent } from "../../src/api/agent.js";
import { runReactive } from "../../src/api/run-reactive.js";
import { isReactiveAgent } from "../../src/api/types.js";
import {
	createSignal,
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderInput,
	type ProviderOutput,
	type RunContext,
	type Signal,
} from "@signals/core";
import { MemorySignalStore } from "@signals/bus";

// ============================================================================
// Mock Provider
// ============================================================================

/**
 * Create a mock provider that yields predictable signals
 */
function createMockProvider(response: string): Provider {
	return {
		type: "mock",
		displayName: "Mock Provider",
		capabilities: {
			streaming: true,
			structuredOutput: false,
			tools: false,
			resume: false,
		},
		async *run(
			input: ProviderInput,
			ctx: RunContext,
		): AsyncGenerator<Signal, ProviderOutput> {
			yield createSignal(PROVIDER_SIGNALS.START, { input });
			yield createSignal(PROVIDER_SIGNALS.TEXT_DELTA, { content: response });
			yield createSignal(PROVIDER_SIGNALS.TEXT_COMPLETE, { content: response });
			yield createSignal(PROVIDER_SIGNALS.END, {
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
			activateOn: ["harness:start"],
		});

		expect(myAgent._tag).toBe("Agent");
		expect("_reactive" in myAgent).toBe(true);
		expect(isReactiveAgent(myAgent)).toBe(true);
	});

	test("accepts all reactive properties", () => {
		const provider = createMockProvider("test");

		const myAgent = agent({
			prompt: "Analyze data",
			activateOn: ["harness:start", "data:updated"],
			emits: ["analysis:complete"],
			signalProvider: provider,
		});

		expect(isReactiveAgent(myAgent)).toBe(true);
		expect(myAgent.config.activateOn).toEqual(["harness:start", "data:updated"]);
		expect(myAgent.config.emits).toEqual(["analysis:complete"]);
		expect(myAgent.config.signalProvider).toBe(provider);
	});
});

describe("runReactive", () => {
	test("emits harness:start and harness:end", async () => {
		const myAgent = agent({
			prompt: "You are helpful",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("Hello!"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "Hi");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("harness:start");
		expect(signalNames).toContain("harness:end");

		// harness:start should be first
		expect(signalNames[0]).toBe("harness:start");

		// harness:end should be last
		expect(signalNames[signalNames.length - 1]).toBe("harness:end");
	});

	test("activates agent on matching signal", async () => {
		const myAgent = agent({
			prompt: "Analyze data",
			activateOn: ["harness:start"],
			emits: ["analysis:complete"],
			signalProvider: createMockProvider("Analysis done"),
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

	test("emits provider signals to bus", async () => {
		const myAgent = agent({
			prompt: "Test provider",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("Provider response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain(PROVIDER_SIGNALS.START);
		expect(signalNames).toContain(PROVIDER_SIGNALS.TEXT_DELTA);
		expect(signalNames).toContain(PROVIDER_SIGNALS.TEXT_COMPLETE);
		expect(signalNames).toContain(PROVIDER_SIGNALS.END);
	});

	test("emits declared signals from emits array", async () => {
		const myAgent = agent({
			prompt: "Trade executor",
			activateOn: ["harness:start"],
			emits: ["trade:proposed", "trade:executed"],
			signalProvider: createMockProvider("Trade executed"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "Buy AAPL");

		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("trade:proposed");
		expect(signalNames).toContain("trade:executed");
	});

	test("uses agent signalProvider", async () => {
		const customProvider = createMockProvider("Custom response");

		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			signalProvider: customProvider,
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		// Check the output from provider:end signal
		const endSignal = result.signals.find(
			(s) => s.name === PROVIDER_SIGNALS.END,
		);
		expect(endSignal).toBeDefined();
		expect((endSignal?.payload as { output: { content: string } }).output.content).toBe(
			"Custom response",
		);
	});

	test("uses options.provider when agent has no signalProvider", async () => {
		const defaultProvider = createMockProvider("Default response");

		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			// No signalProvider
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test", {
			provider: defaultProvider,
		});

		const endSignal = result.signals.find(
			(s) => s.name === PROVIDER_SIGNALS.END,
		);
		expect(endSignal).toBeDefined();
		expect((endSignal?.payload as { output: { content: string } }).output.content).toBe(
			"Default response",
		);
	});

	test("throws error when no provider is specified", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			// No signalProvider
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		expect(runReactive(myAgent, "test")).rejects.toThrow(
			/No provider specified/,
		);
	});

	test("returns duration in metrics", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("response"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("harness:end contains output and duration", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("final output"),
		});

		if (!isReactiveAgent(myAgent)) {
			throw new Error("Expected ReactiveAgent");
		}

		const result = await runReactive(myAgent, "test");

		const endSignal = result.signals.find((s) => s.name === "harness:end");
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
			activateOn: ["harness:start"],
			emits: ["test:complete"],
			signalProvider: createMockProvider("recorded output"),
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
		expect(recordedNames).toContain("harness:start");
		expect(recordedNames).toContain("agent:activated");
		expect(recordedNames).toContain(PROVIDER_SIGNALS.START);
		expect(recordedNames).toContain(PROVIDER_SIGNALS.END);
		expect(recordedNames).toContain("test:complete");
		expect(recordedNames).toContain("harness:end");
	});

	test("record mode throws without store", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("test"),
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
			activateOn: ["harness:start"],
			emits: ["analysis:complete"],
			signalProvider: createMockProvider("original output"),
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

		// Now replay - should NOT call the provider
		const replayResult = await runReactive(myAgent, "different input", {
			recording: {
				mode: "replay",
				store,
				recordingId,
			},
		});

		// Replay should have signals
		expect(replayResult.signals.length).toBeGreaterThan(0);

		// Should contain provider signals (from replay)
		const signalNames = replayResult.signals.map((s) => s.name);
		expect(signalNames).toContain(PROVIDER_SIGNALS.START);
		expect(signalNames).toContain(PROVIDER_SIGNALS.END);
		expect(signalNames).toContain("analysis:complete");
	});

	test("replay mode throws without store", async () => {
		const myAgent = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("test"),
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
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("test"),
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
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("test"),
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

	test("replay mode does not require provider", async () => {
		const store = new MemorySignalStore();

		// Create agent WITH provider for recording
		const agentWithProvider = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			signalProvider: createMockProvider("test output"),
		});

		if (!isReactiveAgent(agentWithProvider)) {
			throw new Error("Expected ReactiveAgent");
		}

		// Record first
		const recordResult = await runReactive(agentWithProvider, "test", {
			recording: { mode: "record", store },
		});

		// Create agent WITHOUT provider for replay
		const agentNoProvider = agent({
			prompt: "Test",
			activateOn: ["harness:start"],
			// No signalProvider
		});

		if (!isReactiveAgent(agentNoProvider)) {
			throw new Error("Expected ReactiveAgent");
		}

		// Replay should work without provider
		const replayResult = await runReactive(agentNoProvider, "test", {
			recording: {
				mode: "replay",
				store,
				recordingId: recordResult.recordingId!,
			},
		});

		expect(replayResult.signals.length).toBeGreaterThan(0);
	});
});
