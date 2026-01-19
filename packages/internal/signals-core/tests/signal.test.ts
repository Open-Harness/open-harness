import { describe, expect, test } from "bun:test";
import { createSignal, isSignal, type Signal } from "../src/signal.js";

describe("Signal", () => {
	describe("createSignal", () => {
		test("creates signal with id, name, payload, and auto-timestamp", () => {
			const signal = createSignal("test:event", { value: 42 });

			expect(signal.id).toMatch(/^sig_/);
			expect(signal.name).toBe("test:event");
			expect(signal.payload).toEqual({ value: 42 });
			expect(typeof signal.timestamp).toBe("string");
			expect(new Date(signal.timestamp).getTime()).not.toBeNaN();
		});

		test("includes source when provided via options object", () => {
			const signal = createSignal(
				"analysis:complete",
				{ result: "bullish" },
				{
					source: {
						agent: "analyst",
						parent: "harness:start",
					},
				},
			);

			expect(signal.source?.agent).toBe("analyst");
			expect(signal.source?.parent).toBe("harness:start");
		});

		test("handles primitive payloads", () => {
			const stringSignal = createSignal("log:message", "hello");
			const numberSignal = createSignal("counter:increment", 1);
			const nullSignal = createSignal("state:cleared", null);

			expect(stringSignal.payload).toBe("hello");
			expect(numberSignal.payload).toBe(1);
			expect(nullSignal.payload).toBe(null);
		});

		test("maintains backward compatibility with legacy source parameter", () => {
			// Old API: createSignal(name, payload, source)
			const signal = createSignal("test:event", { value: 1 }, { agent: "legacy-agent" });

			expect(signal.source?.agent).toBe("legacy-agent");
		});

		test("supports source with harness field", () => {
			const signal = createSignal("harness:event", { data: "test" }, { harness: "test-harness" });

			expect(signal.source?.harness).toBe("test-harness");
		});

		test("supports source with parent field for causality chains", () => {
			const signal = createSignal("child:event", {}, { parent: "sig_parent123" });

			expect(signal.source?.parent).toBe("sig_parent123");
		});

		test("supports full source with all fields", () => {
			const signal = createSignal(
				"test:complete",
				{ result: "ok" },
				{
					source: {
						agent: "worker",
						harness: "main-harness",
						parent: "sig_trigger456",
					},
				},
			);

			expect(signal.source?.agent).toBe("worker");
			expect(signal.source?.harness).toBe("main-harness");
			expect(signal.source?.parent).toBe("sig_trigger456");
		});

		test("creates signal without source when no options provided", () => {
			const signal = createSignal("simple:event", { foo: "bar" });

			expect(signal.source).toBeUndefined();
		});
	});

	describe("isSignal", () => {
		test("returns true for valid signals", () => {
			const signal = createSignal("test:event", { foo: "bar" });
			expect(isSignal(signal)).toBe(true);
		});

		test("returns true for manually constructed signals", () => {
			const manual: Signal = {
				id: "sig_test123",
				name: "manual:signal",
				payload: undefined,
				timestamp: "2026-01-09T12:00:00.000Z",
			};
			expect(isSignal(manual)).toBe(true);
		});

		test("returns false for non-objects", () => {
			expect(isSignal(null)).toBe(false);
			expect(isSignal(undefined)).toBe(false);
			expect(isSignal("string")).toBe(false);
			expect(isSignal(42)).toBe(false);
		});

		test("returns false for objects missing required fields", () => {
			expect(isSignal({})).toBe(false);
			expect(isSignal({ name: "test" })).toBe(false);
			expect(isSignal({ name: "test", payload: {} })).toBe(false);
			expect(isSignal({ payload: {}, timestamp: "2026-01-09" })).toBe(false);
		});

		test("returns false for wrong field types", () => {
			expect(isSignal({ name: 123, payload: {}, timestamp: "2026-01-09" })).toBe(false);
			expect(isSignal({ name: "test", payload: {}, timestamp: 123 })).toBe(false);
		});

		test("returns true for signals with source", () => {
			const signal = createSignal(
				"test:event",
				{ foo: "bar" },
				{
					source: { agent: "test-agent" },
				},
			);
			expect(isSignal(signal)).toBe(true);
		});
	});
});
