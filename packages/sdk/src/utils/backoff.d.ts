/**
 * Exponential Backoff Utility
 *
 * Implements exponential backoff with jitter for API rate limit handling.
 *
 * Formula: delay = min(baseDelay * 2^attempt, maxDelay) + jitter
 *
 * @module harness/backoff
 */
/**
 * Backoff configuration.
 */
export interface BackoffConfig {
    /** Base delay in milliseconds (default: 1000) */
    baseDelayMs?: number;
    /** Maximum delay in milliseconds (default: 60000) */
    maxDelayMs?: number;
    /** Maximum jitter in milliseconds (default: 500) */
    maxJitterMs?: number;
    /** Maximum number of attempts before giving up (default: 10) */
    maxAttempts?: number;
}
/**
 * Default backoff configuration.
 */
export declare const DEFAULT_BACKOFF_CONFIG: Required<BackoffConfig>;
/**
 * Calculate delay for a given attempt number.
 *
 * @param attempt - Attempt number (1-based)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 *
 * @example
 * ```typescript
 * const delay1 = calculateDelay(1); // ~1000-1500ms
 * const delay2 = calculateDelay(2); // ~2000-2500ms
 * const delay5 = calculateDelay(5); // ~16000-16500ms
 * const delay10 = calculateDelay(10); // ~60000-60500ms (capped at max)
 * ```
 */
export declare function calculateDelay(attempt: number, config?: BackoffConfig): number;
/**
 * Check if we should retry based on attempt count.
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Backoff configuration
 * @returns True if we should retry
 */
export declare function shouldRetry(attempt: number, config?: BackoffConfig): boolean;
/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Execute a function with exponential backoff retry.
 *
 * @param fn - Function to execute
 * @param config - Backoff configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withBackoff(async () => {
 *   return await callApi();
 * });
 * ```
 */
export declare function withBackoff<T>(fn: () => Promise<T>, config?: BackoffConfig): Promise<T>;
/**
 * Check if an error is a rate limit error.
 *
 * @param error - Error to check
 * @returns True if this is a rate limit error
 */
export declare function isRateLimitError(error: unknown): boolean;
/**
 * Create a backoff context for tracking retries.
 */
export interface BackoffContext {
    attempt: number;
    lastDelay: number;
    totalDelay: number;
    startTime: number;
}
/**
 * Create a new backoff context.
 */
export declare function createBackoffContext(): BackoffContext;
/**
 * Update backoff context after a retry.
 */
export declare function updateBackoffContext(context: BackoffContext, delay: number): BackoffContext;
