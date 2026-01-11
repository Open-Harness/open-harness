/**
 * Eval system types for Open Harness v0.2.0
 *
 * This module defines the type system for evaluating workflows against datasets,
 * including assertions, scorers, and artifacts.
 */

import type {
	RuntimeEvent,
	RecordingLinkedEventPayload,
	RecordingLinkedEvent,
} from "../state/events.js";
import type { RunSnapshot } from "../state/snapshot.js";
import type { NodeRegistry } from "../nodes/index.js";
import type { FlowDefinition } from "../state/index.js";

// Re-export recording event types for convenience
export type { RecordingLinkedEventPayload, RecordingLinkedEvent };

// ============================================================================
// Dataset types
// ============================================================================

/**
 * A dataset containing test cases for workflow evaluation.
 *
 * @property id - Unique identifier (e.g., "coder-reviewer.v1")
 * @property workflowName - Maps to the workflow factory
 * @property version - Dataset version, not model version
 * @property cases - Array of test cases
 */
export type EvalDataset = {
	id: string;
	workflowName: string;
	version: string;
	cases: EvalCase[];
};

/**
 * A single test case within a dataset.
 *
 * @property id - Stable, filesystem-safe identifier
 * @property name - Optional human-readable name
 * @property input - Input fed to the workflow factory
 * @property assertions - Assertions to evaluate against the run
 * @property tags - Optional tags for filtering (e.g., "smoke", "regression")
 */
export type EvalCase = {
	id: string;
	name?: string;
	input: unknown;
	assertions: Assertion[];
	tags?: string[];
};

/**
 * A variant configuration for running datasets across different providers/models.
 *
 * @property id - Variant identifier (e.g., "claude-default")
 * @property providerTypeByNode - Provider type for each node
 * @property modelByNode - Optional model for each node
 * @property tags - Optional tags (e.g., "baseline", "candidate")
 */
export type EvalVariant = {
	id: string;
	providerTypeByNode: Record<string, string>;
	modelByNode?: Record<string, string>;
	tags?: string[];
};

// ============================================================================
// Artifact types
// ============================================================================

/**
 * An artifact produced by running a workflow for evaluation.
 *
 * Contains the run snapshot, all runtime events (including recording:linked),
 * and provides the basis for assertion evaluation.
 */
export type EvalArtifact = {
	runId: string;
	snapshot: RunSnapshot;
	events: RuntimeEvent[];
};

/**
 * Normalized view of an artifact for assertion evaluation.
 *
 * This provides a consistent interface for evaluating assertions
 * without requiring knowledge of internal snapshot structure.
 */
export type EvalArtifactView = {
	runId: string;
	outputs: Record<string, unknown>;
	state: Record<string, unknown>;
	primaryOutput?: unknown;
	metrics: {
		workflow: {
			startedAt?: number;
			endedAt?: number;
			durationMs?: number;
		};
		byNode: Record<
			string,
			{
				durationMs?: number;
				totalCostUsd?: number;
				inputTokens?: number;
				outputTokens?: number;
			}
		>;
	};
	errors: {
		nodeErrors: Record<string, string[]>;
	};
};

// ============================================================================
// Assertion types
// ============================================================================

/**
 * Assertion types supported by the eval system.
 *
 * - output.*: Assertions against output values (paths evaluated against EvalArtifactView)
 * - metric.*: Budget assertions derived from runtime events
 * - behavior.*: Behavioral assertions about execution
 */
export type Assertion =
	// Output assertions
	| { type: "output.contains"; path: string; value: string }
	| { type: "output.equals"; path: string; value: unknown }
	// Metric budgets (from agent:complete events)
	| { type: "metric.latency_ms.max"; value: number }
	| { type: "metric.total_cost_usd.max"; value: number }
	| { type: "metric.tokens.input.max"; value: number }
	| { type: "metric.tokens.output.max"; value: number }
	// Behavior assertions
	| { type: "behavior.no_errors" }
	| { type: "behavior.node_executed"; nodeId: string }
	| { type: "behavior.node_invocations.max"; nodeId: string; value: number };

