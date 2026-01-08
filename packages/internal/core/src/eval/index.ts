/**
 * Eval system for Open Harness v0.2.0
 *
 * This module provides the type system and utilities for evaluating
 * workflows against datasets, including:
 *
 * - Dataset loading and validation
 * - Assertion evaluation
 * - Scoring (latency, cost, tokens, similarity, LLM-as-judge)
 * - Judge caching
 *
 * Phase 7 (engine) builds on top of this foundation.
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
} from "./types.js";

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
