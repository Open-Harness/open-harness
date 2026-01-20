/**
 * Handler System Tests
 *
 * Tests for the Handler types, factories, and utilities.
 */

import { describe, expect, it } from "vitest";

import type { Event, EventId } from "../src/event/index.js";
import { createEvent, defineEvent } from "../src/event/index.js";
import type { Handler, HandlerDefinition, HandlerResult } from "../src/handler/index.js";
import { defineHandler, emit, emitEvent, stateOnly } from "../src/handler/index.js";

// Test state type
interface TestState {
	count: number;
	messages: string[];
}

// Test event types
const CountIncrementedEvent = defineEvent<"count:incremented", { amount: number }>("count:incremented");
const MessageAddedEvent = defineEvent<"message:added", { text: string }>("message:added");

describe("Handler Types", () => {
	describe("HandlerResult", () => {
		it("should represent a state-only result", () => {
			const result: HandlerResult<TestState> = {
				state: { count: 1, messages: [] },
				events: [],
			};

			expect(result.state.count).toBe(1);
			expect(result.events).toHaveLength(0);
		});

		it("should represent a result with emitted events", () => {
			const event = createEvent("test:event", { value: 42 });
			const result: HandlerResult<TestState> = {
				state: { count: 1, messages: [] },
				events: [event],
			};

			expect(result.state.count).toBe(1);
			expect(result.events).toHaveLength(1);
			expect(result.events[0]).toBe(event);
		});

		it("should allow readonly events array", () => {
			const events: readonly Event[] = Object.freeze([createEvent("test", {})]);
			const result: HandlerResult<TestState> = {
				state: { count: 0, messages: [] },
				events,
			};

			expect(result.events).toBe(events);
		});
	});

	describe("Handler function type", () => {
		it("should accept event and state, return HandlerResult", () => {
			const handler: Handler<Event<"test", { value: number }>, TestState> = (event, state) => ({
				state: { ...state, count: state.count + event.payload.value },
				events: [],
			});

			const event = createEvent("test", { value: 5 });
			const state: TestState = { count: 10, messages: [] };
			const result = handler(event, state);

			expect(result.state.count).toBe(15);
			expect(result.events).toEqual([]);
		});

		it("should be pure - same inputs produce same outputs", () => {
			const handler: Handler<Event<"test", { value: number }>, TestState> = (event, state) => ({
				state: { ...state, count: state.count + event.payload.value },
				events: [],
			});

			// Create deterministic event (fixed id/timestamp for testing)
			const event: Event<"test", { value: number }> = {
				id: "test-id" as EventId,
				name: "test",
				payload: { value: 5 },
				timestamp: new Date("2024-01-01"),
			};
			const state: TestState = { count: 10, messages: [] };

			const result1 = handler(event, state);
			const result2 = handler(event, state);

			expect(result1).toEqual(result2);
		});

		it("should not mutate input state", () => {
			const handler: Handler<Event<"test", { text: string }>, TestState> = (event, state) => ({
				state: {
					...state,
					messages: [...state.messages, event.payload.text],
				},
				events: [],
			});

			const event = createEvent("test", { text: "hello" });
			const state: TestState = { count: 0, messages: ["existing"] };
			const originalMessages = state.messages;

			handler(event, state);

			// Original state should not be mutated
			expect(state.messages).toBe(originalMessages);
			expect(state.messages).toEqual(["existing"]);
		});
	});

	describe("HandlerDefinition", () => {
		it("should contain name, handles, and handler function", () => {
			const handler: Handler<Event<"test", { value: number }>, TestState> = (event, state) => ({
				state: { ...state, count: event.payload.value },
				events: [],
			});

			const definition: HandlerDefinition<Event<"test", { value: number }>, TestState> = {
				name: "testHandler",
				handles: "test",
				handler,
			};

			expect(definition.name).toBe("testHandler");
			expect(definition.handles).toBe("test");
			expect(definition.handler).toBe(handler);
		});
	});
});

