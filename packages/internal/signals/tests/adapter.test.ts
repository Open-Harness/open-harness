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

	describe("adapter receives pure data signals", () => {
		it("receives signals with payload data", () => {
			let receivedPayload: unknown;

			const adapter = createAdapter({
				name: "payload-test",
				onSignal: (signal) => {
					receivedPayload = signal.payload;
				},
			});

			const signal = createSignal("plan:created", { taskCount: 5, milestones: ["M1", "M2"] });

			adapter.onSignal(signal);

			expect(receivedPayload).toEqual({ taskCount: 5, milestones: ["M1", "M2"] });
		});

		it("receives signal metadata (id, name, timestamp)", () => {
			let receivedSignal: unknown;

			const adapter = createAdapter({
				name: "metadata-test",
				onSignal: (signal) => {
					receivedSignal = signal;
				},
			});

			const signal = createSignal("task:complete", { taskName: "Deploy" });
			adapter.onSignal(signal);

			const sig = receivedSignal as { id: string; name: string; timestamp: string };
			expect(sig.id).toBeDefined();
			expect(sig.name).toBe("task:complete");
			// Timestamp is an ISO string
			expect(typeof sig.timestamp).toBe("string");
			expect(sig.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/); // ISO date format
		});

		it("signals are pure data without display metadata", () => {
			let receivedSignal: unknown;

			const adapter = createAdapter({
				name: "pure-data-test",
				onSignal: (signal) => {
					receivedSignal = signal;
				},
			});

			const signal = createSignal("simple:signal", { data: "test" });
			adapter.onSignal(signal);

			// Signals are pure data - no display property exists
			const sig = receivedSignal as Record<string, unknown>;
			expect(sig).not.toHaveProperty("display");
			expect(sig).toHaveProperty("id");
			expect(sig).toHaveProperty("name");
			expect(sig).toHaveProperty("payload");
			expect(sig).toHaveProperty("timestamp");
		});
	});
});
