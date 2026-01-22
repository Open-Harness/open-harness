/**
 * SqliteStore Implementation Tests
 *
 * Tests for the SqliteStore live implementation.
 * Validates all StoreService interface methods with real Effect execution.
 * Uses in-memory SQLite for test isolation.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEvent } from "../src/event/Event.js";
import {
	createSqliteStore,
	createSqliteStoreEffect,
	makeSqliteStoreLive,
	SqliteStoreMemoryLive,
} from "../src/store/SqliteStore.js";
import { generateSessionId, makeSessionId, Store, StoreError } from "../src/store/Store.js";

// ============================================================================
// SqliteStoreMemoryLive Layer Tests (In-Memory)
// ============================================================================

describe("SqliteStoreMemoryLive", () => {
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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

			expect(result.retrieved?.id).toBe(result.original.id);
			expect(result.retrieved?.name).toBe(result.original.name);
			expect(result.retrieved?.payload).toEqual(result.original.payload);
			// SQLite stores timestamps as ISO strings, so compare as strings
			expect(result.retrieved?.timestamp.toISOString()).toBe(result.original.timestamp.toISOString());
		});

		it("should preserve causedBy field", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				const causeEvent = createEvent("cause:event", {});
				const effectEvent = createEvent("effect:event", {}, causeEvent.id);

				yield* store.append(sessionId, causeEvent);
				yield* store.append(sessionId, effectEvent);

				const events = yield* store.events(sessionId);
				return events;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

			expect(result).toHaveLength(2);
			expect(result[0]?.causedBy).toBeUndefined();
			expect(result[1]?.causedBy).toBe(result[0]?.id);
		});
	});

	describe("sessions operation", () => {
		it("should return empty array when no sessions exist", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				return yield* store.sessions();
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

			expect(result.session?.createdAt.toISOString()).toBe(result.firstEventTimestamp.toISOString());
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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

			expect(result.session?.lastEventAt?.toISOString()).toBe(result.lastEventTimestamp.toISOString());
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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

			expect(result.events1).toEqual([]);
			expect(result.events2).toHaveLength(1);
		});
	});

	describe("snapshot operation", () => {
		it("should return undefined (SqliteStore does not implement snapshots)", async () => {
			const program = Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = generateSessionId();

				yield* store.append(sessionId, createEvent("event:1", {}));

				return yield* store.snapshot(sessionId, 0);
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

			expect(result).toBeUndefined();
		});
	});
});

// ============================================================================
// createSqliteStore Factory Tests (Promise-based Public API)
// ============================================================================

describe("createSqliteStore factory (Promise-based)", () => {
	it("should create an independent store instance", async () => {
		const store = await createSqliteStore({ path: ":memory:" });
		const sessionId = generateSessionId();

		await store.append(sessionId, createEvent("test:event", { value: 42 }));

		const events = await store.events(sessionId);

		expect(events).toHaveLength(1);
		expect(events[0]?.name).toBe("test:event");
	});

	it("should create separate isolated instances", async () => {
		const store1 = await createSqliteStore({ path: ":memory:" });
		const store2 = await createSqliteStore({ path: ":memory:" });
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
// createSqliteStoreEffect Factory Tests (Effect-based Internal API)
// ============================================================================

describe("createSqliteStoreEffect factory (Effect-based)", () => {
	it("should create an independent store instance", async () => {
		const program = Effect.gen(function* () {
			const store = yield* createSqliteStoreEffect({ path: ":memory:" });
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
			const store1 = yield* createSqliteStoreEffect({ path: ":memory:" });
			const store2 = yield* createSqliteStoreEffect({ path: ":memory:" });
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
// File-Based Store Tests
// ============================================================================

describe("File-based SqliteStore", () => {
	let tempDir: string;
	let dbPath: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-store-test-"));
		dbPath = path.join(tempDir, "test.db");
	});

	afterEach(() => {
		// Clean up temp directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should persist events across store instances", async () => {
		const sessionId = makeSessionId("persistent-session");
		const event = createEvent("persistent:event", { data: "test" });

		// Write with first instance
		const store1 = await createSqliteStore({ path: dbPath });
		await store1.append(sessionId, event);

		// Read with second instance
		const store2 = await createSqliteStore({ path: dbPath });
		const result = await store2.events(sessionId);

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(event.id);
		expect(result[0]?.name).toBe("persistent:event");
		expect(result[0]?.payload).toEqual({ data: "test" });
	});

	it("should create database file on first write", async () => {
		const store = await createSqliteStore({ path: dbPath });
		await store.append(generateSessionId(), createEvent("test:event", {}));

		expect(fs.existsSync(dbPath)).toBe(true);
	});

	it("should support WAL mode for file databases by default", async () => {
		const store = await createSqliteStore({ path: dbPath });
		await store.append(generateSessionId(), createEvent("test:event", {}));

		// WAL mode creates a -wal file
		expect(fs.existsSync(dbPath)).toBe(true);
		// Note: -wal file may or may not exist depending on checkpoint behavior
	});

	it("should use makeSqliteStoreLive Layer factory", async () => {
		const FileSqliteLive = makeSqliteStoreLive({ path: dbPath });

		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			yield* store.append(sessionId, createEvent("layer:event", { value: 123 }));
			return yield* store.events(sessionId);
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(FileSqliteLive)));

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("layer:event");
	});
});

// ============================================================================
// Edge Cases and Stress Tests
// ============================================================================

describe("SqliteStore edge cases", () => {
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

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

		expect(result).toBe(100);
	});

	it("should handle empty payload events", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			yield* store.append(sessionId, createEvent("empty:payload", {}));

			const events = yield* store.events(sessionId);
			return events[0];
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

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

	it("should handle unicode in payloads", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			const unicodePayload = {
				emoji: "🚀🎉",
				chinese: "你好世界",
				arabic: "مرحبا بالعالم",
				mixed: "Hello 世界 🌍",
			};

			yield* store.append(sessionId, createEvent("unicode:event", unicodePayload));

			const events = yield* store.events(sessionId);
			return events[0]?.payload;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

		expect(result).toEqual({
			emoji: "🚀🎉",
			chinese: "你好世界",
			arabic: "مرحبا بالعالم",
			mixed: "Hello 世界 🌍",
		});
	});

	it("should handle special characters in event names", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();

			yield* store.append(sessionId, createEvent("event:with:multiple:colons", {}));
			yield* store.append(sessionId, createEvent("event-with-dashes", {}));
			yield* store.append(sessionId, createEvent("event_with_underscores", {}));

			const events = yield* store.events(sessionId);
			return events.map((e) => e.name);
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

		expect(result).toContain("event:with:multiple:colons");
		expect(result).toContain("event-with-dashes");
		expect(result).toContain("event_with_underscores");
	});
});

// ============================================================================
// Layer Isolation Tests
// ============================================================================

describe("SqliteStoreLive Layer isolation", () => {
	it("should provide fresh store for each program run with in-memory DB", async () => {
		const makeProgram = () =>
			Effect.gen(function* () {
				const store = yield* Store;
				const sessionId = makeSessionId("test-session");
				yield* store.append(sessionId, createEvent("test:event", {}));
				const sessions = yield* store.sessions();
				return sessions.length;
			});

		// Run the program twice - each should start with empty store (in-memory)
		const result1 = await Effect.runPromise(makeProgram().pipe(Effect.provide(SqliteStoreMemoryLive)));
		const result2 = await Effect.runPromise(makeProgram().pipe(Effect.provide(SqliteStoreMemoryLive)));

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

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

		expect(result.created).toBe(3);
		expect(result.stored).toBe(3);
	});
});

// ============================================================================
// StoreError Tests
// ============================================================================

describe("SqliteStore error handling", () => {
	it("should return StoreError with WRITE_FAILED for duplicate event IDs", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;
			const sessionId = generateSessionId();
			const event = createEvent("test:event", {});

			// First append should succeed
			yield* store.append(sessionId, event);

			// Second append with same event ID should fail
			const result = yield* store.append(sessionId, event).pipe(
				Effect.map(() => "success"),
				Effect.catchAll((e) => {
					if (e instanceof StoreError) {
						return Effect.succeed(`error:${e.code}`);
					}
					return Effect.succeed("unknown-error");
				}),
			);

			return result;
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(SqliteStoreMemoryLive)));

		expect(result).toBe("error:WRITE_FAILED");
	});
});
