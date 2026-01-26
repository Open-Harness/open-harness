/**
 * LLM Provider Service Tests
 *
 * Tests for LLMProvider service definition, types, and utilities.
 * Note: This tests the service interface and types.
 * Implementation tests (ClaudeProvider) will be added in Phase 9.
 */

import { Effect, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { createEvent } from "../src/event/Event.js";
import {
	type ClaudeProviderConfig,
	LLMProvider,
	type LLMProviderService,
	ProviderError,
	type ProviderInfo,
	type ProviderMessage,
	type PublicLLMProvider,
	type QueryOptions,
	type QueryResult,
	type StreamChunk,
} from "../src/provider/Provider.js";

describe("ProviderError", () => {
	it("should create error with RATE_LIMITED code", () => {
		const error = new ProviderError("RATE_LIMITED", "Too many requests", true, 5000);

		expect(error.code).toBe("RATE_LIMITED");
		expect(error.message).toBe("Too many requests");
		expect(error.retryable).toBe(true);
		expect(error.retryAfter).toBe(5000);
		expect(error.name).toBe("ProviderError");
		expect(error._tag).toBe("ProviderError");
		expect(error.cause).toBeUndefined();
	});

	it("should create error with CONTEXT_LENGTH_EXCEEDED code", () => {
		const error = new ProviderError("CONTEXT_LENGTH_EXCEEDED", "Message too long", false);

		expect(error.code).toBe("CONTEXT_LENGTH_EXCEEDED");
		expect(error.retryable).toBe(false);
		expect(error.retryAfter).toBeUndefined();
	});

	it("should create error with INVALID_REQUEST code", () => {
		const error = new ProviderError("INVALID_REQUEST", "Invalid message format", false);

		expect(error.code).toBe("INVALID_REQUEST");
		expect(error.retryable).toBe(false);
	});

	it("should create error with NETWORK_ERROR code and cause", () => {
		const originalError = new Error("Connection reset");
		const error = new ProviderError("NETWORK_ERROR", "Network failure", true, 1000, originalError);

		expect(error.code).toBe("NETWORK_ERROR");
		expect(error.retryable).toBe(true);
		expect(error.retryAfter).toBe(1000);
		expect(error.cause).toBe(originalError);
	});

	it("should create error with AUTHENTICATION_FAILED code", () => {
		const error = new ProviderError("AUTHENTICATION_FAILED", "Invalid credentials", false);

		expect(error.code).toBe("AUTHENTICATION_FAILED");
		expect(error.retryable).toBe(false);
	});

	it("should create error with PROVIDER_ERROR code", () => {
		const error = new ProviderError("PROVIDER_ERROR", "Internal server error", true);

		expect(error.code).toBe("PROVIDER_ERROR");
		expect(error.retryable).toBe(true);
	});

	it("should be an instance of Error", () => {
		const error = new ProviderError("RATE_LIMITED", "Test", true);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("ProviderMessage", () => {
	it("should support user role", () => {
		const message: ProviderMessage = {
			role: "user",
			content: "Hello, how are you?",
		};

		expect(message.role).toBe("user");
		expect(message.content).toBe("Hello, how are you?");
	});

	it("should support assistant role", () => {
		const message: ProviderMessage = {
			role: "assistant",
			content: "I'm doing well, thank you!",
		};

		expect(message.role).toBe("assistant");
	});

	it("should support system role", () => {
		const message: ProviderMessage = {
			role: "system",
			content: "You are a helpful assistant.",
		};

		expect(message.role).toBe("system");
	});
});

describe("QueryOptions", () => {
	it("should have required messages field", () => {
		const options: QueryOptions = {
			messages: [{ role: "user", content: "Hello" }],
		};

		expect(options.messages).toHaveLength(1);
		expect(options.messages[0]?.content).toBe("Hello");
	});

	it("should support all optional fields", () => {
		const controller = new AbortController();
		const options: QueryOptions = {
			messages: [{ role: "user", content: "Hello" }],
			sessionId: "session-123",
			model: "claude-sonnet-4-20250514",
			abortController: controller,
			maxTurns: 10,
			persistSession: true,
			includePartialMessages: false,
			permissionMode: "bypassPermissions",
			outputFormat: {
				type: "json_schema",
				schema: { type: "object", properties: { result: { type: "string" } } },
			},
		};

		expect(options.sessionId).toBe("session-123");
		expect(options.model).toBe("claude-sonnet-4-20250514");
		expect(options.abortController).toBe(controller);
		expect(options.maxTurns).toBe(10);
		expect(options.persistSession).toBe(true);
		expect(options.includePartialMessages).toBe(false);
		expect(options.permissionMode).toBe("bypassPermissions");
		expect(options.outputFormat?.type).toBe("json_schema");
	});
});

describe("StreamChunk", () => {
	it("should represent text chunk", () => {
		const chunk: StreamChunk = {
			type: "text",
			text: "Hello, ",
		};

		expect(chunk.type).toBe("text");
		expect(chunk.text).toBe("Hello, ");
	});

	it("should represent tool_use chunk", () => {
		const chunk: StreamChunk = {
			type: "tool_use",
			toolCall: {
				id: "tool-123",
				name: "get_weather",
				input: { location: "San Francisco" },
			},
		};

		expect(chunk.type).toBe("tool_use");
		expect(chunk.toolCall?.id).toBe("tool-123");
		expect(chunk.toolCall?.name).toBe("get_weather");
		expect(chunk.toolCall?.input).toEqual({ location: "San Francisco" });
	});

	it("should represent stop chunk", () => {
		const chunk: StreamChunk = {
			type: "stop",
			stopReason: "end_turn",
		};

		expect(chunk.type).toBe("stop");
		expect(chunk.stopReason).toBe("end_turn");
	});

	it("should support all stop reasons", () => {
		const reasons: StreamChunk["stopReason"][] = ["end_turn", "tool_use", "max_tokens", "stop_sequence"];

		for (const reason of reasons) {
			const chunk: StreamChunk = { type: "stop", stopReason: reason };
			expect(chunk.stopReason).toBe(reason);
		}
	});
});

describe("QueryResult", () => {
	it("should have required events field", () => {
		const result: QueryResult = {
			events: [],
		};

		expect(result.events).toEqual([]);
	});

	it("should support all optional fields", () => {
		const events = [createEvent("text:complete", { fullText: "Hello!" })];
		const result: QueryResult = {
			events,
			text: "Hello!",
			output: { summary: "A greeting response" },
			sessionId: "session-456",
			stopReason: "end_turn",
		};

		expect(result.events).toHaveLength(1);
		expect(result.text).toBe("Hello!");
		expect(result.output).toEqual({ summary: "A greeting response" });
		expect(result.sessionId).toBe("session-456");
		expect(result.stopReason).toBe("end_turn");
	});
});

describe("ClaudeProviderConfig", () => {
	it("should have all fields optional", () => {
		const config: ClaudeProviderConfig = {};

		expect(config.model).toBeUndefined();
		expect(config.maxTurns).toBeUndefined();
		expect(config.persistSession).toBeUndefined();
		expect(config.includePartialMessages).toBeUndefined();
		expect(config.permissionMode).toBeUndefined();
	});

	it("should support all configuration options", () => {
		const config: ClaudeProviderConfig = {
			model: "claude-sonnet-4-20250514",
			maxTurns: 5,
			persistSession: false,
			includePartialMessages: true,
			permissionMode: "default",
		};

		expect(config.model).toBe("claude-sonnet-4-20250514");
		expect(config.maxTurns).toBe(5);
		expect(config.persistSession).toBe(false);
		expect(config.includePartialMessages).toBe(true);
		expect(config.permissionMode).toBe("default");
	});
});

describe("ProviderInfo", () => {
	it("should have all required fields", () => {
		const info: ProviderInfo = {
			type: "claude",
			name: "Claude Provider",
			model: "claude-sonnet-4-20250514",
			connected: true,
		};

		expect(info.type).toBe("claude");
		expect(info.name).toBe("Claude Provider");
		expect(info.model).toBe("claude-sonnet-4-20250514");
		expect(info.connected).toBe(true);
	});

	it("should support custom provider type", () => {
		const info: ProviderInfo = {
			type: "custom",
			name: "My Custom Provider",
			model: "my-model",
			connected: false,
		};

		expect(info.type).toBe("custom");
		expect(info.connected).toBe(false);
	});
});

describe("LLMProvider Context.Tag", () => {
	it("should have the correct service identifier", () => {
		expect(LLMProvider.key).toBe("@core-v2/LLMProvider");
	});

	it("should be usable as an Effect service dependency", async () => {
		// Create a minimal mock implementation
		const mockProvider: LLMProviderService = {
			query: () =>
				Effect.succeed({
					events: [],
					text: "Hello!",
					stopReason: "end_turn",
				}),
			stream: () => Stream.empty,
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock Provider",
					model: "mock-model",
					connected: true,
				}),
		};

		// Create a Layer that provides the mock
		const MockProviderLayer = Layer.succeed(LLMProvider, mockProvider);

		// Use the provider in an Effect program
		const program = Effect.gen(function* () {
			const provider = yield* LLMProvider;

			// Test query
			const result = yield* provider.query({
				messages: [{ role: "user", content: "Hello" }],
			});

			// Test info
			const info = yield* provider.info();

			return { result, info };
		});

		const output = await Effect.runPromise(program.pipe(Effect.provide(MockProviderLayer)));

		expect(output.result.text).toBe("Hello!");
		expect(output.info.type).toBe("claude");
		expect(output.info.connected).toBe(true);
	});
});

describe("LLMProviderService interface contract", () => {
	it("should define query method that returns Effect<QueryResult, ProviderError>", async () => {
		const mockProvider: LLMProviderService = {
			query: (options) => {
				// Validate inputs are passed correctly
				expect(options.messages).toHaveLength(1);
				expect(options.messages[0]?.content).toBe("Test message");
				return Effect.succeed({
					events: [createEvent("text:complete", { fullText: "Response" })],
					text: "Response",
					stopReason: "end_turn",
				});
			},
			stream: () => Stream.empty,
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock",
					model: "mock",
					connected: true,
				}),
		};

		const result = await Effect.runPromise(
			mockProvider.query({
				messages: [{ role: "user", content: "Test message" }],
			}),
		);

		expect(result.text).toBe("Response");
		expect(result.events).toHaveLength(1);
	});

	it("should define stream method that returns Stream<StreamChunk, ProviderError>", async () => {
		const chunks: StreamChunk[] = [
			{ type: "text", text: "Hello, " },
			{ type: "text", text: "world!" },
			{ type: "stop", stopReason: "end_turn" },
		];

		const mockProvider: LLMProviderService = {
			query: () =>
				Effect.succeed({
					events: [],
					stopReason: "end_turn",
				}),
			stream: (options) => {
				expect(options.messages).toHaveLength(1);
				return Stream.fromIterable(chunks);
			},
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock",
					model: "mock",
					connected: true,
				}),
		};

		const collected = await Effect.runPromise(
			Stream.runCollect(
				mockProvider.stream({
					messages: [{ role: "user", content: "Test" }],
				}),
			),
		);

		// Convert Chunk to array
		const result = Array.from(collected);

		expect(result).toHaveLength(3);
		expect(result[0]?.type).toBe("text");
		expect(result[0]?.text).toBe("Hello, ");
		expect(result[1]?.text).toBe("world!");
		expect(result[2]?.type).toBe("stop");
	});

	it("should define info method that returns Effect<ProviderInfo, ProviderError>", async () => {
		const mockProvider: LLMProviderService = {
			query: () => Effect.succeed({ events: [], stopReason: "end_turn" }),
			stream: () => Stream.empty,
			info: () =>
				Effect.succeed({
					type: "custom",
					name: "Test Provider",
					model: "test-model-v1",
					connected: true,
				}),
		};

		const info = await Effect.runPromise(mockProvider.info());

		expect(info.type).toBe("custom");
		expect(info.name).toBe("Test Provider");
		expect(info.model).toBe("test-model-v1");
	});
});