/**
 * Result of evaluating a single assertion.
 */
export type AssertionResult = {
	assertion: Assertion;
	passed: boolean;
	actual?: unknown;
	message?: string;
};

// ============================================================================
// Scorer types
// ============================================================================

/**
 * A score produced by a scorer.
 *
 * @property name - Scorer name (e.g., "latency", "cost")
 * @property value - Normalized score (0-1)
 * @property rawValue - Original value before normalization
 * @property metadata - Additional scorer-specific metadata
 */
export type Score = {
	name: string;
	value: number;
	rawValue?: unknown;
	metadata?: Record<string, unknown>;
};

/**
 * Breakdown of scores for a run.
 *
 * @property overall - Combined normalized score (0-1)
 * @property scores - Individual scorer results
 */
export type ScoreBreakdown = {
	overall: number;
	scores: Score[];
};

/**
 * Interface for scoring eval artifacts.
 */
export interface Scorer {
	name: string;
	score(artifact: EvalArtifact): Score;
}

// ============================================================================
// Recording ID generation
// ============================================================================

/**
 * Generate a deterministic recording ID for an eval invocation.
 *
 * Format: eval__<datasetId>__<caseId>__<variantId>__<nodeId>__inv<invocation>
 */
export function generateRecordingId(params: {
	datasetId: string;
	caseId: string;
	variantId: string;
	nodeId: string;
	invocation: number;
}): string {
	return `eval__${params.datasetId}__${params.caseId}__${params.variantId}__${params.nodeId}__inv${params.invocation}`;
}

/**
 * Parse a recording ID back into its components.
 * Returns undefined if the ID doesn't match the expected format.
 */
export function parseRecordingId(recordingId: string):
	| {
			datasetId: string;
			caseId: string;
			variantId: string;
			nodeId: string;
			invocation: number;
	  }
	| undefined {
	const match = recordingId.match(
		/^eval__(.+)__(.+)__(.+)__(.+)__inv(\d+)$/,
	);
	if (!match) return undefined;

	return {
		datasetId: match[1]!,
		caseId: match[2]!,
		variantId: match[3]!,
		nodeId: match[4]!,
		invocation: parseInt(match[5]!, 10),
	};
}

// ============================================================================
// Metric extraction helpers
// ============================================================================

/**
 * Metrics extracted from agent:complete events.
 */
export type ExtractedMetrics = {
	totalDurationMs: number;
	totalCostUsd: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	byNode: Record<
		string,
		{
			durationMs: number;
			totalCostUsd: number;
			inputTokens: number;
			outputTokens: number;
			invocations: number;
		}
	>;
};

// ============================================================================
// Validation result type
// ============================================================================

/**
 * Result of validating a dataset.
 */
export type ValidationResult = {
	valid: boolean;
	errors: string[];
	warnings: string[];
};

// ============================================================================
// Engine options types (for future use in Phase 7)
// ============================================================================

/**
 * Options for running an eval matrix.
 */
export type EvalMatrixRunOptions = {
	dataset: EvalDataset;
	variants: EvalVariant[];
	mode: "record" | "replay" | "live";
	baselineVariantId?: string;
	tags?: string[];
};

// ============================================================================
// Phase 7: Workflow factory and result types
// ============================================================================

/**
 * Factory function that creates a workflow for a given eval case.
 *
 * This abstraction allows the eval runner to execute different workflow
 * configurations (variants) without knowing the internal workflow structure.
 *
 * @example
 * ```ts
 * const workflowFactory: WorkflowFactory = ({ caseInput, variantId }) => ({
 *   flow: createCoderReviewerFlow(caseInput),
 *   register(registry, mode) {
 *     registry.register(createClaudeNode(mode === "replay" ? mockProvider : liveProvider));
 *   },
 *   primaryOutputNodeId: "reviewer",
 * });
 * ```
 */
