import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

/**
 * Error codes for execution failures.
 * @internal
 */
export type ExecutionErrorCode =
  | "NODE_NOT_FOUND"
  | "EXECUTION_TIMEOUT"
  | "EXECUTION_FAILED"
  | "SCHEMA_VALIDATION_ERROR"
  | "CANCELLED"
  | "INPUT_VALIDATION_ERROR"
  | "OUTPUT_VALIDATION_ERROR";

/**
 * Execution error with structured error codes.
 * Used to distinguish different failure modes during node and flow execution.
 *
 * @example
 * ```ts
 * if (result.isErr()) {
 *   const err = result.error;
 *   if (err.code === 'EXECUTION_TIMEOUT') {
 *     console.error('Node execution timed out');
 *   }
 * }
 * ```
 */
export class ExecutionError extends Error {
  /**
   * @param code - Error category (NODE_NOT_FOUND, EXECUTION_TIMEOUT, EXECUTION_FAILED, etc.)
   * @param message - Human-readable error message
   * @param originalError - The underlying error that caused this failure
   * @param nodeId - Optional node ID involved in the error
   * @param runId - Optional run ID for tracking
   */
  constructor(
    public readonly code: ExecutionErrorCode,
    message: string,
    public readonly originalError?: unknown,
    public readonly nodeId?: string,
    public readonly runId?: string,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Result type alias for execution operations.
 * Represents either a successful value T or an ExecutionError.
 *
 * @example
 * ```ts
 * async function executeNode(ctx: ExecutorContext): ExecutionResult<NodeExecutionResult> {
 *   return executeNodeResult(ctx);
 * }
 * ```
 * @internal
 */
export type ExecutionResult<T> = Result<T, ExecutionError>;

/**
 * Safely wrap a sync function that might throw, converting exceptions to ExecutionError Result type.
 *
 * @param code - Error code to use if function throws
 * @param fn - Function to execute
 * @param nodeId - Optional node ID for context
 * @param runId - Optional run ID for tracking
 * @returns Result containing the return value or ExecutionError
 *
 * @example
 * ```ts
 * const result = wrapExecutionThrow('EXECUTION_FAILED', () => {
 *   return def.run(runContext, input);
 * }, nodeId);
 * ```
 * @internal
 */
export function wrapExecutionThrow<T>(
  code: ExecutionErrorCode,
  fn: () => T,
  nodeId?: string,
  runId?: string,
): ExecutionResult<T> {
  try {
    return ok(fn());
  } catch (error) {
    return err(
      new ExecutionError(
        code,
        error instanceof Error ? error.message : String(error),
        error,
        nodeId,
        runId,
      ),
    );
  }
}

/**
 * Safely wrap an async function that might throw, converting exceptions to ExecutionError Result type.
 *
 * @param code - Error code to use if function throws
 * @param fn - Async function to execute
 * @param nodeId - Optional node ID for context
 * @param runId - Optional run ID for tracking
 * @returns Promise of Result containing the return value or ExecutionError
 *
 * @example
 * ```ts
 * const result = await wrapExecutionThrowAsync('EXECUTION_FAILED', async () => {
 *   return await def.run(runContext, input);
 * }, nodeId, runId);
 * ```
 * @internal
 */
export async function wrapExecutionThrowAsync<T>(
  code: ExecutionErrorCode,
  fn: () => Promise<T>,
  nodeId?: string,
  runId?: string,
): Promise<ExecutionResult<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(
      new ExecutionError(
        code,
        error instanceof Error ? error.message : String(error),
        error,
        nodeId,
        runId,
      ),
    );
  }
}
