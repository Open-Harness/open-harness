/**
 * Comparison utilities for eval results.
 *
 * This module provides functions to compare eval results against baselines,
 * detect regressions and improvements, and analyze results across dimensions.
 */

import { extractMetrics } from "./assertions.js";
import type {
	CaseResult,
	ComparisonResult,
	ComparisonThresholds,
	DatasetResult,
	Improvement,
	Regression,
} from "./types.js";
import { DEFAULT_COMPARISON_THRESHOLDS } from "./types.js";

// ============================================================================
// Baseline comparison
// ============================================================================

/**
 * Compare a candidate's results against a baseline.
 *
 * Detects:
 * - Assertion regressions: tests that were passing in baseline but fail now
 * - Metric regressions: latency/cost/tokens that increased significantly
 * - Score regressions: overall scores that decreased
 *
 * @param baseline - Baseline dataset result
 * @param candidate - Candidate dataset result to compare
 * @param thresholds - Optional thresholds for regression detection (defaults to DEFAULT_COMPARISON_THRESHOLDS)
 * @returns Comparison result with regressions and improvements
 */
export function compareToBaseline(
	baseline: DatasetResult,
	candidate: DatasetResult,
	thresholds: Partial<ComparisonThresholds> = {},
): ComparisonResult {
	const t = { ...DEFAULT_COMPARISON_THRESHOLDS, ...thresholds };
	const regressions: Regression[] = [];
	const improvements: Improvement[] = [];

	// Build baseline lookup by caseId
	const baselineByCaseId = new Map<string, CaseResult>();
	for (const result of baseline.caseResults) {
		baselineByCaseId.set(result.caseId, result);
	}

	// Compare each candidate case to baseline
	for (const candidateCase of candidate.caseResults) {
		const baselineCase = baselineByCaseId.get(candidateCase.caseId);
		if (!baselineCase) {
			// New case - skip comparison
			continue;
		}

		// 1. Compare assertion pass/fail status
		if (baselineCase.passed && !candidateCase.passed) {
			// Regression: was passing, now failing
			const failedAssertions = candidateCase.assertionResults
				.filter((r) => !r.passed)
				.map((r) => r.assertion.type)
				.join(", ");

			regressions.push({
				caseId: candidateCase.caseId,
				variantId: candidate.variantId,
				type: "assertion",
				description: `Case was passing but now fails: ${failedAssertions}`,
				baseline: true,
				current: false,
			});
		} else if (!baselineCase.passed && candidateCase.passed) {
			// Improvement: was failing, now passing
			improvements.push({
				caseId: candidateCase.caseId,
				variantId: candidate.variantId,
				type: "assertion",
				description: "Case was failing but now passes",
				baseline: false,
				current: true,
			});
		}

		// 2. Compare metrics (latency, cost, tokens)
		const baselineMetrics = extractMetrics(baselineCase.artifact.events);
		const candidateMetrics = extractMetrics(candidateCase.artifact.events);

		// Latency regression (configurable threshold)
		if (baselineMetrics.totalDurationMs > 0) {
			const latencyRatio = candidateMetrics.totalDurationMs / baselineMetrics.totalDurationMs;
			if (latencyRatio > 1 + t.latencyIncrease) {
				regressions.push({
					caseId: candidateCase.caseId,
					variantId: candidate.variantId,
					type: "metric",
					description: `Latency increased by ${Math.round((latencyRatio - 1) * 100)}% (${baselineMetrics.totalDurationMs}ms → ${candidateMetrics.totalDurationMs}ms)`,
					baseline: baselineMetrics.totalDurationMs,
					current: candidateMetrics.totalDurationMs,
				});
			} else if (latencyRatio < 1 - t.latencyIncrease) {
				improvements.push({
					caseId: candidateCase.caseId,
					variantId: candidate.variantId,
					type: "metric",
					description: `Latency decreased by ${Math.round((1 - latencyRatio) * 100)}% (${baselineMetrics.totalDurationMs}ms → ${candidateMetrics.totalDurationMs}ms)`,
					baseline: baselineMetrics.totalDurationMs,
					current: candidateMetrics.totalDurationMs,
				});
			}
		}

		// Cost regression (configurable threshold)
		if (baselineMetrics.totalCostUsd > 0) {
			const costRatio = candidateMetrics.totalCostUsd / baselineMetrics.totalCostUsd;
			if (costRatio > 1 + t.costIncrease) {
				regressions.push({
					caseId: candidateCase.caseId,
					variantId: candidate.variantId,
					type: "metric",
					description: `Cost increased by ${Math.round((costRatio - 1) * 100)}% ($${baselineMetrics.totalCostUsd.toFixed(4)} → $${candidateMetrics.totalCostUsd.toFixed(4)})`,
					baseline: baselineMetrics.totalCostUsd,
					current: candidateMetrics.totalCostUsd,
				});
			} else if (costRatio < 1 - t.costIncrease) {
				improvements.push({
					caseId: candidateCase.caseId,
					variantId: candidate.variantId,
					type: "metric",
					description: `Cost decreased by ${Math.round((1 - costRatio) * 100)}% ($${baselineMetrics.totalCostUsd.toFixed(4)} → $${candidateMetrics.totalCostUsd.toFixed(4)})`,
					baseline: baselineMetrics.totalCostUsd,
					current: candidateMetrics.totalCostUsd,
				});
			}
		}

		// 3. Compare overall scores (configurable threshold)
		if (baselineCase.scores.overall > 0) {
			const scoreDiff = candidateCase.scores.overall - baselineCase.scores.overall;
			if (scoreDiff < -t.scoreDecrease) {
				regressions.push({
					caseId: candidateCase.caseId,
					variantId: candidate.variantId,
					type: "score",
					description: `Overall score decreased by ${Math.round(-scoreDiff * 100)}% (${(baselineCase.scores.overall * 100).toFixed(1)}% → ${(candidateCase.scores.overall * 100).toFixed(1)}%)`,
					baseline: baselineCase.scores.overall,
					current: candidateCase.scores.overall,
				});
			} else if (scoreDiff > t.scoreDecrease) {
				improvements.push({
					caseId: candidateCase.caseId,
					variantId: candidate.variantId,
					type: "score",
					description: `Overall score increased by ${Math.round(scoreDiff * 100)}% (${(baselineCase.scores.overall * 100).toFixed(1)}% → ${(candidateCase.scores.overall * 100).toFixed(1)}%)`,
					baseline: baselineCase.scores.overall,
					current: candidateCase.scores.overall,
				});
			}
		}
	}

	return {
		baselineVariantId: baseline.variantId,
		regressions,
		improvements,
	};
}