describe("defineHandler factory", () => {
	it("should create a HandlerDefinition from an EventDefinition", () => {
		const definition = defineHandler(CountIncrementedEvent, {
			name: "handleCountIncrement",
			handler: (event, state: TestState) => ({
				state: { ...state, count: state.count + event.payload.amount },
				events: [],
			}),
		});

		expect(definition.name).toBe("handleCountIncrement");
		expect(definition.handles).toBe("count:incremented");
		expect(typeof definition.handler).toBe("function");
	});

	it("should provide type-safe event access in handler", () => {
		const definition = defineHandler(MessageAddedEvent, {
			name: "handleMessageAdded",
			handler: (event, state: TestState) => {
				// TypeScript knows event.payload.text is string
				const text: string = event.payload.text;
				return {
					state: { ...state, messages: [...state.messages, text] },
					events: [],
				};
			},
		});

		const event = MessageAddedEvent.create({ text: "hello" });
		const state: TestState = { count: 0, messages: [] };
		const result = definition.handler(event, state);

		expect(result.state.messages).toContain("hello");
	});

	it("should allow handler to emit events", () => {
		const ProcessingComplete = defineEvent<"processing:complete", { success: boolean }>("processing:complete");

		const definition = defineHandler(CountIncrementedEvent, {
			name: "handleCountWithEmit",
			handler: (event, state: TestState) => ({
				state: { ...state, count: state.count + event.payload.amount },
				events: [ProcessingComplete.create({ success: true }, event.id)],
			}),
		});

		const event = CountIncrementedEvent.create({ amount: 5 });
		const state: TestState = { count: 0, messages: [] };
		const result = definition.handler(event, state);

		expect(result.state.count).toBe(5);
		expect(result.events).toHaveLength(1);
		const emittedEvent = result.events[0];
		expect(emittedEvent).toBeDefined();
		expect(emittedEvent?.name).toBe("processing:complete");
		expect(emittedEvent?.causedBy).toBe(event.id);
	});
});

describe("Handler utilities", () => {
	describe("stateOnly", () => {
		it("should create result with empty events array", () => {
			const state: TestState = { count: 42, messages: ["test"] };
			const result = stateOnly(state);

			expect(result.state).toBe(state);
			expect(result.events).toEqual([]);
		});

		it("should be usable in handler returns", () => {
			const handler: Handler<Event<"test", unknown>, TestState> = (_event, state) =>
				stateOnly({ ...state, count: state.count + 1 });

			const event = createEvent("test", {});
			const state: TestState = { count: 0, messages: [] };
			const result = handler(event, state);

			expect(result.state.count).toBe(1);
			expect(result.events).toEqual([]);
		});
	});

	describe("emit", () => {
		it("should create result with state and events", () => {
			const state: TestState = { count: 42, messages: [] };
			const events = [createEvent("test:emitted", { value: 1 })];
			const result = emit(state, events);

			expect(result.state).toBe(state);
			expect(result.events).toBe(events);
		});

		it("should work with readonly event arrays", () => {
			const state: TestState = { count: 0, messages: [] };
			const events: readonly Event[] = Object.freeze([createEvent("test", {})]);
			const result = emit(state, events);

			expect(result.events).toBe(events);
		});

		it("should be usable in handler returns", () => {
			const handler: Handler<Event<"input", { value: number }>, TestState> = (event, state) =>
				emit({ ...state, count: state.count + event.payload.value }, [
					createEvent("count:updated", { newCount: state.count + event.payload.value }),
				]);

			const event = createEvent("input", { value: 10 });
			const state: TestState = { count: 5, messages: [] };
			const result = handler(event, state);

			expect(result.state.count).toBe(15);
			expect(result.events).toHaveLength(1);
			expect(result.events[0]?.name).toBe("count:updated");
		});
	});

	describe("emitEvent", () => {
		it("should create a new event with generated ID and timestamp", () => {
			const event = emitEvent("test:created", { value: 42 });

			expect(event.name).toBe("test:created");
			expect(event.payload).toEqual({ value: 42 });
			expect(event.id).toBeDefined();
			expect(typeof event.id).toBe("string");
			expect(event.timestamp).toBeInstanceOf(Date);
			expect(event.causedBy).toBeUndefined();
		});

		it("should accept causedBy parameter", () => {
			const causingEventId = "causing-event-123" as EventId;
			const event = emitEvent("test:caused", { result: "success" }, causingEventId);

			expect(event.causedBy).toBe(causingEventId);
		});

		it("should generate unique IDs for each call", () => {
			const event1 = emitEvent("test", {});
			const event2 = emitEvent("test", {});

			expect(event1.id).not.toBe(event2.id);
		});

		it("should be usable within handlers", () => {
			const handler: Handler<Event<"trigger", { data: string }>, TestState> = (event, state) => ({
				state: { ...state, messages: [...state.messages, event.payload.data] },
				events: [emitEvent("trigger:processed", { originalData: event.payload.data }, event.id)],
			});

			const triggerEvent = createEvent("trigger", { data: "test data" });
			const state: TestState = { count: 0, messages: [] };
			const result = handler(triggerEvent, state);

			expect(result.events).toHaveLength(1);
			expect(result.events[0]?.name).toBe("trigger:processed");
			expect(result.events[0]?.payload).toEqual({ originalData: "test data" });
			expect(result.events[0]?.causedBy).toBe(triggerEvent.id);
		});
	});
});

