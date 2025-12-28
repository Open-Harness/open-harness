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
export const DEFAULT_BACKOFF_CONFIG: Required<BackoffConfig> = {
	baseDelayMs: 1000,
	maxDelayMs: 60000,
	maxJitterMs: 500,
	maxAttempts: 10,
};

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
export function calculateDelay(attempt: number, config: BackoffConfig = {}): number {
	const { baseDelayMs, maxDelayMs, maxJitterMs } = {
		...DEFAULT_BACKOFF_CONFIG,
		...config,
	};

	// Exponential delay: base * 2^(attempt-1)
	const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);

	// Cap at max delay
	const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

	// Add random jitter
	const jitter = Math.random() * maxJitterMs;

	return Math.floor(cappedDelay + jitter);
}

/**
 * Check if we should retry based on attempt count.
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Backoff configuration
 * @returns True if we should retry
 */
export function shouldRetry(attempt: number, config: BackoffConfig = {}): boolean {
	const { maxAttempts } = {
		...DEFAULT_BACKOFF_CONFIG,
		...config,
	};

	return attempt < maxAttempts;
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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
export async function withBackoff<T>(fn: () => Promise<T>, config: BackoffConfig = {}): Promise<T> {
	const { maxAttempts } = {
		...DEFAULT_BACKOFF_CONFIG,
		...config,
	};

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Check if this is a rate limit error
			if (!isRateLimitError(error)) {
				throw lastError;
			}

			if (attempt < maxAttempts) {
				const delay = calculateDelay(attempt, config);
				await sleep(delay);
			}
		}
	}

	throw lastError ?? new Error("Max retries exceeded");
}

/**
 * Check if an error is a rate limit error.
 *
 * @param error - Error to check
 * @returns True if this is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("rate limit") ||
			message.includes("rate_limit") ||
			message.includes("too many requests") ||
			message.includes("429")
		);
	}
	return false;
}

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
export function createBackoffContext(): BackoffContext {
	return {
		attempt: 0,
		lastDelay: 0,
		totalDelay: 0,
		startTime: Date.now(),
	};
}

/**
 * Update backoff context after a retry.
 */
export function updateBackoffContext(context: BackoffContext, delay: number): BackoffContext {
	return {
		...context,
		attempt: context.attempt + 1,
		lastDelay: delay,
		totalDelay: context.totalDelay + delay,
	};
}
