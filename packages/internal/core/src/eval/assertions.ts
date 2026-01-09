/**
 * Assertion evaluation for the eval system.
 *
 * Evaluates assertions against eval artifacts to determine pass/fail status.
 */

import type { RuntimeEvent, AgentCompleteEventPayload, AgentErrorEventPayload } from "../state/events.js";
import type {
	Assertion,
	AssertionResult,
	EvalArtifact,
	EvalArtifactView,
	ExtractedMetrics,
} from "./types.js";

// ============================================================================
// Public API
// ============================================================================

/**
 * Evaluate all assertions against an artifact.
 *
 * @param artifact - The eval artifact to evaluate against
 * @param assertions - Array of assertions to evaluate
 * @returns Array of assertion results
 */
export function evaluateAssertions(
	artifact: EvalArtifact,
	assertions: Assertion[],
): AssertionResult[] {
	const view = createArtifactView(artifact);
	const metrics = extractMetrics(artifact.events);

	return assertions.map((assertion) =>
		evaluateAssertion(view, metrics, assertion),
	);
}

/**
 * Create a normalized view of an artifact for assertion evaluation.
 *
 * @param artifact - The raw eval artifact
 * @returns Normalized artifact view
 */
export function createArtifactView(artifact: EvalArtifact): EvalArtifactView {
	const metrics = extractMetrics(artifact.events);
	const errors = extractErrors(artifact.events);

	// Calculate workflow timing from flow:start and flow:complete events
	let startedAt: number | undefined;
	let endedAt: number | undefined;

	for (const event of artifact.events) {
		if (event.type === "flow:start" && !startedAt) {
			startedAt = event.timestamp;
		}
		if (event.type === "flow:complete") {
			endedAt = event.timestamp;
		}
	}

	return {
		runId: artifact.runId,
		outputs: artifact.snapshot.outputs,
		state: artifact.snapshot.state,
		metrics: {
			workflow: {
				startedAt,
				endedAt,
				durationMs: startedAt && endedAt ? endedAt - startedAt : undefined,
			},
			byNode: Object.fromEntries(
				Object.entries(metrics.byNode).map(([nodeId, nodeMetrics]) => [
					nodeId,
					{
						durationMs: nodeMetrics.durationMs,
						totalCostUsd: nodeMetrics.totalCostUsd,
						inputTokens: nodeMetrics.inputTokens,
						outputTokens: nodeMetrics.outputTokens,
					},
				]),
			),
		},
		errors: {
			nodeErrors: errors,
		},
	};
}

/**
 * Extract metrics from agent:complete events.
 *
 * @param events - Runtime events
 * @returns Extracted metrics
 */
