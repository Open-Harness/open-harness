/**
 * Case runner - executes a single eval case.
 */

import type { SignalStore } from "@signals/bus";
import type { Provider, Signal } from "@signals/core";
import { type AssertionEvaluationContext, evaluateAssertions } from "../assertions/index.js";
import type { SignalAssertion } from "../assertions/types.js";
import type { CaseMetrics, CaseResult, EvalCase } from "../types.js";

/**
 * Options for running a single case.
 */
export interface RunCaseOptions {
	/** Provider to use for agent execution */
	provider?: Provider;
	/** Signal store for recording */
	store?: SignalStore;
	/** Abort signal for cancellation */
	signal?: AbortSignal;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Run ID for correlation */
	runId?: string;
}

/**
 * Harness factory function type.
 *
 * Creates and runs a harness with the given state, returning signals and output.
 */
export type HarnessFactory<TState> = (
	state: TState,
	options: RunCaseOptions,
) => Promise<HarnessExecutionResult<TState>>;

/**
 * Result from harness execution.
 */
export interface HarnessExecutionResult<TState> {
	/** All signals emitted during execution */
	signals: readonly Signal[];
	/** Final output from the harness */
	output: unknown;
	/** Final state after execution */
	finalState: TState;
	/** Execution metrics */
	metrics: {
		durationMs: number;
		activations: number;
		inputTokens?: number;
		outputTokens?: number;
		cost?: number;
	};
	/** Recording ID if recorded */
	recordingId?: string;
}

/**
 * Run a single eval case.
 *
 * @param factory - Factory function to create and run the harness
 * @param evalCase - The case to run
 * @param defaultAssertions - Additional assertions to apply (from dataset)
 * @param options - Execution options
 * @returns Case result with assertion outcomes
 */
export async function runCase<TState>(
	factory: HarnessFactory<TState>,
	evalCase: EvalCase<TState>,
	defaultAssertions: SignalAssertion[] = [],
	options: RunCaseOptions = {},
): Promise<CaseResult<TState>> {
	const startTime = Date.now();

	// Handle skipped cases
	if (evalCase.skip) {
		return {
			caseId: evalCase.id,
			name: evalCase.name,
			passed: true, // Skipped cases don't fail
			assertions: [],
			signals: [],
			finalState: evalCase.input,
			metrics: emptyMetrics(),
			skipped: true,
			durationMs: 0,
		};
	}

	try {
		// Run the harness with timeout
		const timeout = evalCase.timeout ?? options.timeout ?? 60000;
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Case timed out after ${timeout}ms`)), timeout);
		});

		const executionResult = await Promise.race([factory(evalCase.input, options), timeoutPromise]);

		// Build metrics
		const metrics: CaseMetrics = {
			latencyMs: executionResult.metrics.durationMs,
			inputTokens: executionResult.metrics.inputTokens ?? 0,
			outputTokens: executionResult.metrics.outputTokens ?? 0,
			totalTokens: (executionResult.metrics.inputTokens ?? 0) + (executionResult.metrics.outputTokens ?? 0),
			cost: executionResult.metrics.cost ?? 0,
			activations: executionResult.metrics.activations,
		};

		// Combine default and case-specific assertions
		const allAssertions = [...defaultAssertions, ...evalCase.assertions];

		// Build evaluation context
		const ctx: AssertionEvaluationContext = {
			signals: executionResult.signals,
			finalState: executionResult.finalState,
			output: executionResult.output,
			metrics,
		};

		// Evaluate all assertions
		const assertionResults = evaluateAssertions(allAssertions, ctx);
		const passed = assertionResults.every((r) => r.passed);

		return {
			caseId: evalCase.id,
			name: evalCase.name,
			passed,
			assertions: assertionResults,
			signals: [...executionResult.signals],
			finalState: executionResult.finalState,
			metrics,
			recordingId: executionResult.recordingId,
			durationMs: Date.now() - startTime,
		};
	} catch (error) {
		// Handle execution errors
		return {
			caseId: evalCase.id,
			name: evalCase.name,
			passed: false,
			assertions: [],
			signals: [],
			finalState: evalCase.input,
			metrics: emptyMetrics(),
			error: error instanceof Error ? error : new Error(String(error)),
			durationMs: Date.now() - startTime,
		};
	}
}

/**
 * Create empty metrics for skipped/failed cases.
 */
function emptyMetrics(): CaseMetrics {
	return {
		latencyMs: 0,
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		cost: 0,
		activations: 0,
	};
}
