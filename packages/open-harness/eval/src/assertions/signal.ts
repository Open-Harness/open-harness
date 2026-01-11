/**
 * Signal assertion evaluators.
 *
 * These evaluate signal.contains, signal.not, signal.count, signal.trajectory, etc.
 */

import { compilePattern, matchesPattern } from "@signals/bus";
import type { Signal } from "@signals/core";
import type { AssertionResult } from "../types.js";
import type {
	SignalContainsAssertion,
	SignalCountAssertion,
	SignalFirstAssertion,
	SignalLastAssertion,
	SignalNotAssertion,
	SignalTrajectoryAssertion,
} from "./types.js";
import { matchesPayload } from "./utils.js";

/**
 * Evaluate signal.contains assertion.
 */
export function evaluateSignalContains(
	assertion: SignalContainsAssertion,
	signals: readonly Signal[],
): AssertionResult {
	const pattern = compilePattern(assertion.pattern);
	const matching = signals.filter((s) => matchesPattern(s.name, pattern));

	if (matching.length === 0) {
		return {
			assertion,
			passed: false,
			message: `No signal matching pattern "${assertion.pattern}" found`,
			expected: assertion.pattern,
			actual: signals.map((s) => s.name),
		};
	}

	// If payload specified, check at least one matches
	if (assertion.payload) {
		const withPayload = matching.filter((s) => matchesPayload(s.payload, assertion.payload!));
		if (withPayload.length === 0) {
			return {
				assertion,
				passed: false,
				message: `Signal "${assertion.pattern}" found but payload didn't match`,
				expected: assertion.payload,
				actual: matching.map((s) => s.payload),
			};
		}
	}

	return {
		assertion,
		passed: true,
		message: `Found ${matching.length} signal(s) matching "${assertion.pattern}"`,
	};
}

/**
 * Evaluate signal.not assertion.
 */
export function evaluateSignalNot(assertion: SignalNotAssertion, signals: readonly Signal[]): AssertionResult {
	const pattern = compilePattern(assertion.pattern);
	const matching = signals.filter((s) => matchesPattern(s.name, pattern));

	if (matching.length > 0) {
		return {
			assertion,
			passed: false,
			message: `Found ${matching.length} signal(s) matching "${assertion.pattern}" (expected none)`,
			expected: "no matches",
			actual: matching.map((s) => s.name),
		};
	}

	return {
		assertion,
		passed: true,
		message: `No signals matching "${assertion.pattern}" (as expected)`,
	};
}

/**
 * Evaluate signal.count assertion.
 */
export function evaluateSignalCount(assertion: SignalCountAssertion, signals: readonly Signal[]): AssertionResult {
	const pattern = compilePattern(assertion.pattern);
	const count = signals.filter((s) => matchesPattern(s.name, pattern)).length;

	// Check exact count
	if (assertion.exact !== undefined) {
		const passed = count === assertion.exact;
		return {
			assertion,
			passed,
			message: passed
				? `Found exactly ${count} signal(s) matching "${assertion.pattern}"`
				: `Expected exactly ${assertion.exact} signal(s) matching "${assertion.pattern}", found ${count}`,
			expected: assertion.exact,
			actual: count,
		};
	}

	// Check min/max
	let passed = true;
	const issues: string[] = [];

	if (assertion.min !== undefined && count < assertion.min) {
		passed = false;
		issues.push(`expected min ${assertion.min}, got ${count}`);
	}
	if (assertion.max !== undefined && count > assertion.max) {
		passed = false;
		issues.push(`expected max ${assertion.max}, got ${count}`);
	}

	return {
		assertion,
		passed,
		message: passed
			? `Found ${count} signal(s) matching "${assertion.pattern}" (within range)`
			: `Signal count mismatch for "${assertion.pattern}": ${issues.join(", ")}`,
		expected: { min: assertion.min, max: assertion.max },
		actual: count,
	};
}

