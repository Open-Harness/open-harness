/**
 * MemoryStore Implementation Tests
 *
 * Tests for the MemoryStore live implementation.
 * Validates all StoreService interface methods with real Effect execution.
 */

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEvent } from "../src/event/Event.js";
import { createMemoryStore, createMemoryStoreEffect, MemoryStoreLive } from "../src/store/MemoryStore.js";
import { generateSessionId, makeSessionId, Store } from "../src/store/Store.js";

// ============================================================================
// MemoryStoreLive Layer Tests
// ============================================================================

describe("MemoryStoreLive", () => {
	describe("append operation", () => {
		it("should append an event to a new session", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();
				const event = createEvent("test:event", { value: 1 });

				yield* store.append(sessionId, event);

				const events = yield* store.events(sessionId);
				return events;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("test:event");
			expect(result[0]?.payload).toEqual({ value: 1 });
		});

		it("should append multiple events to the same session in order", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				yield* store.append(sessionId, createEvent("event:1", { order: 1 }));
				yield* store.append(sessionId, createEvent("event:2", { order: 2 }));
				yield* store.append(sessionId, createEvent("event:3", { order: 3 }));

				const events = yield* store.events(sessionId);
				return events;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toHaveLength(3);
			expect(result[0]?.name).toBe("event:1");
			expect(result[1]?.name).toBe("event:2");
			expect(result[2]?.name).toBe("event:3");
			expect((result[0]?.payload as { order: number }).order).toBe(1);
			expect((result[1]?.payload as { order: number }).order).toBe(2);
			expect((result[2]?.payload as { order: number }).order).toBe(3);
		});

		it("should create separate sessions for different session IDs", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const session1 = makeSessionId("session-1");
				const session2 = makeSessionId("session-2");

				yield* store.append(session1, createEvent("event:a", {}));
				yield* store.append(session2, createEvent("event:b", {}));
				yield* store.append(session1, createEvent("event:c", {}));

				const events1 = yield* store.events(session1);
				const events2 = yield* store.events(session2);

				return { events1, events2 };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result.events1).toHaveLength(2);
			expect(result.events1[0]?.name).toBe("event:a");
			expect(result.events1[1]?.name).toBe("event:c");
			expect(result.events2).toHaveLength(1);
			expect(result.events2[0]?.name).toBe("event:b");
		});
	});

	describe("events operation", () => {
		it("should return empty array for non-existent session (FR-023)", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const nonExistentId = makeSessionId("does-not-exist");
				const events = yield* store.events(nonExistentId);
				return events;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toEqual([]);
		});

		it("should return events in chronological order", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				// Create events with incrementing timestamps
				const event1 = createEvent("first", { seq: 1 });
				const event2 = createEvent("second", { seq: 2 });
				const event3 = createEvent("third", { seq: 3 });

				yield* store.append(sessionId, event1);
				yield* store.append(sessionId, event2);
				yield* store.append(sessionId, event3);

				return yield* store.events(sessionId);
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toHaveLength(3);
			expect((result[0]?.payload as { seq: number }).seq).toBe(1);
			expect((result[1]?.payload as { seq: number }).seq).toBe(2);
			expect((result[2]?.payload as { seq: number }).seq).toBe(3);
		});

		it("should preserve all event properties", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();
				const originalEvent = createEvent("test:event", {
					nested: { value: 42, array: [1, 2, 3] },
				});

				yield* store.append(sessionId, originalEvent);
				const events = yield* store.events(sessionId);

				return { original: originalEvent, retrieved: events[0] };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result.retrieved?.id).toBe(result.original.id);
			expect(result.retrieved?.name).toBe(result.original.name);
			expect(result.retrieved?.payload).toEqual(result.original.payload);
			expect(result.retrieved?.timestamp).toEqual(result.original.timestamp);
		});
	});

	describe("sessions operation", () => {
		it("should return empty array when no sessions exist", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				return yield* store.sessions();
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toEqual([]);
		});

		it("should return metadata for all sessions", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const session1 = makeSessionId("session-1");
				const session2 = makeSessionId("session-2");

				yield* store.append(session1, createEvent("event:a", {}));
				yield* store.append(session1, createEvent("event:b", {}));
				yield* store.append(session2, createEvent("event:c", {}));

				return yield* store.sessions();
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toHaveLength(2);

			const session1Meta = result.find((s) => s.id === "session-1");
			const session2Meta = result.find((s) => s.id === "session-2");

			expect(session1Meta).toBeDefined();
			expect(session1Meta?.eventCount).toBe(2);
			expect(session2Meta).toBeDefined();
			expect(session2Meta?.eventCount).toBe(1);
		});

		it("should track createdAt from first event timestamp", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();
				const firstEvent = createEvent("first:event", {});

				yield* store.append(sessionId, firstEvent);
				yield* store.append(sessionId, createEvent("second:event", {}));

				const sessions = yield* store.sessions();
				const session = sessions.find((s) => s.id === sessionId);

				return { session, firstEventTimestamp: firstEvent.timestamp };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result.session?.createdAt).toEqual(result.firstEventTimestamp);
		});

		it("should track lastEventAt from most recent event", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				yield* store.append(sessionId, createEvent("first:event", {}));
				const lastEvent = createEvent("last:event", {});
				yield* store.append(sessionId, lastEvent);

				const sessions = yield* store.sessions();
				const session = sessions.find((s) => s.id === sessionId);

				return { session, lastEventTimestamp: lastEvent.timestamp };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result.session?.lastEventAt).toEqual(result.lastEventTimestamp);
		});

		it("should update eventCount as events are appended", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();
				const counts: number[] = [];

				yield* store.append(sessionId, createEvent("event:1", {}));
				let sessions = yield* store.sessions();
				counts.push(sessions.find((s) => s.id === sessionId)?.eventCount ?? 0);

				yield* store.append(sessionId, createEvent("event:2", {}));
				sessions = yield* store.sessions();
				counts.push(sessions.find((s) => s.id === sessionId)?.eventCount ?? 0);

				yield* store.append(sessionId, createEvent("event:3", {}));
				sessions = yield* store.sessions();
				counts.push(sessions.find((s) => s.id === sessionId)?.eventCount ?? 0);

				return counts;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toEqual([1, 2, 3]);
		});
	});

	describe("clear operation", () => {
		it("should remove a session and all its events (FR-025)", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				yield* store.append(sessionId, createEvent("event:1", {}));
				yield* store.append(sessionId, createEvent("event:2", {}));

				// Verify session exists
				const beforeClear = yield* store.events(sessionId);

				// Clear the session
				yield* store.clear(sessionId);

				// Verify session is gone
				const afterClear = yield* store.events(sessionId);
				const sessions = yield* store.sessions();

				return { beforeClear, afterClear, sessions };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result.beforeClear).toHaveLength(2);
			expect(result.afterClear).toEqual([]);
			expect(result.sessions).toHaveLength(0);
		});

		it("should be a no-op for non-existent session", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const nonExistentId = makeSessionId("does-not-exist");

				// This should not throw
				yield* store.clear(nonExistentId);

				return "success";
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toBe("success");
		});

		it("should only clear the specified session", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const session1 = makeSessionId("session-1");
				const session2 = makeSessionId("session-2");

				yield* store.append(session1, createEvent("event:a", {}));
				yield* store.append(session2, createEvent("event:b", {}));

				// Clear only session1
				yield* store.clear(session1);

				const events1 = yield* store.events(session1);
				const events2 = yield* store.events(session2);

				return { events1, events2 };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result.events1).toEqual([]);
			expect(result.events2).toHaveLength(1);
		});
	});

	describe("snapshot operation", () => {
		it("should return undefined (MemoryStore does not implement snapshots)", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				yield* store.append(sessionId, createEvent("event:1", {}));

				return yield* store.snapshot(sessionId, 0);
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

			expect(result).toBeUndefined();
		});
	});
});

