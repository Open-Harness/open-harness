import { describe, expect, mock, test } from "bun:test";
import { createSignal, type Signal } from "@signals/core";
import { SignalBus } from "../src/bus.js";

describe("SignalBus", () => {
	describe("emit", () => {
		test("notifies matching subscribers", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("analysis:complete", handler);
			const signal = createSignal("analysis:complete", { result: "bullish" });
			bus.emit(signal);

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(signal);
		});

		test("does not notify non-matching subscribers", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("analysis:complete", handler);
			bus.emit(createSignal("trade:proposed", { amount: 100 }));

			expect(handler).not.toHaveBeenCalled();
		});

		test("notifies multiple matching subscribers", () => {
			const bus = new SignalBus();
			const handler1 = mock();
			const handler2 = mock();

			bus.subscribe("test:event", handler1);
			bus.subscribe("test:event", handler2);
			bus.emit(createSignal("test:event", null));

			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);
		});

		test("adds signals to history", () => {
			const bus = new SignalBus();
			const signal1 = createSignal("event:one", 1);
			const signal2 = createSignal("event:two", 2);

			bus.emit(signal1);
			bus.emit(signal2);

			const history = bus.history();
			expect(history.length).toBe(2);
			expect(history[0]).toBe(signal1);
			expect(history[1]).toBe(signal2);
		});

		test("respects maxHistory limit", () => {
			const bus = new SignalBus({ maxHistory: 3 });

			bus.emit(createSignal("event:1", 1));
			bus.emit(createSignal("event:2", 2));
			bus.emit(createSignal("event:3", 3));
			bus.emit(createSignal("event:4", 4));
			bus.emit(createSignal("event:5", 5));

			const history = bus.history();
			expect(history.length).toBe(3);
			expect((history[0] as Signal<number>).payload).toBe(3);
			expect((history[2] as Signal<number>).payload).toBe(5);
		});

		test("continues emitting if handler throws", () => {
			const bus = new SignalBus();
			const errorHandler = mock(() => {
				throw new Error("Handler error");
			});
			const goodHandler = mock();

			bus.subscribe("test:event", errorHandler);
			bus.subscribe("test:event", goodHandler);
			bus.emit(createSignal("test:event", null));

			expect(errorHandler).toHaveBeenCalledTimes(1);
			expect(goodHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe("subscribe", () => {
		test("accepts single pattern", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("test:event", handler);
			bus.emit(createSignal("test:event", null));

			expect(handler).toHaveBeenCalledTimes(1);
		});

		test("accepts array of patterns", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe(["analysis:complete", "trade:proposed"], handler);
			bus.emit(createSignal("analysis:complete", null));
			bus.emit(createSignal("trade:proposed", null));
			bus.emit(createSignal("other:event", null));

			expect(handler).toHaveBeenCalledTimes(2);
		});

		test("accepts glob patterns", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("node:*:completed", handler);
			bus.emit(createSignal("node:analyst:completed", null));
			bus.emit(createSignal("node:trader:completed", null));
			bus.emit(createSignal("node:other:activated", null));

			expect(handler).toHaveBeenCalledTimes(2);
		});

		test("accepts regex patterns", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe(/^(analysis|trade):complete$/, handler);
			bus.emit(createSignal("analysis:complete", null));
			bus.emit(createSignal("trade:complete", null));
			bus.emit(createSignal("review:complete", null));

			expect(handler).toHaveBeenCalledTimes(2);
		});

		test("returns unsubscribe function", () => {
			const bus = new SignalBus();
			const handler = mock();

			const unsubscribe = bus.subscribe("test:event", handler);
			bus.emit(createSignal("test:event", null));
			expect(handler).toHaveBeenCalledTimes(1);

			unsubscribe();
			bus.emit(createSignal("test:event", null));
			expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
		});

		test("unsubscribe only removes specific subscription", () => {
			const bus = new SignalBus();
			const handler1 = mock();
			const handler2 = mock();

			const unsubscribe1 = bus.subscribe("test:event", handler1);
			bus.subscribe("test:event", handler2);

			unsubscribe1();
			bus.emit(createSignal("test:event", null));

			expect(handler1).not.toHaveBeenCalled();
			expect(handler2).toHaveBeenCalledTimes(1);
		});
	});

	describe("history", () => {
		test("returns empty array initially", () => {
			const bus = new SignalBus();
			expect(bus.history()).toEqual([]);
		});

		test("returns readonly array", () => {
			const bus = new SignalBus();
			bus.emit(createSignal("test", null));

			const history = bus.history();
			expect(Array.isArray(history)).toBe(true);
			expect(history.length).toBe(1);
		});
	});

	describe("clearHistory", () => {
		test("removes all signals from history", () => {
			const bus = new SignalBus();
			bus.emit(createSignal("event:1", 1));
			bus.emit(createSignal("event:2", 2));

			expect(bus.history().length).toBe(2);

			bus.clearHistory();

			expect(bus.history().length).toBe(0);
		});
	});

	describe("subscriptionCount", () => {
		test("returns 0 initially", () => {
			const bus = new SignalBus();
			expect(bus.subscriptionCount()).toBe(0);
		});

		test("increments on subscribe", () => {
			const bus = new SignalBus();
			bus.subscribe("test:1", () => {});
			expect(bus.subscriptionCount()).toBe(1);

			bus.subscribe("test:2", () => {});
			expect(bus.subscriptionCount()).toBe(2);
		});

		test("decrements on unsubscribe", () => {
			const bus = new SignalBus();
			const unsub1 = bus.subscribe("test:1", () => {});
			const unsub2 = bus.subscribe("test:2", () => {});
			expect(bus.subscriptionCount()).toBe(2);

			unsub1();
			expect(bus.subscriptionCount()).toBe(1);

			unsub2();
			expect(bus.subscriptionCount()).toBe(0);
		});
	});

	describe("wildcards integration", () => {
		test("handles * wildcard for single segment", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("state:*:changed", handler);

			bus.emit(createSignal("state:analysis:changed", null));
			bus.emit(createSignal("state:trades:changed", null));
			bus.emit(createSignal("state:nested:path:changed", null)); // should NOT match

			expect(handler).toHaveBeenCalledTimes(2);
		});

		test("handles ** wildcard for multiple segments", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("provider:**", handler);

			bus.emit(createSignal("provider:claude", null));
			bus.emit(createSignal("provider:claude:text:delta", null));
			bus.emit(createSignal("provider:openai:response", null));
			bus.emit(createSignal("other:event", null)); // should NOT match

			expect(handler).toHaveBeenCalledTimes(3);
		});

		test("handles suffix * wildcard", () => {
			const bus = new SignalBus();
			const handler = mock();

			bus.subscribe("harness:*", handler);

			bus.emit(createSignal("harness:start", null));
			bus.emit(createSignal("harness:end", null));
			bus.emit(createSignal("harness:node:activated", null)); // should NOT match

			expect(handler).toHaveBeenCalledTimes(2);
		});
	});
});
