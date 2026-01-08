/**
 * Tests for Open Harness Vitest matchers.
 *
 * These tests validate the matcher functions directly.
 * Integration testing with expect.extend() requires vitest runtime.
 */
import { describe, expect, test } from "bun:test";
import type { RunResult } from "@open-harness/core";
import { matchers } from "../src/matchers.js";

// Create a mock RunResult for testing
function createMockResult(
	overrides: { latencyMs?: number; cost?: number; inputTokens?: number; outputTokens?: number } = {},
): RunResult {
	return {
		output: "test output",
		metrics: {
			latencyMs: overrides.latencyMs ?? 1000,
			cost: overrides.cost ?? 0.005,
			tokens: {
				input: overrides.inputTokens ?? 100,
				output: overrides.outputTokens ?? 50,
			},
		},
	};
}

describe("matchers", () => {
	describe("toHaveLatencyUnder", () => {
		test("passes when latency is below threshold", () => {
			const result = createMockResult({ latencyMs: 500 });
			const outcome = matchers.toHaveLatencyUnder(result, 1000);

			expect(outcome.pass).toBe(true);
			expect(outcome.message()).toContain("Expected latency >= 1000ms");
		});

		test("fails when latency is above threshold", () => {
			const result = createMockResult({ latencyMs: 1500 });
			const outcome = matchers.toHaveLatencyUnder(result, 1000);

			expect(outcome.pass).toBe(false);
			expect(outcome.message()).toContain("Expected latency < 1000ms");
			expect(outcome.message()).toContain("got 1500ms");
		});

		test("fails when latency equals threshold", () => {
			const result = createMockResult({ latencyMs: 1000 });
			const outcome = matchers.toHaveLatencyUnder(result, 1000);

			expect(outcome.pass).toBe(false);
		});
	});

	describe("toCostUnder", () => {
		test("passes when cost is below threshold", () => {
			const result = createMockResult({ cost: 0.005 });
			const outcome = matchers.toCostUnder(result, 0.01);

			expect(outcome.pass).toBe(true);
			expect(outcome.message()).toContain("Expected cost >= $0.01");
		});

		test("fails when cost is above threshold", () => {
			const result = createMockResult({ cost: 0.015 });
			const outcome = matchers.toCostUnder(result, 0.01);

			expect(outcome.pass).toBe(false);
			expect(outcome.message()).toContain("Expected cost < $0.01");
			expect(outcome.message()).toContain("got $0.015");
		});

		test("fails when cost equals threshold", () => {
			const result = createMockResult({ cost: 0.01 });
			const outcome = matchers.toCostUnder(result, 0.01);

			expect(outcome.pass).toBe(false);
		});
	});

	describe("toHaveTokensUnder", () => {
		test("passes when total tokens is below threshold", () => {
			const result = createMockResult({ inputTokens: 100, outputTokens: 50 });
			const outcome = matchers.toHaveTokensUnder(result, 200);

			expect(outcome.pass).toBe(true);
			expect(outcome.message()).toContain("Expected tokens >= 200");
		});

		test("fails when total tokens is above threshold", () => {
			const result = createMockResult({ inputTokens: 150, outputTokens: 100 });
			const outcome = matchers.toHaveTokensUnder(result, 200);

			expect(outcome.pass).toBe(false);
			expect(outcome.message()).toContain("Expected tokens < 200");
			expect(outcome.message()).toContain("got 250");
		});

		test("fails when total tokens equals threshold", () => {
			const result = createMockResult({ inputTokens: 100, outputTokens: 100 });
			const outcome = matchers.toHaveTokensUnder(result, 200);

			expect(outcome.pass).toBe(false);
		});

		test("sums input and output tokens correctly", () => {
			const result = createMockResult({ inputTokens: 123, outputTokens: 456 });
			const outcome = matchers.toHaveTokensUnder(result, 579);

			expect(outcome.pass).toBe(false);
			expect(outcome.message()).toContain("got 579");
		});
	});
});