// ============================================================================
// createMemoryStore Factory Tests (Promise-based Public API)
// ============================================================================

describe("createMemoryStore factory (Promise-based)", () => {
	it("should create an independent store instance", async () => {
		const store = await createMemoryStore();
		const sessionId = generateSessionId();

		await store.append(sessionId, createEvent("test:event", { value: 42 }));

		const events = await store.events(sessionId);

		expect(events).toHaveLength(1);
		expect(events[0]?.name).toBe("test:event");
	});

	it("should create separate isolated instances", async () => {
		const store1 = await createMemoryStore();
		const store2 = await createMemoryStore();
		const sessionId = makeSessionId("shared-id");

		await store1.append(sessionId, createEvent("store1:event", {}));
		await store2.append(sessionId, createEvent("store2:event", {}));

		const events1 = await store1.events(sessionId);
		const events2 = await store2.events(sessionId);

		expect(events1).toHaveLength(1);
		expect(events1[0]?.name).toBe("store1:event");
		expect(events2).toHaveLength(1);
		expect(events2[0]?.name).toBe("store2:event");
	});
});

// ============================================================================
// createMemoryStoreEffect Factory Tests (Effect-based Internal API)
// ============================================================================

describe("createMemoryStoreEffect factory (Effect-based)", () => {
	it("should create an independent store instance", async () => {
		const program = Effect.gen(function* () {
			const store = yield* createMemoryStoreEffect();
			const sessionId = generateSessionId();

			yield* store.append(sessionId, createEvent("test:event", { value: 42 }));

			const events = yield* store.events(sessionId);
			return events;
		});

		const result = await Effect.runPromise(program);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("test:event");
	});

	it("should create separate isolated instances", async () => {
		const program = Effect.gen(function* () {
			const store1 = yield* createMemoryStoreEffect();
			const store2 = yield* createMemoryStoreEffect();
			const sessionId = makeSessionId("shared-id");

			yield* store1.append(sessionId, createEvent("store1:event", {}));
			yield* store2.append(sessionId, createEvent("store2:event", {}));

			const events1 = yield* store1.events(sessionId);
			const events2 = yield* store2.events(sessionId);

			return { events1, events2 };
		});

		const result = await Effect.runPromise(program);

		expect(result.events1).toHaveLength(1);
		expect(result.events1[0]?.name).toBe("store1:event");
		expect(result.events2).toHaveLength(1);
		expect(result.events2[0]?.name).toBe("store2:event");
	});
});