describe("LLMProviderService error handling", () => {
	it("should propagate ProviderError through Effect for query", async () => {
		const mockProvider: LLMProviderService = {
			query: () => Effect.fail(new ProviderError("RATE_LIMITED", "Too many requests", true, 5000)),
			stream: () => Stream.empty,
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock",
					model: "mock",
					connected: true,
				}),
		};

		const result = await Effect.runPromiseExit(
			mockProvider.query({
				messages: [{ role: "user", content: "Test" }],
			}),
		);

		expect(result._tag).toBe("Failure");
	});

	it("should propagate ProviderError through Stream", async () => {
		const mockProvider: LLMProviderService = {
			query: () => Effect.succeed({ events: [], stopReason: "end_turn" }),
			stream: () => Stream.fail(new ProviderError("NETWORK_ERROR", "Connection lost", true)),
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock",
					model: "mock",
					connected: true,
				}),
		};

		const result = await Effect.runPromiseExit(
			Stream.runCollect(
				mockProvider.stream({
					messages: [{ role: "user", content: "Test" }],
				}),
			),
		);

		expect(result._tag).toBe("Failure");
	});

	it("should allow error recovery with Effect.catchAll for query", async () => {
		const mockProvider: LLMProviderService = {
			query: () => Effect.fail(new ProviderError("RATE_LIMITED", "Too many requests", true, 1000)),
			stream: () => Stream.empty,
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock",
					model: "mock",
					connected: true,
				}),
		};

		// Recover from RATE_LIMITED by returning a fallback
		const program = mockProvider.query({ messages: [{ role: "user", content: "Test" }] }).pipe(
			Effect.catchAll((error) => {
				if (error.code === "RATE_LIMITED" && error.retryable) {
					return Effect.succeed({
						events: [],
						text: "Rate limited, please retry",
						stopReason: "end_turn" as const,
					});
				}
				return Effect.fail(error);
			}),
		);

		const result = await Effect.runPromise(program);
		expect(result.text).toBe("Rate limited, please retry");
	});
});

