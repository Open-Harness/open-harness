/**
 * Store Service Tests
 *
 * Tests for Store service definition, types, and utilities.
 * Note: This tests the service interface and types.
 * Implementation tests (MemoryStore, SqliteStore) will be added in Phase 5.
 */

import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { createEvent } from "../src/event/Event.js";
import {
	generateSessionId,
	makeSessionId,
	type SessionId,
	type SessionMetadata,
	type StateSnapshot,
	Store,
	StoreError,
	type StoreService,
} from "../src/store/Store.js";

describe("SessionId", () => {
	it("should create a SessionId from a string using makeSessionId", () => {
		const id = makeSessionId("session-123");
		expect(id).toBe("session-123");
		// At compile time, this is branded as SessionId
		const _typedId: SessionId = id;
		expect(_typedId).toBe("session-123");
	});

	it("should generate a unique UUID SessionId", () => {
		const id1 = generateSessionId();
		const id2 = generateSessionId();

		expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(id1).not.toBe(id2);
	});

	it("should allow empty string as SessionId", () => {
		// Edge case: empty string is technically valid at runtime
		const id = makeSessionId("");
		expect(id).toBe("");
	});
});

describe("StoreError", () => {
	it("should create error with NOT_FOUND code", () => {
		const error = new StoreError("NOT_FOUND", "Session not found");

		expect(error.code).toBe("NOT_FOUND");
		expect(error.message).toBe("Session not found");
		expect(error.name).toBe("StoreError");
		expect(error._tag).toBe("StoreError");
		expect(error.cause).toBeUndefined();
	});

	it("should create error with WRITE_FAILED code and cause", () => {
		const originalError = new Error("Disk full");
		const error = new StoreError("WRITE_FAILED", "Failed to write event", originalError);

		expect(error.code).toBe("WRITE_FAILED");
		expect(error.message).toBe("Failed to write event");
		expect(error.cause).toBe(originalError);
	});

	it("should create error with READ_FAILED code", () => {
		const error = new StoreError("READ_FAILED", "Database connection failed");

		expect(error.code).toBe("READ_FAILED");
		expect(error.message).toBe("Database connection failed");
	});

	it("should create error with CORRUPTED code", () => {
		const error = new StoreError("CORRUPTED", "Event log checksum mismatch");

		expect(error.code).toBe("CORRUPTED");
		expect(error.message).toBe("Event log checksum mismatch");
	});

	it("should be an instance of Error", () => {
		const error = new StoreError("NOT_FOUND", "Test");
		expect(error).toBeInstanceOf(Error);
	});
});

describe("Store Context.Tag", () => {
	it("should have the correct service identifier", () => {
		// The key is accessible via the Context.Tag's string representation
		expect(Store.key).toBe("@core-v2/Store");
	});

	it("should be usable as an Effect service dependency", async () => {
		// Create a minimal mock implementation
		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		// Create a Layer that provides the mock
		const MockStoreLayer = Layer.succeed(Store, mockStore);

		// Use the store in an Effect program
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			// Test append
			const event = createEvent("test:event", { value: 42 });
			yield* store.append(sessionId, event);

			// Test events
			const events = yield* store.events(sessionId);

			// Test sessions
			const sessions = yield* store.sessions();

			return { events, sessions };
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MockStoreLayer)));

		expect(result.events).toEqual([]);
		expect(result.sessions).toEqual([]);
	});
});

describe("SessionMetadata", () => {
	it("should have all required fields", () => {
		const metadata: SessionMetadata = {
			id: makeSessionId("session-1"),
			createdAt: new Date("2024-01-01T00:00:00Z"),
			eventCount: 0,
		};

		expect(metadata.id).toBe("session-1");
		expect(metadata.createdAt).toBeInstanceOf(Date);
		expect(metadata.eventCount).toBe(0);
		expect(metadata.lastEventAt).toBeUndefined();
		expect(metadata.workflowName).toBeUndefined();
	});

	it("should have optional fields populated", () => {
		const metadata: SessionMetadata = {
			id: makeSessionId("session-2"),
			createdAt: new Date("2024-01-01T00:00:00Z"),
			lastEventAt: new Date("2024-01-01T01:00:00Z"),
			eventCount: 10,
			workflowName: "task-workflow",
		};

		expect(metadata.lastEventAt).toBeInstanceOf(Date);
		expect(metadata.eventCount).toBe(10);
		expect(metadata.workflowName).toBe("task-workflow");
	});
});

describe("StateSnapshot", () => {
	it("should hold state data at a position", () => {
		interface TestState {
			count: number;
			name: string;
		}

		const snapshot: StateSnapshot<TestState> = {
			data: { count: 5, name: "test" },
			position: 10,
		};

		expect(snapshot.data.count).toBe(5);
		expect(snapshot.data.name).toBe("test");
		expect(snapshot.position).toBe(10);
		expect(snapshot.lastEventId).toBeUndefined();
	});

	it("should include lastEventId when available", () => {
		const eventId = crypto.randomUUID();
		const snapshot: StateSnapshot<{ value: number }> = {
			data: { value: 42 },
			position: 5,
			lastEventId: eventId as import("../src/event/Event.js").EventId,
		};

		expect(snapshot.lastEventId).toBe(eventId);
	});
});

