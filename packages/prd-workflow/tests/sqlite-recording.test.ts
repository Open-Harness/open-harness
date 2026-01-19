/**
 * SqliteSignalStore Integration Test
 *
 * Tests recording and replay functionality using SqliteSignalStore
 * for persistent storage. Key assertions:
 *
 * 1. Record mode saves signals to SQLite database
 * 2. Replay mode loads signals correctly from database
 * 3. Recording persists across store instances (process restart simulation)
 * 4. Replay produces same state as original recording
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createSignal,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";
import { SqliteSignalStore } from "@open-harness/stores";
import { createPRDWorkflow, runPRDWorkflow } from "../src/index.js";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a deterministic mock harness for testing
 */
function createDeterministicMockHarness(plannerOutput: {
	tasks: Array<{ id: string; title: string; status: string }>;
	milestones: Array<{ id: string; taskIds: string[] }>;
	taskOrder: string[];
}): Harness {
	const content = JSON.stringify(plannerOutput);
	return {
		type: "mock",
		displayName: "Deterministic Mock Harness",
		capabilities: {
			streaming: false,
			structuredOutput: true,
			tools: false,
			resume: false,
		},
		async *run(_input: HarnessInput, _ctx: RunContext): AsyncGenerator<Signal, HarnessOutput> {
			yield createSignal("harness:start", { input: _input });
			yield createSignal("text:delta", { content: "Planning tasks..." });
			yield createSignal("text:complete", { content });
			yield createSignal("harness:end", {
				output: { content, ...plannerOutput },
				durationMs: 10,
			});
			return { content, ...plannerOutput };
		},
	};
}

/**
 * Create a simple mock harness that just completes immediately
 */
function createSimpleMockHarness(): Harness {
	return {
		type: "mock",
		displayName: "Simple Mock Harness",
		capabilities: {
			streaming: false,
			structuredOutput: false,
			tools: false,
			resume: false,
		},
		async *run(_input: HarnessInput, _ctx: RunContext): AsyncGenerator<Signal, HarnessOutput> {
			yield createSignal("harness:start", { input: _input });
			yield createSignal("text:complete", { content: "Done" });
			yield createSignal("harness:end", {
				output: { content: "Done" },
				durationMs: 1,
			});
			return { content: "Done" };
		},
	};
}

// ============================================================================
// Test Suite
// ============================================================================

