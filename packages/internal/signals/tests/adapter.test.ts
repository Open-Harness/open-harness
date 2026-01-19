/**
 * Tests for SignalAdapter interface and createAdapter factory
 */

import { describe, expect, it, mock } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { createAdapter, type SignalAdapter } from "../src/adapter.js";

describe("SignalAdapter", () => {
	describe("interface compliance", () => {
		it("allows sync onSignal handler", () => {
			const receivedSignals: string[] = [];

			const adapter: SignalAdapter = {
				name: "sync-test",
				patterns: ["*"],
				onSignal: (signal) => {
					receivedSignals.push(signal.name);
				},
			};

			const signal = createSignal("test:signal", { data: "hello" });
			adapter.onSignal(signal);

			expect(receivedSignals).toEqual(["test:signal"]);
		});

		it("allows async onSignal handler", async () => {
			const receivedSignals: string[] = [];

			const adapter: SignalAdapter = {
				name: "async-test",
				patterns: ["*"],
				onSignal: async (signal) => {
					await Promise.resolve();
					receivedSignals.push(signal.name);
				},
			};

			const signal = createSignal("test:signal", { data: "hello" });
			await adapter.onSignal(signal);

			expect(receivedSignals).toEqual(["test:signal"]);
		});

		it("allows optional onStart lifecycle method", async () => {
			const onStart = mock(() => {});

			const adapter: SignalAdapter = {
				name: "lifecycle-test",
				patterns: ["*"],
				onSignal: () => {},
				onStart,
			};

			await adapter.onStart?.();

			expect(onStart).toHaveBeenCalledTimes(1);
		});

		it("allows optional onStop lifecycle method", async () => {
			const onStop = mock(() => {});

			const adapter: SignalAdapter = {
				name: "lifecycle-test",
				patterns: ["*"],
				onSignal: () => {},
				onStop,
			};

			await adapter.onStop?.();

			expect(onStop).toHaveBeenCalledTimes(1);
		});

		it("allows async lifecycle methods", async () => {
			let startCalled = false;
			let stopCalled = false;

			const adapter: SignalAdapter = {
				name: "async-lifecycle-test",
				patterns: ["*"],
				onSignal: () => {},
				onStart: async () => {
					await Promise.resolve();
					startCalled = true;
				},
				onStop: async () => {
					await Promise.resolve();
					stopCalled = true;
				},
			};

			await adapter.onStart?.();
			await adapter.onStop?.();

			expect(startCalled).toBe(true);
			expect(stopCalled).toBe(true);
		});

		it("allows multiple patterns", () => {
			const adapter: SignalAdapter = {
				name: "multi-pattern",
				patterns: ["plan:*", "task:*", "workflow:complete"],
				onSignal: () => {},
			};

			expect(adapter.patterns).toHaveLength(3);
			expect(adapter.patterns).toContain("plan:*");
			expect(adapter.patterns).toContain("task:*");
			expect(adapter.patterns).toContain("workflow:complete");
		});
	});

	describe("createAdapter", () => {
		it("creates adapter with required fields", () => {
			const adapter = createAdapter({
				name: "minimal",
				onSignal: () => {},
			});

			expect(adapter.name).toBe("minimal");
			expect(typeof adapter.onSignal).toBe("function");
		});

		it("defaults patterns to ['*'] when not specified", () => {
			const adapter = createAdapter({
				name: "default-patterns",
				onSignal: () => {},
			});

			expect(adapter.patterns).toEqual(["*"]);
		});

		it("uses custom patterns when specified", () => {
			const adapter = createAdapter({
				name: "custom-patterns",
				patterns: ["test:*", "other:*"],
				onSignal: () => {},
			});

			expect(adapter.patterns).toEqual(["test:*", "other:*"]);
		});

		it("includes optional onStart when provided", () => {
			const onStart = mock(() => {});

			const adapter = createAdapter({
				name: "with-start",
				onSignal: () => {},
				onStart,
			});

			expect(adapter.onStart).toBe(onStart);
		});

		it("includes optional onStop when provided", () => {
			const onStop = mock(() => {});

			const adapter = createAdapter({
				name: "with-stop",
				onSignal: () => {},
				onStop,
			});

			expect(adapter.onStop).toBe(onStop);
		});

		it("creates functional adapter that processes signals", () => {
			const receivedPayloads: unknown[] = [];

			const adapter = createAdapter({
				name: "functional",
				onSignal: (signal) => {
					receivedPayloads.push(signal.payload);
				},
			});

			const signal = createSignal("test", { value: 42 });
			adapter.onSignal(signal);

			expect(receivedPayloads).toEqual([{ value: 42 }]);
		});

		it("creates async adapter that processes signals", async () => {
			const receivedPayloads: unknown[] = [];

			const adapter = createAdapter({
				name: "async-functional",
				onSignal: async (signal) => {
					await Promise.resolve();
					receivedPayloads.push(signal.payload);
				},
			});

			const signal = createSignal("test", { value: 42 });
			await adapter.onSignal(signal);

			expect(receivedPayloads).toEqual([{ value: 42 }]);
		});

		it("preserves complete lifecycle for full workflow", async () => {
			const events: string[] = [];

			const adapter = createAdapter({
				name: "full-workflow",
				patterns: ["task:*"],
				onStart: () => {
					events.push("start");
				},
				onSignal: (signal) => {
					events.push(`signal:${signal.name}`);
				},
				onStop: () => {
					events.push("stop");
				},
			});

			// Simulate full lifecycle
			await adapter.onStart?.();
			adapter.onSignal(createSignal("task:ready", {}));
			adapter.onSignal(createSignal("task:complete", {}));
			await adapter.onStop?.();

			expect(events).toEqual(["start", "signal:task:ready", "signal:task:complete", "stop"]);
		});
	});

	describe("adapter with display metadata", () => {
		it("receives signals with display metadata", () => {
			let receivedDisplay: unknown;

			const adapter = createAdapter({
				name: "display-test",
				onSignal: (signal) => {
					receivedDisplay = signal.display;
				},
			});

			const signal = createSignal(
				"plan:created",
				{ taskCount: 5 },
				{
					display: {
						type: "notification",
						title: "Plan created",
						status: "success",
						icon: "✓",
					},
				},
			);

			adapter.onSignal(signal);

			expect(receivedDisplay).toEqual({
				type: "notification",
				title: "Plan created",
				status: "success",
				icon: "✓",
			});
		});

		it("handles signals without display metadata", () => {
			let receivedDisplay: unknown = "not-set";

			const adapter = createAdapter({
				name: "no-display-test",
				onSignal: (signal) => {
					receivedDisplay = signal.display;
				},
			});

			const signal = createSignal("simple:signal", { data: "test" });
			adapter.onSignal(signal);

			expect(receivedDisplay).toBeUndefined();
		});

		it("receives dynamic title function in display", () => {
			let receivedSignal: unknown;

			const adapter = createAdapter({
				name: "dynamic-title-test",
				onSignal: (signal) => {
					receivedSignal = signal;
				},
			});

			const signal = createSignal(
				"task:complete",
				{ taskName: "Deploy" },
				{
					display: {
						type: "notification",
						title: (payload: unknown) => `Completed: ${(payload as { taskName: string }).taskName}`,
						status: "success",
					},
				},
			);

			adapter.onSignal(signal);

			// Verify the signal has the display with function
			const sig = receivedSignal as { display?: { title?: unknown } };
			expect(typeof sig.display?.title).toBe("function");

			// Verify function works correctly
			const titleFn = sig.display?.title as (p: unknown) => string;
			expect(titleFn({ taskName: "Deploy" })).toBe("Completed: Deploy");
		});
	});
});
