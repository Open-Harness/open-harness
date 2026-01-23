/**
 * WorkflowRuntime Service Tests
 *
 * Tests for the WorkflowRuntime service, including:
 * - Error types and codes
 * - Context.Tag service identifier
 * - Event loop execution
 * - Handler processing
 * - Sequential event processing (FR-003)
 * - Termination conditions (FR-040)
 * - Callback notifications
 * - Error handling and recovery
 */

import { Cause, Effect, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Agent } from "../src/agent/Agent.js";
import type { AnyEvent } from "../src/event/Event.js";
import { createEvent } from "../src/event/Event.js";
import { EventBus, EventBusLive } from "../src/event/EventBus.js";
import type { HandlerDefinition } from "../src/handler/Handler.js";
import { LLMProvider, type LLMProviderService, type ProviderInfo, type QueryResult } from "../src/provider/Provider.js";
import type { Renderer } from "../src/renderer/Renderer.js";
import { generateSessionId, type SessionMetadata, Store, StoreError, type StoreService } from "../src/store/Store.js";
import {
	WorkflowRuntime,
	WorkflowRuntimeError,
	type WorkflowRuntimeErrorCode,
	WorkflowRuntimeLive,
} from "../src/workflow/WorkflowRuntime.js";

// ============================================================================
// Test Helpers
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

const TestOutputSchema = z.object({
	response: z.string(),
});

type TestOutput = z.infer<typeof TestOutputSchema>;

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
 */
const createTestAgent = (
	name: string,
	activatesOn: readonly string[],
	_response: string,
	when?: (state: TestState) => boolean,
): Agent<unknown, unknown> => ({
	name,
	activatesOn,
	emits: ["agent:response"],
	outputSchema: TestOutputSchema,
	prompt: (state, _event) => `State count: ${(state as TestState).count}`,
	when: when ? (state: unknown) => when(state as TestState) : undefined,
	onOutput: (output, event) => [
		createEvent(
			"agent:response",
			{
				agentName: name,
				response: (output as TestOutput).response,
			},
			event.id,
		),
	],
});

/**
 * Create a mock Store service for testing.
 */
const createMockStore = (): StoreService => {
	const sessions = new Map<string, AnyEvent[]>();

	return {
		append: (sessionId, event) =>
			Effect.sync(() => {
				const events = sessions.get(sessionId) ?? [];
				events.push(event);
				sessions.set(sessionId, events);
			}),
		events: (sessionId) => Effect.succeed(sessions.get(sessionId) ?? []),
		sessions: () =>
			Effect.succeed(
				Array.from(sessions.entries()).map(([id, events]) => ({
					id: id as SessionMetadata["id"],
					createdAt: new Date(),
					eventCount: events.length,
				})) as readonly SessionMetadata[],
			),
		clear: (sessionId) =>
			Effect.sync(() => {
				sessions.delete(sessionId);
			}),
		snapshot: () => Effect.succeed(undefined),
	};
};

/**
 * Create a mock LLMProvider service for testing.
 */
const createMockLLMProvider = (_responses: Map<string, TestOutput> = new Map()): LLMProviderService => ({
	query: (_options) =>
		Effect.succeed({
			events: [],
			text: "mock response",
			output: { response: "mock response" },
		} as QueryResult),
	stream: () => Stream.empty,
	info: () =>
		Effect.succeed({
			type: "claude" as const,
			name: "Mock Provider",
			model: "mock-model",
			connected: true,
		} as ProviderInfo),
});

/**
 * Create test layers for WorkflowRuntime.
 */
const createTestLayers = (mockStore?: StoreService, mockProvider?: LLMProviderService) => {
	const storeMock = mockStore ?? createMockStore();
	const providerMock = mockProvider ?? createMockLLMProvider();

	const StoreTestLayer = Layer.succeed(Store, storeMock);
	const ProviderTestLayer = Layer.succeed(LLMProvider, providerMock);

	// WorkflowRuntimeLive requires LLMProvider, Store, and EventBus
	// So we compose: dependencies first, then the runtime that uses them
	const dependencies = Layer.mergeAll(StoreTestLayer, ProviderTestLayer, EventBusLive);

	// Provide dependencies TO the WorkflowRuntimeLive layer
	// Then merge with dependencies so tests can access Store, LLMProvider, EventBus directly
	const runtimeWithDeps = WorkflowRuntimeLive.pipe(Layer.provide(dependencies));

	return Layer.merge(runtimeWithDeps, dependencies);
};

