/**
 * Report generation for eval results.
 *
 * This module provides functions to generate human-readable reports
 * from eval matrix results in Markdown or JSON format.
 */

import { extractMetrics } from "./assertions.js";
import type {
	MatrixResult,
	DatasetResult,
	CaseResult,
	ComparisonResult,
} from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Output format for reports.
 */
export type ReportFormat = "markdown" | "json";

/**
 * Options for report generation.
 */
export type ReportOptions = {
	/** Output format (markdown or json) */
	format: ReportFormat;
	/** Include detailed per-case results */
	includeDetails?: boolean;
	/** Maximum number of regressions to show */
	maxRegressions?: number;
	/** Maximum number of failures to show */
	maxFailures?: number;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a report from matrix results.
 *
 * @param result - Matrix result to report on
 * @param options - Report options
 * @returns Formatted report string
 */
export function generateReport(
	result: MatrixResult,
	options: ReportOptions,
): string {
	if (options.format === "json") {
		return generateJsonReport(result, options);
	}
	return generateMarkdownReport(result, options);
}

/**
 * Generate summary statistics for a dataset result.
 *
 * @param result - Dataset result to summarize
 * @returns Summary statistics
 */
export function summarizeDataset(result: DatasetResult): {
	passRate: number;
	avgLatency: number;
	avgCost: number;
	avgScore: number;
} {
	const { caseResults } = result;

	if (caseResults.length === 0) {
		return {
			passRate: 0,
			avgLatency: 0,
			avgCost: 0,
			avgScore: 0,
		};
	}

	// Calculate pass rate
	const passRate = result.summary.passRate;

	// Calculate average metrics
	let totalLatency = 0;
	let totalCost = 0;
	let totalScore = 0;

	for (const caseResult of caseResults) {
		const metrics = extractMetrics(caseResult.artifact.events);
		totalLatency += metrics.totalDurationMs;
		totalCost += metrics.totalCostUsd;
		totalScore += caseResult.scores.overall;
	}

	return {
		passRate,
		avgLatency: totalLatency / caseResults.length,
		avgCost: totalCost / caseResults.length,
		avgScore: totalScore / caseResults.length,
	};
}

// ============================================================================
// Markdown report
// ============================================================================

function generateMarkdownReport(
	result: MatrixResult,
	options: ReportOptions,
): string {
	const lines: string[] = [];
	const maxRegressions = options.maxRegressions ?? 10;
	const maxFailures = options.maxFailures ?? 10;

	// Header
	lines.push(`## Eval Report: ${result.datasetId}`);
	lines.push("");
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push("");

	// Summary table
	lines.push("### Summary");
	lines.push("");
	lines.push("| Variant | Pass Rate | Avg Score | Latency (ms) | Cost ($) |");
	lines.push("|---------|-----------|-----------|--------------|----------|");

	for (const variantResult of result.variantResults) {
		const stats = summarizeDataset(variantResult);
		lines.push(
			`| ${variantResult.variantId} | ${(stats.passRate * 100).toFixed(1)}% | ${(stats.avgScore * 100).toFixed(1)}% | ${stats.avgLatency.toFixed(0)} | ${stats.avgCost.toFixed(4)} |`,
		);
	}
	lines.push("");

	// Regressions section (if comparison present)
	if (result.comparison && result.comparison.regressions.length > 0) {
		lines.push("### Regressions");
		lines.push("");
		lines.push(
			`Comparing against baseline: **${result.comparison.baselineVariantId}**`,
		);
		lines.push("");

		const regressions = result.comparison.regressions.slice(0, maxRegressions);
		for (const reg of regressions) {
			lines.push(`- **${reg.caseId}** [${reg.type}]: ${reg.description}`);
		}

		if (result.comparison.regressions.length > maxRegressions) {
			lines.push(
				`- *...and ${result.comparison.regressions.length - maxRegressions} more*`,
			);
		}
		lines.push("");
	}

	// Improvements section (if comparison present)
	if (result.comparison && result.comparison.improvements.length > 0) {
		lines.push("### Improvements");
		lines.push("");

		const improvements = result.comparison.improvements.slice(0, maxRegressions);
		for (const imp of improvements) {
			lines.push(`- **${imp.caseId}** [${imp.type}]: ${imp.description}`);
		}

		if (result.comparison.improvements.length > maxRegressions) {
			lines.push(
				`- *...and ${result.comparison.improvements.length - maxRegressions} more*`,
			);
		}
		lines.push("");
	}

	// Top failures section
	const allFailures = collectFailures(result);
	if (allFailures.length > 0) {
		lines.push("### Top Failures");
		lines.push("");

		const failures = allFailures.slice(0, maxFailures);
		for (const failure of failures) {
			const failedCount = failure.failedAssertions.length;
			const failedTypes = failure.failedAssertions
				.slice(0, 3)
				.map((a) => a.type)
				.join(", ");
			lines.push(
				`- **${failure.caseId}** (${failure.variantId}): ${failedCount} assertion(s) failed - ${failedTypes}`,
			);
		}

		if (allFailures.length > maxFailures) {
			lines.push(`- *...and ${allFailures.length - maxFailures} more*`);
		}
		lines.push("");
	}

	// Detailed results (if requested)
	if (options.includeDetails) {
		lines.push("### Detailed Results");
		lines.push("");

		for (const variantResult of result.variantResults) {
			lines.push(`#### ${variantResult.variantId}`);
			lines.push("");

			for (const caseResult of variantResult.caseResults) {
				const status = caseResult.passed ? ":white_check_mark:" : ":x:";
				const score = (caseResult.scores.overall * 100).toFixed(1);
				lines.push(
					`- ${status} **${caseResult.caseId}**: ${score}% overall score`,
				);

				if (!caseResult.passed) {
					const failed = caseResult.assertionResults.filter((a) => !a.passed);
					for (const assertion of failed) {
						lines.push(`  - :x: ${assertion.assertion.type}: ${assertion.message ?? "Failed"}`);
					}
				}

				if (caseResult.error) {
					lines.push(`  - :warning: Error: ${caseResult.error}`);
				}
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}

// ============================================================================
// JSON report
// ============================================================================

function generateJsonReport(
	result: MatrixResult,
	options: ReportOptions,
): string {
	// Add summary statistics to each variant
	const enrichedResult = {
		...result,
		generatedAt: new Date().toISOString(),
		variantResults: result.variantResults.map((vr) => ({
			...vr,
			statistics: summarizeDataset(vr),
		})),
	};

	// Optionally strip details
	if (!options.includeDetails) {
		return JSON.stringify(
			{
				datasetId: enrichedResult.datasetId,
				generatedAt: enrichedResult.generatedAt,
				comparison: enrichedResult.comparison,
				variantSummaries: enrichedResult.variantResults.map((vr) => ({
					variantId: vr.variantId,
					summary: vr.summary,
					statistics: vr.statistics,
				})),
			},
			null,
			2,
		);
	}

	return JSON.stringify(enrichedResult, null, 2);
}

// ============================================================================
// Helpers
// ============================================================================

type FailureInfo = {
	caseId: string;
	variantId: string;
	failedAssertions: { type: string; message?: string }[];
	error?: string;
};

function collectFailures(result: MatrixResult): FailureInfo[] {
	const failures: FailureInfo[] = [];

	for (const variantResult of result.variantResults) {
		for (const caseResult of variantResult.caseResults) {
			if (!caseResult.passed) {
				const failedAssertions = caseResult.assertionResults
					.filter((a) => !a.passed)
					.map((a) => ({
						type: a.assertion.type,
						message: a.message,
					}));

				failures.push({
					caseId: caseResult.caseId,
					variantId: caseResult.variantId,
					failedAssertions,
					error: caseResult.error,
				});
			}
		}
	}

	// Sort by number of failed assertions (most failures first)
	failures.sort(
		(a, b) => b.failedAssertions.length - a.failedAssertions.length,
	);

	return failures;
}