describe("LLMProvider service composition with Effect.gen", () => {
	it("should allow chaining provider operations", async () => {
		let queryCount = 0;

		const mockProvider: LLMProviderService = {
			query: (_options) => {
				queryCount++;
				return Effect.succeed({
					events: [createEvent("text:complete", { fullText: `Response ${queryCount}` })],
					text: `Response ${queryCount}`,
					sessionId: `session-${queryCount}`,
					stopReason: "end_turn",
				});
			},
			stream: () => Stream.empty,
			info: () =>
				Effect.succeed({
					type: "claude",
					name: "Mock Provider",
					model: "mock-model",
					connected: true,
				}),
		};

		const MockProviderLayer = Layer.succeed(LLMProvider, mockProvider);

		const program = Effect.gen(function* () {
			const provider = yield* LLMProvider;

			// Check provider info
			const info = yield* provider.info();

			// Make multiple queries
			const result1 = yield* provider.query({
				messages: [{ role: "user", content: "First query" }],
			});

			const result2 = yield* provider.query({
				messages: [{ role: "user", content: "Second query" }],
				sessionId: result1.sessionId,
			});

			return {
				providerName: info.name,
				firstResponse: result1.text,
				secondResponse: result2.text,
				queryCount,
			};
		});

		const output = await Effect.runPromise(program.pipe(Effect.provide(MockProviderLayer)));

		expect(output.providerName).toBe("Mock Provider");
		expect(output.firstResponse).toBe("Response 1");
		expect(output.secondResponse).toBe("Response 2");
		expect(output.queryCount).toBe(2);
	});
});

