/**
 * Event Mapper Tests - Validates SDK message to AgentEvent mapping
 *
 * Tests cover all message types:
 * - system (init, compact_boundary, status)
 * - assistant (text, thinking, tool_use)
 * - user (tool_result)
 * - tool_progress
 * - result (success, failure)
 * - unknown message types (default case)
 */

import { describe, expect, test } from "bun:test";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mapSdkMessageToEvents } from "../../src/providers/anthropic/runner/event-mapper.js";
import { EventTypeConst } from "../../src/providers/anthropic/runner/models.js";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_AGENT = "TestAgent";
const TEST_SESSION = "test-session-123";

// ============================================================================
// System Messages
// ============================================================================

describe("Event Mapper", () => {
	describe("system messages", () => {
		test("init subtype creates SESSION_START event", () => {
			const msg: SDKMessage = {
				type: "system",
				subtype: "init",
				session_id: "sdk-session-456",
				model: "claude-sonnet-4-20250514",
				tools: ["Read", "Write", "Bash"],
				cwd: "/projects/test",
				permissionMode: "default",
				slash_commands: ["/help"],
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.SESSION_START);
			expect(events[0]?.agent_name).toBe(TEST_AGENT);
			expect(events[0]?.session_id).toBe("sdk-session-456"); // Uses msg.session_id
			expect(events[0]?.content).toBe("Session started: sdk-session-456");
			expect(events[0]?.metadata).toEqual({
				model: "claude-sonnet-4-20250514",
				tools: ["Read", "Write", "Bash"],
				cwd: "/projects/test",
				permission_mode: "default",
				slash_commands: ["/help"],
			});
			expect(events[0]?.timestamp).toBeInstanceOf(Date);
		});

		test("compact_boundary subtype creates COMPACT event", () => {
			const msg: SDKMessage = {
				type: "system",
				subtype: "compact_boundary",
				session_id: "sdk-session-789",
				compact_metadata: {
					trigger: "auto",
					pre_tokens: 50000,
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.COMPACT);
			expect(events[0]?.session_id).toBe("sdk-session-789"); // Uses msg.session_id
			expect(events[0]?.content).toBe("Context compacted (auto)");
			expect(events[0]?.metadata).toEqual({
				trigger: "auto",
				pre_tokens: 50000,
			});
		});

		test("status subtype creates STATUS event", () => {
			const msg: SDKMessage = {
				type: "system",
				subtype: "status",
				session_id: "sdk-session-abc",
				status: "compacting",
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.STATUS);
			expect(events[0]?.session_id).toBe("sdk-session-abc"); // Uses msg.session_id
			expect(events[0]?.content).toBe("Status: compacting");
			expect(events[0]?.metadata).toEqual({ status: "compacting" });
		});

		test("status with null status shows idle", () => {
			const msg: SDKMessage = {
				type: "system",
				subtype: "status",
				session_id: "test",
				status: null,
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.content).toBe("Status: idle");
		});

		test("unknown system subtype returns empty array", () => {
			const msg = {
				type: "system",
				subtype: "unknown_subtype",
				session_id: "test",
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(0);
		});
	});

	// ============================================================================
	// Assistant Messages
	// ============================================================================

	describe("assistant messages", () => {
		test("text block creates TEXT event", () => {
			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [{ type: "text", text: "Hello, I will help you with that task." }],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.TEXT);
			expect(events[0]?.agent_name).toBe(TEST_AGENT);
			expect(events[0]?.session_id).toBe(TEST_SESSION); // Uses passed sessionId
			expect(events[0]?.content).toBe("Hello, I will help you with that task.");
		});

		test("thinking block creates THINKING event", () => {
			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [{ type: "thinking", thinking: "Let me analyze this problem..." }],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.THINKING);
			expect(events[0]?.content).toBe("Let me analyze this problem...");
			expect(events[0]?.session_id).toBe(TEST_SESSION);
		});

		test("tool_use block creates TOOL_CALL event", () => {
			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [
						{
							type: "tool_use",
							name: "Read",
							input: { filePath: "/path/to/file.ts" },
						},
					],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.TOOL_CALL);
			expect(events[0]?.tool_name).toBe("Read");
			expect(events[0]?.tool_input).toEqual({ filePath: "/path/to/file.ts" });
			expect(events[0]?.content).toBe("Calling tool: Read");
			expect(events[0]?.session_id).toBe(TEST_SESSION);
		});

		test("multiple content blocks create multiple events", () => {
			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [
						{ type: "thinking", thinking: "First, let me think..." },
						{ type: "text", text: "I will read the file." },
						{ type: "tool_use", name: "Read", input: { filePath: "/test.ts" } },
					],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(3);
			expect(events[0]?.event_type).toBe(EventTypeConst.THINKING);
			expect(events[1]?.event_type).toBe(EventTypeConst.TEXT);
			expect(events[2]?.event_type).toBe(EventTypeConst.TOOL_CALL);
		});

		test("unknown content block type is ignored", () => {
			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [
						{ type: "unknown_block_type" as unknown as never, data: "ignored" },
						{ type: "text", text: "This is included." },
					],
				},
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.TEXT);
		});

		test("empty content array returns empty events", () => {
			const msg = {
				type: "assistant",
				message: { content: [] },
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(0);
		});

		test("non-array content returns empty events", () => {
			const msg: SDKMessage = {
				type: "assistant",
				message: { content: "string content" as unknown as never },
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(0);
		});
	});

	// ============================================================================
	// User Messages (Tool Results)
	// ============================================================================

	describe("user messages", () => {
		test("tool_result block creates TOOL_RESULT event", () => {
			const msg: SDKMessage = {
				type: "user",
				message: {
					content: [
						{
							type: "tool_result",
							content: "File contents here...",
							is_error: false,
						},
					],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.TOOL_RESULT);
			expect(events[0]?.tool_result).toEqual({
				content: "File contents here...",
				is_error: false,
			});
			expect(events[0]?.content).toBe("Tool result: File contents here...");
			expect(events[0]?.session_id).toBe(TEST_SESSION);
		});

		test("tool_result with error flag", () => {
			const msg: SDKMessage = {
				type: "user",
				message: {
					content: [
						{
							type: "tool_result",
							content: "Error: File not found",
							is_error: true,
						},
					],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.tool_result?.is_error).toBe(true);
		});

		test("long tool result content is truncated in content field", () => {
			const longContent = "A".repeat(200);
			const msg: SDKMessage = {
				type: "user",
				message: {
					content: [
						{
							type: "tool_result",
							content: longContent,
							is_error: false,
						},
					],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.content).toBe(`Tool result: ${"A".repeat(100)}`);
			expect(events[0]?.tool_result?.content).toBe(longContent); // Full content preserved
		});

		test("non-array user content returns empty events", () => {
			const msg: SDKMessage = {
				type: "user",
				message: { content: "string content" as unknown as never },
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(0);
		});
	});

	// ============================================================================
	// Tool Progress Messages
	// ============================================================================

	describe("tool_progress messages", () => {
		test("creates TOOL_PROGRESS event with metadata", () => {
			const msg: SDKMessage = {
				type: "tool_progress",
				tool_name: "Bash",
				tool_use_id: "tu_12345",
				elapsed_time_seconds: 5.2,
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(1);
			expect(events[0]?.event_type).toBe(EventTypeConst.TOOL_PROGRESS);
			expect(events[0]?.tool_name).toBe("Bash");
			expect(events[0]?.content).toBe("Tool progress: Bash");
			expect(events[0]?.session_id).toBe(TEST_SESSION);
			expect(events[0]?.metadata).toEqual({
				elapsed_seconds: 5.2,
				tool_use_id: "tu_12345",
			});
		});
	});

	// ============================================================================
	// Result Messages
	// ============================================================================

	describe("result messages", () => {
		test("success result creates RESULT and SESSION_END events", () => {
			const msg = {
				type: "result",
				subtype: "success",
				session_id: "result-session",
				duration_ms: 5000,
				duration_api_ms: 4500,
				is_error: false,
				num_turns: 3,
				total_cost_usd: 0.05,
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_read_input_tokens: 100,
					cache_creation_input_tokens: 50,
				},
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(2);

			// First event: RESULT
			expect(events[0]?.event_type).toBe(EventTypeConst.RESULT);
			expect(events[0]?.content).toBe("Task completed");
			expect(events[0]?.is_error).toBe(false);
			expect(events[0]?.session_id).toBe(TEST_SESSION);
			expect(events[0]?.metadata).toEqual({
				subtype: "success",
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					cache_read_input_tokens: 100,
					cache_creation_input_tokens: 50,
				},
				duration_ms: 5000,
				num_turns: 3,
				total_cost_usd: 0.05,
			});

			// Second event: SESSION_END
			expect(events[1]?.event_type).toBe(EventTypeConst.SESSION_END);
			expect(events[1]?.content).toBe("Task completed");
			expect(events[1]?.is_error).toBe(false);
		});

		test("failure result creates events with is_error=true", () => {
			const msg = {
				type: "result",
				subtype: "error",
				session_id: "error-session",
				duration_ms: 1000,
				is_error: true,
				num_turns: 1,
				total_cost_usd: 0.01,
				usage: { input_tokens: 100, output_tokens: 50 },
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(2);
			expect(events[0]?.content).toBe("Task failed");
			expect(events[0]?.is_error).toBe(true);
			expect(events[1]?.content).toBe("Task failed");
			expect(events[1]?.is_error).toBe(true);
		});

		test("interrupted result treated as failure", () => {
			const msg = {
				type: "result",
				subtype: "interrupted",
				session_id: "int-session",
				duration_ms: 2000,
				num_turns: 2,
				total_cost_usd: 0.02,
				usage: { input_tokens: 200, output_tokens: 100 },
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events[0]?.content).toBe("Task failed");
			expect(events[0]?.is_error).toBe(true);
		});
	});

	// ============================================================================
	// Unknown Message Types
	// ============================================================================

	describe("unknown message types", () => {
		test("unknown message type returns empty array", () => {
			const msg = {
				type: "unknown_type" as unknown as never,
				data: "some data",
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events).toHaveLength(0);
		});
	});

	// ============================================================================
	// Edge Cases
	// ============================================================================

	describe("edge cases", () => {
		test("all events have timestamp set", () => {
			const before = new Date();

			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [{ type: "text", text: "Test" }],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);
			const after = new Date();

			expect(events[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(events[0]?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		test("agent_name is correctly attributed on all events", () => {
			const customAgent = "MyCustomAgent";
			const msg = {
				type: "result",
				subtype: "success",
				duration_ms: 100,
				num_turns: 1,
				total_cost_usd: 0.001,
				usage: { input_tokens: 10, output_tokens: 5 },
			} as unknown as SDKMessage;

			const events = mapSdkMessageToEvents(msg, customAgent, TEST_SESSION);

			expect(events.every((e) => e.agent_name === customAgent)).toBe(true);
		});

		test("tool_use with complex input object", () => {
			const complexInput = {
				nested: { deep: { value: 123 } },
				array: [1, 2, 3],
				boolean: true,
			};

			const msg: SDKMessage = {
				type: "assistant",
				message: {
					content: [{ type: "tool_use", name: "CustomTool", input: complexInput }],
				},
			} as SDKMessage;

			const events = mapSdkMessageToEvents(msg, TEST_AGENT, TEST_SESSION);

			expect(events[0]?.tool_input).toEqual(complexInput);
		});
	});
});
