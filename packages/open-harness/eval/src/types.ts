/**
 * Core types for the eval system.
 *
 * The eval pyramid:
 * - Assertion: single check
 * - Case: single input with multiple assertions
 * - Dataset: many cases with aggregate metrics
 * - Matrix: variants × cases for A/B testing
 * - Comparison: baseline vs candidate for regression detection
 */

import type { Signal } from "@signals/core";
import type { SignalAssertion } from "./assertions/types.js";

// ============================================================================
// Assertion Results
// ============================================================================

/**
 * Result of evaluating a single assertion.
 */
export interface AssertionResult {
	/** The assertion that was evaluated */
	assertion: SignalAssertion;
	/** Whether the assertion passed */
	passed: boolean;
	/** Human-readable result message */
	message: string;
	/** Expected value (for debugging) */
	expected?: unknown;
	/** Actual value found (for debugging) */
	actual?: unknown;
	/** For trajectory assertions, shows the actual sequence */
	trajectory?: string[];
	/** Duration to evaluate this assertion (ms) */
	evaluationMs?: number;
}

// ============================================================================
// Case Types
// ============================================================================

/**
 * A single evaluation case.
 *
 * @template TState - Type of the initial state/input
 */
export interface EvalCase<TState = unknown> {
	/** Unique case identifier */
	id: string;
	/** Human-readable name */
	name?: string;
	/** Description of what this case tests */
	description?: string;
	/** Initial state for runReactive */
	input: TState;
	/** Assertions to evaluate */
	assertions: SignalAssertion[];
	/** Tags for filtering (e.g., ["smoke", "regression", "edge-case"]) */
	tags?: string[];
	/** Per-case timeout override (ms) */
	timeout?: number;
	/** Skip this case (keeps in file but doesn't run) */
	skip?: boolean;
	/** Only run this case (for debugging) */
	only?: boolean;
}

/**
 * Metrics collected during case execution.
 */
export interface CaseMetrics {
	/** Total execution time (ms) */
	latencyMs: number;
	/** Input tokens consumed */
	inputTokens: number;
	/** Output tokens generated */
	outputTokens: number;
	/** Total tokens (input + output) */
	totalTokens: number;
	/** Cost in USD */
	cost: number;
	/** Number of agent activations */
	activations: number;
}

/**
 * Result of running a single case.
 *
 * @template TState - Type of the state
 */
export interface CaseResult<TState = unknown> {
	/** Case ID */
	caseId: string;
	/** Case name (if provided) */
	name?: string;
	/** Whether all assertions passed */
	passed: boolean;
	/** Individual assertion results */
	assertions: AssertionResult[];
	/** All signals emitted during execution */
	signals: Signal[];
	/** Final state after execution */
	finalState: TState;
	/** Execution metrics */
	metrics: CaseMetrics;
	/** Error if execution failed */
	error?: Error;
	/** Recording ID for replay/debugging */
	recordingId?: string;
	/** Whether case was skipped */
	skipped?: boolean;
	/** Duration of case execution (ms) */
	durationMs: number;
}

// ============================================================================
// Dataset Types
// ============================================================================

/**
 * A dataset of evaluation cases.
 *
 * @template TState - Type of the state for all cases
 */
