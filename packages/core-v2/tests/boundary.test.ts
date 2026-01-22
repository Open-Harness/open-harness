/**
 * Tests for Effect → Promise Boundary Utilities
 *
 * These tests verify FR-063: Effect failures converted to standard Error objects.
 *
 * @module @core-v2/tests/boundary
 */

import { Cause, Exit, FiberId } from "effect";
import { describe, expect, it } from "vitest";
import { causeToError, exitToResult } from "../src/internal/boundary.js";

// ============================================================================
// Test Error Classes (simulating domain errors)
// ============================================================================

class TestDomainError extends Error {
	readonly _tag = "TestDomainError";

	constructor(
		readonly code: string,
		message: string,
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "TestDomainError";
	}
}

class StoreErrorMock extends Error {
	readonly _tag = "StoreError";

	constructor(
		readonly code: "NOT_FOUND" | "WRITE_FAILED" | "READ_FAILED",
		message: string,
	) {
		super(message);
		this.name = "StoreError";
	}
}

// ============================================================================
// causeToError Tests
// ============================================================================

describe("causeToError", () => {
	describe("Typed Failures (Cause.fail)", () => {
		it("should preserve domain error class when failure is an Error subclass", () => {
			const domainError = new TestDomainError("TEST_CODE", "Test error message");
			const cause = Cause.fail(domainError);

			const result = causeToError(cause);

			expect(result).toBe(domainError);
			expect(result).toBeInstanceOf(TestDomainError);
			expect((result as TestDomainError).code).toBe("TEST_CODE");
			expect(result.message).toBe("Test error message");
			expect((result as TestDomainError)._tag).toBe("TestDomainError");
		});

		it("should preserve StoreError with code and message", () => {
			const storeError = new StoreErrorMock("NOT_FOUND", "Session not found");
			const cause = Cause.fail(storeError);

			const result = causeToError(cause);

			expect(result).toBe(storeError);
			expect(result).toBeInstanceOf(StoreErrorMock);
			expect((result as StoreErrorMock).code).toBe("NOT_FOUND");
		});

		it("should preserve standard Error instances", () => {
			const error = new Error("Standard error");
			const cause = Cause.fail(error);

			const result = causeToError(cause);

			expect(result).toBe(error);
			expect(result.message).toBe("Standard error");
		});

		it("should wrap non-Error failures with pretty printing", () => {
			const cause = Cause.fail("string error");

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.message).toContain("Effect failure:");
		});

		it("should wrap object failures with pretty printing", () => {
			const cause = Cause.fail({ code: "ERR", msg: "Object error" });

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.message).toContain("Effect failure:");
		});
	});

	describe("Defects (Cause.die)", () => {
		it("should wrap Error defects with DefectError", () => {
			const defect = new TypeError("Unexpected type error");
			const cause = Cause.die(defect);

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.name).toBe("DefectError");
			expect(result.message).toContain("Unexpected error:");
			expect(result.message).toContain("Unexpected type error");
			expect(result.cause).toBe(defect);
		});

		it("should preserve stack trace from defect", () => {
			const defect = new Error("Defect with stack");
			const cause = Cause.die(defect);

			const result = causeToError(cause);

			expect(result.stack).toBe(defect.stack);
		});

		it("should convert non-Error defects to Error", () => {
			const cause = Cause.die("string defect");

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.message).toContain("Unexpected defect:");
			expect(result.message).toContain("string defect");
		});

		it("should handle null/undefined defects", () => {
			const cause = Cause.die(null);

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.message).toContain("Unexpected defect:");
		});
	});

	describe("Interruptions (Cause.interrupt)", () => {
		it("should create InterruptedError for interrupted cause", () => {
			const cause = Cause.interrupt(FiberId.none);

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.name).toBe("InterruptedError");
			expect(result.message).toBe("Operation was interrupted");
		});
	});

	describe("Empty Cause", () => {
		it("should return unknown error for empty cause", () => {
			const cause = Cause.empty;

			const result = causeToError(cause);

			expect(result).toBeInstanceOf(Error);
			expect(result.message).toBe("Unknown error (empty cause)");
		});
	});

	describe("Complex Causes", () => {
		it("should use first failure when multiple failures exist", () => {
			const error1 = new TestDomainError("FIRST", "First error");
			const error2 = new TestDomainError("SECOND", "Second error");
			const cause = Cause.parallel(Cause.fail(error1), Cause.fail(error2));

			const result = causeToError(cause);

			// Should get first failure
			expect(result).toBeInstanceOf(TestDomainError);
		});

		it("should use pretty printing for sequential causes", () => {
			const cause = Cause.sequential(Cause.fail(new Error("First")), Cause.fail(new Error("Second")));

			const result = causeToError(cause);

			// Should get first failure
			expect(result).toBeInstanceOf(Error);
		});

		it("should prioritize failure over defect", () => {
			const failError = new TestDomainError("FAIL", "Failure error");
			const defectError = new TypeError("Defect");
			// Combine failure and defect
			const cause = Cause.parallel(Cause.fail(failError), Cause.die(defectError));

			const result = causeToError(cause);

			// Failures are checked first
			expect(result).toBeInstanceOf(TestDomainError);
			expect((result as TestDomainError).code).toBe("FAIL");
		});
	});

	describe("Edge Cases", () => {
		it("should handle cause with undefined failure", () => {
			const cause = Cause.fail(undefined);

			const result = causeToError(cause);

			// undefined is not an Error, so we get pretty-printed output
			// The exact message depends on Effect's Cause.pretty implementation
			expect(result).toBeInstanceOf(Error);
		});

		it("should handle Error with cause property", () => {
			const innerError = new Error("Inner");
			const outerError = new Error("Outer", { cause: innerError });
			const cause = Cause.fail(outerError);

			const result = causeToError(cause);

			expect(result).toBe(outerError);
			expect(result.cause).toBe(innerError);
		});
	});
});

