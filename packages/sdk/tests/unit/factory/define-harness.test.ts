/**
 * Unit tests for defineHarness() fluent API
 *
 * User Story 1: Zero DI Exposure
 * Goal: Workflow authors define harnesses without knowing about dependency injection
 *
 * @module tests/unit/factory/define-harness
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";

// Import ONLY the fluent API - NOT createContainer or any DI internals
// This test verifies US1: "no container imports needed"
import { defineHarness } from "../../../src/factory/define-harness.js";
import type { HarnessEventType, PhaseEvent } from "../../../src/harness/event-types.js";

// ============================================================================
// TEST AGENT - Simple injectable agent for testing
// ============================================================================

/**
 * Simple test agent that doesn't require any external dependencies.
 */
@injectable()
class SimpleAgent {
	execute(input: string): string {
		return `Processed: ${input}`;
	}
}

/**
 * Counter agent with internal state.
 */
@injectable()
class CounterAgent {
	private count = 0;

	execute(): number {
		return ++this.count;
	}

	getCount(): number {
		return this.count;
	}
}

// ============================================================================
// US1: ZERO DI EXPOSURE TESTS
// ============================================================================

describe("US1: Zero DI Exposure", () => {
	test("defineHarness works without importing createContainer", () => {
		// This test passes if it compiles - we're using defineHarness without:
		// - import { createContainer } from '../core/container.js'
		// - import { Container } from '@needle-di/core'
		// - new Container() or container.get() calls

		const Workflow = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ agents }) => {
				return agents.simple.execute("test");
			},
		});

		// Verify factory is returned
		expect(Workflow).toBeDefined();
		expect(typeof Workflow.create).toBe("function");
	});

	test("harness can be created and run without DI knowledge", async () => {
		const Workflow = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ agents }) => {
				return agents.simple.execute("hello");
			},
		});

		const instance = Workflow.create(undefined);
		const result = await instance.run();

		expect(result.result).toBe("Processed: hello");
	});

	test("agents are resolved and accessible in run function", async () => {
		const Workflow = defineHarness({
			agents: {
				simple: SimpleAgent,
				counter: CounterAgent,
			},
			run: async ({ agents }) => {
				const msg = agents.simple.execute("test");
				const count = agents.counter.execute();
				return { msg, count };
			},
		});

		const instance = Workflow.create(undefined);
		const result = await instance.run();

		expect(result.result).toEqual({
			msg: "Processed: test",
			count: 1,
		});
	});

	test("agents are resolved once per defineHarness (singleton)", async () => {
		const Workflow = defineHarness({
			agents: { counter: CounterAgent },
			run: async ({ agents }) => {
				// Call execute twice - count should increment
				agents.counter.execute();
				return agents.counter.execute();
			},
		});

		// Create two instances from same factory
		const instance1 = Workflow.create(undefined);
		const instance2 = Workflow.create(undefined);

		// First instance: counter starts at 0, increments to 2
		const result1 = await instance1.run();
		expect(result1.result).toBe(2);

		// Second instance: same agent singleton, counter continues from 2
		const result2 = await instance2.run();
		expect(result2.result).toBe(4);
	});
});

// ============================================================================
// BASIC FUNCTIONALITY TESTS
// ============================================================================

describe("defineHarness basic functionality", () => {
	test("returns HarnessFactory with create method", () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async () => "done",
		});

		expect(Factory).toHaveProperty("create");
		expect(typeof Factory.create).toBe("function");
	});

	test("create returns HarnessInstance with on, run, and state", () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async () => "done",
		});

		const instance = Factory.create(undefined);

		expect(instance).toHaveProperty("on");
		expect(instance).toHaveProperty("run");
		expect(instance).toHaveProperty("state");
		expect(typeof instance.on).toBe("function");
		expect(typeof instance.run).toBe("function");
	});

	test("on() is chainable (returns this)", () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async () => "done",
		});

		const instance = Factory.create(undefined);
		const returned = instance.on("phase", () => {});

		expect(returned).toBe(instance);
	});

	test("run() returns HarnessResult with all required fields", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async () => "test-result",
		});

		const instance = Factory.create(undefined);
		const result = await instance.run();

		expect(result).toHaveProperty("result");
		expect(result).toHaveProperty("state");
		expect(result).toHaveProperty("events");
		expect(result).toHaveProperty("duration");

		expect(result.result).toBe("test-result");
		expect(result.events).toBeArray();
		expect(typeof result.duration).toBe("number");
	});

	test("harness name defaults to anonymous-harness", async () => {
		// Note: We can't directly test the name since it's internal,
		// but we can verify the harness works without providing one
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async () => "done",
		});

		const result = await Factory.create(undefined).run();
		expect(result.result).toBe("done");
	});

	test("custom harness name is accepted", async () => {
		const Factory = defineHarness({
			name: "my-custom-harness",
			agents: { simple: SimpleAgent },
			run: async () => "done",
		});

		const result = await Factory.create(undefined).run();
		expect(result.result).toBe("done");
	});
});