/**
 * Evaluate signal.trajectory assertion - THE KILLER FEATURE.
 *
 * Verifies that signals appear in the correct order.
 */
export function evaluateSignalTrajectory(
	assertion: SignalTrajectoryAssertion,
	signals: readonly Signal[],
): AssertionResult {
	const trajectory: string[] = [];
	let patternIndex = 0;

	for (const signal of signals) {
		if (patternIndex >= assertion.patterns.length) break;

		const expectedPattern = assertion.patterns[patternIndex];
		const patternStr = typeof expectedPattern === "string" ? expectedPattern : expectedPattern.pattern;
		const expectedPayload = typeof expectedPattern === "object" ? expectedPattern.payload : undefined;

		const compiledPattern = compilePattern(patternStr);

		if (matchesPattern(signal.name, compiledPattern)) {
			// Check payload if specified
			if (expectedPayload && !matchesPayload(signal.payload, expectedPayload)) {
				// Pattern matched but payload didn't - in strict mode this is a failure
				if (assertion.strict) {
					return {
						assertion,
						passed: false,
						message: `Signal "${signal.name}" matched pattern but payload mismatch at position ${patternIndex}`,
						expected: expectedPayload,
						actual: signal.payload,
						trajectory,
					};
				}
				// Non-strict: continue looking
				continue;
			}

			trajectory.push(signal.name);
			patternIndex++;
		} else if (assertion.strict) {
			// In strict mode, unexpected signals between patterns fail
			return {
				assertion,
				passed: false,
				message: `Unexpected signal "${signal.name}" at position ${trajectory.length} (strict mode)`,
				expected: patternStr,
				actual: signal.name,
				trajectory,
			};
		}
	}

	// Check if all patterns were matched
	if (patternIndex < assertion.patterns.length) {
		const missing = assertion.patterns.slice(patternIndex).map((p) => (typeof p === "string" ? p : p.pattern));
		return {
			assertion,
			passed: false,
			message: `Trajectory incomplete: missing patterns ${JSON.stringify(missing)}`,
			expected: assertion.patterns.map((p) => (typeof p === "string" ? p : p.pattern)),
			actual: trajectory,
			trajectory,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Trajectory matched: ${trajectory.join(" → ")}`,
		trajectory,
	};
}

/**
 * Evaluate signal.first assertion.
 */
export function evaluateSignalFirst(assertion: SignalFirstAssertion, signals: readonly Signal[]): AssertionResult {
	const pattern = compilePattern(assertion.pattern);
	const first = signals.find((s) => matchesPattern(s.name, pattern));

	if (!first) {
		return {
			assertion,
			passed: false,
			message: `No signal matching pattern "${assertion.pattern}" found`,
			expected: assertion.pattern,
		};
	}

	if (assertion.payload && !matchesPayload(first.payload, assertion.payload)) {
		return {
			assertion,
			passed: false,
			message: `First signal "${first.name}" found but payload didn't match`,
			expected: assertion.payload,
			actual: first.payload,
		};
	}

	return {
		assertion,
		passed: true,
		message: `First signal matching "${assertion.pattern}" found`,
		actual: first.payload,
	};
}

/**
 * Evaluate signal.last assertion.
 */
export function evaluateSignalLast(assertion: SignalLastAssertion, signals: readonly Signal[]): AssertionResult {
	const pattern = compilePattern(assertion.pattern);
	const matching = signals.filter((s) => matchesPattern(s.name, pattern));
	const last = matching.at(-1);

	if (!last) {
		return {
			assertion,
			passed: false,
			message: `No signal matching pattern "${assertion.pattern}" found`,
			expected: assertion.pattern,
		};
	}

	if (assertion.payload && !matchesPayload(last.payload, assertion.payload)) {
		return {
			assertion,
			passed: false,
			message: `Last signal "${last.name}" found but payload didn't match`,
			expected: assertion.payload,
			actual: last.payload,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Last signal matching "${assertion.pattern}" found`,
		actual: last.payload,
	};
}