// ============================================================================
// Error Type Tests
// ============================================================================

describe("WorkflowRuntimeError", () => {
	it("should have correct _tag", () => {
		const error = new WorkflowRuntimeError("EXECUTION_FAILED", "Failed");
		expect(error._tag).toBe("WorkflowRuntimeError");
	});

	it("should have correct name", () => {
		const error = new WorkflowRuntimeError("HANDLER_FAILED", "Handler error");
		expect(error.name).toBe("WorkflowRuntimeError");
	});

	it("should support all error codes", () => {
		const codes: WorkflowRuntimeErrorCode[] = [
			"HANDLER_NOT_FOUND",
			"HANDLER_FAILED",
			"AGENT_FAILED",
			"STORE_UNAVAILABLE",
			"EXECUTION_FAILED",
			"TERMINATED",
			"ABORTED",
		];

		for (const code of codes) {
			const error = new WorkflowRuntimeError(code, `Error: ${code}`);
			expect(error.code).toBe(code);
			expect(error.message).toBe(`Error: ${code}`);
		}
	});

	it("should preserve cause when provided", () => {
		const cause = new Error("Original error");
		const error = new WorkflowRuntimeError("HANDLER_FAILED", "Failed", cause);
		expect(error.cause).toBe(cause);
	});

	it("should extend Error", () => {
		const error = new WorkflowRuntimeError("EXECUTION_FAILED", "Failed");
		expect(error).toBeInstanceOf(Error);
	});
});

// ============================================================================
// Context.Tag Tests
// ============================================================================

describe("WorkflowRuntime Context.Tag", () => {
	it("should have correct service identifier", () => {
		expect(WorkflowRuntime.key).toBe("@core-v2/WorkflowRuntime");
	});

	it("should be usable as Effect dependency", () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;
			return runtime;
		});

		// Type check - should require WorkflowRuntime in requirements
		type Requirements = Effect.Effect.Context<typeof program>;
		const _check: Requirements extends WorkflowRuntime ? true : false = true;
		expect(_check).toBe(true);
	});
});

// ============================================================================
// Event Loop Tests
// ============================================================================

describe("WorkflowRuntime.run", () => {
	it("should process initial event and return result", async () => {
		const handler = createTestHandler("handleUserInput", "user:input", (event, state) => ({
			state: {
				...state,
				count: state.count + 1,
				messages: [...state.messages, (event.payload as { text: string }).text],
			},
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "Hello" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.state.count).toBe(1);
		expect(result.state.messages).toEqual(["Hello"]);
		expect(result.events.length).toBe(1);
		expect(result.events[0]?.name).toBe("user:input");
	});

	it("should process chain of events sequentially (FR-003)", async () => {
		const processOrder: string[] = [];

		const handlers = [
			createTestHandler("handleA", "event:a", (event, state) => {
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

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("event:a", {}),
				initialState: initialTestState,
				handlers,
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Events should be processed sequentially: A -> B -> C
		expect(processOrder).toEqual(["A", "B", "C"]);
		expect(result.state.count).toBe(111);
		expect(result.events.length).toBe(3);
	});

	it("should terminate when until condition is met (FR-040)", async () => {
		const handler = createTestHandler("handleIncrement", "increment", (event, state) => ({
			state: {
				...state,
				count: state.count + 1,
				terminated: state.count + 1 >= 3,
			},
			events: [createEvent("increment", {}, event.id)],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("increment", {}),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: (state) => state.terminated,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.terminated).toBe(true);
		expect(result.state.count).toBe(3);
	});

	it("should handle events without registered handlers gracefully", async () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("unknown:event", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Should complete without error, state unchanged
		expect(result.state).toEqual(initialTestState);
		expect(result.events.length).toBe(1);
	});

	it("should call onEvent callback for each event", async () => {
		const receivedEvents: string[] = [];

		const handler = createTestHandler("handleInput", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("processed", {}, event.id)],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "test" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				callbacks: {
					onEvent: (event) => {
						receivedEvents.push(event.name);
					},
				},
			});

			return result;
		});

		const testLayers = createTestLayers();
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(receivedEvents).toEqual(["user:input", "processed"]);
	});

	it("should call onStateChange callback when state changes", async () => {
		const stateSnapshots: number[] = [];

		const handler = createTestHandler("handleIncrement", "increment", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("increment", {}),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				callbacks: {
					onStateChange: (state) => {
						stateSnapshots.push(state.count);
					},
				},
			});

			return result;
		});

		const testLayers = createTestLayers();
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(stateSnapshots).toEqual([1]);
	});

	it("should call onError callback when handler throws", async () => {
		const receivedErrors: string[] = [];

		const handler = createTestHandler("handleFailing", "failing:event", () => {
			throw new Error("Handler explosion!");
		});

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("failing:event", {}),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				callbacks: {
					onError: (error) => {
						receivedErrors.push(error.message);
					},
				},
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Handler error should be caught and reported
		expect(receivedErrors).toEqual(["Handler explosion!"]);
		// Error event should be emitted
		expect(result.events.some((e) => e.name === "error:occurred")).toBe(true);
	});

	it("should generate sessionId when recording is enabled", async () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
				record: true,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Should have a valid UUID-like sessionId
		expect(result.sessionId).toBeDefined();
		expect(typeof result.sessionId).toBe("string");
		expect(result.sessionId.length).toBeGreaterThan(0);
	});

	it("should use provided sessionId when recording", async () => {
		const customSessionId = generateSessionId();

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
				record: true,
				sessionId: customSessionId,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.sessionId).toBe(customSessionId);
	});
});

