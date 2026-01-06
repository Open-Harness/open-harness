/**
 * Hub Channel Registration Tests
 *
 * Tests for the registered channel pattern:
 * - registerChannel/unregisterChannel
 * - start/stop lifecycle
 * - State management
 * - Error handling
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { HubImpl } from "../../src/engine/hub.js";

describe("Hub Channel Registration", () => {
	let hub: HubImpl;

	beforeEach(() => {
		hub = new HubImpl("test-session");
	});

	describe("registerChannel", () => {
		it("registers a channel and appears in channels list", () => {
			const channel: ChannelDefinition<unknown> = { name: "test", on: {} };

			hub.registerChannel(channel);

			expect(hub.channels).toContain("test");
		});

		it("throws on duplicate channel name", () => {
			hub.registerChannel({ name: "test", on: {} });

			expect(() => hub.registerChannel({ name: "test", on: {} })).toThrow(
				"already registered",
			);
		});

		it("throws on missing channel name", () => {
			expect(() => hub.registerChannel({ name: "", on: {} })).toThrow(
				"valid name",
			);
		});

		it("supports fluent chaining", () => {
			const result = hub
				.registerChannel({ name: "a", on: {} })
				.registerChannel({ name: "b", on: {} });

			expect(result).toBe(hub);
			expect(hub.channels).toContain("a");
			expect(hub.channels).toContain("b");
		});

		it("emits channel:registered event", () => {
			const events: string[] = [];
			hub.subscribe("channel:registered", (e) => {
				events.push((e.event as { name: string }).name);
			});

			hub.registerChannel({ name: "test", on: {} });

			expect(events).toContain("test");
		});
	});

	describe("Lifecycle", () => {
		it("channels are inactive until start() called", async () => {
			const events: string[] = [];

			hub.registerChannel({
				name: "recorder",
				on: {
					"test:*": ({ event }) => {
						events.push(event.event.type);
					},
				},
			});

			hub.emit({ type: "test:event" });
			expect(events).toEqual([]); // Not started, no handler

			await hub.start();
			hub.emit({ type: "test:event" });
			expect(events).toEqual(["test:event"]);
		});

		it("start() calls onStart hook with state", async () => {
			let startCalled = false;
			let receivedState: unknown;

			hub.registerChannel({
				name: "test",
				state: () => ({ count: 42 }),
				onStart: ({ state }) => {
					startCalled = true;
					receivedState = state;
				},
				on: {},
			});

			await hub.start();

			expect(startCalled).toBe(true);
			expect(receivedState).toEqual({ count: 42 });
		});

		it("stop() calls onComplete hook", async () => {
			let stopCalled = false;

			hub.registerChannel({
				name: "test",
				onComplete: () => {
					stopCalled = true;
				},
				on: {},
			});

			await hub.start();
			await hub.stop();

			expect(stopCalled).toBe(true);
		});

		it("stop() unsubscribes all handlers", async () => {
			const events: string[] = [];

			hub.registerChannel({
				name: "test",
				on: {
					"*": ({ event }) => {
						events.push(event.event.type);
					},
				},
			});

			await hub.start();
			hub.emit({ type: "event1" });
			expect(events).toContain("event1");

			await hub.stop();
			hub.emit({ type: "event2" });
			// Should NOT contain event2 after stop
			expect(events).not.toContain("event2");
		});

		it("emits channel:started on start", async () => {
			const events: string[] = [];
			hub.subscribe("channel:started", (e) => {
				events.push((e.event as { name: string }).name);
			});

			hub.registerChannel({ name: "test", on: {} });
			await hub.start();

			expect(events).toContain("test");
		});

		it("emits channel:stopped on stop", async () => {
			const events: string[] = [];
			hub.subscribe("channel:stopped", (e) => {
				events.push((e.event as { name: string }).name);
			});

			hub.registerChannel({ name: "test", on: {} });
			await hub.start();
			await hub.stop();

			expect(events).toContain("test");
		});
	});

	describe("Idempotency", () => {
		it("start() is idempotent", async () => {
			let startCount = 0;

			hub.registerChannel({
				name: "test",
				onStart: () => {
					startCount++;
				},
				on: {},
			});

			await hub.start();
			await hub.start();
			await hub.start();

			expect(startCount).toBe(1);
		});

		it("stop() is idempotent", async () => {
			let stopCount = 0;

			hub.registerChannel({
				name: "test",
				onComplete: () => {
					stopCount++;
				},
				on: {},
			});

			await hub.start();
			await hub.stop();
			await hub.stop();
			await hub.stop();

			expect(stopCount).toBe(1);
		});

		it("can restart after stop", async () => {
			let startCount = 0;

			hub.registerChannel({
				name: "test",
				onStart: () => {
					startCount++;
				},
				on: {},
			});

			await hub.start();
			await hub.stop();
			await hub.start();

			expect(startCount).toBe(2);
		});
	});

	describe("Error Handling", () => {
		it("channel handler errors don't crash hub", async () => {
			const events: string[] = [];

			hub.registerChannel({
				name: "faulty",
				on: {
					"test:*": () => {
						throw new Error("Handler exploded");
					},
				},
			});

			hub.registerChannel({
				name: "healthy",
				on: {
					"test:*": ({ event }) => {
						events.push(event.event.type);
					},
				},
			});

			await hub.start();

			// Should not throw
			expect(() => hub.emit({ type: "test:event" })).not.toThrow();

			// Healthy channel still works
			expect(events).toContain("test:event");
		});

		it("onStart error emits channel:error event", async () => {
			const errors: string[] = [];

			hub.subscribe("channel:error", (e) => {
				errors.push((e.event as { name: string }).name);
			});

			hub.registerChannel({
				name: "faulty",
				onStart: () => {
					throw new Error("Start failed");
				},
				on: {},
			});

			await hub.start();

			expect(errors).toContain("faulty");
		});
	});

	describe("unregisterChannel", () => {
		it("removes channel from list", () => {
			hub.registerChannel({ name: "test", on: {} });
			expect(hub.channels).toContain("test");

			const result = hub.unregisterChannel("test");

			expect(result).toBe(true);
			expect(hub.channels).not.toContain("test");
		});

		it("returns false for unknown channel", () => {
			const result = hub.unregisterChannel("nonexistent");

			expect(result).toBe(false);
		});

		it("stops running channel before removing", async () => {
			let stopped = false;

			hub.registerChannel({
				name: "test",
				onComplete: () => {
					stopped = true;
				},
				on: {},
			});

			await hub.start();
			hub.unregisterChannel("test");

			expect(stopped).toBe(true);
		});

		it("emits channel:unregistered event", () => {
			const events: string[] = [];
			hub.subscribe("channel:unregistered", (e) => {
				events.push((e.event as { name: string }).name);
			});

			hub.registerChannel({ name: "test", on: {} });
			hub.unregisterChannel("test");

			expect(events).toContain("test");
		});
	});

	describe("State Isolation", () => {
		it("each channel has its own state instance", async () => {
			const states: unknown[] = [];

			const sharedFactory = () => ({ value: Math.random() });

			hub.registerChannel({
				name: "channel1",
				state: sharedFactory,
				onStart: ({ state }) => {
					states.push(state);
				},
				on: {},
			});

			hub.registerChannel({
				name: "channel2",
				state: sharedFactory,
				onStart: ({ state }) => {
					states.push(state);
				},
				on: {},
			});

			await hub.start();

			expect(states[0]).not.toBe(states[1]);
		});

		it("state persists across handler calls", async () => {
			let finalCount = 0;

			hub.registerChannel({
				name: "counter",
				state: () => ({ count: 0 }),
				on: {
					"test:increment": ({ state }) => {
						state.count++;
					},
				},
				onComplete: ({ state }) => {
					finalCount = state.count;
				},
			});

			await hub.start();

			hub.emit({ type: "test:increment" });
			hub.emit({ type: "test:increment" });
			hub.emit({ type: "test:increment" });

			// Small delay to let async handlers complete
			await new Promise((resolve) => setTimeout(resolve, 10));

			await hub.stop();

			expect(finalCount).toBe(3);
		});
	});

	describe("Event Filtering", () => {
		it("handlers respect filter patterns", async () => {
			const events: string[] = [];

			hub.registerChannel({
				name: "filtered",
				on: {
					"agent:*": ({ event }) => {
						events.push(`agent:${event.event.type}`);
					},
					"task:complete": () => {
						events.push("task-done");
					},
				},
			});

			await hub.start();

			hub.emit({ type: "agent:start", agentName: "test", runId: "1" });
			hub.emit({ type: "task:start", taskId: "t1" });
			hub.emit({ type: "task:complete", taskId: "t1" });
			hub.emit({ type: "harness:start", name: "test" });

			// Small delay for async handlers
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events).toContain("agent:agent:start");
			expect(events).toContain("task-done");
			expect(events).not.toContain("task:start");
			expect(events).not.toContain("harness:start");
		});
	});

	describe("Late Registration", () => {
		it("channel registered after start() activates immediately", async () => {
			await hub.start();

			let started = false;
			hub.registerChannel({
				name: "late",
				onStart: () => {
					started = true;
				},
				on: {},
			});

			// Small delay for async start
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(started).toBe(true);
		});

		it("late-registered channel receives events", async () => {
			const events: string[] = [];

			await hub.start();

			hub.registerChannel({
				name: "late",
				on: {
					"test:*": ({ event }) => {
						events.push(event.event.type);
					},
				},
			});

			// Small delay for async start
			await new Promise((resolve) => setTimeout(resolve, 10));

			hub.emit({ type: "test:event" });

			// Small delay for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events).toContain("test:event");
		});
	});
});
