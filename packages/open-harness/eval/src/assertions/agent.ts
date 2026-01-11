/**
 * Agent assertion evaluators.
 *
 * These evaluate agent lifecycle: activation, completion, causality, etc.
 */

import { compilePattern, matchesPattern } from "@signals/bus";
import type { Signal } from "@signals/core";
import type { AssertionResult } from "../types.js";
import type {
	AgentActivatedAssertion,
	AgentCausedByAssertion,
	AgentCompletedAssertion,
	AgentEmittedAssertion,
	AgentSkippedAssertion,
} from "./types.js";

/**
 * Evaluate agent.activated assertion.
 */
export function evaluateAgentActivated(
	assertion: AgentActivatedAssertion,
	signals: readonly Signal[],
): AssertionResult {
	// Count activations for this agent
	const activations = signals.filter(
		(s) => s.name === "agent:activated" && (s.payload as Record<string, unknown>)?.agent === assertion.agentId,
	);
	const count = activations.length;

	// Check exact count
	if (assertion.count !== undefined) {
		const passed = count === assertion.count;
		return {
			assertion,
			passed,
			message: passed
				? `Agent "${assertion.agentId}" activated ${count} time(s)`
				: `Expected agent "${assertion.agentId}" to activate ${assertion.count} time(s), got ${count}`,
			expected: assertion.count,
			actual: count,
		};
	}

	// Check min/max
	let passed = true;
	const issues: string[] = [];

	// Default: at least 1 activation
	const min = assertion.min ?? (assertion.max === undefined ? 1 : undefined);

	if (min !== undefined && count < min) {
		passed = false;
		issues.push(`expected min ${min}, got ${count}`);
	}
	if (assertion.max !== undefined && count > assertion.max) {
		passed = false;
		issues.push(`expected max ${assertion.max}, got ${count}`);
	}

	if (!passed) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" activation count mismatch: ${issues.join(", ")}`,
			expected: { min, max: assertion.max },
			actual: count,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Agent "${assertion.agentId}" activated ${count} time(s)`,
		actual: count,
	};
}

/**
 * Evaluate agent.completed assertion.
 *
 * Agent completed if it was activated and no error signal followed.
 */
export function evaluateAgentCompleted(
	assertion: AgentCompletedAssertion,
	signals: readonly Signal[],
): AssertionResult {
	// Find activation
	const activated = signals.find(
		(s) => s.name === "agent:activated" && (s.payload as Record<string, unknown>)?.agent === assertion.agentId,
	);

	if (!activated) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" was never activated`,
			expected: "agent activated",
			actual: "not activated",
		};
	}

	// Check for agent:error with this agent
	const hasError = signals.some(
		(s) => s.name === "agent:error" && (s.payload as Record<string, unknown>)?.agent === assertion.agentId,
	);

	if (hasError) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" activated but failed with error`,
			expected: "completed successfully",
			actual: "error",
		};
	}

	return {
		assertion,
		passed: true,
		message: `Agent "${assertion.agentId}" completed successfully`,
	};
}

/**
 * Evaluate agent.causedBy assertion.
 *
 * Verifies that an agent was triggered by a specific signal.
 */
export function evaluateAgentCausedBy(assertion: AgentCausedByAssertion, signals: readonly Signal[]): AssertionResult {
	const triggerPattern = compilePattern(assertion.triggerPattern);

	// Find the activation signal for this agent
	const activation = signals.find(
		(s) => s.name === "agent:activated" && (s.payload as Record<string, unknown>)?.agent === assertion.agentId,
	);

	if (!activation) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" was never activated`,
			expected: `activated by "${assertion.triggerPattern}"`,
			actual: "not activated",
		};
	}

	// Check the trigger field in the activation payload
	const trigger = (activation.payload as Record<string, unknown>)?.trigger as string;

	if (!trigger) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" activation has no trigger info`,
			expected: assertion.triggerPattern,
			actual: "unknown trigger",
		};
	}

	// Match trigger against pattern
	const passed = matchesPattern(trigger, triggerPattern);

	return {
		assertion,
		passed,
		message: passed
			? `Agent "${assertion.agentId}" was triggered by "${trigger}"`
			: `Agent "${assertion.agentId}" was triggered by "${trigger}", expected "${assertion.triggerPattern}"`,
		expected: assertion.triggerPattern,
		actual: trigger,
	};
}

/**
 * Evaluate agent.emitted assertion.
 *
 * Verifies that an agent emitted a specific signal.
 */
export function evaluateAgentEmitted(assertion: AgentEmittedAssertion, signals: readonly Signal[]): AssertionResult {
	const signalPattern = compilePattern(assertion.signal);

	// Find signals emitted by this agent
	const emittedByAgent = signals.filter(
		(s) => s.source?.agent === assertion.agentId && matchesPattern(s.name, signalPattern),
	);

	if (emittedByAgent.length === 0) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" did not emit signal "${assertion.signal}"`,
			expected: assertion.signal,
			actual: signals.filter((s) => s.source?.agent === assertion.agentId).map((s) => s.name),
		};
	}

	return {
		assertion,
		passed: true,
		message: `Agent "${assertion.agentId}" emitted signal "${assertion.signal}"`,
	};
}

/**
 * Evaluate agent.skipped assertion.
 *
 * Verifies that an agent was skipped (guard returned false).
 */
export function evaluateAgentSkipped(assertion: AgentSkippedAssertion, signals: readonly Signal[]): AssertionResult {
	const skipped = signals.find(
		(s) => s.name === "agent:skipped" && (s.payload as Record<string, unknown>)?.agent === assertion.agentId,
	);

	if (!skipped) {
		return {
			assertion,
			passed: false,
			message: `Agent "${assertion.agentId}" was not skipped`,
			expected: "skipped",
			actual: "not skipped",
		};
	}

	// Check reason if specified
	if (assertion.reason) {
		const actualReason = (skipped.payload as Record<string, unknown>)?.reason as string;
		if (actualReason !== assertion.reason) {
			return {
				assertion,
				passed: false,
				message: `Agent "${assertion.agentId}" was skipped but reason didn't match`,
				expected: assertion.reason,
				actual: actualReason,
			};
		}
	}

	return {
		assertion,
		passed: true,
		message: `Agent "${assertion.agentId}" was skipped`,
	};
}
