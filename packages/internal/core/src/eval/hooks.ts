/**
 * Lifecycle hooks for eval execution.
 *
 * Hooks allow external systems to observe and react to eval events,
 * such as case completion, score computation, and regression detection.
 */

import type { RuntimeEvent } from "../state/index.js";
import type { CaseResult, Score } from "./types.js";

// ============================================================================
// Hook interface
// ============================================================================

/**
 * Hooks for eval lifecycle events.
 *
 * All hooks are optional and may be synchronous or asynchronous.
 */
export interface EvalHooks {
	/**
	 * Called before a case starts executing.
	 *
	 * @param caseId - ID of the case about to run
	 * @param variantId - ID of the variant being used
	 */
	onCaseStart?(caseId: string, variantId: string): void | Promise<void>;

	/**
	 * Called after a case completes (success or failure).
	 *
	 * @param result - Complete result of the case execution
	 */
	onCaseComplete?(result: CaseResult): void | Promise<void>;

	/**
	 * Called when a recording is linked to a provider invocation.
	 *
	 * This event establishes provenance between runtime runs and provider recordings.
	 *
	 * @param event - Recording linked event
	 */
	onRecordingLinked?(
		event: RuntimeEvent & { type: "recording:linked" },
	): void | Promise<void>;

	/**
	 * Called when a score is computed for a case.
	 *
	 * @param caseId - ID of the case
	 * @param score - Computed score
	 */
	onScore?(caseId: string, score: Score): void | Promise<void>;

	/**
	 * Called when a regression is detected during comparison.
	 *
	 * @param regression - Details of the regression
	 */
	onRegression?(regression: {
		caseId: string;
		type: string;
		description: string;
	}): void | Promise<void>;
}

// ============================================================================
// Hook implementations
// ============================================================================

/**
 * Create a no-op hooks implementation.
 *
 * Useful as a default or placeholder.
 *
 * @returns Empty hooks object
 */
export function createNoOpHooks(): EvalHooks {
	return {};
}

/**
 * Create hooks that log to console.
 *
 * Useful for debugging and development.
 *
 * @returns Console logging hooks
 */
export function createConsoleHooks(): EvalHooks {
	return {
		onCaseStart(caseId, variantId) {
			console.log(`[eval] Starting case ${caseId} with variant ${variantId}`);
		},

		onCaseComplete(result) {
			const status = result.passed ? "PASS" : "FAIL";
			const score = (result.scores.overall * 100).toFixed(1);
			console.log(
				`[eval] Case ${result.caseId}: ${status} (score: ${score}%)`,
			);

			if (!result.passed && result.error) {
				console.log(`[eval]   Error: ${result.error}`);
			}

			if (!result.passed) {
				const failed = result.assertionResults.filter((a) => !a.passed);
				for (const assertion of failed) {
					console.log(
						`[eval]   Failed: ${assertion.assertion.type} - ${assertion.message ?? "no message"}`,
					);
				}
			}
		},

		onRecordingLinked(event) {
			console.log(
				`[eval] Recording linked: ${event.recordingId} (${event.mode})`,
			);
		},

		onScore(caseId, score) {
			console.log(
				`[eval] Score for ${caseId}: ${score.name} = ${(score.value * 100).toFixed(1)}%`,
			);
		},

		onRegression(regression) {
			console.warn(
				`[eval] REGRESSION in ${regression.caseId} [${regression.type}]: ${regression.description}`,
			);
		},
	};
}

/**
 * Compose multiple hooks implementations into one.
 *
 * All hooks will be called in order. If any hook throws,
 * subsequent hooks will not be called.
 *
 * @param hooksList - Array of hooks to compose
 * @returns Composed hooks
 */
export function composeHooks(...hooksList: EvalHooks[]): EvalHooks {
	return {
		async onCaseStart(caseId, variantId) {
			for (const hooks of hooksList) {
				await hooks.onCaseStart?.(caseId, variantId);
			}
		},

		async onCaseComplete(result) {
			for (const hooks of hooksList) {
				await hooks.onCaseComplete?.(result);
			}
		},

		async onRecordingLinked(event) {
			for (const hooks of hooksList) {
				await hooks.onRecordingLinked?.(event);
			}
		},

		async onScore(caseId, score) {
			for (const hooks of hooksList) {
				await hooks.onScore?.(caseId, score);
			}
		},

		async onRegression(regression) {
			for (const hooks of hooksList) {
				await hooks.onRegression?.(regression);
			}
		},
	};
}

/**
 * Create hooks that collect results for testing.
 *
 * @returns Hooks with collected results
 */
export function createCollectingHooks(): EvalHooks & {
	casesStarted: { caseId: string; variantId: string }[];
	casesCompleted: CaseResult[];
	recordingsLinked: (RuntimeEvent & { type: "recording:linked" })[];
	scores: { caseId: string; score: Score }[];
	regressions: { caseId: string; type: string; description: string }[];
} {
	const casesStarted: { caseId: string; variantId: string }[] = [];
	const casesCompleted: CaseResult[] = [];
	const recordingsLinked: (RuntimeEvent & { type: "recording:linked" })[] = [];
	const scores: { caseId: string; score: Score }[] = [];
	const regressions: { caseId: string; type: string; description: string }[] =
		[];

	return {
		casesStarted,
		casesCompleted,
		recordingsLinked,
		scores,
		regressions,

		onCaseStart(caseId, variantId) {
			casesStarted.push({ caseId, variantId });
		},

		onCaseComplete(result) {
			casesCompleted.push(result);
		},

		onRecordingLinked(event) {
			recordingsLinked.push(event);
		},

		onScore(caseId, score) {
			scores.push({ caseId, score });
		},

		onRegression(regression) {
			regressions.push(regression);
		},
	};
}