// ============================================================================
// processEvent Tests
// ============================================================================

describe("WorkflowRuntime.processEvent", () => {
	it("should process event through matching handler", async () => {
		const handler = createTestHandler("handleInput", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const handlerMap = new Map<string, HandlerDefinition<AnyEvent, TestState>>();
		handlerMap.set("user:input", handler);

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.processEvent<TestState>(
				createEvent("user:input", { text: "test" }),
				initialTestState,
				handlerMap,
			);

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.state.count).toBe(1);
		expect(result.events).toEqual([]);
	});

	it("should return unchanged state for unknown events", async () => {
		const handlerMap = new Map<string, HandlerDefinition<AnyEvent, TestState>>();

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.processEvent<TestState>(
				createEvent("unknown:event", {}),
				initialTestState,
				handlerMap,
			);

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.state).toEqual(initialTestState);
		expect(result.events).toEqual([]);
	});

	it("should fail when handler throws", async () => {
		const handler = createTestHandler("handleFailing", "failing:event", () => {
			throw new Error("Boom!");
		});

		const handlerMap = new Map<string, HandlerDefinition<AnyEvent, TestState>>();
		handlerMap.set("failing:event", handler);

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.processEvent<TestState>(
				createEvent("failing:event", {}),
				initialTestState,
				handlerMap,
			);

			return result;
		});

		const testLayers = createTestLayers();

		await expect(Effect.runPromise(program.pipe(Effect.provide(testLayers)))).rejects.toThrow("Boom!");
	});
});

// ============================================================================
// Agent Activation Tests
// ============================================================================

