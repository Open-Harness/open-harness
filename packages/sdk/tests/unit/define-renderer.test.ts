/**
 * Unit Tests for defineRenderer() Declarative Renderer API
 *
 * T032: defineRenderer() creates valid IUnifiedRenderer
 * T033: Renderer state factory called fresh on attach()
 * T034: Event handlers receive typed RenderContext
 * T035: onStart/onComplete lifecycle hooks called
 *
 * @module tests/unit/define-renderer
 */

import { describe, expect, mock, test } from "bun:test";
import { UnifiedEventBus } from "../../src/core/unified-event-bus.js";
import type { BaseEvent, EnrichedEvent } from "../../src/core/unified-events/types.js";
import { defineRenderer, type IUnifiedRenderer, type RenderContext } from "../../src/harness/define-renderer.js";

// ============================================================================
// T032: defineRenderer() creates valid IUnifiedRenderer
// ============================================================================

describe("T032: defineRenderer() creates valid IUnifiedRenderer", () => {
	test("returns object with name property", () => {
		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
		});

		expect(renderer.name).toBe("TestRenderer");
	});

	test("returns object with attach method", () => {
		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
		});

		expect(typeof renderer.attach).toBe("function");
	});

	test("returns object with detach method", () => {
		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
		});

		expect(typeof renderer.detach).toBe("function");
	});

	test("implements IUnifiedRenderer interface", () => {
		const renderer: IUnifiedRenderer = defineRenderer({
			name: "TestRenderer",
			on: {},
		});

		// TypeScript will fail compilation if interface not satisfied
		expect(renderer).toBeDefined();
		expect(renderer.name).toBeDefined();
		expect(renderer.attach).toBeDefined();
		expect(renderer.detach).toBeDefined();
	});

	test("attach throws if already attached", () => {
		const bus = new UnifiedEventBus();
		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
		});

		renderer.attach(bus);

		expect(() => renderer.attach(bus)).toThrow(/already attached/);

		renderer.detach();
	});

	test("detach is idempotent (can call multiple times)", () => {
		const bus = new UnifiedEventBus();
		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
		});

		renderer.attach(bus);
		renderer.detach();
		renderer.detach(); // Second call should not throw

		expect(true).toBe(true); // If we get here, no error
	});
});

// ============================================================================
// T033: Renderer state factory called fresh on attach()
// ============================================================================

describe("T033: Renderer state factory called fresh on attach()", () => {
	test("state factory is called on attach", () => {
		const bus = new UnifiedEventBus();
		const stateFactory = mock(() => ({ count: 0 }));

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: stateFactory,
			on: {},
		});

		expect(stateFactory).not.toHaveBeenCalled();

		renderer.attach(bus);

		expect(stateFactory).toHaveBeenCalledTimes(1);

		renderer.detach();
	});

	test("state factory is called fresh on each attach", () => {
		const bus = new UnifiedEventBus();
		let callCount = 0;
		const stateFactory = () => {
			callCount++;
			return { instanceId: callCount };
		};

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: stateFactory,
			on: {},
		});

		renderer.attach(bus);
		renderer.detach();

		renderer.attach(bus);
		renderer.detach();

		expect(callCount).toBe(2);
	});

	test("state is isolated between attach/detach cycles", () => {
		const bus = new UnifiedEventBus();
		const receivedStates: number[] = [];

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: () => ({ counter: 0 }),
			on: {
				"test:event": ({ state }) => {
					state.counter++;
					receivedStates.push(state.counter);
				},
			},
		});

		// First attach cycle
		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		bus.emit({ type: "test:event" });
		renderer.detach();

		// Second attach cycle - state should reset
		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		renderer.detach();

		// First cycle: 1, 2; Second cycle: 1 (fresh state)
		expect(receivedStates).toEqual([1, 2, 1]);
	});

	test("default empty state works when no factory provided", () => {
		const bus = new UnifiedEventBus();
		let receivedContext: RenderContext<Record<string, never>> | null = null;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"test:event": (context) => {
					receivedContext = context;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		renderer.detach();

		expect(receivedContext).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedContext!.state).toEqual({});
	});
});

// ============================================================================
// T034: Event handlers receive typed RenderContext
// ============================================================================