describe("Handler composition patterns", () => {
	it("should allow handlers to chain via emitted events", () => {
		// First handler emits an event
		const firstHandler: Handler<Event<"step:one", { input: number }>, TestState> = (event, state) => ({
			state: { ...state, count: event.payload.input },
			events: [emitEvent("step:two", { previousValue: event.payload.input }, event.id)],
		});

		// Second handler processes the emitted event
		const secondHandler: Handler<Event<"step:two", { previousValue: number }>, TestState> = (event, state) => ({
			state: { ...state, count: state.count * event.payload.previousValue },
			events: [],
		});

		// Simulate chained execution
		let state: TestState = { count: 0, messages: [] };

		const event1 = createEvent("step:one", { input: 5 });
		const result1 = firstHandler(event1, state);
		state = result1.state;

		expect(state.count).toBe(5);
		expect(result1.events).toHaveLength(1);

		// Process emitted event
		const event2 = result1.events[0] as Event<"step:two", { previousValue: number }>;
		const result2 = secondHandler(event2, state);
		state = result2.state;

		expect(state.count).toBe(25); // 5 * 5
	});

	it("should support handlers that emit multiple events", () => {
		const handler: Handler<Event<"batch:process", { items: string[] }>, TestState> = (event, state) => ({
			state: { ...state, count: state.count + event.payload.items.length },
			events: event.payload.items.map((item, index) => emitEvent("item:processed", { item, index }, event.id)),
		});

		const event = createEvent("batch:process", { items: ["a", "b", "c"] });
		const state: TestState = { count: 0, messages: [] };
		const result = handler(event, state);

		expect(result.state.count).toBe(3);
		expect(result.events).toHaveLength(3);
		expect(result.events.map((e) => e.name)).toEqual(["item:processed", "item:processed", "item:processed"]);
		expect(result.events.every((e) => e.causedBy === event.id)).toBe(true);
	});

	it("should allow conditional event emission", () => {
		const handler: Handler<Event<"value:check", { value: number }>, TestState> = (event, state) => {
			const events: Event[] = [];

			if (event.payload.value > 10) {
				events.push(emitEvent("value:high", { value: event.payload.value }, event.id));
			} else {
				events.push(emitEvent("value:low", { value: event.payload.value }, event.id));
			}

			return {
				state: { ...state, count: event.payload.value },
				events,
			};
		};

		const highEvent = createEvent("value:check", { value: 15 });
		const lowEvent = createEvent("value:check", { value: 5 });
		const state: TestState = { count: 0, messages: [] };

		const highResult = handler(highEvent, state);
		const lowResult = handler(lowEvent, state);

		expect(highResult.events[0]?.name).toBe("value:high");
		expect(lowResult.events[0]?.name).toBe("value:low");
	});
});
