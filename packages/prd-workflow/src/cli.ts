#!/usr/bin/env bun
/**
 * PRD Workflow CLI
 *
 * Command-line interface for running PRD-driven development workflows.
 *
 * Usage:
 *   bun run prd:live <prd-file>     - Run live against Claude API
 *   bun run prd:record <prd-file>   - Run live and record signals to SQLite
 *   bun run prd:replay <recording>  - Replay a recording (no harness needed)
 *
 * Options:
 *   --mode, -m     Mode: live | record | replay (default: live)
 *   --recording    Recording ID for replay mode
 *   --sandbox, -s  Sandbox directory (default: .sandbox)
 *   --database, -d SQLite database path (default: .sandbox/recordings.db)
 *   --name, -n     Recording name (for record mode)
 *   --tags, -t     Recording tags, comma-separated (for record mode)
 *   --help, -h     Show help
 *
 * @example
 * ```bash
 * # Run live workflow
 * bun run prd:live examples/hello-world.prd.md
 *
 * # Record a workflow run
 * bun run prd:record examples/hello-world.prd.md --name "test run" --tags "integration,ci"
 *
 * # Replay a recorded workflow
 * bun run prd:replay --recording rec_abc12345
 * ```
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

// ============================================================================
// Argument Parsing
// ============================================================================

interface CliArgs {
	mode: "live" | "record" | "replay";
	prdFile?: string;
	recordingId?: string;
	sandbox: string;
	database: string;
	name?: string;
	tags?: string[];
	help: boolean;
}

function showHelp(): void {
	console.log(`
PRD Workflow CLI

Usage:
  bun run prd:live <prd-file>      Run live against Claude API
  bun run prd:record <prd-file>    Run live and record signals
  bun run prd:replay <recording>   Replay a recording

Options:
  --mode, -m     Mode: live | record | replay (default: live)
  --recording    Recording ID for replay mode
  --sandbox, -s  Sandbox directory (default: .sandbox)
  --database, -d SQLite database path (default: .sandbox/recordings.db)
  --name, -n     Recording name (for record mode)
  --tags, -t     Recording tags, comma-separated (for record mode)
  --help, -h     Show this help

Examples:
  bun run prd:live examples/hello-world.prd.md
  bun run prd:record examples/hello-world.prd.md --name "test"
  bun run prd:replay --recording rec_abc12345
`);
}

function parseCliArgs(): CliArgs {
	try {
		const { values, positionals } = parseArgs({
			args: Bun.argv.slice(2),
			options: {
				mode: { type: "string", short: "m", default: "live" },
				recording: { type: "string" },
				sandbox: { type: "string", short: "s", default: ".sandbox" },
				database: { type: "string", short: "d" },
				name: { type: "string", short: "n" },
				tags: { type: "string", short: "t" },
				help: { type: "boolean", short: "h", default: false },
			},
			allowPositionals: true,
		});

		const mode = values.mode as "live" | "record" | "replay";
		if (!["live", "record", "replay"].includes(mode)) {
			console.error(`Invalid mode: ${mode}. Must be one of: live, record, replay`);
			process.exit(1);
		}

		const sandbox = values.sandbox as string;
		const database = (values.database as string | undefined) ?? `${sandbox}/recordings.db`;

		return {
			mode,
			prdFile: positionals[0],
			recordingId: values.recording as string | undefined,
			sandbox,
			database,
			name: values.name as string | undefined,
			tags: values.tags ? (values.tags as string).split(",").map((t) => t.trim()) : undefined,
			help: values.help as boolean,
		};
	} catch (error) {
		console.error("Error parsing arguments:", error);
		process.exit(1);
	}
}

// ============================================================================
// Validation
// ============================================================================

function validateArgs(args: CliArgs): void {
	if (args.mode === "replay") {
		if (!args.recordingId) {
			console.error("Error: --recording is required for replay mode");
			process.exit(1);
		}
	} else {
		// live or record mode requires PRD file
		if (!args.prdFile) {
			console.error(`Error: PRD file is required for ${args.mode} mode`);
			showHelp();
			process.exit(1);
		}

		if (!existsSync(args.prdFile)) {
			console.error(`Error: PRD file not found: ${args.prdFile}`);
			process.exit(1);
		}
	}

	// Ensure sandbox directory exists
	if (!existsSync(args.sandbox)) {
		mkdirSync(args.sandbox, { recursive: true });
	}
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
	const args = parseCliArgs();

	if (args.help) {
		showHelp();
		process.exit(0);
	}

	validateArgs(args);

	// Dynamic imports to avoid loading heavy dependencies when just showing help
	const { SqliteSignalStore } = await import("@open-harness/stores");
	const { runPRDWorkflow } = await import("./workflow.js");
	const { plannerAgent } = await import("./agents/index.js");

	// Ensure database directory exists
	const dbDir = dirname(resolve(args.database));
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	console.log(`\n🚀 PRD Workflow CLI`);
	console.log(`   Mode: ${args.mode}`);
	console.log(`   Database: ${args.database}`);

	if (args.mode === "replay") {
		// Replay mode: load signals from recording
		console.log(`   Recording: ${args.recordingId}`);

		const store = new SqliteSignalStore(args.database);

		try {
			const exists = await store.exists(args.recordingId as string);
			if (!exists) {
				console.error(`\n❌ Recording not found: ${args.recordingId}`);
				process.exit(1);
			}

			const recording = await store.load(args.recordingId as string);
			if (!recording) {
				console.error(`\n❌ Failed to load recording: ${args.recordingId}`);
				process.exit(1);
			}

			console.log(`   Signals: ${recording.metadata.signalCount}`);
			console.log(`\n📼 Replaying recording...`);

			const startTime = performance.now();

			const result = await runPRDWorkflow({
				prd: "", // PRD comes from the recorded signals
				agents: {}, // No agents needed for replay
				recording: {
					mode: "replay",
					store,
					recordingId: args.recordingId as string,
				},
			});

			const durationMs = Math.round(performance.now() - startTime);
			console.log(`\n✅ Replay complete in ${durationMs}ms`);
			console.log(`   Final phase: ${result.state.review.phase}`);
			console.log(`   Tasks: ${Object.keys(result.state.planning.allTasks).length}`);
			console.log(`   Milestones passed: ${result.state.review.passedMilestones.length}`);
		} finally {
			store.close();
		}
	} else {
		// Live or Record mode: run against Claude API
		const prdContent = readFileSync(args.prdFile as string, "utf-8");
		console.log(`   PRD: ${args.prdFile}`);
		console.log(`   Sandbox: ${args.sandbox}`);

		// Import Claude harness
		const { ClaudeHarness } = await import("@open-harness/claude");

		// Create Claude harness for REAL API calls
		const harness = new ClaudeHarness({
			model: "claude-sonnet-4-20250514",
		});

		// Use the declarative planner agent with structured output schema
		// The agent's dynamic prompt reads PRD from ctx.state.planning.prd
		// which is populated by createInitialState(prdContent) in runPRDWorkflow

		const startTime = performance.now();

		if (args.mode === "record") {
			const store = new SqliteSignalStore(args.database);
			console.log(`   Name: ${args.name ?? "(auto)"}`);
			if (args.tags) {
				console.log(`   Tags: ${args.tags.join(", ")}`);
			}

			console.log(`\n🎬 Recording workflow (calling REAL Claude API)...`);

			try {
				const result = await runPRDWorkflow({
					prd: prdContent,
					agents: { planner: plannerAgent },
					harness,
					recording: {
						mode: "record",
						store,
						name: args.name,
						tags: args.tags,
					},
				});

				const durationMs = Math.round(performance.now() - startTime);
				console.log(`\n✅ Recording complete in ${durationMs}ms`);
				console.log(`   Recording ID: ${result.recordingId ?? "(unknown)"}`);
				console.log(`   Final phase: ${result.state.review.phase}`);
			} finally {
				store.close();
			}
		} else {
			// Live mode
			console.log(`\n⚡ Running workflow (calling REAL Claude API)...`);

			const result = await runPRDWorkflow({
				prd: prdContent,
				agents: { planner: plannerAgent },
				harness,
			});

			const durationMs = Math.round(performance.now() - startTime);
			console.log(`\n✅ Workflow complete in ${durationMs}ms`);
			console.log(`   Final phase: ${result.state.review.phase}`);
			console.log(`   Tasks: ${Object.keys(result.state.planning.allTasks).length}`);
			console.log(`   Milestones passed: ${result.state.review.passedMilestones.length}`);
		}
	}

	console.log("");
}

// Run the CLI
main().catch((error) => {
	console.error("\n❌ CLI Error:", error);
	process.exit(1);
});
