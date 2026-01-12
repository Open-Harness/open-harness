import { describe, expect, test } from "bun:test";
import {
	HARNESS_SIGNALS,
	type Harness,
	type HarnessInput,
	HarnessInputSchema,
	HarnessOutputSchema,
	type RunContext,
	SignalSchema,
} from "../src/index.js";
import { createSignal } from "../src/signal.js";

describe("Harness types", () => {
	describe("HARNESS_SIGNALS", () => {
		test("defines lifecycle signals", () => {
			expect(HARNESS_SIGNALS.START).toBe("harness:start");
			expect(HARNESS_SIGNALS.END).toBe("harness:end");
			expect(HARNESS_SIGNALS.ERROR).toBe("harness:error");
		});

		test("defines text streaming signals", () => {
			expect(HARNESS_SIGNALS.TEXT_DELTA).toBe("text:delta");
			expect(HARNESS_SIGNALS.TEXT_COMPLETE).toBe("text:complete");
		});

		test("defines thinking signals", () => {
			expect(HARNESS_SIGNALS.THINKING_DELTA).toBe("thinking:delta");
			expect(HARNESS_SIGNALS.THINKING_COMPLETE).toBe("thinking:complete");
		});

		test("defines tool signals", () => {
			expect(HARNESS_SIGNALS.TOOL_CALL).toBe("tool:call");
			expect(HARNESS_SIGNALS.TOOL_RESULT).toBe("tool:result");
		});
	});

	describe("Harness interface", () => {
		test("can define a minimal harness", () => {
			const mockHarness: Harness = {
				type: "mock",
				displayName: "Mock Harness",
				capabilities: {
					streaming: true,
					structuredOutput: false,
					tools: false,
					resume: false,
				},
				async *run(input: HarnessInput, _ctx: RunContext) {
					yield createSignal(HARNESS_SIGNALS.START, { input }, { harness: "mock" });
					yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "Hello" }, { harness: "mock" });
					yield createSignal(
						HARNESS_SIGNALS.END,
						{ output: { content: "Hello" }, durationMs: 100 },
						{ harness: "mock" },
					);
					return { content: "Hello", stopReason: "end" };
				},
			};

			expect(mockHarness.type).toBe("mock");
			expect(mockHarness.capabilities.streaming).toBe(true);
		});

		test("harness run returns async generator", async () => {
			const mockHarness: Harness = {
				type: "test",
				displayName: "Test",
				capabilities: {
					streaming: true,
					structuredOutput: false,
					tools: false,
					resume: false,
				},
				async *run(_input, _ctx) {
					yield createSignal("text:delta", { content: "Hi" });
					return { content: "Hi", stopReason: "end" };
				},
			};

			const ctx: RunContext = {
				signal: new AbortController().signal,
				runId: "test-run-1",
			};

			const gen = mockHarness.run({ messages: [] }, ctx);
			const signals = [];

			for await (const signal of gen) {
				signals.push(signal);
			}

			expect(signals.length).toBeGreaterThan(0);
			expect(signals[0].name).toBe("text:delta");
		});
	});
});

describe("Harness schemas", () => {
	describe("HarnessInputSchema", () => {
		test("validates minimal input", () => {
			const input = {
				messages: [{ role: "user", content: "Hello" }],
			};

			const result = HarnessInputSchema.safeParse(input);
			expect(result.success).toBe(true);
		});

		test("validates full input", () => {
			const input = {
				system: "You are a helpful assistant",
				messages: [
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi there!" },
				],
				tools: [
					{
						name: "get_weather",
						description: "Get the weather",
						inputSchema: { type: "object" },
					},
				],
				maxTokens: 1000,
				temperature: 0.7,
			};

			const result = HarnessInputSchema.safeParse(input);
			expect(result.success).toBe(true);
		});

		test("rejects invalid role", () => {
			const input = {
				messages: [{ role: "invalid", content: "Hello" }],
			};

			const result = HarnessInputSchema.safeParse(input);
			expect(result.success).toBe(false);
		});

		test("rejects invalid temperature", () => {
			const input = {
				messages: [{ role: "user", content: "Hello" }],
				temperature: 2.0, // > 1
			};

			const result = HarnessInputSchema.safeParse(input);
			expect(result.success).toBe(false);
		});
	});

	describe("HarnessOutputSchema", () => {
		test("validates minimal output", () => {
			const output = {
				content: "Hello!",
			};

			const result = HarnessOutputSchema.safeParse(output);
			expect(result.success).toBe(true);
		});

		test("validates output with tool calls", () => {
			const output = {
				content: "",
				toolCalls: [
					{
						id: "call_123",
						name: "get_weather",
						input: { city: "NYC" },
					},
				],
				stopReason: "tool_use",
			};

			const result = HarnessOutputSchema.safeParse(output);
			expect(result.success).toBe(true);
		});

		test("validates output with usage", () => {
			const output = {
				content: "Response",
				usage: {
					inputTokens: 10,
					outputTokens: 20,
					totalTokens: 30,
				},
				stopReason: "end",
			};

			const result = HarnessOutputSchema.safeParse(output);
			expect(result.success).toBe(true);
		});

		test("rejects invalid stop reason", () => {
			const output = {
				content: "Hello",
				stopReason: "unknown",
			};

			const result = HarnessOutputSchema.safeParse(output);
			expect(result.success).toBe(false);
		});
	});

	describe("SignalSchema", () => {
		test("validates signal with source", () => {
			const signal = {
				id: "sig_test123",
				name: "text:delta",
				payload: { content: "Hello" },
				timestamp: new Date().toISOString(),
				source: {
					harness: "claude",
					agent: "analyst",
				},
			};

			const result = SignalSchema.safeParse(signal);
			expect(result.success).toBe(true);
		});

		test("validates signal without source", () => {
			const signal = {
				id: "sig_abc456",
				name: "workflow:start",
				payload: {},
				timestamp: new Date().toISOString(),
			};

			const result = SignalSchema.safeParse(signal);
			expect(result.success).toBe(true);
		});

		test("rejects invalid timestamp", () => {
			const signal = {
				id: "sig_invalid",
				name: "test",
				payload: null,
				timestamp: "not-a-date",
			};

			const result = SignalSchema.safeParse(signal);
			expect(result.success).toBe(false);
		});
	});
});