describe("StoreService interface contract", () => {
	it("should define append method that returns Effect<void, StoreError>", async () => {
		const mockStore: StoreService = {
			append: (sessionId, event) => {
				// Validate inputs are passed correctly
				expect(typeof sessionId).toBe("string");
				expect(event.name).toBe("test:event");
				return Effect.succeed(undefined);
			},
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		const sessionId = makeSessionId("test-session");
		const event = createEvent("test:event", { data: "test" });

		const result = await Effect.runPromise(mockStore.append(sessionId, event));
		expect(result).toBeUndefined();
	});

	it("should define events method that returns Effect<readonly AnyEvent[], StoreError>", async () => {
		const testEvents = [createEvent("event:1", {}), createEvent("event:2", {})];

		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: (sessionId) => {
				expect(typeof sessionId).toBe("string");
				return Effect.succeed(testEvents);
			},
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		const sessionId = makeSessionId("test-session");
		const result = await Effect.runPromise(mockStore.events(sessionId));

		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("event:1");
		expect(result[1]?.name).toBe("event:2");
	});

	it("should define sessions method that returns Effect<readonly SessionMetadata[], StoreError>", async () => {
		const testSessions: SessionMetadata[] = [
			{
				id: makeSessionId("session-1"),
				createdAt: new Date(),
				eventCount: 5,
			},
			{
				id: makeSessionId("session-2"),
				createdAt: new Date(),
				eventCount: 10,
				workflowName: "test-workflow",
			},
		];

		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed(testSessions),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		const result = await Effect.runPromise(mockStore.sessions());

		expect(result).toHaveLength(2);
		expect(result[0]?.id).toBe("session-1");
		expect(result[1]?.workflowName).toBe("test-workflow");
	});

	it("should define clear method that returns Effect<void, StoreError>", async () => {
		let clearedSessionId: SessionId | undefined;

		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: (sessionId) => {
				clearedSessionId = sessionId;
				return Effect.succeed(undefined);
			},
			snapshot: () => Effect.succeed(undefined),
		};

		const sessionId = makeSessionId("to-clear");
		await Effect.runPromise(mockStore.clear(sessionId));

		expect(clearedSessionId).toBe("to-clear");
	});

	it("should define snapshot method that returns Effect<StateSnapshot | undefined, StoreError>", async () => {
		const testSnapshot: StateSnapshot<{ count: number }> = {
			data: { count: 42 },
			position: 5,
		};

		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: <S>(sessionId: SessionId, position: number) => {
				expect(typeof sessionId).toBe("string");
				expect(typeof position).toBe("number");
				return Effect.succeed(testSnapshot as StateSnapshot<S> | undefined);
			},
		};

		const sessionId = makeSessionId("test-session");
		const result = await Effect.runPromise(mockStore.snapshot(sessionId, 5));

		expect(result?.position).toBe(5);
		expect((result?.data as { count: number })?.count).toBe(42);
	});

	it("should allow snapshot to return undefined when not supported", async () => {
		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		const sessionId = makeSessionId("test-session");
		const result = await Effect.runPromise(mockStore.snapshot(sessionId, 0));

		expect(result).toBeUndefined();
	});
});

describe("StoreService error handling", () => {
	it("should propagate StoreError through Effect", async () => {
		const mockStore: StoreService = {
			append: () => Effect.fail(new StoreError("WRITE_FAILED", "Disk full")),
			events: () => Effect.succeed([]),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		const sessionId = makeSessionId("test-session");
		const event = createEvent("test:event", {});

		const result = await Effect.runPromiseExit(mockStore.append(sessionId, event));

		expect(result._tag).toBe("Failure");
	});

	it("should allow error recovery with Effect.catchTag", async () => {
		const mockStore: StoreService = {
			append: () => Effect.succeed(undefined),
			events: () => Effect.fail(new StoreError("NOT_FOUND", "Session not found")),
			sessions: () => Effect.succeed([]),
			clear: () => Effect.succeed(undefined),
			snapshot: () => Effect.succeed(undefined),
		};

		const sessionId = makeSessionId("nonexistent");

		// Recover from NOT_FOUND by returning empty array
		const program = mockStore.events(sessionId).pipe(
			Effect.catchAll((error) => {
				if (error.code === "NOT_FOUND") {
					return Effect.succeed([] as const);
				}
				return Effect.fail(error);
			}),
		);

		const result = await Effect.runPromise(program);
		expect(result).toEqual([]);
	});
});

describe("Store service composition with Effect.gen", () => {
	it("should allow chaining store operations", async () => {
		const storedEvents: Map<SessionId, import("../src/event/Event.js").AnyEvent[]> = new Map();

		const mockStore: StoreService = {
			append: (sessionId, event) => {
				const events = storedEvents.get(sessionId) ?? [];
				events.push(event);
				storedEvents.set(sessionId, events);
				return Effect.succeed(undefined);
			},
			events: (sessionId) => {
				return Effect.succeed(storedEvents.get(sessionId) ?? []);
			},
			sessions: () => {
				const sessions: SessionMetadata[] = [];
				for (const [id, events] of storedEvents) {
					sessions.push({
						id,
						createdAt: events[0]?.timestamp ?? new Date(),
						lastEventAt: events[events.length - 1]?.timestamp,
						eventCount: events.length,
					});
				}
				return Effect.succeed(sessions);
			},
			clear: (sessionId) => {
				storedEvents.delete(sessionId);
				return Effect.succeed(undefined);
			},
			snapshot: () => Effect.succeed(undefined),
		};

		const MockStoreLayer = Layer.succeed(Store, mockStore);

		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = makeSessionId("test-session");

			// Append multiple events
			yield* store.append(sessionId, createEvent("event:1", { order: 1 }));
			yield* store.append(sessionId, createEvent("event:2", { order: 2 }));
			yield* store.append(sessionId, createEvent("event:3", { order: 3 }));

			// Retrieve events
			const events = yield* store.events(sessionId);

			// Get sessions
			const sessions = yield* store.sessions();

			return { eventCount: events.length, sessionCount: sessions.length };
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MockStoreLayer)));

		expect(result.eventCount).toBe(3);
		expect(result.sessionCount).toBe(1);
	});
});
