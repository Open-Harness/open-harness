/**
 * SqliteSignalStore Persistence Example
 *
 * Demonstrates SQLite-based signal persistence:
 * - Recording signals to SQLite database
 * - Closing the store (simulating app shutdown)
 * - Reopening from disk (simulating app restart)
 * - Loading the recording from the persisted database
 *
 * Run: bun run examples/sqlite-store-persistence/index.ts
 */

import { ClaudeHarness, createWorkflow, Player } from "@open-harness/core";
import { SqliteSignalStore } from "@open-harness/stores";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { render } from "../lib/render.js";

const DB_PATH = ".examples/sqlite-store-demo.db";
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
// Phase 1: Record to SQLite
// =============================================================================

async function recordToSqlite(): Promise<string> {
	render.phase(1, "Record to SqliteSignalStore", `Database: ${DB_PATH}`);

	const store = new SqliteSignalStore({ dbPath: DB_PATH });

	const result = await runReactive({
		agents: { analyzer },
		state: { input: "The quick brown fox jumps over the lazy dog", result: null },
		recording: {
			mode: "record",
			store,
			name: "sqlite-persistence-demo",
			tags: ["persistence", "sqlite"],
		},
		endWhen: (state) => state.result !== null,
	});

	render.workflowResult({
		recordingId: result.recordingId,
		durationMs: result.metrics.durationMs,
		signalCount: result.signals.length,
	});

	render.signalNames(result.signals, "Signals recorded");

	const dbStats = await stat(DB_PATH);
	render.metric("Database size", `${dbStats.size} bytes`);

	store.close();

	return result.recordingId!;
}

// =============================================================================
// Phase 2: Load from fresh instance
// =============================================================================

async function loadFromSqlite(recordingId: string): Promise<void> {
	render.phase(2, "Load from SqliteSignalStore", "Fresh instance (simulating restart)");

	const store = new SqliteSignalStore({ dbPath: DB_PATH });
	const recordings = await store.list();

	render.recordingList(recordings, "Recordings found in database");

	const recording = await store.load(recordingId);
	if (!recording) {
		render.error("Recording not found in database!");
		process.exit(1);
	}

	render.success("Recording loaded from SQLite");
	render.signalList(recording.signals, "Signals loaded");

	const toolSignals = await store.loadSignals(recordingId, { patterns: ["tool:*"] });
	render.signalNames(toolSignals, "Filtered (tool:*)");

	const player = new Player(recording);
	player.fastForward();

	render.snapshot({
		textPreview: player.snapshot.harness.text.content.slice(0, 50) + "...",
		running: player.snapshot.harness.running,
		position: { index: player.position.index, total: player.position.total },
	});

	store.close();
}

// =============================================================================
// Phase 3: Replay from SQLite
// =============================================================================

async function replayFromSqlite(recordingId: string): Promise<void> {
	render.phase(3, "Replay from SqliteSignalStore", "No provider calls");

	const store = new SqliteSignalStore({ dbPath: DB_PATH });

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

	render.success("Replayed from SQLite without provider calls");

	store.close();
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
	render.banner("SqliteSignalStore Persistence Example");
	render.list([
		"Record signals to SQLite database",
		"Close and reopen store (simulating restart)",
		"Load and replay from persisted database",
	]);

	try { await unlink(DB_PATH); } catch { /* ignore */ }
	await mkdir(dirname(DB_PATH), { recursive: true });

	const recordingId = await recordToSqlite();
	await loadFromSqlite(recordingId);
	await replayFromSqlite(recordingId);

	await unlink(DB_PATH);

	render.divider();
	render.success("SqliteSignalStore persistence validated");
}

main().catch((err) => {
	render.error(err.message);
	process.exit(1);
});
