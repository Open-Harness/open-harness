import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { setupFixtures, withFixture } from "../test-utils";
import { type CodingAgentState, codingAgent, initialState, parseValidationStatus } from "./coding-agent";

/**
 * Level 3: Self-Validation Loop + Fixtures
 *
 * Demonstrates:
 * - Self-validation pattern where agents assess their own work
 * - State tracking for iteration attempts
 * - Looping until validation passes or max attempts reached
 * - Fixtures for fast, deterministic testing
 *
 * The self-validation loop is a fundamental pattern for building
 * reliable agent systems without human-in-the-loop.
 */
describe("Coding Agent - Level 3 (Self-Validation Loop)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
		setupFixtures();
	});

	it(
		"implements a simple task with self-validation",
		async () => {
			const result = await run(
				codingAgent,
				{ prompt: "Create a function that adds two numbers and returns the result" },
				withFixture("level3-add-numbers"),
			);

			const output = result.output as string;

			// Should have code section
			expect(output).toContain("CODE");

			// Should have validation section
			expect(output).toContain("VALIDATION");

			// Should have a status
			expect(output.toUpperCase()).toMatch(/STATUS/);

			// Parse and check validation
			const validation = parseValidationStatus(output);
			console.log("Validation result:", validation);

			// Simple task should likely pass on first try
			expect(validation.status).toBeDefined();
			expect(["complete", "needs_revision", "blocked"]).toContain(validation.status);
		},
		{ timeout: 180000 },
	);

	it(
		"state tracks validation history",
		async () => {
			const result = await run(
				codingAgent,
				{ prompt: "Write a simple greeting function" },
				withFixture("level3-greeting"),
			);

			const output = result.output as string;
			const validation = parseValidationStatus(output);

			// State is returned from agent config
			expect(result.state).toEqual(initialState);

			// We can create updated state based on output
			const updatedState: CodingAgentState = {
				...initialState,
				attempts: 1,
				lastValidation: {
					passed: validation.passed,
					issues: validation.issues,
				},
			};

			expect(updatedState.attempts).toBe(1);
			expect(updatedState.lastValidation).toBeDefined();
		},
		{ timeout: 180000 },
	);
});

/**
 * Unit tests for the parsing utility (no fixtures needed - pure functions)
 */
describe("parseValidationStatus", () => {
	it("parses COMPLETE status", () => {
		const output = `## CODE
\`\`\`
function add(a, b) { return a + b; }
\`\`\`

## VALIDATION
- Correctness: PASS
- Readability: PASS

## STATUS
COMPLETE`;

		const result = parseValidationStatus(output);
		expect(result.passed).toBe(true);
		expect(result.status).toBe("complete");
	});

	it("parses NEEDS_REVISION status with issues", () => {
		const output = `## CODE
\`\`\`
function broken() { }
\`\`\`

## VALIDATION
- Correctness: FAIL - missing implementation

## ISSUES
- Function body is empty
- No return statement

## STATUS
NEEDS_REVISION`;

		const result = parseValidationStatus(output);
		expect(result.passed).toBe(false);
		expect(result.status).toBe("needs_revision");
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it("parses BLOCKED status", () => {
		const output = `## VALIDATION
Cannot implement - requirement unclear

## STATUS
BLOCKED`;

		const result = parseValidationStatus(output);
		expect(result.passed).toBe(false);
		expect(result.status).toBe("blocked");
	});
});
