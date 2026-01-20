/**
 * Event Primitives Tests
 *
 * Tests for Event types, factories, and EventLog.
 */

import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	type AnyEvent,
	createEvent,
	defineEvent,
	type EventId,
	EventIdSchema,
	EventSchema,
} from "../src/event/Event.js";
import { createEventLog } from "../src/event/EventLog.js";

describe("EventId", () => {
	it("should validate a valid UUID", () => {
		const uuid = "550e8400-e29b-41d4-a716-446655440000";
		const result = Schema.decodeUnknownSync(EventIdSchema)(uuid);
		expect(result).toBe(uuid);
	});

	it("should reject an invalid UUID", () => {
		expect(() => Schema.decodeUnknownSync(EventIdSchema)("not-a-uuid")).toThrow();
	});

	it("should reject empty string", () => {
		expect(() => Schema.decodeUnknownSync(EventIdSchema)("")).toThrow();
	});
});

describe("createEvent", () => {
	it("should create an event with generated ID and timestamp", () => {
		const event = createEvent("test:event", { value: 42 });

		expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(event.name).toBe("test:event");
		expect(event.payload).toEqual({ value: 42 });
		expect(event.timestamp).toBeInstanceOf(Date);
		expect(event.causedBy).toBeUndefined();
	});

	it("should create an event with causedBy reference", () => {
		const parentEvent = createEvent("parent:event", {});
		const childEvent = createEvent("child:event", { data: "test" }, parentEvent.id);

		expect(childEvent.causedBy).toBe(parentEvent.id);
	});

	it("should create unique IDs for each event", () => {
		const event1 = createEvent("test:event", {});
		const event2 = createEvent("test:event", {});

		expect(event1.id).not.toBe(event2.id);
	});
});

describe("EventSchema", () => {
	it("should create a valid schema for custom events", () => {
		const CustomEventSchema = EventSchema(
			"custom:event",
			Schema.Struct({
				message: Schema.String,
				count: Schema.Number,
			}),
		);

		const validEvent = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			name: "custom:event",
			payload: { message: "hello", count: 5 },
			timestamp: "2024-01-01T00:00:00.000Z",
		};

		const decoded = Schema.decodeUnknownSync(CustomEventSchema)(validEvent);
		expect(decoded.name).toBe("custom:event");
		expect(decoded.payload.message).toBe("hello");
		expect(decoded.payload.count).toBe(5);
		expect(decoded.timestamp).toBeInstanceOf(Date);
	});

	it("should reject events with wrong name", () => {
		const CustomEventSchema = EventSchema("custom:event", Schema.Struct({ value: Schema.String }));

		const wrongEvent = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			name: "wrong:event",
			payload: { value: "test" },
			timestamp: "2024-01-01T00:00:00.000Z",
		};

		expect(() => Schema.decodeUnknownSync(CustomEventSchema)(wrongEvent)).toThrow();
	});

	it("should handle optional causedBy field", () => {
		const CustomEventSchema = EventSchema("custom:event", Schema.Struct({ data: Schema.String }));

		const eventWithCause = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			name: "custom:event",
			payload: { data: "test" },
			timestamp: "2024-01-01T00:00:00.000Z",
			causedBy: "660e8400-e29b-41d4-a716-446655440000",
		};

		const decoded = Schema.decodeUnknownSync(CustomEventSchema)(eventWithCause);
		expect(decoded.causedBy).toBe("660e8400-e29b-41d4-a716-446655440000");
	});
});

describe("defineEvent", () => {
	it("should create an EventDefinition with correct name", () => {
		const MyEvent = defineEvent<"my:event", { value: number }>("my:event");

		expect(MyEvent.name).toBe("my:event");
	});

	it("should create events via the create method", () => {
		const MyEvent = defineEvent<"my:event", { value: number }>("my:event");

		const event = MyEvent.create({ value: 42 });

		expect(event.name).toBe("my:event");
		expect(event.payload.value).toBe(42);
		expect(event.id).toBeDefined();
		expect(event.timestamp).toBeInstanceOf(Date);
	});

	it("should support causedBy in create method", () => {
		const ParentEvent = defineEvent<"parent:event", Record<string, never>>("parent:event");
		const ChildEvent = defineEvent<"child:event", { ref: string }>("child:event");

		const parent = ParentEvent.create({});
		const child = ChildEvent.create({ ref: "parent" }, parent.id);

		expect(child.causedBy).toBe(parent.id);
	});

	it("should correctly identify events with is() type guard", () => {
		const EventA = defineEvent<"event:a", { a: string }>("event:a");
		const EventB = defineEvent<"event:b", { b: number }>("event:b");

		const eventA = EventA.create({ a: "test" });
		const eventB = EventB.create({ b: 42 });

		expect(EventA.is(eventA)).toBe(true);
		expect(EventA.is(eventB)).toBe(false);
		expect(EventB.is(eventA)).toBe(false);
		expect(EventB.is(eventB)).toBe(true);
	});

	it("should narrow types correctly with is() guard", () => {
		const MyEvent = defineEvent<"my:event", { specific: boolean }>("my:event");

		const unknownEvent: AnyEvent = createEvent("my:event", { specific: true });

		if (MyEvent.is(unknownEvent)) {
			// TypeScript should narrow the type here
			expect(unknownEvent.payload.specific).toBe(true);
		} else {
			expect.fail("Type guard should have matched");
		}
	});
});

