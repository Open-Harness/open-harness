/**
 * Unit tests for ClaudeHarness
 *
 * These tests use a mock query function to test signal emission patterns
 * without hitting the real SDK.
 */

import { describe, expect, test } from "bun:test";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { HARNESS_SIGNALS, type Signal } from "@internal/signals-core";
import { ClaudeHarness, type ClaudeHarnessInput } from "../src/claude-harness.js";
import { collectSignals, createTestContext } from "./setup.js";

// ============================================================================
// Mock SDK Messages
// ============================================================================

function createMockStreamEvent(type: "text_delta" | "thinking_delta", content: string): unknown {
	return {
		type: "stream_event",
		event: {
			type: "content_block_delta",
			delta:
				type === "text_delta" ? { type: "text_delta", text: content } : { type: "thinking_delta", thinking: content },
		},
		parent_tool_use_id: null,
		uuid: crypto.randomUUID(),
		session_id: "test-session",
	};
}

function createMockAssistantMessage(
	content: Array<{ type: string; [key: string]: unknown }>,
	sessionId?: string,
): unknown {
	return {
		type: "assistant",
		message: { content },
		parent_tool_use_id: null,
		uuid: crypto.randomUUID(),
		session_id: sessionId ?? "test-session",
	};
}

function createMockToolResult(toolUseId: string, result: unknown, error?: string): unknown {
	return {
		type: "user",
		parent_tool_use_id: toolUseId,
		tool_use_result: error ? { result, error } : result,
		message: { role: "user", content: "" },
		session_id: "test-session",
	};
}

function createMockResult(options: {
	sessionId?: string;
	usage?: { input_tokens: number; output_tokens: number };
	structuredOutput?: unknown;
	numTurns?: number;
	subtype?: "success" | "error";
	errors?: string[];
}): unknown {
	return {
		type: "result",
		subtype: options.subtype ?? "success",
		session_id: options.sessionId ?? "test-session",
		usage: options.usage
			? {
					input_tokens: options.usage.input_tokens,
					output_tokens: options.usage.output_tokens,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				}
			: undefined,
		structured_output: options.structuredOutput,
		num_turns: options.numTurns,
		errors: options.errors,
		uuid: crypto.randomUUID(),
		duration_ms: 100,
		duration_api_ms: 80,
		is_error: false,
		result: "",
		total_cost_usd: 0,
		modelUsage: {},
		permission_denials: [],
	};
}

// ============================================================================
// Mock Query Function Factory
// ============================================================================

/**
 * Create a mock Query that yields predefined messages
 */
function createMockQuery(messages: unknown[]): Query {
	const generator = (async function* () {
		for (const msg of messages) {
			yield msg;
		}
	})();

	// Add the Query interface methods as stubs
	const query = generator as unknown as Query & Record<string, unknown>;
	query.interrupt = async () => {};
	query.setPermissionMode = async () => {};
	query.setModel = async () => {};
	query.setMaxThinkingTokens = async () => {};
	query.supportedCommands = async () => [];
	query.supportedModels = async () => [];
	query.mcpServerStatus = async () => [];
	query.accountInfo = async () => ({});
	query.rewindFiles = async () => {};
	query.setMcpServers = async () => ({ added: [], removed: [], errors: {} });
	query.streamInput = async () => {};

	return query;
}

// ============================================================================
// Tests
// ============================================================================