describe("PublicLLMProvider interface", () => {
	it("should define Promise-based query method", async () => {
		// This tests that the interface shape is correct
		const publicProvider: PublicLLMProvider = {
			query: async () => ({
				events: [],
				text: "Hello",
				stopReason: "end_turn",
			}),
			stream: () => (async function* () {})(),
			info: async () => ({
				type: "claude",
				name: "Public Provider",
				model: "model",
				connected: true,
			}),
		};

		const result = await publicProvider.query({
			messages: [{ role: "user", content: "Test" }],
		});

		expect(result.text).toBe("Hello");
	});

	it("should define AsyncIterable-based stream method", async () => {
		const publicProvider: PublicLLMProvider = {
			query: async () => ({ events: [], stopReason: "end_turn" }),
			stream: () =>
				(async function* () {
					yield { type: "text" as const, text: "Hello" };
					yield { type: "stop" as const, stopReason: "end_turn" as const };
				})(),
			info: async () => ({
				type: "claude",
				name: "Public Provider",
				model: "model",
				connected: true,
			}),
		};

		const chunks: StreamChunk[] = [];
		for await (const chunk of publicProvider.stream({
			messages: [{ role: "user", content: "Test" }],
		})) {
			chunks.push(chunk);
		}

		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.type).toBe("text");
		expect(chunks[1]?.type).toBe("stop");
	});

	it("should define Promise-based info method", async () => {
		const publicProvider: PublicLLMProvider = {
			query: async () => ({ events: [], stopReason: "end_turn" }),
			stream: () => (async function* () {})(),
			info: async () => ({
				type: "custom",
				name: "Custom Provider",
				model: "custom-v1",
				connected: false,
			}),
		};

		const info = await publicProvider.info();

		expect(info.type).toBe("custom");
		expect(info.connected).toBe(false);
	});
});
