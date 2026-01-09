/**
 * Tests for signal matchers.
 *
 * Note: We test the signalMatchers object directly since bun:test
 * has a different expect API than vitest. setupMatchers is tested
 * separately in integration with actual vitest.
 */
import { describe, expect, test } from "bun:test";
import { createSignal, type Signal } from "@signals/core";
import { signalMatchers } from "../src/matchers.js";

// Helper to create test signals
function createTestSignals(): Signal[] {
	return [
		createSignal("harness:start", { agents: ["analyst", "executor"] }),
		createSignal("agent:activated", { agent: "analyst", trigger: "harness:start" }),
		createSignal("provider:start", {}),
		createSignal("text:delta", { content: "Hello" }),
		createSignal("text:delta", { content: " world" }),
		createSignal("provider:end", { output: "Hello world", usage: { inputTokens: 10 } }),
		createSignal("analysis:complete", { agent: "analyst", confidence: 0.85 }),
		createSignal("agent:activated", { agent: "executor", trigger: "analysis:complete" }),
		createSignal("provider:start", {}),
		createSignal("provider:end", { output: "Done", usage: { inputTokens: 20 } }),
		createSignal("harness:end", { durationMs: 100 }),
	];
}

describe("signalMatchers", () => {
	describe("toContainSignal", () => {
		test("matches exact signal name", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "harness:start");
			expect(result.pass).toBe(true);
		});

		test("matches signal with glob pattern", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "agent:*");
			expect(result.pass).toBe(true);
		});

		test("matches signal with ** glob pattern", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "provider:**");
			expect(result.pass).toBe(true);
		});

		test("returns false when signal not found", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "nonexistent:signal");
			expect(result.pass).toBe(false);
			expect(result.message()).toContain("no match found");
		});

		test("matches signal with name and partial payload", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { agent: "analyst" },
			});
			expect(result.pass).toBe(true);
		});

		test("matches signal with exact payload", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { agent: "analyst", confidence: 0.85 },
			});
			expect(result.pass).toBe(true);
		});

		test("returns false when payload does not match", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { agent: "wrong-agent" },
			});
			expect(result.pass).toBe(false);
		});

		test("returns false when payload value does not match", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { confidence: 0.5 },
			});
			expect(result.pass).toBe(false);
		});

		test("matches with regex pattern", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, /^provider:/);
			expect(result.pass).toBe(true);
		});
	});

	describe("toHaveSignalCount", () => {
		test("counts matching signals correctly", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "agent:activated", 2);
			expect(result.pass).toBe(true);
		});

		test("counts provider signals with glob", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "provider:*", 4);
			expect(result.pass).toBe(true);
		});

		test("returns false when count does not match", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "agent:activated", 5);
			expect(result.pass).toBe(false);
			expect(result.message()).toContain("Expected 5");
			expect(result.message()).toContain("found 2");
		});

		test("counts zero when no matches", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "nonexistent", 0);
			expect(result.pass).toBe(true);
		});

		test("counts with payload matcher", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(
				signals,
				{ name: "agent:activated", payload: { agent: "analyst" } },
				1,
			);
			expect(result.pass).toBe(true);
		});
	});

	describe("toHaveSignalsInOrder", () => {
		test("verifies signals appear in order", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalsInOrder(signals, [
				"harness:start",
				"agent:activated",
				"provider:start",
				"provider:end",
				"harness:end",
			]);
			expect(result.pass).toBe(true);
		});

		test("detects missing signals", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalsInOrder(signals, [
				"harness:start",
				"missing:signal",
				"harness:end",
			]);
			expect(result.pass).toBe(false);
			expect(result.message()).toContain("missing");
		});

		test("works with glob patterns in order", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalsInOrder(signals, [
				"harness:*",
				"agent:*",
				"provider:*",
				"harness:*",
			]);
			expect(result.pass).toBe(true);
		});

		test("handles repeated patterns finding next occurrence", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalsInOrder(signals, [
				"provider:start",
				"provider:end",
				"provider:start",
				"provider:end",
			]);
			expect(result.pass).toBe(true);
		});
	});
});

describe("deep partial matching", () => {
	test("matches nested objects", () => {
		const signals = [
			createSignal("test:signal", {
				outer: {
					inner: {
						value: 42,
						other: "data",
					},
					sibling: true,
				},
			}),
		];

		const result = signalMatchers.toContainSignal(signals, {
			name: "test:signal",
			payload: {
				outer: {
					inner: {
						value: 42,
					},
				},
			},
		});
		expect(result.pass).toBe(true);
	});

	test("matches arrays partially", () => {
		const signals = [
			createSignal("test:signal", {
				items: ["a", "b", "c"],
			}),
		];

		const result = signalMatchers.toContainSignal(signals, {
			name: "test:signal",
			payload: {
				items: ["a", "b", "c"],
			},
		});
		expect(result.pass).toBe(true);
	});
});
