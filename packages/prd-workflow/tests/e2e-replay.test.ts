/**
 * E2E Replay Test
 *
 * Tests the complete workflow using recorded signals.
 * This test validates reducers and workflow logic without real SDK calls.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "bun:test";
import { ClaudeHarness } from "@open-harness/core";
import { FileSignalStore } from "@open-harness/stores";
import { createPRDWorkflow } from "../src/workflow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "recordings", "debug");

let store: FileSignalStore;

beforeAll(async () => {
	await mkdir(FIXTURES_DIR, { recursive: true });
	store = new FileSignalStore({ baseDir: FIXTURES_DIR });
});

describe("E2E Replay", () => {
	it("replays successful workflow from recording", async () => {
		// Find the recording with structuredOutput
		const recordings = await store.list({ tags: ["debug"] });
		const recording = recordings.find(
			(r) => r.name === "debug-test" && r.signalCount > 0,
		);

		if (!recording) {
			console.warn("No valid recording found. Run debug.test.ts first to create a recording.");
			return;
		}

		console.log(`Found recording: ${recording.id} with ${recording.signalCount} signals`);

		const workflow = createPRDWorkflow();

		const harness = new ClaudeHarness({
			model: "claude-sonnet-4-20250514",
		});

		const result = await workflow.run(
			`
# Simple Feature: Add Function

Create a simple function that adds two numbers.

## Requirements
- Create a function called \`add(a, b)\` in a file called \`add.ts\`
- The function should accept two numbers and return their sum

## Acceptance Criteria
- Function exists and is exported
- Function returns correct sum for any two numbers
`,
			{
				harness,
				recording: {
					mode: "replay" as const,
					store,
					recordingId: recording.id,
				},
			},
		);

		// Log results
		console.log("=== REPLAY RESULTS ===");
		console.log("Phase:", result.state.workflowPhase);
		console.log("Terminal Failure:", result.state.terminalFailure);
		console.log("Milestones:", result.state.planning.milestones.length);
		console.log("History Types:", result.state.history.map((h) => h.type));

		// Verify workflow completed successfully
		expect(result.state.workflowPhase).toBe("complete");
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
	}, 60000);
});
