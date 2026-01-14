/**
 * FileSignalStore Persistence Example
 *
 * Demonstrates file-based signal persistence:
 * - Recording signals to disk using FileSignalStore (JSONL format)
 * - Closing the store (simulating app shutdown)
 * - Reopening from disk (simulating app restart)
 * - Loading the recording from the persisted file
 *
 * Run: bun run examples/file-store-persistence/index.ts
 */

import { ClaudeHarness, createWorkflow, Player } from "@open-harness/core";
import { FileSignalStore } from "@open-harness/stores";
import { rm } from "node:fs/promises";
import { render } from "../lib/render.js";

const STORE_DIR = ".examples/file-store-demo";
const CLAUDE_PATH = "/Users/abuusama/.bun/bin/claude";

// =============================================================================
// Setup
// =============================================================================

type AnalysisState = {
	input: string;
	result: string | null;
};

const harness = new ClaudeHarness({
	model: "claude-sonnet-4-20250514",
	pathToClaudeCodeExecutable: CLAUDE_PATH,
});

const { agent, runReactive } = createWorkflow<AnalysisState>();

const analyzer = agent({
	prompt: `Analyze this input briefly (1-2 sentences): {{ state.input }}`,
	activateOn: ["workflow:start"],
	emits: ["analysis:complete"],
	signalHarness: harness,
	updates: "result",
});

// =============================================================================
// Phase 1: Record to disk
// =============================================================================

async function recordToDisk(): Promise<string> {
	render.phase(1, "Record to FileSignalStore", `Directory: ${STORE_DIR}`);

	const store = new FileSignalStore({ baseDir: STORE_DIR });

	const result = await runReactive({
		agents: { analyzer },
		state: { input: "The quick brown fox jumps over the lazy dog", result: null },
		recording: {
			mode: "record",
			store,
			name: "file-persistence-demo",
			tags: ["persistence", "file-store"],
		},
		endWhen: (state) => state.result !== null,
	});

	render.workflowResult({
		recordingId: result.recordingId,
		durationMs: result.metrics.durationMs,
		signalCount: result.signals.length,
	});

	render.signalNames(result.signals, "Signals recorded");

	const recordings = await store.list();
	render.storeFiles(
		recordings.map((r) => ({ ...r, format: "jsonl" as const })),
		"Files on disk"
	);

	return result.recordingId!;
}

// =============================================================================
// Phase 2: Load from fresh instance
// =============================================================================

async function loadFromDisk(recordingId: string): Promise<void> {
	render.phase(2, "Load from FileSignalStore", "Fresh instance (simulating restart)");

	const store = new FileSignalStore({ baseDir: STORE_DIR });
	const recordings = await store.list();

	render.recordingList(recordings, "Recordings found on disk");

	const recording = await store.load(recordingId);
	if (!recording) {
		render.error("Recording not found on disk!");
		process.exit(1);
	}

	render.success("Recording loaded from disk");
	render.signalList(recording.signals, "Signals loaded");

	const player = new Player(recording);
	player.fastForward();

	render.snapshot({
		textPreview: player.snapshot.harness.text.content.slice(0, 50) + "...",
		running: player.snapshot.harness.running,
		position: { index: player.position.index, total: player.position.total },
	});
}

// =============================================================================
// Phase 3: Replay from disk
// =============================================================================

async function replayFromDisk(recordingId: string): Promise<void> {
	render.phase(3, "Replay from FileSignalStore", "No provider calls");

	const store = new FileSignalStore({ baseDir: STORE_DIR });

	const result = await runReactive({
		agents: { analyzer },
		state: { input: "Different input - replay uses persisted signals", result: null },
		recording: { mode: "replay", store, recordingId },
		endWhen: (state) => state.result !== null,
	});

	render.workflowResult({
		durationMs: result.metrics.durationMs,
		signalCount: result.signals.length,
	});

	render.success("Replayed from disk without provider calls");
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
	render.banner("FileSignalStore Persistence Example");
	render.list([
		"Record signals to disk (JSONL format)",
		"Reopen store (simulating restart)",
		"Load and replay from persisted files",
	]);

	try { await rm(STORE_DIR, { recursive: true }); } catch { /* ignore */ }

	const recordingId = await recordToDisk();
	await loadFromDisk(recordingId);
	await replayFromDisk(recordingId);

	await rm(STORE_DIR, { recursive: true });

	render.divider();
	render.success("FileSignalStore persistence validated");
}

main().catch((err) => {
	render.error(err.message);
	process.exit(1);
});
