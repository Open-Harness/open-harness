import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

/**
 * Error codes for expression evaluation failures.
 * @internal
 */
export type ExpressionErrorCode =
  | "PARSE_ERROR"
  | "EVALUATION_ERROR"
  | "VALIDATION_ERROR"
  | "UNDEFINED_BINDING"
  | "TYPE_ERROR";

/**
 * Expression evaluation error with structured error codes.
 * Used to distinguish different failure modes in expression operations.
 *
 * @example
 * ```ts
 * if (result.isErr()) {
 *   const err = result.error;
 *   if (err.code === 'PARSE_ERROR') {
 *     console.error('Failed to parse expression:', err.message);
 *   }
 * }
 * ```
 */
export class ExpressionError extends Error {
  /**
   * @param code - Error category (PARSE_ERROR, EVALUATION_ERROR, VALIDATION_ERROR, UNDEFINED_BINDING, TYPE_ERROR)
   * @param message - Human-readable error message
   * @param originalError - The underlying error that caused this failure
   */
  constructor(
    public readonly code: ExpressionErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "ExpressionError";
  }
}

/**
 * Result type alias for expression operations.
 * Represents either a successful value T or an ExpressionError.
 *
 * @example
 * ```ts
 * async function evaluateBinding(expr: string, context: any): ExpressionResult<unknown> {
 *   return evaluateExpression(expr, context);
 * }
 * ```
 * @internal
 */
export type ExpressionResult<T> = Result<T, ExpressionError>;

/**
 * Safely wrap a function that might throw, converting exceptions to ExpressionError Result type.
 *
 * @param code - Error code to use if function throws
 * @param fn - Function to execute
 * @returns Result containing the return value or ExpressionError
 *
 * @example
 * ```ts
 * const result = wrapThrow('EVALUATION_ERROR', () => {
 *   return jsonata(expr).evaluate(context);
 * });
 * ```
 * @internal
 */
export function wrapThrow<T>(
  code: ExpressionErrorCode,
  fn: () => T,
): ExpressionResult<T> {
  try {
    return ok(fn());
  } catch (error) {
    return err(
      new ExpressionError(
        code,
        error instanceof Error ? error.message : String(error),
        error,
      ),
    );
  }
}

/**
 * Safely wrap an async function that might throw, converting exceptions to ExpressionError Result type.
 *
 * @param code - Error code to use if function throws
 * @param fn - Async function to execute
 * @returns Promise of Result containing the return value or ExpressionError
 *
 * @example
 * ```ts
 * const result = await wrapThrowAsync('EVALUATION_ERROR', async () => {
 *   return await evaluateAsync(expr, context);
 * });
 * ```
 * @internal
 */
export async function wrapThrowAsync<T>(
  code: ExpressionErrorCode,
  fn: () => Promise<T>,
): Promise<ExpressionResult<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(
      new ExpressionError(
        code,
        error instanceof Error ? error.message : String(error),
        error,
      ),
    );
  }
}
