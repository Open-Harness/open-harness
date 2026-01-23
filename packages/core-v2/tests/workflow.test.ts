/**
 * Workflow Tests
 *
 * Tests for the Workflow class and createWorkflow factory, including:
 * - WorkflowDefinition interface
 * - createWorkflow factory function
 * - Workflow.run() execution
 * - Workflow.load() session loading
 * - Workflow.dispose() cleanup
 * - Event routing (FR-002)
 * - Sequential processing (FR-003)
 * - Termination condition (FR-040)
 * - Tape creation from results
 */

import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { Agent } from "../src/agent/Agent.js";
import type { AnyEvent } from "../src/event/Event.js";
import { createEvent } from "../src/event/Event.js";
import type { HandlerDefinition } from "../src/handler/Handler.js";
import { generateSessionId, type SessionMetadata, type StoreService } from "../src/store/Store.js";
import { createWorkflow, type Workflow, type WorkflowDefinition } from "../src/workflow/Workflow.js";

// ============================================================================
// Test State Types
// ============================================================================

interface TestState {
	count: number;
	messages: string[];
	terminated: boolean;
}

const initialTestState: TestState = {
	count: 0,
	messages: [],
	terminated: false,
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test handler definition.
 */
const createTestHandler = (
	name: string,
	handles: string,
	handler: (event: AnyEvent, state: TestState) => { state: TestState; events: readonly AnyEvent[] },
): HandlerDefinition<AnyEvent, TestState> => ({
	name,
	handles,
	handler,
});

/**
 * Create a test agent.
 * Note: Currently unused but kept for future agent integration tests.
 */
const _createTestAgent = (
	name: string,
	activatesOn: readonly string[],
	when?: (state: TestState) => boolean,
): Agent<unknown, unknown> => ({
	name,
	activatesOn,
	emits: ["agent:response"],
	outputSchema: z.object({ response: z.string() }),
	prompt: (state, _event) => `State count: ${(state as TestState).count}`,
	when: when ? (state: unknown) => when(state as TestState) : undefined,
	onOutput: (output, event) => [
		createEvent(
			"agent:response",
			{
				agentName: name,
				response: (output as { response: string }).response,
			},
			event.id,
		),
	],
});

// Track workflows for cleanup
const workflows: Workflow<unknown>[] = [];

afterEach(async () => {
	// Cleanup all created workflows
	for (const w of workflows) {
		await w.dispose();
	}
	workflows.length = 0;
});

// ============================================================================
// WorkflowDefinition Interface Tests
// ============================================================================

describe("WorkflowDefinition", () => {
	it("should require name, initialState, handlers, agents, and until", () => {
		const definition: WorkflowDefinition<TestState> = {
			name: "test-workflow",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		};

		expect(definition.name).toBe("test-workflow");
		expect(definition.initialState).toEqual(initialTestState);
		expect(definition.handlers).toEqual([]);
		expect(definition.agents).toEqual([]);
		expect(typeof definition.until).toBe("function");
	});

	it("should support optional store", () => {
		const mockStore: StoreService = {
			append: () => Effect.void,
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.void,
			snapshot: () => Effect.succeed(undefined),
		};

		const definition: WorkflowDefinition<TestState> = {
			name: "with-store",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
			store: mockStore,
		};

		expect(definition.store).toBeDefined();
	});

	it("should support optional model", () => {
		const definition: WorkflowDefinition<TestState> = {
			name: "with-model",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
			model: "claude-sonnet-4-20250514",
		};

		expect(definition.model).toBe("claude-sonnet-4-20250514");
	});
});

// ============================================================================
// createWorkflow Factory Tests
// ============================================================================

describe("createWorkflow", () => {
	it("should create a Workflow instance", () => {
		const workflow = createWorkflow<TestState>({
			name: "factory-test",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		expect(workflow.name).toBe("factory-test");
		expect(typeof workflow.run).toBe("function");
		expect(typeof workflow.load).toBe("function");
		expect(typeof workflow.dispose).toBe("function");
	});

	it("should preserve workflow name from definition", () => {
		const workflow = createWorkflow<TestState>({
			name: "my-chat-workflow",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		expect(workflow.name).toBe("my-chat-workflow");
	});
});

// ============================================================================
// Workflow.run() Tests
// ============================================================================

describe("Workflow.run()", () => {
	it("should process input and return result", async () => {
		const handler = createTestHandler("handleUserInput", "user:input", (event, state) => ({
			state: {
				...state,
				count: state.count + 1,
				messages: [...state.messages, (event.payload as { text: string }).text],
			},
			events: [],
		}));

		const workflow = createWorkflow<TestState>({
			name: "run-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "Hello" });

		expect(result.state.count).toBe(1);
		expect(result.state.messages).toEqual(["Hello"]);
		expect(result.events.length).toBe(1);
		expect(result.events[0]?.name).toBe("user:input");
	});

	it("should return a Tape for time-travel debugging", async () => {
		const handler = createTestHandler("handleInput", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const workflow = createWorkflow<TestState>({
			name: "tape-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "test" });

		// Tape should be included in result
		expect(result.tape).toBeDefined();
		expect(result.tape.length).toBe(1);
		expect(result.tape.position).toBe(0);

		// Tape should have the computed state
		expect(result.tape.state.count).toBe(1);
	});

	it("should create user:input event from input string", async () => {
		const capturedEvents: AnyEvent[] = [];

		const handler = createTestHandler("captureInput", "user:input", (event, state) => {
			capturedEvents.push(event);
			return { state, events: [] };
		});

		const workflow = createWorkflow<TestState>({
			name: "input-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({ input: "My input text" });

		expect(capturedEvents.length).toBe(1);
		expect(capturedEvents[0]?.name).toBe("user:input");
		expect((capturedEvents[0]?.payload as { text: string }).text).toBe("My input text");
	});

	it("should terminate when until condition is met (FR-040)", async () => {
		const handler = createTestHandler("handleIncrement", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1, terminated: true },
			events: [],
		}));

		const workflow = createWorkflow<TestState>({
			name: "terminate-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: (state) => state.terminated,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "trigger" });

		expect(result.terminated).toBe(true);
		expect(result.state.terminated).toBe(true);
	});

	it("should generate sessionId in result", async () => {
		const workflow = createWorkflow<TestState>({
			name: "session-test",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "test" });

		expect(result.sessionId).toBeDefined();
		expect(typeof result.sessionId).toBe("string");
		expect(result.sessionId.length).toBeGreaterThan(0);
	});

	it("should use provided sessionId when given", async () => {
		const customSessionId = generateSessionId();

		// Need a mock store since record: true requires a configured store
		const mockStore: StoreService = {
			append: () => Effect.void,
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.void,
			snapshot: () => Effect.succeed(undefined),
		};

		const workflow = createWorkflow<TestState>({
			name: "custom-session-test",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
			store: mockStore,
		});
		workflows.push(workflow);

		const result = await workflow.run({
			input: "test",
			record: true,
			sessionId: customSessionId,
		});

		expect(result.sessionId).toBe(customSessionId);
	});

	it("should call onEvent callback for each event", async () => {
		const receivedEvents: string[] = [];

		const handler = createTestHandler("handleInput", "user:input", (event, state) => ({
			state,
			events: [createEvent("processed", {}, event.id)],
		}));

		const workflow = createWorkflow<TestState>({
			name: "callback-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({
			input: "test",
			callbacks: {
				onEvent: (event) => {
					receivedEvents.push(event.name);
				},
			},
		});

		expect(receivedEvents).toContain("user:input");
		expect(receivedEvents).toContain("processed");
	});

	it("should call onStateChange callback when state changes", async () => {
		const stateSnapshots: number[] = [];

		const handler = createTestHandler("handleInput", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 5 },
			events: [],
		}));

		const workflow = createWorkflow<TestState>({
			name: "state-callback-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({
			input: "test",
			callbacks: {
				onStateChange: (state) => {
					stateSnapshots.push(state.count);
				},
			},
		});

		expect(stateSnapshots).toContain(5);
	});

	it("should call onError callback when handler throws", async () => {
		const receivedErrors: string[] = [];

		const handler = createTestHandler("handleFailing", "user:input", () => {
			throw new Error("Handler explosion!");
		});

		const workflow = createWorkflow<TestState>({
			name: "error-callback-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({
			input: "test",
			callbacks: {
				onError: (error) => {
					receivedErrors.push(error.message);
				},
			},
		});

		expect(receivedErrors).toContain("Handler explosion!");
	});

	it("should process chain of events sequentially (FR-003)", async () => {
		const processOrder: string[] = [];

		const handlers = [
			createTestHandler("handleA", "user:input", (event, state) => {
				processOrder.push("A");
				return {
					state: { ...state, count: state.count + 1 },
					events: [createEvent("event:b", { from: "a" }, event.id)],
				};
			}),
			createTestHandler("handleB", "event:b", (event, state) => {
				processOrder.push("B");
				return {
					state: { ...state, count: state.count + 10 },
					events: [createEvent("event:c", { from: "b" }, event.id)],
				};
			}),
			createTestHandler("handleC", "event:c", (_event, state) => {
				processOrder.push("C");
				return {
					state: { ...state, count: state.count + 100 },
					events: [],
				};
			}),
		];

		const workflow = createWorkflow<TestState>({
			name: "sequential-test",
			initialState: initialTestState,
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "start" });

		expect(processOrder).toEqual(["A", "B", "C"]);
		expect(result.state.count).toBe(111);
		expect(result.events.length).toBe(3);
	});
});

// ============================================================================
// Workflow.load() Tests
// ============================================================================

describe("Workflow.load()", () => {
	it("should load recorded session as Tape", async () => {
		const storedEvents = new Map<string, AnyEvent[]>();

		const mockStore: StoreService = {
			append: (sessionId, event) =>
				Effect.sync(() => {
					const events = storedEvents.get(sessionId) ?? [];
					events.push(event);
					storedEvents.set(sessionId, events);
				}),
			events: (sessionId) => Effect.succeed(storedEvents.get(sessionId) ?? []),
			sessions: () =>
				Effect.succeed(
					Array.from(storedEvents.entries()).map(([id, events]) => ({
						id: id as SessionMetadata["id"],
						createdAt: new Date(),
						eventCount: events.length,
					})) as readonly SessionMetadata[],
				),
			clear: (sessionId) =>
				Effect.sync(() => {
					storedEvents.delete(sessionId);
				}),
			snapshot: () => Effect.succeed(undefined),
		};

		const handler = createTestHandler("handleInput", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const workflow = createWorkflow<TestState>({
			name: "load-test",
			initialState: initialTestState,
			handlers: [handler],
			agents: [],
			until: () => false,
			store: mockStore,
		});
		workflows.push(workflow);

		// Run with recording
		const result = await workflow.run({
			input: "test",
			record: true,
		});

		// Load the session
		const tape = await workflow.load(result.sessionId);

		expect(tape.length).toBe(1);
		expect(tape.events[0]?.name).toBe("user:input");
		expect(tape.state.count).toBe(1);
	});

	it("should throw if session not found", async () => {
		const workflow = createWorkflow<TestState>({
			name: "not-found-test",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await expect(workflow.load(generateSessionId())).rejects.toThrow();
	});

	it("should return Tape with time-travel capabilities", async () => {
		const storedEvents = new Map<string, AnyEvent[]>();

		const mockStore: StoreService = {
			append: (sessionId, event) =>
				Effect.sync(() => {
					const events = storedEvents.get(sessionId) ?? [];
					events.push(event);
					storedEvents.set(sessionId, events);
				}),
			events: (sessionId) => Effect.succeed(storedEvents.get(sessionId) ?? []),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.void,
			snapshot: () => Effect.succeed(undefined),
		};

		const handlers = [
			createTestHandler("handleInput", "user:input", (event, state) => ({
				state: { ...state, count: state.count + 1 },
				events: [createEvent("step:two", {}, event.id)],
			})),
			createTestHandler("handleStepTwo", "step:two", (event, state) => ({
				state: { ...state, count: state.count + 10 },
				events: [createEvent("step:three", {}, event.id)],
			})),
			createTestHandler("handleStepThree", "step:three", (_event, state) => ({
				state: { ...state, count: state.count + 100 },
				events: [],
			})),
		];

		const workflow = createWorkflow<TestState>({
			name: "time-travel-test",
			initialState: initialTestState,
			handlers,
			agents: [],
			until: () => false,
			store: mockStore,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "start", record: true });
		const tape = await workflow.load(result.sessionId);

		// Initial position is 0
		expect(tape.position).toBe(0);
		expect(tape.state.count).toBe(1);

		// Step forward
		const t1 = tape.step();
		expect(t1.position).toBe(1);
		expect(t1.state.count).toBe(11);

		// Step forward again
		const t2 = t1.step();
		expect(t2.position).toBe(2);
		expect(t2.state.count).toBe(111);

		// Step back (THE key feature!)
		const t3 = t2.stepBack();
		expect(t3.position).toBe(1);
		expect(t3.state.count).toBe(11);
	});
});

// ============================================================================
// Workflow.dispose() Tests
// ============================================================================

describe("Workflow.dispose()", () => {
	it("should dispose without error", async () => {
		const workflow = createWorkflow<TestState>({
			name: "dispose-test",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		// Don't add to workflows array - we're testing dispose manually

		await expect(workflow.dispose()).resolves.not.toThrow();
	});

	it("should be callable multiple times", async () => {
		const workflow = createWorkflow<TestState>({
			name: "multi-dispose-test",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		// Don't add to workflows array

		await workflow.dispose();
		await expect(workflow.dispose()).resolves.not.toThrow();
	});
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe("Workflow edge cases", () => {
	it("should handle empty handler list", async () => {
		const workflow = createWorkflow<TestState>({
			name: "empty-handlers",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "test" });

		// Event should still be processed, state unchanged
		expect(result.events.length).toBe(1);
		expect(result.state).toEqual(initialTestState);
	});

	it("should handle empty input string", async () => {
		const workflow = createWorkflow<TestState>({
			name: "empty-input",
			initialState: initialTestState,
			handlers: [],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "" });

		expect(result.events[0]?.name).toBe("user:input");
		expect((result.events[0]?.payload as { text: string }).text).toBe("");
	});

	it("should handle immediate termination", async () => {
		const workflow = createWorkflow<TestState>({
			name: "immediate-terminate",
			initialState: { ...initialTestState, terminated: true },
			handlers: [],
			agents: [],
			until: (state) => state.terminated,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "test" });

		expect(result.terminated).toBe(true);
	});

	it("should handle handler that emits many events", async () => {
		const handlers = [
			createTestHandler("handleInput", "user:input", (event, state) => ({
				state: { ...state, count: state.count + 1 },
				events: Array.from({ length: 10 }, (_, i) => createEvent("batch", { index: i }, event.id)),
			})),
			createTestHandler("handleBatch", "batch", (_event, state) => ({
				state: { ...state, count: state.count + 1 },
				events: [],
			})),
		];

		const workflow = createWorkflow<TestState>({
			name: "many-events",
			initialState: initialTestState,
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "trigger" });

		// 1 (user:input) + 10 (batch events) = 11 events
		expect(result.events.length).toBe(11);
		expect(result.state.count).toBe(11);
	});
});

// ============================================================================
// Tape from Result Tests
// ============================================================================

describe("Tape from WorkflowResult", () => {
	it("should enable stepBack debugging on result tape", async () => {
		const handler = createTestHandler("handleInput", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("second", {}, event.id)],
		}));

		const handler2 = createTestHandler("handleSecond", "second", (_event, state) => ({
			state: { ...state, count: state.count + 10 },
			events: [],
		}));

		const workflow = createWorkflow<TestState>({
			name: "result-tape-test",
			initialState: initialTestState,
			handlers: [handler, handler2],
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "test" });

		// Tape should have 2 events
		expect(result.tape.length).toBe(2);

		// Step to end
		const endTape = result.tape.stepTo(1);
		expect(endTape.state.count).toBe(11);

		// Step back!
		const backTape = endTape.stepBack();
		expect(backTape.position).toBe(0);
		expect(backTape.state.count).toBe(1);
	});

	it("should support stateAt for inspection without position change", async () => {
		const handlers = [
			createTestHandler("handleInput", "user:input", (event, state) => ({
				state: { ...state, count: 1 },
				events: [createEvent("step2", {}, event.id)],
			})),
			createTestHandler("handleStep2", "step2", (event, state) => ({
				state: { ...state, count: 2 },
				events: [createEvent("step3", {}, event.id)],
			})),
			createTestHandler("handleStep3", "step3", (_event, state) => ({
				state: { ...state, count: 3 },
				events: [],
			})),
		];

		const workflow = createWorkflow<TestState>({
			name: "state-at-test",
			initialState: initialTestState,
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "start" });

		// Tape at position 0
		expect(result.tape.position).toBe(0);
		expect(result.tape.state.count).toBe(1);

		// Inspect state at position 2 without moving
		const stateAt2 = result.tape.stateAt(2);
		expect(stateAt2.count).toBe(3);

		// Position should still be 0
		expect(result.tape.position).toBe(0);
	});
});
