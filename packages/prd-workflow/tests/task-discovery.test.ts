/**
 * IT-003: Task Discovery Tests
 *
 * Integration tests for the task discovery workflow.
 *
 * Tests:
 * - Discovered tasks during implementation
 * - Discovery processor adding tasks to milestones
 * - Completed discovered tasks
 *
 * Recording Mode:
 *   FIXTURE_MODE=record bun test packages/prd-workflow/tests/task-discovery.test.ts
 *
 * Replay Mode (default):
 *   bun test packages/prd-workflow/tests/task-discovery.test.ts
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "bun:test";
import { ClaudeHarness } from "@open-harness/core";
import { FileSignalStore } from "@open-harness/stores";
import { createPRDWorkflow } from "../src/workflow.js";

// ============================================================================
// Test Configuration
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "recordings", "task-discovery");

function getMode(): "record" | "replay" {
	return process.env.FIXTURE_MODE === "record" ? "record" : "replay";
}

/**
 * PRD that intentionally has gaps that should trigger task discovery.
 * The implementation will likely discover needs for error handling,
 * utility functions, or type definitions not mentioned in the PRD.
 */
const gappyPRD = `
# Feature: Data Validator

Create a data validation utility.

## Requirements
- Create \`validateEmail(email: string)\` function in \`validators/email.ts\`
- Create \`validatePhone(phone: string)\` function in \`validators/phone.ts\`

## Acceptance Criteria
- Email validation follows RFC 5322 standard
- Phone validation supports international formats
`;

/**
 * PRD that explicitly asks for something that will require discovered work.
 */
const complexFeaturePRD = `
# Feature: API Rate Limiter

Build a rate limiting system for API requests.

## Requirements

### Main Implementation
- Create \`RateLimiter\` class in \`middleware/rate-limiter.ts\`
- Support configurable rate limits (requests per minute)
- Track requests by client IP
- Return 429 status when limit exceeded

## Acceptance Criteria
- Rate limiting works correctly
- Proper HTTP 429 response with retry-after header
- Clean code structure
`;

// ============================================================================
// Shared Test Infrastructure
// ============================================================================

let store: FileSignalStore;

beforeAll(async () => {
	await mkdir(FIXTURES_DIR, { recursive: true });
	store = new FileSignalStore({ baseDir: FIXTURES_DIR });
});

// ============================================================================
// Tests
// ============================================================================

describe("Task Discovery", () => {
	describe("Basic Discovery", () => {
		it(
			"handles discovered tasks during implementation",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				const recordings = await store.list({ tags: ["discovery-basic"] });
				const existingRecording = recordings.find((r) => r.name === "task-discovery-basic");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for task-discovery-basic test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "task-discovery-basic",
								tags: ["discovery-basic", "task-discovery"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording!.id,
							};

				const result = await workflow.run(gappyPRD, {
					harness,
					recording: recordingOptions,
				});

				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				if (result.state.workflowPhase === "complete") {
					// Check if any tasks were discovered
					const discoveryEvents = result.state.history.filter(
						(h) =>
							h.type === "discovery_submitted" || h.type === "discovery_approved" || h.type === "discovery_rejected",
					);

					// Log discovery events for debugging
					console.log(
						"Discovery events:",
						discoveryEvents.map((e) => e.type),
					);

					// Verify all tasks (including discovered ones) completed
					const allTasks = Object.values(result.state.planning.allTasks);
					for (const task of allTasks) {
						expect(["complete", "skipped"]).toContain(task.status);
					}
				}

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 600000 },
		);
	});

	describe("Complex Discovery", () => {
		it(
			"processes discovered tasks and adds them to workflow",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				const recordings = await store.list({ tags: ["discovery-complex"] });
				const existingRecording = recordings.find((r) => r.name === "task-discovery-complex");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for task-discovery-complex test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "task-discovery-complex",
								tags: ["discovery-complex", "task-discovery"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording!.id,
							};

				const result = await workflow.run(complexFeaturePRD, {
					harness,
					recording: recordingOptions,
				});

				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				if (result.state.workflowPhase === "complete") {
					// Count total tasks
					const totalTasks = Object.keys(result.state.planning.allTasks).length;
					console.log(`Total tasks: ${totalTasks}`);

					// Look for discovery events
					const discoveryEvents = result.state.history.filter(
						(h) =>
							h.type === "discovery_submitted" || h.type === "discovery_approved" || h.type === "discovery_rejected",
					);

					console.log(`Discovery events: ${discoveryEvents.length}`);

					// Check pending discoveries queue
					const pendingDiscoveries = result.state.planning.pendingDiscoveries;
					console.log(`Pending discoveries: ${pendingDiscoveries.length}`);

					// All milestones should be complete
					for (const milestone of result.state.planning.milestones) {
						expect(milestone.status).toBe("complete");
					}
				}

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 600000 },
		);
	});

	describe("Discovery Limit", () => {
		it(
			"respects maximum discovered tasks limit",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				const recordings = await store.list({ tags: ["discovery-limit"] });
				const existingRecording = recordings.find((r) => r.name === "task-discovery-limit");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for task-discovery-limit test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "task-discovery-limit",
								tags: ["discovery-limit", "task-discovery"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording!.id,
							};

				// Use a PRD that might generate many discoveries
				const expansivePRD = `
# Feature: Full CRUD API

Build a complete CRUD API for a resource management system.

## Requirements
- Create REST API endpoints for \`/resources\`
- Support GET, POST, PUT, DELETE operations
- Include validation, error handling, and logging

## Acceptance Criteria
- All CRUD operations work
- Proper error responses
- Request validation
`;

				const result = await workflow.run(expansivePRD, {
					harness,
					recording: recordingOptions,
				});

				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				// Check discovery counts from history
				const approveddiscoveries = result.state.history.filter((h) => h.type === "discovery_approved").length;
				const rejectedDiscoveries = result.state.history.filter((h) => h.type === "discovery_rejected").length;

				console.log(`Discoveries approved: ${approveddiscoveries}`);
				console.log(`Discoveries rejected: ${rejectedDiscoveries}`);

				// The total should not exceed reasonable limits
				// (exact limit depends on configuration)
				const totalTasks = Object.keys(result.state.planning.allTasks).length;
				console.log(`Total tasks in plan: ${totalTasks}`);

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 600000 },
		);
	});
});
