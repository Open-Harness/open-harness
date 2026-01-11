/**
 * Tests for eval comparison functions.
 *
 * These tests verify baseline comparison, cross-dimensional analysis,
 * and flake detection.
 */

import { describe, it, expect } from "bun:test";
import { compareToBaseline, compareAcross, detectFlakes } from "../../src/eval/compare.js";
import {
	createMockCaseResult,
	createMockDatasetResult,
} from "./fixtures/mock-artifact.js";

describe("compareToBaseline", () => {
	it("detects assertion regressions", () => {
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 3,
			passRate: 1.0, // All passing
		});

		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 3,
			passRate: 0.67, // 2 passing, 1 failing
		});

		const result = compareToBaseline(baseline, candidate);

		expect(result.baselineVariantId).toBe("baseline");
		expect(result.regressions.length).toBeGreaterThan(0);

		// Find the assertion regression
		const assertionRegression = result.regressions.find(
			(r) => r.type === "assertion",
		);
		expect(assertionRegression).toBeDefined();
		expect(assertionRegression?.description).toContain("was passing but now fails");
	});

	it("detects metric regressions (latency)", () => {
		// Create baseline with fast latency
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 1,
		});
		baseline.caseResults[0] = createMockCaseResult({
			caseId: "case-1",
			variantId: "baseline",
			passed: true,
			durationMs: 1000, // Fast
		});

		// Create candidate with slow latency (50% increase > 20% threshold)
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 1,
		});
		candidate.caseResults[0] = createMockCaseResult({
			caseId: "case-1",
			variantId: "candidate",
			passed: true,
			durationMs: 1500, // 50% slower
		});

		const result = compareToBaseline(baseline, candidate);

		const metricRegression = result.regressions.find(
			(r) => r.type === "metric" && r.description.includes("Latency"),
		);
		expect(metricRegression).toBeDefined();
		expect(metricRegression?.baseline).toBe(1000);
		expect(metricRegression?.current).toBe(1500);
	});

	it("detects score improvements", () => {
		// Create baseline with low score
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 1,
		});
		baseline.caseResults[0] = createMockCaseResult({
			caseId: "case-1",
			variantId: "baseline",
			passed: true,
			overallScore: 0.5,
		});

		// Create candidate with high score (>10% improvement)
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 1,
		});
		candidate.caseResults[0] = createMockCaseResult({
			caseId: "case-1",
			variantId: "candidate",
			passed: true,
			overallScore: 0.9,
		});

		const result = compareToBaseline(baseline, candidate);

		const scoreImprovement = result.improvements.find(
			(r) => r.type === "score",
		);
		expect(scoreImprovement).toBeDefined();
		expect(scoreImprovement?.description).toContain("increased");
	});

	it("detects improvements when failing tests start passing", () => {
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 2,
			passRate: 0.5, // 1 passing, 1 failing
		});

		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 2,
			passRate: 1.0, // All passing
		});

		const result = compareToBaseline(baseline, candidate);

		const assertionImprovement = result.improvements.find(
			(r) => r.type === "assertion",
		);
		expect(assertionImprovement).toBeDefined();
		expect(assertionImprovement?.description).toContain("was failing but now passes");
	});

	it("uses custom thresholds when provided", () => {
		// Create baseline with 1000ms latency
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 1,
		});
		baseline.caseResults[0] = createMockCaseResult({
			caseId: "case-1",
			variantId: "baseline",
			passed: true,
			durationMs: 1000,
		});

		// Create candidate with 1150ms latency (15% increase)
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 1,
		});
		candidate.caseResults[0] = createMockCaseResult({
			caseId: "case-1",
			variantId: "candidate",
			passed: true,
			durationMs: 1150,
		});

		// With default 20% threshold, no regression
		const defaultResult = compareToBaseline(baseline, candidate);
		const defaultLatencyRegression = defaultResult.regressions.find(
			(r) => r.type === "metric" && r.description.includes("Latency"),
		);
		expect(defaultLatencyRegression).toBeUndefined();

		// With custom 10% threshold, should detect regression
		const customResult = compareToBaseline(baseline, candidate, {
			latencyIncrease: 0.1,
		});
		const customLatencyRegression = customResult.regressions.find(
			(r) => r.type === "metric" && r.description.includes("Latency"),
		);
		expect(customLatencyRegression).toBeDefined();
	});
});