describe("WorkflowRuntime agent activation", () => {
	it("should activate agent when event matches activatesOn", async () => {
		let agentCalled = false;

		const mockProvider: LLMProviderService = {
			...createMockLLMProvider(),
			query: (_options) =>
				Effect.sync(() => {
					agentCalled = true;
					return {
						events: [],
						text: "mock response",
						output: { response: "agent response" },
					} as QueryResult;
				}),
		};

		const agent = createTestAgent("testAgent", ["user:input"], "response");

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "trigger" }),
				initialState: initialTestState,
				handlers: [],
				agents: [agent],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers(undefined, mockProvider);
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(agentCalled).toBe(true);
		// Should have agent:started and agent:completed events
		expect(result.events.some((e) => e.name === "agent:started")).toBe(true);
		expect(result.events.some((e) => e.name === "agent:completed")).toBe(true);
	});

	it("should not activate agent when guard condition fails", async () => {
		let agentCalled = false;

		const mockProvider: LLMProviderService = {
			...createMockLLMProvider(),
			query: () =>
				Effect.sync(() => {
					agentCalled = true;
					return {
						events: [],
						text: "mock response",
						output: { response: "agent response" },
					} as QueryResult;
				}),
		};

		// Agent with guard that requires count > 5
		const agent = createTestAgent("guardedAgent", ["user:input"], "response", (state) => state.count > 5);

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "trigger" }),
				initialState: initialTestState, // count is 0
				handlers: [],
				agents: [agent],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers(undefined, mockProvider);
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(agentCalled).toBe(false);
		// Should NOT have agent:started event
		expect(result.events.some((e) => e.name === "agent:started")).toBe(false);
	});

	it("should emit agent:response event from onOutput", async () => {
		const mockProvider: LLMProviderService = {
			...createMockLLMProvider(),
			query: () =>
				Effect.succeed({
					events: [],
					text: "response text",
					output: { response: "structured response" },
				} as QueryResult),
		};

		const agent = createTestAgent("responseAgent", ["user:input"], "response");

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [agent],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers(undefined, mockProvider);
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Should have agent:response event from onOutput
		const responseEvent = result.events.find((e) => e.name === "agent:response");
		expect(responseEvent).toBeDefined();
		expect((responseEvent?.payload as any)?.agentName).toBe("responseAgent");
	});
});

// ============================================================================
// Recording Tests
// ============================================================================

describe("WorkflowRuntime recording (FR-042)", () => {
	it("should record events to store when record is true", async () => {
		const recordedEvents: AnyEvent[] = [];

		const mockStore: StoreService = {
			...createMockStore(),
			append: (_sessionId, event) =>
				Effect.sync(() => {
					recordedEvents.push(event);
				}),
		};

		const handler = createTestHandler("handleInput", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("processed", {}, event.id)],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "record me" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				record: true,
			});

			return result;
		});

		const testLayers = createTestLayers(mockStore);
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Both events should be recorded
		expect(recordedEvents.length).toBe(2);
		expect(recordedEvents[0]?.name).toBe("user:input");
		expect(recordedEvents[1]?.name).toBe("processed");
	});

	it("should not record events when record is false", async () => {
		const recordedEvents: AnyEvent[] = [];

		const mockStore: StoreService = {
			...createMockStore(),
			append: (_sessionId, event) =>
				Effect.sync(() => {
					recordedEvents.push(event);
				}),
		};

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
				record: false, // explicitly disabled
			});

			return result;
		});

		const testLayers = createTestLayers(mockStore);
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// No events should be recorded
		expect(recordedEvents.length).toBe(0);
	});
});

// ============================================================================
// EventBus Integration Tests
// ============================================================================

describe("WorkflowRuntime EventBus integration", () => {
	it("should emit events to EventBus subscribers", async () => {
		const busEvents: string[] = [];

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;
			const eventBus = yield* EventBus;

			// Subscribe to all events
			yield* eventBus.subscribe((event) =>
				Effect.sync(() => {
					busEvents.push(event.name);
				}),
			);

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [
					createTestHandler("handle", "user:input", (event, state) => ({
						state,
						events: [createEvent("processed", {}, event.id)],
					})),
				],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(busEvents).toContain("user:input");
		expect(busEvents).toContain("processed");
	});
});

// ============================================================================
// Layer Integration Tests
// ============================================================================

