/**
 * Unit tests for CodexProvider
 *
 * These tests use a mock Codex SDK to test signal emission patterns
 * without hitting the real SDK.
 */

import { describe, expect, test } from "bun:test";
import { PROVIDER_SIGNALS, type Signal } from "@signals/core";
import { CodexProvider, type CodexProviderInput } from "../src/codex-provider.js";
import { collectSignals, createTestContext } from "./setup.js";

// ============================================================================
// Mock Codex SDK Types
// ============================================================================

interface MockEvent {
	type: string;
	[key: string]: unknown;
}

interface MockThread {
	id: string;
	runStreamed: (prompt: string, options?: unknown) => Promise<{ events: AsyncGenerator<MockEvent> }>;
}

interface MockCodex {
	startThread: (options?: unknown) => MockThread;
	resumeThread: (threadId: string) => MockThread;
}

// ============================================================================
// Mock Event Factories
// ============================================================================

function createMockThreadStarted(threadId: string): MockEvent {
	return {
		type: "thread.started",
		thread_id: threadId,
	};
}

function createMockItemUpdated(itemType: string, content: { text?: string; thinking?: string }): MockEvent {
	return {
		type: "item.updated",
		item: {
			type: itemType,
			...content,
		},
	};
}

function createMockItemStarted(
	itemType: string,
	options: { id?: string; name?: string; input?: unknown; command?: string },
): MockEvent {
	return {
		type: "item.started",
		item: {
			type: itemType,
			...options,
		},
	};
}

function createMockItemCompleted(
	itemType: string,
	options: { id?: string; name?: string; result?: unknown; error?: string },
): MockEvent {
	return {
		type: "item.completed",
		item: {
			type: itemType,
			...options,
		},
	};
}

function createMockTurnCompleted(options?: {
	usage?: { input_tokens: number; output_tokens: number };
	finalResponse?: unknown;
}): MockEvent {
	return {
		type: "turn.completed",
		...options,
	};
}

function createMockTurnFailed(error?: string): MockEvent {
	return {
		type: "turn.failed",
		error,
	};
}

// ============================================================================
// Mock Codex Factory
// ============================================================================

function createMockCodex(events: MockEvent[]): MockCodex {
	const mockThread: MockThread = {
		id: "mock-thread-123",
		runStreamed: async () => ({
			events: (async function* () {
				for (const event of events) {
					yield event;
				}
			})(),
		}),
	};

	return {
		startThread: () => mockThread,
		resumeThread: () => mockThread,
	};
}

// ============================================================================
// Tests
// ============================================================================

