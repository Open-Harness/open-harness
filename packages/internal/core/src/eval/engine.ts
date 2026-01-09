/**
 * Eval engine - the main entry point for running evaluations.
 *
 * The engine provides a high-level API for executing eval matrices,
 * comparing results, and generating reports.
 */

import type { RunStore } from "../persistence/index.js";
import type { RecordingStore } from "../recording/index.js";
import { compareToBaseline } from "./compare.js";
import type { EvalHooks } from "./hooks.js";
import { generateReport, type ReportOptions } from "./report.js";
import { runMatrix, type RunMode } from "./runner.js";
import type {
	EvalDataset,
	EvalVariant,
	WorkflowFactory,
	MatrixResult,
	Scorer,
} from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the eval engine.
 */
export type EvalEngineConfig = {
	/** Store for provider recordings */
	recordingStore: RecordingStore;
	/** Optional store for run persistence */
	runStore?: RunStore;
	/** Factory function to create workflows */
	workflowFactory: WorkflowFactory;
	/** Optional scorers (defaults to latency, cost, tokens) */
	scorers?: Scorer[];
	/** Optional lifecycle hooks */
	hooks?: EvalHooks;
};

// ============================================================================
// Engine interface
// ============================================================================

/**
 * Eval engine interface.
 *
 * Provides methods for running evaluations and generating reports.
 */
export interface EvalEngine {
	/**
	 * Run a dataset against variants and optionally compare to baseline.
	 *
	 * @param options - Matrix run options
	 * @returns Matrix result with all variant results and comparison
	 */
	runMatrix(options: {
		dataset: EvalDataset;
		variants: EvalVariant[];
		mode: RunMode;
		baselineVariantId?: string;
	}): Promise<MatrixResult>;

	/**
	 * Generate a report from matrix results.
	 *
	 * @param result - Matrix result to report on
	 * @param options - Report options (format, details, etc.)
	 * @returns Formatted report string
	 */
	report(result: MatrixResult, options?: ReportOptions): string;
}

// ============================================================================
// Engine implementation
// ============================================================================

/**
 * Create an eval engine.
 *
 * @param config - Engine configuration
 * @returns Eval engine instance
 *
 * @example
 * ```ts
 * const engine = createEvalEngine({
 *   recordingStore: new InMemoryRecordingStore(),
 *   workflowFactory: createCoderReviewerWorkflow,
 * });
 *
 * const result = await engine.runMatrix({
 *   dataset: myDataset,
 *   variants: [baselineVariant, candidateVariant],
 *   mode: "replay",
 *   baselineVariantId: "baseline",
 * });
 *
 * console.log(engine.report(result, { format: "markdown" }));
 * ```
 */
export function createEvalEngine(config: EvalEngineConfig): EvalEngine {
	return {
		async runMatrix(options) {
			// Run the matrix
			const result = await runMatrix(
				{
					recordingStore: config.recordingStore,
					runStore: config.runStore,
					workflowFactory: config.workflowFactory,
					scorers: config.scorers,
					hooks: config.hooks,
				},
				options.dataset,
				options.variants,
				options.mode,
				options.baselineVariantId,
			);

			// Run comparison if baseline specified
			if (options.baselineVariantId) {
				const baseline = result.variantResults.find(
					(r) => r.variantId === options.baselineVariantId,
				);

				if (baseline) {
					// Compare each candidate to baseline
					for (const candidate of result.variantResults) {
						if (candidate.variantId !== options.baselineVariantId) {
							const comparison = compareToBaseline(baseline, candidate);

							// Call regression hooks
							if (config.hooks?.onRegression) {
								for (const regression of comparison.regressions) {
									await config.hooks.onRegression({
										caseId: regression.caseId,
										type: regression.type,
										description: regression.description,
									});
								}
							}

							// Store comparison (last one wins if multiple candidates)
							result.comparison = comparison;
						}
					}
				}
			}

			return result;
		},

		report(result, options = { format: "markdown" }) {
			return generateReport(result, options);
		},
	};
}
