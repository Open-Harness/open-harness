/**
 * Dataset runner - executes all cases in a dataset.
 */

import { percentile } from "../assertions/utils.js";
import type { AggregateMetrics, CaseResult, DatasetResult, EvalDataset } from "../types.js";
import { type HarnessFactory, type RunCaseOptions, runCase } from "./case.js";

/**
 * Options for running a dataset.
 */
export interface RunDatasetOptions extends RunCaseOptions {
	/** Run cases in parallel (default: false) */
	parallel?: boolean;
	/** Max concurrent cases when parallel=true (default: 5) */
	concurrency?: number;
	/** Filter to specific tags */
	tags?: string[];
	/** Filter to specific case IDs */
	caseIds?: string[];
	/** Stop on first failure */
	failFast?: boolean;
	/** Callback after each case completes */
	onCaseComplete?: (result: CaseResult) => void;
}

/**
 * Run an entire dataset.
 *
 * @param factory - Factory function to create and run harnesses
 * @param dataset - The dataset to run
 * @param options - Execution options
 * @returns Dataset result with aggregate metrics
 */
export async function runDataset<TState>(
	factory: HarnessFactory<TState>,
	dataset: EvalDataset<TState>,
	options: RunDatasetOptions = {},
): Promise<DatasetResult<TState>> {
	const startedAt = new Date().toISOString();
	const startTime = Date.now();

	// Filter cases
	let cases = dataset.cases;

	// Handle "only" cases
	const onlyCases = cases.filter((c) => c.only);
	if (onlyCases.length > 0) {
		cases = onlyCases;
	}

	// Filter by tags
	if (options.tags && options.tags.length > 0) {
		cases = cases.filter((c) => c.tags?.some((t) => options.tags!.includes(t)));
	}

	// Filter by case IDs
	if (options.caseIds && options.caseIds.length > 0) {
		cases = cases.filter((c) => options.caseIds!.includes(c.id));
	}

	const results: CaseResult<TState>[] = [];

	if (options.parallel) {
		// Parallel execution with concurrency limit using a proper pool
		const concurrency = options.concurrency ?? 5;
		const queue = [...cases];
		let shouldStop = false;

		// Process cases with limited concurrency
		const runCaseWithTracking = async (evalCase: (typeof cases)[0]): Promise<void> => {
			if (shouldStop) return;

			const result = await runCase(factory, evalCase, dataset.defaultAssertions, {
				...options,
				timeout: evalCase.timeout ?? dataset.defaultTimeout ?? options.timeout,
			});
			results.push(result);
			options.onCaseComplete?.(result);

			// Check fail-fast
			if (options.failFast && !result.passed && !result.skipped) {
				shouldStop = true;
			}
		};

		// Simple concurrent pool: process in batches of concurrency size
		while (queue.length > 0 && !shouldStop) {
			const batch = queue.splice(0, concurrency);
			await Promise.all(batch.map(runCaseWithTracking));
		}
	} else {
		// Sequential execution
		for (const evalCase of cases) {
			const result = await runCase(factory, evalCase, dataset.defaultAssertions, {
				...options,
				timeout: evalCase.timeout ?? dataset.defaultTimeout ?? options.timeout,
			});
			results.push(result);
			options.onCaseComplete?.(result);

			// Check fail-fast
			if (options.failFast && !result.passed && !result.skipped) {
				break;
			}
		}
	}

	// Calculate aggregate metrics
	const nonSkippedResults = results.filter((r) => !r.skipped);
	const aggregateMetrics = calculateAggregateMetrics(nonSkippedResults);

	const passedCases = results.filter((r) => r.passed && !r.skipped).length;
	const failedCases = results.filter((r) => !r.passed && !r.skipped).length;
	const skippedCases = results.filter((r) => r.skipped).length;

	return {
		name: dataset.name,
		totalCases: results.length,
		passedCases,
		failedCases,
		skippedCases,
		passRate: nonSkippedResults.length > 0 ? passedCases / nonSkippedResults.length : 0,
		cases: results,
		aggregateMetrics,
		durationMs: Date.now() - startTime,
		startedAt,
		completedAt: new Date().toISOString(),
	};
}

/**
 * Calculate aggregate metrics from case results.
 */
function calculateAggregateMetrics(results: CaseResult[]): AggregateMetrics {
	if (results.length === 0) {
		return {
			avgLatencyMs: 0,
			minLatencyMs: 0,
			maxLatencyMs: 0,
			p50LatencyMs: 0,
			p95LatencyMs: 0,
			p99LatencyMs: 0,
			totalCost: 0,
			avgCostPerCase: 0,
			totalTokens: 0,
			avgTokensPerCase: 0,
			totalActivations: 0,
		};
	}

	const latencies = results.map((r) => r.metrics.latencyMs);
	const totalCost = results.reduce((sum, r) => sum + r.metrics.cost, 0);
	const totalTokens = results.reduce((sum, r) => sum + r.metrics.totalTokens, 0);
	const totalActivations = results.reduce((sum, r) => sum + r.metrics.activations, 0);

	return {
		avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
		minLatencyMs: Math.min(...latencies),
		maxLatencyMs: Math.max(...latencies),
		p50LatencyMs: percentile(latencies, 50),
		p95LatencyMs: percentile(latencies, 95),
		p99LatencyMs: percentile(latencies, 99),
		totalCost,
		avgCostPerCase: totalCost / results.length,
		totalTokens,
		avgTokensPerCase: totalTokens / results.length,
		totalActivations,
	};
}
