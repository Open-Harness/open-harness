#!/usr/bin/env bun

/**
 * Horizon Agent CLI
 *
 * Commands:
 *   run <feature> [--flow <path>] [--no-tui]    Run a feature implementation
 *   start [--flow <path>] [--port <number>]     Start the WebSocket server
 *   status                                       Get server status
 *   pause                                        Pause the running flow
 *   resume [--message <msg>]                     Resume a paused flow
 */

import { resolve } from "node:path";
import { Command } from "commander";
import { flowLogger, flushLogs, logFilePath, nodeLogger } from "./logger.js";
import { createHorizonRuntime, type HorizonRuntime } from "./runtime/horizon-runtime.js";
import { createHorizonServer } from "./server.js";
import { HorizonTui } from "./ui/HorizonTui.js";

const program = new Command();

program.name("horizon").description("Multi-agent implementation system").version("0.2.0");

// Run command - main entry point
program
	.command("run <feature>")
	.description("Run a feature implementation")
	.option("-f, --flow <path>", "Flow file path", "./flows/agent-loop.yaml")
	.option("-m, --max-iterations <number>", "Max review iterations", "5")
	.option("--no-tui", "Disable terminal UI (headless mode)")
	.option("-v, --verbose", "Verbose output (headless mode only)")
	.action(async (feature: string, options) => {
		const flowPath = resolve(options.flow);
		const maxIterations = Number.parseInt(options.maxIterations, 10);
		const useTui = options.tui !== false;
		const verbose = options.verbose ?? false;

		console.log("Horizon Agent v2 (kernel-v3)");
		console.log("============================");
		console.log(`Feature: ${feature}`);
		console.log(`Flow: ${flowPath}`);
		console.log(`Max iterations: ${maxIterations}`);
		console.log(`UI: ${useTui ? "TUI" : "headless"}`);
		console.log("");
		console.log(`Log file: ${logFilePath}`);
		console.log("");

		flowLogger.info({ feature, flowPath, maxIterations }, "Starting flow run");

		try {
			// Create Horizon runtime
			const runtime = createHorizonRuntime({
				flowPath,
				enablePersistence: true,
			});

			if (useTui) {
				// Run with Terminal UI
				await runWithTui(runtime, feature, maxIterations);
			} else {
				// Run headless
				await runHeadless(runtime, feature, maxIterations, verbose);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;

			flowLogger.error({ error: errorMessage, stack: errorStack }, "Flow failed");

			console.error("\nFlow failed:");
			if (error instanceof Error) {
				console.error("  Message:", error.message);
				if (verbose) {
					console.error("  Stack:", error.stack);
				}
			} else {
				console.error("  Error:", error);
			}

			await flushLogs();
			process.exit(1);
		}
	});

/**
 * Run with Terminal UI.
 */
async function runWithTui(runtime: HorizonRuntime, feature: string, maxIterations: number): Promise<void> {
	// Create TUI - it takes over the terminal and handles its own lifecycle.
	// The TUI subscribes to runtime events and handles shutdown via keybindings.
	// On flow completion, the TUI auto-exits after a brief delay.
	new HorizonTui({ runtime });

	// Run the workflow and wait for completion
	// The TUI will display progress and handle user interactions
	await runtime.run({
		feature,
		maxReviewIterations: maxIterations,
	});

	// TUI handles auto-exit on flow:complete/flow:aborted events.
	// This function may never return if the user quits early via 'q'.
}

/**
 * Run in headless mode (no TUI).
 */
async function runHeadless(
	runtime: HorizonRuntime,
	feature: string,
	maxIterations: number,
	verbose: boolean,
): Promise<void> {
	// Subscribe to events for console output
	runtime.onEvent((event) => {
		switch (event.type) {
			case "flow:start":
				console.log("\n▶ Flow started");
				break;

			case "node:start": {
				const e = event as { nodeId: string };
				console.log(`\n[${e.nodeId}] Starting...`);
				nodeLogger.info({ nodeId: e.nodeId }, `Node ${e.nodeId} starting`);
				break;
			}

			case "node:complete": {
				const e = event as { nodeId: string; output?: unknown };
				console.log(`[${e.nodeId}] ✓ Complete`);
				nodeLogger.info({ nodeId: e.nodeId, output: e.output }, `Node ${e.nodeId} complete`);

				if (verbose && e.output) {
					const preview = JSON.stringify(e.output, null, 2).slice(0, 500);
					console.log(`  Output: ${preview}...`);
				}
				break;
			}

			case "node:error": {
				const e = event as { nodeId: string; error: string };
				console.error(`[${e.nodeId}] ✗ Error: ${e.error}`);
				nodeLogger.error({ nodeId: e.nodeId, error: e.error }, `Node error`);
				break;
			}

			case "agent:text:delta":
			case "agent:text": {
				if (verbose) {
					const e = event as { content: string };
					process.stdout.write(e.content);
				}
				break;
			}

			case "agent:tool": {
				const e = event as { toolName: string; durationMs?: number };
				if (verbose) {
					console.log(`  🔧 ${e.toolName} (${e.durationMs ?? "?"}ms)`);
				}
				break;
			}

			case "loop:iterate": {
				const e = event as { iteration: number };
				console.log(`\n↻ Review iteration ${e.iteration}`);
				flowLogger.info({ iteration: e.iteration }, "Loop iteration");
				break;
			}

			case "flow:complete": {
				const e = event as { status?: string };
				if (e.status === "failed") {
					console.log("\n✗ Flow failed");
				} else {
					console.log("\n✓ Flow completed successfully!");
				}
				break;
			}

			case "flow:paused":
				console.log("\n⏸ Flow paused");
				break;

			case "flow:aborted":
				console.log("\n⏹ Flow aborted");
				break;
		}
	});

	// Run the workflow
	const result = await runtime.run({
		feature,
		maxReviewIterations: maxIterations,
	});

	flowLogger.info({ outputs: Object.keys(result.outputs) }, "Flow completed successfully");

	console.log("\n============================");
	console.log("Flow Complete!");
	console.log(`Outputs: ${Object.keys(result.outputs).length} nodes`);

	if (verbose) {
		console.log("\nFull outputs:");
		console.log(JSON.stringify(result.outputs, null, 2));
	}

	await flushLogs();
}

// Start server command
program
	.command("start")
	.description("Start the Horizon Agent WebSocket server")
	.option("-f, --flow <path>", "Default flow file path", "./flows/agent-loop.yaml")
	.option("-p, --port <number>", "Server port", "3002")
	.action(async (options) => {
		const flowPath = resolve(options.flow);
		const port = Number.parseInt(options.port, 10);

		console.log("Starting Horizon Agent server (v2)...");
		console.log(`  Flow: ${flowPath}`);
		console.log(`  Port: ${port}`);

		await createHorizonServer({
			port,
			flowPath,
		});

		console.log("\nServer is running. Press Ctrl+C to stop.");
		console.log(`\nConnect via WebSocket at ws://localhost:${port}/ws`);
		console.log("\nCommands you can send:");
		console.log('  { "type": "start", "input": { "feature": "..." } }');
		console.log('  { "type": "pause" }');
		console.log('  { "type": "resume", "message": "..." }');
		console.log('  { "type": "status" }');

		// Keep process running
		await new Promise(() => {});
	});

// Status command
program
	.command("status")
	.description("Get server status")
	.option("-p, --port <number>", "Server port", "3002")
	.action(async (options) => {
		const port = options.port;
		try {
			const response = await fetch(`http://localhost:${port}/status`);
			const status = await response.json();
			console.log("Horizon Agent Status:");
			console.log(JSON.stringify(status, null, 2));
		} catch {
			console.error(`Cannot connect to server on port ${port}`);
			process.exit(1);
		}
	});

// Pause command
program
	.command("pause")
	.description("Pause the running flow")
	.option("-p, --port <number>", "Server port", "3002")
	.action(async (options) => {
		const port = options.port;
		await sendWebSocketCommand(port, { type: "pause" });
	});

// Resume command
program
	.command("resume")
	.description("Resume a paused flow")
	.option("-p, --port <number>", "Server port", "3002")
	.option("-m, --message <msg>", "Message to inject on resume")
	.action(async (options) => {
		const port = options.port;
		await sendWebSocketCommand(port, {
			type: "resume",
			message: options.message,
		});
	});

/**
 * Send a command to the WebSocket server.
 */
async function sendWebSocketCommand(port: string, command: Record<string, unknown>): Promise<void> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://localhost:${port}/ws`);
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const cleanup = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		};

		ws.onopen = () => {
			ws.send(JSON.stringify(command));
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data as string);
			if (data.type === "ack") {
				console.log(`✓ ${data.message}`);
				cleanup();
				ws.close();
				resolve();
			} else if (data.type === "error") {
				console.error(`✗ ${data.error}`);
				cleanup();
				ws.close();
				reject(new Error(data.error));
			}
		};

		ws.onerror = () => {
			console.error(`Cannot connect to server on port ${port}`);
			cleanup();
			reject(new Error("Connection failed"));
		};

		// Timeout after 5 seconds
		timeoutId = setTimeout(() => {
			ws.close();
			reject(new Error("Command timeout"));
		}, 5000);
	});
}

program.parse();