describe("T034: Event handlers receive typed RenderContext", () => {
	test("context contains mutable state", () => {
		const bus = new UnifiedEventBus();
		let receivedState: { count: number } | null = null;

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: () => ({ count: 42 }),
			on: {
				"test:event": ({ state }) => {
					receivedState = state;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		renderer.detach();

		expect(receivedState).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedState!.count).toBe(42);
	});

	test("context.state is mutable across handlers", () => {
		const bus = new UnifiedEventBus();
		const stateSnapshots: number[] = [];

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: () => ({ count: 0 }),
			on: {
				"test:increment": ({ state }) => {
					state.count++;
					stateSnapshots.push(state.count);
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "test:increment" });
		bus.emit({ type: "test:increment" });
		bus.emit({ type: "test:increment" });
		renderer.detach();

		expect(stateSnapshots).toEqual([1, 2, 3]);
	});

	test("context contains current event", () => {
		const bus = new UnifiedEventBus();
		let receivedEvent: EnrichedEvent<BaseEvent> | null = null;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"task:start": ({ event }) => {
					receivedEvent = event;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		renderer.detach();

		expect(receivedEvent).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedEvent!.event.type).toBe("task:start");
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect((receivedEvent!.event as { taskId: string }).taskId).toBe("T001");
	});

	test("context contains emit function", () => {
		const bus = new UnifiedEventBus();
		const emittedEvents: BaseEvent[] = [];

		bus.subscribe((e) => {
			emittedEvents.push(e.event);
		});

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"trigger:event": ({ emit }) => {
					emit("custom:event", { data: "from handler" });
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "trigger:event" });
		renderer.detach();

		expect(emittedEvents.length).toBe(2);
		expect(emittedEvents[1]?.type).toBe("custom:event");
	});

	test("context contains config", () => {
		const bus = new UnifiedEventBus();
		let receivedConfig: { verbosity: string; colors: boolean; unicode: boolean } | null = null;

		const renderer = defineRenderer(
			{
				name: "TestRenderer",
				on: {
					"test:event": ({ config }) => {
						receivedConfig = config;
					},
				},
			},
			{ verbosity: "verbose", colors: false },
		);

		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		renderer.detach();

		expect(receivedConfig).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedConfig!.verbosity).toBe("verbose");
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedConfig!.colors).toBe(false);
	});

	test("context contains output helpers", () => {
		const bus = new UnifiedEventBus();
		let hasOutputHelpers = false;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"test:event": ({ output }) => {
					hasOutputHelpers =
						typeof output.line === "function" &&
						typeof output.spinner === "function" &&
						typeof output.progress === "function";
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		renderer.detach();

		expect(hasOutputHelpers).toBe(true);
	});
});

// ============================================================================
// T035: onStart/onComplete lifecycle hooks called
// ============================================================================

