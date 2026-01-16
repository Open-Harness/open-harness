/**
 * Debug Test
 *
 * Simple test to debug workflow issues.
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

let store: FileSignalStore;

beforeAll(async () => {
	await mkdir(FIXTURES_DIR, { recursive: true });
	store = new FileSignalStore({ baseDir: FIXTURES_DIR });
});

describe("Debug", () => {
	it(
		"runs workflow and logs state",
		async () => {
			const workflow = createPRDWorkflow();

			const harness = new ClaudeHarness({
				model: "claude-sonnet-4-20250514",
			});

			const result = await workflow.run(simplePRD, {
				harness,
				recording: {
					mode: "record" as const,
					store,
					name: "debug-test",
					tags: ["debug"],
				},
			});

			// Log detailed state for debugging
			console.log("=== WORKFLOW RESULT ===");
			console.log("Phase:", result.state.workflowPhase);
			console.log("Terminal Failure:", result.state.terminalFailure);
			console.log("Planning Phase:", result.state.planning.phase);
			console.log("Milestones:", result.state.planning.milestones.length);
			console.log("Task Queue:", result.state.planning.taskQueue);
			console.log("History Types:", result.state.history.map((h) => h.type));

			// If there are milestones, log them
			if (result.state.planning.milestones.length > 0) {
				console.log("First Milestone:", JSON.stringify(result.state.planning.milestones[0], null, 2));
			}

			// If there are tasks, log them
			const allTasks = Object.values(result.state.planning.allTasks);
			if (allTasks.length > 0) {
				console.log("First Task:", JSON.stringify(allTasks[0], null, 2));
			}

			// Just verify we got some result
			expect(result.state.workflowPhase).toBeDefined();
		},
		{ timeout: 180000 },
	);
});
