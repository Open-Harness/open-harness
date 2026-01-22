/**
 * ClaudeProvider Tests
 *
 * Tests for the Claude Agent SDK provider implementation.
 * Uses mocked SDK responses to test message mapping and event conversion.
 */

import type { SDKMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Cause, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import {
	ClaudeProviderLive,
	createClaudeProvider,
	makeClaudeProviderLive,
	makeClaudeProviderService,
} from "../src/provider/ClaudeProvider.js";
import { LLMProvider, ProviderError } from "../src/provider/Provider.js";

// ============================================================================
// Mock SDK Types
// ============================================================================

type MockQueryFn = (args: { prompt: AsyncGenerator<SDKUserMessage>; options: unknown }) => AsyncGenerator<SDKMessage>;

/**
 * Creates a mock query function that yields the provided messages.
 */
function createMockQuery(messages: SDKMessage[]): MockQueryFn {
	return async function* mockQuery() {
		for (const message of messages) {
			yield message;
		}
	};
}

/**
 * Creates a mock query function that throws an error.
 * Uses a wrapper to properly throw in the async generator context.
 */
function createErrorQuery(error: Error): MockQueryFn {
	// biome-ignore lint/correctness/useYield: Intentionally throws before yield for error testing
	return async function* mockQuery() {
		await Promise.resolve();
		throw error;
	};
}

// ============================================================================
// Test Fixtures
// ============================================================================

const textDeltaStreamEvent: SDKMessage = {
	type: "stream_event",
	event: {
		type: "content_block_delta",
		delta: {
			type: "text_delta",
			text: "Hello",
		},
	},
} as unknown as SDKMessage;

const textDeltaStreamEvent2: SDKMessage = {
	type: "stream_event",
	event: {
		type: "content_block_delta",
		delta: {
			type: "text_delta",
			text: " World",
		},
	},
} as unknown as SDKMessage;

const assistantTextMessage: SDKMessage = {
	type: "assistant",
	message: {
		content: [
			{
				type: "text",
				text: "This is a complete response.",
			},
		],
	},
} as unknown as SDKMessage;

const toolUseMessage: SDKMessage = {
	type: "assistant",
	message: {
		content: [
			{
				type: "tool_use",
				id: "tool_123",
				name: "get_weather",
				input: { location: "San Francisco" },
			},
		],
	},
} as unknown as SDKMessage;

const toolResultMessage: SDKMessage = {
	type: "user",
	tool_use_result: { temperature: 72, condition: "sunny" },
	parent_tool_use_id: "tool_123",
} as unknown as SDKMessage;

const successResult: SDKResultMessage = {
	type: "result",
	subtype: "success",
	session_id: "session_abc123",
	result: "Final result text",
	structured_output: { answer: 42 },
	duration_ms: 1500,
	num_turns: 1,
	usage: {
		input_tokens: 100,
		output_tokens: 50,
	},
} as unknown as SDKResultMessage;

const errorResult: SDKResultMessage = {
	type: "result",
	subtype: "error",
	session_id: "session_abc123",
	errors: ["Something went wrong", "Another error"],
} as unknown as SDKResultMessage;

// ============================================================================
// makeClaudeProviderService Tests
// ============================================================================

describe("makeClaudeProviderService", () => {
	describe("query method", () => {
		it("should return events from streaming text deltas", async () => {
			const mockQuery = createMockQuery([textDeltaStreamEvent, textDeltaStreamEvent2, successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(result.events).toHaveLength(3); // 2 text:delta + 1 text:complete
			expect(result.events[0]?.name).toBe("text:delta");
			expect(result.events[0]?.payload).toEqual({ delta: "Hello", agentName: "claude" });
			expect(result.events[1]?.name).toBe("text:delta");
			expect(result.events[1]?.payload).toEqual({ delta: " World", agentName: "claude" });
			expect(result.events[2]?.name).toBe("text:complete");
		});

		it("should return session ID from result", async () => {
			const mockQuery = createMockQuery([successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(result.sessionId).toBe("session_abc123");
		});

		it("should return structured output from result", async () => {
			const mockQuery = createMockQuery([successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(result.output).toEqual({ answer: 42 });
		});

		it("should return text from result", async () => {
			const mockQuery = createMockQuery([successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(result.text).toBe("Final result text");
		});

		it("should return stop reason from successful result", async () => {
			const mockQuery = createMockQuery([successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(result.stopReason).toBe("end_turn");
		});

		it("should emit tool:called event for tool use", async () => {
			const mockQuery = createMockQuery([toolUseMessage, successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(
				service.query({ messages: [{ role: "user", content: "What's the weather?" }] }),
			);

			const toolCalledEvent = result.events.find((e) => e.name === "tool:called");
			expect(toolCalledEvent).toBeDefined();
			expect(toolCalledEvent?.payload).toEqual({
				toolName: "get_weather",
				toolId: "tool_123",
				input: { location: "San Francisco" },
			});
		});

		it("should emit tool:result event for tool result", async () => {
			const mockQuery = createMockQuery([toolUseMessage, toolResultMessage, successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const result = await Effect.runPromise(
				service.query({ messages: [{ role: "user", content: "What's the weather?" }] }),
			);

			const toolResultEvent = result.events.find((e) => e.name === "tool:result");
			expect(toolResultEvent).toBeDefined();
			expect(toolResultEvent?.payload).toEqual({
				toolId: "tool_123",
				output: { temperature: 72, condition: "sunny" },
				isError: false,
			});
		});

		it("should throw ProviderError on error result", async () => {
			const mockQuery = createMockQuery([errorResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const exit = await Effect.runPromiseExit(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = Cause.failureOption(exit.cause);
				expect(error._tag).toBe("Some");
				if (error._tag === "Some") {
					expect(error.value).toBeInstanceOf(ProviderError);
				}
			}
		});

		it("should include error messages in ProviderError", async () => {
			const mockQuery = createMockQuery([errorResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const exit = await Effect.runPromiseExit(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = Cause.failureOption(exit.cause);
				expect(error._tag).toBe("Some");
				if (error._tag === "Some") {
					expect(error.value).toBeInstanceOf(ProviderError);
					expect((error.value as ProviderError).message).toContain("Something went wrong");
				}
			}
		});

		it("should throw ProviderError on exception", async () => {
			const mockQuery = createErrorQuery(new Error("Network failure"));
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const exit = await Effect.runPromiseExit(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = Cause.failureOption(exit.cause);
				expect(error._tag).toBe("Some");
				if (error._tag === "Some") {
					expect(error.value).toBeInstanceOf(ProviderError);
					expect((error.value as ProviderError).code).toBe("PROVIDER_ERROR");
					expect((error.value as ProviderError).message).toContain("Network failure");
				}
			}
		});

		it("should handle AbortError specially", async () => {
			const abortError = new Error("Aborted");
			abortError.name = "AbortError";
			const mockQuery = createErrorQuery(abortError);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const exit = await Effect.runPromiseExit(service.query({ messages: [{ role: "user", content: "Hello" }] }));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = Cause.failureOption(exit.cause);
				expect(error._tag).toBe("Some");
				if (error._tag === "Some") {
					expect(error.value).toBeInstanceOf(ProviderError);
					expect((error.value as ProviderError).message).toContain("aborted");
					expect((error.value as ProviderError).retryable).toBe(false);
				}
			}
		});
	});

	describe("stream method", () => {
		it("should yield text chunks from stream events", async () => {
			const mockQuery = createMockQuery([textDeltaStreamEvent, textDeltaStreamEvent2, successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const chunks: unknown[] = [];
			const stream = service.stream({ messages: [{ role: "user", content: "Hello" }] });

			await Effect.runPromise(
				Stream.runForEach(stream, (chunk) =>
					Effect.sync(() => {
						chunks.push(chunk);
					}),
				),
			);

			expect(chunks).toHaveLength(3); // 2 text + 1 stop
			expect(chunks[0]).toEqual({ type: "text", text: "Hello" });
			expect(chunks[1]).toEqual({ type: "text", text: " World" });
			expect(chunks[2]).toEqual({ type: "stop", stopReason: "end_turn" });
		});

		it("should yield tool_use chunks", async () => {
			const mockQuery = createMockQuery([toolUseMessage, successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const chunks: unknown[] = [];
			const stream = service.stream({ messages: [{ role: "user", content: "Weather?" }] });

			await Effect.runPromise(
				Stream.runForEach(stream, (chunk) =>
					Effect.sync(() => {
						chunks.push(chunk);
					}),
				),
			);

			const toolUseChunk = chunks.find((c) => (c as { type: string }).type === "tool_use");
			expect(toolUseChunk).toEqual({
				type: "tool_use",
				toolCall: {
					id: "tool_123",
					name: "get_weather",
					input: { location: "San Francisco" },
				},
			});
		});

		it("should yield stop chunk at end", async () => {
			const mockQuery = createMockQuery([successResult]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const chunks: unknown[] = [];
			const stream = service.stream({ messages: [{ role: "user", content: "Hello" }] });

			await Effect.runPromise(
				Stream.runForEach(stream, (chunk) =>
					Effect.sync(() => {
						chunks.push(chunk);
					}),
				),
			);

			expect(chunks[chunks.length - 1]).toEqual({ type: "stop", stopReason: "end_turn" });
		});

		it("should convert errors to ProviderError in stream", async () => {
			const mockQuery = createErrorQuery(new Error("Stream failed"));
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const stream = service.stream({ messages: [{ role: "user", content: "Hello" }] });

			const exit = await Effect.runPromiseExit(Stream.runCollect(stream));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const error = Cause.failureOption(exit.cause);
				expect(error._tag).toBe("Some");
				if (error._tag === "Some") {
					expect(error.value).toBeInstanceOf(ProviderError);
				}
			}
		});
	});

	describe("info method", () => {
		it("should return provider info with default model", async () => {
			const mockQuery = createMockQuery([]);
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const info = await Effect.runPromise(service.info());

			expect(info).toEqual({
				type: "claude",
				name: "Claude Agent SDK",
				model: "claude-sonnet-4-20250514",
				connected: true,
			});
		});

		it("should return configured model in info", async () => {
			const mockQuery = createMockQuery([]);
			const service = makeClaudeProviderService(
				{ model: "claude-opus-4-20250514" },
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const info = await Effect.runPromise(service.info());

			expect(info.model).toBe("claude-opus-4-20250514");
		});
	});
});

// ============================================================================
// Configuration Tests
// ============================================================================

describe("Configuration", () => {
	it("should use default model when not specified", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hi" }] }));

		expect((capturedOptions as { model: string }).model).toBe("claude-sonnet-4-20250514");
	});

	it("should use config model when specified", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{ model: "claude-haiku-3-20250514" },
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hi" }] }));

		expect((capturedOptions as { model: string }).model).toBe("claude-haiku-3-20250514");
	});

	it("should use query option model over config model", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{ model: "claude-haiku-3-20250514" },
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(
			service.query({
				messages: [{ role: "user", content: "Hi" }],
				model: "claude-opus-4-20250514",
			}),
		);

		expect((capturedOptions as { model: string }).model).toBe("claude-opus-4-20250514");
	});

	it("should pass outputFormat to SDK options", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(
			service.query({
				messages: [{ role: "user", content: "Hi" }],
				outputFormat: {
					type: "json_schema",
					schema: { type: "object", properties: { name: { type: "string" } } },
				},
			}),
		);

		expect((capturedOptions as { outputFormat: unknown }).outputFormat).toEqual({
			type: "json_schema",
			schema: { type: "object", properties: { name: { type: "string" } } },
		});
	});

	it("should pass sessionId as resume option", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(
			service.query({
				messages: [{ role: "user", content: "Hi" }],
				sessionId: "existing_session",
			}),
		);

		expect((capturedOptions as { resume: string }).resume).toBe("existing_session");
	});

	it("should pass maxTurns from config", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{ maxTurns: 5 },
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hi" }] }));

		expect((capturedOptions as { maxTurns: number }).maxTurns).toBe(5);
	});

	it("should pass permissionMode from config", async () => {
		let capturedOptions: unknown = null;
		const mockQuery: MockQueryFn = async function* (args) {
			capturedOptions = args.options;
			yield successResult;
		};

		const service = makeClaudeProviderService(
			{ permissionMode: "askUser" },
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);
		await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hi" }] }));

		expect((capturedOptions as { permissionMode: string }).permissionMode).toBe("askUser");
	});
});

// ============================================================================
// Layer Tests
// ============================================================================

describe("ClaudeProviderLive Layer", () => {
	it("should provide LLMProvider service", async () => {
		// Note: We can't easily inject mock here, so we just verify the Layer structure
		// Real integration tests would use actual SDK calls
		expect(ClaudeProviderLive).toBeDefined();
	});

	it("should be usable with Effect.provide", async () => {
		// Create a custom layer with mocked query for testing
		const mockQuery = createMockQuery([successResult]);
		const testLayer = Layer.succeed(
			LLMProvider,
			makeClaudeProviderService({}, mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query),
		);

		const program = Effect.gen(function* () {
			const provider = yield* LLMProvider;
			return yield* provider.info();
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

		expect(result.type).toBe("claude");
		expect(result.name).toBe("Claude Agent SDK");
	});

	it("should allow querying via Layer", async () => {
		const mockQuery = createMockQuery([textDeltaStreamEvent, successResult]);
		const testLayer = Layer.succeed(
			LLMProvider,
			makeClaudeProviderService({}, mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query),
		);

		const program = Effect.gen(function* () {
			const provider = yield* LLMProvider;
			return yield* provider.query({ messages: [{ role: "user", content: "Hello" }] });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));

		expect(result.events.length).toBeGreaterThan(0);
		expect(result.sessionId).toBe("session_abc123");
	});
});

describe("makeClaudeProviderLive factory", () => {
	it("should create Layer with custom config", async () => {
		const layer = makeClaudeProviderLive({ model: "claude-opus-4-20250514" });
		expect(layer).toBeDefined();
	});
});

// ============================================================================
// createClaudeProvider (Promise API) Tests
// ============================================================================

describe("createClaudeProvider", () => {
	it("should return provider with query method", async () => {
		// Note: This would call real SDK without mocking
		// In real tests, we'd need to mock at module level
		const provider = await createClaudeProvider();

		expect(provider.query).toBeInstanceOf(Function);
		expect(provider.stream).toBeInstanceOf(Function);
		expect(provider.info).toBeInstanceOf(Function);
	});

	it("should have info method that returns provider info", async () => {
		const provider = await createClaudeProvider({ model: "claude-haiku-3-20250514" });
		const info = await provider.info();

		expect(info.type).toBe("claude");
		expect(info.model).toBe("claude-haiku-3-20250514");
	});
});

// ============================================================================
// Event Mapping Tests
// ============================================================================

describe("Event Mapping", () => {
	it("should create events with proper structure", async () => {
		const mockQuery = createMockQuery([textDeltaStreamEvent, successResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

		const event = result.events[0];
		expect(event).toBeDefined();
		expect(event?.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
		expect(event?.name).toBe("text:delta");
		expect(event?.timestamp).toBeInstanceOf(Date);
		expect(event?.payload).toEqual({ delta: "Hello", agentName: "claude" });
	});

	it("should add text:complete event with accumulated text", async () => {
		// Use a result without a text result field to verify streaming text accumulation
		const noTextResult: SDKResultMessage = {
			type: "result",
			subtype: "success",
			session_id: "session_abc123",
			result: undefined, // No final text - uses accumulated streaming text
			structured_output: undefined,
		} as unknown as SDKResultMessage;

		const mockQuery = createMockQuery([textDeltaStreamEvent, textDeltaStreamEvent2, noTextResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

		const completeEvent = result.events.find((e) => e.name === "text:complete");
		expect(completeEvent).toBeDefined();
		expect(completeEvent?.payload).toEqual({
			fullText: "Hello World",
			agentName: "claude",
		});
	});

	it("should handle assistant message with text blocks", async () => {
		const mockQuery = createMockQuery([assistantTextMessage, successResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

		// Assistant text blocks don't emit text:delta events, only final result text matters
		// The text from assistantTextMessage would be in the message but not as a stream event
		expect(result.text).toBe("Final result text");
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
	it("should handle empty message array", async () => {
		const mockQuery = createMockQuery([successResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(service.query({ messages: [] }));

		expect(result.sessionId).toBe("session_abc123");
	});

	it("should handle multiple tool calls in one message", async () => {
		const multiToolMessage: SDKMessage = {
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						id: "tool_1",
						name: "get_time",
						input: { timezone: "UTC" },
					},
					{
						type: "tool_use",
						id: "tool_2",
						name: "get_weather",
						input: { location: "NYC" },
					},
				],
			},
		} as unknown as SDKMessage;

		const mockQuery = createMockQuery([multiToolMessage, successResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(
			service.query({ messages: [{ role: "user", content: "Time and weather?" }] }),
		);

		const toolCalls = result.events.filter((e) => e.name === "tool:called");
		expect(toolCalls).toHaveLength(2);
		expect(toolCalls[0]?.payload).toEqual({
			toolName: "get_time",
			toolId: "tool_1",
			input: { timezone: "UTC" },
		});
		expect(toolCalls[1]?.payload).toEqual({
			toolName: "get_weather",
			toolId: "tool_2",
			input: { location: "NYC" },
		});
	});

	it("should handle tool result with error", async () => {
		const errorToolResult: SDKMessage = {
			type: "user",
			tool_use_result: { error: "Tool execution failed" },
			parent_tool_use_id: "tool_123",
		} as unknown as SDKMessage;

		const mockQuery = createMockQuery([toolUseMessage, errorToolResult, successResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Weather?" }] }));

		const toolResultEvent = result.events.find((e) => e.name === "tool:result");
		expect(toolResultEvent?.payload).toEqual({
			toolId: "tool_123",
			output: { error: "Tool execution failed" },
			isError: true,
		});
	});

	it("should handle result with no text", async () => {
		const noTextResult: SDKResultMessage = {
			type: "result",
			subtype: "success",
			session_id: "session_abc123",
			result: undefined,
			structured_output: { data: "only structured" },
		} as unknown as SDKResultMessage;

		const mockQuery = createMockQuery([noTextResult]);
		const service = makeClaudeProviderService(
			{},
			mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
		);

		const result = await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hello" }] }));

		expect(result.text).toBeUndefined();
		expect(result.output).toEqual({ data: "only structured" });
	});
});

// ============================================================================
// FR-064 Resource Safety Tests (Effect.acquireRelease)
// ============================================================================

describe("FR-064 Resource Safety", () => {
	describe("query method", () => {
		it("should create AbortController when none provided", async () => {
			let capturedOptions: unknown = null;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedOptions = args.options;
				yield successResult;
			};

			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hi" }] }));

			expect((capturedOptions as { abortController: AbortController }).abortController).toBeInstanceOf(AbortController);
		});

		it("should use provided AbortController", async () => {
			let capturedOptions: unknown = null;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedOptions = args.options;
				yield successResult;
			};

			const providedController = new AbortController();
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			await Effect.runPromise(
				service.query({
					messages: [{ role: "user", content: "Hi" }],
					abortController: providedController,
				}),
			);

			expect((capturedOptions as { abortController: AbortController }).abortController).toBe(providedController);
		});

		it("should abort internal controller on fiber interruption", async () => {
			let capturedController: AbortController | undefined;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedController = (args.options as { abortController: AbortController }).abortController;
				// Simulate a slow response that can be interrupted
				await new Promise((resolve) => setTimeout(resolve, 100));
				yield successResult;
			};

			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			// Start the query and then interrupt it
			const fiber = await Effect.runFork(service.query({ messages: [{ role: "user", content: "Hi" }] }));

			// Wait a bit for the query to start
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Interrupt the fiber
			await Effect.runPromise(Fiber.interrupt(fiber));

			// The controller should have been aborted
			expect(capturedController).toBeDefined();
			expect(capturedController?.signal.aborted).toBe(true);
		});

		it("should not abort user-provided controller on fiber interruption", async () => {
			let queryStarted = false;
			const mockQuery: MockQueryFn = async function* () {
				queryStarted = true;
				// Simulate a slow response
				await new Promise((resolve) => setTimeout(resolve, 100));
				yield successResult;
			};

			const providedController = new AbortController();
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const fiber = await Effect.runFork(
				service.query({
					messages: [{ role: "user", content: "Hi" }],
					abortController: providedController,
				}),
			);

			// Wait for query to start
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(queryStarted).toBe(true);

			// Interrupt the fiber
			await Effect.runPromise(Fiber.interrupt(fiber));

			// The user-provided controller should NOT be aborted
			// (user owns it and may want to reuse or handle it differently)
			expect(providedController.signal.aborted).toBe(false);
		});

		it("should not abort controller on success", async () => {
			let capturedController: AbortController | undefined;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedController = (args.options as { abortController: AbortController }).abortController;
				yield successResult;
			};

			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			await Effect.runPromise(service.query({ messages: [{ role: "user", content: "Hi" }] }));

			// Controller should exist but NOT be aborted on success
			expect(capturedController).toBeDefined();
			expect(capturedController?.signal.aborted).toBe(false);
		});
	});

	describe("stream method", () => {
		it("should create AbortController when none provided", async () => {
			let capturedOptions: unknown = null;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedOptions = args.options;
				yield textDeltaStreamEvent;
				yield successResult;
			};

			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			await Effect.runPromise(Stream.runCollect(service.stream({ messages: [{ role: "user", content: "Hi" }] })));

			expect((capturedOptions as { abortController: AbortController }).abortController).toBeInstanceOf(AbortController);
		});

		it("should use provided AbortController for stream", async () => {
			let capturedOptions: unknown = null;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedOptions = args.options;
				yield textDeltaStreamEvent;
				yield successResult;
			};

			const providedController = new AbortController();
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			await Effect.runPromise(
				Stream.runCollect(
					service.stream({
						messages: [{ role: "user", content: "Hi" }],
						abortController: providedController,
					}),
				),
			);

			expect((capturedOptions as { abortController: AbortController }).abortController).toBe(providedController);
		});

		it("should abort internal controller on stream interruption", async () => {
			let capturedController: AbortController | undefined;
			const mockQuery: MockQueryFn = async function* (args) {
				capturedController = (args.options as { abortController: AbortController }).abortController;
				yield textDeltaStreamEvent;
				// Simulate slow streaming
				await new Promise((resolve) => setTimeout(resolve, 100));
				yield textDeltaStreamEvent2;
				yield successResult;
			};

			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const fiber = await Effect.runFork(
				Stream.runCollect(service.stream({ messages: [{ role: "user", content: "Hi" }] })),
			);

			// Wait for stream to start
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Interrupt the fiber
			await Effect.runPromise(Fiber.interrupt(fiber));

			// The controller should have been aborted
			expect(capturedController).toBeDefined();
			expect(capturedController?.signal.aborted).toBe(true);
		});

		it("should not abort user-provided controller on stream interruption", async () => {
			let streamStarted = false;
			const mockQuery: MockQueryFn = async function* () {
				streamStarted = true;
				yield textDeltaStreamEvent;
				await new Promise((resolve) => setTimeout(resolve, 100));
				yield textDeltaStreamEvent2;
				yield successResult;
			};

			const providedController = new AbortController();
			const service = makeClaudeProviderService(
				{},
				mockQuery as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
			);

			const fiber = await Effect.runFork(
				Stream.runCollect(
					service.stream({
						messages: [{ role: "user", content: "Hi" }],
						abortController: providedController,
					}),
				),
			);

			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(streamStarted).toBe(true);

			await Effect.runPromise(Fiber.interrupt(fiber));

			// User-provided controller should NOT be aborted
			expect(providedController.signal.aborted).toBe(false);
		});
	});
});
