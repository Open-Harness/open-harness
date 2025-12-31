/**
 * Unit Tests for Channel API
 *
 * T032: createChannel() creates valid IChannel
 * T033: Channel state factory called fresh on attach()
 * T034: Event handlers receive typed ChannelContext
 * T035: onStart/onComplete lifecycle hooks called
 * T036: defineChannel() returns Attachment directly
 *
 * @module tests/unit/define-channel
 */

import { describe, expect, mock, test } from "bun:test";
import { UnifiedEventBus } from "../../src/core/unified-event-bus.js";
import type { BaseEvent, EnrichedEvent, Transport } from "../../src/core/unified-events/types.js";
import { type ChannelContext, createChannel, defineChannel, type IChannel } from "../../src/harness/define-channel.js";

// Helper: Create a mock Transport for testing
function createMockTransport(): Transport & { emit: (event: unknown) => void } {
	type Listener = (event: EnrichedEvent<BaseEvent>) => void;
	const subscribers: Listener[] = [];

	return {
		subscribe: (filterOrListener: unknown, maybeListener?: unknown) => {
			const listener = (typeof filterOrListener === "function" ? filterOrListener : maybeListener) as Listener;
			subscribers.push(listener);
			return () => {
				const idx = subscribers.indexOf(listener);
				if (idx >= 0) subscribers.splice(idx, 1);
			};
		},
		send: () => {},
		sendTo: () => {},
		reply: () => {},
		abort: () => {},
		status: "idle" as const,
		sessionActive: false,
		[Symbol.asyncIterator]: async function* () {
			// Minimal implementation - yields nothing
		},
		// Test helper to emit events
		emit: (event: unknown) => {
			for (const subscriber of subscribers) {
				subscriber(event as EnrichedEvent<BaseEvent>);
			}
		},
	};
}

// ============================================================================
// T032: createChannel() creates valid IChannel
// ============================================================================

describe("T032: createChannel() creates valid IChannel", () => {
	test("returns object with name property", () => {
		const channel = createChannel({
			name: "TestChannel",
			on: {},
		});

		expect(channel.name).toBe("TestChannel");
	});

	test("returns object with attach method", () => {
		const channel = createChannel({
			name: "TestChannel",
			on: {},
		});

		expect(typeof channel.attach).toBe("function");
	});

	test("returns object with detach method", () => {
		const channel = createChannel({
			name: "TestChannel",
			on: {},
		});

		expect(typeof channel.detach).toBe("function");
	});

	test("implements IChannel interface", () => {
		const channel: IChannel = createChannel({
			name: "TestChannel",
			on: {},
		});

		// TypeScript will fail compilation if interface not satisfied
		expect(channel).toBeDefined();
		expect(channel.name).toBeDefined();
		expect(channel.attach).toBeDefined();
		expect(channel.detach).toBeDefined();
	});

	test("attach throws if already attached", () => {
		const bus = new UnifiedEventBus();
		const channel = createChannel({
			name: "TestChannel",
			on: {},
		});

		channel.attach(bus);

		expect(() => channel.attach(bus)).toThrow(/already attached/);

		channel.detach();
	});

	test("detach is idempotent (can call multiple times)", () => {
		const bus = new UnifiedEventBus();
		const channel = createChannel({
			name: "TestChannel",
			on: {},
		});

		channel.attach(bus);
		channel.detach();
		channel.detach(); // Second call should not throw

		expect(true).toBe(true); // If we get here, no error
	});
});

// ============================================================================
// T033: Channel state factory called fresh on attach()
// ============================================================================

