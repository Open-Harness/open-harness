/**
 * Mock Injection Tests for MonologueService
 *
 * Demonstrates and verifies the DI-based mock injection pattern
 * for testing without real API calls.
 *
 * Tests cover:
 * - T026: Verify MonologueService accepts injected IMonologueLLM
 * - T028: Example test demonstrating mock injection
 */

import { describe, expect, test } from "bun:test";
import { createMonologueService } from "../../../src/monologue/monologue-service.js";
import type { AgentEvent, IMonologueLLM } from "../../../src/monologue/types.js";
import { createMockLLM, createWaitingMockLLM, MockMonologueLLM } from "../../helpers/mock-monologue-llm.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createToolCallEvent(): AgentEvent {
	return {
		event_type: "tool_call",
		agent_name: "Parser",
		session_id: "test-session",
		timestamp: Date.now(),
		payload: {
			type: "tool_call",
			tool_name: "read_file",
			tool_input: { path: "/config.json" },
		},
	};
}

function createToolResultEvent(): AgentEvent {
	return {
		event_type: "tool_result",
		agent_name: "Parser",
		session_id: "test-session",
		timestamp: Date.now(),
		payload: {
			type: "tool_result",
			tool_name: "read_file",
			result: { content: '{"database": "postgres"}' },
		},
	};
}

// ============================================================================
// T026: Verify MonologueService Accepts Injected IMonologueLLM
// ============================================================================

describe("MonologueService - Mock Injection (T026)", () => {
	test("should accept any IMonologueLLM implementation via options", async () => {
		// Create a custom mock implementation
		class CustomMockLLM implements IMonologueLLM {
			wasInvoked = false;

			async generate(): Promise<string> {
				this.wasInvoked = true;
				return "Custom mock response";
			}
		}

		const customMock = new CustomMockLLM();

		// Inject via options
		const service = createMonologueService({
			llm: customMock,
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
		});

		// Use the service
		await service.addEvent(createToolCallEvent());

		// Verify custom mock was used
		expect(customMock.wasInvoked).toBe(true);
	});

	test("should use injected mock for all LLM calls", async () => {
		const mock = new MockMonologueLLM();
		mock.queueResponses("First narrative", "Second narrative");

		const service = createMonologueService({
			llm: mock,
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
		});

		// Multiple calls should all use the mock
		await service.addEvent(createToolCallEvent());
		await service.addEvent(createToolResultEvent());

		expect(mock.callCount).toBe(2);
		const call0 = mock.calls[0];
		const call1 = mock.calls[1];
		if (call0 && call1) {
			expect(call0.response).toBe("First narrative");
			expect(call1.response).toBe("Second narrative");
		}
	});

	test("should allow inspecting LLM call arguments", async () => {
		const mock = new MockMonologueLLM();

		const service = createMonologueService({
			llm: mock,
			config: { minBufferSize: 1, historySize: 5 },
			scope: "Coder",
			sessionId: "session-123",
		});

		await service.addEvent(createToolCallEvent());

		// Inspect what was passed to the LLM
		expect(mock.lastEvents.length).toBe(1);
		const firstEvent = mock.lastEvents[0];
		if (firstEvent) {
			expect(firstEvent.event_type).toBe("tool_call");
		}
		expect(mock.lastIsFirst).toBe(true);
		expect(mock.lastIsFinal).toBe(false);
	});
});

// ============================================================================
// T028: Example Tests Demonstrating Mock Injection
// ============================================================================