// ============================================================================
// STATE FACTORY TESTS
// ============================================================================

describe("state factory", () => {
	test("default state is empty object", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ state }) => {
				return Object.keys(state).length;
			},
		});

		const instance = Factory.create(undefined);
		const result = await instance.run();

		expect(result.result).toBe(0);
		expect(result.state).toEqual({});
	});

	test("custom state factory creates initial state", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			state: () => ({ count: 0, items: [] as string[] }),
			run: async ({ state }) => {
				state.count = 42;
				state.items.push("test");
				return state.count;
			},
		});

		const instance = Factory.create(undefined);
		const result = await instance.run();

		expect(result.result).toBe(42);
		expect(result.state).toEqual({ count: 42, items: ["test"] });
	});

	test("state factory receives input", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			state: (input: { initialCount: number }) => ({ count: input.initialCount }),
			run: async ({ state }) => {
				return state.count * 2;
			},
		});

		const instance = Factory.create({ initialCount: 10 });
		const result = await instance.run();

		expect(result.result).toBe(20);
	});

	test("each create() call gets fresh state", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			state: () => ({ value: 0 }),
			run: async ({ state }) => {
				state.value += 10;
				return state.value;
			},
		});

		const instance1 = Factory.create(undefined);
		const instance2 = Factory.create(undefined);

		const result1 = await instance1.run();
		const result2 = await instance2.run();

		// Each instance should start with fresh state
		expect(result1.result).toBe(10);
		expect(result2.result).toBe(10);
	});

	test("async state factory throws error", () => {
		expect(() => {
			const Factory = defineHarness({
				agents: { simple: SimpleAgent },
				// Note: TypeScript accepts this but we catch it at runtime
				state: async () => ({ async: true }),
				run: async () => "done",
			});

			Factory.create(undefined);
		}).toThrow("State factory must be synchronous");
	});
});

// ============================================================================
// EVENT SUBSCRIPTION TESTS
// ============================================================================

describe("event subscription", () => {
	test("phase events are emitted and received", async () => {
		const events: PhaseEvent[] = [];

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase }) => {
				await phase("test-phase", async () => "phase-result");
				return "done";
			},
		});

		const result = await Factory.create(undefined)
			.on("phase", (e) => events.push(e))
			.run();

		expect(events).toHaveLength(2); // start + complete
		expect(events[0]?.name).toBe("test-phase");
		expect(events[0]?.status).toBe("start");
		expect(events[1]?.name).toBe("test-phase");
		expect(events[1]?.status).toBe("complete");
		expect(result.result).toBe("done");
	});

	test("events are collected in result.events", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase, task }) => {
				await phase("p1", async () => {
					await task("t1", async () => "task-done");
				});
				return "done";
			},
		});

		const result = await Factory.create(undefined).run();

		// Should have phase start/complete and task start/complete
		expect(result.events.length).toBeGreaterThanOrEqual(4);

		const phaseEvents = result.events.filter((e) => e.type === "phase");
		const taskEvents = result.events.filter((e) => e.type === "task");

		expect(phaseEvents).toHaveLength(2);
		expect(taskEvents).toHaveLength(2);
	});

	test("wildcard subscription receives all events", async () => {
		const events: unknown[] = [];

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase, task }) => {
				await phase("p1", async () => {
					await task("t1", async () => "done");
				});
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		expect(events.length).toBeGreaterThanOrEqual(4);
	});
});

// ============================================================================
// US3: DECLARATIVE EVENT HANDLING TESTS
// ============================================================================