// ============================================================================
// Cross-dimensional analysis
// ============================================================================

/**
 * Compare results across a dimension (variant or case).
 *
 * @param results - Dataset results to compare
 * @param dimension - Dimension to aggregate by
 * @returns Aggregated statistics by dimension
 */
export function compareAcross(
	results: DatasetResult[],
	dimension: "variant" | "case",
): {
	byDimension: Record<string, { passRate: number; avgScore: number }>;
	best: string;
	worst: string;
} {
	const byDimension: Record<string, { passRate: number; avgScore: number }> = {};

	if (dimension === "variant") {
		// Aggregate by variant
		for (const result of results) {
			byDimension[result.variantId] = {
				passRate: result.summary.passRate,
				avgScore: calculateAvgScore(result.caseResults),
			};
		}
	} else {
		// Aggregate by case across all variants
		const caseStats = new Map<string, { passed: number; total: number; scores: number[] }>();

		for (const result of results) {
			for (const caseResult of result.caseResults) {
				const stats = caseStats.get(caseResult.caseId) ?? {
					passed: 0,
					total: 0,
					scores: [],
				};
				stats.total += 1;
				if (caseResult.passed) stats.passed += 1;
				stats.scores.push(caseResult.scores.overall);
				caseStats.set(caseResult.caseId, stats);
			}
		}

		for (const [caseId, stats] of caseStats) {
			byDimension[caseId] = {
				passRate: stats.total > 0 ? stats.passed / stats.total : 0,
				avgScore: stats.scores.length > 0 ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length : 0,
			};
		}
	}

	// Find best and worst
	let best = "";
	let worst = "";
	let bestScore = -1;
	let worstScore = Infinity;

	for (const [key, stats] of Object.entries(byDimension)) {
		// Combined score: 60% pass rate + 40% avg score
		const combined = stats.passRate * 0.6 + stats.avgScore * 0.4;
		if (combined > bestScore) {
			bestScore = combined;
			best = key;
		}
		if (combined < worstScore) {
			worstScore = combined;
			worst = key;
		}
	}

	return {
		byDimension,
		best,
		worst,
	};
}

// ============================================================================
// Flake detection
// ============================================================================

/**
 * Detect flaky tests (cases with inconsistent results across runs).
 *
 * @param results - Case results from multiple runs
 * @returns Cases with high variance in results
 */
export function detectFlakes(results: CaseResult[]): { caseId: string; variance: number }[] {
	// Group by caseId
	const byCaseId = new Map<string, CaseResult[]>();
	for (const result of results) {
		const existing = byCaseId.get(result.caseId) ?? [];
		existing.push(result);
		byCaseId.set(result.caseId, existing);
	}

	const flakes: { caseId: string; variance: number }[] = [];

	for (const [caseId, caseResults] of byCaseId) {
		if (caseResults.length < 2) {
			// Need at least 2 runs to detect flakes
			continue;
		}

		// Calculate pass/fail variance
		const passCount = caseResults.filter((r) => r.passed).length;
		const passRate = passCount / caseResults.length;

		// Variance is highest at 50% pass rate, lowest at 0% or 100%
		// Using variance = 4 * p * (1-p) which peaks at 0.5
		const variance = 4 * passRate * (1 - passRate);

		// Only report if there's actual variance (not all same result)
		if (variance > 0) {
			flakes.push({ caseId, variance });
		}
	}

	// Sort by variance descending
	flakes.sort((a, b) => b.variance - a.variance);

	return flakes;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate average score across case results.
 */
function calculateAvgScore(results: CaseResult[]): number {
	if (results.length === 0) return 0;

	const sum = results.reduce((acc, r) => acc + r.scores.overall, 0);
	return sum / results.length;
}
