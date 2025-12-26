/**
 * @Monologue Decorator Unit Tests
 *
 * Tests cover:
 * - T018: Wrapper behavior
 * - T019: EventBus subscription/unsubscription
 * - T020: Final flush on method completion
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Container } from "@needle-di/core";
import { IEventBusToken, IMonologueLLMToken } from "../../../src/core/tokens.js";
import { Monologue, setMonologueContainer } from "../../../src/monologue/monologue-decorator.js";
import type { AgentEvent, IMonologueLLM, MonologueConfig } from "../../../src/monologue/types.js";
import type { AgentEvent as SDKAgentEvent } from "../../../src/providers/anthropic/runner/models.js";

// ============================================================================
// Mock Implementations
// ============================================================================

class MockEventBus {
	public subscriptions: Array<(event: SDKAgentEvent) => void> = [];
	public unsubscribeCalled = false;

	subscribe(callback: (event: SDKAgentEvent) => void): () => void {
		this.subscriptions.push(callback);
		return () => {
			this.unsubscribeCalled = true;
			this.subscriptions = this.subscriptions.filter((cb) => cb !== callback);
		};
	}

	// Required by IEventBus interface
	publish(event: SDKAgentEvent): void {
		this.emit(event);
	}

	// Emit an event to all subscribers
	emit(event: SDKAgentEvent): void {
		for (const callback of this.subscriptions) {
			callback(event);
		}
	}
}

class MockMonologueLLM implements IMonologueLLM {
	public callCount = 0;
	public lastEvents: AgentEvent[] = [];
	public generateSpy = mock(() => Promise.resolve("Mock narrative"));

	async generate(
		events: AgentEvent[],
		_history: string[],
		_config: MonologueConfig,
		_isFirst: boolean,
		_isFinal: boolean,
	): Promise<string> {
		this.callCount++;
		this.lastEvents = [...events];
		return this.generateSpy();
	}

	queueResponse(response: string): void {
		this.generateSpy.mockImplementationOnce(() => Promise.resolve(response));
	}
}

function createTestContainer(eventBus: MockEventBus, llm: MockMonologueLLM): Container {
	const container = new Container();

	container.bind({
		provide: IEventBusToken,
		useValue: eventBus,
	});

	container.bind({
		provide: IMonologueLLMToken,
		useValue: llm,
	});

	return container;
}

function createSDKEvent(eventType = "tool_call"): SDKAgentEvent {
	return {
		timestamp: new Date(),
		event_type: eventType as SDKAgentEvent["event_type"],
		agent_name: "Parser",
		content: "test content",
		tool_name: "read_file",
		tool_input: { path: "/test.txt" },
	};
}

// ============================================================================
// T018: Wrapper Behavior Tests
// ============================================================================

describe("@Monologue Decorator - Wrapper Behavior (T018)", () => {
	let eventBus: MockEventBus;
	let llm: MockMonologueLLM;

	beforeEach(() => {
		eventBus = new MockEventBus();
		llm = new MockMonologueLLM();
		const container = createTestContainer(eventBus, llm);
		setMonologueContainer(container);
	});

	test("should call original method and return its value", async () => {
		class TestAgent {
			@Monologue("Parser")
			async process(input: string): Promise<string> {
				return `processed: ${input}`;
			}
		}

		const agent = new TestAgent();
		const result = await agent.process("test input");

		expect(result).toBe("processed: test input");
	});

	test("should preserve 'this' context in original method", async () => {
		class TestAgent {
			public name = "MyAgent";

			@Monologue("Parser")
			async process(): Promise<string> {
				return this.name;
			}
		}

		const agent = new TestAgent();
		const result = await agent.process();

		expect(result).toBe("MyAgent");
	});

	test("should pass all arguments to original method", async () => {
		class TestAgent {
			public receivedArgs: unknown[] = [];

			@Monologue("Parser")
			async process(a: string, b: number, c: boolean): Promise<void> {
				this.receivedArgs = [a, b, c];
			}
		}

		const agent = new TestAgent();
		await agent.process("hello", 42, true);

		expect(agent.receivedArgs).toEqual(["hello", 42, true]);
	});

	test("should propagate errors from original method", async () => {
		class TestAgent {
			@Monologue("Parser")
			async process(): Promise<void> {
				throw new Error("Test error");
			}
		}

		const agent = new TestAgent();

		expect(agent.process()).rejects.toThrow("Test error");
	});

	test("should work with async methods that return void", async () => {
		let sideEffect = false;

		class TestAgent {
			@Monologue("Parser")
			async process(): Promise<void> {
				sideEffect = true;
			}
		}

		const agent = new TestAgent();
		await agent.process();

		expect(sideEffect).toBe(true);
	});
});

// ============================================================================
// T019: EventBus Subscription/Unsubscription Tests
// ============================================================================

describe("@Monologue Decorator - EventBus Subscription (T019)", () => {
	let eventBus: MockEventBus;
	let llm: MockMonologueLLM;

	beforeEach(() => {
		eventBus = new MockEventBus();
		llm = new MockMonologueLLM();
		const container = createTestContainer(eventBus, llm);
		setMonologueContainer(container);
	});

	test("should subscribe to EventBus when method is called", async () => {
		class TestAgent {
			@Monologue("Parser")
			async process(): Promise<void> {
				// Method runs
			}
		}

		const agent = new TestAgent();
		expect(eventBus.subscriptions.length).toBe(0);

		await agent.process();

		// Subscription should have been created (and cleaned up)
		expect(eventBus.unsubscribeCalled).toBe(true);
	});

	test("should unsubscribe from EventBus after method completes", async () => {
		class TestAgent {
			@Monologue("Parser")
			async process(): Promise<void> {
				// Check subscription exists during execution
				expect(eventBus.subscriptions.length).toBe(1);
			}
		}

		const agent = new TestAgent();
		await agent.process();

		// After completion, unsubscribe should have been called
		expect(eventBus.unsubscribeCalled).toBe(true);
		expect(eventBus.subscriptions.length).toBe(0);
	});

	test("should unsubscribe even if method throws error", async () => {
		class TestAgent {
			@Monologue("Parser")
			async process(): Promise<void> {
				throw new Error("Method error");
			}
		}

		const agent = new TestAgent();

		try {
			await agent.process();
		} catch {
			// Expected error
		}

		expect(eventBus.unsubscribeCalled).toBe(true);
		expect(eventBus.subscriptions.length).toBe(0);
	});

	test("should capture events during method execution", async () => {
		let capturedEventCount = 0;
		llm.generateSpy.mockImplementation(() => {
			capturedEventCount = llm.lastEvents.length;
			return Promise.resolve("...");
		});

		class TestAgent {
			@Monologue("Parser", { config: { minBufferSize: 1 } })
			async process(): Promise<void> {
				// Emit an event during execution
				eventBus.emit(createSDKEvent("tool_call"));
			}
		}

		const agent = new TestAgent();
		await agent.process();

		// Event should have been captured
		expect(capturedEventCount).toBeGreaterThanOrEqual(1);
	});
});

// ============================================================================
// T020: Final Flush Tests
// ============================================================================

describe("@Monologue Decorator - Final Flush (T020)", () => {
	let eventBus: MockEventBus;
	let llm: MockMonologueLLM;

	beforeEach(() => {
		eventBus = new MockEventBus();
		llm = new MockMonologueLLM();
		const container = createTestContainer(eventBus, llm);
		setMonologueContainer(container);
	});

	test("should call finalFlush when method completes successfully", async () => {
		llm.generateSpy.mockImplementation(() => {
			return Promise.resolve("Final narrative");
		});

		class TestAgent {
			@Monologue("Parser", { config: { minBufferSize: 1 } })
			async process(): Promise<void> {
				eventBus.emit(createSDKEvent());
			}
		}

		const agent = new TestAgent();
		await agent.process();

		// LLM should have been called (for final flush at minimum)
		expect(llm.callCount).toBeGreaterThanOrEqual(1);
	});

	test("should call finalFlush even when method throws", async () => {
		class TestAgent {
			@Monologue("Parser", { config: { minBufferSize: 1 } })
			async process(): Promise<void> {
				eventBus.emit(createSDKEvent());
				throw new Error("Method error");
			}
		}

		const agent = new TestAgent();
		const initialCallCount = llm.callCount;

		try {
			await agent.process();
		} catch {
			// Expected
		}

		// LLM should have been called for final flush
		expect(llm.callCount).toBeGreaterThan(initialCallCount);
	});

	test("should include all buffered events in final flush", async () => {
		let lastEventCount = 0;
		llm.generateSpy.mockImplementation(() => {
			lastEventCount = llm.lastEvents.length;
			return Promise.resolve("...");
		});

		class TestAgent {
			@Monologue("Parser", { config: { minBufferSize: 10, maxBufferSize: 20 } })
			async process(): Promise<void> {
				// Emit multiple events, but below minBufferSize
				eventBus.emit(createSDKEvent("tool_call"));
				eventBus.emit(createSDKEvent("tool_result"));
				eventBus.emit(createSDKEvent("text"));
			}
		}

		const agent = new TestAgent();
		await agent.process();

		// Final flush should have all buffered events
		expect(lastEventCount).toBe(3);
	});
});

// ============================================================================
// Session ID and Task ID Provider Tests
// ============================================================================

describe("@Monologue Decorator - ID Providers", () => {
	let eventBus: MockEventBus;
	let llm: MockMonologueLLM;

	beforeEach(() => {
		eventBus = new MockEventBus();
		llm = new MockMonologueLLM();
		const container = createTestContainer(eventBus, llm);
		setMonologueContainer(container);
	});

	test("should use sessionIdProvider when provided", async () => {
		class TestAgent {
			@Monologue("Parser", {
				sessionIdProvider: (args) => `session-${args[0]}`,
				config: { minBufferSize: 1 },
			})
			async process(_id: string): Promise<void> {
				eventBus.emit(createSDKEvent());
			}
		}

		const agent = new TestAgent();
		await agent.process("123");

		// Check that session ID was used (captured in events)
		expect(llm.lastEvents.length).toBeGreaterThanOrEqual(1);
		const firstEvent = llm.lastEvents[0];
		if (firstEvent) {
			expect(firstEvent.session_id).toBe("session-123");
		}
	});

	test("should generate session ID when provider not specified", async () => {
		class TestAgent {
			@Monologue("Parser", { config: { minBufferSize: 1 } })
			async process(): Promise<void> {
				eventBus.emit(createSDKEvent());
			}
		}

		const agent = new TestAgent();
		await agent.process();

		expect(llm.lastEvents.length).toBeGreaterThanOrEqual(1);
		const autoGenEvent = llm.lastEvents[0];
		if (autoGenEvent) {
			expect(autoGenEvent.session_id).toMatch(/^monologue-\d+-[a-z0-9]+$/);
		}
	});
});

// ============================================================================
// Callback Tests
// ============================================================================

describe("@Monologue Decorator - Callback", () => {
	let eventBus: MockEventBus;
	let llm: MockMonologueLLM;

	beforeEach(() => {
		eventBus = new MockEventBus();
		llm = new MockMonologueLLM();
		llm.generateSpy.mockImplementation(() => Promise.resolve("Test narrative"));
		const container = createTestContainer(eventBus, llm);
		setMonologueContainer(container);
	});

	test("should invoke callback with narrative entry", async () => {
		const narratives: Array<{ text: string; agentName: string }> = [];

		class TestAgent {
			@Monologue("Parser", {
				config: { minBufferSize: 1 },
				callback: {
					onNarrative: (entry) => {
						narratives.push({ text: entry.text, agentName: entry.agentName });
					},
				},
			})
			async process(): Promise<void> {
				eventBus.emit(createSDKEvent());
			}
		}

		const agent = new TestAgent();
		await agent.process();

		expect(narratives.length).toBeGreaterThanOrEqual(1);
		const firstNarrative = narratives[0];
		if (firstNarrative) {
			expect(firstNarrative.text).toBe("Test narrative");
			expect(firstNarrative.agentName).toBe("Parser");
		}
	});
});
