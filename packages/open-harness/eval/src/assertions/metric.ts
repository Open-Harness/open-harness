/**
 * Metric assertion evaluators.
 *
 * These evaluate execution metrics: latency, cost, tokens, activations.
 */

import type { AssertionResult, CaseMetrics } from "../types.js";
import type {
	MetricActivationsAssertion,
	MetricCostAssertion,
	MetricLatencyAssertion,
	MetricTokensAssertion,
} from "./types.js";

/**
 * Evaluate metric.latency.* assertion.
 */
export function evaluateMetricLatency(assertion: MetricLatencyAssertion, metrics: CaseMetrics): AssertionResult {
	const actual = metrics.latencyMs;
	const isMax = assertion.type === "metric.latency.max";

	const passed = isMax ? actual <= assertion.value : actual >= assertion.value;

	return {
		assertion,
		passed,
		message: passed
			? `Latency ${actual}ms is ${isMax ? "within" : "above"} ${isMax ? "max" : "min"} ${assertion.value}ms`
			: `Latency ${actual}ms ${isMax ? "exceeds max" : "below min"} ${assertion.value}ms`,
		expected: assertion.value,
		actual,
	};
}

/**
 * Evaluate metric.cost.* assertion.
 */
export function evaluateMetricCost(assertion: MetricCostAssertion, metrics: CaseMetrics): AssertionResult {
	const actual = metrics.cost;
	const isMax = assertion.type === "metric.cost.max";

	const passed = isMax ? actual <= assertion.value : actual >= assertion.value;

	return {
		assertion,
		passed,
		message: passed
			? `Cost $${actual.toFixed(4)} is ${isMax ? "within" : "above"} ${isMax ? "max" : "min"} $${assertion.value.toFixed(4)}`
			: `Cost $${actual.toFixed(4)} ${isMax ? "exceeds max" : "below min"} $${assertion.value.toFixed(4)}`,
		expected: assertion.value,
		actual,
	};
}

/**
 * Evaluate metric.tokens.* assertion.
 */
export function evaluateMetricTokens(assertion: MetricTokensAssertion, metrics: CaseMetrics): AssertionResult {
	let actual: number;
	const field = assertion.field ?? "total";

	switch (field) {
		case "input":
			actual = metrics.inputTokens;
			break;
		case "output":
			actual = metrics.outputTokens;
			break;
		case "total":
		default:
			actual = metrics.totalTokens;
			break;
	}

	const isMax = assertion.type === "metric.tokens.max";
	const passed = isMax ? actual <= assertion.value : actual >= assertion.value;

	return {
		assertion,
		passed,
		message: passed
			? `${field} tokens (${actual}) is ${isMax ? "within" : "above"} ${isMax ? "max" : "min"} ${assertion.value}`
			: `${field} tokens (${actual}) ${isMax ? "exceeds max" : "below min"} ${assertion.value}`,
		expected: assertion.value,
		actual,
	};
}

/**
 * Evaluate metric.activations assertion.
 */
export function evaluateMetricActivations(
	assertion: MetricActivationsAssertion,
	metrics: CaseMetrics,
): AssertionResult {
	const actual = metrics.activations;

	// Check exact count
	if (assertion.exact !== undefined) {
		const passed = actual === assertion.exact;
		return {
			assertion,
			passed,
			message: passed
				? `Exactly ${actual} activation(s)`
				: `Expected exactly ${assertion.exact} activation(s), got ${actual}`,
			expected: assertion.exact,
			actual,
		};
	}

	// Check min/max
	let passed = true;
	const issues: string[] = [];

	if (assertion.min !== undefined && actual < assertion.min) {
		passed = false;
		issues.push(`expected min ${assertion.min}, got ${actual}`);
	}
	if (assertion.max !== undefined && actual > assertion.max) {
		passed = false;
		issues.push(`expected max ${assertion.max}, got ${actual}`);
	}

	if (!passed) {
		return {
			assertion,
			passed: false,
			message: `Activations count mismatch: ${issues.join(", ")}`,
			expected: { min: assertion.min, max: assertion.max },
			actual,
		};
	}

	return {
		assertion,
		passed: true,
		message: `${actual} activation(s) (within range)`,
		actual,
	};
}