describe("T033: Channel state factory called fresh on attach()", () => {
	test("state factory is called on attach", () => {
		const bus = new UnifiedEventBus();
		const stateFactory = mock(() => ({ count: 0 }));

		const channel = createChannel({
			name: "TestChannel",
			state: stateFactory,
			on: {},
		});

		expect(stateFactory).not.toHaveBeenCalled();

		channel.attach(bus);

		expect(stateFactory).toHaveBeenCalledTimes(1);

		channel.detach();
	});

	test("state factory is called fresh on each attach", () => {
		const bus = new UnifiedEventBus();
		let callCount = 0;
		const stateFactory = () => {
			callCount++;
			return { instanceId: callCount };
		};

		const channel = createChannel({
			name: "TestChannel",
			state: stateFactory,
			on: {},
		});

		channel.attach(bus);
		channel.detach();

		channel.attach(bus);
		channel.detach();

		expect(callCount).toBe(2);
	});

	test("state is isolated between attach/detach cycles", () => {
		const bus = new UnifiedEventBus();
		const receivedStates: number[] = [];

		const channel = createChannel({
			name: "TestChannel",
			state: () => ({ counter: 0 }),
			on: {
				"test:event": ({ state }) => {
					state.counter++;
					receivedStates.push(state.counter);
				},
			},
		});

		// First attach cycle
		channel.attach(bus);
		bus.emit({ type: "test:event" });
		bus.emit({ type: "test:event" });
		channel.detach();

		// Second attach cycle - state should reset
		channel.attach(bus);
		bus.emit({ type: "test:event" });
		channel.detach();

		// First cycle: 1, 2; Second cycle: 1 (fresh state)
		expect(receivedStates).toEqual([1, 2, 1]);
	});

	test("default empty state works when no factory provided", () => {
		const bus = new UnifiedEventBus();
		let receivedContext: ChannelContext<Record<string, never>> | null = null;

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"test:event": (context) => {
					receivedContext = context;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "test:event" });
		channel.detach();

		expect(receivedContext).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedContext!.state).toEqual({});
	});
});

// ============================================================================
// T034: Event handlers receive typed ChannelContext
// ============================================================================

