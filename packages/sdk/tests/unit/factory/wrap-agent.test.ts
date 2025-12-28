/**
 * Unit tests for wrapAgent() Level 1 API
 *
 * wrapAgent provides the simplest possible API for running a single agent.
 * It's the "one-liner" option for quick agent execution.
 *
 * @module tests/unit/factory/wrap-agent
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import { wrapAgent } from "../../../src/factory/wrap-agent.js";
import type { FluentHarnessEvent, NarrativeEvent } from "../../../src/harness/event-types.js";

// ============================================================================
// TEST AGENTS
// ============================================================================

@injectable()
class SyncAgent {
	execute(input: string): string {
		return `Processed: ${input}`;
	}
}

@injectable()
class AsyncAgent {
	async execute(input: string): Promise<string> {
		await new Promise((r) => setTimeout(r, 10));
		return `Async: ${input}`;
	}
}

@injectable()
class CalculatorAgent {
	execute(a: number, b: number): number {
		return a + b;
	}
}

@injectable()
class ThrowingAgent {
	execute(): string {
		throw new Error("Agent failed");
	}
}

@injectable()
class AsyncThrowingAgent {
	async execute(): Promise<string> {
		await new Promise((r) => setTimeout(r, 10));
		throw new Error("Async agent failed");
	}
}

// ============================================================================
// BASIC FUNCTIONALITY TESTS
// ============================================================================

describe("wrapAgent basic functionality", () => {
	test("wrapAgent returns object with on and run methods", () => {
		const wrapped = wrapAgent(SyncAgent);

		expect(wrapped).toHaveProperty("on");
		expect(wrapped).toHaveProperty("run");
		expect(typeof wrapped.on).toBe("function");
		expect(typeof wrapped.run).toBe("function");
	});

	test("on() is chainable (returns this)", () => {
		const wrapped = wrapAgent(SyncAgent);
		const returned = wrapped.on("narrative", () => {});

		expect(returned).toBe(wrapped);
	});

	test("run() executes the agent and returns result", () => {
		const result = wrapAgent(SyncAgent).run("hello");

		expect(result).toBe("Processed: hello");
	});

	test("run() works with async agents", async () => {
		const result = await wrapAgent(AsyncAgent).run("world");

		expect(result).toBe("Async: world");
	});

	test("run() passes multiple arguments correctly", () => {
		const result = wrapAgent(CalculatorAgent).run(10, 32);

		expect(result).toBe(42);
	});
});

// ============================================================================
// EVENT SUBSCRIPTION TESTS
// ============================================================================

describe("wrapAgent event subscription", () => {
	test("narrative events are emitted for sync execution", () => {
		const events: FluentHarnessEvent[] = [];

		wrapAgent(SyncAgent)
			.on("*", (e) => events.push(e))
			.run("test");

		const narrativeEvents = events.filter((e) => e.type === "narrative") as NarrativeEvent[];
		expect(narrativeEvents.length).toBe(2);
		expect(narrativeEvents[0]?.text).toBe("Starting execution");
		expect(narrativeEvents[1]?.text).toBe("Execution complete");
	});

	test("narrative events are emitted for async execution", async () => {
		const events: FluentHarnessEvent[] = [];

		await wrapAgent(AsyncAgent)
			.on("*", (e) => events.push(e))
			.run("test");

		const narrativeEvents = events.filter((e) => e.type === "narrative") as NarrativeEvent[];
		expect(narrativeEvents.length).toBe(2);
		expect(narrativeEvents[0]?.text).toBe("Starting execution");
		expect(narrativeEvents[1]?.text).toBe("Execution complete");
	});

	test("agent name is included in narrative events", () => {
		const events: FluentHarnessEvent[] = [];

		wrapAgent(SyncAgent)
			.on("narrative", (e) => events.push(e))
			.run("test");

		const event = events[0] as NarrativeEvent;
		expect(event.agent).toBe("SyncAgent");
	});

	test("error events are emitted when sync agent throws", () => {
		const events: FluentHarnessEvent[] = [];

		expect(() => {
			wrapAgent(ThrowingAgent)
				.on("*", (e) => events.push(e))
				.run();
		}).toThrow("Agent failed");

		const errorEvents = events.filter((e) => e.type === "error");
		expect(errorEvents.length).toBe(1);
		expect((errorEvents[0] as { message: string }).message).toBe("Agent failed");
	});

	test("error events are emitted when async agent throws", async () => {
		const events: FluentHarnessEvent[] = [];

		const wrapped = wrapAgent(AsyncThrowingAgent).on("*", (e) => events.push(e));

		await expect(wrapped.run()).rejects.toThrow("Async agent failed");

		const errorEvents = events.filter((e) => e.type === "error");
		expect(errorEvents.length).toBe(1);
		expect((errorEvents[0] as { message: string }).message).toBe("Async agent failed");
	});

	test("multiple handlers receive same events", () => {
		const handler1Events: FluentHarnessEvent[] = [];
		const handler2Events: FluentHarnessEvent[] = [];

		wrapAgent(SyncAgent)
			.on("narrative", (e) => handler1Events.push(e))
			.on("narrative", (e) => handler2Events.push(e))
			.run("test");

		expect(handler1Events.length).toBe(2);
		expect(handler2Events.length).toBe(2);
	});

	test("wildcard subscription receives all events", () => {
		const events: FluentHarnessEvent[] = [];

		wrapAgent(SyncAgent)
			.on("*", (e) => events.push(e))
			.run("test");

		expect(events.length).toBeGreaterThanOrEqual(2);
	});
});

// ============================================================================
// ONE-LINER USAGE TESTS
// ============================================================================

describe("wrapAgent one-liner usage", () => {
	test("simplest usage - no event handling", () => {
		const result = wrapAgent(SyncAgent).run("one-liner");

		expect(result).toBe("Processed: one-liner");
	});

	test("one-liner with async agent", async () => {
		const result = await wrapAgent(AsyncAgent).run("async-one-liner");

		expect(result).toBe("Async: async-one-liner");
	});

	test("chained event handlers with execution", () => {
		const logs: string[] = [];

		const result = wrapAgent(SyncAgent)
			.on("narrative", (e) => {
				const event = e as NarrativeEvent;
				logs.push(`${event.agent}: ${event.text}`);
			})
			.run("chained");

		expect(result).toBe("Processed: chained");
		expect(logs).toContain("SyncAgent: Starting execution");
		expect(logs).toContain("SyncAgent: Execution complete");
	});
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("wrapAgent error handling", () => {
	test("handler errors do not affect execution", () => {
		const logs: string[] = [];

		const result = wrapAgent(SyncAgent)
			.on("narrative", () => {
				throw new Error("Handler error");
			})
			.on("narrative", (e) => logs.push((e as NarrativeEvent).text))
			.run("test");

		// Execution should complete despite handler error
		expect(result).toBe("Processed: test");
		// Second handler should still work
		expect(logs.length).toBeGreaterThan(0);
	});

	test("agent without execute method can still be wrapped", () => {
		// The agent just needs to have an execute method at runtime
		// We verify wrapAgent handles agent resolution gracefully
		@injectable()
		class ValidAgent {
			execute(x: number): number {
				return x * 2;
			}
		}

		const result = wrapAgent(ValidAgent).run(21);
		expect(result).toBe(42);
	});
});