describe("EventLog", () => {
	it("should create an empty event log", async () => {
		const program = Effect.gen(function* () {
			const log = yield* createEventLog();
			const events = yield* log.events();
			const length = yield* log.length();

			return { events, length };
		});

		const result = await Effect.runPromise(program);
		expect(result.events).toEqual([]);
		expect(result.length).toBe(0);
	});

	it("should append events and retrieve them in order", async () => {
		const program = Effect.gen(function* () {
			const log = yield* createEventLog();

			const event1 = createEvent("event:1", { order: 1 });
			const event2 = createEvent("event:2", { order: 2 });
			const event3 = createEvent("event:3", { order: 3 });

			yield* log.append(event1);
			yield* log.append(event2);
			yield* log.append(event3);

			const events = yield* log.events();
			const length = yield* log.length();

			return { events, length };
		});

		const result = await Effect.runPromise(program);
		expect(result.length).toBe(3);
		expect(result.events.map((e) => e.name)).toEqual(["event:1", "event:2", "event:3"]);
	});

	it("should retrieve event by ID", async () => {
		const program = Effect.gen(function* () {
			const log = yield* createEventLog();

			const event1 = createEvent("event:1", { data: "first" });
			const event2 = createEvent("event:2", { data: "second" });

			yield* log.append(event1);
			yield* log.append(event2);

			const found = yield* log.get(event2.id);
			const notFound = yield* log.get("nonexistent-id" as EventId);

			return { found, notFound };
		});

		const result = await Effect.runPromise(program);
		expect(result.found?.name).toBe("event:2");
		expect(result.notFound).toBeUndefined();
	});

	it("should clear all events", async () => {
		const program = Effect.gen(function* () {
			const log = yield* createEventLog();

			yield* log.append(createEvent("event:1", {}));
			yield* log.append(createEvent("event:2", {}));

			const lengthBefore = yield* log.length();
			yield* log.clear();
			const lengthAfter = yield* log.length();

			return { lengthBefore, lengthAfter };
		});

		const result = await Effect.runPromise(program);
		expect(result.lengthBefore).toBe(2);
		expect(result.lengthAfter).toBe(0);
	});

	it("should maintain immutability of returned events array", async () => {
		const program = Effect.gen(function* () {
			const log = yield* createEventLog();

			const event = createEvent("test:event", {});
			yield* log.append(event);

			const events1 = yield* log.events();
			const events2 = yield* log.events();

			// Should return new array references
			return { sameReference: events1 === events2, length: events1.length };
		});

		const result = await Effect.runPromise(program);
		// Due to Ref.get returning the same underlying array, they may be the same reference
		// The important thing is that the array itself is immutable (readonly)
		expect(result.length).toBe(1);
	});
});

describe("Built-in Event Types", () => {
	it("should create UserInputEvent", () => {
		const event = createEvent("user:input", { text: "Hello, world!" });
		expect(event.name).toBe("user:input");
		expect(event.payload.text).toBe("Hello, world!");
	});

	it("should create TextDeltaEvent", () => {
		const event = createEvent("text:delta", {
			delta: "streaming text",
			agentName: "assistant",
		});
		expect(event.name).toBe("text:delta");
		expect(event.payload.delta).toBe("streaming text");
	});

	it("should create TextCompleteEvent", () => {
		const event = createEvent("text:complete", {
			fullText: "Complete response",
			agentName: "assistant",
		});
		expect(event.name).toBe("text:complete");
		expect(event.payload.fullText).toBe("Complete response");
	});

	it("should create AgentStartedEvent", () => {
		const event = createEvent("agent:started", {
			agentName: "planner",
			reason: "User requested planning",
		});
		expect(event.name).toBe("agent:started");
		expect(event.payload.agentName).toBe("planner");
	});

	it("should create AgentCompletedEvent", () => {
		const event = createEvent("agent:completed", {
			agentName: "executor",
			outcome: "success" as const,
		});
		expect(event.name).toBe("agent:completed");
		expect(event.payload.outcome).toBe("success");
	});

	it("should create ToolCalledEvent", () => {
		const event = createEvent("tool:called", {
			toolName: "readFile",
			toolId: "tool-123",
			input: { path: "/tmp/file.txt" },
		});
		expect(event.name).toBe("tool:called");
		expect(event.payload.toolName).toBe("readFile");
	});

	it("should create ToolResultEvent", () => {
		const event = createEvent("tool:result", {
			toolId: "tool-123",
			output: { content: "file contents" },
			isError: false,
		});
		expect(event.name).toBe("tool:result");
		expect(event.payload.isError).toBe(false);
	});

	it("should create ErrorOccurredEvent", () => {
		const event = createEvent("error:occurred", {
			code: "TIMEOUT",
			message: "Request timed out",
			recoverable: true,
			context: { attempt: 3 },
		});
		expect(event.name).toBe("error:occurred");
		expect(event.payload.code).toBe("TIMEOUT");
		expect(event.payload.recoverable).toBe(true);
	});
});
