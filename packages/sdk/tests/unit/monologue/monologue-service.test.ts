/**
 * MonologueService Unit Tests
 *
 * Tests cover:
 * - T010: Buffer management
 * - T011: Flush behavior (LLM wait signal "...")
 * - T012: History management
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { createMonologueService, type MonologueService } from "../../../src/monologue/monologue-service.js";
import type {
	AgentEvent,
	IMonologueLLM,
	MonologueConfig,
	NarrativeAgentName,
	NarrativeEntry,
} from "../../../src/monologue/types.js";

// ============================================================================
// Mock LLM Implementation
// ============================================================================

class MockMonologueLLM implements IMonologueLLM {
	public callCount = 0;
	public lastEvents: AgentEvent[] = [];
	public lastHistory: string[] = [];
	public lastIsFirst = false;
	public lastIsFinal = false;
	public responseQueue: string[] = [];

	constructor(defaultResponse = "Mock narrative") {
		this.responseQueue = [defaultResponse];
	}

	async generate(
		events: AgentEvent[],
		history: string[],
		_config: MonologueConfig,
		isFirst: boolean,
		isFinal: boolean,
	): Promise<string> {
		this.callCount++;
		this.lastEvents = [...events];
		this.lastHistory = [...history];
		this.lastIsFirst = isFirst;
		this.lastIsFinal = isFinal;

		const response = this.responseQueue.shift();
		if (response !== undefined) {
			return response;
		}
		return "Mock narrative";
	}

	queueResponses(...responses: string[]): void {
		this.responseQueue = responses;
	}

	reset(): void {
		this.callCount = 0;
		this.lastEvents = [];
		this.lastHistory = [];
		this.responseQueue = [];
	}
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createEvent(type: AgentEvent["event_type"] = "tool_call", agentName = "Parser"): AgentEvent {
	return {
		event_type: type,
		agent_name: agentName,
		session_id: "test-session",
		timestamp: Date.now(),
		payload: {
			type: "tool_call",
			tool_name: "read_file",
			tool_input: { path: "/test.txt" },
		},
	};
}

function createService(
	mockLLM: MockMonologueLLM,
	config?: Partial<MonologueConfig>,
	scope: NarrativeAgentName = "Parser",
): MonologueService {
	return createMonologueService({
		llm: mockLLM,
		config,
		scope,
		sessionId: "test-session",
	});
}

// ============================================================================
// T010: Buffer Management Tests
// ============================================================================

describe("MonologueService - Buffer Management (T010)", () => {
	let mockLLM: MockMonologueLLM;
	let service: MonologueService;

	beforeEach(() => {
		mockLLM = new MockMonologueLLM();
		service = createService(mockLLM, { minBufferSize: 3, maxBufferSize: 5 });
	});

	test("should start with empty buffer", () => {
		expect(service.getBufferSize()).toBe(0);
	});

	test("should add events to buffer", async () => {
		// Don't trigger LLM with minBufferSize 3
		mockLLM.queueResponses("..."); // Wait signal if called
		await service.addEvent(createEvent());
		expect(service.getBufferSize()).toBe(1);

		await service.addEvent(createEvent());
		expect(service.getBufferSize()).toBe(2);
	});

	test("should trigger LLM when buffer reaches minBufferSize", async () => {
		mockLLM.queueResponses("Narrative 1");
		service = createService(mockLLM, { minBufferSize: 2, maxBufferSize: 5 });

		await service.addEvent(createEvent());
		expect(mockLLM.callCount).toBe(0); // Below threshold

		await service.addEvent(createEvent());
		expect(mockLLM.callCount).toBe(1); // At threshold, LLM called
	});

	test("should clear buffer after successful narrative", async () => {
		mockLLM.queueResponses("Narrative 1");
		service = createService(mockLLM, { minBufferSize: 1, maxBufferSize: 5 });

		await service.addEvent(createEvent());
		expect(service.getBufferSize()).toBe(0); // Buffer cleared
	});

	test("should keep buffer on wait signal", async () => {
		mockLLM.queueResponses("...");
		service = createService(mockLLM, { minBufferSize: 1, maxBufferSize: 5 });

		await service.addEvent(createEvent());
		expect(service.getBufferSize()).toBe(1); // Buffer kept
	});

	test("should force flush at maxBufferSize", async () => {
		mockLLM.queueResponses("...", "...", "...", "...", "Forced narrative");
		service = createService(mockLLM, { minBufferSize: 1, maxBufferSize: 3 });

		await service.addEvent(createEvent());
		await service.addEvent(createEvent());
		await service.addEvent(createEvent());

		// Last call at maxBufferSize should have forced
		expect(mockLLM.lastIsFinal).toBe(true); // Force flag set
	});

	test("should reset buffer and history", async () => {
		mockLLM.queueResponses("Narrative 1");
		service = createService(mockLLM, { minBufferSize: 1, maxBufferSize: 5 });

		await service.addEvent(createEvent());
		expect(service.getHistory().length).toBe(1);

		service.reset();
		expect(service.getBufferSize()).toBe(0);
		expect(service.getHistory().length).toBe(0);
	});
});

// ============================================================================
// T011: Flush Behavior Tests
// ============================================================================

describe("MonologueService - Flush Behavior (T011)", () => {
	let mockLLM: MockMonologueLLM;
	let service: MonologueService;

	beforeEach(() => {
		mockLLM = new MockMonologueLLM();
		service = createService(mockLLM, { minBufferSize: 1, maxBufferSize: 5 });
	});

	test("should treat '...' as wait signal", async () => {
		mockLLM.queueResponses("...");

		await service.addEvent(createEvent());

		expect(service.getBufferSize()).toBe(1); // Buffer not cleared
		expect(service.getHistory().length).toBe(0); // No narrative added
	});

	test("should treat empty string as error/skip", async () => {
		mockLLM.queueResponses("");

		await service.addEvent(createEvent());

		expect(service.getBufferSize()).toBe(1); // Buffer not cleared
		expect(service.getHistory().length).toBe(0); // No narrative added
	});

	test("should emit narrative on valid response", async () => {
		mockLLM.queueResponses("Found the config file and extracted settings.");
		const emittedEntries: NarrativeEntry[] = [];

		service = createMonologueService({
			llm: mockLLM,
			config: { minBufferSize: 1, maxBufferSize: 5 },
			scope: "Parser",
			sessionId: "test-session",
			callback: {
				onNarrative: (entry) => {
					emittedEntries.push(entry);
				},
			},
		});

		await service.addEvent(createEvent());

		expect(emittedEntries.length).toBeGreaterThan(0);
		const emittedEntry = emittedEntries[0];
		if (emittedEntry) {
			expect(emittedEntry.text).toBe("Found the config file and extracted settings.");
			expect(emittedEntry.agentName).toBe("Parser");
		}
	});

	test("should set isFirst flag on first event", async () => {
		mockLLM.queueResponses("First narrative", "Second narrative");
		service = createService(mockLLM, { minBufferSize: 1 });

		await service.addEvent(createEvent());
		expect(mockLLM.lastIsFirst).toBe(true);

		await service.addEvent(createEvent());
		expect(mockLLM.lastIsFirst).toBe(false);
	});

	test("should set isFinal flag on finalFlush", async () => {
		mockLLM.queueResponses("...", "Final summary");

		await service.addEvent(createEvent());
		expect(mockLLM.lastIsFinal).toBe(false);

		await service.finalFlush();
		expect(mockLLM.lastIsFinal).toBe(true);
	});

	test("should return null on finalFlush with empty buffer", async () => {
		const result = await service.finalFlush();
		expect(result).toBeNull();
	});
});

// ============================================================================
// T012: History Management Tests
// ============================================================================

describe("MonologueService - History Management (T012)", () => {
	let mockLLM: MockMonologueLLM;
	let service: MonologueService;

	beforeEach(() => {
		mockLLM = new MockMonologueLLM();
	});

	test("should add narratives to history", async () => {
		mockLLM.queueResponses("Narrative 1", "Narrative 2", "Narrative 3");
		service = createService(mockLLM, { minBufferSize: 1, historySize: 5 });

		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["Narrative 1"]);

		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["Narrative 1", "Narrative 2"]);

		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["Narrative 1", "Narrative 2", "Narrative 3"]);
	});

	test("should enforce history size limit (FIFO)", async () => {
		mockLLM.queueResponses("N1", "N2", "N3", "N4");
		service = createService(mockLLM, { minBufferSize: 1, historySize: 3 });

		await service.addEvent(createEvent());
		await service.addEvent(createEvent());
		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["N1", "N2", "N3"]);

		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["N2", "N3", "N4"]); // N1 evicted
	});

	test("should pass history to LLM for continuity", async () => {
		mockLLM.queueResponses("First", "Second");
		service = createService(mockLLM, { minBufferSize: 1, historySize: 5 });

		await service.addEvent(createEvent());
		expect(mockLLM.lastHistory).toEqual([]); // No history yet

		await service.addEvent(createEvent());
		expect(mockLLM.lastHistory).toEqual(["First"]); // Previous narrative passed
	});

	test("should not add wait signals to history", async () => {
		mockLLM.queueResponses("...", "Real narrative");
		service = createService(mockLLM, { minBufferSize: 1, historySize: 5 });

		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual([]); // Wait signal not added

		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["Real narrative"]);
	});

	test("should support historySize of 0 (disabled)", async () => {
		mockLLM.queueResponses("N1", "N2");
		service = createService(mockLLM, { minBufferSize: 1, historySize: 0 });

		await service.addEvent(createEvent());
		await service.addEvent(createEvent());

		expect(service.getHistory()).toEqual([]); // History disabled
	});
});

// ============================================================================
// Metadata Tests
// ============================================================================

describe("MonologueService - Metadata", () => {
	test("should include metadata in narrative entry", async () => {
		const mockLLM = new MockMonologueLLM("Test narrative");
		const emittedEntries: NarrativeEntry[] = [];

		const service = createMonologueService({
			llm: mockLLM,
			config: { minBufferSize: 1, model: "haiku" },
			scope: "Coder",
			sessionId: "test-session",
			taskId: "T001",
			callback: {
				onNarrative: (entry) => {
					emittedEntries.push(entry);
				},
			},
		});

		await service.addEvent(createEvent());
		await service.addEvent(createEvent());

		// Force flush to get the narrative
		await service.finalFlush();

		expect(emittedEntries.length).toBeGreaterThan(0);
		const emittedEntry = emittedEntries[0];
		if (emittedEntry && emittedEntry.metadata) {
			expect(emittedEntry.metadata.model).toBe("haiku");
			expect(emittedEntry.metadata.latencyMs).toBeGreaterThanOrEqual(0);
		}
	});

	test("should set correct agentName from scope", async () => {
		const mockLLM = new MockMonologueLLM("Test");
		const emittedEntries: NarrativeEntry[] = [];

		const service = createMonologueService({
			llm: mockLLM,
			config: { minBufferSize: 1 },
			scope: "Reviewer",
			sessionId: "test",
			callback: {
				onNarrative: (entry) => {
					emittedEntries.push(entry);
				},
			},
		});

		await service.addEvent(createEvent());

		expect(emittedEntries.length).toBeGreaterThan(0);
		const emittedEntry = emittedEntries[0];
		if (emittedEntry) {
			expect(emittedEntry.agentName).toBe("Reviewer");
		}
	});
});

// ============================================================================
// T036: Custom SystemPrompt Injection Tests
// ============================================================================

describe("MonologueService - Custom SystemPrompt (T036)", () => {
	test("should use custom systemPrompt when provided", async () => {
		const customPrompt = "You are a terse narrator. Use only 5 words max.";
		const mockLLM = new MockMonologueLLM("Short.");

		const service = createMonologueService({
			llm: mockLLM,
			config: {
				minBufferSize: 1,
				systemPrompt: customPrompt,
			},
			scope: "Parser",
			sessionId: "test",
		});

		await service.addEvent(createEvent());

		// Verify the config has the custom prompt
		const config = service.getConfig();
		expect(config.systemPrompt).toBe(customPrompt);
	});

	test("should use default prompt when systemPrompt not provided", async () => {
		const mockLLM = new MockMonologueLLM();

		const service = createMonologueService({
			llm: mockLLM,
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
		});

		const config = service.getConfig();
		expect(config.systemPrompt).toBeUndefined();
	});

	test("should pass custom systemPrompt to LLM via config", async () => {
		const customPrompt = "Custom narrator instructions";
		const capturedConfigs: MonologueConfig[] = [];

		class CapturingMockLLM implements IMonologueLLM {
			async generate(_events: AgentEvent[], _history: string[], config: MonologueConfig): Promise<string> {
				capturedConfigs.push(config);
				return "Mock";
			}
		}

		const service = createMonologueService({
			llm: new CapturingMockLLM(),
			config: {
				minBufferSize: 1,
				systemPrompt: customPrompt,
			},
			scope: "Parser",
			sessionId: "test",
		});

		await service.addEvent(createEvent());

		expect(capturedConfigs.length).toBeGreaterThan(0);
		const receivedConfig = capturedConfigs[0];
		if (receivedConfig) {
			expect(receivedConfig.systemPrompt).toBe(customPrompt);
		}
	});
});

// ============================================================================
// T041: LLM Timeout Handling Tests
// ============================================================================

describe("MonologueService - Timeout Handling (T041)", () => {
	test("should handle slow LLM response gracefully", async () => {
		class SlowMockLLM implements IMonologueLLM {
			async generate(): Promise<string> {
				// Simulate slow response (but not actual timeout - just tests the pattern)
				await new Promise((resolve) => setTimeout(resolve, 10));
				return "Slow narrative";
			}
		}

		const service = createMonologueService({
			llm: new SlowMockLLM(),
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
		});

		// Should not throw
		await service.addEvent(createEvent());
		expect(service.getHistory()).toEqual(["Slow narrative"]);
	});

	test("should continue execution when LLM times out (returns empty)", async () => {
		class TimeoutMockLLM implements IMonologueLLM {
			async generate(): Promise<string> {
				// Simulate timeout by returning empty string (what AnthropicMonologueLLM does)
				return "";
			}
		}

		let _errorLogged = false;
		const service = createMonologueService({
			llm: new TimeoutMockLLM(),
			config: { minBufferSize: 1 },
			scope: "Parser",
			sessionId: "test",
			callback: {
				onNarrative: () => {},
				onError: () => {
					_errorLogged = true;
				},
			},
		});

		// Should not throw
		await service.addEvent(createEvent());

		// Buffer preserved on failure (empty string treated as failure)
		expect(service.getBufferSize()).toBe(1);
	});
});
