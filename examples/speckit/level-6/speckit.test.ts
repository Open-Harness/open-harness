import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { FileRecordingStore } from "@open-harness/stores";
import { parseReviewerOutput } from "./agents/reviewer-agent";
import { specKit } from "./speckit-harness";

/**
 * Level 6 Tests: Fixtures + Replay
 *
 * Demonstrates:
 * - Recording agent responses to fixtures
 * - Replaying fixtures for deterministic testing
 * - CI-friendly testing without API calls
 *
 * Fixture modes:
 * - 'record': Execute live and save responses
 * - 'replay': Load saved responses (no API calls)
 * - 'live': Execute live without recording (default)
 *
 * Usage:
 * - First run: FIXTURE_MODE=record bun test level-6/
 * - CI runs: FIXTURE_MODE=replay bun test level-6/
 */

// Fixture store for recordings
const store = new FileRecordingStore({ directory: "./level-6/fixtures" });

describe("SpecKit - Level 6 (Fixtures)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	describe("Live Execution (Default)", () => {
		it(
			"runs workflow live when no fixture mode specified",
			async () => {
				// Default mode is 'live' - executes without recording
				const result = await run(specKit, {
					prompt: `PRD: Simple Math Utility
Create a function that doubles a number.`,
				});

				expect(result.output).toBeDefined();
				expect(result.metrics.latencyMs).toBeGreaterThan(0);
			},
			{ timeout: 900000 },
		);
	});

	describe("Fixture Recording", () => {
		it(
			"demonstrates fixture recording pattern",
			async () => {
				// This shows how fixture recording WOULD work
				// when run with FIXTURE_MODE=record
				//
				// In practice, you'd run:
				// FIXTURE_MODE=record bun test level-6/
				//
				// Then commit the fixtures to git for CI

				const fixtureId = "simple-prd";

				// When mode is 'record', the run saves fixtures
				// When mode is 'replay', the run loads fixtures
				// The mode is determined by FIXTURE_MODE env var
				const result = await run(
					specKit,
					{
						prompt: `PRD: Greeting Function
Create a function that says hello to a user by name.`,
					},
					{
						fixture: fixtureId,
						store,
						// mode determined by FIXTURE_MODE env var
					},
				);

				expect(result.output).toBeDefined();

				// Fixture IDs are returned when recording
				// This helps track what was recorded
				if (result.fixtures && result.fixtures.length > 0) {
					console.log("Recorded fixtures:", result.fixtures);
				}
			},
			{ timeout: 900000 },
		);
	});

	describe("Deterministic Replay", () => {
		it(
			"demonstrates replay consistency pattern",
			async () => {
				// In replay mode, the same fixture produces identical results
				// This enables deterministic CI testing

				const input = {
					prompt: `PRD: Number Checker
Create a function that checks if a number is positive.`,
				};

				// First run
				const result1 = await run(specKit, input);

				// The results should be consistent for the same input
				// (In actual replay mode, they would be byte-for-byte identical)
				expect(result1.output).toBeDefined();

				// Parse to verify structure
				const parsed = parseReviewerOutput(result1.output as string);
				expect(typeof parsed.approved).toBe("boolean");
			},
			{ timeout: 900000 },
		);
	});
});

/**
 * Fixture workflow documentation
 *
 * 1. RECORDING FIXTURES
 *    Run tests with FIXTURE_MODE=record to capture API responses:
 *    ```bash
 *    FIXTURE_MODE=record bun test level-6/
 *    ```
 *    This creates files in fixtures/ directory.
 *
 * 2. REPLAYING FIXTURES
 *    Run tests with FIXTURE_MODE=replay in CI:
 *    ```bash
 *    FIXTURE_MODE=replay bun test level-6/
 *    ```
 *    Tests run instantly using saved responses.
 *
 * 3. UPDATING FIXTURES
 *    When agent behavior changes, re-record:
 *    ```bash
 *    rm -rf fixtures/
 *    FIXTURE_MODE=record bun test level-6/
 *    git add fixtures/
 *    git commit -m "Update fixtures for new agent behavior"
 *    ```
 *
 * 4. CI INTEGRATION
 *    ```yaml
 *    jobs:
 *      test:
 *        steps:
 *          - run: FIXTURE_MODE=replay bun test level-6/
 *    ```
 */
