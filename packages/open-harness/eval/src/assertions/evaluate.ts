/**
 * Main assertion evaluation dispatcher.
 *
 * Routes assertions to the appropriate evaluator based on type.
 */

import type { Signal } from "@signals/core";
import type { AssertionResult, CaseMetrics } from "../types.js";
// Agent evaluators
import {
	evaluateAgentActivated,
	evaluateAgentCausedBy,
	evaluateAgentCompleted,
	evaluateAgentEmitted,
	evaluateAgentSkipped,
} from "./agent.js";
// Composition evaluators
import { type EvaluationContext, evaluateAll, evaluateAny, evaluateNot } from "./compose.js";
// Metric evaluators
import {
	evaluateMetricActivations,
	evaluateMetricCost,
	evaluateMetricLatency,
	evaluateMetricTokens,
} from "./metric.js";
// Output evaluators
import {
	evaluateOutputContains,
	evaluateOutputJson,
	evaluateOutputLength,
	evaluateOutputMatches,
	evaluateOutputNotContains,
} from "./output.js";
// Signal evaluators
import {
	evaluateSignalContains,
	evaluateSignalCount,
	evaluateSignalFirst,
	evaluateSignalLast,
	evaluateSignalNot,
	evaluateSignalTrajectory,
} from "./signal.js";
// Snapshot evaluators
import { evaluateSnapshotAt, evaluateSnapshotFinal } from "./snapshot.js";

// Tool evaluators
import { evaluateToolCalled, evaluateToolCalledWith, evaluateToolNotCalled, evaluateToolSequence } from "./tool.js";
import type { SignalAssertion } from "./types.js";

/**
 * Context for evaluating assertions.
 */
export interface AssertionEvaluationContext {
	/** All signals emitted during execution */
	signals: readonly Signal[];
	/** Final state after execution */
	finalState: unknown;
	/** Final output from the harness */
	output: unknown;
	/** Execution metrics */
	metrics: CaseMetrics;
}

/**
 * Evaluate a single assertion against execution results.
 */
export function evaluateAssertion(assertion: SignalAssertion, ctx: AssertionEvaluationContext): AssertionResult {
	const startTime = performance.now();

	// Create evaluation context for composition assertions
	const evalCtx: EvaluationContext = {
		...ctx,
		evaluate: (nested, nestedCtx) => evaluateAssertion(nested, nestedCtx),
	};

	let result: AssertionResult;

	switch (assertion.type) {
		// Signal assertions
		case "signal.contains":
			result = evaluateSignalContains(assertion, ctx.signals);
			break;
		case "signal.not":
			result = evaluateSignalNot(assertion, ctx.signals);
			break;
		case "signal.count":
			result = evaluateSignalCount(assertion, ctx.signals);
			break;
		case "signal.trajectory":
			result = evaluateSignalTrajectory(assertion, ctx.signals);
			break;
		case "signal.first":
			result = evaluateSignalFirst(assertion, ctx.signals);
			break;
		case "signal.last":
			result = evaluateSignalLast(assertion, ctx.signals);
			break;

		// Snapshot assertions
		case "snapshot.at":
			result = evaluateSnapshotAt(assertion, ctx.signals, ctx.finalState);
			break;
		case "snapshot.final":
			result = evaluateSnapshotFinal(assertion, ctx.finalState);
			break;

		// Agent assertions
		case "agent.activated":
			result = evaluateAgentActivated(assertion, ctx.signals);
			break;
		case "agent.completed":
			result = evaluateAgentCompleted(assertion, ctx.signals);
			break;
		case "agent.causedBy":
			result = evaluateAgentCausedBy(assertion, ctx.signals);
			break;
		case "agent.emitted":
			result = evaluateAgentEmitted(assertion, ctx.signals);
			break;
		case "agent.skipped":
			result = evaluateAgentSkipped(assertion, ctx.signals);
			break;

		// Metric assertions
		case "metric.latency.max":
		case "metric.latency.min":
			result = evaluateMetricLatency(assertion, ctx.metrics);
			break;
		case "metric.cost.max":
		case "metric.cost.min":
			result = evaluateMetricCost(assertion, ctx.metrics);
			break;
		case "metric.tokens.max":
		case "metric.tokens.min":
			result = evaluateMetricTokens(assertion, ctx.metrics);
			break;
		case "metric.activations":
			result = evaluateMetricActivations(assertion, ctx.metrics);
			break;

		// Output assertions
		case "output.contains":
			result = evaluateOutputContains(assertion, ctx.output);
			break;
		case "output.notContains":
			result = evaluateOutputNotContains(assertion, ctx.output);
			break;
		case "output.matches":
			result = evaluateOutputMatches(assertion, ctx.output);
			break;
		case "output.json":
			result = evaluateOutputJson(assertion, ctx.output);
			break;
		case "output.length":
			result = evaluateOutputLength(assertion, ctx.output);
			break;

		// Tool assertions
		case "tool.called":
			result = evaluateToolCalled(assertion, ctx.signals);
			break;
		case "tool.notCalled":
			result = evaluateToolNotCalled(assertion, ctx.signals);
			break;
		case "tool.calledWith":
			result = evaluateToolCalledWith(assertion, ctx.signals);
			break;
		case "tool.sequence":
			result = evaluateToolSequence(assertion, ctx.signals);
			break;

		// LLM Judge - placeholder for now
		case "llm.judge":
			result = {
				assertion,
				passed: false,
				message: "LLM Judge assertions not yet implemented",
			};
			break;

		// Composition
		case "all":
			result = evaluateAll(assertion, evalCtx);
			break;
		case "any":
			result = evaluateAny(assertion, evalCtx);
			break;
		case "not":
			result = evaluateNot(assertion, evalCtx);
			break;

		default:
			result = {
				assertion,
				passed: false,
				message: `Unknown assertion type: ${(assertion as SignalAssertion).type}`,
			};
	}

	// Add evaluation timing
	result.evaluationMs = performance.now() - startTime;

	return result;
}

/**
 * Evaluate multiple assertions, returning all results.
 */
export function evaluateAssertions(assertions: SignalAssertion[], ctx: AssertionEvaluationContext): AssertionResult[] {
	return assertions.map((assertion) => evaluateAssertion(assertion, ctx));
}
