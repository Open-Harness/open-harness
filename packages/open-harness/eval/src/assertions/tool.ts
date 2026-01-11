/**
 * Tool assertion evaluators.
 *
 * These are particularly useful for coding agent evals where we want
 * to verify that the agent used the right tools in the right order.
 */

import type { Signal } from "@signals/core";
import type { AssertionResult } from "../types.js";
import type {
	ToolCalledAssertion,
	ToolCalledWithAssertion,
	ToolNotCalledAssertion,
	ToolSequenceAssertion,
} from "./types.js";
import { matchesPayload } from "./utils.js";

/**
 * Get all tool call signals for a specific tool name.
 */
function getToolCalls(signals: readonly Signal[], toolName: string): Signal[] {
	return signals.filter((s) => s.name === "tool:call" && (s.payload as Record<string, unknown>)?.name === toolName);
}

/**
 * Evaluate tool.called assertion.
 */
export function evaluateToolCalled(assertion: ToolCalledAssertion, signals: readonly Signal[]): AssertionResult {
	const calls = getToolCalls(signals, assertion.name);
	const count = calls.length;

	// Check exact count
	if (assertion.count !== undefined) {
		const passed = count === assertion.count;
		return {
			assertion,
			passed,
			message: passed
				? `Tool "${assertion.name}" called ${count} time(s)`
				: `Expected tool "${assertion.name}" to be called ${assertion.count} time(s), got ${count}`,
			expected: assertion.count,
			actual: count,
		};
	}

	// Check min/max
	let passed = true;
	const issues: string[] = [];

	// Default: at least 1 call
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
			message: `Tool "${assertion.name}" call count mismatch: ${issues.join(", ")}`,
			expected: { min, max: assertion.max },
			actual: count,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Tool "${assertion.name}" called ${count} time(s)`,
		actual: count,
	};
}

/**
 * Evaluate tool.notCalled assertion.
 */
export function evaluateToolNotCalled(assertion: ToolNotCalledAssertion, signals: readonly Signal[]): AssertionResult {
	const calls = getToolCalls(signals, assertion.name);

	if (calls.length > 0) {
		return {
			assertion,
			passed: false,
			message: `Tool "${assertion.name}" was called ${calls.length} time(s) (expected 0)`,
			expected: "not called",
			actual: `called ${calls.length} time(s)`,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Tool "${assertion.name}" was not called (as expected)`,
	};
}

/**
 * Evaluate tool.calledWith assertion.
 *
 * Verifies that a tool was called with specific arguments.
 */
export function evaluateToolCalledWith(
	assertion: ToolCalledWithAssertion,
	signals: readonly Signal[],
): AssertionResult {
	const calls = getToolCalls(signals, assertion.name);

	if (calls.length === 0) {
		return {
			assertion,
			passed: false,
			message: `Tool "${assertion.name}" was never called`,
			expected: assertion.args,
		};
	}

	// Check if any call matches the expected args
	for (const call of calls) {
		const payload = call.payload as Record<string, unknown>;
		const input = payload.input as Record<string, unknown>;

		if (input && matchesPayload(input, assertion.args)) {
			return {
				assertion,
				passed: true,
				message: `Tool "${assertion.name}" was called with matching arguments`,
				actual: input,
			};
		}
	}

	return {
		assertion,
		passed: false,
		message: `Tool "${assertion.name}" was called but no call matched expected arguments`,
		expected: assertion.args,
		actual: calls.map((c) => (c.payload as Record<string, unknown>)?.input),
	};
}

/**
 * Evaluate tool.sequence assertion.
 *
 * Verifies that tools were called in a specific order.
 */
export function evaluateToolSequence(assertion: ToolSequenceAssertion, signals: readonly Signal[]): AssertionResult {
	// Get all tool calls in order
	const toolCalls = signals.filter((s) => s.name === "tool:call");
	const toolNames = toolCalls.map((s) => (s.payload as Record<string, unknown>)?.name as string);

	// Check if expected sequence appears in order (not necessarily consecutive)
	let expectedIndex = 0;
	const matchedIndices: number[] = [];

	for (let i = 0; i < toolNames.length && expectedIndex < assertion.tools.length; i++) {
		if (toolNames[i] === assertion.tools[expectedIndex]) {
			matchedIndices.push(i);
			expectedIndex++;
		}
	}

	const passed = expectedIndex === assertion.tools.length;

	if (!passed) {
		const missing = assertion.tools.slice(expectedIndex);
		return {
			assertion,
			passed: false,
			message: `Tool sequence incomplete: missing ${JSON.stringify(missing)}`,
			expected: assertion.tools,
			actual: toolNames,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Tool sequence matched: ${assertion.tools.join(" → ")}`,
		actual: toolNames,
	};
}
