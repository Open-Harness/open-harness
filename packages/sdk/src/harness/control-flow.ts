/**
 * Control Flow Helpers - retry and parallel with auto-emitted events
 *
 * Provides control flow utilities for the fluent harness API:
 * - retry() - automatic retry with exponential backoff
 * - parallel() - concurrent execution with concurrency limit
 *
 * Both follow the Contextual Event Wrapper Pattern.
 *
 * @module harness/control-flow
 */

import type {
	FluentHarnessEvent,
	ParallelCompleteEvent,
	ParallelItemCompleteEvent,
	ParallelOptions,
	ParallelStartEvent,
	RetryAttemptEvent,
	RetryBackoffEvent,
	RetryFailureEvent,
	RetryOptions,
	RetryStartEvent,
	RetrySuccessEvent,
} from "./event-types.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Emit function signature for publishing events.
 */
export type EmitFn = (event: FluentHarnessEvent) => void;

/**
 * Internal retry configuration with defaults applied.
 */
interface ResolvedRetryOptions {
	retries: number;
	minTimeout: number;
	maxTimeout: number;
}

/**
 * Internal parallel configuration with defaults applied.
 */
interface ResolvedParallelOptions {
	concurrency: number;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_RETRY_OPTIONS: ResolvedRetryOptions = {
	retries: 3,
	minTimeout: 1000,
	maxTimeout: 5000,
};

const DEFAULT_PARALLEL_OPTIONS: ResolvedParallelOptions = {
	concurrency: 5,
};

// ============================================================================
// RETRY HELPER
// ============================================================================

/**
 * Calculate backoff delay with exponential growth.
 * Uses the formula: min(minTimeout * 2^attempt, maxTimeout)
 *
 * @param attempt - Current attempt number (0-based)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, options: ResolvedRetryOptions): number {
	const exponentialDelay = options.minTimeout * 2 ** attempt;
	return Math.min(exponentialDelay, options.maxTimeout);
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retry and exponential backoff.
 *
 * Follows the Contextual Event Wrapper Pattern:
 * - Emits retry:start before first attempt
 * - Emits retry:attempt before each attempt
 * - Emits retry:backoff before waiting between attempts
 * - Emits retry:success on successful completion
 * - Emits retry:failure if all attempts exhausted
 *
 * @param name - Name for event identification
 * @param fn - Function to execute
 * @param options - Retry configuration
 * @param emit - Function to emit events
 * @returns Result of fn on success
 * @throws Last error after all retries exhausted
 */
export async function retry<T>(
	name: string,
	fn: () => Promise<T>,
	options: RetryOptions | undefined,
	emit: EmitFn,
): Promise<T> {
	const resolved: ResolvedRetryOptions = {
		...DEFAULT_RETRY_OPTIONS,
		...options,
	};

	const maxAttempts = resolved.retries;

	// Emit start event
	emit({
		type: "retry:start",
		name,
		maxAttempts,
		timestamp: new Date(),
	} as RetryStartEvent);

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		// Emit attempt event
		emit({
			type: "retry:attempt",
			name,
			attempt,
			maxAttempts,
			timestamp: new Date(),
		} as RetryAttemptEvent);

		try {
			const result = await fn();

			// Emit success event
			emit({
				type: "retry:success",
				name,
				attempt,
				timestamp: new Date(),
				result,
			} as RetrySuccessEvent);

			return result;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// If not the last attempt, emit backoff and wait
			if (attempt < maxAttempts) {
				const delay = calculateBackoffDelay(attempt - 1, resolved);

				emit({
					type: "retry:backoff",
					name,
					attempt,
					delay,
					error: lastError.message,
					timestamp: new Date(),
				} as RetryBackoffEvent);

				await sleep(delay);
			}
		}
	}

	// All attempts exhausted - emit failure event
	emit({
		type: "retry:failure",
		name,
		attempts: maxAttempts,
		error: lastError?.message ?? "Unknown error",
		timestamp: new Date(),
		stack: lastError?.stack,
	} as RetryFailureEvent);

	// Re-throw (Contextual Event Wrapper Pattern)
	throw lastError ?? new Error("All retry attempts failed");
}

// ============================================================================
// PARALLEL HELPER
// ============================================================================

/**
 * Execute functions in parallel with concurrency limit.
 *
 * Follows the Contextual Event Wrapper Pattern:
 * - Emits parallel:start before execution begins
 * - Emits parallel:item:complete as each item finishes
 * - Emits parallel:complete when all items finish
 *
 * @param name - Name for event identification
 * @param fns - Array of functions to execute
 * @param options - Parallel configuration
 * @param emit - Function to emit events
 * @returns Array of results in same order as input
 */
export async function parallel<T>(
	name: string,
	fns: Array<() => Promise<T>>,
	options: ParallelOptions | undefined,
	emit: EmitFn,
): Promise<T[]> {
	const resolved: ResolvedParallelOptions = {
		...DEFAULT_PARALLEL_OPTIONS,
		...options,
	};

	const total = fns.length;
	const { concurrency } = resolved;

	// Emit start event
	emit({
		type: "parallel:start",
		name,
		total,
		concurrency,
		timestamp: new Date(),
	} as ParallelStartEvent);

	// Handle empty array case
	if (total === 0) {
		emit({
			type: "parallel:complete",
			name,
			total: 0,
			timestamp: new Date(),
		} as ParallelCompleteEvent);
		return [];
	}

	// Results array with index tracking
	const results: T[] = new Array(total);
	let completedCount = 0;
	let nextIndex = 0;

	/**
	 * Process a single item and emit completion event.
	 */
	async function processItem(index: number): Promise<void> {
		// biome-ignore lint/style/noNonNullAssertion: Worker guarantees index < total
		const fn = fns[index]!;
		const result = await fn();
		results[index] = result;
		completedCount++;

		emit({
			type: "parallel:item:complete",
			name,
			index,
			completed: completedCount,
			total,
			timestamp: new Date(),
		} as ParallelItemCompleteEvent);
	}

	/**
	 * Worker that processes items until none remain.
	 */
	async function worker(): Promise<void> {
		while (nextIndex < total) {
			const currentIndex = nextIndex++;
			await processItem(currentIndex);
		}
	}

	// Start workers up to concurrency limit
	const workerCount = Math.min(concurrency, total);
	const workers: Promise<void>[] = [];

	for (let i = 0; i < workerCount; i++) {
		workers.push(worker());
	}

	// Wait for all workers to complete
	await Promise.all(workers);

	// Emit complete event
	emit({
		type: "parallel:complete",
		name,
		total,
		timestamp: new Date(),
	} as ParallelCompleteEvent);

	return results;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a retry function bound to an emit callback.
 * This is used by ExecuteContext to provide the retry() helper.
 *
 * @param emit - Event emission function
 * @returns Bound retry function
 */
export function createRetryHelper(
	emit: EmitFn,
): <T>(name: string, fn: () => Promise<T>, options?: RetryOptions) => Promise<T> {
	return <T>(name: string, fn: () => Promise<T>, options?: RetryOptions) => {
		return retry(name, fn, options, emit);
	};
}

/**
 * Create a parallel function bound to an emit callback.
 * This is used by ExecuteContext to provide the parallel() helper.
 *
 * @param emit - Event emission function
 * @returns Bound parallel function
 */
export function createParallelHelper(
	emit: EmitFn,
): <T>(name: string, fns: Array<() => Promise<T>>, options?: ParallelOptions) => Promise<T[]> {
	return <T>(name: string, fns: Array<() => Promise<T>>, options?: ParallelOptions) => {
		return parallel(name, fns, options, emit);
	};
}
