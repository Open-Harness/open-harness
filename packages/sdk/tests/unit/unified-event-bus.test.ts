/**
 * Unit Tests for UnifiedEventBus
 *
 * Tests cover:
 * - Context inheritance in scoped() (T013)
 * - Nested scopes merge correctly (T014)
 * - emit() auto-attaches context from AsyncLocalStorage (T015)
 * - Filter matching (T026-T028)
 * - EnrichedEvent structure (T046-T047)
 * - Scoped context helpers (T051-T053)
 * - Edge cases (T056-T060)
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { UnifiedEventBus } from "../../src/core/unified-event-bus.js";
import type { EnrichedEvent, EventContext } from "../../src/core/unified-events/types.js";

describe("UnifiedEventBus", () => {
	let bus: UnifiedEventBus;

	beforeEach(() => {
		bus = new UnifiedEventBus();
	});

	afterEach(() => {
		bus.clear();
	});

	// =========================================================================
	// T013: Context inheritance in scoped()
	// =========================================================================
	describe("T013: context inheritance in scoped()", () => {
		test("scoped() creates context that can be retrieved with current()", () => {
			const result = bus.scoped({ phase: { name: "Setup", number: 1 } }, () => {
				return bus.current();
			}) as EventContext;

			expect(result.phase).toEqual({ name: "Setup", number: 1 });
			expect(result.sessionId).toBeDefined();
		});

		test("context inherits sessionId from bus", () => {
			const outsideContext = bus.current();
			const insideContext = bus.scoped({}, () => bus.current()) as EventContext;

			expect(insideContext.sessionId).toBe(outsideContext.sessionId);
		});

		test("scoped() works with async functions", async () => {
			const result = await bus.scoped({ task: { id: "T001" } }, async () => {
				await Promise.resolve(); // Simulate async work
				return bus.current();
			});

			expect(result.task).toEqual({ id: "T001" });
		});

		test("context is isolated after scope exits", () => {
			bus.scoped({ phase: { name: "Setup" } }, () => {
				expect(bus.current().phase?.name).toBe("Setup");
			});

			// Outside scope, phase should be undefined
			expect(bus.current().phase).toBeUndefined();
		});
	});

	// =========================================================================
	// T014: Nested scopes merge context correctly
	// =========================================================================
	describe("T014: nested scopes merge context correctly", () => {
		test("nested scopes inherit parent context", () => {
			bus.scoped({ phase: { name: "Setup" } }, () => {
				bus.scoped({ task: { id: "T001" } }, () => {
					const ctx = bus.current();
					expect(ctx.phase?.name).toBe("Setup");
					expect(ctx.task?.id).toBe("T001");
				});
			});
		});

		test("inner scope can override outer scope values", () => {
			bus.scoped({ phase: { name: "Setup", number: 1 } }, () => {
				bus.scoped({ phase: { name: "Execution", number: 2 } }, () => {
					const ctx = bus.current();
					expect(ctx.phase?.name).toBe("Execution");
					expect(ctx.phase?.number).toBe(2);
				});
			});
		});

		test("three levels of nesting works correctly", async () => {
			await bus.scoped({ phase: { name: "Init" } }, async () => {
				await bus.scoped({ task: { id: "T001" } }, async () => {
					await bus.scoped({ agent: { name: "CodingAgent" } }, async () => {
						const ctx = bus.current();
						expect(ctx.phase?.name).toBe("Init");
						expect(ctx.task?.id).toBe("T001");
						expect(ctx.agent?.name).toBe("CodingAgent");
					});
				});
			});
		});

		test("inner scope value does not leak to outer scope", () => {
			bus.scoped({ phase: { name: "Setup" } }, () => {
				bus.scoped({ task: { id: "T001" } }, () => {
					// Inside inner scope
				});
				// After inner scope exits, task should be gone but phase remains
				const ctx = bus.current();
				expect(ctx.phase?.name).toBe("Setup");
				expect(ctx.task).toBeUndefined();
			});
		});
	});

	// =========================================================================
	// T015: emit() auto-attaches context from AsyncLocalStorage
	// =========================================================================
	describe("T015: emit() auto-attaches context from AsyncLocalStorage", () => {
		test("emit() wraps event in EnrichedEvent with context", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.scoped({ task: { id: "T001" } }, () => {
				bus.emit({ type: "task:start", taskId: "T001" });
			});

			expect(events).toHaveLength(1);
			expect(events[0]?.context.task?.id).toBe("T001");
			expect(events[0]?.event.type).toBe("task:start");
		});

		test("emit() includes sessionId in context", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.emit({ type: "harness:start", sessionId: "test", mode: "live", taskCount: 5 });

			expect(events[0]?.context.sessionId).toBeDefined();
			expect(events[0]?.context.sessionId).toBe(bus.current().sessionId);
		});

		test("emit() with override merges with inherited context", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.scoped({ phase: { name: "Setup" } }, () => {
				bus.emit({ type: "narrative", text: "Working...", importance: "detailed" }, { agent: { name: "TestAgent" } });
			});

			expect(events[0]?.context.phase?.name).toBe("Setup");
			expect(events[0]?.context.agent?.name).toBe("TestAgent");
		});

		test("emit() generates unique event ID", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.emit({ type: "narrative", text: "First", importance: "detailed" });
			bus.emit({ type: "narrative", text: "Second", importance: "detailed" });

			expect(events[0]?.id).not.toBe(events[1]?.id);
			// Validate UUID format
			expect(events[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		});

		test("emit() includes timestamp", () => {
			const events: EnrichedEvent[] = [];
			const before = new Date();

			bus.subscribe((e) => {
				events.push(e);
			});
			bus.emit({ type: "narrative", text: "Test", importance: "detailed" });

			const after = new Date();
			expect(events[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(events[0]?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// =========================================================================
	// T022: AsyncLocalStorage isolation in Promise.all()
	// =========================================================================
	describe("T022: AsyncLocalStorage isolation in Promise.all()", () => {
		test("parallel scopes maintain isolated context", async () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			await Promise.all([
				bus.scoped({ task: { id: "T001" } }, async () => {
					await new Promise((r) => setTimeout(r, 10));
					bus.emit({ type: "task:start", taskId: "T001" });
				}),
				bus.scoped({ task: { id: "T002" } }, async () => {
					await new Promise((r) => setTimeout(r, 5));
					bus.emit({ type: "task:start", taskId: "T002" });
				}),
				bus.scoped({ task: { id: "T003" } }, async () => {
					await new Promise((r) => setTimeout(r, 15));
					bus.emit({ type: "task:start", taskId: "T003" });
				}),
			]);

			// All events should have their respective task context
			const t001Events = events.filter((e) => e.context.task?.id === "T001");
			const t002Events = events.filter((e) => e.context.task?.id === "T002");
			const t003Events = events.filter((e) => e.context.task?.id === "T003");

			expect(t001Events).toHaveLength(1);
			expect(t002Events).toHaveLength(1);
			expect(t003Events).toHaveLength(1);
		});
	});

	// =========================================================================
	// T026-T028: subscribe() filter matching
	// =========================================================================
	describe("T026: subscribe('*') receives all event types", () => {
		test("wildcard subscription receives all events", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe("*", (e) => {
				events.push(e);
			});

			bus.emit({ type: "task:start", taskId: "T001" });
			bus.emit({ type: "agent:thinking", content: "..." });
			bus.emit({ type: "narrative", text: "Hello", importance: "detailed" });

			expect(events).toHaveLength(3);
		});

		test("subscribe without filter defaults to wildcard", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.emit({ type: "task:start", taskId: "T001" });
			bus.emit({ type: "agent:thinking", content: "..." });

			expect(events).toHaveLength(2);
		});
	});

	describe("T027: subscribe with type filter works", () => {
		test("prefix filter matches event family", () => {
			const taskEvents: EnrichedEvent[] = [];
			const agentEvents: EnrichedEvent[] = [];

			bus.subscribe("task:*", (e) => {
				taskEvents.push(e);
			});
			bus.subscribe("agent:*", (e) => {
				agentEvents.push(e);
			});

			bus.emit({ type: "task:start", taskId: "T001" });
			bus.emit({ type: "task:complete", taskId: "T001" });
			bus.emit({ type: "agent:thinking", content: "..." });

			expect(taskEvents).toHaveLength(2);
			expect(agentEvents).toHaveLength(1);
		});

		test("exact match filter only matches specific event", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe("task:start", (e) => {
				events.push(e);
			});

			bus.emit({ type: "task:start", taskId: "T001" });
			bus.emit({ type: "task:complete", taskId: "T001" });

			expect(events).toHaveLength(1);
			expect(events[0]?.event.type).toBe("task:start");
		});

		test("array of patterns matches any pattern", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe(["task:start", "task:complete"], (e) => {
				events.push(e);
			});

			bus.emit({ type: "task:start", taskId: "T001" });
			bus.emit({ type: "task:complete", taskId: "T001" });
			bus.emit({ type: "task:failed", taskId: "T002", error: "Failed" });

			expect(events).toHaveLength(2);
		});
	});

	describe("T028: multiple subscribers receive same event", () => {
		test("all matching subscribers receive event", () => {
			const subscriber1Events: EnrichedEvent[] = [];
			const subscriber2Events: EnrichedEvent[] = [];
			const subscriber3Events: EnrichedEvent[] = [];

			bus.subscribe((e) => {
				subscriber1Events.push(e);
			});
			bus.subscribe("task:*", (e) => {
				subscriber2Events.push(e);
			});
			bus.subscribe("task:start", (e) => {
				subscriber3Events.push(e);
			});

			bus.emit({ type: "task:start", taskId: "T001" });

			expect(subscriber1Events).toHaveLength(1);
			expect(subscriber2Events).toHaveLength(1);
			expect(subscriber3Events).toHaveLength(1);
		});
	});

	// =========================================================================
	// T046-T047: EnrichedEvent structure
	// =========================================================================
	describe("T046: EnrichedEvent has id, timestamp, context, event", () => {
		test("enriched event contains all required fields", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.emit({ type: "narrative", text: "Test", importance: "critical" });

			const enriched = events[0];
			expect(enriched).toHaveProperty("id");
			expect(enriched).toHaveProperty("timestamp");
			expect(enriched).toHaveProperty("context");
			expect(enriched).toHaveProperty("event");
		});
	});

	describe("T047: event.id is valid UUID", () => {
		test("event ID matches UUID format", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			for (let i = 0; i < 10; i++) {
				bus.emit({ type: "narrative", text: `Event ${i}`, importance: "detailed" });
			}

			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
			for (const e of events) {
				expect(e.id).toMatch(uuidRegex);
			}

			// All IDs should be unique
			const ids = events.map((e) => e.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(10);
		});
	});

	// =========================================================================
	// T048: context override merges with inherited
	// =========================================================================
	describe("T048: context override merges with inherited (override wins)", () => {
		test("override replaces specific fields while preserving others", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.scoped({ phase: { name: "Setup" }, task: { id: "T001" } }, () => {
				// Override task but keep phase
				bus.emit({ type: "narrative", text: "Test", importance: "detailed" }, { task: { id: "T999" } });
			});

			expect(events[0]?.context.phase?.name).toBe("Setup");
			expect(events[0]?.context.task?.id).toBe("T999");
		});
	});

	// =========================================================================
	// T051-T053: Scoped context helpers
	// =========================================================================
	describe("T051: custom context fields preserved in scope", () => {
		test("custom context persists through async operations", async () => {
			const result = await bus.scoped({ agent: { name: "CustomAgent", type: "custom" } }, async () => {
				await Promise.resolve();
				await new Promise((r) => setTimeout(r, 10));
				return bus.current();
			});

			expect(result.agent?.name).toBe("CustomAgent");
			expect(result.agent?.type).toBe("custom");
		});
	});

	describe("T052: nested scopes override correctly", () => {
		test("deeply nested overrides work properly", () => {
			bus.scoped({ phase: { name: "P1" } }, () => {
				expect(bus.current().phase?.name).toBe("P1");

				bus.scoped({ phase: { name: "P2" } }, () => {
					expect(bus.current().phase?.name).toBe("P2");

					bus.scoped({ phase: { name: "P3" } }, () => {
						expect(bus.current().phase?.name).toBe("P3");
					});

					// Back to P2
					expect(bus.current().phase?.name).toBe("P2");
				});

				// Back to P1
				expect(bus.current().phase?.name).toBe("P1");
			});
		});
	});

	describe("T053: scope that throws still reverts context", () => {
		test("context reverts even when function throws synchronously", () => {
			try {
				bus.scoped({ task: { id: "THROW" } }, () => {
					throw new Error("Intentional error");
				});
			} catch {
				// Expected
			}

			// Context should be reverted
			expect(bus.current().task).toBeUndefined();
		});

		test("context reverts even when async function throws", async () => {
			try {
				await bus.scoped({ task: { id: "ASYNC_THROW" } }, async () => {
					await Promise.resolve();
					throw new Error("Async error");
				});
			} catch {
				// Expected
			}

			// Context should be reverted
			expect(bus.current().task).toBeUndefined();
		});
	});

	// =========================================================================
	// T056-T060: Edge cases
	// =========================================================================
	describe("T056: empty context returns only sessionId", () => {
		test("current() with no scope returns minimal context", () => {
			const ctx = bus.current();
			expect(ctx.sessionId).toBeDefined();
			expect(ctx.phase).toBeUndefined();
			expect(ctx.task).toBeUndefined();
			expect(ctx.agent).toBeUndefined();
		});
	});

	describe("T057: listener throws logs error, other listeners still called", () => {
		test("throwing listener does not prevent other listeners from receiving event", () => {
			const events: EnrichedEvent[] = [];

			// First listener throws
			bus.subscribe(() => {
				throw new Error("Listener error");
			});

			// Second listener should still be called
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.emit({ type: "narrative", text: "Test", importance: "detailed" });

			expect(events).toHaveLength(1);
		});
	});

	describe("T058: emit after clear() succeeds but no delivery", () => {
		test("emit works after clear but delivers to no subscribers", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe((e) => {
				events.push(e);
			});

			bus.clear();

			// This should not throw
			bus.emit({ type: "narrative", text: "Test", importance: "detailed" });

			expect(events).toHaveLength(0);
		});
	});

	describe("T059: invalid filter never matches", () => {
		test("empty string filter does not match any events", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe("", (e) => {
				events.push(e);
			});

			bus.emit({ type: "narrative", text: "Test", importance: "detailed" });
			bus.emit({ type: "task:start", taskId: "T001" });

			expect(events).toHaveLength(0);
		});

		test("non-matching prefix filter receives no events", () => {
			const events: EnrichedEvent[] = [];
			bus.subscribe("nonexistent:*", (e) => {
				events.push(e);
			});

			bus.emit({ type: "narrative", text: "Test", importance: "detailed" });
			bus.emit({ type: "task:start", taskId: "T001" });

			expect(events).toHaveLength(0);
		});
	});

	// =========================================================================
	// clear() and subscriberCount
	// =========================================================================
	describe("clear() and subscriberCount", () => {
		test("subscriberCount reflects active subscribers", () => {
			expect(bus.subscriberCount).toBe(0);

			const unsub1 = bus.subscribe(() => {});
			expect(bus.subscriberCount).toBe(1);

			const unsub2 = bus.subscribe("task:*", () => {});
			expect(bus.subscriberCount).toBe(2);

			unsub1();
			expect(bus.subscriberCount).toBe(1);

			unsub2();
			expect(bus.subscriberCount).toBe(0);
		});

		test("clear() removes all subscribers", () => {
			bus.subscribe(() => {});
			bus.subscribe(() => {});
			bus.subscribe(() => {});

			expect(bus.subscriberCount).toBe(3);

			bus.clear();
			expect(bus.subscriberCount).toBe(0);
		});

		test("unsubscribe function works correctly", () => {
			const events: EnrichedEvent[] = [];
			const unsub = bus.subscribe((e) => {
				events.push(e);
			});

			bus.emit({ type: "narrative", text: "Before", importance: "detailed" });
			unsub();
			bus.emit({ type: "narrative", text: "After", importance: "detailed" });

			expect(events).toHaveLength(1);
			expect((events[0]?.event as { text: string } | undefined)?.text).toBe("Before");
		});
	});
});
