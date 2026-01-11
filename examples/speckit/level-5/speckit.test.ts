import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@open-harness/core";
import { parseCodingOutput } from "./coding-agent";
import { parseReviewerOutput } from "./reviewer-agent";
import { parseSpecOutput } from "./spec-agent";
import { runSpecKit } from "./speckit-harness";

/**
 * Level 5: Full 3-Agent System
 *
 * Demonstrates:
 * - Complete PRD → Code → Review workflow
 * - Three-agent coordination via signal chaining
 * - Reviewer validation against specifications
 * - Aggregate metrics across all agents
 * - Recording/replay for fast, deterministic testing
 *
 * v0.3.0 Reactive Pattern:
 * - Old: edges: [{ from: "spec", to: "coder" }, { from: "coder", to: "reviewer" }]
 * - New: Signal chaining - spec emits → coder activateOn → reviewer activateOn
 */

// Shared store for recording/replay
const store = new MemorySignalStore();

// Get recording mode from environment
const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

describe("SpecKit - Level 5 (Full 3-Agent System)", () => {
	describe("Full Harness Execution", () => {
		it(
			"runs the complete spec → coder → reviewer workflow",
			async () => {
				const result = await runSpecKit(
					`PRD: Simple Calculator

Create a calculator module that:
1. Adds two numbers
2. Returns the sum

Keep it simple - just one function.`,
					{
						fixture: "level5-harness-calculator",
						mode: getMode(),
						store,
					},
				);

				// Harness should complete
				expect(result.output).toBeDefined();

				// Output is from the last agent (reviewer)
				const output = result.output;
				expect(typeof output).toBe("string");

				// Should have reviewer output structure
				if (output.includes("VERDICT")) {
					console.log("Full workflow produced reviewer verdict");
					const parsed = parseReviewerOutput(output);
					console.log("Final verdict:", parsed.approved ? "APPROVED" : "REJECTED");
				}

				// Metrics are aggregated across all three agents
				expect(result.metrics).toBeDefined();
				expect(result.metrics.latencyMs).toBeGreaterThanOrEqual(0);

				console.log("Full workflow metrics:", {
					latencyMs: result.metrics.latencyMs,
					activations: result.metrics.activations,
				});

				// Signals tracked the execution flow
				expect(result.signals).toBeDefined();
				console.log("Signals emitted:", result.signals.length);
			},
			{ timeout: 900000 },
		);

		it(
			"handles realistic PRD with multiple requirements",
			async () => {
				const result = await runSpecKit(
					`PRD: User Greeting Service

Requirements:
1. Create a function that greets users by name
2. Handle missing names gracefully
3. Support optional greeting customization`,
					{
						fixture: "level5-harness-greeting",
						mode: getMode(),
						store,
					},
				);

				expect(result.output).toBeDefined();

				// All three agent outputs should be populated
				expect(result.specOutput.length).toBeGreaterThan(0);
				expect(result.coderOutput.length).toBeGreaterThan(0);
				expect(result.reviewerOutput.length).toBeGreaterThan(0);

				// Parse each agent's output
				const specParsed = parseSpecOutput(result.specOutput);
				console.log("Spec produced", specParsed.tasks.length, "tasks");

				const coderParsed = parseCodingOutput(result.coderOutput);
				console.log("Coder status:", coderParsed.status);

				const reviewerParsed = parseReviewerOutput(result.reviewerOutput);
				console.log("Reviewer result:", {
					approved: reviewerParsed.approved,
					criteriaCount: reviewerParsed.criteriaResults.length,
					issueCount: reviewerParsed.issues.length,
				});

				// State should be defined
				expect(result.state).toBeDefined();
			},
			{ timeout: 900000 },
		);
	});
});

/**
 * Unit tests for parsing utilities (no fixtures needed - pure functions)
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