export function extractMetrics(events: RuntimeEvent[]): ExtractedMetrics {
	const byNode: ExtractedMetrics["byNode"] = {};
	let totalDurationMs = 0;
	let totalCostUsd = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;

	for (const event of events) {
		if (event.type === "agent:complete") {
			const completeEvent = event as AgentCompleteEventPayload & { timestamp: number };
			const { nodeId, durationMs, totalCostUsd: costUsd, usage } = completeEvent;

			// Initialize node metrics if not present
			if (!byNode[nodeId]) {
				byNode[nodeId] = {
					durationMs: 0,
					totalCostUsd: 0,
					inputTokens: 0,
					outputTokens: 0,
					invocations: 0,
				};
			}

			// Accumulate node metrics
			byNode[nodeId].durationMs += durationMs;
			byNode[nodeId].totalCostUsd += costUsd ?? 0;
			byNode[nodeId].inputTokens += usage.inputTokens;
			byNode[nodeId].outputTokens += usage.outputTokens;
			byNode[nodeId].invocations += 1;

			// Accumulate totals
			totalDurationMs += durationMs;
			totalCostUsd += costUsd ?? 0;
			totalInputTokens += usage.inputTokens;
			totalOutputTokens += usage.outputTokens;
		}
	}

	return {
		totalDurationMs,
		totalCostUsd,
		totalInputTokens,
		totalOutputTokens,
		byNode,
	};
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Extract error messages from agent:error events.
 */
function extractErrors(events: RuntimeEvent[]): Record<string, string[]> {
	const errors: Record<string, string[]> = {};

	for (const event of events) {
		if (event.type === "agent:error") {
			const errorEvent = event as AgentErrorEventPayload & { timestamp: number };
			const { nodeId, message } = errorEvent;

			if (!errors[nodeId]) {
				errors[nodeId] = [];
			}
			errors[nodeId].push(message);
		}
	}

	return errors;
}

/**
 * Evaluate a single assertion.
 */
function evaluateAssertion(
	view: EvalArtifactView,
	metrics: ExtractedMetrics,
	assertion: Assertion,
): AssertionResult {
	switch (assertion.type) {
		case "output.contains":
			return evaluateOutputContains(view, assertion);
		case "output.equals":
			return evaluateOutputEquals(view, assertion);
		case "metric.latency_ms.max":
			return evaluateMetricLatencyMax(metrics, assertion);
		case "metric.total_cost_usd.max":
			return evaluateMetricCostMax(metrics, assertion);
		case "metric.tokens.input.max":
			return evaluateMetricInputTokensMax(metrics, assertion);
		case "metric.tokens.output.max":
			return evaluateMetricOutputTokensMax(metrics, assertion);
		case "behavior.no_errors":
			return evaluateBehaviorNoErrors(view, assertion);
		case "behavior.node_executed":
			return evaluateBehaviorNodeExecuted(view, metrics, assertion);
		case "behavior.node_invocations.max":
			return evaluateBehaviorNodeInvocationsMax(metrics, assertion);
		default: {
			// Exhaustive check
			const _exhaustive: never = assertion;
			return {
				assertion: _exhaustive,
				passed: false,
				message: `Unknown assertion type: ${JSON.stringify(assertion)}`,
			};
		}
	}
}

/**
 * Resolve a path against the artifact view.
 *
 * Supports paths like:
 * - "outputs.nodeId.field"
 * - "state.field"
 * - "metrics.byNode.nodeId.durationMs"
 */
function resolvePath(view: EvalArtifactView, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = view;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * Check if a value contains a substring.
 */
function containsValue(actual: unknown, expected: string): boolean {
	if (typeof actual === "string") {
		return actual.includes(expected);
	}
	if (typeof actual === "object" && actual !== null) {
		// Check stringified version for objects
		return JSON.stringify(actual).includes(expected);
	}
	return String(actual).includes(expected);
}

/**
 * Check deep equality.
 */
function deepEquals(actual: unknown, expected: unknown): boolean {
	if (actual === expected) return true;
	if (actual === null || expected === null) return actual === expected;
	if (typeof actual !== typeof expected) return false;

	if (typeof actual === "object") {
		if (Array.isArray(actual) && Array.isArray(expected)) {
			if (actual.length !== expected.length) return false;
			return actual.every((item, i) => deepEquals(item, expected[i]));
		}

		if (Array.isArray(actual) || Array.isArray(expected)) return false;

		const actualKeys = Object.keys(actual);
		const expectedKeys = Object.keys(expected as object);

		if (actualKeys.length !== expectedKeys.length) return false;

		return actualKeys.every((key) =>
			deepEquals(
				(actual as Record<string, unknown>)[key],
				(expected as Record<string, unknown>)[key],
			),
		);
	}

	return false;
}

// ============================================================================
// Assertion evaluators
// ============================================================================

function evaluateOutputContains(
	view: EvalArtifactView,
	assertion: { type: "output.contains"; path: string; value: string },
): AssertionResult {
	const actual = resolvePath(view, assertion.path);

	if (actual === undefined) {
		return {
			assertion,
			passed: false,
			actual: undefined,
			message: `Path "${assertion.path}" not found`,
		};
	}

	const passed = containsValue(actual, assertion.value);

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Expected "${assertion.path}" to contain "${assertion.value}"`,
	};
}

function evaluateOutputEquals(
	view: EvalArtifactView,
	assertion: { type: "output.equals"; path: string; value: unknown },
): AssertionResult {
	const actual = resolvePath(view, assertion.path);

	if (actual === undefined && assertion.value !== undefined) {
		return {
			assertion,
			passed: false,
			actual: undefined,
			message: `Path "${assertion.path}" not found`,
		};
	}

	const passed = deepEquals(actual, assertion.value);

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Expected "${assertion.path}" to equal ${JSON.stringify(assertion.value)}, got ${JSON.stringify(actual)}`,
	};
}

function evaluateMetricLatencyMax(
	metrics: ExtractedMetrics,
	assertion: { type: "metric.latency_ms.max"; value: number },
): AssertionResult {
	const actual = metrics.totalDurationMs;
	const passed = actual <= assertion.value;

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Total latency ${actual}ms exceeds max ${assertion.value}ms`,
	};
}

function evaluateMetricCostMax(
	metrics: ExtractedMetrics,
	assertion: { type: "metric.total_cost_usd.max"; value: number },
): AssertionResult {
	const actual = metrics.totalCostUsd;
	const passed = actual <= assertion.value;

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Total cost $${actual.toFixed(4)} exceeds max $${assertion.value.toFixed(4)}`,
	};
}

