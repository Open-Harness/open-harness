/**
 * Effect → Promise Boundary Utilities
 *
 * This module provides utilities for converting Effect programs to Promises
 * at the public API boundary. All Effect internals stay internal.
 *
 * Key design goals:
 * - Effect failures converted to standard Error objects (FR-063)
 * - Domain errors (StoreError, ProviderError, etc.) preserved when possible
 * - Cause.pretty provides debugging context
 * - Defects become Error with full stack traces
 *
 * @module @core-v2/internal/boundary
 */

import { Cause, Exit, ManagedRuntime } from "effect";

// ============================================================================
// Error Conversion Types
// ============================================================================

/**
 * Check if a value is an Error instance.
 */
function isError(value: unknown): value is Error {
	return value instanceof Error;
}

// ============================================================================
// Cause to Error Conversion (FR-063)
// ============================================================================

/**
 * Converts an Effect Cause to a standard Error.
 *
 * Strategy:
 * 1. If Cause contains a typed error (Fail), return it directly
 * 2. If Cause is a defect (Die), wrap in Error with Cause.pretty
 * 3. If Cause is interrupted, create InterruptedError
 * 4. For complex causes (parallel/sequential), use Cause.pretty
 *
 * @param cause - The Effect Cause to convert
 * @returns A standard Error object (may be a domain error subclass)
 *
 * @example
 * ```typescript
 * // Typed failure is preserved
 * const cause = Cause.fail(new StoreError("NOT_FOUND", "Session not found"));
 * const error = causeToError(cause);
 * // error instanceof StoreError === true
 * // error.code === "NOT_FOUND"
 *
 * // Defect becomes wrapped Error
 * const defect = Cause.die(new TypeError("oops"));
 * const error2 = causeToError(defect);
 * // error2.message includes "TypeError: oops"
 * ```
 */
export function causeToError<E>(cause: Cause.Cause<E>): Error {
	// Try to extract the primary failure
	const failures = Cause.failures(cause);
	const firstFailure = Array.from(failures)[0];

	// If we have a typed failure that's already an Error, preserve it
	if (firstFailure !== undefined) {
		if (isError(firstFailure)) {
			// Return the domain error directly (preserves class, code, etc.)
			return firstFailure;
		}
		// Non-Error failure - wrap with pretty printing
		return new Error(`Effect failure: ${Cause.pretty(cause)}`);
	}

	// Check for defects (unexpected errors)
	const defects = Cause.defects(cause);
	const firstDefect = Array.from(defects)[0];

	if (firstDefect !== undefined) {
		if (isError(firstDefect)) {
			// Preserve the defect's Error type and message
			const defectError = new Error(`Unexpected error: ${firstDefect.message}`, { cause: firstDefect });
			defectError.name = "DefectError";
			defectError.stack = firstDefect.stack;
			return defectError;
		}
		// Non-Error defect - convert to Error
		return new Error(`Unexpected defect: ${String(firstDefect)}`);
	}

	// Check for interruption
	if (Cause.isInterrupted(cause)) {
		const interruptError = new Error("Operation was interrupted");
		interruptError.name = "InterruptedError";
		return interruptError;
	}

	// Empty cause or complex parallel/sequential cause
	if (Cause.isEmpty(cause)) {
		return new Error("Unknown error (empty cause)");
	}

	// Fall back to pretty printing for complex causes
	return new Error(Cause.pretty(cause));
}

// ============================================================================
// Exit to Result Conversion
// ============================================================================

/**
 * Converts an Effect Exit to a value or throws an error.
 * Used at the public API boundary to convert Effect results to Promise semantics.
 *
 * @param exit - The Effect Exit to convert
 * @returns The success value
 * @throws Error (or domain error subclass) if exit is a failure
 *
 * @remarks
 * This function preserves domain error types when possible:
 * - StoreError, ProviderError, WorkflowRuntimeError are thrown as-is
 * - Defects are wrapped with context
 * - Interruptions become InterruptedError
 *
 * @example
 * ```typescript
 * // Success case
 * const success = Exit.succeed(42);
 * const value = exitToResult(success); // 42
 *
 * // Failure case with domain error
 * const failure = Exit.fail(new StoreError("NOT_FOUND", "Not found"));
 * try {
 *   exitToResult(failure);
 * } catch (error) {
 *   // error instanceof StoreError === true
 * }
 * ```
 */
export function exitToResult<A, E>(exit: Exit.Exit<A, E>): A {
	return Exit.match(exit, {
		onFailure: (cause) => {
			throw causeToError(cause);
		},
		onSuccess: (value) => value,
	});
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Type helper for ManagedRuntime - re-exported for internal use.
 */
export { ManagedRuntime };