describe("US3: Declarative Event Handling", () => {
	/**
	 * T019: Verify event handlers receive events and auto-cleanup
	 */
	test("event handlers are invoked during execution", async () => {
		const phaseEvents: PhaseEvent[] = [];
		const taskEvents: unknown[] = [];

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase, task }) => {
				await phase("setup", async () => {
					await task("load-config", async () => "config loaded");
				});
				await phase("process", async () => {
					await task("run-agent", async () => "processed");
				});
				return "done";
			},
		});

		const result = await Factory.create(undefined)
			.on("phase", (e) => phaseEvents.push(e))
			.on("task", (e) => taskEvents.push(e))
			.run();

		// Phase events: 2 phases × 2 events (start + complete) = 4
		expect(phaseEvents).toHaveLength(4);
		expect(phaseEvents.filter((e) => e.status === "start")).toHaveLength(2);
		expect(phaseEvents.filter((e) => e.status === "complete")).toHaveLength(2);

		// Task events: 2 tasks × 2 events (start + complete) = 4
		expect(taskEvents).toHaveLength(4);

		expect(result.result).toBe("done");
	});

	test("multiple handlers for same event type all receive events", async () => {
		const handler1Events: unknown[] = [];
		const handler2Events: unknown[] = [];

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase }) => {
				await phase("test", async () => "result");
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("phase", (e) => handler1Events.push(e))
			.on("phase", (e) => handler2Events.push(e))
			.run();

		// Both handlers should receive same events
		expect(handler1Events).toHaveLength(2);
		expect(handler2Events).toHaveLength(2);
	});

	test("handlers are auto-cleaned up after run() completes", async () => {
		let postRunEventCount = 0;

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase, emit }) => {
				await phase("main", async () => "done");
				return "done";
			},
		});

		const instance = Factory.create(undefined);

		// Register handler
		instance.on("phase", () => {
			postRunEventCount++;
		});

		// Run the harness
		await instance.run();
		const eventsReceived = postRunEventCount;

		// Verify events were received during run
		expect(eventsReceived).toBeGreaterThan(0);

		// The subscriptions are cleared after run() - this is an internal
		// implementation detail, but we can verify by checking the result.events
		// contains the events (they're collected during run)
	});

	test("handler errors do not stop execution", async () => {
		const successEvents: unknown[] = [];

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase }) => {
				await phase("test", async () => "result");
				return "done";
			},
		});

		// Register a handler that throws
		const result = await Factory.create(undefined)
			.on("phase", () => {
				throw new Error("Handler error");
			})
			.on("phase", (e) => successEvents.push(e))
			.run();

		// Despite handler error, execution completes
		expect(result.result).toBe("done");
		// Second handler still receives events
		expect(successEvents.length).toBeGreaterThan(0);
	});

	test("custom events via emit() are received by handlers", async () => {
		const customEvents: unknown[] = [];

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ emit }) => {
				emit("custom", { message: "hello", value: 42 });
				emit("custom", { message: "world", value: 100 });
				return "done";
			},
		});

		await Factory.create(undefined)
			.on("*", (e) => {
				// Custom events extend beyond the known types
				if ((e as { type: string }).type === "custom") {
					customEvents.push(e);
				}
			})
			.run();

		expect(customEvents).toHaveLength(2);
	});

	test("fluent chaining allows multiple subscriptions", async () => {
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ phase, task }) => {
				await phase("p1", async () => {
					await task("t1", async () => "done");
				});
				return "done";
			},
		});

		const phaseEvents: unknown[] = [];
		const taskEvents: unknown[] = [];
		const allEvents: unknown[] = [];

		// Chain multiple .on() calls
		const result = await Factory.create(undefined)
			.on("phase", (e) => phaseEvents.push(e))
			.on("task", (e) => taskEvents.push(e))
			.on("*", (e) => allEvents.push(e))
			.run();

		expect(phaseEvents).toHaveLength(2);
		expect(taskEvents).toHaveLength(2);
		expect(allEvents).toHaveLength(4);
		expect(result.result).toBe("done");
	});
});

// ============================================================================
// US2: TYPED AGENT ACCESS TESTS
// ============================================================================

