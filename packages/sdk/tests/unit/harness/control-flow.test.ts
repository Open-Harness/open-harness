/**
 * Unit tests for control flow helpers (retry, parallel)
 *
 * User Story 4: Separation of Concerns
 * Goal: execute() contains only business logic, rendering handled externally
 *
 * Tests verify that control flow helpers emit correct events following
 * the Contextual Event Wrapper Pattern.
 *
 * @module tests/unit/harness/control-flow
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import { defineHarness } from "../../../src/factory/define-harness.js";
import type {
	FluentHarnessEvent,
	ParallelCompleteEvent,
	ParallelItemCompleteEvent,
	ParallelStartEvent,
	RetryAttemptEvent,
	RetryBackoffEvent,
	RetryFailureEvent,
	RetryStartEvent,
	RetrySuccessEvent,
} from "../../../src/harness/event-types.js";

// Simple test agent
@injectable()
class TestAgent {
	execute(): string {
		return "done";
	}
}

// ============================================================================
// RETRY HELPER TESTS
// ============================================================================

describe("retry helper", () => {
	test("emits retry:start event before first attempt", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				await retry("test-op", async () => "success");
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const startEvent = events.find((e) => e.type === "retry:start") as RetryStartEvent;
		expect(startEvent).toBeDefined();
		expect(startEvent.name).toBe("test-op");
		expect(startEvent.maxAttempts).toBe(3); // default
	});

	test("emits retry:attempt event for each attempt", async () => {
		const events: FluentHarnessEvent[] = [];
		let attemptCount = 0;

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				await retry(
					"test-op",
					async () => {
						attemptCount++;
						if (attemptCount < 2) {
							throw new Error("Fail");
						}
						return "success";
					},
					{ retries: 3, minTimeout: 10, maxTimeout: 50 },
				);
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const attemptEvents = events.filter((e) => e.type === "retry:attempt") as RetryAttemptEvent[];
		expect(attemptEvents.length).toBe(2); // 2 attempts to succeed
		expect(attemptEvents[0]?.attempt).toBe(1);
		expect(attemptEvents[1]?.attempt).toBe(2);
	});

	test("emits retry:success event on successful completion", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				await retry("test-op", async () => "success-value");
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const successEvent = events.find((e) => e.type === "retry:success") as RetrySuccessEvent;
		expect(successEvent).toBeDefined();
		expect(successEvent.name).toBe("test-op");
		expect(successEvent.attempt).toBe(1);
		expect(successEvent.result).toBe("success-value");
	});

	test("emits retry:backoff event before waiting between attempts", async () => {
		const events: FluentHarnessEvent[] = [];
		let attemptCount = 0;

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				await retry(
					"test-op",
					async () => {
						attemptCount++;
						if (attemptCount < 2) {
							throw new Error("Fail");
						}
						return "success";
					},
					{ retries: 3, minTimeout: 10, maxTimeout: 50 },
				);
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const backoffEvent = events.find((e) => e.type === "retry:backoff") as RetryBackoffEvent;
		expect(backoffEvent).toBeDefined();
		expect(backoffEvent.name).toBe("test-op");
		expect(backoffEvent.attempt).toBe(1);
		expect(backoffEvent.delay).toBeGreaterThan(0);
		expect(backoffEvent.error).toBe("Fail");
	});

	test("emits retry:failure event when all attempts exhausted", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				try {
					await retry(
						"test-op",
						async () => {
							throw new Error("Always fails");
						},
						{ retries: 2, minTimeout: 10, maxTimeout: 50 },
					);
				} catch {
					// Expected to fail
				}
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const failureEvent = events.find((e) => e.type === "retry:failure") as RetryFailureEvent;
		expect(failureEvent).toBeDefined();
		expect(failureEvent.name).toBe("test-op");
		expect(failureEvent.attempts).toBe(2);
		expect(failureEvent.error).toBe("Always fails");
	});

	test("retry throws error after all attempts exhausted", async () => {
		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				await retry(
					"test-op",
					async () => {
						throw new Error("Always fails");
					},
					{ retries: 2, minTimeout: 10, maxTimeout: 50 },
				);
				return "done";
			},
		});

		const result = Factory.create(undefined).run();
		await expect(result).rejects.toThrow("Always fails");
	});

	test("retry respects exponential backoff", async () => {
		const events: FluentHarnessEvent[] = [];
		let attemptCount = 0;

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ retry }) => {
				await retry(
					"test-op",
					async () => {
						attemptCount++;
						if (attemptCount < 3) {
							throw new Error("Fail");
						}
						return "success";
					},
					{ retries: 3, minTimeout: 100, maxTimeout: 1000 },
				);
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const backoffEvents = events.filter((e) => e.type === "retry:backoff") as RetryBackoffEvent[];
		expect(backoffEvents.length).toBe(2);

		// First backoff: minTimeout * 2^0 = 100
		expect(backoffEvents[0]?.delay).toBe(100);
		// Second backoff: minTimeout * 2^1 = 200
		expect(backoffEvents[1]?.delay).toBe(200);
	});
});

// ============================================================================
// PARALLEL HELPER TESTS
// ============================================================================

describe("parallel helper", () => {
	test("emits parallel:start event before execution", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ parallel }) => {
				await parallel("test-batch", [async () => "a", async () => "b", async () => "c"]);
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const startEvent = events.find((e) => e.type === "parallel:start") as ParallelStartEvent;
		expect(startEvent).toBeDefined();
		expect(startEvent.name).toBe("test-batch");
		expect(startEvent.total).toBe(3);
		expect(startEvent.concurrency).toBe(5); // default
	});

	test("emits parallel:item:complete event for each item", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ parallel }) => {
				await parallel("test-batch", [async () => "a", async () => "b", async () => "c"]);
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const itemEvents = events.filter((e) => e.type === "parallel:item:complete") as ParallelItemCompleteEvent[];
		expect(itemEvents.length).toBe(3);

		// All items should have been completed
		const completedCounts = itemEvents.map((e) => e.completed);
		expect(completedCounts).toContain(1);
		expect(completedCounts).toContain(2);
		expect(completedCounts).toContain(3);
	});

	test("emits parallel:complete event after all items finish", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ parallel }) => {
				await parallel("test-batch", [async () => "a", async () => "b"]);
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		const completeEvent = events.find((e) => e.type === "parallel:complete") as ParallelCompleteEvent;
		expect(completeEvent).toBeDefined();
		expect(completeEvent.name).toBe("test-batch");
		expect(completeEvent.total).toBe(2);
	});

	test("parallel returns results in original order", async () => {
		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ parallel }) => {
				const results = await parallel("test-batch", [
					async () => {
						await new Promise((r) => setTimeout(r, 50));
						return "slow";
					},
					async () => {
						await new Promise((r) => setTimeout(r, 10));
						return "fast";
					},
					async () => "instant",
				]);
				return results;
			},
		});

		const result = await Factory.create(undefined).run();

		// Results should be in original order, not completion order
		expect(result.result).toEqual(["slow", "fast", "instant"]);
	});

	test("parallel respects concurrency limit", async () => {
		let maxConcurrent = 0;
		let currentConcurrent = 0;

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ parallel }) => {
				await parallel(
					"test-batch",
					[
						async () => {
							currentConcurrent++;
							maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
							await new Promise((r) => setTimeout(r, 50));
							currentConcurrent--;
							return "a";
						},
						async () => {
							currentConcurrent++;
							maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
							await new Promise((r) => setTimeout(r, 50));
							currentConcurrent--;
							return "b";
						},
						async () => {
							currentConcurrent++;
							maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
							await new Promise((r) => setTimeout(r, 50));
							currentConcurrent--;
							return "c";
						},
						async () => {
							currentConcurrent++;
							maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
							await new Promise((r) => setTimeout(r, 50));
							currentConcurrent--;
							return "d";
						},
					],
					{ concurrency: 2 },
				);
				return maxConcurrent;
			},
		});

		const result = await Factory.create(undefined).run();

		// Should never exceed concurrency limit of 2
		expect(result.result).toBeLessThanOrEqual(2);
	});

	test("parallel handles empty array", async () => {
		const events: FluentHarnessEvent[] = [];

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ parallel }) => {
				const results = await parallel("empty-batch", []);
				return results;
			},
		});

		const result = await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		expect(result.result).toEqual([]);

		// Should still emit start and complete events
		const startEvent = events.find((e) => e.type === "parallel:start");
		const completeEvent = events.find((e) => e.type === "parallel:complete");
		expect(startEvent).toBeDefined();
		expect(completeEvent).toBeDefined();
	});
});

// ============================================================================
// SEPARATION OF CONCERNS TESTS
// ============================================================================

describe("US4: Separation of Concerns", () => {
	test("business logic in run() emits structured events for external rendering", async () => {
		const events: FluentHarnessEvent[] = [];

		// Business logic workflow
		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ phase, task, retry, parallel }) => {
				await phase("initialization", async () => {
					await task("load-config", async () => "config-loaded");
				});

				await phase("processing", async () => {
					// Retry with backoff
					await retry(
						"fetch-data",
						async () => "data",
						{ retries: 1, minTimeout: 10, maxTimeout: 50 },
					);

					// Parallel processing
					await parallel("process-items", [async () => "item1", async () => "item2"]);
				});

				return "workflow-complete";
			},
		});

		const result = await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		// Verify structured events were emitted
		const eventTypes = [...new Set(events.map((e) => e.type))];

		// All expected event types should be present
		expect(eventTypes).toContain("phase");
		expect(eventTypes).toContain("task");
		expect(eventTypes).toContain("retry:start");
		expect(eventTypes).toContain("retry:attempt");
		expect(eventTypes).toContain("retry:success");
		expect(eventTypes).toContain("parallel:start");
		expect(eventTypes).toContain("parallel:item:complete");
		expect(eventTypes).toContain("parallel:complete");

		expect(result.result).toBe("workflow-complete");
	});

	test("external handler can render events without modifying business logic", async () => {
		const renderedOutput: string[] = [];

		// Simple renderer (simulates external UI)
		const renderer = (event: FluentHarnessEvent) => {
			if (event.type === "phase") {
				const e = event as { name: string; status: string };
				renderedOutput.push(`[PHASE] ${e.name}: ${e.status}`);
			} else if (event.type === "task") {
				const e = event as { id: string; status: string };
				renderedOutput.push(`[TASK] ${e.id}: ${e.status}`);
			}
		};

		const Factory = defineHarness({
			agents: { test: TestAgent },
			run: async ({ phase, task }) => {
				await phase("setup", async () => {
					await task("init", async () => "done");
				});
				return "complete";
			},
		});

		await Factory.create(undefined).on("*", renderer).run();

		// External renderer captured structured output
		expect(renderedOutput).toContain("[PHASE] setup: start");
		expect(renderedOutput).toContain("[TASK] init: start");
		expect(renderedOutput).toContain("[TASK] init: complete");
		expect(renderedOutput).toContain("[PHASE] setup: complete");
	});
});