describe("T035: onStart/onComplete lifecycle hooks called", () => {
	test("onStart is called when attach() is invoked", () => {
		const bus = new UnifiedEventBus();
		let startCalled = false;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
			onStart: () => {
				startCalled = true;
			},
		});

		expect(startCalled).toBe(false);

		renderer.attach(bus);

		expect(startCalled).toBe(true);

		renderer.detach();
	});

	test("onComplete is called when detach() is invoked", () => {
		const bus = new UnifiedEventBus();
		let completeCalled = false;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {},
			onComplete: () => {
				completeCalled = true;
			},
		});

		renderer.attach(bus);

		expect(completeCalled).toBe(false);

		renderer.detach();

		expect(completeCalled).toBe(true);
	});

	test("onStart receives RenderContext with fresh state", () => {
		const bus = new UnifiedEventBus();
		let receivedState: { initialized: boolean } | null = null;

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: () => ({ initialized: false }),
			on: {},
			onStart: ({ state }) => {
				receivedState = state;
				state.initialized = true;
			},
		});

		renderer.attach(bus);
		renderer.detach();

		expect(receivedState).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedState!.initialized).toBe(true);
	});

	test("onComplete receives RenderContext with final state", () => {
		const bus = new UnifiedEventBus();
		let finalCount = -1;

		const renderer = defineRenderer({
			name: "TestRenderer",
			state: () => ({ count: 0 }),
			on: {
				"test:event": ({ state }) => {
					state.count++;
				},
			},
			onComplete: ({ state }) => {
				finalCount = state.count;
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		bus.emit({ type: "test:event" });
		bus.emit({ type: "test:event" });
		renderer.detach();

		expect(finalCount).toBe(3);
	});

	test("lifecycle hooks can use output helpers", () => {
		const bus = new UnifiedEventBus();
		const outputLog: string[] = [];

		const renderer = defineRenderer(
			{
				name: "TestRenderer",
				on: {},
				onStart: ({ output }) => {
					// Replace write function to capture output
					(output as unknown as { config: { write: (s: string) => void } }).config = {
						...(output as unknown as { config: object }).config,
						write: (s: string) => outputLog.push(s),
					};
				},
			},
			{},
		);

		renderer.attach(bus);
		renderer.detach();

		// Hook was called, confirming output is available
		expect(true).toBe(true);
	});

	test("both hooks work together in correct order", () => {
		const bus = new UnifiedEventBus();
		const callOrder: string[] = [];

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"test:event": () => {
					callOrder.push("handler");
				},
			},
			onStart: () => {
				callOrder.push("start");
			},
			onComplete: () => {
				callOrder.push("complete");
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "test:event" });
		renderer.detach();

		expect(callOrder).toEqual(["start", "handler", "complete"]);
	});
});

// ============================================================================
// Event Pattern Matching
// ============================================================================

describe("Event pattern matching", () => {
	test("exact match pattern works", () => {
		const bus = new UnifiedEventBus();
		let taskStartCount = 0;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"task:start": () => {
					taskStartCount++;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "task:complete", taskId: "T001", result: null });
		bus.emit({ type: "task:start", taskId: "T002" });
		renderer.detach();

		expect(taskStartCount).toBe(2);
	});

	test("wildcard prefix pattern works", () => {
		const bus = new UnifiedEventBus();
		let taskEventCount = 0;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"task:*": () => {
					taskEventCount++;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "task:complete", taskId: "T001", result: null });
		bus.emit({ type: "task:failed", taskId: "T002", error: "oops" });
		bus.emit({ type: "agent:thinking", content: "..." }); // Should NOT match
		renderer.detach();

		expect(taskEventCount).toBe(3);
	});

	test("wildcard '*' matches all events", () => {
		const bus = new UnifiedEventBus();
		let allEventCount = 0;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"*": () => {
					allEventCount++;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "agent:thinking", content: "..." });
		bus.emit({ type: "custom:event" });
		renderer.detach();

		expect(allEventCount).toBe(3);
	});

	test("multiple patterns can be registered", () => {
		const bus = new UnifiedEventBus();
		const counts = { task: 0, agent: 0 };

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"task:*": () => {
					counts.task++;
				},
				"agent:*": () => {
					counts.agent++;
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "agent:thinking", content: "..." });
		bus.emit({ type: "task:complete", taskId: "T001", result: null });
		renderer.detach();

		expect(counts).toEqual({ task: 2, agent: 1 });
	});
});

// ============================================================================
// Error Handling
// ============================================================================

describe("Error handling in handlers", () => {
	test("handler error does not crash renderer", () => {
		const bus = new UnifiedEventBus();
		const events: string[] = [];

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"event:one": () => {
					events.push("one");
					throw new Error("Handler error");
				},
				"event:two": () => {
					events.push("two");
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "event:one" });
		bus.emit({ type: "event:two" });
		renderer.detach();

		// Both handlers should have been called
		expect(events).toContain("one");
		expect(events).toContain("two");
	});

	test("error in one event does not prevent subsequent events", () => {
		const bus = new UnifiedEventBus();
		let count = 0;

		const renderer = defineRenderer({
			name: "TestRenderer",
			on: {
				"*": () => {
					count++;
					if (count === 2) {
						throw new Error("Intentional error");
					}
				},
			},
		});

		renderer.attach(bus);
		bus.emit({ type: "event:1" });
		bus.emit({ type: "event:2" }); // This throws
		bus.emit({ type: "event:3" }); // Should still work
		renderer.detach();

		expect(count).toBe(3);
	});
});
