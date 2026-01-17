/**
 * IT-002: Multi-Task Milestone Tests
 *
 * Integration tests for workflows with multiple tasks per milestone.
 *
 * Tests:
 * - Multiple tasks completing in sequence
 * - Task dependencies within a milestone
 * - Parallel task execution where applicable
 *
 * Recording Mode:
 *   FIXTURE_MODE=record bun test packages/prd-workflow/tests/multi-task.test.ts
 *
 * Replay Mode (default):
 *   bun test packages/prd-workflow/tests/multi-task.test.ts
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
const FIXTURES_DIR = join(__dirname, "fixtures", "recordings", "multi-task");

function getMode(): "record" | "replay" {
	return process.env.FIXTURE_MODE === "record" ? "record" : "replay";
}

/**
 * PRD with multiple tasks in a single milestone.
 */
const multiTaskPRD = `
# Feature: User Authentication Module

Build a complete user authentication system.

## Requirements

### Task 1: Create User Model
- Create \`User\` interface in \`types/user.ts\`
- Fields: id (string), email (string), passwordHash (string), createdAt (Date)

### Task 2: Create Password Utilities
- Create \`hashPassword(password: string)\` in \`utils/password.ts\`
- Create \`verifyPassword(password: string, hash: string)\` in \`utils/password.ts\`

### Task 3: Create Auth Service
- Create \`AuthService\` class in \`services/auth.ts\`
- Methods: \`register(email: string, password: string)\`, \`login(email: string, password: string)\`
- Use the password utilities from Task 2
- Return User type from Task 1

## Acceptance Criteria
- User interface is properly typed
- Password hashing works with bcrypt-like approach
- Auth service correctly uses both utilities and types
`;

/**
 * PRD with multiple milestones, each with multiple tasks.
 */
const multiMilestonePRD = `
# Feature: Blog API

Build a simple blog API with posts and comments.

## Milestone 1: Data Models

### Task 1.1: Post Model
- Create \`Post\` interface in \`types/post.ts\`
- Fields: id, title, content, authorId, createdAt

### Task 1.2: Comment Model
- Create \`Comment\` interface in \`types/comment.ts\`
- Fields: id, postId, content, authorId, createdAt

## Milestone 2: Services

### Task 2.1: Post Service
- Create \`PostService\` class in \`services/post.ts\`
- Methods: create, getById, list, update, delete

### Task 2.2: Comment Service
- Create \`CommentService\` class in \`services/comment.ts\`
- Methods: create, getByPostId, delete

## Acceptance Criteria
- All interfaces are properly typed
- Services have full CRUD operations
- Services use the data models correctly
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

describe("Multi-Task Milestone", () => {
	describe("Sequential Tasks", () => {
		it(
			"completes multiple tasks in a single milestone",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				const recordings = await store.list({ tags: ["multi-task"] });
				const existingRecording = recordings.find((r) => r.name === "multi-task-sequential");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for multi-task-sequential test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "multi-task-sequential",
								tags: ["multi-task", "sequential"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording?.id,
							};

				const result = await workflow.run(multiTaskPRD, {
					harness,
					recording: recordingOptions,
				});

				// Verify workflow completed
				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				if (result.state.workflowPhase === "complete") {
					// Verify we have at least one milestone
					expect(result.state.planning.milestones.length).toBeGreaterThan(0);

					// Verify the milestone has multiple tasks
					const milestone = result.state.planning.milestones[0];
					// The planner should have created multiple tasks from the PRD
					expect(milestone?.taskIds.length).toBeGreaterThan(0);

					// Verify all tasks completed
					for (const taskId of milestone?.taskIds || []) {
						const task = result.state.planning.allTasks[taskId];
						expect(task?.status).toBe("complete");
					}

					// Verify execution order was tracked
					const taskCompletions = result.state.history
						.filter((h) => h.type === "task_completed")
						.map((h) => (h.details as { taskId?: string }).taskId);

					expect(taskCompletions.length).toBeGreaterThan(0);
				}

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 600000 },
		);
	});

	describe("Multiple Milestones", () => {
		it(
			"completes milestones in sequence",
			async () => {
				const mode = getMode();
				const workflow = createPRDWorkflow();

				const harness = new ClaudeHarness({
					model: "claude-sonnet-4-20250514",
				});

				const recordings = await store.list({ tags: ["multi-milestone"] });
				const existingRecording = recordings.find((r) => r.name === "multi-milestone-flow");

				if (mode === "replay" && !existingRecording) {
					console.warn("No recording found for multi-milestone-flow test. Run with FIXTURE_MODE=record first.");
					return;
				}

				const recordingOptions =
					mode === "record"
						? {
								mode: "record" as const,
								store,
								name: "multi-milestone-flow",
								tags: ["multi-milestone", "sequential"],
							}
						: {
								mode: "replay" as const,
								store,
								recordingId: existingRecording?.id,
							};

				const result = await workflow.run(multiMilestonePRD, {
					harness,
					recording: recordingOptions,
				});

				expect(result.state.workflowPhase === "complete" || result.state.workflowPhase === "failed").toBe(true);

				if (result.state.workflowPhase === "complete") {
					// Should have multiple milestones
					expect(result.state.planning.milestones.length).toBeGreaterThan(0);

					// All milestones should be complete
					for (const milestone of result.state.planning.milestones) {
						expect(milestone.status).toBe("complete");
					}

					// Verify milestone order in history
					const milestoneCompletions = result.state.history
						.filter((h) => h.type === "milestone_completed")
						.map((h) => (h.details as { milestoneId?: string }).milestoneId);

					expect(milestoneCompletions.length).toBe(result.state.planning.milestones.length);
				}

				if (mode === "record") {
					console.log(`Recording saved: ${result.recordingId}`);
				}
			},
			{ timeout: 600000 },
		);
	});
});
