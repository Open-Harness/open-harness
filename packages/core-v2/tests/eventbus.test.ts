/**
 * EventBus Tests
 *
 * Tests for the EventBus service including:
 * - Subscription management
 * - Event emission
 * - Pattern-based filtering
 * - Effect Layer integration
 */

import { Effect, Ref } from "effect";
import { describe, expect, it } from "vitest";
import { type AnyEvent, createEvent } from "../src/event/Event.js";
import {
	createMultiPatternFilter,
	createPatternFilter,
	EventBus,
	EventBusError,
	EventBusLive,
	generateSubscriptionId,
	makeEventBusService,
	makeSubscriptionId,
} from "../src/event/EventBus.js";

describe("EventBus", () => {
	// =========================================================================
	// SubscriptionId
	// =========================================================================

	describe("SubscriptionId", () => {
		it("should generate unique subscription IDs", () => {
			const id1 = generateSubscriptionId();
			const id2 = generateSubscriptionId();

			expect(id1).not.toBe(id2);
			expect(typeof id1).toBe("string");
			expect(typeof id2).toBe("string");
		});

		it("should create subscription ID from string", () => {
			const id = makeSubscriptionId("test-sub-123");
			expect(id).toBe("test-sub-123");
		});

		it("should generate UUID-format IDs", () => {
			const id = generateSubscriptionId();
			// UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		});
	});

	// =========================================================================
	// EventBusError
	// =========================================================================

	describe("EventBusError", () => {
		it("should create error with SUBSCRIPTION_NOT_FOUND code", () => {
			const error = new EventBusError("SUBSCRIPTION_NOT_FOUND", "Sub not found");

			expect(error.code).toBe("SUBSCRIPTION_NOT_FOUND");
			expect(error.message).toBe("Sub not found");
			expect(error.name).toBe("EventBusError");
			expect(error._tag).toBe("EventBusError");
		});

		it("should create error with EMIT_FAILED code", () => {
			const error = new EventBusError("EMIT_FAILED", "Emit failed", new Error("cause"));

			expect(error.code).toBe("EMIT_FAILED");
			expect(error.message).toBe("Emit failed");
			expect(error.cause).toBeInstanceOf(Error);
		});

		it("should be instanceof Error", () => {
			const error = new EventBusError("EMIT_FAILED", "test");
			expect(error).toBeInstanceOf(Error);
		});
	});

	// =========================================================================
	// EventBus Context.Tag
	// =========================================================================

	describe("EventBus Context.Tag", () => {
		it("should have correct service identifier", () => {
			expect(EventBus.key).toBe("@core-v2/EventBus");
		});

		it("should be usable as Effect dependency", () => {
			const program = Effect.gen(function* () {
				const bus = yield* EventBus;
				return bus;
			});

			// This tests that the Effect type-checks correctly
			expect(program).toBeDefined();
		});
	});

	// =========================================================================
	// EventBusService - Basic Operations
	// =========================================================================

	describe("EventBusService", () => {
		const createTestEvent = (name: string): AnyEvent => createEvent(name, { test: true });

		describe("subscribe", () => {
			it("should return a subscription ID", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;
					const subId = yield* bus.subscribe(() => Effect.void);
					return subId;
				});

				const result = await Effect.runPromise(program);
				expect(typeof result).toBe("string");
				expect(result).toMatch(/^[0-9a-f-]+$/i);
			});

			it("should increment subscription count", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;

					const countBefore = yield* bus.subscriptionCount();
					yield* bus.subscribe(() => Effect.void);
					const countAfter = yield* bus.subscriptionCount();

					return { countBefore, countAfter };
				});

				const { countBefore, countAfter } = await Effect.runPromise(program);
				expect(countBefore).toBe(0);
				expect(countAfter).toBe(1);
			});

			it("should allow multiple subscriptions", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;

					yield* bus.subscribe(() => Effect.void);
					yield* bus.subscribe(() => Effect.void);
					yield* bus.subscribe(() => Effect.void);

					return yield* bus.subscriptionCount();
				});

				const count = await Effect.runPromise(program);
				expect(count).toBe(3);
			});
		});

		describe("unsubscribe", () => {
			it("should remove subscription", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;

					const subId = yield* bus.subscribe(() => Effect.void);
					const countAfterSub = yield* bus.subscriptionCount();

					yield* bus.unsubscribe(subId);
					const countAfterUnsub = yield* bus.subscriptionCount();

					return { countAfterSub, countAfterUnsub };
				});

				const { countAfterSub, countAfterUnsub } = await Effect.runPromise(program);
				expect(countAfterSub).toBe(1);
				expect(countAfterUnsub).toBe(0);
			});

			it("should be no-op for non-existent subscription", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;

					// Unsubscribe from non-existent ID should not throw
					yield* bus.unsubscribe(makeSubscriptionId("non-existent"));

					return yield* bus.subscriptionCount();
				});

				const count = await Effect.runPromise(program);
				expect(count).toBe(0);
			});

			it("should only remove the specified subscription", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;

					yield* bus.subscribe(() => Effect.void);
					const sub2 = yield* bus.subscribe(() => Effect.void);
					yield* bus.subscribe(() => Effect.void);

					yield* bus.unsubscribe(sub2);

					return yield* bus.subscriptionCount();
				});

				const count = await Effect.runPromise(program);
				expect(count).toBe(2);
			});
		});

		describe("emit", () => {
			it("should call subscriber callback", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;
					const receivedRef = yield* Ref.make<AnyEvent[]>([]);

					yield* bus.subscribe((event) => Ref.update(receivedRef, (events) => [...events, event]));

					const testEvent = createTestEvent("test:event");
					yield* bus.emit(testEvent);

					return yield* Ref.get(receivedRef);
				});

				const received = await Effect.runPromise(program);
				expect(received).toHaveLength(1);
				expect(received[0]?.name).toBe("test:event");
			});

			it("should call all subscribers", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;
					const counter = yield* Ref.make(0);

					// Add 3 subscribers
					yield* bus.subscribe(() => Ref.update(counter, (n) => n + 1));
					yield* bus.subscribe(() => Ref.update(counter, (n) => n + 1));
					yield* bus.subscribe(() => Ref.update(counter, (n) => n + 1));

					yield* bus.emit(createTestEvent("test:event"));

					return yield* Ref.get(counter);
				});

				const count = await Effect.runPromise(program);
				expect(count).toBe(3);
			});

			it("should not call unsubscribed callbacks", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;
					const counter = yield* Ref.make(0);

					const sub1 = yield* bus.subscribe(() => Ref.update(counter, (n) => n + 1));
					yield* bus.subscribe(() => Ref.update(counter, (n) => n + 1));

					// Unsubscribe first one
					yield* bus.unsubscribe(sub1);

					yield* bus.emit(createTestEvent("test:event"));

					return yield* Ref.get(counter);
				});

				const count = await Effect.runPromise(program);
				expect(count).toBe(1);
			});

			it("should emit to no one when no subscribers", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;

					// This should not throw
					yield* bus.emit(createTestEvent("test:event"));

					return true;
				});

				const result = await Effect.runPromise(program);
				expect(result).toBe(true);
			});
		});

		describe("filtering", () => {
			it("should only call matching subscribers when filter provided", async () => {
				const program = Effect.gen(function* () {
					const bus = yield* makeEventBusService;
					const errorEvents = yield* Ref.make<AnyEvent[]>([]);
					const allEvents = yield* Ref.make<AnyEvent[]>([]);

					// Subscriber with filter for error events only
					yield* bus.subscribe(
						(event) => Ref.update(errorEvents, (events) => [...events, event]),
						(event) => event.name.startsWith("error:"),
					);

					// Subscriber without filter (receives all)
					yield* bus.subscribe((event) => Ref.update(allEvents, (events) => [...events, event]));

					// Emit different types of events
					yield* bus.emit(createTestEvent("user:input"));
					yield* bus.emit(createTestEvent("error:occurred"));
					yield* bus.emit(createTestEvent("text:delta"));
					yield* bus.emit(createTestEvent("error:fatal"));

					return {
						errorEvents: yield* Ref.get(errorEvents),
						allEvents: yield* Ref.get(allEvents),
					};
				});

				const { errorEvents, allEvents } = await Effect.runPromise(program);
				expect(errorEvents).toHaveLength(2);
				expect(errorEvents.map((e) => e.name)).toEqual(["error:occurred", "error:fatal"]);
				expect(allEvents).toHaveLength(4);
			});
		});
	});

	// =========================================================================
	// Pattern Filters
	// =========================================================================

	describe("createPatternFilter", () => {
		const testEvent = (name: string): AnyEvent => createEvent(name, {});

		describe("exact match", () => {
			it("should match exact event name", () => {
				const filter = createPatternFilter("user:input");

				expect(filter(testEvent("user:input"))).toBe(true);
				expect(filter(testEvent("user:output"))).toBe(false);
				expect(filter(testEvent("text:delta"))).toBe(false);
			});
		});

		describe("catch-all (*)", () => {
			it("should match all events", () => {
				const filter = createPatternFilter("*");

				expect(filter(testEvent("user:input"))).toBe(true);
				expect(filter(testEvent("error:occurred"))).toBe(true);
				expect(filter(testEvent("anything:else"))).toBe(true);
			});
		});

		describe("wildcard suffix (prefix:*)", () => {
			it("should match events with given prefix", () => {
				const filter = createPatternFilter("error:*");

				expect(filter(testEvent("error:occurred"))).toBe(true);
				expect(filter(testEvent("error:fatal"))).toBe(true);
				expect(filter(testEvent("error:"))).toBe(true);
				expect(filter(testEvent("user:input"))).toBe(false);
				expect(filter(testEvent("errors:many"))).toBe(false);
			});

			it("should handle complex prefixes", () => {
				const filter = createPatternFilter("agent:tool:*");

				expect(filter(testEvent("agent:tool:called"))).toBe(true);
				expect(filter(testEvent("agent:tool:result"))).toBe(true);
				expect(filter(testEvent("agent:started"))).toBe(false);
			});
		});

		describe("wildcard prefix (*:suffix)", () => {
			it("should match events with given suffix", () => {
				const filter = createPatternFilter("*:completed");

				expect(filter(testEvent("task:completed"))).toBe(true);
				expect(filter(testEvent("agent:completed"))).toBe(true);
				expect(filter(testEvent("workflow:completed"))).toBe(true);
				expect(filter(testEvent("task:started"))).toBe(false);
			});

			it("should handle complex suffixes", () => {
				const filter = createPatternFilter("*:tool:result");

				expect(filter(testEvent("agent:tool:result"))).toBe(true);
				expect(filter(testEvent("workflow:tool:result"))).toBe(true);
				expect(filter(testEvent("tool:result"))).toBe(false);
			});
		});
	});

	describe("createMultiPatternFilter", () => {
		const testEvent = (name: string): AnyEvent => createEvent(name, {});

		it("should match if ANY pattern matches", () => {
			const filter = createMultiPatternFilter(["error:*", "user:input"]);

			expect(filter(testEvent("error:occurred"))).toBe(true);
			expect(filter(testEvent("error:fatal"))).toBe(true);
			expect(filter(testEvent("user:input"))).toBe(true);
			expect(filter(testEvent("text:delta"))).toBe(false);
		});

		it("should work with mixed pattern types", () => {
			const filter = createMultiPatternFilter(["exact:match", "prefix:*", "*:suffix"]);

			expect(filter(testEvent("exact:match"))).toBe(true);
			expect(filter(testEvent("prefix:anything"))).toBe(true);
			expect(filter(testEvent("any:suffix"))).toBe(true);
			expect(filter(testEvent("no:match"))).toBe(false);
		});

		it("should return false for empty patterns", () => {
			const filter = createMultiPatternFilter([]);

			expect(filter(testEvent("any:event"))).toBe(false);
		});
	});

	// =========================================================================
	// Effect Layer Integration
	// =========================================================================

	describe("EventBusLive Layer", () => {
		it("should provide EventBus service via Layer", async () => {
			const program = Effect.gen(function* () {
				const bus = yield* EventBus;
				const subId = yield* bus.subscribe(() => Effect.void);
				return typeof subId === "string";
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(EventBusLive)));
			expect(result).toBe(true);
		});

		it("should allow emitting and receiving events via Layer", async () => {
			const program = Effect.gen(function* () {
				const bus = yield* EventBus;
				const received = yield* Ref.make<string[]>([]);

				yield* bus.subscribe((event) => Ref.update(received, (names) => [...names, event.name]));

				yield* bus.emit(createEvent("test:one", {}));
				yield* bus.emit(createEvent("test:two", {}));

				return yield* Ref.get(received);
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(EventBusLive)));
			expect(result).toEqual(["test:one", "test:two"]);
		});

		it("should maintain separate state per Layer instance", async () => {
			// First program adds a subscriber
			const program1 = Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.subscribe(() => Effect.void);
				return yield* bus.subscriptionCount();
			});

			// Second program checks subscriber count (should be fresh)
			const program2 = Effect.gen(function* () {
				const bus = yield* EventBus;
				return yield* bus.subscriptionCount();
			});

			// Each Layer instance has its own state
			const result1 = await Effect.runPromise(program1.pipe(Effect.provide(EventBusLive)));
			const result2 = await Effect.runPromise(program2.pipe(Effect.provide(EventBusLive)));

			expect(result1).toBe(1);
			expect(result2).toBe(0); // Fresh instance
		});
	});

	// =========================================================================
	// Integration Tests
	// =========================================================================

	describe("integration", () => {
		it("should support complex subscription patterns", async () => {
			interface ResultsState {
				errors: string[];
				completions: string[];
				all: string[];
			}

			const program = Effect.gen(function* () {
				const bus = yield* makeEventBusService;
				const results = yield* Ref.make<ResultsState>({
					errors: [],
					completions: [],
					all: [],
				});

				// Error subscriber
				yield* bus.subscribe(
					(event) =>
						Ref.update(results, (r) => ({
							...r,
							errors: [...r.errors, event.name],
						})),
					createPatternFilter("error:*"),
				);

				// Completion subscriber
				yield* bus.subscribe(
					(event) =>
						Ref.update(results, (r) => ({
							...r,
							completions: [...r.completions, event.name],
						})),
					createPatternFilter("*:completed"),
				);

				// All events subscriber
				yield* bus.subscribe(
					(event) =>
						Ref.update(results, (r) => ({
							...r,
							all: [...r.all, event.name],
						})),
					createPatternFilter("*"),
				);

				// Emit various events
				yield* bus.emit(createEvent("user:input", {}));
				yield* bus.emit(createEvent("error:occurred", {}));
				yield* bus.emit(createEvent("task:completed", {}));
				yield* bus.emit(createEvent("agent:started", {}));
				yield* bus.emit(createEvent("error:completed", {})); // Matches both!

				return yield* Ref.get(results);
			});

			const results = await Effect.runPromise(program);

			expect(results.errors).toEqual(["error:occurred", "error:completed"]);
			expect(results.completions).toEqual(["task:completed", "error:completed"]);
			expect(results.all).toHaveLength(5);
		});

		it("should handle rapid emit/unsubscribe cycles", async () => {
			const program = Effect.gen(function* () {
				const bus = yield* makeEventBusService;
				const count = yield* Ref.make(0);

				// Subscribe, emit, unsubscribe in rapid succession
				for (let i = 0; i < 10; i++) {
					const subId = yield* bus.subscribe(() => Ref.update(count, (n) => n + 1));
					yield* bus.emit(createEvent(`event:${i}`, {}));
					yield* bus.unsubscribe(subId);
				}

				return {
					count: yield* Ref.get(count),
					subs: yield* bus.subscriptionCount(),
				};
			});

			const { count, subs } = await Effect.runPromise(program);
			expect(count).toBe(10); // Each emit was received
			expect(subs).toBe(0); // All unsubscribed
		});
	});
});