// ============================================================================
// Edge Cases and Stress Tests
// ============================================================================

describe("MemoryStore edge cases", () => {
	it("should handle large number of events", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			// Append 1000 events
			for (let i = 0; i < 1000; i++) {
				yield* store.append(sessionId, createEvent(`event:${i}`, { index: i }));
			}

			const events = yield* store.events(sessionId);
			const sessions = yield* store.sessions();

			return { eventCount: events.length, sessionMeta: sessions[0] };
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

		expect(result.eventCount).toBe(1000);
		expect(result.sessionMeta?.eventCount).toBe(1000);
	});

	it("should handle large number of sessions", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;

			// Create 100 sessions with 1 event each
			for (let i = 0; i < 100; i++) {
				const sessionId = makeSessionId(`session-${i}`);
				yield* store.append(sessionId, createEvent(`event:${i}`, {}));
			}

			const sessions = yield* store.sessions();
			return sessions.length;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

		expect(result).toBe(100);
	});

	it("should handle concurrent appends to same session", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			// Concurrent appends using Effect.all
			yield* Effect.all(
				Array.from({ length: 50 }, (_, i) => store.append(sessionId, createEvent(`concurrent:${i}`, { index: i }))),
				{ concurrency: "unbounded" },
			);

			const events = yield* store.events(sessionId);
			return events.length;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

		expect(result).toBe(50);
	});

	it("should handle empty payload events", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			yield* store.append(sessionId, createEvent("empty:payload", {}));

			const events = yield* store.events(sessionId);
			return events[0];
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

		expect(result?.name).toBe("empty:payload");
		expect(result?.payload).toEqual({});
	});

	it("should handle complex nested payloads", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			const complexPayload = {
				string: "hello",
				number: 42,
				boolean: true,
				null: null,
				array: [1, "two", { three: 3 }],
				nested: {
					deep: {
						value: "found",
					},
				},
			};

			yield* store.append(sessionId, createEvent("complex:event", complexPayload));

			const events = yield* store.events(sessionId);
			return events[0]?.payload;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

		expect(result).toEqual({
			string: "hello",
			number: 42,
			boolean: true,
			null: null,
			array: [1, "two", { three: 3 }],
			nested: {
				deep: {
					value: "found",
				},
			},
		});
	});
});

// ============================================================================
// Layer Isolation Tests
// ============================================================================

describe("MemoryStoreLive Layer isolation", () => {
	it("should provide fresh store for each program run", async () => {
		const makeProgram = () =>
			Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = makeSessionId("test-session");
				yield* store.append(sessionId, createEvent("test:event", {}));
				const sessions = yield* store.sessions();
				return sessions.length;
			});

		// Run the program twice - each should start with empty store
		const result1 = await Effect.runPromise(makeProgram().pipe(Effect.provide(MemoryStoreLive)));
		const result2 = await Effect.runPromise(makeProgram().pipe(Effect.provide(MemoryStoreLive)));

		expect(result1).toBe(1);
		expect(result2).toBe(1);
	});

	it("should compose with other Effect services", async () => {
		// Example: composing store operations with other effects
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			// Mix store operations with other Effect combinators
			const events = yield* Effect.forEach(
				[1, 2, 3],
				(i) => {
					const event = createEvent(`event:${i}`, { index: i });
					return store.append(sessionId, event).pipe(Effect.map(() => event));
				},
				{ concurrency: 1 },
			);

			const stored = yield* store.events(sessionId);
			return { created: events.length, stored: stored.length };
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));

		expect(result.created).toBe(3);
		expect(result.stored).toBe(3);
	});
});