// ============================================================================
// exitToResult Tests
// ============================================================================

describe("exitToResult", () => {
	describe("Success Cases", () => {
		it("should return value on success", () => {
			const exit = Exit.succeed(42);

			const result = exitToResult(exit);

			expect(result).toBe(42);
		});

		it("should return object on success", () => {
			const data = { id: 1, name: "Test" };
			const exit = Exit.succeed(data);

			const result = exitToResult(exit);

			expect(result).toEqual(data);
		});

		it("should return undefined on void success", () => {
			const exit = Exit.succeed(undefined);

			const result = exitToResult(exit);

			expect(result).toBeUndefined();
		});

		it("should return null on null success", () => {
			const exit = Exit.succeed(null);

			const result = exitToResult(exit);

			expect(result).toBeNull();
		});
	});

	describe("Failure Cases - Domain Errors", () => {
		it("should throw domain error preserving class", () => {
			const domainError = new TestDomainError("TEST", "Domain error");
			const exit = Exit.fail(domainError);

			expect(() => exitToResult(exit)).toThrow(domainError);

			try {
				exitToResult(exit);
			} catch (error) {
				expect(error).toBeInstanceOf(TestDomainError);
				expect((error as TestDomainError).code).toBe("TEST");
				expect((error as TestDomainError)._tag).toBe("TestDomainError");
			}
		});

		it("should throw StoreError preserving code", () => {
			const storeError = new StoreErrorMock("READ_FAILED", "Read failed");
			const exit = Exit.fail(storeError);

			try {
				exitToResult(exit);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(StoreErrorMock);
				expect((error as StoreErrorMock).code).toBe("READ_FAILED");
			}
		});

		it("should throw standard Error on failure", () => {
			const exit = Exit.fail(new Error("Standard error"));

			expect(() => exitToResult(exit)).toThrow("Standard error");
		});
	});

	describe("Failure Cases - Defects", () => {
		it("should throw wrapped defect", () => {
			const defect = new TypeError("Type error defect");
			const exit = Exit.die(defect);

			try {
				exitToResult(exit);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).name).toBe("DefectError");
				expect((error as Error).message).toContain("Unexpected error:");
			}
		});
	});

	describe("Failure Cases - Interruptions", () => {
		it("should throw InterruptedError on interruption", () => {
			const exit = Exit.interrupt(FiberId.none);

			try {
				exitToResult(exit);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).name).toBe("InterruptedError");
			}
		});
	});

	describe("Failure Cases - String Errors", () => {
		it("should throw wrapped Error for string failure", () => {
			const exit = Exit.fail("string error message");

			expect(() => exitToResult(exit)).toThrow();

			try {
				exitToResult(exit);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toContain("Effect failure:");
			}
		});
	});
});

// ============================================================================
// Integration Tests - Simulating Real Usage
// ============================================================================

describe("Boundary Integration", () => {
	describe("Promise boundary pattern", () => {
		it("should convert Effect success to Promise resolution", async () => {
			// Simulating what happens in workflow.run()
			const successExit = Exit.succeed({ state: "done", events: [] });

			const result = exitToResult(successExit);

			expect(result).toEqual({ state: "done", events: [] });
		});

		it("should convert Effect failure to Promise rejection with domain error", () => {
			// Simulating a store error during workflow execution
			const storeError = new StoreErrorMock("NOT_FOUND", "Session xyz not found");
			const failureExit = Exit.fail(storeError);

			// This is how ManagedRuntime.runPromise would surface the error
			try {
				exitToResult(failureExit);
				expect.fail("Should have thrown");
			} catch (error) {
				// Consumer code can now handle the domain error
				expect(error).toBeInstanceOf(StoreErrorMock);
				if (error instanceof StoreErrorMock) {
					expect(error.code).toBe("NOT_FOUND");
					expect(error.message).toBe("Session xyz not found");
				}
			}
		});

		it("should surface unexpected errors as DefectError", () => {
			// Simulating an unexpected exception during workflow
			const unexpectedError = new RangeError("Array index out of bounds");
			const defectExit = Exit.die(unexpectedError);

			try {
				exitToResult(defectExit);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).name).toBe("DefectError");
				expect((error as Error).message).toContain("Array index out of bounds");
				// Original error preserved in cause
				expect((error as Error).cause).toBe(unexpectedError);
			}
		});
	});

	describe("Error type preservation", () => {
		it("should allow instanceof checks after conversion", () => {
			const domainError = new TestDomainError("AUTH_FAILED", "Authentication failed");
			const exit = Exit.fail(domainError);

			try {
				exitToResult(exit);
			} catch (error) {
				// Consumer can use instanceof for error handling
				if (error instanceof TestDomainError) {
					expect(error.code).toBe("AUTH_FAILED");
				} else {
					expect.fail("Should be TestDomainError");
				}
			}
		});

		it("should preserve error chain via cause", () => {
			const rootCause = new Error("Database connection failed");
			const domainError = new TestDomainError("STORE_ERROR", "Failed to save session", rootCause);
			const exit = Exit.fail(domainError);

			try {
				exitToResult(exit);
			} catch (error) {
				expect((error as TestDomainError).cause).toBe(rootCause);
			}
		});
	});
});
