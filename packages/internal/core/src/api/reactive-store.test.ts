/**
 * Tests for reactive store.
 *
 * E2: State as Signals
 */

import { describe, it, expect, vi } from "vitest";
import {
	createReactiveStore,
	connectStoreToBus,
	type StateChangePayload,
} from "./reactive-store.js";
import type { Signal } from "@signals/core";

// ============================================================================
// Basic Functionality
// ============================================================================

describe("createReactiveStore", () => {
	describe("state access", () => {
		it("provides access to initial state", () => {
			const store = createReactiveStore({
				count: 0,
				name: "test",
			});

			expect(store.state.count).toBe(0);
			expect(store.state.name).toBe("test");
		});

		it("allows state mutations", () => {
			const store = createReactiveStore({
				count: 0,
			});

			store.state.count = 5;
			expect(store.state.count).toBe(5);
		});

		it("handles nested state access", () => {
			const store = createReactiveStore({
				user: {
					name: "Alice",
					settings: { theme: "dark" },
				},
			});

			expect(store.state.user.name).toBe("Alice");
			expect(store.state.user.settings.theme).toBe("dark");
		});

		it("handles nested state mutations", () => {
			const store = createReactiveStore({
				user: {
					name: "Alice",
					settings: { theme: "dark" },
				},
			});

			store.state.user.name = "Bob";
			store.state.user.settings.theme = "light";

			expect(store.state.user.name).toBe("Bob");
			expect(store.state.user.settings.theme).toBe("light");
		});
	});

	describe("signal emission", () => {
		it("emits signal on property change", () => {
			const store = createReactiveStore({ count: 0 });
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((signal) => signals.push(signal));
			store.state.count = 1;

			expect(signals).toHaveLength(1);
			expect(signals[0].name).toBe("state:count:changed");
			expect(signals[0].payload.key).toBe("count");
			expect(signals[0].payload.oldValue).toBe(0);
			expect(signals[0].payload.newValue).toBe(1);
		});

		it("emits signal with full path for nested changes", () => {
			const store = createReactiveStore({
				user: { settings: { theme: "dark" } },
			});
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((signal) => signals.push(signal));
			store.state.user.settings.theme = "light";

			expect(signals).toHaveLength(1);
			expect(signals[0].name).toBe("state:user.settings.theme:changed");
			expect(signals[0].payload.path).toBe("user.settings.theme");
		});

		it("does not emit signal when value unchanged", () => {
			const store = createReactiveStore({ count: 5 });
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((signal) => signals.push(signal));
			store.state.count = 5; // Same value

			expect(signals).toHaveLength(0);
		});

		it("emits multiple signals for multiple changes", () => {
			const store = createReactiveStore({ a: 1, b: 2 });
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((signal) => signals.push(signal));
			store.state.a = 10;
			store.state.b = 20;

			expect(signals).toHaveLength(2);
			expect(signals[0].name).toBe("state:a:changed");
			expect(signals[1].name).toBe("state:b:changed");
		});
	});

	describe("subscription", () => {
		it("supports multiple subscribers", () => {
			const store = createReactiveStore({ count: 0 });
			const calls1: number[] = [];
			const calls2: number[] = [];

			store.subscribe((s) => calls1.push(s.payload.newValue as number));
			store.subscribe((s) => calls2.push(s.payload.newValue as number));

			store.state.count = 1;

			expect(calls1).toEqual([1]);
			expect(calls2).toEqual([1]);
		});

		it("returns unsubscribe function", () => {
			const store = createReactiveStore({ count: 0 });
			const signals: Signal<StateChangePayload>[] = [];

			const unsubscribe = store.subscribe((s) => signals.push(s));

			store.state.count = 1;
			expect(signals).toHaveLength(1);

			unsubscribe();

			store.state.count = 2;
			expect(signals).toHaveLength(1); // No new signal after unsubscribe
		});
	});

	describe("getSnapshot", () => {
		it("returns current state", () => {
			const store = createReactiveStore({ count: 0 });
			store.state.count = 5;

			const snapshot = store.getSnapshot();
			expect(snapshot.count).toBe(5);
		});

		it("returns immutable snapshot", () => {
			const store = createReactiveStore({ count: 0 });
			const snapshot = store.getSnapshot();

			// Modifying snapshot should not affect store
			(snapshot as { count: number }).count = 999;
			expect(store.state.count).toBe(0);
		});
	});

	describe("history", () => {
		it("tracks all emitted signals", () => {
			const store = createReactiveStore({ count: 0 });

			store.state.count = 1;
			store.state.count = 2;
			store.state.count = 3;

			const history = store.history();
			expect(history).toHaveLength(3);
			expect(history[0].payload.newValue).toBe(1);
			expect(history[1].payload.newValue).toBe(2);
			expect(history[2].payload.newValue).toBe(3);
		});
	});

	describe("batch", () => {
		it("batches multiple changes into single signal", () => {
			const store = createReactiveStore({ a: 1, b: 2, c: 3 });
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((s) => signals.push(s));

			store.batch((state) => {
				state.a = 10;
				state.b = 20;
				state.c = 30;
			});

			// Should emit single batch signal
			expect(signals).toHaveLength(1);
			expect(signals[0].name).toBe("state:batch:changed");
		});

		it("includes all changes in batch signal", () => {
			const store = createReactiveStore({ a: 1, b: 2 });
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((s) => signals.push(s));

			store.batch((state) => {
				state.a = 10;
				state.b = 20;
			});

			const changes = signals[0].payload.newValue as Array<{
				path: string;
				newValue: unknown;
			}>;
			expect(changes).toHaveLength(2);
			expect(changes[0]).toEqual({ path: "a", newValue: 10 });
			expect(changes[1]).toEqual({ path: "b", newValue: 20 });
		});

		it("does not emit if no changes in batch", () => {
			const store = createReactiveStore({ count: 5 });
			const signals: Signal<StateChangePayload>[] = [];

			store.subscribe((s) => signals.push(s));

			store.batch((state) => {
				state.count = 5; // No change
			});

			expect(signals).toHaveLength(0);
		});
	});
});