export type WorkflowFactory = (args: {
	datasetId: string;
	caseId: string;
	variantId: string;
	caseInput: unknown;
}) => {
	/**
	 * The flow definition to execute.
	 */
	flow: FlowDefinition;

	/**
	 * Register node types with the registry.
	 * Called before each case execution.
	 *
	 * @param registry - The node registry to populate
	 * @param mode - Current execution mode (record/replay/live)
	 */
	register(registry: NodeRegistry, mode: "record" | "replay" | "live"): void;

	/**
	 * Optional: The node ID whose output is considered the primary result.
	 * Used for output.* assertions when path starts with "primaryOutput".
	 */
	primaryOutputNodeId?: string;
};

/**
 * Result of running a single eval case against a variant.
 */
export type CaseResult = {
	/** Case identifier from the dataset */
	caseId: string;
	/** Variant identifier used for this run */
	variantId: string;
	/** The artifact produced by the workflow execution */
	artifact: EvalArtifact;
	/** Results of evaluating each assertion */
	assertionResults: AssertionResult[];
	/** Score breakdown from all scorers */
	scores: ScoreBreakdown;
	/** Overall pass/fail based on assertion results */
	passed: boolean;
	/** Error message if the case failed to execute */
	error?: string;
};

/**
 * Result of running all cases in a dataset against a variant.
 */
export type DatasetResult = {
	/** Dataset identifier */
	datasetId: string;
	/** Variant identifier used for all cases */
	variantId: string;
	/** Results for each case */
	caseResults: CaseResult[];
	/** Summary statistics */
	summary: {
		/** Total number of cases */
		total: number;
		/** Number of passing cases */
		passed: number;
		/** Number of failing cases */
		failed: number;
		/** Pass rate as a decimal (0-1) */
		passRate: number;
	};
};

/**
 * Result of running a dataset against multiple variants (matrix execution).
 */
export type MatrixResult = {
	/** Dataset identifier */
	datasetId: string;
	/** Results for each variant */
	variantResults: DatasetResult[];
	/** Optional comparison against a baseline variant */
	comparison?: ComparisonResult;
};

/**
 * Result of comparing a candidate variant against a baseline.
 */
export type ComparisonResult = {
	/** The variant used as baseline */
	baselineVariantId: string;
	/** Cases that regressed (were passing, now failing or worse) */
	regressions: Regression[];
	/** Cases that improved (were failing, now passing or better) */
	improvements: Improvement[];
};

/**
 * A regression detected when comparing to baseline.
 */
export type Regression = {
	/** Case that regressed */
	caseId: string;
	/** Variant with the regression */
	variantId: string;
	/** Type of regression */
	type: "assertion" | "metric" | "score";
	/** Human-readable description */
	description: string;
	/** Baseline value */
	baseline: unknown;
	/** Current (regressed) value */
	current: unknown;
};

/**
 * An improvement detected when comparing to baseline.
 * Same shape as Regression but different semantics.
 */
export type Improvement = Regression;

/**
 * Configurable thresholds for regression/improvement detection.
 *
 * All values are expressed as ratios (e.g., 0.2 = 20%).
 */
export type ComparisonThresholds = {
	/** Latency increase threshold (default: 0.2 = 20%) */
	latencyIncrease: number;
	/** Cost increase threshold (default: 0.1 = 10%) */
	costIncrease: number;
	/** Score decrease threshold (default: 0.1 = 10%) */
	scoreDecrease: number;
};

/**
 * Default comparison thresholds.
 */
export const DEFAULT_COMPARISON_THRESHOLDS: ComparisonThresholds = {
	latencyIncrease: 0.2,
	costIncrease: 0.1,
	scoreDecrease: 0.1,
};
