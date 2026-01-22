/**
 * Message Module Tests
 *
 * Tests for Message types and projectEventsToMessages function.
 * Covers all projection rules from spec FR-047 through FR-053.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createEvent } from "../src/event/index.js";
import {
	generateMessageId,
	type Message,
	type MessageRole,
	projectEventsToMessages,
	resetMessageIdCounter,
	type ToolInvocation,
	type ToolInvocationState,
} from "../src/message/index.js";

// Reset message ID counter before each test for deterministic IDs
beforeEach(() => {
	resetMessageIdCounter();
});

// ============================================================================
// Message Types Tests
// ============================================================================

describe("Message Types", () => {
	describe("MessageRole", () => {
		it("should support user role", () => {
			const role: MessageRole = "user";
			expect(role).toBe("user");
		});

		it("should support assistant role", () => {
			const role: MessageRole = "assistant";
			expect(role).toBe("assistant");
		});

		it("should support system role", () => {
			const role: MessageRole = "system";
			expect(role).toBe("system");
		});

		it("should support tool role", () => {
			const role: MessageRole = "tool";
			expect(role).toBe("tool");
		});
	});

	describe("ToolInvocationState", () => {
		it("should support pending state", () => {
			const state: ToolInvocationState = "pending";
			expect(state).toBe("pending");
		});

		it("should support result state", () => {
			const state: ToolInvocationState = "result";
			expect(state).toBe("result");
		});

		it("should support error state", () => {
			const state: ToolInvocationState = "error";
			expect(state).toBe("error");
		});
	});

	describe("ToolInvocation", () => {
		it("should have required properties", () => {
			const invocation: ToolInvocation = {
				toolCallId: "call-123",
				toolName: "get_weather",
				args: { location: "NYC" },
				state: "pending",
			};

			expect(invocation.toolCallId).toBe("call-123");
			expect(invocation.toolName).toBe("get_weather");
			expect(invocation.args).toEqual({ location: "NYC" });
			expect(invocation.state).toBe("pending");
		});

		it("should support optional result", () => {
			const invocation: ToolInvocation = {
				toolCallId: "call-123",
				toolName: "get_weather",
				args: { location: "NYC" },
				result: { temp: 72 },
				state: "result",
			};

			expect(invocation.result).toEqual({ temp: 72 });
		});
	});

	describe("Message", () => {
		it("should have required properties", () => {
			const message: Message = {
				id: "msg-1",
				role: "user",
				content: "Hello",
				// biome-ignore lint/suspicious/noExplicitAny: Test uses string cast for EventId branded type
				_events: ["event-1" as any],
			};

			expect(message.id).toBe("msg-1");
			expect(message.role).toBe("user");
			expect(message.content).toBe("Hello");
			expect(message._events).toHaveLength(1);
		});

		it("should support optional name", () => {
			const message: Message = {
				id: "msg-1",
				role: "assistant",
				content: "Hello",
				name: "chat-agent",
				_events: [],
			};

			expect(message.name).toBe("chat-agent");
		});

		it("should support optional toolInvocations", () => {
			const message: Message = {
				id: "msg-1",
				role: "assistant",
				content: "Let me check...",
				toolInvocations: [
					{
						toolCallId: "call-1",
						toolName: "search",
						args: { query: "weather" },
						state: "pending",
					},
				],
				_events: [],
			};

			expect(message.toolInvocations).toHaveLength(1);
		});
	});
});

// ============================================================================
// Message ID Generation Tests
// ============================================================================

describe("generateMessageId", () => {
	it("should generate unique IDs", () => {
		const id1 = generateMessageId();
		const id2 = generateMessageId();
		const id3 = generateMessageId();

		expect(id1).not.toBe(id2);
		expect(id2).not.toBe(id3);
		expect(id1).not.toBe(id3);
	});

	it("should generate deterministic IDs after reset", () => {
		resetMessageIdCounter();
		const id1 = generateMessageId();

		resetMessageIdCounter();
		const id2 = generateMessageId();

		expect(id1).toBe(id2);
	});

	it("should increment counter", () => {
		resetMessageIdCounter();
		expect(generateMessageId()).toBe("msg-1");
		expect(generateMessageId()).toBe("msg-2");
		expect(generateMessageId()).toBe("msg-3");
	});
});

// ============================================================================
// projectEventsToMessages Tests
// ============================================================================

describe("projectEventsToMessages", () => {
	describe("Empty input", () => {
		it("should return empty array for empty events", () => {
			const messages = projectEventsToMessages([]);
			expect(messages).toEqual([]);
		});
	});

	describe("user:input projection (FR-047)", () => {
		it("should project user:input to user message", () => {
			const event = createEvent("user:input", { text: "Hello world" });
			const messages = projectEventsToMessages([event]);

			expect(messages).toHaveLength(1);
			expect(messages[0].role).toBe("user");
			expect(messages[0].content).toBe("Hello world");
		});

		it("should include event ID in _events", () => {
			const event = createEvent("user:input", { text: "Test" });
			const messages = projectEventsToMessages([event]);

			expect(messages[0]._events).toContain(event.id);
		});

		it("should handle multiple user inputs", () => {
			const event1 = createEvent("user:input", { text: "First" });
			const event2 = createEvent("user:input", { text: "Second" });
			const messages = projectEventsToMessages([event1, event2]);

			expect(messages).toHaveLength(2);
			expect(messages[0].content).toBe("First");
			expect(messages[1].content).toBe("Second");
		});
	});

	describe("text:delta accumulation (FR-048)", () => {
		it("should accumulate text deltas into assistant message", () => {
			const events = [
				createEvent("text:delta", { delta: "Hello " }),
				createEvent("text:delta", { delta: "world" }),
				createEvent("text:delta", { delta: "!" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages).toHaveLength(1);
			expect(messages[0].role).toBe("assistant");
			expect(messages[0].content).toBe("Hello world!");
		});

		it("should track all delta event IDs", () => {
			const events = [createEvent("text:delta", { delta: "A" }), createEvent("text:delta", { delta: "B" })];
			const messages = projectEventsToMessages(events);

			expect(messages[0]._events).toHaveLength(2);
			expect(messages[0]._events).toContain(events[0].id);
			expect(messages[0]._events).toContain(events[1].id);
		});

		it("should include agentName if provided", () => {
			const event = createEvent("text:delta", { delta: "Hi", agentName: "greeter" });
			const messages = projectEventsToMessages([event]);

			expect(messages[0].name).toBe("greeter");
		});
	});

	describe("text:complete finalization (FR-049)", () => {
		it("should finalize assistant message with fullText", () => {
			const events = [
				createEvent("text:delta", { delta: "Hell" }),
				createEvent("text:delta", { delta: "o" }),
				createEvent("text:complete", { fullText: "Hello" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe("Hello");
		});

		it("should handle text:complete without prior deltas", () => {
			const event = createEvent("text:complete", { fullText: "Direct message" });
			const messages = projectEventsToMessages([event]);

			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe("Direct message");
		});

		it("should include text:complete event ID", () => {
			const completeEvent = createEvent("text:complete", { fullText: "Done" });
			const messages = projectEventsToMessages([completeEvent]);

			expect(messages[0]._events).toContain(completeEvent.id);
		});
	});

	describe("agent:started projection (FR-052)", () => {
		it("should start new assistant message with agent name", () => {
			const event = createEvent("agent:started", { agentName: "research-agent" });
			const messages = projectEventsToMessages([event]);

			expect(messages).toHaveLength(1);
			expect(messages[0].role).toBe("assistant");
			expect(messages[0].name).toBe("research-agent");
			expect(messages[0].content).toBe("");
		});

		it("should finalize previous assistant message when new agent starts", () => {
			const events = [
				createEvent("agent:started", { agentName: "agent1" }),
				createEvent("text:delta", { delta: "First response" }),
				createEvent("agent:started", { agentName: "agent2" }),
				createEvent("text:delta", { delta: "Second response" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages).toHaveLength(2);
			expect(messages[0].name).toBe("agent1");
			expect(messages[0].content).toBe("First response");
			expect(messages[1].name).toBe("agent2");
			expect(messages[1].content).toBe("Second response");
		});
	});

	describe("tool:called projection (FR-050)", () => {
		it("should add tool invocation with pending state", () => {
			const event = createEvent("tool:called", {
				toolName: "get_weather",
				toolId: "call-123",
				input: { location: "NYC" },
			});
			const messages = projectEventsToMessages([event]);

			expect(messages).toHaveLength(1);
			expect(messages[0].toolInvocations).toHaveLength(1);
			expect(messages[0].toolInvocations?.[0]).toEqual({
				toolCallId: "call-123",
				toolName: "get_weather",
				args: { location: "NYC" },
				state: "pending",
			});
		});

		it("should handle multiple tool calls", () => {
			const events = [
				createEvent("tool:called", { toolName: "tool1", toolId: "call-1", input: {} }),
				createEvent("tool:called", { toolName: "tool2", toolId: "call-2", input: {} }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages[0].toolInvocations).toHaveLength(2);
		});
	});

	describe("tool:result projection (FR-051)", () => {
		it("should update tool invocation with result", () => {
			const events = [
				createEvent("tool:called", { toolName: "search", toolId: "call-1", input: { q: "test" } }),
				createEvent("tool:result", { toolId: "call-1", output: { results: ["a", "b"] }, isError: false }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages[0].toolInvocations?.[0]).toEqual({
				toolCallId: "call-1",
				toolName: "search",
				args: { q: "test" },
				result: { results: ["a", "b"] },
				state: "result",
			});
		});

		it("should set error state when isError is true", () => {
			const events = [
				createEvent("tool:called", { toolName: "api", toolId: "call-1", input: {} }),
				createEvent("tool:result", { toolId: "call-1", output: "Network error", isError: true }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages[0].toolInvocations?.[0].state).toBe("error");
			expect(messages[0].toolInvocations?.[0].result).toBe("Network error");
		});

		it("should update correct tool when multiple tools called", () => {
			const events = [
				createEvent("tool:called", { toolName: "tool1", toolId: "call-1", input: {} }),
				createEvent("tool:called", { toolName: "tool2", toolId: "call-2", input: {} }),
				createEvent("tool:result", { toolId: "call-2", output: "result2", isError: false }),
				createEvent("tool:result", { toolId: "call-1", output: "result1", isError: false }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages[0].toolInvocations?.[0].result).toBe("result1");
			expect(messages[0].toolInvocations?.[1].result).toBe("result2");
		});
	});

	describe("_events traceability (FR-053)", () => {
		it("should include all source event IDs", () => {
			const events = [
				createEvent("agent:started", { agentName: "test" }),
				createEvent("text:delta", { delta: "Hello " }),
				createEvent("text:delta", { delta: "world" }),
				createEvent("text:complete", { fullText: "Hello world" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages[0]._events).toHaveLength(4);
			for (const event of events) {
				expect(messages[0]._events).toContain(event.id);
			}
		});

		it("should optionally exclude event IDs", () => {
			const events = [createEvent("user:input", { text: "Test" })];
			const messages = projectEventsToMessages(events, { includeEventIds: false });

			expect(messages[0]._events).toEqual([]);
		});
	});

	describe("ProjectionOptions", () => {
		it("should use custom ID generator", () => {
			let counter = 100;
			const customGenerator = () => `custom-${counter++}`;

			const events = [createEvent("user:input", { text: "First" }), createEvent("user:input", { text: "Second" })];
			const messages = projectEventsToMessages(events, { generateId: customGenerator });

			expect(messages[0].id).toBe("custom-100");
			expect(messages[1].id).toBe("custom-101");
		});
	});

	describe("Complex conversation flow", () => {
		it("should handle full conversation with tool use", () => {
			const events = [
				createEvent("user:input", { text: "What's the weather?" }),
				createEvent("agent:started", { agentName: "weather-agent" }),
				createEvent("text:delta", { delta: "Let me check " }),
				createEvent("text:delta", { delta: "the weather." }),
				createEvent("tool:called", { toolName: "get_weather", toolId: "w-1", input: { city: "NYC" } }),
				createEvent("tool:result", { toolId: "w-1", output: { temp: 72 }, isError: false }),
				createEvent("text:delta", { delta: " It's 72°F!" }),
				createEvent("text:complete", { fullText: "Let me check the weather. It's 72°F!" }),
				createEvent("user:input", { text: "Thanks!" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages).toHaveLength(3);

			// First message: user question
			expect(messages[0].role).toBe("user");
			expect(messages[0].content).toBe("What's the weather?");

			// Second message: assistant with tool use
			expect(messages[1].role).toBe("assistant");
			expect(messages[1].name).toBe("weather-agent");
			expect(messages[1].content).toBe("Let me check the weather. It's 72°F!");
			expect(messages[1].toolInvocations).toHaveLength(1);
			expect(messages[1].toolInvocations?.[0].state).toBe("result");

			// Third message: user thanks
			expect(messages[2].role).toBe("user");
			expect(messages[2].content).toBe("Thanks!");
		});

		it("should handle multi-turn conversation", () => {
			const events = [
				createEvent("user:input", { text: "Hi" }),
				createEvent("agent:started", { agentName: "chat" }),
				createEvent("text:complete", { fullText: "Hello!" }),
				createEvent("user:input", { text: "Bye" }),
				createEvent("agent:started", { agentName: "chat" }),
				createEvent("text:complete", { fullText: "Goodbye!" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages).toHaveLength(4);
			expect(messages.map((m) => m.content)).toEqual(["Hi", "Hello!", "Bye", "Goodbye!"]);
		});
	});

	describe("Edge cases", () => {
		it("should handle unknown event types gracefully", () => {
			const events = [
				createEvent("user:input", { text: "Hello" }),
				createEvent("custom:event", { data: "ignored" }),
				createEvent("user:input", { text: "World" }),
			];
			const messages = projectEventsToMessages(events);

			expect(messages).toHaveLength(2);
		});

		it("should handle tool:result without matching tool:called", () => {
			const events = [
				createEvent("agent:started", { agentName: "test" }),
				createEvent("tool:result", { toolId: "orphan", output: "lost", isError: false }),
			];
			// Should not throw
			const messages = projectEventsToMessages(events);
			expect(messages).toHaveLength(1);
		});

		it("should handle empty content", () => {
			const event = createEvent("user:input", { text: "" });
			const messages = projectEventsToMessages([event]);

			expect(messages[0].content).toBe("");
		});

		it("should handle special characters in content", () => {
			const event = createEvent("user:input", { text: "Hello <script>alert('xss')</script>" });
			const messages = projectEventsToMessages([event]);

			// Content should be preserved as-is (escaping is rendering concern)
			expect(messages[0].content).toBe("Hello <script>alert('xss')</script>");
		});

		it("should handle unicode content", () => {
			const event = createEvent("user:input", { text: "Hello 世界 🌍" });
			const messages = projectEventsToMessages([event]);

			expect(messages[0].content).toBe("Hello 世界 🌍");
		});
	});
});