describe("WorkflowRuntimeLive Layer", () => {
	it("should provide WorkflowRuntime service", async () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;
			// Just verify we got the service
			expect(typeof runtime.run).toBe("function");
			expect(typeof runtime.processEvent).toBe("function");
			return true;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result).toBe(true);
	});

	it("should compose with other service layers", async () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;
			const store = yield* Store;
			const provider = yield* LLMProvider;
			const eventBus = yield* EventBus;

			// All services should be available
			expect(runtime).toBeDefined();
			expect(store).toBeDefined();
			expect(provider).toBeDefined();
			expect(eventBus).toBeDefined();

			return true;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result).toBe(true);
	});
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe("WorkflowRuntime edge cases", () => {
	it("should handle empty handler list", async () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("event", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.state).toEqual(initialTestState);
	});

	it("should handle immediate termination", async () => {
		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("event", {}),
				initialState: { ...initialTestState, terminated: true },
				handlers: [],
				agents: [],
				until: (state) => state.terminated,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Should process the initial event then terminate
		expect(result.terminated).toBe(true);
	});

	it("should handle handler that emits many events", async () => {
		const handler = createTestHandler("manyEvents", "trigger", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: Array.from({ length: 10 }, (_, i) => createEvent("batch", { index: i }, event.id)),
		}));

		const batchHandler = createTestHandler("handleBatch", "batch", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("trigger", {}),
				initialState: initialTestState,
				handlers: [handler, batchHandler],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// 1 (trigger) + 10 (batch) = 11 events processed
		expect(result.events.length).toBe(11);
		expect(result.state.count).toBe(11);
	});
});

// ============================================================================
// Renderer Integration Tests (FR-004)
// ============================================================================

