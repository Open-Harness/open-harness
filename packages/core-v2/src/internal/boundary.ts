/**
 * Effect → Promise Boundary Utilities
 *
 * This module provides utilities for converting Effect programs to Promises
 * at the public API boundary. All Effect internals stay internal.
 */

import { Cause, Exit, ManagedRuntime } from "effect";

/**
 * Converts an Effect Exit to a value or throws an error.
 * Used at the public API boundary to convert Effect results to Promise semantics.
 */
export function exitToResult<A, E>(exit: Exit.Exit<A, E>): A {
	return Exit.match(exit, {
		onFailure: (cause) => {
			throw new Error(Cause.pretty(cause));
		},
		onSuccess: (value) => value,
	});
}

/**
 * Type helper for ManagedRuntime - re-exported for internal use.
 */
export { ManagedRuntime };
