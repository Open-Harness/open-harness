/**
 * Unit tests for backoff.ts
 *
 * Tests exponential backoff delay calculation, jitter, and retry logic.
 * Pure logic tests - no LLM calls required.
 */

import { describe, expect, test } from "bun:test";
import {
	calculateDelay,
	createBackoffContext,
	DEFAULT_BACKOFF_CONFIG,
	isRateLimitError,
	shouldRetry,
	sleep,
	updateBackoffContext,
	withBackoff,
} from "../../src/utils/backoff.js";

describe("backoff", () => {
	describe("DEFAULT_BACKOFF_CONFIG", () => {
		test("has correct default values", () => {
			expect(DEFAULT_BACKOFF_CONFIG.baseDelayMs).toBe(1000);
			expect(DEFAULT_BACKOFF_CONFIG.maxDelayMs).toBe(60000);
			expect(DEFAULT_BACKOFF_CONFIG.maxJitterMs).toBe(500);
			expect(DEFAULT_BACKOFF_CONFIG.maxAttempts).toBe(10);
		});
	});

	describe("calculateDelay", () => {
		test("first attempt uses base delay", () => {
			const delay = calculateDelay(1, { maxJitterMs: 0 });
			expect(delay).toBe(1000);
		});

		test("delay doubles each attempt (exponential)", () => {
			const delay1 = calculateDelay(1, { maxJitterMs: 0 });
			const delay2 = calculateDelay(2, { maxJitterMs: 0 });
			const delay3 = calculateDelay(3, { maxJitterMs: 0 });

			expect(delay1).toBe(1000); // 1000 * 2^0 = 1000
			expect(delay2).toBe(2000); // 1000 * 2^1 = 2000
			expect(delay3).toBe(4000); // 1000 * 2^2 = 4000
		});

		test("delay caps at maxDelay", () => {
			const delay = calculateDelay(10, { maxJitterMs: 0, maxDelayMs: 60000 });
			expect(delay).toBe(60000);

			// Even higher attempts stay capped
			const delay20 = calculateDelay(20, { maxJitterMs: 0, maxDelayMs: 60000 });
			expect(delay20).toBe(60000);
		});

		test("jitter adds randomness within range", () => {
			const config = { baseDelayMs: 1000, maxJitterMs: 500 };
			const delays: number[] = [];

			// Run multiple times to verify randomness
			for (let i = 0; i < 100; i++) {
				delays.push(calculateDelay(1, config));
			}

			// All delays should be in range [1000, 1500)
			expect(delays.every((d) => d >= 1000 && d < 1500)).toBe(true);

			// Should have some variation (not all same)
			const uniqueDelays = new Set(delays);
			expect(uniqueDelays.size).toBeGreaterThan(1);
		});

		test("respects custom base delay", () => {
			const delay = calculateDelay(1, { baseDelayMs: 500, maxJitterMs: 0 });
			expect(delay).toBe(500);
		});

		test("attempt 5 calculates correctly", () => {
			// 1000 * 2^4 = 16000
			const delay = calculateDelay(5, { maxJitterMs: 0 });
			expect(delay).toBe(16000);
		});
	});

	describe("shouldRetry", () => {
		test("returns true when below max attempts", () => {
			expect(shouldRetry(1)).toBe(true);
			expect(shouldRetry(5)).toBe(true);
			expect(shouldRetry(9)).toBe(true);
		});

		test("returns false at max attempts", () => {
			expect(shouldRetry(10)).toBe(false);
		});

		test("returns false above max attempts", () => {
			expect(shouldRetry(11)).toBe(false);
			expect(shouldRetry(100)).toBe(false);
		});

		test("respects custom max attempts", () => {
			expect(shouldRetry(3, { maxAttempts: 3 })).toBe(false);
			expect(shouldRetry(2, { maxAttempts: 3 })).toBe(true);
		});
	});

	describe("sleep", () => {
		test("sleeps for approximately the specified duration", async () => {
			const start = Date.now();
			await sleep(50);
			const elapsed = Date.now() - start;

			// Allow some tolerance for timing
			expect(elapsed).toBeGreaterThanOrEqual(45);
			expect(elapsed).toBeLessThan(100);
		});

		test("sleeps for 0ms immediately", async () => {
			const start = Date.now();
			await sleep(0);
			const elapsed = Date.now() - start;

			expect(elapsed).toBeLessThan(20);
		});
	});

	describe("isRateLimitError", () => {
		test("detects 'rate limit' in message", () => {
			expect(isRateLimitError(new Error("rate limit exceeded"))).toBe(true);
			expect(isRateLimitError(new Error("Rate Limit Exceeded"))).toBe(true);
		});

		test("detects 'rate_limit' in message", () => {
			expect(isRateLimitError(new Error("error: rate_limit_exceeded"))).toBe(true);
		});

		test("detects 'too many requests' in message", () => {
			expect(isRateLimitError(new Error("too many requests"))).toBe(true);
			expect(isRateLimitError(new Error("Too Many Requests"))).toBe(true);
		});

		test("detects '429' in message", () => {
			expect(isRateLimitError(new Error("HTTP 429"))).toBe(true);
			expect(isRateLimitError(new Error("status: 429"))).toBe(true);
		});

		test("returns false for other errors", () => {
			expect(isRateLimitError(new Error("Connection refused"))).toBe(false);
			expect(isRateLimitError(new Error("timeout"))).toBe(false);
			expect(isRateLimitError(new Error("invalid request"))).toBe(false);
		});

		test("returns false for non-Error values", () => {
			expect(isRateLimitError("rate limit")).toBe(false);
			expect(isRateLimitError(429)).toBe(false);
			expect(isRateLimitError(null)).toBe(false);
			expect(isRateLimitError(undefined)).toBe(false);
		});
	});

	describe("withBackoff", () => {
		test("returns result on first success", async () => {
			let callCount = 0;
			const result = await withBackoff(async () => {
				callCount++;
				return "success";
			});

			expect(result).toBe("success");
			expect(callCount).toBe(1);
		});

		test("retries on rate limit error", async () => {
			let callCount = 0;
			const result = await withBackoff(
				async () => {
					callCount++;
					if (callCount < 3) {
						throw new Error("rate limit exceeded");
					}
					return "success after retries";
				},
				{ baseDelayMs: 10, maxJitterMs: 0 },
			);

			expect(result).toBe("success after retries");
			expect(callCount).toBe(3);
		});

		test("throws immediately on non-rate-limit error", async () => {
			let callCount = 0;

			await expect(
				withBackoff(async () => {
					callCount++;
					throw new Error("invalid request");
				}),
			).rejects.toThrow("invalid request");

			expect(callCount).toBe(1);
		});

		test("throws after max attempts", async () => {
			let callCount = 0;

			await expect(
				withBackoff(
					async () => {
						callCount++;
						throw new Error("rate limit");
					},
					{ maxAttempts: 3, baseDelayMs: 10, maxJitterMs: 0 },
				),
			).rejects.toThrow("rate limit");

			expect(callCount).toBe(3);
		});
	});

	describe("BackoffContext", () => {
		test("createBackoffContext initializes correctly", () => {
			const context = createBackoffContext();

			expect(context.attempt).toBe(0);
			expect(context.lastDelay).toBe(0);
			expect(context.totalDelay).toBe(0);
			expect(context.startTime).toBeGreaterThan(0);
		});

		test("updateBackoffContext tracks attempts and delays", () => {
			let context = createBackoffContext();

			context = updateBackoffContext(context, 1000);
			expect(context.attempt).toBe(1);
			expect(context.lastDelay).toBe(1000);
			expect(context.totalDelay).toBe(1000);

			context = updateBackoffContext(context, 2000);
			expect(context.attempt).toBe(2);
			expect(context.lastDelay).toBe(2000);
			expect(context.totalDelay).toBe(3000);
		});
	});
});