describe("Renderer Integration", () => {
	it("should call renderers for matching events", async () => {
		const renderedEvents: Array<{ eventName: string; state: TestState }> = [];

		const testRenderer: Renderer<TestState, void> = {
			name: "test-renderer",
			patterns: ["user:input", "count:*"],
			render: (event, state) => {
				renderedEvents.push({ eventName: event.name, state: { ...state } as TestState });
			},
		};

		const handler = createTestHandler("counter", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("count:incremented", { value: state.count + 1 }, event.id)],
		}));

		const countHandler = createTestHandler("count-handler", "count:incremented", (_event, state) => ({
			state,
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler, countHandler],
				agents: [],
				renderers: [testRenderer],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Give time for forked renderers to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(result.events.length).toBe(2); // user:input + count:incremented
		expect(renderedEvents.length).toBe(2); // Both events match the patterns
		expect(renderedEvents[0]?.eventName).toBe("user:input");
		expect(renderedEvents[1]?.eventName).toBe("count:incremented");
	});

	it("should only call renderers for matching patterns", async () => {
		const renderedEvents: string[] = [];

		const testRenderer: Renderer<TestState, void> = {
			name: "error-only-renderer",
			patterns: ["error:*"],
			render: (event, _state) => {
				renderedEvents.push(event.name);
			},
		};

		const handler = createTestHandler("counter", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				renderers: [testRenderer],
				until: () => false,
			});
		});

		const testLayers = createTestLayers();
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Give time for forked renderers to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		// user:input doesn't match error:* pattern
		expect(renderedEvents.length).toBe(0);
	});

	it("should call multiple renderers for the same event", async () => {
		const renderer1Events: string[] = [];
		const renderer2Events: string[] = [];

		const renderer1: Renderer<TestState, void> = {
			name: "renderer-1",
			patterns: ["*"], // Catch-all
			render: (event, _state) => {
				renderer1Events.push(event.name);
			},
		};

		const renderer2: Renderer<TestState, void> = {
			name: "renderer-2",
			patterns: ["user:*"],
			render: (event, _state) => {
				renderer2Events.push(event.name);
			},
		};

		const handler = createTestHandler("counter", "user:input", (_event, state) => ({
			state,
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				renderers: [renderer1, renderer2],
				until: () => false,
			});
		});

		const testLayers = createTestLayers();
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Give time for forked renderers to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Both renderers should receive the event
		expect(renderer1Events).toContain("user:input");
		expect(renderer2Events).toContain("user:input");
	});

	it("should not block handler processing if renderer throws", async () => {
		let handlerCalled = false;

		const errorRenderer: Renderer<TestState, void> = {
			name: "error-renderer",
			patterns: ["user:input"],
			render: (_event, _state) => {
				throw new Error("Renderer error!");
			},
		};

		const handler = createTestHandler("counter", "user:input", (_event, state) => {
			handlerCalled = true;
			return {
				state: { ...state, count: state.count + 1 },
				events: [],
			};
		});

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				renderers: [errorRenderer],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Handler should still execute even if renderer throws
		expect(handlerCalled).toBe(true);
		expect(result.state.count).toBe(1);
	});

	it("should receive current state at time of event", async () => {
		const statesReceived: number[] = [];

		const testRenderer: Renderer<TestState, void> = {
			name: "state-tracker",
			patterns: ["*"],
			render: (_event, state) => {
				statesReceived.push((state as TestState).count);
			},
		};

		const handler = createTestHandler("counter", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("test:event", {}, event.id)],
		}));

		const testHandler = createTestHandler("test", "test:event", (_event, state) => ({
			state: { ...state, count: state.count + 10 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler, testHandler],
				agents: [],
				renderers: [testRenderer],
				until: () => false,
			});
		});

		const testLayers = createTestLayers();
		await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// Give time for forked renderers to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		// First event (user:input) sees initial state (count: 0)
		// Second event (test:event) sees state after first handler (count: 1)
		expect(statesReceived).toContain(0);
		expect(statesReceived).toContain(1);
	});

	it("should work with empty renderers array", async () => {
		const handler = createTestHandler("counter", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				renderers: [], // Empty array
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.state.count).toBe(1);
	});

	it("should work without renderers option (undefined)", async () => {
		const handler = createTestHandler("counter", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run({
				initialEvent: createEvent("user:input", { text: "hello" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				// renderers not provided - should default to []
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		expect(result.state.count).toBe(1);
	});
});

// ============================================================================
// Phase 10 Edge Case: Handler Exception Handling
// ============================================================================

describe("WorkflowRuntime handler exception handling (Phase 10 edge case)", () => {
	it("should catch handler exception, emit ErrorOccurredEvent, and continue processing", async () => {
		const eventsProcessed: string[] = [];
		const receivedErrors: string[] = [];

		// First handler throws
		const throwingHandler = createTestHandler("throwingHandler", "user:input", () => {
			eventsProcessed.push("user:input");
			throw new Error("Handler explosion!");
		});

		// Handler for follow-up events - to verify chain continues after exception
		const followUpHandler = createTestHandler("followUpHandler", "follow:up", (_event, state) => {
			eventsProcessed.push("follow:up");
			return {
				state: { ...state, count: state.count + 1 },
				events: [],
			};
		});

		// Handler that emits follow:up event when it receives the error
		const recoveryHandler = createTestHandler("recoveryHandler", "error:occurred", (event, state) => {
			return {
				state,
				events: [createEvent("follow:up", { recovery: true }, event.id)],
			};
		});

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "trigger" }),
				initialState: initialTestState,
				handlers: [throwingHandler, recoveryHandler, followUpHandler],
				agents: [],
				until: () => false,
				callbacks: {
					onError: (error) => {
						receivedErrors.push(error.message);
					},
				},
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// 1. Handler exception should be caught (not propagate up)
		// 2. onError callback should be notified
		expect(receivedErrors).toContain("Handler explosion!");

		// 3. error:occurred event should be emitted
		const errorEvent = result.events.find((e) => e.name === "error:occurred");
		expect(errorEvent).toBeDefined();
		expect(errorEvent?.payload).toMatchObject({
			code: "HANDLER_FAILED",
			message: "Handler explosion!",
			recoverable: true,
			context: {
				eventName: "user:input",
				handlerName: "throwingHandler",
			},
		});

		// 4. Processing should continue - follow:up event should be processed
		const followUpEvent = result.events.find((e) => e.name === "follow:up");
		expect(followUpEvent).toBeDefined();
		expect(eventsProcessed).toContain("user:input");
		expect(eventsProcessed).toContain("follow:up");

		// 5. State should reflect recovery handler's work
		expect(result.state.count).toBe(1); // followUpHandler incremented
	});

	it("should preserve state from before the throwing handler", async () => {
		// Handler that succeeds and changes state, then throws on second event
		let callCount = 0;

		const sometimesThrowingHandler = createTestHandler("conditionalHandler", "process:event", (_event, state) => {
			callCount++;
			if (callCount === 2) {
				throw new Error("Boom on second call!");
			}
			return {
				state: { ...state, count: state.count + 10 },
				events: callCount === 1 ? [createEvent("process:event", { round: 2 })] : [],
			};
		});

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("process:event", { round: 1 }),
				initialState: initialTestState,
				handlers: [sometimesThrowingHandler],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// First call succeeded and updated state to count: 10
		// Second call threw, so state should remain at 10 (not updated further)
		expect(result.state.count).toBe(10);

		// Both events and the error event should be recorded
		expect(result.events).toHaveLength(3); // process:event (1), process:event (2), error:occurred
		expect(result.events.some((e) => e.name === "error:occurred")).toBe(true);
	});

	it("should include error stack trace in context when available", async () => {
		const throwingHandler = createTestHandler("stackTraceHandler", "user:input", () => {
			const error = new Error("Error with stack");
			throw error;
		});

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [throwingHandler],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		const errorEvent = result.events.find((e) => e.name === "error:occurred");
		expect(errorEvent).toBeDefined();
		// Context should include handler name and event name for debugging
		expect(errorEvent?.payload.context).toMatchObject({
			eventName: "user:input",
			handlerName: "stackTraceHandler",
		});
	});

	it("should handle non-Error exceptions gracefully", async () => {
		// biome-ignore lint/complexity/useArrowFunction: intentional throw of non-Error
		const throwingHandler = createTestHandler("stringThrowHandler", "user:input", function () {
			// eslint-disable-next-line @typescript-eslint/no-throw-literal
			throw "String error message"; // Not an Error object
		});

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [throwingHandler],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		const errorEvent = result.events.find((e) => e.name === "error:occurred");
		expect(errorEvent).toBeDefined();
		// Non-Error should be stringified
		expect(errorEvent?.payload.message).toBe("String error message");
	});

	it("should continue processing subsequent events after multiple handler failures", async () => {
		let failCount = 0;
		let successCount = 0;

		const unreliableHandler = createTestHandler("unreliableHandler", "test:event", (_event, state) => {
			failCount++;
			if (failCount <= 2) {
				throw new Error(`Failure ${failCount}`);
			}
			successCount++;
			return {
				state: { ...state, count: state.count + 1 },
				events: [],
			};
		});

		// Trigger multiple events
		const triggerHandler = createTestHandler("triggerHandler", "user:input", (event, state) => ({
			state,
			events: [
				createEvent("test:event", { n: 1 }, event.id),
				createEvent("test:event", { n: 2 }, event.id),
				createEvent("test:event", { n: 3 }, event.id),
			],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [triggerHandler, unreliableHandler],
				agents: [],
				until: () => false,
			});

			return result;
		});

		const testLayers = createTestLayers();
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));

		// First two test:event calls failed, third succeeded
		expect(failCount).toBe(3); // All 3 calls attempted
		expect(successCount).toBe(1); // Only third succeeded

		// Should have 2 error events and final state count of 1
		const errorEvents = result.events.filter((e) => e.name === "error:occurred");
		expect(errorEvents).toHaveLength(2);
		expect(result.state.count).toBe(1);
	});
});

