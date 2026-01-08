/**
 * Eval system for Open Harness v0.2.0
 *
 * This module provides the complete evaluation system for workflows:
 *
 * Phase 6 (foundation):
 * - Dataset loading and validation
 * - Assertion evaluation
 * - Scoring (latency, cost, tokens, similarity, LLM-as-judge)
 * - Judge caching
 *
 * Phase 7 (engine):
 * - Eval engine for orchestrating matrix runs
 * - Runner for executing cases/datasets/matrices
 * - Comparison utilities for baseline analysis
 * - Report generation (Markdown, JSON)
 * - Lifecycle hooks for observability
 */

// ============================================================================
// Types
// ============================================================================

export type {
	// Dataset types
	EvalDataset,
	EvalCase,
	EvalVariant,
	// Artifact types
	EvalArtifact,
	EvalArtifactView,
	// Assertion types
	Assertion,
	AssertionResult,
	// Scorer types
	Score,
	ScoreBreakdown,
	Scorer,
	// Metric types
	ExtractedMetrics,
	// Validation types
	ValidationResult,
	// Engine options
	EvalMatrixRunOptions,
	// Recording event types (re-exported from state/events)
	RecordingLinkedEventPayload,
	RecordingLinkedEvent,
	// Phase 7: Workflow factory and result types
	WorkflowFactory,
	CaseResult,
	DatasetResult,
	MatrixResult,
	ComparisonResult,
	Regression,
	Improvement,
	ComparisonThresholds,
} from "./types.js";

export { DEFAULT_COMPARISON_THRESHOLDS } from "./types.js";

// ============================================================================
// Recording ID utilities
// ============================================================================

export { generateRecordingId, parseRecordingId } from "./types.js";

// ============================================================================
// Dataset loading and validation
// ============================================================================

export {
	loadDataset,
	loadDatasetFromFile,
	validateDataset,
	discoverDatasets,
	DatasetValidationError,
	// Schemas for external validation
	EvalDatasetSchema,
	EvalCaseSchema,
	AssertionSchema,
} from "./dataset.js";

// ============================================================================
// Assertion evaluation
// ============================================================================

export {
	evaluateAssertions,
	createArtifactView,
	extractMetrics,
} from "./assertions.js";

// ============================================================================
// Scorers
// ============================================================================

export {
	// Latency scorer
	createLatencyScorer,
	defaultLatencyScorer,
	type LatencyScorerConfig,
	// Cost scorer
	createCostScorer,
	defaultCostScorer,
	type CostScorerConfig,
	// Tokens scorer
	createTokensScorer,
	defaultTokensScorer,
	type TokensScorerConfig,
	// Similarity scorer
	createSimilarityScorer,
	type SimilarityScorerConfig,
	// LLM judge scorer
	createLLMJudgeScorer,
	type LLMJudgeScorerConfig,
} from "./scorers/index.js";

// ============================================================================
// Cache
// ============================================================================

export {
	createInMemoryCache,
	generateJudgeCacheKey,
	type EvalJudgeCache,
} from "./cache.js";

// ============================================================================
// Phase 7: Engine
// ============================================================================

export { createEvalEngine, type EvalEngine, type EvalEngineConfig } from "./engine.js";

// ============================================================================
// Phase 7: Runner
// ============================================================================

export {
	runCase,
	runDataset,
	runMatrix,
	type RunnerConfig,
	type RunMode,
} from "./runner.js";

// ============================================================================
// Phase 7: Compare
// ============================================================================

export { compareToBaseline, compareAcross, detectFlakes } from "./compare.js";

// ============================================================================
// Phase 7: Report
// ============================================================================

export {
	generateReport,
	summarizeDataset,
	type ReportFormat,
	type ReportOptions,
} from "./report.js";

// ============================================================================
// Phase 7: Hooks
// ============================================================================

export {
	createNoOpHooks,
	createConsoleHooks,
	composeHooks,
	createCollectingHooks,
	type EvalHooks,
} from "./hooks.js";

