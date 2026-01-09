import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { parseReviewerOutput, reviewerAgent } from "./reviewer-agent";
import { specKit } from "./speckit-harness";

/**
 * Level 5 Tests: Full 3-Agent System
 *
 * Demonstrates:
 * - Complete PRD → Code → Review workflow
 * - Three-agent coordination
 * - Reviewer validation against specifications
 * - Aggregate metrics across all agents
 *
 * Note: Full harness execution involves 3 agent calls.
 * Tests may take 5-8 minutes due to Claude Code SDK overhead.
 * In production, use fixtures (Level 6) for fast CI runs.
 */
describe("SpecKit - Level 5 (Full 3-Agent System)", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	describe("Individual Agents", () => {
		it(
			"reviewer agent validates code against spec",
			async () => {
				const result = await run(reviewerAgent, {
					prompt: `Review this implementation:

Task: TASK-001 - Create Email Validator
Acceptance Criteria:
- Function returns true for valid emails
- Function returns false for invalid emails
- Handles edge cases (empty string, null)

Implemented Code:
\`\`\`javascript
function validateEmail(email) {
  if (!email) return false;
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}
\`\`\``,
				});

				const output = result.output as string;

				// Should have expected sections
				expect(output).toContain("CRITERIA VERIFICATION");
				expect(output.toUpperCase()).toContain("VERDICT");

				// Parse and verify
				const parsed = parseReviewerOutput(output);
				console.log("Reviewer verdict:", parsed.approved ? "APPROVED" : "REJECTED");
				console.log("Criteria checked:", parsed.criteriaResults.length);
				console.log("Issues found:", parsed.issues.length);

				expect(typeof parsed.approved).toBe("boolean");
			},
			{ timeout: 180000 },
		);
	});

	describe("Full Harness Execution", () => {
		it(
			"runs the complete spec → coder → reviewer workflow",
			async () => {
				const result = await run(specKit, {
					prompt: `PRD: Simple Calculator

Create a calculator module that:
1. Adds two numbers
2. Returns the sum

Keep it simple - just one function.`,
				});

				// Harness should complete
				expect(result.output).toBeDefined();

				// Output is from the last agent (reviewer)
				const output = result.output as string;
				expect(typeof output).toBe("string");

				// Should have reviewer output structure
				if (output.includes("VERDICT")) {
					console.log("Full workflow produced reviewer verdict");
					const parsed = parseReviewerOutput(output);
					console.log("Final verdict:", parsed.approved ? "APPROVED" : "REJECTED");
				}

				// Metrics are aggregated across all three agents
				expect(result.metrics).toBeDefined();
				expect(result.metrics.latencyMs).toBeGreaterThan(0);

				console.log("Full workflow metrics:", {
					latencyMs: result.metrics.latencyMs,
					tokens: result.metrics.tokens,
					cost: result.metrics.cost,
				});
			},
			{ timeout: 900000 }, // 15 min for full 3-agent workflow
		);

		it(
			"handles realistic PRD with multiple requirements",
			async () => {
				const result = await run(specKit, {
					prompt: `PRD: User Greeting Service

Requirements:
1. Create a function that greets users by name
2. Handle missing names gracefully
3. Support optional greeting customization`,
				});

				expect(result.output).toBeDefined();

				const output = result.output as string;

				// Parse the reviewer output
				const parsed = parseReviewerOutput(output);
				console.log("Multi-requirement PRD result:", {
					approved: parsed.approved,
					criteriaCount: parsed.criteriaResults.length,
					issueCount: parsed.issues.length,
				});

				// State should be defined
				expect(result.state).toBeDefined();
			},
			{ timeout: 900000 },
		);
	});
});

/**
 * Unit tests for parsing utilities
 */
describe("Parsing Utilities - Reviewer", () => {
	describe("parseReviewerOutput", () => {
		it("parses approved review", () => {
			const output = `## TASK_ID
TASK-001

## CRITERIA VERIFICATION
- Returns true for valid emails: MET - correctly validates format
- Returns false for invalid emails: MET - rejects malformed input
- Handles edge cases: MET - handles null and empty string

## ISSUES
No issues found.

## SUMMARY
The implementation correctly handles all acceptance criteria with proper edge case handling.

## VERDICT
APPROVED`;

			const result = parseReviewerOutput(output);

			expect(result.taskId).toBe("TASK-001");
			expect(result.approved).toBe(true);
			expect(result.criteriaResults.length).toBe(3);
			expect(result.criteriaResults.every((c) => c.met)).toBe(true);
			expect(result.issues.length).toBe(0);
		});

		it("parses rejected review with issues", () => {
			const output = `## TASK_ID
TASK-002

## CRITERIA VERIFICATION
- Validates input format: MET - uses regex
- Returns detailed errors: NOT_MET - only returns boolean

## ISSUES
- **major**: Missing detailed error messages → Add error type information
- **minor**: Could use stricter regex → Consider RFC 5322 compliance

## SUMMARY
The core validation works but lacks detailed error reporting as specified.

## VERDICT
REJECTED`;

			const result = parseReviewerOutput(output);

			expect(result.taskId).toBe("TASK-002");
			expect(result.approved).toBe(false);
			expect(result.criteriaResults.length).toBe(2);
			expect(result.criteriaResults.filter((c) => c.met).length).toBe(1);
			expect(result.issues.length).toBe(2);
			expect(result.issues[0]?.severity).toBe("major");
			expect(result.issues[1]?.severity).toBe("minor");
		});

		it("parses review with blocker issue", () => {
			const output = `## TASK_ID
TASK-003

## CRITERIA VERIFICATION
- Function exists: MET
- Function works: NOT_MET - throws error

## ISSUES
- **blocker**: Function throws TypeError on valid input → Fix type coercion

## SUMMARY
Critical bug prevents any valid use of the function.

## VERDICT
REJECTED`;

			const result = parseReviewerOutput(output);

			expect(result.approved).toBe(false);
			expect(result.issues.length).toBe(1);
			expect(result.issues[0]?.severity).toBe("blocker");
		});
	});
});
