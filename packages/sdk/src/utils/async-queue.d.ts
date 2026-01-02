/**
 * AsyncQueue - FIFO queue with async consumption
 *
 * Provides blocking and non-blocking access to queued items.
 * Used for message injection in Transport architecture.
 *
 * @module harness/async-queue
 */
/**
 * FIFO queue with async consumption.
 *
 * Supports both blocking (`pop()`) and non-blocking (`tryPop()`) access.
 * Used for injected messages in Transport and prompt response tracking.
 *
 * @template T - Type of items in the queue
 *
 * @example
 * ```typescript
 * const queue = new AsyncQueue<string>();
 *
 * // Producer
 * queue.push("hello");
 *
 * // Consumer (blocking)
 * const item = await queue.pop(); // "hello"
 *
 * // Consumer (non-blocking)
 * const maybeItem = queue.tryPop(); // undefined if empty
 * ```
 */
export declare class AsyncQueue<T> {
    /** Internal FIFO storage */
    private items;
    /** Pending consumers waiting for items */
    private waiters;
    /** Whether the queue has been closed */
    private closed;
    /**
     * Add an item to the queue.
     *
     * If consumers are waiting, the first waiter receives the item immediately.
     * Otherwise, the item is queued for later consumption.
     * No-op if queue is closed.
     *
     * @param item - Item to add
     */
    push(item: T): void;
    /**
     * Remove and return the first item (blocking).
     *
     * If the queue is empty, waits until an item is available.
     * Returns undefined if the queue is closed and empty.
     *
     * @returns Promise that resolves with the first item or undefined if closed
     */
    pop(): Promise<T | undefined>;
    /**
     * Close the queue.
     *
     * Resolves all pending waiters with undefined (signaling end of stream).
     * After closing, push() becomes a no-op and pop() returns undefined.
     */
    close(): void;
    /**
     * Whether the queue has been closed.
     */
    get isClosed(): boolean;
    /**
     * Remove and return the first item (non-blocking).
     *
     * Returns undefined if the queue is empty.
     *
     * @returns First item or undefined
     */
    tryPop(): T | undefined;
    /**
     * View the first item without removing it.
     *
     * @returns First item or undefined if empty
     */
    peek(): T | undefined;
    /**
     * Number of items currently in the queue.
     *
     * Does not include pending waiters.
     */
    get length(): number;
    /**
     * Whether the queue is empty.
     */
    get isEmpty(): boolean;
    /**
     * Remove all items from the queue.
     *
     * Note: Does NOT reject pending waiters. They will continue waiting
     * until new items are pushed or the consumer handles timeout externally.
     */
    clear(): void;
    /**
     * Number of consumers waiting for items.
     *
     * Useful for testing and debugging.
     */
    get pendingCount(): number;
    /**
     * Cancel all pending waiters by rejecting their promises.
     *
     * Used during abort handling to unblock waiting consumers.
     *
     * @param reason - Reason for cancellation
     */
    cancelWaiters(reason?: unknown): void;
}
