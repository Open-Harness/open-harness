import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@open-harness/core";
import { parseReviewerOutput } from "./agents/reviewer-agent";
import { runSpecKit } from "./speckit-harness";

/**
 * Level 6: Advanced Fixture Patterns
 *
 * This level demonstrates more advanced fixture patterns:
 * - Multiple fixtures for the same workflow
 * - Deterministic replay for snapshot testing
 * - Fixture naming conventions
 *
 * v0.3.0 Reactive Pattern:
 * - Recording config passed directly to runReactive()
 * - MemorySignalStore for in-memory fixture management
 * - By this point, fixtures are second nature - every test uses them
 */

// Shared store for recording/replay
const store = new MemorySignalStore();

// Get recording mode from environment
const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

describe("SpecKit - Level 6 (Advanced Fixtures)", () => {
	describe("Fixture Patterns", () => {
		it(
			"demonstrates fixture recording pattern",
			async () => {
				// Each test gets its own fixture, enabling:
				// 1. Independent test isolation
				// 2. Clear fixture naming
				// 3. Easy re-recording of individual tests

				const result = await runSpecKit(
					`PRD: Greeting Function
Create a function that says hello to a user by name.`,
					{
						fixture: "level6-greeting",
						mode: getMode(),
						store,
					},
				);

				expect(result.output).toBeDefined();

				// Signals track the execution flow
				console.log("Signals emitted:", result.signals.length);
			},
			{ timeout: 900000 },
		);

		it(
			"demonstrates deterministic replay",
			async () => {
				// In replay mode, the same fixture produces identical results
				// This enables deterministic CI testing

				const result1 = await runSpecKit(
					`PRD: Number Checker
Create a function that checks if a number is positive.`,
					{
						fixture: "level6-number-checker",
						mode: getMode(),
						store,
					},
				);

				const result2 = await runSpecKit(
					`PRD: Number Checker
Create a function that checks if a number is positive.`,
					{
						fixture: "level6-number-checker",
						mode: getMode(),
						store,
					},
				);

				// In replay mode, outputs are identical (same fixture)
				if (process.env.FIXTURE_MODE !== "record") {
					expect(result1.output).toEqual(result2.output);
				}

				// Parse to verify structure
				const parsed = parseReviewerOutput(result1.output);
				expect(typeof parsed.approved).toBe("boolean");
			},
			{ timeout: 900000 },
		);

		it(
			"demonstrates fixture for complex workflow",
			async () => {
				// Harness fixtures capture the ENTIRE multi-agent conversation
				// This is powerful for testing complex workflows

				const result = await runSpecKit(
					`PRD: String Utilities
Create utilities for:
1. Checking if a string is empty
2. Trimming whitespace
3. Converting to uppercase`,
					{
						fixture: "level6-string-utils",
						mode: getMode(),
						store,
					},
				);

				expect(result.output).toBeDefined();
				expect(result.metrics).toBeDefined();

				const parsed = parseReviewerOutput(result.output);
				console.log("Complex workflow result:", {
					approved: parsed.approved,
					criteriaCount: parsed.criteriaResults.length,
				});
			},
			{ timeout: 900000 },
		);
	});
});

/**
 * Advanced Fixture Patterns
 * =========================
 *
 * FIXTURE VARIANTS
 * ----------------
 * Use different fixture names for the same test to compare behavior:
 *
 *   // Record with opus
 *   await runSpecKit(prompt, { fixture: "test-opus" });
 *
 *   // Record with sonnet
 *   await runSpecKit(prompt, { fixture: "test-sonnet" });
 *
 *   // Compare outputs
 *   expect(opusResult.output).not.toEqual(sonnetResult.output);
 *
 *
 * SELECTIVE RE-RECORDING
 * ----------------------
 * To re-record a specific test:
 *
 *   FIXTURE_MODE=record bun test -- --test-name-pattern="my specific test"
 *
 *
 * v0.3.0 SIGNAL RECORDING
 * -----------------------
 * The new signal-based recording captures:
 * - All signals emitted during execution
 * - Agent activation sequence
 * - State transitions
 * - Full execution trace for debugging
 */
