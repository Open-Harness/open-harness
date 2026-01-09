import { beforeAll, describe, expect, it } from "bun:test";
import { type Provider, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";
import { codingAgent, parseCodingOutput } from "./coding-agent";
import { parseSpecOutput, specAgent } from "./spec-agent";
import { specKit } from "./speckit-harness";

/**
 * Level 4 Tests: Multi-Agent Harness
 *
 * Demonstrates:
 * - Creating a harness with multiple agents
 * - Running a harness workflow
 * - Shared state between agents
 * - Edge conditions for control flow
 *
 * Note: Harness execution involves multiple agent calls.
 * Tests may take 4-6 minutes due to Claude Code SDK overhead.
 * In production, use fixtures (Level 6) for fast CI runs.
 */
describe("SpecKit Harness - Level 4", () => {
	beforeAll(() => {
		setDefaultProvider(createClaudeNode() as unknown as Provider);
	});

	describe("Individual Agents", () => {
		it(
			"spec agent breaks down a PRD into tasks",
			async () => {
				const result = await run(specAgent, {
					prompt: `PRD: User Authentication

Users should be able to:
1. Register with email and password
2. Login with existing credentials
3. Reset their password via email link`,
				});

				const output = result.output as string;

				// Should have task structure
				expect(output).toContain("TASK-");
				expect(output).toContain("Priority");
				expect(output).toContain("Acceptance Criteria");

				// Parse and verify
				const parsed = parseSpecOutput(output);
				console.log("Spec Agent produced", parsed.tasks.length, "tasks");

				expect(parsed.tasks.length).toBeGreaterThan(0);
				expect(parsed.tasks[0]?.id).toMatch(/TASK-\d+/);
				expect(parsed.tasks[0]?.acceptanceCriteria.length).toBeGreaterThan(0);
			},
			{ timeout: 180000 },
		);

		it(
			"coding agent implements a task with validation",
			async () => {
				const result = await run(codingAgent, {
					prompt: `Implement this task:

ID: TASK-001
Title: Create Email Validator Function
Description: Implement a function that validates email format
Acceptance Criteria:
- Function returns true for valid emails
- Function returns false for invalid emails
- Handles edge cases (empty string, null)`,
				});

				const output = result.output as string;

				// Should have expected sections
				expect(output).toContain("CODE");
				expect(output).toContain("VALIDATION");
				expect(output.toUpperCase()).toContain("STATUS");

				// Parse and verify
				const parsed = parseCodingOutput(output);
				console.log("Coding Agent status:", parsed.status);

				expect(parsed.code.length).toBeGreaterThan(0);
				expect(["complete", "needs_revision", "blocked"]).toContain(parsed.status);
			},
			{ timeout: 180000 },
		);
	});

	describe("Harness Execution", () => {
		it(
			"runs the full spec → coder workflow",
			async () => {
				const result = await run(specKit, {
					prompt: `PRD: Email Validation Utility

Create a simple email validation function that:
1. Validates email format using regex
2. Returns true/false`,
				});

				// Harness should complete
				expect(result.output).toBeDefined();

				// Output is from the last agent (coder)
				const output = result.output as string;
				expect(typeof output).toBe("string");

				// Should have code from coder
				if (output.includes("CODE")) {
					console.log("Harness produced code output");
					expect(output).toContain("```");
				}

				// Metrics are aggregated across all agents
				expect(result.metrics).toBeDefined();
				expect(result.metrics.latencyMs).toBeGreaterThan(0);

				console.log("Harness metrics:", {
					latencyMs: result.metrics.latencyMs,
					tokens: result.metrics.tokens,
				});
			},
			{ timeout: 600000 }, // 10 min for multi-agent
		);
	});
});

/**
 * Unit tests for parsing utilities
 */
describe("Parsing Utilities", () => {
	describe("parseSpecOutput", () => {
		it("parses task list correctly", () => {
			const output = `## TASKS

### TASK-001: Create User Model
**Priority:** 1
**Complexity:** simple
**Description:** Define the user data model with email and password fields.
**Acceptance Criteria:**
- User model has email field
- User model has password field
- Password is hashed before storage

### TASK-002: Implement Registration
**Priority:** 2
**Complexity:** medium
**Description:** Create registration endpoint that accepts email and password.
**Acceptance Criteria:**
- Validates email format
- Validates password strength
- Returns success or error

## SUMMARY
Total tasks: 2
By priority: 1 high, 1 medium
By complexity: 1 simple, 1 medium

## STATUS
COMPLETE`;

			const result = parseSpecOutput(output);

			expect(result.tasks.length).toBe(2);
			expect(result.tasks[0]?.id).toBe("TASK-001");
			expect(result.tasks[0]?.title).toBe("Create User Model");
			expect(result.tasks[0]?.priority).toBe(1);
			expect(result.tasks[0]?.complexity).toBe("simple");
			expect(result.tasks[0]?.acceptanceCriteria.length).toBe(3);
			expect(result.status).toBe("complete");
		});
	});

	describe("parseCodingOutput", () => {
		it("parses complete output", () => {
			const output = `## TASK_ID
TASK-001

## CODE
\`\`\`javascript
function validateEmail(email) {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}
\`\`\`

## VALIDATION
- Returns true for valid emails: PASS
- Returns false for invalid emails: PASS
- Handles edge cases: PASS

## STATUS
COMPLETE`;

			const result = parseCodingOutput(output);

			expect(result.taskId).toBe("TASK-001");
			expect(result.code).toContain("validateEmail");
			expect(result.validation.passed).toBe(true);
			expect(result.status).toBe("complete");
		});

		it("parses needs_revision output", () => {
			const output = `## TASK_ID
TASK-002

## CODE
\`\`\`javascript
function broken() {
  // TODO: implement
}
\`\`\`

## VALIDATION
- Validates input: FAIL - not implemented
- Returns result: FAIL - no return statement

## ISSUES
- Function body is empty
- No error handling

## STATUS
NEEDS_REVISION`;

			const result = parseCodingOutput(output);

			expect(result.taskId).toBe("TASK-002");
			expect(result.validation.passed).toBe(false);
			expect(result.validation.issues.length).toBeGreaterThan(0);
			expect(result.status).toBe("needs_revision");
		});
	});
});
