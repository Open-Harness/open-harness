import { err, ok, type Result } from "neverthrow";

/**
 * Provider error codes.
 * 
 * These are standardized error codes that all providers use.
 */
export type ProviderErrorCode =
	| "QUERY_FAILED"       // Provider query failed
	| "VALIDATION_ERROR"   // Input/output validation failed
	| "ABORT"              // Operation was aborted
	| "TIMEOUT"            // Operation timed out
	| "PERMISSION_DENIED"; // Permission denied by provider

/**
 * Structured provider error.
 * 
 * All provider errors are instances of this class with a code and context.
 */
export class ProviderError extends Error {
	/** Error code */
	public readonly code: ProviderErrorCode;
	/** Additional context (provider-specific data) */
	public readonly context?: Record<string, unknown>;
	/** Original error that caused this */
	public override readonly cause?: unknown;
	
	constructor(
		code: ProviderErrorCode,
		message: string,
		context?: Record<string, unknown>,
		cause?: unknown,
	) {
		super(message);
		this.name = "ProviderError";
		this.code = code;
		this.context = context;
		this.cause = cause;
		
		// Maintain prototype chain for instanceof checks
		Object.setPrototypeOf(this, ProviderError.prototype);
	}
}

/**
 * Wrap a synchronous function that may throw into a Result.
 * 
 * @param code - Error code to use if function throws
 * @param fn - Function to execute
 * @returns Result<T, ProviderError>
 * 
 * @example
 * const result = wrapProviderThrow("VALIDATION_ERROR", () => {
 *   return schema.parse(input);
 * });
 */
export function wrapProviderThrow<T>(
	code: ProviderErrorCode,
	fn: () => T,
): Result<T, ProviderError> {
	try {
		return ok(fn());
	} catch (error) {
		return err(
			new ProviderError(
				code,
				error instanceof Error ? error.message : String(error),
				undefined,
				error,
			),
		);
	}
}

/**
 * Wrap an async function that may throw into a Result.
 * 
 * @param code - Error code to use if function throws
 * @param fn - Async function to execute
 * @returns Promise<Result<T, ProviderError>>
 * 
 * @example
 * const result = await wrapProviderThrowAsync("QUERY_FAILED", async () => {
 *   return await provider.query(input);
 * });
 */
export async function wrapProviderThrowAsync<T>(
	code: ProviderErrorCode,
	fn: () => Promise<T>,
): Promise<Result<T, ProviderError>> {
	try {
		return ok(await fn());
	} catch (error) {
		return err(
			new ProviderError(
				code,
				error instanceof Error ? error.message : String(error),
				undefined,
				error,
			),
		);
	}
}

/**
 * Convert any error to a ProviderError.
 * 
 * @param error - Error to convert
 * @param code - Error code to use
 * @returns ProviderError
 */
export function toProviderError(
	error: unknown,
	code: ProviderErrorCode = "QUERY_FAILED",
): ProviderError {
	if (error instanceof ProviderError) {
		return error;
	}
	
	if (error instanceof Error) {
		return new ProviderError(code, error.message, undefined, error);
	}
	
	return new ProviderError(code, String(error), undefined, error);
}