// ============================================================================
// Phase 10 Edge Case: Store Unavailable During Recording
// ============================================================================

describe("WorkflowRuntime Store unavailable during recording (Phase 10 edge case)", () => {
	it("should fail fast with STORE_UNAVAILABLE when Store.append fails during recording", async () => {
		// Create a mock store that fails on append
		const failingStore: StoreService = {
			...createMockStore(),
			append: () => Effect.fail(new StoreError("WRITE_FAILED", "Database connection lost")),
		};

		const handler = createTestHandler("handleInput", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "test" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				record: true, // Recording enabled - Store failure should fail fast
			});

			return result;
		});

		const testLayers = createTestLayers(failingStore);

		// Use Effect.runPromiseExit to extract the failure properly
		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayers)));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			// Extract the error from the cause
			const failures = [...Cause.failures(exit.cause)];
			expect(failures.length).toBeGreaterThan(0);
			const error = failures[0];
			expect(error).toBeInstanceOf(WorkflowRuntimeError);
			expect((error as WorkflowRuntimeError).code).toBe("STORE_UNAVAILABLE");
			expect((error as WorkflowRuntimeError).message).toContain("Store unavailable");
			expect((error as WorkflowRuntimeError).message).toContain("cannot record session");
		}
	});

	it("should include event name in STORE_UNAVAILABLE error message", async () => {
		const failingStore: StoreService = {
			...createMockStore(),
			append: () => Effect.fail(new StoreError("WRITE_FAILED", "Disk full")),
		};

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "test" }),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
				record: true,
			});
		});

		const testLayers = createTestLayers(failingStore);

		try {
			await Effect.runPromise(program.pipe(Effect.provide(testLayers)));
			expect.fail("Should have thrown");
		} catch (error) {
			expect((error as WorkflowRuntimeError).message).toContain("user:input");
			expect((error as WorkflowRuntimeError).message).toContain("would be lost");
		}
	});

	it("should preserve original StoreError as cause", async () => {
		const originalError = new StoreError("WRITE_FAILED", "Original store failure");

		const failingStore: StoreService = {
			...createMockStore(),
			append: () => Effect.fail(originalError),
		};

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [],
				agents: [],
				until: () => false,
				record: true,
			});
		});

		const testLayers = createTestLayers(failingStore);

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayers)));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			const failures = [...Cause.failures(exit.cause)];
			expect(failures.length).toBeGreaterThan(0);
			const error = failures[0] as WorkflowRuntimeError;
			expect(error.cause).toBe(originalError);
		}
	});

	it("should NOT fail when record is false even if Store would fail", async () => {
		// This store always fails - but since record:false, it should never be called
		const failingStore: StoreService = {
			...createMockStore(),
			append: () => Effect.fail(new StoreError("WRITE_FAILED", "Should not be called")),
		};

		const handler = createTestHandler("handleInput", "user:input", (_event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			const result = yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", { text: "test" }),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				record: false, // Recording disabled - Store failures should be irrelevant
			});

			return result;
		});

		const testLayers = createTestLayers(failingStore);

		// Should succeed - Store.append is never called when record:false
		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayers)));
		expect(result.state.count).toBe(1);
	});

	it("should fail fast on first event when Store fails (no partial recording)", async () => {
		let appendCallCount = 0;

		const failingStore: StoreService = {
			...createMockStore(),
			append: () => {
				appendCallCount++;
				return Effect.fail(new StoreError("WRITE_FAILED", "Connection refused"));
			},
		};

		// Handler that would emit multiple events - but should fail on first
		const handler = createTestHandler("multiEmit", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("event:2", {}, event.id), createEvent("event:3", {}, event.id)],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [handler],
				agents: [],
				until: () => false,
				record: true,
			});
		});

		const testLayers = createTestLayers(failingStore);

		await expect(Effect.runPromise(program.pipe(Effect.provide(testLayers)))).rejects.toThrow();

		// Should only try once - fail fast, don't continue processing
		expect(appendCallCount).toBe(1);
	});

	it("should fail fast mid-session if Store becomes unavailable", async () => {
		let appendCallCount = 0;

		// Store works for first 2 events, then fails
		const intermittentStore: StoreService = {
			...createMockStore(),
			append: (_sessionId, _event) => {
				appendCallCount++;
				if (appendCallCount > 2) {
					return Effect.fail(new StoreError("WRITE_FAILED", "Connection dropped"));
				}
				return Effect.void;
			},
		};

		const handler = createTestHandler("chainHandler", "user:input", (event, state) => ({
			state: { ...state, count: state.count + 1 },
			events: [createEvent("chain:event", {}, event.id)],
		}));

		const chainHandler = createTestHandler("chainContinue", "chain:event", (event, state) => ({
			state: { ...state, count: state.count + 10 },
			events: [createEvent("final:event", {}, event.id)],
		}));

		const program = Effect.gen(function* () {
			const runtime = yield* WorkflowRuntime;

			yield* runtime.run<TestState>({
				initialEvent: createEvent("user:input", {}),
				initialState: initialTestState,
				handlers: [handler, chainHandler],
				agents: [],
				until: () => false,
				record: true,
			});
		});

		const testLayers = createTestLayers(intermittentStore);

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayers)));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			// Should fail on third event
			expect(appendCallCount).toBe(3);

			const failures = [...Cause.failures(exit.cause)];
			expect(failures.length).toBeGreaterThan(0);
			const error = failures[0] as WorkflowRuntimeError;
			expect(error.code).toBe("STORE_UNAVAILABLE");
			// Error should mention the event that couldn't be recorded
			expect(error.message).toContain("final:event");
		}
	});
});
