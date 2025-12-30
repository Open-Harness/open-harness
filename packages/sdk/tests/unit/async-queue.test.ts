/**
 * AsyncQueue Unit Tests
 *
 * Tests for the FIFO queue with async consumption.
 *
 * @module tests/unit/async-queue
 */

import { describe, expect, test } from "bun:test";
import { AsyncQueue } from "../../src/harness/async-queue.js";

describe("AsyncQueue", () => {
	describe("push and pop", () => {
		test("pop returns items in FIFO order", async () => {
			const queue = new AsyncQueue<string>();

			queue.push("first");
			queue.push("second");
			queue.push("third");

			expect(await queue.pop()).toBe("first");
			expect(await queue.pop()).toBe("second");
			expect(await queue.pop()).toBe("third");
		});

		test("pop blocks until item is available", async () => {
			const queue = new AsyncQueue<string>();
			let resolved = false;

			// Start waiting for item
			const popPromise = queue.pop().then((item) => {
				resolved = true;
				return item;
			});

			// Not resolved yet
			await Promise.resolve(); // Tick
			expect(resolved).toBe(false);

			// Push item
			queue.push("hello");

			// Now it should resolve
			const result = await popPromise;
			expect(result).toBe("hello");
			expect(resolved).toBe(true);
		});

		test("multiple waiters are served in order", async () => {
			const queue = new AsyncQueue<number>();
			const results: number[] = [];

			// Start 3 waiters
			const p1 = queue.pop().then((n) => n !== undefined && results.push(n));
			const p2 = queue.pop().then((n) => n !== undefined && results.push(n));
			const p3 = queue.pop().then((n) => n !== undefined && results.push(n));

			// Push items one by one
			queue.push(1);
			queue.push(2);
			queue.push(3);

			await Promise.all([p1, p2, p3]);

			// Results should be in order
			expect(results).toEqual([1, 2, 3]);
		});

		test("immediate resolution when queue has items", async () => {
			const queue = new AsyncQueue<string>();

			// Pre-populate
			queue.push("ready");

			// Should resolve immediately
			const result = await queue.pop();
			expect(result).toBe("ready");
		});
	});

	describe("tryPop", () => {
		test("returns undefined when queue is empty", () => {
			const queue = new AsyncQueue<string>();
			expect(queue.tryPop()).toBeUndefined();
		});

		test("returns and removes first item", () => {
			const queue = new AsyncQueue<string>();
			queue.push("item");

			expect(queue.tryPop()).toBe("item");
			expect(queue.tryPop()).toBeUndefined();
		});

		test("does not interfere with blocking pop", async () => {
			const queue = new AsyncQueue<string>();

			// Start a blocking pop
			const popPromise = queue.pop();

			// tryPop should return undefined (empty)
			expect(queue.tryPop()).toBeUndefined();

			// Push resolves the blocking pop
			queue.push("hello");
			expect(await popPromise).toBe("hello");
		});
	});

	describe("peek", () => {
		test("returns undefined when queue is empty", () => {
			const queue = new AsyncQueue<string>();
			expect(queue.peek()).toBeUndefined();
		});

		test("returns first item without removing", () => {
			const queue = new AsyncQueue<string>();
			queue.push("first");
			queue.push("second");

			expect(queue.peek()).toBe("first");
			expect(queue.peek()).toBe("first"); // Still there
			expect(queue.length).toBe(2);
		});
	});

	describe("length and isEmpty", () => {
		test("reports correct length", () => {
			const queue = new AsyncQueue<number>();

			expect(queue.length).toBe(0);
			expect(queue.isEmpty).toBe(true);

			queue.push(1);
			expect(queue.length).toBe(1);
			expect(queue.isEmpty).toBe(false);

			queue.push(2);
			expect(queue.length).toBe(2);

			queue.tryPop();
			expect(queue.length).toBe(1);
		});

		test("length does not count pending waiters", async () => {
			const queue = new AsyncQueue<string>();

			// Start a waiter
			const popPromise = queue.pop();

			// Length is still 0 (waiters are not counted as items)
			expect(queue.length).toBe(0);
			expect(queue.isEmpty).toBe(true);
			expect(queue.pendingCount).toBe(1);

			// Resolve the waiter
			queue.push("item");
			await popPromise;

			expect(queue.pendingCount).toBe(0);
		});
	});

	describe("clear", () => {
		test("removes all items", () => {
			const queue = new AsyncQueue<string>();
			queue.push("a");
			queue.push("b");
			queue.push("c");

			expect(queue.length).toBe(3);

			queue.clear();

			expect(queue.length).toBe(0);
			expect(queue.isEmpty).toBe(true);
			expect(queue.tryPop()).toBeUndefined();
		});

		test("does not reject pending waiters", async () => {
			const queue = new AsyncQueue<string>();

			// Start a waiter
			const popPromise = queue.pop();

			// Clear doesn't reject
			queue.clear();

			// Push still resolves the waiter
			queue.push("after-clear");
			expect(await popPromise).toBe("after-clear");
		});
	});

	describe("cancelWaiters", () => {
		test("rejects all pending waiters", async () => {
			const queue = new AsyncQueue<string>();

			// Start waiters
			const p1 = queue.pop();
			const p2 = queue.pop();

			expect(queue.pendingCount).toBe(2);

			// Cancel with reason
			queue.cancelWaiters(new Error("Aborted"));

			// Both should reject
			await expect(p1).rejects.toThrow("Aborted");
			await expect(p2).rejects.toThrow("Aborted");

			expect(queue.pendingCount).toBe(0);
		});

		test("uses default error when no reason provided", async () => {
			const queue = new AsyncQueue<string>();
			const popPromise = queue.pop();

			queue.cancelWaiters();

			await expect(popPromise).rejects.toThrow("Queue cancelled");
		});
	});

	describe("generic typing", () => {
		test("works with complex types", async () => {
			interface Message {
				id: string;
				content: string;
			}

			const queue = new AsyncQueue<Message>();

			queue.push({ id: "1", content: "hello" });

			const msg = await queue.pop();
			expect(msg).toBeDefined();
			expect(msg?.id).toBe("1");
			expect(msg?.content).toBe("hello");
		});
	});
});
