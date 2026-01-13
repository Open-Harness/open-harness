/**
 * Recording & Replay Example
 *
 * Demonstrates the signal recording and replay system:
 * - Recording signals during execution with `recording: { mode: 'record' }`
 * - Replaying without provider calls with `recording: { mode: 'replay' }`
 * - Using Player for debugging recorded signals
 *
 * Run: bun run examples/recording-replay/index.ts
 */

import { ClaudeHarness, createWorkflow, MemorySignalStore, Player } from "@open-harness/core";
import { render } from "../lib/render.js";

// =============================================================================
// 1. Define state type
// =============================================================================

type AnalysisState = {
	/** Input to analyze */
	input: string;
	/** Analysis result */
	result: string | null;
};

// =============================================================================
// 2. Create provider and store
// =============================================================================

const harness = new ClaudeHarness({
	model: "claude-sonnet-4-20250514",
});

// In-memory store for this example
// Production use: SqliteSignalStore or FileSignalStore
const store = new MemorySignalStore();

// =============================================================================
// 3. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createWorkflow<AnalysisState>();

// =============================================================================
// 4. Define agent
// =============================================================================

const analyzer = agent({
	prompt: `Analyze this input briefly (1-2 sentences): {{ state.input }}`,
	activateOn: ["workflow:start"],
	emits: ["analysis:complete"],
	signalHarness: harness,

	// Update state.result with output
	updates: "result",
});

// =============================================================================
// 5. Record a workflow
// =============================================================================

async function recordWorkflow(): Promise<string> {
	render.banner("Recording Mode");
	render.text("Running workflow with recording enabled...");
	render.blank();

	const result = await runReactive({
		agents: { analyzer },
		state: {
			input: "The quick brown fox jumps over the lazy dog",
			result: null,
		},
		recording: {
			mode: "record",
			store,
			name: "analysis-demo",
			tags: ["example", "demo"],
		},
		endWhen: (state) => state.result !== null,
	});

	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signals captured", result.signals.length);
	render.metric("Recording ID", result.recordingId);
	render.blank();

	// Show signal names
	render.text("Signal flow:");
	for (const signal of result.signals) {
		const source = signal.source?.agent ?? "system";
		render.text(`  [${source}] ${signal.name}`);
	}

	return result.recordingId!;
}

// =============================================================================
// 6. Replay the workflow
// =============================================================================

async function replayWorkflow(recordingId: string): Promise<void> {
	render.banner("Replay Mode");
	render.text("Replaying from recording (no provider calls)...");
	render.blank();

	const result = await runReactive({
		agents: { analyzer },
		state: {
			input: "Different input - but replay uses recorded signals",
			result: null,
		},
		recording: {
			mode: "replay",
			store,
			recordingId,
		},
		endWhen: (state) => state.result !== null,
	});

	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signals replayed", result.signals.length);
	render.text("Note: Provider was NOT called - signals were injected from recording");
	render.blank();

	// Show signal names
	render.text("Signal flow (from replay):");
	for (const signal of result.signals) {
		const source = signal.source?.agent ?? "system";
		render.text(`  [${source}] ${signal.name}`);
	}
}

// =============================================================================
// 7. Debug with Player
// =============================================================================

async function debugWithPlayer(recordingId: string): Promise<void> {
	render.banner("Player Debug Mode");
	render.text("Stepping through recorded signals...");
	render.blank();

	// Load recording
	const recording = await store.load(recordingId);
	if (!recording) {
		throw new Error("Recording not found");
	}

	// Create player
	const player = new Player(recording);

	// Step through signals
	render.section("VCR Controls Demo");

	// Step forward
	render.text("Stepping forward:");
	for (let i = 0; i < 5 && !player.position.atEnd; i++) {
		const signal = player.step();
		if (signal) {
			render.text(`  [${player.position.index}] ${signal.name}`);
		}
	}

	// Show snapshot
	render.blank();
	render.text("Snapshot at current position:");
	const snap = player.snapshot;
	render.text(`  Text: "${snap.harness.text.content.slice(0, 50)}..."`);
	render.text(`  Harness running: ${snap.harness.running}`);

	// Jump to end
	render.blank();
	render.text("Fast forward to end:");
	player.fastForward();
	render.text(`  Position: ${player.position.index}/${player.position.total}`);

	// Step back
	render.blank();
	render.text("Step back:");
	player.back();
	player.back();
	render.text(`  Position: ${player.position.index}/${player.position.total}`);

	// Rewind
	render.blank();
	render.text("Rewind to start:");
	player.rewind();
	render.text(`  At start: ${player.position.atStart}`);

	// Find specific signal
	render.blank();
	render.text("Find analysis:complete signal:");
	const analysisSignals = player.findAll("analysis:complete");
	render.text(`  Found ${analysisSignals.length} match(es)`);
	if (analysisSignals.length > 0) {
		render.text(`  At index: ${analysisSignals[0].index}`);
	}
}

// =============================================================================
// 8. Query store
// =============================================================================

async function queryStore(): Promise<void> {
	render.banner("Store Query");

	const recordings = await store.list();
	render.metric("Total recordings", recordings.length);
	render.blank();

	for (const meta of recordings) {
		render.text(`Recording: ${meta.name ?? "Unnamed"}`);
		render.text(`   ID: ${meta.id}`);
		render.text(`   Signals: ${meta.signalCount}`);
		render.text(`   Duration: ${meta.durationMs}ms`);
		render.text(`   Tags: ${meta.tags?.join(", ") ?? "none"}`);
	}

	// Query by tag
	const demoRecordings = await store.list({ tags: ["demo"] });
	render.blank();
	render.metric("Recordings with 'demo' tag", demoRecordings.length);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
	render.banner("Recording & Replay Example");
	render.text("This example demonstrates:");
	render.list([
		"Recording signals during live execution",
		"Replaying without making provider calls",
		"Using Player for debugging",
	]);
	render.blank();
	render.text("─".repeat(50));
	render.blank();

	// Record a workflow
	const recordingId = await recordWorkflow();

	// Replay the workflow
	await replayWorkflow(recordingId);

	// Debug with Player
	await debugWithPlayer(recordingId);

	// Query the store
	await queryStore();

	render.blank();
	render.text("─".repeat(50));
	render.blank();
	render.text("Recording & replay example complete!");
}

main().catch((err) => render.error(err.message));
