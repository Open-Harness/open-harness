import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { type CodingAgentState, codingAgent, initialState, parseValidationStatus } from "./coding-agent";

/**
 * Level 3 Tests: Coding Agent with Self-Validation Loop
 *
 * Demonstrates:
 * - Self-validation pattern where agents assess their own work
 * - State tracking for iteration attempts
 * - Looping until validation passes or max attempts reached
 *
 * The self-validation loop is a fundamental pattern for building
 * reliable agent systems without human-in-the-loop.
 *
 * Note: Claude Code SDK tests can take 2-3 minutes due to subprocess overhead.
 * In production, use fixtures (Level 6) for fast CI runs.
 */
describe("Coding Agent - Level 3 (Self-Validation Loop)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	it(
		"implements a simple task with self-validation",
		async () => {
			const result = await run(codingAgent, {
				prompt: "Create a function that adds two numbers and returns the result",
			});

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
		"demonstrates self-validation loop pattern",
		async () => {
			// This test shows the iteration pattern explicitly
			// In a real harness (Level 4+), this loop would be handled by edges

			let state: CodingAgentState = { ...initialState };
			let lastOutput = "";
			let iterations = 0;

			// Complex task that may require revision
			const task =
				"Create a password strength validator that checks: length >= 8, uppercase, lowercase, number, special char";

			while (iterations < state.maxAttempts) {
				iterations++;
				state = { ...state, attempts: iterations };

				// Build prompt with any previous issues
				let prompt = task;
				if (state.lastValidation && state.lastValidation.issues.length > 0) {
					prompt += `\n\nPrevious attempt had these issues to fix:\n${state.lastValidation.issues.map((i) => `- ${i}`).join("\n")}`;
				}

				const result = await run(codingAgent, { prompt });
				lastOutput = result.output as string;

				const validation = parseValidationStatus(lastOutput);
				console.log(`Attempt ${iterations}:`, validation.status);

				// Update state with validation result
				state = {
					...state,
					lastValidation: {
						passed: validation.passed,
						issues: validation.issues,
					},
				};

				// Exit loop if validation passed
				if (validation.passed) {
					console.log(`Completed after ${iterations} attempt(s)`);
					break;
				}
			}

			// Should have made at least one attempt
			expect(iterations).toBeGreaterThanOrEqual(1);
			expect(iterations).toBeLessThanOrEqual(state.maxAttempts);

			// Should have produced code
			expect(lastOutput).toContain("CODE");

			// State should reflect attempts
			expect(state.attempts).toBe(iterations);
		},
		{ timeout: 600000 }, // 10 min for up to 3 iterations
	);

	it(
		"state tracks validation history",
		async () => {
			const result = await run(codingAgent, {
				prompt: "Write a simple greeting function",
			});

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
 * Unit tests for the parsing utility
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
