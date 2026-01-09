/**
 * Eval runner for executing workflows against datasets.
 *
 * This module provides functions to run eval cases, datasets, and matrices,
 * collecting artifacts, assertions, and scores for each execution.
 */

import type { NodeRegistry } from "../nodes/index.js";
import { DefaultNodeRegistry } from "../nodes/index.js";
import type { RunStore } from "../persistence/index.js";
import type { RecordingStore } from "../recording/index.js";
import type { RuntimeEvent, RuntimeEventPayload } from "../state/index.js";
import { createRuntime } from "../runtime/index.js";
import { evaluateAssertions, extractMetrics } from "./assertions.js";
import {
	defaultLatencyScorer,
	defaultCostScorer,
	defaultTokensScorer,
} from "./scorers/index.js";
import type {
	EvalDataset,
	EvalVariant,
	EvalArtifact,
	EvalCase,
	CaseResult,
	DatasetResult,
	MatrixResult,
	WorkflowFactory,
	Scorer,
	ScoreBreakdown,
	Score,
} from "./types.js";
import { generateRecordingId } from "./types.js";
import type { EvalHooks } from "./hooks.js";

// ============================================================================
// Configuration types
// ============================================================================

/**
 * Configuration for the eval runner.
 */
export type RunnerConfig = {
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

/**
 * Execution mode for eval runs.
 *
 * - "record": Execute live and save recordings
 * - "replay": Replay from saved recordings
 * - "live": Execute live without recording
 */
export type RunMode = "record" | "replay" | "live";

// ============================================================================
// Run case
// ============================================================================

/**
 * Run a single case against a variant.
 *
 * @param config - Runner configuration
 * @param dataset - Dataset containing the case
 * @param caseId - ID of the case to run
 * @param variant - Variant configuration
 * @param mode - Execution mode
 * @returns Case result with artifact, assertions, and scores
 */
export async function runCase(
	config: RunnerConfig,
	dataset: EvalDataset,
	caseId: string,
	variant: EvalVariant,
	mode: RunMode,
): Promise<CaseResult> {
	// 1. Find the case
	const evalCase = dataset.cases.find((c) => c.id === caseId);
	if (!evalCase) {
		throw new Error(`Case "${caseId}" not found in dataset "${dataset.id}"`);
	}

	// Call hook
	await config.hooks?.onCaseStart?.(caseId, variant.id);

	try {
		// 2. Call workflowFactory to get flow + register function
		const { flow, register, primaryOutputNodeId } = config.workflowFactory({
			datasetId: dataset.id,
			caseId: evalCase.id,
			variantId: variant.id,
			caseInput: evalCase.input,
		});

		// 3. Create NodeRegistry and call register(registry, mode)
		const registry: NodeRegistry = new DefaultNodeRegistry();
		register(registry, mode);

		// 4. Create runtime and collect events
		const events: RuntimeEvent[] = [];
		const invocationCounters = new Map<string, number>();

		const runtime = createRuntime({
			flow,
			registry,
			store: config.runStore,
		});

		// Subscribe to events
		const unsubscribe = runtime.onEvent((event) => {
			// Emit recording:linked event before agent events
			if (event.type === "node:start") {
				const nodeId = event.nodeId;
				const invocation = (invocationCounters.get(nodeId) ?? 0) + 1;
				invocationCounters.set(nodeId, invocation);

				// Generate deterministic recording ID
				const recordingId = generateRecordingId({
					datasetId: dataset.id,
					caseId: evalCase.id,
					variantId: variant.id,
					nodeId,
					invocation,
				});

				// Get provider type from variant config
				const providerType = variant.providerTypeByNode[nodeId] ?? "unknown";

				// Emit recording:linked event
				const linkedEvent: RuntimeEvent = {
					type: "recording:linked",
					runId: event.runId,
					nodeId,
					invocation,
					providerType,
					recordingId,
					mode,
					timestamp: Date.now(),
				};
				events.push(linkedEvent);

				// Also call hooks
				config.hooks?.onRecordingLinked?.(linkedEvent);
			}

			events.push(event);
		});

		// 5. Run the workflow
		let snapshot;
		try {
			snapshot = await runtime.run(
				evalCase.input as Record<string, unknown>,
			);
		} finally {
			unsubscribe();
		}

		// 6. Build artifact
		const artifact: EvalArtifact = {
			runId: snapshot.runId ?? `eval-${dataset.id}-${caseId}-${variant.id}`,
			snapshot,
			events,
		};

		// Add primaryOutput to snapshot outputs if specified
		if (primaryOutputNodeId && snapshot.outputs[primaryOutputNodeId]) {
			snapshot.outputs.primaryOutput = snapshot.outputs[primaryOutputNodeId];
		}

		// 7. Evaluate assertions
		const assertionResults = evaluateAssertions(artifact, evalCase.assertions);

		// 8. Run scorers
		const scorers = config.scorers ?? [
			defaultLatencyScorer,
			defaultCostScorer,
			defaultTokensScorer,
		];
		const scores = runScorers(artifact, scorers);

		// Call score hook for each score
		if (config.hooks?.onScore) {
			for (const score of scores.scores) {
				await config.hooks.onScore(caseId, score);
			}
		}

		// 9. Determine pass/fail
		const passed = assertionResults.every((r) => r.passed);

		// Build result
		const result: CaseResult = {
			caseId,
			variantId: variant.id,
			artifact,
			assertionResults,
			scores,
			passed,
		};

		// Call hook
		await config.hooks?.onCaseComplete?.(result);

		return result;
	} catch (error) {
		// Handle execution errors
		const errorMessage =
			error instanceof Error ? error.message : String(error);

		// Create empty artifact for error case
		const artifact: EvalArtifact = {
			runId: `eval-${dataset.id}-${caseId}-${variant.id}-error`,
			snapshot: {
				status: "complete",
				outputs: {},
				state: {},
				nodeStatus: {},
				edgeStatus: {},
				loopCounters: {},
				inbox: [],
				agentSessions: {},
			},
			events: [],
		};

		const result: CaseResult = {
			caseId,
			variantId: variant.id,
			artifact,
			assertionResults: [],
			scores: { overall: 0, scores: [] },
			passed: false,
			error: errorMessage,
		};

		// Call hook
		await config.hooks?.onCaseComplete?.(result);

		return result;
	}
}

// ============================================================================
// Run dataset
// ============================================================================

/**
 * Run all cases in a dataset against a variant.
 *
 * @param config - Runner configuration
 * @param dataset - Dataset to run
 * @param variant - Variant configuration
 * @param mode - Execution mode
 * @returns Dataset result with all case results
 */
export async function runDataset(
	config: RunnerConfig,
	dataset: EvalDataset,
	variant: EvalVariant,
	mode: RunMode,
): Promise<DatasetResult> {
	const caseResults: CaseResult[] = [];

	// Run each case sequentially
	for (const evalCase of dataset.cases) {
		const result = await runCase(config, dataset, evalCase.id, variant, mode);
		caseResults.push(result);
	}

	// Calculate summary
	const total = caseResults.length;
	const passed = caseResults.filter((r) => r.passed).length;
	const failed = total - passed;
	const passRate = total > 0 ? passed / total : 0;

	return {
		datasetId: dataset.id,
		variantId: variant.id,
		caseResults,
		summary: {
			total,
			passed,
			failed,
			passRate,
		},
	};
}

// ============================================================================
// Run matrix
// ============================================================================

/**
 * Run a dataset against multiple variants (matrix execution).
 *
 * @param config - Runner configuration
 * @param dataset - Dataset to run
 * @param variants - Variants to test
 * @param mode - Execution mode
 * @param baselineVariantId - Optional baseline variant for comparison
 * @returns Matrix result with all variant results
 */
export async function runMatrix(
	config: RunnerConfig,
	dataset: EvalDataset,
	variants: EvalVariant[],
	mode: RunMode,
	baselineVariantId?: string,
): Promise<MatrixResult> {
	const variantResults: DatasetResult[] = [];

	// Run dataset for each variant
	for (const variant of variants) {
		const result = await runDataset(config, dataset, variant, mode);
		variantResults.push(result);
	}

	return {
		datasetId: dataset.id,
		variantResults,
		// Comparison is done in engine.ts using compare.ts
	};
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Run all scorers against an artifact and compute overall score.
 */
function runScorers(artifact: EvalArtifact, scorers: Scorer[]): ScoreBreakdown {
	const scores: Score[] = [];

	for (const scorer of scorers) {
		try {
			const score = scorer.score(artifact);
			scores.push(score);
		} catch {
			// Scorer failed - add zero score
			scores.push({
				name: scorer.name,
				value: 0,
				metadata: { error: "Scorer failed" },
			});
		}
	}

	// Calculate overall score as average of all scores
	const overall =
		scores.length > 0
			? scores.reduce((sum, s) => sum + s.value, 0) / scores.length
			: 0;

	return {
		overall,
		scores,
	};
}
