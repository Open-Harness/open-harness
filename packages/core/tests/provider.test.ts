import { describe, expect, test } from "bun:test";
import {
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderInput,
	ProviderInputSchema,
	ProviderOutputSchema,
	type RunContext,
	SignalSchema,
} from "../src/index.js";
import { createSignal } from "../src/signal.js";

describe("Provider types", () => {
	describe("PROVIDER_SIGNALS", () => {
		test("defines lifecycle signals", () => {
			expect(PROVIDER_SIGNALS.START).toBe("provider:start");
			expect(PROVIDER_SIGNALS.END).toBe("provider:end");
			expect(PROVIDER_SIGNALS.ERROR).toBe("provider:error");
		});

		test("defines text streaming signals", () => {
			expect(PROVIDER_SIGNALS.TEXT_DELTA).toBe("text:delta");
			expect(PROVIDER_SIGNALS.TEXT_COMPLETE).toBe("text:complete");
		});

		test("defines thinking signals", () => {
			expect(PROVIDER_SIGNALS.THINKING_DELTA).toBe("thinking:delta");
			expect(PROVIDER_SIGNALS.THINKING_COMPLETE).toBe("thinking:complete");
		});

		test("defines tool signals", () => {
			expect(PROVIDER_SIGNALS.TOOL_CALL).toBe("tool:call");
			expect(PROVIDER_SIGNALS.TOOL_RESULT).toBe("tool:result");
		});
	});

	describe("Provider interface", () => {
		test("can define a minimal provider", () => {
			const mockProvider: Provider = {
				type: "mock",
				displayName: "Mock Provider",
				capabilities: {
					streaming: true,
					structuredOutput: false,
					tools: false,
					resume: false,
				},
				async *run(input: ProviderInput, _ctx: RunContext) {
					yield createSignal(PROVIDER_SIGNALS.START, { input }, { provider: "mock" });
					yield createSignal(PROVIDER_SIGNALS.TEXT_DELTA, { content: "Hello" }, { provider: "mock" });
					yield createSignal(
						PROVIDER_SIGNALS.END,
						{ output: { content: "Hello" }, durationMs: 100 },
						{ provider: "mock" },
					);
					return { content: "Hello", stopReason: "end" };
				},
			};

			expect(mockProvider.type).toBe("mock");
			expect(mockProvider.capabilities.streaming).toBe(true);
		});

		test("provider run returns async generator", async () => {
			const mockProvider: Provider = {
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

			const gen = mockProvider.run({ messages: [] }, ctx);
			const signals = [];

			for await (const signal of gen) {
				signals.push(signal);
			}

			expect(signals.length).toBeGreaterThan(0);
			expect(signals[0].name).toBe("text:delta");
		});
	});
});

describe("Provider schemas", () => {
	describe("ProviderInputSchema", () => {
		test("validates minimal input", () => {
			const input = {
				messages: [{ role: "user", content: "Hello" }],
			};

			const result = ProviderInputSchema.safeParse(input);
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

			const result = ProviderInputSchema.safeParse(input);
			expect(result.success).toBe(true);
		});

		test("rejects invalid role", () => {
			const input = {
				messages: [{ role: "invalid", content: "Hello" }],
			};

			const result = ProviderInputSchema.safeParse(input);
			expect(result.success).toBe(false);
		});

		test("rejects invalid temperature", () => {
			const input = {
				messages: [{ role: "user", content: "Hello" }],
				temperature: 2.0, // > 1
			};

			const result = ProviderInputSchema.safeParse(input);
			expect(result.success).toBe(false);
		});
	});

	describe("ProviderOutputSchema", () => {
		test("validates minimal output", () => {
			const output = {
				content: "Hello!",
			};

			const result = ProviderOutputSchema.safeParse(output);
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

			const result = ProviderOutputSchema.safeParse(output);
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

			const result = ProviderOutputSchema.safeParse(output);
			expect(result.success).toBe(true);
		});

		test("rejects invalid stop reason", () => {
			const output = {
				content: "Hello",
				stopReason: "unknown",
			};

			const result = ProviderOutputSchema.safeParse(output);
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
					provider: "claude",
					agent: "analyst",
				},
			};

			const result = SignalSchema.safeParse(signal);
			expect(result.success).toBe(true);
		});

		test("validates signal without source", () => {
			const signal = {
				id: "sig_abc456",
				name: "harness:start",
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