function evaluateMetricInputTokensMax(
	metrics: ExtractedMetrics,
	assertion: { type: "metric.tokens.input.max"; value: number },
): AssertionResult {
	const actual = metrics.totalInputTokens;
	const passed = actual <= assertion.value;

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Total input tokens ${actual} exceeds max ${assertion.value}`,
	};
}

function evaluateMetricOutputTokensMax(
	metrics: ExtractedMetrics,
	assertion: { type: "metric.tokens.output.max"; value: number },
): AssertionResult {
	const actual = metrics.totalOutputTokens;
	const passed = actual <= assertion.value;

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Total output tokens ${actual} exceeds max ${assertion.value}`,
	};
}

function evaluateBehaviorNoErrors(
	view: EvalArtifactView,
	assertion: { type: "behavior.no_errors" },
): AssertionResult {
	const allErrors = Object.values(view.errors.nodeErrors).flat();
	const passed = allErrors.length === 0;

	return {
		assertion,
		passed,
		actual: allErrors,
		message: passed
			? undefined
			: `Found ${allErrors.length} error(s): ${allErrors.slice(0, 3).join("; ")}${allErrors.length > 3 ? "..." : ""}`,
	};
}

function evaluateBehaviorNodeExecuted(
	view: EvalArtifactView,
	metrics: ExtractedMetrics,
	assertion: { type: "behavior.node_executed"; nodeId: string },
): AssertionResult {
	const nodeMetrics = metrics.byNode[assertion.nodeId];
	const passed = nodeMetrics !== undefined && nodeMetrics.invocations > 0;

	return {
		assertion,
		passed,
		actual: nodeMetrics?.invocations ?? 0,
		message: passed
			? undefined
			: `Node "${assertion.nodeId}" was not executed`,
	};
}

function evaluateBehaviorNodeInvocationsMax(
	metrics: ExtractedMetrics,
	assertion: { type: "behavior.node_invocations.max"; nodeId: string; value: number },
): AssertionResult {
	const nodeMetrics = metrics.byNode[assertion.nodeId];
	const actual = nodeMetrics?.invocations ?? 0;
	const passed = actual <= assertion.value;

	return {
		assertion,
		passed,
		actual,
		message: passed
			? undefined
			: `Node "${assertion.nodeId}" invoked ${actual} times, exceeds max ${assertion.value}`,
	};
}