// ============================================================================
// Bus Integration
// ============================================================================

describe("connectStoreToBus", () => {
	it("emits store signals to bus", () => {
		const store = createReactiveStore({ count: 0 });
		const busEmits: Signal[] = [];
		const mockBus = { emit: (s: Signal) => busEmits.push(s) };

		connectStoreToBus(store, mockBus);
		store.state.count = 1;

		expect(busEmits).toHaveLength(1);
		expect(busEmits[0].name).toBe("state:count:changed");
	});

	it("returns unsubscribe function", () => {
		const store = createReactiveStore({ count: 0 });
		const busEmits: Signal[] = [];
		const mockBus = { emit: (s: Signal) => busEmits.push(s) };

		const disconnect = connectStoreToBus(store, mockBus);
		store.state.count = 1;
		expect(busEmits).toHaveLength(1);

		disconnect();
		store.state.count = 2;
		expect(busEmits).toHaveLength(1); // No new emit
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
	it("handles null values", () => {
		const store = createReactiveStore<{ value: string | null }>({
			value: "hello",
		});
		const signals: Signal<StateChangePayload>[] = [];

		store.subscribe((s) => signals.push(s));
		store.state.value = null;

		expect(signals).toHaveLength(1);
		expect(signals[0].payload.oldValue).toBe("hello");
		expect(signals[0].payload.newValue).toBe(null);
	});

	it("handles boolean values", () => {
		const store = createReactiveStore({ enabled: false });
		const signals: Signal<StateChangePayload>[] = [];

		store.subscribe((s) => signals.push(s));
		store.state.enabled = true;

		expect(signals).toHaveLength(1);
		expect(signals[0].payload.newValue).toBe(true);
	});

	it("handles array values (replaced, not mutated)", () => {
		const store = createReactiveStore<{ items: number[] }>({
			items: [1, 2, 3],
		});
		const signals: Signal<StateChangePayload>[] = [];

		store.subscribe((s) => signals.push(s));
		store.state.items = [4, 5, 6];

		expect(signals).toHaveLength(1);
		expect(signals[0].payload.newValue).toEqual([4, 5, 6]);
	});

	it("includes source metadata when provided", () => {
		const store = createReactiveStore(
			{ count: 0 },
			{ agent: "test-agent" },
		);
		const signals: Signal<StateChangePayload>[] = [];

		store.subscribe((s) => signals.push(s));
		store.state.count = 1;

		expect(signals[0].source?.agent).toBe("test-agent");
	});
});
