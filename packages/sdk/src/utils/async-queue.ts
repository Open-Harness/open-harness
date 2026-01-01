/**
 * AsyncQueue - FIFO queue with async consumption
 *
 * Provides blocking and non-blocking access to queued items.
 * Used for message injection in Transport architecture.
 *
 * @module harness/async-queue
 */

/**
 * Deferred promise with external resolve/reject control.
 */
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
}

/**
 * Create a deferred promise that can be resolved/rejected externally.
 */
function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

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
export class AsyncQueue<T> {
	/** Internal FIFO storage */
	private items: T[] = [];

	/** Pending consumers waiting for items */
	private waiters: Deferred<T | undefined>[] = [];

	/** Whether the queue has been closed */
	private closed = false;

	/**
	 * Add an item to the queue.
	 *
	 * If consumers are waiting, the first waiter receives the item immediately.
	 * Otherwise, the item is queued for later consumption.
	 * No-op if queue is closed.
	 *
	 * @param item - Item to add
	 */
	push(item: T): void {
		// No-op if closed
		if (this.closed) return;

		// If someone is waiting, give them the item directly
		const waiter = this.waiters.shift();
		if (waiter) {
			waiter.resolve(item);
		} else {
			this.items.push(item);
		}
	}

	/**
	 * Remove and return the first item (blocking).
	 *
	 * If the queue is empty, waits until an item is available.
	 * Returns undefined if the queue is closed and empty.
	 *
	 * @returns Promise that resolves with the first item or undefined if closed
	 */
	pop(): Promise<T | undefined> {
		// If we have items, return immediately
		const item = this.items.shift();
		if (item !== undefined) {
			return Promise.resolve(item);
		}

		// If closed and empty, return undefined immediately
		if (this.closed) {
			return Promise.resolve(undefined);
		}

		// Otherwise, wait for an item
		const deferred = createDeferred<T | undefined>();
		this.waiters.push(deferred);
		return deferred.promise;
	}

	/**
	 * Close the queue.
	 *
	 * Resolves all pending waiters with undefined (signaling end of stream).
	 * After closing, push() becomes a no-op and pop() returns undefined.
	 */
	close(): void {
		if (this.closed) return;
		this.closed = true;

		// Resolve all pending waiters with undefined
		for (const waiter of this.waiters) {
			waiter.resolve(undefined);
		}
		this.waiters = [];
	}

	/**
	 * Whether the queue has been closed.
	 */
	get isClosed(): boolean {
		return this.closed;
	}

	/**
	 * Remove and return the first item (non-blocking).
	 *
	 * Returns undefined if the queue is empty.
	 *
	 * @returns First item or undefined
	 */
	tryPop(): T | undefined {
		return this.items.shift();
	}

	/**
	 * View the first item without removing it.
	 *
	 * @returns First item or undefined if empty
	 */
	peek(): T | undefined {
		return this.items[0];
	}

	/**
	 * Number of items currently in the queue.
	 *
	 * Does not include pending waiters.
	 */
	get length(): number {
		return this.items.length;
	}

	/**
	 * Whether the queue is empty.
	 */
	get isEmpty(): boolean {
		return this.items.length === 0;
	}

	/**
	 * Remove all items from the queue.
	 *
	 * Note: Does NOT reject pending waiters. They will continue waiting
	 * until new items are pushed or the consumer handles timeout externally.
	 */
	clear(): void {
		this.items = [];
	}

	/**
	 * Number of consumers waiting for items.
	 *
	 * Useful for testing and debugging.
	 */
	get pendingCount(): number {
		return this.waiters.length;
	}

	/**
	 * Cancel all pending waiters by rejecting their promises.
	 *
	 * Used during abort handling to unblock waiting consumers.
	 *
	 * @param reason - Reason for cancellation
	 */
	cancelWaiters(reason?: unknown): void {
		for (const waiter of this.waiters) {
			waiter.reject(reason ?? new Error("Queue cancelled"));
		}
		this.waiters = [];
	}
}
