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

/**
 * Print help text to stdout.
 *
 * Note: Help text uses process.stdout.write() directly since it's not a log event
 * and the logger may not be configured yet. This is acceptable for CLI help output.
 */
function showHelp(): void {
	process.stdout.write(`
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
\n`);
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
			process.stderr.write(`Invalid mode: ${mode}. Must be one of: live, record, replay\n`);
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
		process.stderr.write(`Error parsing arguments: ${error}\n`);
		process.exit(1);
	}
}

// ============================================================================
// Validation
// ============================================================================

function validateArgs(args: CliArgs): void {
	if (args.mode === "replay") {
		if (!args.recordingId) {
			process.stderr.write("Error: --recording is required for replay mode\n");
			process.exit(1);
		}
	} else {
		// live or record mode requires PRD file
		if (!args.prdFile) {
			process.stderr.write(`Error: PRD file is required for ${args.mode} mode\n`);
			showHelp();
			process.exit(1);
		}

		if (!existsSync(args.prdFile)) {
			process.stderr.write(`Error: PRD file not found: ${args.prdFile}\n`);
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
	const { getLogger } = await import("@internal/core");
	const { terminalAdapter, logsAdapter } = await import("@internal/signals/adapters");
	const { prdRenderers } = await import("./renderers.js");

	// Create logger for CLI messages and as adapter dependency
	const logger = getLogger();

	// Create adapters for signal rendering
	// - terminalAdapter: renders workflow signals to stdout with ANSI colors
	// - logsAdapter: bridges signals to Pino for structured JSONL logging
	const adapters = [terminalAdapter({ renderers: prdRenderers }), logsAdapter({ logger })];

	// Ensure database directory exists
	const dbDir = dirname(resolve(args.database));
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	logger.info(
		{
			mode: args.mode,
			database: args.database,
		},
		"PRD Workflow CLI starting",
	);

	if (args.mode === "replay") {
		// Replay mode: load signals from recording
		logger.info({ recordingId: args.recordingId }, "Replay mode");

		const store = new SqliteSignalStore(args.database);

		try {
			const exists = await store.exists(args.recordingId as string);
			if (!exists) {
				logger.error({ recordingId: args.recordingId }, "Recording not found");
				process.exit(1);
			}

			const recording = await store.load(args.recordingId as string);
			if (!recording) {
				logger.error({ recordingId: args.recordingId }, "Failed to load recording");
				process.exit(1);
			}

			logger.info(
				{
					recordingId: args.recordingId,
					signalCount: recording.metadata.signalCount,
				},
				"Replaying recording",
			);

			const startTime = performance.now();

			const result = await runPRDWorkflow({
				prd: "", // PRD comes from the recorded signals
				agents: { planner: plannerAgent }, // Agents still needed - they react to replayed harness signals
				adapters,
				recording: {
					mode: "replay",
					store,
					recordingId: args.recordingId as string,
				},
			});

			const durationMs = Math.round(performance.now() - startTime);
			logger.info(
				{
					durationMs,
					phase: result.state.review.phase,
					taskCount: Object.keys(result.state.planning.allTasks).length,
					milestonesPassedCount: result.state.review.passedMilestones.length,
				},
				"Replay complete",
			);
		} finally {
			store.close();
		}
	} else {
		// Live or Record mode: run against Claude API
		const prdContent = readFileSync(args.prdFile as string, "utf-8");
		logger.info(
			{
				prdFile: args.prdFile,
				sandbox: args.sandbox,
			},
			"Loading PRD",
		);

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
			logger.info(
				{
					name: args.name ?? "(auto)",
					tags: args.tags,
				},
				"Recording mode - calling Claude API",
			);

			try {
				const result = await runPRDWorkflow({
					prd: prdContent,
					agents: { planner: plannerAgent },
					harness,
					adapters,
					recording: {
						mode: "record",
						store,
						name: args.name,
						tags: args.tags,
					},
				});

				const durationMs = Math.round(performance.now() - startTime);
				logger.info(
					{
						durationMs,
						recordingId: result.recordingId ?? "(unknown)",
						phase: result.state.review.phase,
					},
					"Recording complete",
				);
			} finally {
				store.close();
			}
		} else {
			// Live mode
			logger.info({}, "Live mode - calling Claude API");

			const result = await runPRDWorkflow({
				prd: prdContent,
				agents: { planner: plannerAgent },
				harness,
				adapters,
			});

			const durationMs = Math.round(performance.now() - startTime);
			logger.info(
				{
					durationMs,
					phase: result.state.review.phase,
					taskCount: Object.keys(result.state.planning.allTasks).length,
					milestonesPassedCount: result.state.review.passedMilestones.length,
				},
				"Workflow complete",
			);
		}
	}
}

// Run the CLI
main().catch((error) => {
	// Use stderr for CLI errors since logger may not be initialized
	process.stderr.write(`\nCLI Error: ${error}\n`);
	process.exit(1);
});
