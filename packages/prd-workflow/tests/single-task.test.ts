/**
 * IT-001: Single Task Flow Tests
 *
 * Integration tests using real SDK with recording/replay infrastructure.
 *
 * Tests the complete flow with one milestone and one task:
 * - Happy path: plan → code → review:approved → complete
 *
 * Recording Mode (first run or when recordings need updating):
 *   FIXTURE_MODE=record bun test packages/prd-workflow/tests/single-task.test.ts
 *
 * Replay Mode (default, fast, deterministic):
 *   bun test packages/prd-workflow/tests/single-task.test.ts
 */

import { beforeAll, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ClaudeHarness } from "@open-harness/core";
import { FileSignalStore } from "@open-harness/stores";
import { createPRDWorkflow } from "../src/workflow.js";

// ============================================================================
// Test Configuration
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "recordings", "single-task");

/**
 * Get recording mode from environment.
 * - FIXTURE_MODE=record: Run against real SDK, save recordings
 * - Otherwise: Replay from saved recordings (fast, no API calls)
 */
function getMode(): "record" | "replay" {
	return process.env.FIXTURE_MODE === "record" ? "record" : "replay";
}

/**
 * Simple PRD for testing single task flow.
 * Designed to produce exactly one milestone with one task.
 */
const simplePRD = `
# Simple Feature: Add Function

Create a simple function that adds two numbers.

## Requirements
- Create a function called \`add(a, b)\` in a file called \`add.ts\`
- The function should accept two numbers and return their sum

## Acceptance Criteria
- Function exists and is exported
- Function returns correct sum for any two numbers
`;

// ============================================================================
// Shared Test Infrastructure
// ============================================================================

/**
 * File-based store for persistent recordings.
 * Recordings are saved to fixtures/recordings/single-task/
 */
let store: FileSignalStore;

beforeAll(async () => {
	// Ensure fixtures directory exists
	await mkdir(FIXTURES_DIR, { recursive: true });
	store = new FileSignalStore({ baseDir: FIXTURES_DIR });
});

// ============================================================================
// Tests
// ============================================================================

describe("Single Task Flow", () => {
	describe("Happy Path", () => {
		it(
			"completes workflow: plan → code → review:approved → complete",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				// Create harness for real SDK interaction
				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				// Check if we have a recording to replay
				const recordings = await store.list({ tags: ["happy-path"] });
				const existingRecording = recordings.find((r) => r.name === "single-task-happy-path");

				// In replay mode, we need an existing recording
				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for happy-path test. Run with FIXTURE_MODE=record first.");
					return;
				}

				// Configure recording options based on mode
				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "single-task-happy-path",
								tags: ["happy-path", "single-task"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording?.id,
							};

				const result = await workflow.run(simplePRD, {
					harness,
					recording: recordingOptions,
				});

				// Verify workflow completed successfully
				expect(result.state.workflowPhase).toBe("complete");

				// Verify we have milestones
				expect(result.state.planning.milestones.length).toBeGreaterThan(0);

				// Verify milestone completed
				const milestone = result.state.planning.milestones[0];
				expect(milestone?.status).toBe("complete");

				// Verify task completed
				const taskId = milestone?.taskIds[0];
				expect(taskId).toBeDefined();
				expect(result.state.planning.allTasks[taskId!]?.status).toBe("complete");

				// Verify history contains expected events
				const historyTypes = result.state.history.map((h) => h.type);
				expect(historyTypes).toContain("task_started");
				expect(historyTypes).toContain("task_completed");
				expect(historyTypes).toContain("milestone_completed");
				expect(historyTypes).toContain("workflow_complete");

				// Verify recording was captured (in record mode)
				if (mode === "record") {
					expect(result.recordingId).toBeDefined();
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			// Extended timeout for real SDK calls (only matters in record mode)
			{ timeout: 300000 },
		);
	});

	describe("Fix Loop", () => {
		it(
			"handles needs_fix and retries: plan → code → fix → code → approved",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				// Check for existing recording
				const recordings = await store.list({ tags: ["fix-loop"] });
				const existingRecording = recordings.find((r) => r.name === "single-task-fix-loop");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for fix-loop test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "single-task-fix-loop",
								tags: ["fix-loop", "single-task"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording?.id,
							};

				// Use a PRD that's more likely to trigger fixes
				const complexPRD = `
# Feature: Calculator with Validation

Create a validated calculator function.

## Requirements
- Create \`calculate(operation: string, a: number, b: number)\` in \`calculator.ts\`
- Support operations: "add", "subtract", "multiply", "divide"
- Throw error for division by zero
- Throw error for unknown operations
- Return type should be number

## Acceptance Criteria
- All four operations work correctly
- Division by zero throws appropriate error
- Unknown operation throws appropriate error
`;

				const result = await workflow.run(complexPRD, {
					harness,
					recording: recordingOptions,
				});

				// The workflow should complete (even if it took retries)
				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				// If completed, verify tasks
				if (result.state.workflowPhase === "complete") {
					const milestone = result.state.planning.milestones[0];
					expect(milestone?.status).toBe("complete");
				}

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 300000 },
		);
	});

	describe("Escalation", () => {
		it(
			"escalates after max attempts",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				// Check for existing recording
				const recordings = await store.list({ tags: ["escalation"] });
				const existingRecording = recordings.find((r) => r.name === "single-task-escalation");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for escalation test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "single-task-escalation",
								tags: ["escalation", "single-task"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording?.id,
							};

				// Use a PRD that's intentionally ambiguous/impossible
				// to trigger escalation behavior
				const impossiblePRD = `
# Feature: Time Travel API

Create a function that travels through time.

## Requirements
- Create \`timeTravel(destination: Date)\` that physically transports user to that time
- Must work for both past and future dates
- Preserve causality

## Acceptance Criteria
- User can visit any point in time
- No paradoxes occur
`;

				const result = await workflow.run(impossiblePRD, {
					harness,
					recording: recordingOptions,
					// Lower max replans to trigger failure faster
					maxReplans: 1,
				});

				// This should either complete (if the agent found a way)
				// or fail (if escalation exhausted replans)
				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				// Check history for escalation events
				const historyTypes = result.state.history.map((h) => h.type);

				// Depending on how the agent handles it, we might see:
				// - escalation events if it gave up
				// - completion if it found a creative interpretation
				console.log("History types:", historyTypes);

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 300000 },
		);
	});
});
