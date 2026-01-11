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

import {
	createWorkflow,
	ClaudeHarness,
	MemorySignalStore,
	Player,
} from "@open-harness/core";

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
	console.log("=== Recording Mode ===\n");
	console.log("Running workflow with recording enabled...\n");

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

	console.log(`Duration: ${result.metrics.durationMs}ms`);
	console.log(`Signals captured: ${result.signals.length}`);
	console.log(`Recording ID: ${result.recordingId}\n`);

	// Show signal names
	console.log("Signal flow:");
	for (const signal of result.signals) {
		const source = signal.source?.agent ?? "system";
		console.log(`  [${source}] ${signal.name}`);
	}

	return result.recordingId!;
}

// =============================================================================
// 6. Replay the workflow
// =============================================================================

async function replayWorkflow(recordingId: string): Promise<void> {
	console.log("\n=== Replay Mode ===\n");
	console.log("Replaying from recording (no provider calls)...\n");

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

	console.log(`Duration: ${result.metrics.durationMs}ms`);
	console.log(`Signals replayed: ${result.signals.length}`);
	console.log("Note: Provider was NOT called - signals were injected from recording\n");

	// Show signal names
	console.log("Signal flow (from replay):");
	for (const signal of result.signals) {
		const source = signal.source?.agent ?? "system";
		console.log(`  [${source}] ${signal.name}`);
	}
}

// =============================================================================
// 7. Debug with Player
// =============================================================================

async function debugWithPlayer(recordingId: string): Promise<void> {
	console.log("\n=== Player Debug Mode ===\n");
	console.log("Stepping through recorded signals...\n");

	// Load recording
	const recording = await store.load(recordingId);
	if (!recording) {
		throw new Error("Recording not found");
	}

	// Create player
	const player = new Player(recording);

	// Step through signals
	console.log("VCR Controls Demo:\n");

	// Step forward
	console.log("▶️ Stepping forward:");
	for (let i = 0; i < 5 && !player.position.atEnd; i++) {
		const signal = player.step();
		if (signal) {
			console.log(`  [${player.position.index}] ${signal.name}`);
		}
	}

	// Show snapshot
	console.log("\n📸 Snapshot at current position:");
	const snap = player.snapshot;
	console.log(`  Text: "${snap.harness.text.content.slice(0, 50)}..."`);
	console.log(`  Harness running: ${snap.harness.running}`);

	// Jump to end
	console.log("\n⏭️ Fast forward to end:");
	player.fastForward();
	console.log(`  Position: ${player.position.index}/${player.position.total}`);

	// Step back
	console.log("\n⏪ Step back:");
	player.back();
	player.back();
	console.log(`  Position: ${player.position.index}/${player.position.total}`);

	// Rewind
	console.log("\n⏮️ Rewind to start:");
	player.rewind();
	console.log(`  At start: ${player.position.atStart}`);

	// Find specific signal
	console.log("\n🔍 Find analysis:complete signal:");
	const analysisSignals = player.findAll("analysis:complete");
	console.log(`  Found ${analysisSignals.length} match(es)`);
	if (analysisSignals.length > 0) {
		console.log(`  At index: ${analysisSignals[0].index}`);
	}
}

// =============================================================================
// 8. Query store
// =============================================================================

async function queryStore(): Promise<void> {
	console.log("\n=== Store Query ===\n");

	const recordings = await store.list();
	console.log(`Total recordings: ${recordings.length}\n`);

	for (const meta of recordings) {
		console.log(`📼 ${meta.name ?? "Unnamed"}`);
		console.log(`   ID: ${meta.id}`);
		console.log(`   Signals: ${meta.signalCount}`);
		console.log(`   Duration: ${meta.durationMs}ms`);
		console.log(`   Tags: ${meta.tags?.join(", ") ?? "none"}`);
	}

	// Query by tag
	const demoRecordings = await store.list({ tags: ["demo"] });
	console.log(`\nRecordings with 'demo' tag: ${demoRecordings.length}`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
	console.log("=== Recording & Replay Example ===\n");
	console.log("This example demonstrates:");
	console.log("1. Recording signals during live execution");
	console.log("2. Replaying without making provider calls");
	console.log("3. Using Player for debugging\n");
	console.log("─".repeat(50) + "\n");

	// Record a workflow
	const recordingId = await recordWorkflow();

	// Replay the workflow
	await replayWorkflow(recordingId);

	// Debug with Player
	await debugWithPlayer(recordingId);

	// Query the store
	await queryStore();

	console.log("\n" + "─".repeat(50));
	console.log("\n✅ Recording & replay example complete!");
}

main().catch(console.error);