export interface EvalDataset<TState = unknown> {
	/** Dataset name */
	name: string;
	/** Description */
	description?: string;
	/** Assertions applied to ALL cases (combined with case-specific) */
	defaultAssertions?: SignalAssertion[];
	/** Default timeout for all cases (ms) */
	defaultTimeout?: number;
	/** The test cases */
	cases: EvalCase<TState>[];
	/** Arbitrary metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Aggregate metrics across all cases in a dataset.
 */
export interface AggregateMetrics {
	/** Average latency (ms) */
	avgLatencyMs: number;
	/** Minimum latency (ms) */
	minLatencyMs: number;
	/** Maximum latency (ms) */
	maxLatencyMs: number;
	/** 50th percentile latency (ms) */
	p50LatencyMs: number;
	/** 95th percentile latency (ms) */
	p95LatencyMs: number;
	/** 99th percentile latency (ms) */
	p99LatencyMs: number;
	/** Total cost across all cases (USD) */
	totalCost: number;
	/** Average cost per case (USD) */
	avgCostPerCase: number;
	/** Total tokens across all cases */
	totalTokens: number;
	/** Average tokens per case */
	avgTokensPerCase: number;
	/** Total agent activations */
	totalActivations: number;
}

/**
 * Result of running an entire dataset.
 *
 * @template TState - Type of the state
 */
export interface DatasetResult<TState = unknown> {
	/** Dataset name */
	name: string;
	/** Total number of cases */
	totalCases: number;
	/** Number of passed cases */
	passedCases: number;
	/** Number of failed cases */
	failedCases: number;
	/** Number of skipped cases */
	skippedCases: number;
	/** Pass rate (0-1) */
	passRate: number;
	/** Individual case results */
	cases: CaseResult<TState>[];
	/** Aggregate metrics across all cases */
	aggregateMetrics: AggregateMetrics;
	/** Total duration of eval run (ms) */
	durationMs: number;
	/** ISO timestamp when eval started */
	startedAt: string;
	/** ISO timestamp when eval completed */
	completedAt: string;
}

// ============================================================================
// Comparison Types (Regression Detection)
// ============================================================================

/**
 * A regression detected between baseline and candidate.
 */
export interface Regression {
	caseId: string;
	caseName?: string;
	type: "pass_to_fail" | "metric_degraded";
	description: string;
	baseline: { passed: boolean; value?: number };
	candidate: { passed: boolean; value?: number };
	delta?: number;
	/** Critical regressions block merge */
	severity: "critical" | "warning";
	/** Which assertions failed */
	failedAssertions?: AssertionResult[];
}

/**
 * An improvement detected between baseline and candidate.
 */
export interface Improvement {
	caseId: string;
	caseName?: string;
	type: "fail_to_pass" | "metric_improved";
	description: string;
	baseline: { passed: boolean; value?: number };
	candidate: { passed: boolean; value?: number };
	delta?: number;
}

/**
 * Summary of comparison between baseline and candidate.
 */
export interface ComparisonSummary {
	/** Pass rate delta (positive = better) */
	passRateDelta: number;
	/** Average latency delta (negative = better) */
	avgLatencyDeltaMs: number;
	/** Latency change percentage */
	avgLatencyDeltaPct: number;
	/** Cost delta (negative = better) */
	costDelta: number;
	/** Cost change percentage */
	costDeltaPct: number;
	/** Overall verdict */
	verdict: "better" | "worse" | "equivalent" | "mixed";
	/** Should this block a PR merge? */
	shouldBlock: boolean;
	/** Reason for blocking (if applicable) */
	blockReason?: string;
}

/**
 * Full comparison between baseline and candidate results.
 */
export interface Comparison {
	baseline: DatasetResult;
	candidate: DatasetResult;
	/** Cases that passed in baseline but failed in candidate */
	regressions: Regression[];
	/** Cases that failed in baseline but passed in candidate */
	improvements: Improvement[];
	/** Cases with same pass/fail status */
	unchanged: string[];
	/** Cases in candidate but not in baseline */
	newCases: string[];
	/** Cases in baseline but not in candidate */
	removedCases: string[];
	summary: ComparisonSummary;
}

// ============================================================================
// Matrix Types (A/B Testing)
// ============================================================================

/**
 * A variant to test in a matrix evaluation.
 *
 * @template TState - Type of the state
 */
export interface HarnessVariant<TState = unknown> {
	/** Unique variant identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Metadata (prompt version, model name, etc.) */
	metadata?: Record<string, unknown>;
}

/**
 * Result for a single variant in a matrix.
 *
 * @template TState - Type of the state
 */
export interface VariantResult<TState = unknown> {
	variantId: string;
	variantName: string;
	result: DatasetResult<TState>;
	metadata?: Record<string, unknown>;
}

/**
 * Cross-variant comparison.
 */
export interface VariantComparison {
	/** Variant IDs sorted by pass rate (best first) */
	byPassRate: string[];
	/** Variant IDs sorted by cost (cheapest first) */
	byCost: string[];
	/** Variant IDs sorted by latency (fastest first) */
	byLatency: string[];
	/** Variants on the efficiency frontier (best tradeoffs) */
	paretoFrontier: string[];
}

/**
 * Recommendation from matrix evaluation.
 */
export interface VariantRecommendation {
	variantId: string;
	reason: string;
	tradeoffs?: string[];
	confidence: "high" | "medium" | "low";
}

/**
 * Result of running a matrix evaluation.
 *
 * @template TState - Type of the state
 */
export interface MatrixResult<TState = unknown> {
	/** Results for each variant */
	variants: VariantResult<TState>[];
	/** Cross-variant comparison */
	comparison: VariantComparison;
	/** Recommended variant (if determinable) */
	recommendation?: VariantRecommendation;
	/** Total duration (ms) */
	durationMs: number;
}
