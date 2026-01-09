/**
 * Tests for eval report generation.
 *
 * These tests verify Markdown and JSON report generation,
 * including regression sections and summary statistics.
 */

import { describe, it, expect } from "bun:test";
import { generateReport, summarizeDataset } from "../../src/eval/report.js";
import { compareToBaseline } from "../../src/eval/compare.js";
import type { MatrixResult } from "../../src/eval/types.js";
import {
	createMockCaseResult,
	createMockDatasetResult,
} from "./fixtures/mock-artifact.js";

describe("generateReport (Markdown)", () => {
	it("produces valid Markdown", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [
				createMockDatasetResult({ variantId: "variant-a", passRate: 1.0 }),
				createMockDatasetResult({ variantId: "variant-b", passRate: 0.67 }),
			],
		};

		const report = generateReport(result, { format: "markdown" });

		// Check structure
		expect(report).toContain("## Eval Report: test-dataset");
		expect(report).toContain("### Summary");
		expect(report).toContain("| Variant |");
		expect(report).toContain("variant-a");
		expect(report).toContain("variant-b");
	});

	it("includes regression section when comparison present", () => {
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 2,
			passRate: 1.0,
		});
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 2,
			passRate: 0.5,
		});

		const comparison = compareToBaseline(baseline, candidate);

		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [baseline, candidate],
			comparison,
		};

		const report = generateReport(result, { format: "markdown" });

		expect(report).toContain("### Regressions");
		expect(report).toContain("baseline");
	});

	it("includes improvement section when comparison present", () => {
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 2,
			passRate: 0.5,
		});
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 2,
			passRate: 1.0,
		});

		const comparison = compareToBaseline(baseline, candidate);

		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [baseline, candidate],
			comparison,
		};

		const report = generateReport(result, { format: "markdown" });

		expect(report).toContain("### Improvements");
	});

	it("includes detailed results when requested", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [
				createMockDatasetResult({ variantId: "variant-a", numCases: 2 }),
			],
		};

		const report = generateReport(result, {
			format: "markdown",
			includeDetails: true,
		});

		expect(report).toContain("### Detailed Results");
		expect(report).toContain("#### variant-a");
		expect(report).toContain("case-1");
		expect(report).toContain("case-2");
	});

	it("limits number of regressions shown", () => {
		// Create comparison with many regressions
		const baseline = createMockDatasetResult({
			variantId: "baseline",
			numCases: 10,
			passRate: 1.0,
		});
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			numCases: 10,
			passRate: 0.1, // 9 failures
		});

		const comparison = compareToBaseline(baseline, candidate);

		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [baseline, candidate],
			comparison,
		};

		const report = generateReport(result, {
			format: "markdown",
			maxRegressions: 3,
		});

		// Should show ellipsis indicating more
		expect(report).toContain("...and");
		expect(report).toContain("more");
	});

	it("shows top failures section", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [
				createMockDatasetResult({ variantId: "variant-a", passRate: 0.5 }),
			],
		};

		const report = generateReport(result, { format: "markdown" });

		expect(report).toContain("### Top Failures");
	});
});

describe("generateReport (JSON)", () => {
	it("produces valid JSON", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [
				createMockDatasetResult({ variantId: "variant-a" }),
			],
		};

		const report = generateReport(result, { format: "json" });

		// Should parse without error
		const parsed = JSON.parse(report);
		expect(parsed.datasetId).toBe("test-dataset");
	});

	it("includes summary when details not requested", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [
				createMockDatasetResult({ variantId: "variant-a", numCases: 3 }),
			],
		};

		const report = generateReport(result, { format: "json" });
		const parsed = JSON.parse(report);

		expect(parsed.variantSummaries).toBeDefined();
		expect(parsed.variantSummaries[0].summary.total).toBe(3);
	});

	it("includes full details when requested", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [
				createMockDatasetResult({ variantId: "variant-a", numCases: 2 }),
			],
		};

		const report = generateReport(result, {
			format: "json",
			includeDetails: true,
		});
		const parsed = JSON.parse(report);

		expect(parsed.variantResults).toBeDefined();
		expect(parsed.variantResults[0].caseResults.length).toBe(2);
	});

	it("includes comparison when present", () => {
		const baseline = createMockDatasetResult({ variantId: "baseline" });
		const candidate = createMockDatasetResult({
			variantId: "candidate",
			passRate: 0.5,
		});

		const comparison = compareToBaseline(baseline, candidate);

		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [baseline, candidate],
			comparison,
		};

		const report = generateReport(result, { format: "json" });
		const parsed = JSON.parse(report);

		expect(parsed.comparison).toBeDefined();
		expect(parsed.comparison.baselineVariantId).toBe("baseline");
	});

	it("includes generated timestamp", () => {
		const result: MatrixResult = {
			datasetId: "test-dataset",
			variantResults: [],
		};

		const report = generateReport(result, { format: "json" });
		const parsed = JSON.parse(report);

		expect(parsed.generatedAt).toBeDefined();
		// Should be valid ISO timestamp
		expect(new Date(parsed.generatedAt).toISOString()).toBe(parsed.generatedAt);
	});
});

describe("summarizeDataset", () => {
	it("calculates correct averages", () => {
		const result = createMockDatasetResult({
			numCases: 3,
			passRate: 0.67, // 2 passing, 1 failing
		});

		const summary = summarizeDataset(result);

		expect(summary.passRate).toBeCloseTo(0.67, 2);
		expect(summary.avgLatency).toBeGreaterThan(0);
		expect(summary.avgCost).toBeGreaterThanOrEqual(0);
		expect(summary.avgScore).toBeGreaterThan(0);
		expect(summary.avgScore).toBeLessThanOrEqual(1);
	});

	it("handles empty dataset", () => {
		const result = createMockDatasetResult({ numCases: 0 });
		result.caseResults = [];
		result.summary = { total: 0, passed: 0, failed: 0, passRate: 0 };

		const summary = summarizeDataset(result);

		expect(summary.passRate).toBe(0);
		expect(summary.avgLatency).toBe(0);
		expect(summary.avgCost).toBe(0);
		expect(summary.avgScore).toBe(0);
	});

	it("calculates metrics from artifact events", () => {
		const result = createMockDatasetResult({ numCases: 2 });
		// Use specific case results with known metrics
		result.caseResults = [
			createMockCaseResult({ caseId: "case-1", durationMs: 1000, costUsd: 0.01 }),
			createMockCaseResult({ caseId: "case-2", durationMs: 2000, costUsd: 0.02 }),
		];

		const summary = summarizeDataset(result);

		// Average of 1000 and 2000 = 1500
		expect(summary.avgLatency).toBe(1500);
		// Average of 0.01 and 0.02 = 0.015
		expect(summary.avgCost).toBe(0.015);
	});
});