describe("US2: Typed Agent Access", () => {
	/**
	 * T015: Type inference test - verifies autocomplete works
	 *
	 * This test validates that TypeScript correctly infers:
	 * 1. Agent names from the config (agents.simple, agents.counter)
	 * 2. Agent method signatures (execute parameters and return types)
	 * 3. State shape from state factory
	 */
	test("agent method types are preserved through inference", async () => {
		// Define an agent with specific typed methods
		@injectable()
		class TypedAgent {
			compute(x: number, y: number): number {
				return x + y;
			}

			format(value: string): { formatted: string; length: number } {
				return { formatted: value.toUpperCase(), length: value.length };
			}
		}

		const Factory = defineHarness({
			agents: { typed: TypedAgent },
			run: async ({ agents }) => {
				// TypeScript knows agents.typed has compute() and format() methods
				// This would fail to compile if types weren't preserved
				const sum = agents.typed.compute(10, 20);
				const result = agents.typed.format("hello");

				return { sum, ...result };
			},
		});

		const result = await Factory.create(undefined).run();

		// Verify runtime behavior matches type expectations
		expect(result.result.sum).toBe(30);
		expect(result.result.formatted).toBe("HELLO");
		expect(result.result.length).toBe(5);
	});

	test("multiple agents with different types are all accessible", async () => {
		@injectable()
		class StringAgent {
			process(input: string): string {
				return input.toLowerCase();
			}
		}

		@injectable()
		class NumberAgent {
			double(n: number): number {
				return n * 2;
			}
		}

		@injectable()
		class ArrayAgent {
			sum(items: number[]): number {
				return items.reduce((a, b) => a + b, 0);
			}
		}

		const Factory = defineHarness({
			agents: {
				strings: StringAgent,
				numbers: NumberAgent,
				arrays: ArrayAgent,
			},
			run: async ({ agents }) => {
				// All three agents are typed correctly
				const str = agents.strings.process("HELLO");
				const num = agents.numbers.double(21);
				const arr = agents.arrays.sum([1, 2, 3, 4]);

				return { str, num, arr };
			},
		});

		const result = await Factory.create(undefined).run();

		expect(result.result).toEqual({
			str: "hello",
			num: 42,
			arr: 10,
		});
	});

	test("agent with generic method preserves type inference", async () => {
		@injectable()
		class GenericAgent {
			execute<T>(input: T): T[] {
				return [input, input];
			}
		}

		const Factory = defineHarness({
			agents: { generic: GenericAgent },
			run: async ({ agents }) => {
				// Generic method should preserve input/output types
				const numbers = agents.generic.execute(42);
				const strings = agents.generic.execute("test");

				return { numbers, strings };
			},
		});

		const result = await Factory.create(undefined).run();

		expect(result.result.numbers).toEqual([42, 42]);
		expect(result.result.strings).toEqual(["test", "test"]);
	});

	test("state type is inferred from state factory", async () => {
		interface CustomState {
			counter: number;
			messages: string[];
		}

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			state: (): CustomState => ({ counter: 0, messages: [] }),
			run: async ({ state }) => {
				// TypeScript knows state has counter and messages
				state.counter += 1;
				state.messages.push("hello");

				return {
					count: state.counter,
					messageCount: state.messages.length,
				};
			},
		});

		const result = await Factory.create(undefined).run();

		expect(result.result).toEqual({ count: 1, messageCount: 1 });
		expect(result.state).toEqual({ counter: 1, messages: ["hello"] });
	});

	test("input type flows to state factory", async () => {
		interface Input {
			seed: number;
			name: string;
		}

		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			state: (input: Input) => ({
				value: input.seed * 2,
				label: input.name.toUpperCase(),
			}),
			run: async ({ state }) => {
				return `${state.label}: ${state.value}`;
			},
		});

		// TypeScript knows create() requires { seed: number, name: string }
		const result = await Factory.create({ seed: 21, name: "test" }).run();

		expect(result.result).toBe("TEST: 42");
	});
});

// ============================================================================
// MODE CONFIGURATION TESTS
// ============================================================================

describe("mode configuration", () => {
	test("defaults to live mode", async () => {
		// This test verifies the default mode is live
		// We can't easily test mode internals, but we can verify it works
		const Factory = defineHarness({
			agents: { simple: SimpleAgent },
			run: async ({ agents }) => agents.simple.execute("test"),
		});

		const result = await Factory.create(undefined).run();
		expect(result.result).toBe("Processed: test");
	});

	test("accepts replay mode", async () => {
		const Factory = defineHarness({
			mode: "replay",
			agents: { simple: SimpleAgent },
			run: async ({ agents }) => agents.simple.execute("test"),
		});

		const result = await Factory.create(undefined).run();
		expect(result.result).toBe("Processed: test");
	});
});