describe("ClaudeHarness", () => {
	describe("configuration", () => {
		test("has correct type and displayName", () => {
			const harness = new ClaudeHarness();
			expect(harness.type).toBe("claude");
			expect(harness.displayName).toBe("Claude (Anthropic)");
		});

		test("has correct capabilities", () => {
			const harness = new ClaudeHarness();
			expect(harness.capabilities).toEqual({
				streaming: true,
				structuredOutput: true,
				tools: true,
				resume: true,
			});
		});
	});

	describe("signal emission", () => {
		test("emits harness:start and harness:end for minimal run", async () => {
			const mockMessages = [createMockResult({ sessionId: "test-session" })];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Hello" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(harness.run(input, ctx));

			// Should have harness:start, harness:end
			expect(signals.length).toBeGreaterThanOrEqual(2);
			expect(signals[0].name).toBe(HARNESS_SIGNALS.START);
			expect(signals[signals.length - 1].name).toBe(HARNESS_SIGNALS.END);

			// Result should be defined
			expect(result).toBeDefined();
			expect(result.sessionId).toBe("test-session");
		});

		test("emits text:delta for streaming text", async () => {
			const mockMessages = [
				createMockStreamEvent("text_delta", "Hello"),
				createMockStreamEvent("text_delta", " world"),
				createMockResult({ sessionId: "test-session" }),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Hello" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(harness.run(input, ctx));

			// Find text:delta signals
			const textDeltas = signals.filter((s) => s.name === HARNESS_SIGNALS.TEXT_DELTA);
			expect(textDeltas.length).toBe(2);
			expect((textDeltas[0].payload as { content: string }).content).toBe("Hello");
			expect((textDeltas[1].payload as { content: string }).content).toBe(" world");

			// Should have text:complete
			const textComplete = signals.find((s) => s.name === HARNESS_SIGNALS.TEXT_COMPLETE);
			expect(textComplete).toBeDefined();
			expect((textComplete!.payload as { content: string }).content).toBe("Hello world");

			// Result should have accumulated text
			expect(result.content).toBe("Hello world");
		});

		test("emits thinking:delta for streaming thinking", async () => {
			const mockMessages = [
				createMockStreamEvent("thinking_delta", "Let me think"),
				createMockStreamEvent("thinking_delta", "..."),
				createMockStreamEvent("text_delta", "Here's my answer"),
				createMockResult({ sessionId: "test-session" }),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Think about this" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(harness.run(input, ctx));

			// Find thinking:delta signals
			const thinkingDeltas = signals.filter((s) => s.name === HARNESS_SIGNALS.THINKING_DELTA);
			expect(thinkingDeltas.length).toBe(2);

			// Should have thinking:complete
			const thinkingComplete = signals.find((s) => s.name === HARNESS_SIGNALS.THINKING_COMPLETE);
			expect(thinkingComplete).toBeDefined();
			expect((thinkingComplete!.payload as { content: string }).content).toBe("Let me think...");
		});

		test("emits tool:call for tool use", async () => {
			const mockMessages = [
				createMockAssistantMessage(
					[
						{
							type: "tool_use",
							id: "tool-123",
							name: "read_file",
							input: { path: "/test.txt" },
						},
					],
					"test-session",
				),
				createMockResult({ sessionId: "test-session" }),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Read the file" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(harness.run(input, ctx));

			// Find tool:call signal
			const toolCall = signals.find((s) => s.name === HARNESS_SIGNALS.TOOL_CALL);
			expect(toolCall).toBeDefined();
			expect((toolCall!.payload as { id: string }).id).toBe("tool-123");
			expect((toolCall!.payload as { name: string }).name).toBe("read_file");
			expect((toolCall!.payload as { input: unknown }).input).toEqual({ path: "/test.txt" });

			// Result should have tool calls
			expect(result.toolCalls).toHaveLength(1);
			expect(result.toolCalls![0].id).toBe("tool-123");
		});

		test("emits tool:result for tool results", async () => {
			const mockMessages = [
				createMockToolResult("tool-123", { content: "file contents" }),
				createMockResult({ sessionId: "test-session" }),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(harness.run(input, ctx));

			// Find tool:result signal
			const toolResult = signals.find((s) => s.name === HARNESS_SIGNALS.TOOL_RESULT);
			expect(toolResult).toBeDefined();
			expect((toolResult!.payload as { id: string }).id).toBe("tool-123");
		});

		test("emits harness:error for error results", async () => {
			const mockMessages = [
				createMockResult({
					sessionId: "test-session",
					subtype: "error",
					errors: ["Rate limit exceeded"],
				}),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(harness.run(input, ctx));

			// Find error signal
			const errorSignal = signals.find((s) => s.name === HARNESS_SIGNALS.ERROR);
			expect(errorSignal).toBeDefined();
			expect((errorSignal!.payload as { message: string }).message).toContain("Rate limit exceeded");

			// Result should have error stop reason
			expect(result.stopReason).toBe("error");
		});

		test("includes usage in final output", async () => {
			const mockMessages = [
				createMockResult({
					sessionId: "test-session",
					usage: { input_tokens: 100, output_tokens: 50 },
				}),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { result } = await collectSignals(harness.run(input, ctx));

			expect(result.usage).toBeDefined();
			expect(result.usage!.inputTokens).toBe(100);
			expect(result.usage!.outputTokens).toBe(50);
			expect(result.usage!.totalTokens).toBe(150);
		});

		test("includes structured output in final output", async () => {
			const mockMessages = [
				createMockResult({
					sessionId: "test-session",
					structuredOutput: { sentiment: "positive", score: 0.9 },
				}),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { result } = await collectSignals(harness.run(input, ctx));

			expect(result.structuredOutput).toEqual({ sentiment: "positive", score: 0.9 });
		});

		test("all signals have source.harness", async () => {
			const mockMessages = [
				createMockStreamEvent("text_delta", "Hello"),
				createMockResult({ sessionId: "test-session" }),
			];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(harness.run(input, ctx));

			// All signals should have source.harness = "claude"
			for (const signal of signals) {
				expect(signal.source?.harness).toBe("claude");
			}
		});

		test("all signals have valid timestamps", async () => {
			const mockMessages = [createMockResult({ sessionId: "test-session" })];

			const harness = new ClaudeHarness({
				queryFn: () => createMockQuery(mockMessages),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(harness.run(input, ctx));

			// All signals should have valid ISO timestamps
			for (const signal of signals) {
				expect(signal.timestamp).toBeDefined();
				expect(new Date(signal.timestamp).getTime()).not.toBeNaN();
			}
		});
	});

	describe("abort handling", () => {
		test("stops processing on abort", async () => {
			let yieldCount = 0;

			function createSlowMockQuery(): Query {
				const generator = (async function* () {
					for (let i = 0; i < 10; i++) {
						yieldCount++;
						await new Promise((resolve) => setTimeout(resolve, 10));
						yield createMockStreamEvent("text_delta", `chunk-${i}`);
					}
					yield createMockResult({ sessionId: "test-session" });
				})();

				const query = generator as unknown as Query & Record<string, unknown>;
				query.interrupt = async () => {};
				query.setPermissionMode = async () => {};
				query.setModel = async () => {};
				query.setMaxThinkingTokens = async () => {};
				query.supportedCommands = async () => [];
				query.supportedModels = async () => [];
				query.mcpServerStatus = async () => [];
				query.accountInfo = async () => ({});
				query.rewindFiles = async () => {};
				query.setMcpServers = async () => ({ added: [], removed: [], errors: {} });
				query.streamInput = async () => {};

				return query;
			}

			const harness = new ClaudeHarness({
				queryFn: () => createSlowMockQuery(),
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			// Start the run
			const generator = harness.run(input, ctx);

			// Collect a few signals then abort
			const signals: Signal[] = [];
			for await (const signal of generator) {
				signals.push(signal);
				if (signals.length >= 3) {
					ctx.abort();
					break;
				}
			}

			// Should have stopped before processing all chunks
			expect(yieldCount).toBeLessThan(10);
		});
	});

	describe("session handling", () => {
		test("passes session ID for resume", async () => {
			let capturedOptions: unknown;

			const harness = new ClaudeHarness({
				queryFn: (args) => {
					capturedOptions = args.options;
					return createMockQuery([createMockResult({ sessionId: "existing-session" })]);
				},
			});

			const input: ClaudeHarnessInput = {
				messages: [{ role: "user", content: "Continue" }],
				sessionId: "existing-session",
			};
			const ctx = createTestContext();

			await collectSignals(harness.run(input, ctx));

			expect((capturedOptions as { resume?: string }).resume).toBe("existing-session");
		});
	});
});