describe("MonologueService - Mock Injection Examples (T028)", () => {
	test("Example: Basic mock with single response", async () => {
		// Simple helper for single-response mocks
		const mock = createMockLLM("Found the configuration file and parsed the settings.");

		const entries: string[] = [];

		// Create service with callback to capture narratives
		const serviceWithCallback = createMonologueService({
			llm: mock,
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
			callback: {
				onNarrative: (entry) => {
					entries.push(entry.text);
				},
			},
		});

		await serviceWithCallback.addEvent(createToolCallEvent());

		expect(entries).toContain("Found the configuration file and parsed the settings.");
	});

	test("Example: Testing wait-then-narrate pattern", async () => {
		// Create mock that waits twice before narrating
		const mock = createWaitingMockLLM(2, "Now I understand the code structure.");

		const service = createMonologueService({
			llm: mock,
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
		});

		// First event: mock returns "..." (wait)
		await service.addEvent(createToolCallEvent());
		const firstCall = mock.calls[0];
		if (firstCall) {
			expect(firstCall.response).toBe("...");
		}
		expect(service.getBufferSize()).toBe(1); // Buffer kept

		// Second event: mock returns "..." (still waiting)
		await service.addEvent(createToolResultEvent());
		const secondCall = mock.calls[1];
		if (secondCall) {
			expect(secondCall.response).toBe("...");
		}
		expect(service.getBufferSize()).toBe(2); // Buffer accumulates

		// Third event: mock returns narrative
		await service.addEvent(createToolCallEvent());
		const thirdCall = mock.calls[2];
		if (thirdCall) {
			expect(thirdCall.response).toBe("Now I understand the code structure.");
		}
		expect(service.getBufferSize()).toBe(0); // Buffer cleared
	});

	test("Example: Testing history continuity", async () => {
		const mock = new MockMonologueLLM();
		mock.queueResponses("First task done.", "Building on first result.", "Final summary.");

		const service = createMonologueService({
			llm: mock,
			config: { minBufferSize: 1, historySize: 5 },
			scope: "Coder",
			sessionId: "test",
		});

		// First call: no history
		await service.addEvent(createToolCallEvent());
		const histCall0 = mock.calls[0];
		if (histCall0) {
			expect(histCall0.history).toEqual([]);
		}

		// Second call: should receive first narrative in history
		await service.addEvent(createToolResultEvent());
		const histCall1 = mock.calls[1];
		if (histCall1) {
			expect(histCall1.history).toEqual(["First task done."]);
		}

		// Third call: should receive both previous narratives
		await service.addEvent(createToolCallEvent());
		const histCall2 = mock.calls[2];
		if (histCall2) {
			expect(histCall2.history).toEqual(["First task done.", "Building on first result."]);
		}
	});

	test("Example: Testing final flush behavior", async () => {
		const mock = new MockMonologueLLM({ waitByDefault: true });
		mock.queueResponses("...", "...", "...", "Final summary generated."); // Waits until force

		const service = createMonologueService({
			llm: mock,
			config: { minBufferSize: 1, maxBufferSize: 10 },
			scope: "Reviewer",
			sessionId: "test",
		});

		// Add events (all return "..." as wait signal)
		await service.addEvent(createToolCallEvent());
		await service.addEvent(createToolResultEvent());
		await service.addEvent(createToolCallEvent());

		// Verify buffer accumulated (wait signals don't clear it)
		expect(service.getBufferSize()).toBe(3);

		// Force final flush
		await service.finalFlush();

		// Check that final call had isFinal=true
		expect(mock.lastIsFinal).toBe(true);
	});

	test("Example: Testing config override per scope", async () => {
		const mock = new MockMonologueLLM();

		// Parser scope: verbose mode, larger buffers
		const parserService = createMonologueService({
			llm: mock,
			config: {
				minBufferSize: 5,
				maxBufferSize: 20,
				historySize: 10,
			},
			scope: "Parser",
			sessionId: "test",
		});

		// Coder scope: terse mode, smaller buffers
		const coderService = createMonologueService({
			llm: mock,
			config: {
				minBufferSize: 1,
				maxBufferSize: 5,
				historySize: 3,
			},
			scope: "Coder",
			sessionId: "test",
		});

		// Verify each service uses its own config
		expect(parserService.getConfig().minBufferSize).toBe(5);
		expect(coderService.getConfig().minBufferSize).toBe(1);
	});
});

// ============================================================================
// Pattern: Mock LLM for Error Scenarios
// ============================================================================

describe("MonologueService - Error Handling with Mocks", () => {
	test("should continue execution when LLM throws error", async () => {
		// Create a mock that throws errors
		class FailingMockLLM implements IMonologueLLM {
			callCount = 0;

			async generate(): Promise<string> {
				this.callCount++;
				if (this.callCount === 1) {
					throw new Error("API rate limited");
				}
				return "Recovery narrative";
			}
		}

		const failingMock = new FailingMockLLM();
		let errorLogged = false;
		const narratives: string[] = [];

		const service = createMonologueService({
			llm: failingMock,
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
			callback: {
				onNarrative: (entry) => {
					narratives.push(entry.text);
				},
				onError: (error) => {
					errorLogged = true;
					expect(error.message).toBe("API rate limited");
				},
			},
		});

		// First event: LLM throws, but service continues
		await service.addEvent(createToolCallEvent());
		expect(errorLogged).toBe(true);
		expect(service.getBufferSize()).toBe(1); // Buffer preserved on error

		// Second event: LLM recovers
		await service.addEvent(createToolResultEvent());
		expect(failingMock.callCount).toBe(2);
		expect(narratives).toContain("Recovery narrative");
	});
});
