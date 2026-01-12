import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@open-harness/core";
import { parseCodingOutput } from "./coding-agent";
import { parseSpecOutput } from "./spec-agent";
import { runSpecKit } from "./speckit-harness";

/**
 * Level 4: Multi-Agent Harness
 *
 * Demonstrates:
 * - Creating a harness with multiple agents
 * - Signal-based control flow (replaces edges)
 * - Shared state between agents
 * - Recording/replay for fast, deterministic testing
 *
 * v0.3.0 Reactive Pattern:
 * - Old: edges: [{ from: "spec", to: "coder" }]
 * - New: spec emits: ["spec:complete"], coder activateOn: ["spec:complete"]
 */

// Shared store for recording/replay
const store = new MemorySignalStore();

// Get recording mode from environment
const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

describe("SpecKit Harness - Level 4 (Multi-Agent with Signal Chaining)", () => {
	describe("Harness Execution", () => {
		it(
			"runs the full spec → coder workflow via signal chaining",
			async () => {
				const result = await runSpecKit(
					`PRD: Email Validation Utility

Create a simple email validation function that:
1. Validates email format using regex
2. Returns true/false`,
					{
						fixture: "level4-harness-email",
						mode: getMode(),
						store,
					},
				);

				// Harness should complete
				expect(result.output).toBeDefined();

				// Output is from the last agent (coder)
				const output = result.output;
				expect(typeof output).toBe("string");

				// Should have meaningful output from coder
				console.log("Harness produced output:", output.slice(0, 100) + "...");
				expect(output.length).toBeGreaterThan(50);

				// Metrics are available
				expect(result.metrics).toBeDefined();
				expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);

				console.log("Harness metrics:", {
					latencyMs: result.metrics.latencyMs,
					activations: result.metrics.activations,
				});

				// Signals tracked the execution flow
				expect(result.signals).toBeDefined();
				console.log("Signals emitted:", result.signals.length);
			},
			{ timeout: 600000 },
		);

		it(
			"spec agent produces tasks that coder agent processes",
			async () => {
				const result = await runSpecKit(
					`PRD: User Authentication

Users should be able to:
1. Register with email and password
2. Login with existing credentials`,
					{
						fixture: "level4-harness-auth",
						mode: getMode(),
						store,
					},
				);

				// Spec agent output should have tasks
				const specOutput = result.specOutput;
				expect(specOutput).toContain("TASK-");

				const parsedSpec = parseSpecOutput(specOutput);
				console.log("Spec Agent produced", parsedSpec.tasks.length, "tasks");
				expect(parsedSpec.tasks.length).toBeGreaterThan(0);

				// Coder output should reference a task
				const coderOutput = result.coderOutput;
				expect(coderOutput).toContain("CODE");

				const parsedCoder = parseCodingOutput(coderOutput);
				console.log("Coder Agent status:", parsedCoder.status);
				expect(["complete", "needs_revision", "blocked"]).toContain(parsedCoder.status);
			},
			{ timeout: 600000 },
		);
	});
});

/**
 * Unit tests for parsing utilities (no fixtures needed - pure functions)
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
