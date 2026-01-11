/**
 * @open-harness/eval - Signal-based evaluation assertions
 *
 * Declarative assertions for evaluating signal-based agent executions.
 * These are "assertions as data" - serializable to YAML for datasets.
 *
 * @example
 * ```typescript
 * import { loadDataset, runDataset, type SignalAssertion } from '@open-harness/eval';
 *
 * const dataset = await loadDataset('./tests/eval/my-dataset.yaml');
 * const results = await runDataset(myHarnessFactory, dataset);
 * console.log(`Pass rate: ${results.passRate * 100}%`);
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
	AggregateMetrics,
	AssertionResult,
	CaseMetrics,
	CaseResult,
	Comparison,
	DatasetResult,
	EvalCase,
	EvalDataset,
	MatrixResult,
	VariantResult,
} from "./types.js";

// ============================================================================
// Assertions
// ============================================================================

// Evaluation functions
// Utilities (for advanced users building custom assertions)
export {
	type AssertionEvaluationContext,
	evaluateAssertion,
	evaluateAssertions,
	evaluateValueMatcher,
	getPath,
	isValueMatcher,
	matchesPayload,
	percentile,
	valueMatches,
} from "./assertions/index.js";
// All assertion types
export type * from "./assertions/types.js";

// ============================================================================
// Runners
// ============================================================================

export {
	type HarnessExecutionResult,
	type HarnessFactory,
	type RunCaseOptions,
	type RunDatasetOptions,
	runCase,
	runDataset,
} from "./runners/index.js";

// ============================================================================
// YAML Loader
// ============================================================================

// Schemas (for advanced users building tooling)
export {
	AssertionSchema,
	EvalCaseSchema,
	EvalDatasetSchema,
	loadDataset,
	loadResult,
	type ParsedEvalCase,
	type ParsedEvalDataset,
	parseDataset,
	saveDataset,
	saveResult,
} from "./loader/index.js";
