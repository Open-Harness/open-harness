/**
 * Snapshot assertion evaluators.
 *
 * These enable mid-execution state inspection - a capability
 * that traditional eval systems cannot provide.
 */

import { compilePattern, matchesPattern, snapshot, snapshotAll } from "@signals/bus";
import type { Signal } from "@signals/core";
import type { AssertionResult } from "../types.js";
import type { SnapshotAtAssertion, SnapshotFinalAssertion } from "./types.js";
import { getPath, isValueMatcher, valueMatches } from "./utils.js";

/**
 * Evaluate snapshot.at assertion.
 *
 * Captures state at a specific point in execution (after a signal fires).
 */
export function evaluateSnapshotAt(
	assertion: SnapshotAtAssertion,
	signals: readonly Signal[],
	finalState: unknown,
): AssertionResult {
	// Find the signal index
	const pattern = compilePattern(assertion.afterSignal);
	const signalIndex = signals.findIndex((s) => matchesPattern(s.name, pattern));

	if (signalIndex === -1) {
		return {
			assertion,
			passed: false,
			message: `Signal "${assertion.afterSignal}" not found for snapshot`,
			expected: assertion.afterSignal,
		};
	}

	// Build snapshot at that point by replaying signals up to that index
	const signalsUpToPoint = signals.slice(0, signalIndex + 1);
	const snapshots = snapshotAll(signalsUpToPoint);

	// Get the last snapshot (current state at that point)
	// snapshotAll returns Map<signalId, Snapshot>
	// We need the cumulative state - use the snapshot function with all signals
	const stateAtPoint = snapshot(signalsUpToPoint);

	// Get value at path
	const actualValue = getPath(stateAtPoint, assertion.path);

	// Check existence
	if (assertion.exists !== undefined) {
		const exists = actualValue !== undefined;
		const passed = assertion.exists === exists;
		return {
			assertion,
			passed,
			message: passed
				? `Path "${assertion.path}" ${exists ? "exists" : "does not exist"} at snapshot`
				: `Path "${assertion.path}" ${exists ? "exists" : "does not exist"} at snapshot (expected ${assertion.exists ? "to exist" : "not to exist"})`,
			expected: assertion.exists ? "exists" : "does not exist",
			actual: exists ? "exists" : "does not exist",
		};
	}

	// Check value
	if (assertion.value !== undefined) {
		const passed = valueMatches(actualValue, assertion.value);
		return {
			assertion,
			passed,
			message: passed
				? `Snapshot value at "${assertion.path}" matches expected`
				: `Snapshot value at "${assertion.path}" does not match`,
			expected: assertion.value,
			actual: actualValue,
		};
	}

	// If no value or exists specified, just check the path exists
	const exists = actualValue !== undefined;
	return {
		assertion,
		passed: exists,
		message: exists
			? `Path "${assertion.path}" exists at snapshot`
			: `Path "${assertion.path}" does not exist at snapshot`,
		actual: actualValue,
	};
}

/**
 * Evaluate snapshot.final assertion.
 *
 * Checks the final state after execution completes.
 */
export function evaluateSnapshotFinal(assertion: SnapshotFinalAssertion, finalState: unknown): AssertionResult {
	const actualValue = getPath(finalState, assertion.path);

	// Check existence
	if (assertion.exists !== undefined) {
		const exists = actualValue !== undefined;
		const passed = assertion.exists === exists;
		return {
			assertion,
			passed,
			message: passed
				? `Final state path "${assertion.path}" ${exists ? "exists" : "does not exist"}`
				: `Final state path "${assertion.path}" ${exists ? "exists" : "does not exist"} (expected ${assertion.exists ? "to exist" : "not to exist"})`,
			expected: assertion.exists ? "exists" : "does not exist",
			actual: exists ? "exists" : "does not exist",
		};
	}

	// Check value
	if (assertion.value !== undefined) {
		const passed = valueMatches(actualValue, assertion.value);
		return {
			assertion,
			passed,
			message: passed
				? `Final state value at "${assertion.path}" matches expected`
				: `Final state value at "${assertion.path}" does not match`,
			expected: assertion.value,
			actual: actualValue,
		};
	}

	// If no value or exists specified, just check the path exists
	const exists = actualValue !== undefined;
	return {
		assertion,
		passed: exists,
		message: exists
			? `Final state path "${assertion.path}" exists`
			: `Final state path "${assertion.path}" does not exist`,
		actual: actualValue,
	};
}