describe("CodexProvider", () => {
	describe("configuration", () => {
		test("has correct type and displayName", () => {
			const provider = new CodexProvider();
			expect(provider.type).toBe("codex");
			expect(provider.displayName).toBe("Codex (OpenAI)");
		});

		test("has correct capabilities", () => {
			const provider = new CodexProvider();
			expect(provider.capabilities).toEqual({
				streaming: true,
				structuredOutput: true,
				tools: true,
				resume: true,
			});
		});
	});

	describe("signal emission", () => {
		test("emits provider:start and provider:end for minimal run", async () => {
			const mockEvents = [createMockThreadStarted("test-thread"), createMockTurnCompleted()];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Hello" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(provider.run(input, ctx));

			// Should have provider:start, provider:end
			expect(signals.length).toBeGreaterThanOrEqual(2);
			expect(signals[0].name).toBe(PROVIDER_SIGNALS.START);
			expect(signals[signals.length - 1].name).toBe(PROVIDER_SIGNALS.END);

			// Result should be defined
			expect(result).toBeDefined();
			expect(result.threadId).toBe("test-thread");
		});

		test("emits text:delta for streaming text", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockItemUpdated("agent_message", { text: "Hello" }),
				createMockItemUpdated("agent_message", { text: " world" }),
				createMockTurnCompleted(),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Hello" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(provider.run(input, ctx));

			// Find text:delta signals
			const textDeltas = signals.filter((s) => s.name === PROVIDER_SIGNALS.TEXT_DELTA);
			expect(textDeltas.length).toBe(2);
			expect((textDeltas[0].payload as { content: string }).content).toBe("Hello");
			expect((textDeltas[1].payload as { content: string }).content).toBe(" world");

			// Should have text:complete
			const textComplete = signals.find((s) => s.name === PROVIDER_SIGNALS.TEXT_COMPLETE);
			expect(textComplete).toBeDefined();
			expect((textComplete!.payload as { content: string }).content).toBe("Hello world");

			// Result should have accumulated text
			expect(result.content).toBe("Hello world");
		});

		test("emits thinking:delta for streaming thinking", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockItemUpdated("reasoning", { thinking: "Let me think" }),
				createMockItemUpdated("reasoning", { thinking: "..." }),
				createMockItemUpdated("agent_message", { text: "Here's my answer" }),
				createMockTurnCompleted(),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Think about this" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(provider.run(input, ctx));

			// Find thinking:delta signals
			const thinkingDeltas = signals.filter((s) => s.name === PROVIDER_SIGNALS.THINKING_DELTA);
			expect(thinkingDeltas.length).toBe(2);

			// Should have thinking:complete
			const thinkingComplete = signals.find((s) => s.name === PROVIDER_SIGNALS.THINKING_COMPLETE);
			expect(thinkingComplete).toBeDefined();
			expect((thinkingComplete!.payload as { content: string }).content).toBe("Let me think...");
		});

		test("emits tool:call for MCP tool use", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockItemStarted("mcp_tool_call", {
					id: "tool-123",
					name: "read_file",
					input: { path: "/test.txt" },
				}),
				createMockItemCompleted("mcp_tool_call", {
					id: "tool-123",
					name: "read_file",
					result: { content: "file contents" },
				}),
				createMockTurnCompleted(),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Read the file" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(provider.run(input, ctx));

			// Find tool:call signal
			const toolCall = signals.find((s) => s.name === PROVIDER_SIGNALS.TOOL_CALL);
			expect(toolCall).toBeDefined();
			expect((toolCall!.payload as { id: string }).id).toBe("tool-123");
			expect((toolCall!.payload as { name: string }).name).toBe("read_file");
			expect((toolCall!.payload as { input: unknown }).input).toEqual({ path: "/test.txt" });

			// Find tool:result signal
			const toolResult = signals.find((s) => s.name === PROVIDER_SIGNALS.TOOL_RESULT);
			expect(toolResult).toBeDefined();
			expect((toolResult!.payload as { id: string }).id).toBe("tool-123");

			// Result should have tool calls
			expect(result.toolCalls).toHaveLength(1);
			expect(result.toolCalls![0].id).toBe("tool-123");
		});

		test("emits tool:call for shell command execution", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockItemStarted("command_execution", {
					id: "cmd-456",
					command: "ls -la",
				}),
				createMockItemCompleted("command_execution", {
					id: "cmd-456",
					result: "file1.txt\nfile2.txt",
				}),
				createMockTurnCompleted(),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "List files" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(provider.run(input, ctx));

			// Find tool:call signal - should be named "shell"
			const toolCall = signals.find((s) => s.name === PROVIDER_SIGNALS.TOOL_CALL);
			expect(toolCall).toBeDefined();
			expect((toolCall!.payload as { id: string }).id).toBe("cmd-456");
			expect((toolCall!.payload as { name: string }).name).toBe("shell");
			expect((toolCall!.payload as { input: { command: string } }).input.command).toBe("ls -la");

			// Find tool:result signal
			const toolResult = signals.find((s) => s.name === PROVIDER_SIGNALS.TOOL_RESULT);
			expect(toolResult).toBeDefined();
			expect((toolResult!.payload as { name: string }).name).toBe("shell");

			// Result should have tool calls
			expect(result.toolCalls).toHaveLength(1);
			expect(result.toolCalls![0].name).toBe("shell");
		});

		test("emits provider:error for turn failed", async () => {
			const mockEvents = [createMockThreadStarted("test-thread"), createMockTurnFailed("Rate limit exceeded")];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals, result } = await collectSignals(provider.run(input, ctx));

			// Find error signal
			const errorSignal = signals.find((s) => s.name === PROVIDER_SIGNALS.ERROR);
			expect(errorSignal).toBeDefined();
			expect((errorSignal!.payload as { message: string }).message).toContain("Rate limit exceeded");

			// Result should have error stop reason
			expect(result.stopReason).toBe("error");
		});

		test("includes usage in final output", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockTurnCompleted({
					usage: { input_tokens: 100, output_tokens: 50 },
				}),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { result } = await collectSignals(provider.run(input, ctx));

			expect(result.usage).toBeDefined();
			expect(result.usage!.inputTokens).toBe(100);
			expect(result.usage!.outputTokens).toBe(50);
			expect(result.usage!.totalTokens).toBe(150);
		});

		test("includes structured output in final output", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockTurnCompleted({
					finalResponse: { sentiment: "positive", score: 0.9 },
				}),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { result } = await collectSignals(provider.run(input, ctx));

			expect(result.structuredOutput).toEqual({ sentiment: "positive", score: 0.9 });
		});

		test("all signals have source.provider", async () => {
			const mockEvents = [
				createMockThreadStarted("test-thread"),
				createMockItemUpdated("agent_message", { text: "Hello" }),
				createMockTurnCompleted(),
			];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(provider.run(input, ctx));

			// All signals should have source.provider = "codex"
			for (const signal of signals) {
				expect(signal.source?.provider).toBe("codex");
			}
		});

		test("all signals have valid timestamps", async () => {
			const mockEvents = [createMockThreadStarted("test-thread"), createMockTurnCompleted()];

			const mockCodex = createMockCodex(mockEvents);
			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			const { signals } = await collectSignals(provider.run(input, ctx));

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

			const slowMockCodex: MockCodex = {
				startThread: () => ({
					id: "test-thread",
					runStreamed: async () => ({
						events: (async function* () {
							yield createMockThreadStarted("test-thread");
							for (let i = 0; i < 10; i++) {
								yieldCount++;
								await new Promise((resolve) => setTimeout(resolve, 10));
								yield createMockItemUpdated("agent_message", { text: `chunk-${i}` });
							}
							yield createMockTurnCompleted();
						})(),
					}),
				}),
				resumeThread: () => ({
					id: "test-thread",
					runStreamed: async () => ({ events: (async function* () {})() }),
				}),
			};

			const provider = new CodexProvider({
				codex: slowMockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Test" }],
			};
			const ctx = createTestContext();

			// Start the run
			const generator = provider.run(input, ctx);

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
		test("uses resumeThread when sessionId is provided", async () => {
			let resumedWithId: string | undefined;

			const mockCodex: MockCodex = {
				startThread: () => ({
					id: "new-thread",
					runStreamed: async () => ({
						events: (async function* () {
							yield createMockThreadStarted("new-thread");
							yield createMockTurnCompleted();
						})(),
					}),
				}),
				resumeThread: (threadId: string) => {
					resumedWithId = threadId;
					return {
						id: threadId,
						runStreamed: async () => ({
							events: (async function* () {
								yield createMockThreadStarted(threadId);
								yield createMockTurnCompleted();
							})(),
						}),
					};
				},
			};

			const provider = new CodexProvider({
				codex: mockCodex as unknown as import("@openai/codex-sdk").Codex,
			});

			const input: CodexProviderInput = {
				messages: [{ role: "user", content: "Continue" }],
				sessionId: "existing-thread",
			};
			const ctx = createTestContext();

			await collectSignals(provider.run(input, ctx));

			expect(resumedWithId).toBe("existing-thread");
		});
	});
});
