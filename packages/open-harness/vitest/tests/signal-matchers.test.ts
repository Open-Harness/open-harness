/**
 * Tests for signal matchers.
 *
 * These tests validate the signal matcher functions and the full
 * integration with vitest's expect.extend().
 */

import { createSignal, type Signal } from "@internal/signals-core";
import { beforeAll, describe, expect, it } from "vitest";
import { matchers, signalMatchers } from "../src/matchers.js";

// Set up matchers once before all tests using vitest's expect
beforeAll(() => {
	expect.extend(matchers);
	expect.extend(signalMatchers);
});

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
		it("matches exact signal name", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "harness:start");
			expect(result.pass).toBe(true);
		});

		it("matches signal with glob pattern", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "agent:*");
			expect(result.pass).toBe(true);
		});

		it("matches signal with ** glob pattern", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "provider:**");
			expect(result.pass).toBe(true);
		});

		it("returns false when signal not found", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, "nonexistent:signal");
			expect(result.pass).toBe(false);
			expect(result.message()).toContain("no match found");
		});

		it("matches signal with name and partial payload", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { agent: "analyst" },
			});
			expect(result.pass).toBe(true);
		});

		it("matches signal with exact payload", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { agent: "analyst", confidence: 0.85 },
			});
			expect(result.pass).toBe(true);
		});

		it("returns false when payload does not match", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { agent: "wrong-agent" },
			});
			expect(result.pass).toBe(false);
		});

		it("returns false when payload value does not match", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, {
				name: "analysis:complete",
				payload: { confidence: 0.5 },
			});
			expect(result.pass).toBe(false);
		});

		it("matches with regex pattern", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toContainSignal(signals, /^provider:/);
			expect(result.pass).toBe(true);
		});
	});

	describe("toHaveSignalCount", () => {
		it("counts matching signals correctly", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "agent:activated", 2);
			expect(result.pass).toBe(true);
		});

		it("counts provider signals with glob", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "provider:*", 4);
			expect(result.pass).toBe(true);
		});

		it("returns false when count does not match", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "agent:activated", 5);
			expect(result.pass).toBe(false);
			expect(result.message()).toContain("Expected 5");
			expect(result.message()).toContain("found 2");
		});

		it("counts zero when no matches", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalCount(signals, "nonexistent", 0);
			expect(result.pass).toBe(true);
		});

		it("counts with payload matcher", () => {
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
		it("verifies signals appear in order", () => {
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

		it("detects missing signals", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalsInOrder(signals, ["harness:start", "missing:signal", "harness:end"]);
			expect(result.pass).toBe(false);
			expect(result.message()).toContain("missing");
		});

		it("works with glob patterns in order", () => {
			const signals = createTestSignals();
			const result = signalMatchers.toHaveSignalsInOrder(signals, ["harness:*", "agent:*", "provider:*", "harness:*"]);
			expect(result.pass).toBe(true);
		});

		it("handles repeated patterns finding next occurrence", () => {
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
	it("matches nested objects", () => {
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

	it("matches arrays partially", () => {
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

describe("vitest integration", () => {
	it("works with expect().toContainSignal()", () => {
		const signals = createTestSignals();
		expect(signals).toContainSignal("harness:start");
	});

	it("works with expect().not.toContainSignal()", () => {
		const signals = createTestSignals();
		expect(signals).not.toContainSignal("nonexistent:signal");
	});

	it("works with expect().toHaveSignalCount()", () => {
		const signals = createTestSignals();
		expect(signals).toHaveSignalCount("agent:activated", 2);
	});

	it("works with expect().toHaveSignalsInOrder()", () => {
		const signals = createTestSignals();
		expect(signals).toHaveSignalsInOrder(["harness:start", "agent:activated", "harness:end"]);
	});
});
