/**
 * Tests for OpenHarnessReporter.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { OpenHarnessReporter } from "../src/reporter.js";

// Minimal mock for TaskResultPack - just enough structure for our tests
type MockTaskResultPack = [string, { state: string } | undefined, unknown];

describe("OpenHarnessReporter", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		// Reset to 0 - bun doesn't allow resetting to undefined
		process.exitCode = 0;
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		// Clean up after each test
		process.exitCode = 0;
	});

	describe("constructor", () => {
		test("uses default passRate of 0.8", () => {
			const reporter = new OpenHarnessReporter();
			// @ts-expect-error - accessing private property for testing
			expect(reporter.config.passRate).toBe(0.8);
		});

		test("allows custom passRate", () => {
			const reporter = new OpenHarnessReporter({ passRate: 0.9 });
			// @ts-expect-error - accessing private property for testing
			expect(reporter.config.passRate).toBe(0.9);
		});
	});

	describe("onTaskUpdate", () => {
		test("counts passed tests", () => {
			const reporter = new OpenHarnessReporter();
			const packs: MockTaskResultPack[] = [
				["test-1", { state: "pass" }, undefined],
				["test-2", { state: "pass" }, undefined],
			];

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);

			// @ts-expect-error - accessing private property for testing
			expect(reporter.passed).toBe(2);
		});

		test("counts failed tests", () => {
			const reporter = new OpenHarnessReporter();
			const packs: MockTaskResultPack[] = [["test-1", { state: "fail" }, undefined]];

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);

			// @ts-expect-error - accessing private property for testing
			expect(reporter.failed).toBe(1);
		});

		test("accumulates across multiple calls", () => {
			const reporter = new OpenHarnessReporter();

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate([["test-1", { state: "pass" }, undefined]]);
			// @ts-expect-error - using mock type
			reporter.onTaskUpdate([["test-2", { state: "fail" }, undefined]]);

			// @ts-expect-error - accessing private property for testing
			expect(reporter.passed).toBe(1);
			// @ts-expect-error - accessing private property for testing
			expect(reporter.failed).toBe(1);
		});

		test("ignores other states", () => {
			const reporter = new OpenHarnessReporter();
			const packs: MockTaskResultPack[] = [
				["test-1", { state: "skip" }, undefined],
				["test-2", { state: "todo" }, undefined],
				["test-3", undefined, undefined],
			];

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);

			// @ts-expect-error - accessing private property for testing
			expect(reporter.passed).toBe(0);
			// @ts-expect-error - accessing private property for testing
			expect(reporter.failed).toBe(0);
		});
	});

	describe("onFinished", () => {
		test("does nothing when no tests ran", () => {
			const reporter = new OpenHarnessReporter();

			reporter.onFinished();

			expect(consoleLogSpy).not.toHaveBeenCalled();
			// Exit code should remain 0 (not touched)
			expect(process.exitCode).toBe(0);
		});

		test("passes when above threshold", () => {
			const reporter = new OpenHarnessReporter({ passRate: 0.8 });

			// 9/10 = 90% pass rate
			const packs: MockTaskResultPack[] = [];
			for (let i = 0; i < 9; i++) {
				packs.push([`t${i}`, { state: "pass" }, undefined]);
			}
			packs.push(["t9", { state: "fail" }, undefined]);

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);
			reporter.onFinished();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("9/10 passed"));
			expect(consoleLogSpy).toHaveBeenCalledWith("All gates passed");
			// Exit code should remain 0 (not set to 1)
			expect(process.exitCode).toBe(0);
		});

		test("fails when below threshold", () => {
			const reporter = new OpenHarnessReporter({ passRate: 0.8 });

			// 7/10 = 70% pass rate
			const packs: MockTaskResultPack[] = [];
			for (let i = 0; i < 7; i++) {
				packs.push([`t${i}`, { state: "pass" }, undefined]);
			}
			for (let i = 7; i < 10; i++) {
				packs.push([`t${i}`, { state: "fail" }, undefined]);
			}

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);
			reporter.onFinished();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("7/10 passed"));
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("GATE FAILED"));
			expect(process.exitCode).toBe(1);
		});

		test("passes when exactly at threshold", () => {
			const reporter = new OpenHarnessReporter({ passRate: 0.8 });

			// 8/10 = 80% pass rate (exactly at threshold)
			const packs: MockTaskResultPack[] = [];
			for (let i = 0; i < 8; i++) {
				packs.push([`t${i}`, { state: "pass" }, undefined]);
			}
			for (let i = 8; i < 10; i++) {
				packs.push([`t${i}`, { state: "fail" }, undefined]);
			}

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);
			reporter.onFinished();

			expect(consoleLogSpy).toHaveBeenCalledWith("All gates passed");
			// Exit code should remain 0 (not set to 1)
			expect(process.exitCode).toBe(0);
		});

		test("uses custom passRate", () => {
			const reporter = new OpenHarnessReporter({ passRate: 0.5 });

			// 5/10 = 50% pass rate (exactly at custom threshold)
			const packs: MockTaskResultPack[] = [];
			for (let i = 0; i < 5; i++) {
				packs.push([`t${i}`, { state: "pass" }, undefined]);
			}
			for (let i = 5; i < 10; i++) {
				packs.push([`t${i}`, { state: "fail" }, undefined]);
			}

			// @ts-expect-error - using mock type
			reporter.onTaskUpdate(packs);
			reporter.onFinished();

			expect(consoleLogSpy).toHaveBeenCalledWith("All gates passed");
			// Exit code should remain 0 (not set to 1)
			expect(process.exitCode).toBe(0);
		});
	});
});
