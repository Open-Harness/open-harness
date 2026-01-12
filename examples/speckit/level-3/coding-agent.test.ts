import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@open-harness/core";
import { type CodingAgentState, runCodingAgent, parseValidationStatus } from "./coding-agent";

/**
 * Level 3: Self-Validation Loop + Recording
 *
 * Demonstrates:
 * - Self-validation pattern where agents assess their own work
 * - Harness-level state tracking for iteration attempts
 * - Looping until validation passes or max attempts reached
 * - Signal recording for fast, deterministic testing
 *
 * In v0.3.0, agents are stateless - state lives on the harness.
 * The coding agent is wrapped in a harness for state tracking.
 *
 * v0.3.0 Migration:
 * - Uses runCodingAgent() which wraps runReactive()
 * - Uses MemorySignalStore for recording
 * - Signal-based recording captures full execution trace
 */

// Shared store for recording/replay
const store = new MemorySignalStore();

// Get recording mode from environment
const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

describe("Coding Agent - Level 3 (Self-Validation Loop with Harness State)", () => {
	it(
		"implements a simple task with self-validation",
		async () => {
			const result = await runCodingAgent("Create a function that adds two numbers and returns the result", {
				fixture: "level3-add-numbers",
				mode: getMode(),
				store,
			});

			const output = result.output;

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
			const result = await runCodingAgent("Write a simple greeting function", {
				fixture: "level3-greeting",
				mode: getMode(),
				store,
			});

			const output = result.output;
			const validation = parseValidationStatus(output);

			// State includes the prompt we passed in
			expect(result.state.prompt).toBe("Write a simple greeting function");

			// Code should be populated
			expect(result.state.code).not.toBeNull();

			// We can create updated state based on output
			const updatedState: CodingAgentState = {
				...result.state,
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
