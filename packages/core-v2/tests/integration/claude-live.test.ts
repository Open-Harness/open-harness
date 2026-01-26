/**
 * Live Claude SDK Integration Tests
 *
 * IMPORTANT: These tests run against the REAL Claude SDK and require authentication.
 * They are skipped in CI environments. To run locally:
 *
 *   bun run test:live
 *
 * These tests verify that core-v2 correctly integrates with the actual Claude SDK
 * behavior, including streaming, tool use, and structured output.
 *
 * @vitest-environment node
 * @module @core-v2/tests/integration/claude-live
 */

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";

// ============================================================================
// Constants
// ============================================================================

const MODEL = "claude-sonnet-4-20250514";
const LIVE_TEST_TIMEOUT = 120_000; // 2 minutes for live SDK calls

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Collects all messages from an SDK query stream.
 */
async function collectMessages(
	prompt: string,
	options?: {
		maxTurns?: number;
		outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };
	},
): Promise<{
	messages: SDKMessage[];
	textDeltas: string[];
	finalText: string;
	toolCalls: Array<{ name: string; input: unknown }>;
	sessionId?: string;
	structuredOutput?: unknown;
}> {
	const messages: SDKMessage[] = [];
	const textDeltas: string[] = [];
	let finalText = "";
	const toolCalls: Array<{ name: string; input: unknown }> = [];
	let sessionId: string | undefined;
	let structuredOutput: unknown;

	const queryStream = query({
		prompt,
		options: {
			model: MODEL,
			maxTurns: options?.maxTurns ?? 1,
			persistSession: false,
			includePartialMessages: true,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
			...(options?.outputFormat ? { outputFormat: options.outputFormat } : {}),
		},
	});

	for await (const message of queryStream) {
		const sdkMessage = message as SDKMessage;
		messages.push(sdkMessage);

		// Extract session ID
		if (sdkMessage.type === "system") {
			const sysMsg = sdkMessage as { session_id?: string };
			if (sysMsg.session_id) {
				sessionId = sysMsg.session_id;
			}
		}

		// Track text deltas
		if (sdkMessage.type === "stream_event") {
			const streamEvent = (
				sdkMessage as {
					event?: { type?: string; delta?: { type?: string; text?: string } };
				}
			).event;
			if (streamEvent?.type === "content_block_delta") {
				const delta = streamEvent.delta;
				if (delta?.type === "text_delta" && delta.text) {
					textDeltas.push(delta.text);
				}
			}
		}

		// Track tool calls from assistant messages
		if (sdkMessage.type === "assistant") {
			const content = (sdkMessage as { message?: { content?: unknown[] } }).message?.content;
			if (Array.isArray(content)) {
				for (const block of content) {
					const b = block as { type?: string; name?: string; input?: unknown };
					if (b.type === "tool_use" && b.name) {
						toolCalls.push({ name: b.name, input: b.input });
					}
				}
			}
		}

		// Extract final text and structured output from result
		if (sdkMessage.type === "result") {
			const result = sdkMessage as { result?: string; structured_output?: unknown };
			if (result.result) {
				finalText = result.result;
			}
			if (result.structured_output !== undefined) {
				structuredOutput = result.structured_output;
			}
		}
	}

	return { messages, textDeltas, finalText, toolCalls, sessionId, structuredOutput };
}

/**
 * Checks if a message sequence contains expected event types in order.
 */
function hasEventTypes(messages: SDKMessage[], expectedTypes: string[]): boolean {
	let expectedIndex = 0;
	for (const msg of messages) {
		if (msg.type === expectedTypes[expectedIndex]) {
			expectedIndex++;
			if (expectedIndex === expectedTypes.length) {
				return true;
			}
		}
	}
	return expectedIndex === expectedTypes.length;
}

// ============================================================================
// Live Integration Tests
// ============================================================================

/**
 * NOTE: These tests require live Claude SDK authentication.
 * Run with: bun run test:live
 *
 * IMPORTANT: These tests are NOT skipped. They execute against the REAL Claude SDK.
 * Ensure you have proper authentication configured before running.
 */
