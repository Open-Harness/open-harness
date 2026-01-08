/**
 * DX layer types for Open Harness eval system.
 *
 * These types provide an ergonomic API for defining and running eval suites,
 * wrapping the lower-level Phase 7 primitives (EvalDataset, EvalVariant, WorkflowFactory).
 */

import type { FlowDefinition } from "../state/index.js";
import type { NodeRegistry } from "../nodes/index.js";
import type { MatrixResult, DatasetResult, CaseResult, Assertion } from "./types.js";
import type { Scorer } from "./types.js";
import type { EvalHooks } from "./hooks.js";
import type { RecordingStore } from "../recording/index.js";
import type { RunStore } from "../persistence/index.js";
import type { RunMode } from "./runner.js";

// ============================================================================
// Case definition
// ============================================================================

/**
 * A test case in a suite.
 *
 * Similar to EvalCase but simplified for the DX layer.
 */
export type SuiteCase = {
	/** Unique identifier for this case */
	id: string;
	/** Human-readable name (optional) */
	name?: string;
	/** Input for the workflow */
	input: Record<string, unknown>;
	/** Assertions to evaluate */
	assertions?: Assertion[];
	/** Tags for filtering */
	tags?: string[];
};

// ============================================================================
// Variant definition
// ============================================================================

/**
 * Variant definition created by the variant() helper.
 *
 * Variants specify how to configure nodes differently for comparison testing.
 */
export type VariantDef = {
	/** Unique identifier (e.g., "claude/sonnet", "openai/gpt-4") */
	id: string;
	/** Model to use for all nodes (or per-node override) */
	model?: string;
	/** Model overrides per node */
	modelByNode?: Record<string, string>;
	/** Provider type overrides per node */
	providerTypeByNode?: Record<string, string>;
	/** Tags for categorization */
	tags?: string[];
	/** Additional configuration passed to workflow factory */
	config?: Record<string, unknown>;
};

/**
 * Options for creating a variant.
 */
export type VariantOptions = {
	/** Model to use (applies to all nodes unless overridden) */
	model?: string;
	/** Model overrides per node */
	modelByNode?: Record<string, string>;
	/** Provider type overrides per node */
	providerTypeByNode?: Record<string, string>;
	/** Tags for categorization */
	tags?: string[];
	/** Additional configuration */
	config?: Record<string, unknown>;
};

// ============================================================================
// Gate definitions
// ============================================================================

/**
 * A gate is a pass/fail condition evaluated against suite results.
 *
 * Gates are evaluated after all cases run and determine if the suite passes.
 */
export type Gate = {
	/** Unique name for the gate */
	name: string;
	/** Human-readable description */
	description: string;
	/** Evaluate the gate against results */
	evaluate(result: MatrixResult): GateResult;
};

/**
 * Result of evaluating a gate.
 */
export type GateResult = {
	/** Gate name */
	name: string;
	/** Whether the gate passed */
	passed: boolean;
	/** Human-readable message */
	message: string;
	/** Optional details */
	details?: Record<string, unknown>;
};

// ============================================================================
// Suite configuration
// ============================================================================

/**
 * Workflow factory for the DX layer.
 *
 * Simplified from Phase 7's WorkflowFactory to work with suite-level defaults.
 */
export type SuiteWorkflowFactory = (args: {
	caseId: string;
	caseInput: Record<string, unknown>;
	variant: VariantDef;
}) => {
	/** The flow definition to execute */
	flow: FlowDefinition;
	/** Register node types with the registry */
	register(registry: NodeRegistry, mode: RunMode): void;
	/** Optional: primary output node for assertions */
	primaryOutputNodeId?: string;
};

/**
 * Configuration for defining an eval suite.
 *
 * @example
 * ```ts
 * const suite = defineSuite({
 *   name: "coder-reviewer",
 *   flow: coderReviewerWorkflow,
 *   cases: [
 *     { id: "simple", input: { task: "Build hello API" } },
 *   ],
 *   variants: [
 *     variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" }),
 *   ],
 *   baseline: "claude/sonnet",
 *   gates: [gates.passRate(0.9)],
 * });
 * ```
 */
export type SuiteConfig = {
	/** Suite name (becomes dataset ID) */
	name: string;
	/** Version string */
	version?: string;
	/** Workflow factory that creates flows per case/variant */
	flow: SuiteWorkflowFactory;
	/** Test cases */
	cases: SuiteCase[];
	/** Variants to test */
	variants: VariantDef[];
	/** Baseline variant ID for comparison */
	baseline?: string;
	/** Gates to evaluate after run */
	gates?: Gate[];
	/** Default assertions applied to all cases */
	defaultAssertions?: Assertion[];
	/** Optional custom scorers */
	scorers?: Scorer[];
	/** Optional lifecycle hooks */
	hooks?: EvalHooks;
};

// ============================================================================
// Suite definition (validated)
// ============================================================================

/**
 * A validated suite definition ready to run.
 */
export type Suite = {
	/** Suite configuration */
	config: SuiteConfig;
	/** Validated and ready to use */
	readonly validated: true;
};

// ============================================================================
// Suite run options
// ============================================================================

/**
 * Options for running a suite.
 */
export type SuiteRunOptions = {
	/** Execution mode */
	mode: RunMode;
	/** Recording store for provider recordings */
	recordingStore?: RecordingStore;
	/** Run store for persistence */
	runStore?: RunStore;
	/** Filter cases by tag */
	filterTags?: string[];
	/** Filter to specific case IDs */
	filterCases?: string[];
	/** Override baseline for this run */
	baseline?: string;
};

// ============================================================================
// Suite report
// ============================================================================

/**
 * Report produced by running a suite.
 *
 * Extends MatrixResult with gate results and formatted output.
 */
export type SuiteReport = {
	/** Suite name */
	suiteName: string;
	/** Underlying matrix result */
	matrixResult: MatrixResult;
	/** Gate evaluation results */
	gateResults: GateResult[];
	/** Overall suite pass/fail */
	passed: boolean;
	/** Summary statistics */
	summary: SuiteReportSummary;
};

/**
 * Summary statistics for a suite report.
 */
export type SuiteReportSummary = {
	/** Total cases across all variants */
	totalCases: number;
	/** Passing cases */
	passedCases: number;
	/** Failing cases */
	failedCases: number;
	/** Pass rate (0-1) */
	passRate: number;
	/** Number of gates that passed */
	gatesPassed: number;
	/** Total gates */
	totalGates: number;
	/** Number of regressions (if baseline comparison) */
	regressions: number;
};
