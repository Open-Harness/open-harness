/**
 * DX Integration Test - Record/Replay Verification
 *
 * This test verifies the developer experience for recording and replaying
 * PRD workflow executions. Key assertions:
 *
 * 1. Record mode captures signals and returns a recordingId
 * 2. Replay mode reproduces identical final state
 * 3. Replay mode produces identical signal history (harness signals)
 * 4. Replay is deterministic - no network calls needed
 *
 * The test uses a minimal PRD to keep the recording lightweight and fast.
 */

import { describe, expect, it } from "bun:test";
import { MemorySignalStore } from "@internal/signals";
import {
	createSignal,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";
import {
	createInitialState,
	createPRDWorkflow,
	type PRDWorkflowState,
	processes,
	reducers,
	runPRDWorkflow,
} from "../src/index.js";

/**
 * Create a deterministic mock harness for testing.
 *
 * This harness produces predictable outputs so we can verify
 * that replay produces identical results.
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
 * Create a simple mock harness that just completes immediately.
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

describe("DX Integration - Record/Replay", () => {
	it("records signals and returns a recordingId", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();
		const mockHarness = createSimpleMockHarness();

		// Create an agent that terminates the workflow
		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		const result = await runPRDWorkflow({
			prd: "# Test PRD\nBuild a hello world function.",
			agents: { terminator },
			harness: mockHarness,
			endWhen: (state) => state.planning.phase === "idle",
			recording: {
				mode: "record",
				store,
				name: "dx-integration-test",
				tags: ["test", "dx-integration"],
			},
		});

		// Should return a recording ID
		expect(result.recordingId).toBeDefined();
		expect(result.recordingId).toMatch(/^rec_/);

		// Recording should be saved to store
		const recording = await store.load(result.recordingId!);
		expect(recording).toBeDefined();
		expect(recording!.signals.length).toBeGreaterThan(0);

		// Recording metadata should match
		expect(recording!.metadata.name).toBe("dx-integration-test");
		expect(recording!.metadata.tags).toContain("test");
		expect(recording!.metadata.tags).toContain("dx-integration");
	});

	it("replays recording with identical final state", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();

		// Create deterministic harness output
		const plannerOutput = {
			tasks: [{ id: "task-1", title: "Implement hello function", status: "pending" }],
			milestones: [{ id: "ms-1", taskIds: ["task-1"] }],
			taskOrder: ["task-1"],
		};

		const mockHarness = createDeterministicMockHarness(plannerOutput);

		// Create agents for the workflow
		const planner = agent({
			prompt: "Create a plan from the PRD",
			activateOn: ["workflow:start"],
			emits: ["plan:created"],
			when: (ctx) => ctx.state.planning.phase === "idle",
		});

		// Record first execution
		const recordResult = await runPRDWorkflow({
			prd: "# Hello PRD\nCreate a function that returns 'Hello'",
			agents: { planner },
			harness: mockHarness,
			endWhen: () => true, // Stop after first activation
			recording: {
				mode: "record",
				store,
				name: "state-comparison-test",
			},
		});

		expect(recordResult.recordingId).toBeDefined();

		// Replay with the same recording
		const replayResult = await runPRDWorkflow({
			prd: "# Hello PRD\nCreate a function that returns 'Hello'",
			agents: { planner },
			// No harness needed for replay!
			endWhen: () => true,
			recording: {
				mode: "replay",
				store,
				recordingId: recordResult.recordingId!,
			},
		});

		// Final state should match
		expect(replayResult.state.planning.prd).toBe(recordResult.state.planning.prd);
		expect(replayResult.state.planning.phase).toBe(recordResult.state.planning.phase);
		expect(replayResult.state.execution.phase).toBe(recordResult.state.execution.phase);
		expect(replayResult.state.review.phase).toBe(recordResult.state.review.phase);
	});

	it("replays harness signals identically", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();
		const mockHarness = createSimpleMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		// Record
		const recordResult = await runPRDWorkflow({
			prd: "# Signal Test PRD",
			agents: { terminator },
			harness: mockHarness,
			endWhen: () => true,
			recording: {
				mode: "record",
				store,
				name: "signal-comparison-test",
			},
		});

		// Replay
		const replayResult = await runPRDWorkflow({
			prd: "# Signal Test PRD",
			agents: { terminator },
			endWhen: () => true,
			recording: {
				mode: "replay",
				store,
				recordingId: recordResult.recordingId!,
			},
		});

		// Filter to harness-specific signals for comparison
		const harnessSignalPrefixes = ["harness:", "text:", "tool:", "thinking:"];
		const filterHarnessSignals = (signals: readonly Signal[]) =>
			signals.filter((s) => harnessSignalPrefixes.some((prefix) => s.name.startsWith(prefix)));

		const recordHarnessSignals = filterHarnessSignals(recordResult.signals);
		const replayHarnessSignals = filterHarnessSignals(replayResult.signals);

		// Should have same number of harness signals
		expect(replayHarnessSignals.length).toBe(recordHarnessSignals.length);

		// Signal names should match
		expect(replayHarnessSignals.map((s) => s.name)).toEqual(recordHarnessSignals.map((s) => s.name));

		// Payloads should match (excluding timestamps)
		for (let i = 0; i < recordHarnessSignals.length; i++) {
			const recordSignal = recordHarnessSignals[i]!;
			const replaySignal = replayHarnessSignals[i]!;
			expect(replaySignal.payload).toEqual(recordSignal.payload);
		}
	});

	it("replay is instant (no network delay)", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();
		const mockHarness = createSimpleMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		// Record
		const recordResult = await runPRDWorkflow({
			prd: "# Speed Test PRD",
			agents: { terminator },
			harness: mockHarness,
			endWhen: () => true,
			recording: {
				mode: "record",
				store,
				name: "speed-test",
			},
		});

		// Time multiple replays - they should all be fast
		const replayDurations: number[] = [];

		for (let i = 0; i < 3; i++) {
			const startTime = performance.now();

			await runPRDWorkflow({
				prd: "# Speed Test PRD",
				agents: { terminator },
				endWhen: () => true,
				recording: {
					mode: "replay",
					store,
					recordingId: recordResult.recordingId!,
				},
			});

			const durationMs = performance.now() - startTime;
			replayDurations.push(durationMs);
		}

		// All replays should complete in under 100ms (no network)
		// This is a generous threshold to account for CI variance
		for (const duration of replayDurations) {
			expect(duration).toBeLessThan(100);
		}

		// Replays should be consistent in timing
		const maxDuration = Math.max(...replayDurations);
		const minDuration = Math.min(...replayDurations);
		expect(maxDuration - minDuration).toBeLessThan(50); // Low variance
	});

	it("replay works without a harness", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();
		const mockHarness = createSimpleMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		// Record with harness
		const recordResult = await runPRDWorkflow({
			prd: "# No Harness Test",
			agents: { terminator },
			harness: mockHarness,
			endWhen: () => true,
			recording: {
				mode: "record",
				store,
				name: "no-harness-test",
			},
		});

		// Replay WITHOUT harness - should work because signals are injected
		const replayResult = await runPRDWorkflow({
			prd: "# No Harness Test",
			agents: { terminator },
			// No harness!
			endWhen: () => true,
			recording: {
				mode: "replay",
				store,
				recordingId: recordResult.recordingId!,
			},
		});

		// Should complete successfully
		expect(replayResult.state).toBeDefined();
		expect(replayResult.signals.length).toBeGreaterThan(0);
	});

	it("validates recording exists before replay", async () => {
		const store = new MemorySignalStore();
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
					recordingId: "rec_nonexistent_12345",
				},
			}),
		).rejects.toThrow("Recording not found");
	});

	it("requires store for record mode", async () => {
		const { agent } = createPRDWorkflow();
		const mockHarness = createSimpleMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		// Attempt record without store
		await expect(
			runPRDWorkflow({
				prd: "# Test",
				agents: { terminator },
				harness: mockHarness,
				endWhen: () => true,
				recording: {
					mode: "record",
					// No store!
				},
			}),
		).rejects.toThrow("requires a store");
	});

	it("requires recordingId for replay mode", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		// Attempt replay without recordingId
		await expect(
			runPRDWorkflow({
				prd: "# Test",
				agents: { terminator },
				endWhen: () => true,
				recording: {
					mode: "replay",
					store,
					// No recordingId!
				},
			}),
		).rejects.toThrow("requires a recordingId");
	});
});

describe("DX Integration - Recording Metadata", () => {
	it("stores recording with metadata for querying", async () => {
		const store = new MemorySignalStore();
		const { agent } = createPRDWorkflow();
		const mockHarness = createSimpleMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		// Create recording with metadata
		const result = await runPRDWorkflow({
			prd: "# Metadata Test PRD",
			agents: { terminator },
			harness: mockHarness,
			endWhen: () => true,
			recording: {
				mode: "record",
				store,
				name: "metadata-test-recording",
				tags: ["integration", "dx", "metadata"],
			},
		});

		// Query recordings by name
		const recordings = await store.list();
		expect(recordings.length).toBeGreaterThan(0);

		const ourRecording = recordings.find((r) => r.id === result.recordingId);
		expect(ourRecording).toBeDefined();
		expect(ourRecording!.name).toBe("metadata-test-recording");
		expect(ourRecording!.tags).toContain("integration");
		expect(ourRecording!.tags).toContain("dx");
		expect(ourRecording!.tags).toContain("metadata");
		expect(ourRecording!.signalCount).toBeGreaterThan(0);
		// Note: 'finalized' is internal state, not exposed on RecordingMetadata
		// We can verify finalization by checking that durationMs is set
		expect(ourRecording!.durationMs).toBeDefined();
	});

	it("can delete recordings from store", async () => {
		const store = new MemorySignalStore();
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

		// Recording should exist
		const exists = await store.exists(result.recordingId!);
		expect(exists).toBe(true);

		// Delete recording
		await store.delete(result.recordingId!);

		// Recording should not exist
		const existsAfter = await store.exists(result.recordingId!);
		expect(existsAfter).toBe(false);
	});
});
