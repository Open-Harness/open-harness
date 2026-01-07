import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

/**
 * Error codes for compilation and scheduling failures.
 * @internal
 */
export type CompilationErrorCode =
  | "INVALID_FLOW_DEFINITION"
  | "INVALID_NODE_DEFINITION"
  | "INVALID_EDGE_DEFINITION"
  | "CYCLE_DETECTED"
  | "SCHEDULING_ERROR"
  | "SCHEMA_VALIDATION_ERROR"
  | "MISSING_REQUIRED_FIELD";

/**
 * Compilation error with structured error codes.
 * Used to distinguish different failure modes during flow compilation and scheduling.
 *
 * @example
 * ```ts
 * if (result.isErr()) {
 *   const err = result.error;
 *   if (err.code === 'CYCLE_DETECTED') {
 *     console.error('Flow has circular dependency');
 *   }
 * }
 * ```
 */
export class CompilationError extends Error {
  /**
   * @param code - Error category (INVALID_FLOW_DEFINITION, CYCLE_DETECTED, etc.)
   * @param message - Human-readable error message
   * @param originalError - The underlying error that caused this failure
   * @param details - Optional additional context (node ID, edge info, etc.)
   */
  constructor(
    public readonly code: CompilationErrorCode,
    message: string,
    public readonly originalError?: unknown,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CompilationError";
  }
}

/**
 * Result type alias for compilation operations.
 * Represents either a successful value T or a CompilationError.
 *
 * @example
 * ```ts
 * async function compileFlow(def: FlowDefinition): CompilationResult<CompiledFlow> {
 *   return compileFlowResult(def);
 * }
 * ```
 * @internal
 */
export type CompilationResult<T> = Result<T, CompilationError>;

/**
 * Safely wrap a function that might throw, converting exceptions to CompilationError Result type.
 *
 * @param code - Error code to use if function throws
 * @param fn - Function to execute
 * @param details - Optional context for error reporting
 * @returns Result containing the return value or CompilationError
 *
 * @example
 * ```ts
 * const result = wrapCompilationThrow('INVALID_FLOW_DEFINITION', () => {
 *   return GraphCompiler.compile(definition);
 * });
 * ```
 * @internal
 */
export function wrapCompilationThrow<T>(
  code: CompilationErrorCode,
  fn: () => T,
  details?: Record<string, unknown>,
): CompilationResult<T> {
  try {
    return ok(fn());
  } catch (error) {
    return err(
      new CompilationError(
        code,
        error instanceof Error ? error.message : String(error),
        error,
        details,
      ),
    );
  }
}

/**
 * Safely wrap an async function that might throw, converting exceptions to CompilationError Result type.
 *
 * @param code - Error code to use if function throws
 * @param fn - Async function to execute
 * @param details - Optional context for error reporting
 * @returns Promise of Result containing the return value or CompilationError
 *
 * @example
 * ```ts
 * const result = await wrapCompilationThrowAsync('INVALID_FLOW_DEFINITION', async () => {
 *   return await validateAndCompile(definition);
 * });
 * ```
 * @internal
 */
export async function wrapCompilationThrowAsync<T>(
  code: CompilationErrorCode,
  fn: () => Promise<T>,
  details?: Record<string, unknown>,
): Promise<CompilationResult<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(
      new CompilationError(
        code,
        error instanceof Error ? error.message : String(error),
        error,
        details,
      ),
    );
  }
}