describe("compareAcross", () => {
	it("ranks variants by pass rate", () => {
		const results = [
			createMockDatasetResult({ variantId: "variant-a", passRate: 0.5 }),
			createMockDatasetResult({ variantId: "variant-b", passRate: 1.0 }),
			createMockDatasetResult({ variantId: "variant-c", passRate: 0.75 }),
		];

		const comparison = compareAcross(results, "variant");

		expect(comparison.best).toBe("variant-b");
		expect(comparison.worst).toBe("variant-a");

		expect(comparison.byDimension["variant-a"].passRate).toBe(0.5);
		expect(comparison.byDimension["variant-b"].passRate).toBe(1.0);
		expect(comparison.byDimension["variant-c"].passRate).toBe(0.75);
	});

	it("aggregates by case across variants", () => {
		const results = [
			createMockDatasetResult({
				datasetId: "ds",
				variantId: "variant-a",
				numCases: 3,
				passRate: 1.0,
			}),
			createMockDatasetResult({
				datasetId: "ds",
				variantId: "variant-b",
				numCases: 3,
				passRate: 0.67, // case-3 fails
			}),
		];

		const comparison = compareAcross(results, "case");

		// Should have stats for case-1, case-2, case-3
		expect(Object.keys(comparison.byDimension)).toContain("case-1");
		expect(Object.keys(comparison.byDimension)).toContain("case-2");
		expect(Object.keys(comparison.byDimension)).toContain("case-3");
	});

	it("calculates average scores", () => {
		const results = [
			createMockDatasetResult({
				variantId: "variant-a",
				numCases: 2,
				passRate: 1.0,
			}),
		];

		const comparison = compareAcross(results, "variant");

		expect(comparison.byDimension["variant-a"].avgScore).toBeGreaterThan(0);
		expect(comparison.byDimension["variant-a"].avgScore).toBeLessThanOrEqual(1);
	});
});

describe("detectFlakes", () => {
	it("identifies inconsistent cases", () => {
		const results = [
			createMockCaseResult({ caseId: "flaky", passed: true }),
			createMockCaseResult({ caseId: "flaky", passed: false }),
			createMockCaseResult({ caseId: "flaky", passed: true }),
			createMockCaseResult({ caseId: "flaky", passed: false }),
			createMockCaseResult({ caseId: "stable", passed: true }),
			createMockCaseResult({ caseId: "stable", passed: true }),
		];

		const flakes = detectFlakes(results);

		expect(flakes.length).toBeGreaterThan(0);

		const flakyCase = flakes.find((f) => f.caseId === "flaky");
		expect(flakyCase).toBeDefined();
		expect(flakyCase?.variance).toBe(1); // 50% pass rate = max variance

		// Stable case should not be in flakes
		const stableCase = flakes.find((f) => f.caseId === "stable");
		expect(stableCase).toBeUndefined();
	});

	it("returns empty array when all results are consistent", () => {
		const results = [
			createMockCaseResult({ caseId: "case-1", passed: true }),
			createMockCaseResult({ caseId: "case-1", passed: true }),
			createMockCaseResult({ caseId: "case-2", passed: false }),
			createMockCaseResult({ caseId: "case-2", passed: false }),
		];

		const flakes = detectFlakes(results);

		expect(flakes.length).toBe(0);
	});

	it("requires at least 2 runs to detect flakes", () => {
		const results = [
			createMockCaseResult({ caseId: "case-1", passed: true }),
			createMockCaseResult({ caseId: "case-2", passed: false }),
		];

		const flakes = detectFlakes(results);

		expect(flakes.length).toBe(0);
	});

	it("sorts results by variance descending", () => {
		const results = [
			// 75% pass rate = variance of 0.75
			createMockCaseResult({ caseId: "low-flaky", passed: true }),
			createMockCaseResult({ caseId: "low-flaky", passed: true }),
			createMockCaseResult({ caseId: "low-flaky", passed: true }),
			createMockCaseResult({ caseId: "low-flaky", passed: false }),
			// 50% pass rate = variance of 1.0
			createMockCaseResult({ caseId: "high-flaky", passed: true }),
			createMockCaseResult({ caseId: "high-flaky", passed: false }),
		];

		const flakes = detectFlakes(results);

		expect(flakes.length).toBe(2);
		expect(flakes[0].caseId).toBe("high-flaky");
		expect(flakes[1].caseId).toBe("low-flaky");
	});
});
