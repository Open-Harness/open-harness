/**
 * Composition assertion evaluators.
 *
 * These enable combining assertions with boolean logic: all, any, not.
 */

import type { Signal } from "@signals/core";
import type { AssertionResult, CaseMetrics } from "../types.js";
import type { AllAssertion, AnyAssertion, NotAssertion, SignalAssertion } from "./types.js";

/**
 * Context for assertion evaluation.
 */
export interface EvaluationContext {
	signals: readonly Signal[];
	finalState: unknown;
	output: unknown;
	metrics: CaseMetrics;
	/** Evaluator function for recursive evaluation */
	evaluate: (assertion: SignalAssertion, ctx: EvaluationContext) => AssertionResult;
}

/**
 * Evaluate all assertion (AND).
 *
 * All nested assertions must pass.
 */
export function evaluateAll(assertion: AllAssertion, ctx: EvaluationContext): AssertionResult {
	const results: AssertionResult[] = [];

	for (const nested of assertion.assertions) {
		const result = ctx.evaluate(nested, ctx);
		results.push(result);
	}

	const passed = results.every((r) => r.passed);
	const failed = results.filter((r) => !r.passed);

	if (!passed) {
		return {
			assertion,
			passed: false,
			message: `${failed.length} of ${results.length} assertions failed`,
			expected: "all pass",
			actual: failed.map((r) => r.message),
		};
	}

	return {
		assertion,
		passed: true,
		message: `All ${results.length} assertions passed`,
	};
}

/**
 * Evaluate any assertion (OR).
 *
 * At least one nested assertion must pass.
 */
export function evaluateAny(assertion: AnyAssertion, ctx: EvaluationContext): AssertionResult {
	const results: AssertionResult[] = [];

	for (const nested of assertion.assertions) {
		const result = ctx.evaluate(nested, ctx);
		results.push(result);

		// Short-circuit on first pass
		if (result.passed) {
			return {
				assertion,
				passed: true,
				message: `Assertion passed: ${result.message}`,
			};
		}
	}

	return {
		assertion,
		passed: false,
		message: `None of ${results.length} assertions passed`,
		expected: "at least one pass",
		actual: results.map((r) => r.message),
	};
}

/**
 * Evaluate not assertion (negation).
 *
 * Nested assertion must NOT pass.
 */
export function evaluateNot(assertion: NotAssertion, ctx: EvaluationContext): AssertionResult {
	const result = ctx.evaluate(assertion.assertion, ctx);

	if (result.passed) {
		return {
			assertion,
			passed: false,
			message: `Assertion passed (expected to fail): ${result.message}`,
			expected: "failure",
			actual: "passed",
		};
	}

	return {
		assertion,
		passed: true,
		message: `Assertion failed (as expected): ${result.message}`,
	};
}