describe("SqliteSignalStore Integration", () => {
	let dbPath: string;
	let store: SqliteSignalStore;

	beforeEach(() => {
		// Create temp database file for each test
		dbPath = join(tmpdir(), `test-prd-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
		store = new SqliteSignalStore(dbPath);
	});

	afterEach(() => {
		// Clean up database
		store.close();
		if (existsSync(dbPath)) {
			unlinkSync(dbPath);
		}
		// Also clean up WAL and SHM files if they exist
		const walPath = `${dbPath}-wal`;
		const shmPath = `${dbPath}-shm`;
		if (existsSync(walPath)) {
			unlinkSync(walPath);
		}
		if (existsSync(shmPath)) {
			unlinkSync(shmPath);
		}
	});

	describe("Record mode with SqliteSignalStore", () => {
		it("saves signals to SQLite database", async () => {
			const { agent } = createPRDWorkflow();
			const mockHarness = createSimpleMockHarness();

			const terminator = agent({
				prompt: "End workflow",
				activateOn: ["workflow:start"],
				when: () => true,
			});

			const result = await runPRDWorkflow({
				prd: "# SQLite Test PRD\nBuild a hello world function.",
				agents: { terminator },
				harness: mockHarness,
				endWhen: (state) => state.planning.phase === "idle",
				recording: {
					mode: "record",
					store,
					name: "sqlite-record-test",
					tags: ["sqlite", "integration"],
				},
			});

			// Should return a recording ID
			expect(result.recordingId).toBeDefined();
			expect(result.recordingId).toMatch(/^rec_/);

			// Recording should be saved to SQLite store
			const recording = await store.load(result.recordingId as string);
			expect(recording).toBeDefined();
			if (!recording) throw new Error("Recording should exist");
			expect(recording.signals.length).toBeGreaterThan(0);

			// Recording metadata should match
			expect(recording.metadata.name).toBe("sqlite-record-test");
			expect(recording.metadata.tags).toContain("sqlite");
			expect(recording.metadata.tags).toContain("integration");
		});

		it("stores multiple signals in correct order", async () => {
			const { agent } = createPRDWorkflow();

			const plannerOutput = {
				tasks: [{ id: "task-1", title: "Test task", status: "pending" }],
				milestones: [{ id: "ms-1", taskIds: ["task-1"] }],
				taskOrder: ["task-1"],
			};

			const mockHarness = createDeterministicMockHarness(plannerOutput);

			const planner = agent({
				prompt: "Create a plan",
				activateOn: ["workflow:start"],
				emits: ["plan:created"],
				when: (ctx) => ctx.state.planning.phase === "idle",
			});

			const result = await runPRDWorkflow({
				prd: "# Order Test PRD",
				agents: { planner },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "signal-order-test",
				},
			});

			expect(result.recordingId).toBeDefined();
			if (!result.recordingId) throw new Error("Recording ID should exist");

			// Load signals and verify order
			const signals = await store.loadSignals(result.recordingId);
			expect(signals.length).toBeGreaterThan(0);

			// workflow:start should be first
			expect(signals[0]?.name).toBe("workflow:start");

			// harness signals should appear in sequence
			const harnessSignals = signals.filter((s) => s.name.startsWith("harness:") || s.name.startsWith("text:"));
			expect(harnessSignals.length).toBeGreaterThan(0);
		});
	});

	describe("Replay mode with SqliteSignalStore", () => {
		it("loads signals correctly from database", async () => {
			const { agent } = createPRDWorkflow();
			const mockHarness = createSimpleMockHarness();

			const terminator = agent({
				prompt: "End workflow",
				activateOn: ["workflow:start"],
				when: () => true,
			});

			// Record first
			const recordResult = await runPRDWorkflow({
				prd: "# Replay Load Test",
				agents: { terminator },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "replay-load-test",
				},
			});

			expect(recordResult.recordingId).toBeDefined();
			if (!recordResult.recordingId) throw new Error("Recording ID should exist");

			// Get the recorded signal count
			const recording = await store.load(recordResult.recordingId);
			expect(recording).toBeDefined();
			if (!recording) throw new Error("Recording should exist");
			const recordedSignalCount = recording.signals.length;

			// Replay
			const replayResult = await runPRDWorkflow({
				prd: "# Replay Load Test",
				agents: { terminator },
				endWhen: () => true,
				recording: {
					mode: "replay",
					store,
					recordingId: recordResult.recordingId,
				},
			});

			// Replay should produce signals
			expect(replayResult.signals.length).toBeGreaterThan(0);
			// Signal count should match
			expect(replayResult.signals.length).toBe(recordedSignalCount);
		});

		it("produces same state as original recording", async () => {
			const { agent } = createPRDWorkflow();

			const plannerOutput = {
				tasks: [{ id: "task-1", title: "Implement feature", status: "pending" }],
				milestones: [{ id: "ms-1", taskIds: ["task-1"] }],
				taskOrder: ["task-1"],
			};

			const mockHarness = createDeterministicMockHarness(plannerOutput);

			const planner = agent({
				prompt: "Create a plan from the PRD",
				activateOn: ["workflow:start"],
				emits: ["plan:created"],
				when: (ctx) => ctx.state.planning.phase === "idle",
			});

			// Record
			const recordResult = await runPRDWorkflow({
				prd: "# State Comparison PRD\nCreate a simple feature",
				agents: { planner },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "state-comparison-test",
				},
			});

			expect(recordResult.recordingId).toBeDefined();
			if (!recordResult.recordingId) throw new Error("Recording ID should exist");

			// Replay
			const replayResult = await runPRDWorkflow({
				prd: "# State Comparison PRD\nCreate a simple feature",
				agents: { planner },
				endWhen: () => true,
				recording: {
					mode: "replay",
					store,
					recordingId: recordResult.recordingId,
				},
			});

			// Final state should match
			expect(replayResult.state.planning.prd).toBe(recordResult.state.planning.prd);
			expect(replayResult.state.planning.phase).toBe(recordResult.state.planning.phase);
			expect(replayResult.state.execution.phase).toBe(recordResult.state.execution.phase);
			expect(replayResult.state.review.phase).toBe(recordResult.state.review.phase);
		});
	});

	describe("Persistence across store instances", () => {
		it("recording persists across process restarts", async () => {
			const { agent } = createPRDWorkflow();
			const mockHarness = createSimpleMockHarness();

			const terminator = agent({
				prompt: "End workflow",
				activateOn: ["workflow:start"],
				when: () => true,
			});

			// Record with first store instance
			const recordResult = await runPRDWorkflow({
				prd: "# Persistence Test PRD",
				agents: { terminator },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "persistence-test",
					tags: ["persistence", "restart"],
				},
			});

			expect(recordResult.recordingId).toBeDefined();
			if (!recordResult.recordingId) throw new Error("Recording ID should exist");

			// Close the store (simulating process end)
			store.close();

			// Create a NEW store instance pointing to the same database
			const store2 = new SqliteSignalStore(dbPath);

			try {
				// Recording should still exist
				const exists = await store2.exists(recordResult.recordingId);
				expect(exists).toBe(true);

				// Load full recording from new store
				const recording = await store2.load(recordResult.recordingId);
				expect(recording).toBeDefined();
				if (!recording) throw new Error("Recording should exist");

				// Verify metadata preserved
				expect(recording.metadata.name).toBe("persistence-test");
				expect(recording.metadata.tags).toContain("persistence");
				expect(recording.metadata.tags).toContain("restart");

				// Verify signals preserved
				expect(recording.signals.length).toBeGreaterThan(0);

				// Replay with new store instance
				const replayResult = await runPRDWorkflow({
					prd: "# Persistence Test PRD",
					agents: { terminator },
					endWhen: () => true,
					recording: {
						mode: "replay",
						store: store2,
						recordingId: recordResult.recordingId,
					},
				});

				// Should complete successfully
				expect(replayResult.state).toBeDefined();
				expect(replayResult.signals.length).toBeGreaterThan(0);
			} finally {
				store2.close();
				// Update store reference for afterEach cleanup
				store = new SqliteSignalStore(dbPath);
			}
		});

		it("multiple recordings coexist in same database", async () => {
			const { agent } = createPRDWorkflow();
			const mockHarness = createSimpleMockHarness();

			const terminator = agent({
				prompt: "End workflow",
				activateOn: ["workflow:start"],
				when: () => true,
			});

			// Create first recording
			const result1 = await runPRDWorkflow({
				prd: "# First PRD",
				agents: { terminator },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "first-recording",
					tags: ["first"],
				},
			});

			// Create second recording
			const result2 = await runPRDWorkflow({
				prd: "# Second PRD",
				agents: { terminator },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "second-recording",
					tags: ["second"],
				},
			});

			expect(result1.recordingId).toBeDefined();
			expect(result2.recordingId).toBeDefined();
			expect(result1.recordingId).not.toBe(result2.recordingId);

			// Both should exist
			const exists1 = await store.exists(result1.recordingId as string);
			const exists2 = await store.exists(result2.recordingId as string);
			expect(exists1).toBe(true);
			expect(exists2).toBe(true);

			// List should return both
			const recordings = await store.list();
			expect(recordings.length).toBe(2);

			// Each should load correctly
			const recording1 = await store.load(result1.recordingId as string);
			const recording2 = await store.load(result2.recordingId as string);
			expect(recording1?.metadata.name).toBe("first-recording");
			expect(recording2?.metadata.name).toBe("second-recording");
		});
	});

	describe("Error handling", () => {
		it("validates recording exists before replay", async () => {
			const { agent } = createPRDWorkflow();

			const terminator = agent({
				prompt: "End workflow",
				activateOn: ["workflow:start"],
				when: () => true,
			});

			// Attempt replay with non-existent recording
			await expect(
				runPRDWorkflow({
					prd: "# Test",
					agents: { terminator },
					endWhen: () => true,
					recording: {
						mode: "replay",
						store,
						recordingId: "rec_nonexistent",
					},
				}),
			).rejects.toThrow("Recording not found");
		});

		it("can delete recordings from SQLite store", async () => {
			const { agent } = createPRDWorkflow();
			const mockHarness = createSimpleMockHarness();

			const terminator = agent({
				prompt: "End workflow",
				activateOn: ["workflow:start"],
				when: () => true,
			});

			// Create recording
			const result = await runPRDWorkflow({
				prd: "# Delete Test",
				agents: { terminator },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					store,
					name: "to-be-deleted",
				},
			});

			expect(result.recordingId).toBeDefined();
			if (!result.recordingId) throw new Error("Recording ID should exist");

			// Recording should exist
			const exists = await store.exists(result.recordingId);
			expect(exists).toBe(true);

			// Delete recording
			await store.delete(result.recordingId);

			// Recording should not exist
			const existsAfter = await store.exists(result.recordingId);
			expect(existsAfter).toBe(false);

			// Signals should also be deleted
			const signals = await store.loadSignals(result.recordingId).catch(() => []);
			expect(signals.length).toBe(0);
		});
	});
});
