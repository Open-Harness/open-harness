#!/usr/bin/env node
/**
 * Open Scaffold CLI
 *
 * A generic CLI for running any workflow with a terminal UI.
 *
 * Usage:
 *   scaffold run ./workflow.ts --input "Build REST API"
 *   scaffold replay --session abc123
 *   scaffold list
 *
 * @module
 */

import { program } from "commander"

// Use dynamic imports for commands with TUI dependencies
// This prevents OpenTUI from loading when running 'list' command

program
  .name("scaffold")
  .description("Open Scaffold CLI - Run workflows from the terminal")
  .version("0.0.0")

// Run command (dynamic import to avoid loading OpenTUI eagerly)
program
  .command("run")
  .description("Run a workflow from a TypeScript file")
  .argument("<workflow>", "Path to the workflow .ts file")
  .requiredOption("-i, --input <input>", "Input to start the workflow with")
  .option("-d, --database <path>", "Database file path", "./scaffold.db")
  .option("--no-record", "Disable recording")
  .option("--headless", "Run without TUI (output events as JSON lines)")
  .action(async (workflowPath: string, options: unknown) => {
    const { runCommand } = await import("./commands/run.js")
    await runCommand(workflowPath, options as Parameters<typeof runCommand>[1])
  })

// Replay command (dynamic import to avoid loading OpenTUI eagerly)
program
  .command("replay")
  .description("Replay a recorded session")
  .requiredOption("-s, --session <id>", "Session ID to replay")
  .option("-d, --database <path>", "Database file path", "./scaffold.db")
  .option("--headless", "Run without TUI (output events as JSON lines)")
  .action(async (options: unknown) => {
    const { replayCommand } = await import("./commands/replay.js")
    await replayCommand(options as Parameters<typeof replayCommand>[0])
  })

// List command (no TUI, import directly)
program
  .command("list")
  .description("List recorded sessions")
  .option("-d, --database <path>", "Database file path", "./scaffold.db")
  .option("-n, --limit <n>", "Number of sessions to show", "10")
  .action(async (options: unknown) => {
    const { listCommand } = await import("./commands/list.js")
    await listCommand(options as Parameters<typeof listCommand>[0])
  })

program.parse()