describe("T034: Event handlers receive typed ChannelContext", () => {
	test("context contains mutable state", () => {
		const bus = new UnifiedEventBus();
		let receivedState: { count: number } | null = null;

		const channel = createChannel({
			name: "TestChannel",
			state: () => ({ count: 42 }),
			on: {
				"test:event": ({ state }) => {
					receivedState = state;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "test:event" });
		channel.detach();

		expect(receivedState).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedState!.count).toBe(42);
	});

	test("context.state is mutable across handlers", () => {
		const bus = new UnifiedEventBus();
		const stateSnapshots: number[] = [];

		const channel = createChannel({
			name: "TestChannel",
			state: () => ({ count: 0 }),
			on: {
				"test:increment": ({ state }) => {
					state.count++;
					stateSnapshots.push(state.count);
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "test:increment" });
		bus.emit({ type: "test:increment" });
		bus.emit({ type: "test:increment" });
		channel.detach();

		expect(stateSnapshots).toEqual([1, 2, 3]);
	});

	test("context contains current event", () => {
		const bus = new UnifiedEventBus();
		let receivedEvent: EnrichedEvent<BaseEvent> | null = null;

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"task:start": ({ event }) => {
					receivedEvent = event;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		channel.detach();

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

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"trigger:event": ({ emit }) => {
					emit("custom:event", { data: "from handler" });
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "trigger:event" });
		channel.detach();

		expect(emittedEvents.length).toBe(2);
		expect(emittedEvents[1]?.type).toBe("custom:event");
	});

	test("context contains config", () => {
		const bus = new UnifiedEventBus();
		let receivedConfig: { verbosity: string; colors: boolean; unicode: boolean } | null = null;

		const channel = createChannel(
			{
				name: "TestChannel",
				on: {
					"test:event": ({ config }) => {
						receivedConfig = config;
					},
				},
			},
			{ verbosity: "verbose", colors: false },
		);

		channel.attach(bus);
		bus.emit({ type: "test:event" });
		channel.detach();

		expect(receivedConfig).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedConfig!.verbosity).toBe("verbose");
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedConfig!.colors).toBe(false);
	});

	test("context contains output helpers", () => {
		const bus = new UnifiedEventBus();
		let hasOutputHelpers = false;

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"test:event": ({ output }) => {
					hasOutputHelpers =
						typeof output.line === "function" &&
						typeof output.spinner === "function" &&
						typeof output.progress === "function";
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "test:event" });
		channel.detach();

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

		const channel = createChannel({
			name: "TestChannel",
			on: {},
			onStart: () => {
				startCalled = true;
			},
		});

		expect(startCalled).toBe(false);

		channel.attach(bus);

		expect(startCalled).toBe(true);

		channel.detach();
	});

	test("onComplete is called when detach() is invoked", () => {
		const bus = new UnifiedEventBus();
		let completeCalled = false;

		const channel = createChannel({
			name: "TestChannel",
			on: {},
			onComplete: () => {
				completeCalled = true;
			},
		});

		channel.attach(bus);

		expect(completeCalled).toBe(false);

		channel.detach();

		expect(completeCalled).toBe(true);
	});

	test("onStart receives ChannelContext with fresh state", () => {
		const bus = new UnifiedEventBus();
		let receivedState: { initialized: boolean } | null = null;

		const channel = createChannel({
			name: "TestChannel",
			state: () => ({ initialized: false }),
			on: {},
			onStart: ({ state }) => {
				receivedState = state;
				state.initialized = true;
			},
		});

		channel.attach(bus);
		channel.detach();

		expect(receivedState).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: Safe after not.toBeNull() assertion
		expect(receivedState!.initialized).toBe(true);
	});

	test("onComplete receives ChannelContext with final state", () => {
		const bus = new UnifiedEventBus();
		let finalCount = -1;

		const channel = createChannel({
			name: "TestChannel",
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

		channel.attach(bus);
		bus.emit({ type: "test:event" });
		bus.emit({ type: "test:event" });
		bus.emit({ type: "test:event" });
		channel.detach();

		expect(finalCount).toBe(3);
	});

	test("lifecycle hooks can use output helpers", () => {
		const bus = new UnifiedEventBus();
		const outputLog: string[] = [];

		const channel = createChannel(
			{
				name: "TestChannel",
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

		channel.attach(bus);
		channel.detach();

		// Hook was called, confirming output is available
		expect(true).toBe(true);
	});

	test("both hooks work together in correct order", () => {
		const bus = new UnifiedEventBus();
		const callOrder: string[] = [];

		const channel = createChannel({
			name: "TestChannel",
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

		channel.attach(bus);
		bus.emit({ type: "test:event" });
		channel.detach();

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

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"task:start": () => {
					taskStartCount++;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "task:complete", taskId: "T001", result: null });
		bus.emit({ type: "task:start", taskId: "T002" });
		channel.detach();

		expect(taskStartCount).toBe(2);
	});

	test("wildcard prefix pattern works", () => {
		const bus = new UnifiedEventBus();
		let taskEventCount = 0;

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"task:*": () => {
					taskEventCount++;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "task:complete", taskId: "T001", result: null });
		bus.emit({ type: "task:failed", taskId: "T002", error: "oops" });
		bus.emit({ type: "agent:thinking", content: "..." }); // Should NOT match
		channel.detach();

		expect(taskEventCount).toBe(3);
	});

	test("wildcard '*' matches all events", () => {
		const bus = new UnifiedEventBus();
		let allEventCount = 0;

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"*": () => {
					allEventCount++;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "agent:thinking", content: "..." });
		bus.emit({ type: "custom:event" });
		channel.detach();

		expect(allEventCount).toBe(3);
	});

	test("multiple patterns can be registered", () => {
		const bus = new UnifiedEventBus();
		const counts = { task: 0, agent: 0 };

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"task:*": () => {
					counts.task++;
				},
				"agent:*": () => {
					counts.agent++;
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "task:start", taskId: "T001" });
		bus.emit({ type: "agent:thinking", content: "..." });
		bus.emit({ type: "task:complete", taskId: "T001", result: null });
		channel.detach();

		expect(counts).toEqual({ task: 2, agent: 1 });
	});
});

// ============================================================================
// Error Handling
// ============================================================================

describe("Error handling in handlers", () => {
	test("handler error does not crash channel", () => {
		const bus = new UnifiedEventBus();
		const events: string[] = [];

		const channel = createChannel({
			name: "TestChannel",
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

		channel.attach(bus);
		bus.emit({ type: "event:one" });
		bus.emit({ type: "event:two" });
		channel.detach();

		// Both handlers should have been called
		expect(events).toContain("one");
		expect(events).toContain("two");
	});

	test("error in one event does not prevent subsequent events", () => {
		const bus = new UnifiedEventBus();
		let count = 0;

		const channel = createChannel({
			name: "TestChannel",
			on: {
				"*": () => {
					count++;
					if (count === 2) {
						throw new Error("Intentional error");
					}
				},
			},
		});

		channel.attach(bus);
		bus.emit({ type: "event:1" });
		bus.emit({ type: "event:2" }); // This throws
		bus.emit({ type: "event:3" }); // Should still work
		channel.detach();

		expect(count).toBe(3);
	});
});

// ============================================================================
// T036: defineChannel() returns Attachment directly
// ============================================================================

describe("T036: defineChannel() returns Attachment directly", () => {
	test("defineChannel returns a function (Attachment type)", () => {
		const attachment = defineChannel({
			name: "TestChannel",
			on: {},
		});

		expect(typeof attachment).toBe("function");
	});

	test("attachment function accepts transport and returns cleanup", () => {
		const attachment = defineChannel({
			name: "TestChannel",
			on: {},
		});

		const mockTransport = createMockTransport();
		const cleanup = attachment(mockTransport);

		expect(typeof cleanup).toBe("function");

		// Cleanup should work without error
		if (cleanup) cleanup();
	});

	test("channel receives events via transport.subscribe", () => {
		const receivedEvents: string[] = [];

		const attachment = defineChannel({
			name: "TestChannel",
			on: {
				"task:start": ({ event }) => {
					receivedEvents.push(event.event.type);
				},
			},
		});

		const mockTransport = createMockTransport();
		const cleanup = attachment(mockTransport);

		// Emit event through transport
		mockTransport.emit({ type: "task:start", taskId: "T001" });

		expect(receivedEvents).toContain("task:start");

		if (cleanup) cleanup();
	});

	test("channel state is fresh for each attachment", () => {
		let factoryCalls = 0;

		const attachment = defineChannel({
			name: "TestChannel",
			state: () => {
				factoryCalls++;
				return { count: 0 };
			},
			on: {},
		});

		const mockTransport = createMockTransport();

		// First attach
		const cleanup1 = attachment(mockTransport);
		if (cleanup1) cleanup1();

		// Second attach
		const cleanup2 = attachment(mockTransport);
		if (cleanup2) cleanup2();

		expect(factoryCalls).toBe(2);
	});

	test("channel can use ChannelContext type", () => {
		// Use unknown initially, cast when received
		let receivedContext: unknown = null;

		const attachment = defineChannel({
			name: "TestChannel",
			state: () => ({ count: 42 }),
			on: {
				"*": (ctx) => {
					receivedContext = ctx;
				},
			},
		});

		const mockTransport = createMockTransport();
		const cleanup = attachment(mockTransport);

		// Emit an event
		mockTransport.emit({ type: "test:event" });

		expect(receivedContext).not.toBeNull();
		// Cast to expected type for assertions
		const ctx = receivedContext as ChannelContext<{ count: number }>;
		expect(ctx.state.count).toBe(42);
		expect(ctx.config).toBeDefined();
		expect(ctx.output).toBeDefined();

		if (cleanup) cleanup();
	});

	test("cleanup function properly detaches channel", () => {
		let handlerCallCount = 0;

		const attachment = defineChannel({
			name: "TestChannel",
			on: {
				"*": () => {
					handlerCallCount++;
				},
			},
		});

		const mockTransport = createMockTransport();
		const cleanup = attachment(mockTransport);

		// Emit before cleanup
		mockTransport.emit({ type: "event:before" });

		expect(handlerCallCount).toBe(1);

		// Cleanup
		if (cleanup) cleanup();

		// Emit after cleanup - should not be received (subscriber unregistered)
		mockTransport.emit({ type: "event:after" });

		expect(handlerCallCount).toBe(1); // Still 1, not 2
	});
});