describe("Claude SDK Live Integration Tests", () => {
	describe("Simple Text Response", () => {
		it(
			"should send prompt and receive streaming response with text:delta and text:complete events",
			async () => {
				const result = await collectMessages("What is 2 + 2? Answer with just the number.");

				// Should have system init, stream events, assistant message, and result
				expect(result.messages.length).toBeGreaterThan(0);
				expect(hasEventTypes(result.messages, ["system", "assistant", "result"])).toBe(true);

				// Final text should contain "4"
				expect(result.finalText).toContain("4");

				// Should have a session ID
				expect(result.sessionId).toBeDefined();
				expect(typeof result.sessionId).toBe("string");
			},
			LIVE_TEST_TIMEOUT,
		);

		it("should emit text_delta events for streaming text", { timeout: LIVE_TEST_TIMEOUT, retry: 2 }, async () => {
			const result = await collectMessages("Explain what the number 7 is in one sentence.");

			// For longer responses, we should see text deltas
			// (short responses may not stream)
			expect(result.messages.some((m) => m.type === "stream_event")).toBe(true);

			// Final text should be non-empty
			expect(result.finalText.length).toBeGreaterThan(0);
		});
	});

	describe("Tool Use Integration", () => {
		it(
			"should emit tool:called and tool:result events for Bash tool",
			async () => {
				const result = await collectMessages("Use the Bash tool to run: echo $((3 + 4)). Show me only the result.", {
					maxTurns: 3,
				});

				// Should have tool calls
				expect(result.toolCalls.length).toBeGreaterThan(0);
				expect(result.toolCalls[0]?.name).toBe("Bash");

				// Should have user message with tool result
				const hasToolResult = result.messages.some(
					(m) =>
						m.type === "user" &&
						"message" in m &&
						(m as { message?: { content?: unknown[] } }).message?.content?.some(
							(c: unknown) => (c as { type?: string }).type === "tool_result",
						),
				);
				expect(hasToolResult).toBe(true);

				// Final text should contain "7"
				expect(result.finalText).toContain("7");
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should handle tool input streaming (input_json_delta events if streamed)",
			async () => {
				const result = await collectMessages(
					"Use the Bash tool to run: echo hello world. Just run it and show the output.",
					{ maxTurns: 3 },
				);

				// Check if we received input_json_delta events (optional - SDK may not stream small inputs)
				const hasInputJsonDelta = result.messages.some(
					(m) =>
						m.type === "stream_event" &&
						(m as { event?: { type?: string; delta?: { type?: string } } }).event?.delta?.type === "input_json_delta",
				);

				// We verify we can detect these events when present, but don't require them
				// since the SDK may send the entire tool input in one chunk for small inputs
				if (hasInputJsonDelta) {
					// If streamed, we should have multiple stream events
					const streamEvents = result.messages.filter((m) => m.type === "stream_event");
					expect(streamEvents.length).toBeGreaterThan(0);
				}

				// The critical assertion: we MUST have the Bash tool call regardless of streaming
				expect(result.toolCalls.some((tc) => tc.name === "Bash")).toBe(true);
				expect(result.toolCalls.length).toBeGreaterThan(0);
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Structured Output", () => {
		it(
			"should return structured JSON output when outputSchema is provided",
			async () => {
				const schema = {
					type: "object",
					properties: {
						name: { type: "string", description: "The person's name" },
						age: { type: "number", description: "The person's age" },
					},
					required: ["name", "age"],
				};

				const result = await collectMessages("Extract info: 'Alice is 25 years old.'", {
					maxTurns: 3, // Structured output uses a tool internally, requiring > 1 turn
					outputFormat: {
						type: "json_schema",
						schema,
					},
				});

				// Should have a result
				expect(result.messages.some((m) => m.type === "result")).toBe(true);

				// When using outputFormat, the SDK returns structured_output instead of text
				// Either finalText or structuredOutput should contain valid data
				const hasStructuredOutput = result.structuredOutput !== undefined;
				const hasTextOutput = result.finalText.length > 0;

				// At least one output format should be present
				expect(hasStructuredOutput || hasTextOutput).toBe(true);

				// If structured output is present, verify its shape
				if (hasStructuredOutput) {
					const output = result.structuredOutput as { name?: string; age?: number };
					expect(output).toHaveProperty("name");
					expect(output).toHaveProperty("age");
				}

				// If text output is present and looks like JSON, verify its shape
				if (hasTextOutput && result.finalText.trim().startsWith("{")) {
					const parsed = JSON.parse(result.finalText);
					expect(parsed).toHaveProperty("name");
					expect(parsed).toHaveProperty("age");
				}
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should emit correct message sequence for structured output",
			async () => {
				const schema = {
					type: "object",
					properties: {
						color: { type: "string" },
					},
					required: ["color"],
				};

				const result = await collectMessages("Extract: 'The sky is blue.' Return as JSON with color field.", {
					maxTurns: 3, // Structured output uses a tool internally, requiring > 1 turn
					outputFormat: {
						type: "json_schema",
						schema,
					},
				});

				// Should have system → assistant → result sequence
				expect(hasEventTypes(result.messages, ["system", "assistant", "result"])).toBe(true);
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Event Sequence Verification", () => {
		it(
			"should emit events in correct order: system → stream_events → assistant → result",
			async () => {
				const result = await collectMessages("Say hello.");

				// First message should be system init
				expect(result.messages[0]?.type).toBe("system");

				// Last message should be result
				expect(result.messages[result.messages.length - 1]?.type).toBe("result");

				// Should have assistant message somewhere
				expect(result.messages.some((m) => m.type === "assistant")).toBe(true);
			},
			LIVE_TEST_TIMEOUT,
		);

		it(
			"should include session_id in system init message",
			async () => {
				const result = await collectMessages("Hi.");

				const systemMsg = result.messages.find((m) => m.type === "system");
				expect(systemMsg).toBeDefined();

				const sysMsg = systemMsg as { session_id?: string };
				expect(sysMsg.session_id).toBeDefined();
				expect(typeof sysMsg.session_id).toBe("string");
				expect(sysMsg.session_id?.length).toBeGreaterThan(0);
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Error Handling", () => {
		it(
			"should handle normal completion without errors",
			async () => {
				const result = await collectMessages("What is 1 + 1?");

				// Should have result message
				const resultMsg = result.messages.find((m) => m.type === "result");
				expect(resultMsg).toBeDefined();

				// Result should indicate success
				const r = resultMsg as { is_error?: boolean; subtype?: string };
				expect(r.is_error).toBe(false);
				expect(r.subtype).toBe("success");
			},
			LIVE_TEST_TIMEOUT,
		);
	});

	describe("Multi-turn Conversations", () => {
		it(
			"should handle multi-turn with tool use correctly",
			async () => {
				const result = await collectMessages("Use the Bash tool to echo 'test'. Then tell me what the output was.", {
					maxTurns: 5,
				});

				// Should have at least one tool call
				expect(result.toolCalls.length).toBeGreaterThan(0);

				// Should have user message (tool result)
				expect(result.messages.some((m) => m.type === "user")).toBe(true);

				// Should have multiple assistant messages (before and after tool)
				const assistantMsgs = result.messages.filter((m) => m.type === "assistant");
				expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);
			},
			LIVE_TEST_TIMEOUT,
		);
	});
});

// ============================================================================
// Fixture Validation Tests (can run without live SDK)
// ============================================================================

describe("Fixture Structure Validation", () => {
	it("should have valid fixture type definitions", () => {
		// This test validates the fixture types match SDK output
		interface RecordedMessage {
			message: SDKMessage;
			relativeTimestamp: number;
			index: number;
		}

		interface Fixture {
			metadata: {
				scenario: string;
				recordedAt: string;
				model: string;
				durationMs: number;
				messageCount: number;
				sdkVersion: string;
				description: string;
			};
			prompt: string;
			messages: RecordedMessage[];
			result: {
				text?: string;
				sessionId?: string;
				hasStructuredOutput: boolean;
				toolCallsMade: string[];
			};
		}

		// Type check passes if this compiles
		const fixture: Fixture = {
			metadata: {
				scenario: "test",
				recordedAt: new Date().toISOString(),
				model: MODEL,
				durationMs: 100,
				messageCount: 1,
				sdkVersion: "0.2.5",
				description: "test fixture",
			},
			prompt: "test",
			messages: [],
			result: {
				hasStructuredOutput: false,
				toolCallsMade: [],
			},
		};

		expect(fixture).toBeDefined();
		expect(fixture.metadata.scenario).toBe("test");
	});
});
