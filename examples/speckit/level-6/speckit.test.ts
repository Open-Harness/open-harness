import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { setupFixtures, withFixture } from "../test-utils";
import { parseReviewerOutput } from "./agents/reviewer-agent";
import { specKit } from "./speckit-harness";

/**
 * Level 6: Advanced Fixture Patterns
 *
 * This level demonstrates more advanced fixture patterns:
 * - Multiple fixtures for the same workflow
 * - Deterministic replay for snapshot testing
 * - Fixture naming conventions
 *
 * By this point, fixtures are second nature - every test uses them.
 */
describe("SpecKit - Level 6 (Advanced Fixtures)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
		setupFixtures();
	});

	describe("Fixture Patterns", () => {
		it(
			"demonstrates fixture recording pattern",
			async () => {
				// Each test gets its own fixture, enabling:
				// 1. Independent test isolation
				// 2. Clear fixture naming
				// 3. Easy re-recording of individual tests

				const result = await run(
					specKit,
					{
						prompt: `PRD: Greeting Function
Create a function that says hello to a user by name.`,
					},
					withFixture("level6-greeting"),
				);

				expect(result.output).toBeDefined();

				// Fixture IDs are returned when recording
				if (result.fixtures && result.fixtures.length > 0) {
					console.log("Recorded fixtures:", result.fixtures);
				}
			},
			{ timeout: 900000 },
		);

		it(
			"demonstrates deterministic replay",
			async () => {
				// In replay mode, the same fixture produces identical results
				// This enables deterministic CI testing

				const result1 = await run(
					specKit,
					{
						prompt: `PRD: Number Checker
Create a function that checks if a number is positive.`,
					},
					withFixture("level6-number-checker"),
				);

				const result2 = await run(
					specKit,
					{
						prompt: `PRD: Number Checker
Create a function that checks if a number is positive.`,
					},
					withFixture("level6-number-checker"),
				);

				// In replay mode, outputs are identical (same fixture)
				if (process.env.FIXTURE_MODE !== "record") {
					expect(result1.output).toEqual(result2.output);
				}

				// Parse to verify structure
				const parsed = parseReviewerOutput(result1.output as string);
				expect(typeof parsed.approved).toBe("boolean");
			},
			{ timeout: 900000 },
		);

		it(
			"demonstrates fixture for complex workflow",
			async () => {
				// Harness fixtures capture the ENTIRE multi-agent conversation
				// This is powerful for testing complex workflows

				const result = await run(
					specKit,
					{
						prompt: `PRD: String Utilities
Create utilities for:
1. Checking if a string is empty
2. Trimming whitespace
3. Converting to uppercase`,
					},
					withFixture("level6-string-utils"),
				);

				expect(result.output).toBeDefined();
				expect(result.metrics).toBeDefined();

				const parsed = parseReviewerOutput(result.output as string);
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
 *   await run(agent, input, withFixture("test-opus"));
 *
 *   // Record with sonnet
 *   await run(agent, input, withFixture("test-sonnet"));
 *
 *   // Compare outputs
 *   expect(opusResult.output).not.toEqual(sonnetResult.output);
 *
 *
 * FIXTURE INSPECTION
 * ------------------
 * Fixtures are plain JSON, so you can inspect them:
 *
 *   cat fixtures/my-test_agent_inv0.json | jq '.output'
 *
 *
 * SELECTIVE RE-RECORDING
 * ----------------------
 * Delete a specific fixture and re-record:
 *
 *   rm fixtures/my-test_agent_inv0.json
 *   bun test:record -- --test-name-pattern="my specific test"
 */
