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
import type { FluentHarnessEvent, ParallelOptions, RetryOptions } from "./event-types.js";
/**
 * Emit function signature for publishing events.
 */
export type EmitFn = (event: FluentHarnessEvent) => void;
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
export declare function retry<T>(name: string, fn: () => Promise<T>, options: RetryOptions | undefined, emit: EmitFn): Promise<T>;
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
export declare function parallel<T>(name: string, fns: Array<() => Promise<T>>, options: ParallelOptions | undefined, emit: EmitFn): Promise<T[]>;
/**
 * Create a retry function bound to an emit callback.
 * This is used by ExecuteContext to provide the retry() helper.
 *
 * @param emit - Event emission function
 * @returns Bound retry function
 */
export declare function createRetryHelper(emit: EmitFn): <T>(name: string, fn: () => Promise<T>, options?: RetryOptions) => Promise<T>;
/**
 * Create a parallel function bound to an emit callback.
 * This is used by ExecuteContext to provide the parallel() helper.
 *
 * @param emit - Event emission function
 * @returns Bound parallel function
 */
export declare function createParallelHelper(emit: EmitFn): <T>(name: string, fns: Array<() => Promise<T>>, options?: ParallelOptions) => Promise<T[]>;
