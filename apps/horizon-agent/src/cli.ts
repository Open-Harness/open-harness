#!/usr/bin/env bun

/**
 * Horizon Agent CLI
 *
 * Commands:
 *   start [--flow <path>] [--port <number>]  Start the agent server
 *   run <feature> [--flow <path>]            Run a feature implementation directly
 *   status                                    Get server status
 *   inject <message>                          Inject a message into running flow
 *   pause                                     Pause the running flow
 *   resume [--message <msg>]                  Resume a paused flow
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import type { EnrichedEvent, FlowYaml } from "@open-harness/kernel";
import { executeFlow, HubImpl, NodeRegistry } from "@open-harness/kernel";
import { Command } from "commander";
import { parse as parseYaml } from "yaml";
import { flowLogger, flushLogs, logFilePath, logger, nodeLogger } from "./logger.js";
import { createHorizonServer } from "./server.js";

const program = new Command();

program.name("horizon").description("Multi-agent implementation system").version("0.1.0");

// Start server command
program
	.command("start")
	.description("Start the Horizon Agent WebSocket server")
	.option("-f, --flow <path>", "Default flow file path", "./flows/agent-loop.yaml")
	.option("-p, --port <number>", "Server port", "3002")
	.action(async (options) => {
		const flowPath = resolve(options.flow);
		const port = parseInt(options.port, 10);

		console.log("Starting Horizon Agent server...");
		console.log(`  Flow: ${flowPath}`);
		console.log(`  Port: ${port}`);

		await createHorizonServer({
			port,
			flowPath,
		});

		console.log("\nServer is running. Press Ctrl+C to stop.");
		console.log("\nConnect via WebSocket at ws://localhost:" + port + "/ws");
		console.log("\nCommands you can send:");
		console.log('  { "type": "start", "input": { "feature": "..." } }');
		console.log('  { "type": "pause" }');
		console.log('  { "type": "resume", "message": "..." }');
		console.log('  { "type": "inject", "message": "..." }');
		console.log('  { "type": "status" }');

		// Keep process running
		await new Promise(() => {});
	});

// Run directly command (no server)
program
	.command("run <feature>")
	.description("Run a feature implementation directly (no server)")
	.option("-f, --flow <path>", "Flow file path", "./flows/agent-loop.yaml")
	.option("-m, --max-iterations <number>", "Max review iterations", "5")
	.option("-v, --verbose", "Verbose output")
	.option("-i, --interactive", "Enable interactive mode (stdin commands)")
	.action(async (feature: string, options) => {
		const flowPath = resolve(options.flow);
		const maxIterations = parseInt(options.maxIterations, 10);
		const verbose = options.verbose ?? false;
		const interactive = options.interactive ?? false;

		console.log("Horizon Agent - Direct Run");
		console.log("===========================");
		console.log(`Feature: ${feature}`);
		console.log(`Flow: ${flowPath}`);
		console.log(`Max review iterations: ${maxIterations}`);
		console.log(`Interactive: ${interactive ? "yes" : "no"}`);
		console.log("");
		console.log(`📋 Log file: ${logFilePath}`);
		console.log(`   Tail with: tail -f ${logFilePath}`);
		console.log("");

		if (interactive) {
			console.log("📌 Interactive commands:");
			console.log("   pause    - Pause the flow");
			console.log("   resume   - Resume the flow");
			console.log("   status   - Show flow status");
			console.log("   inject <msg> - Inject a message");
			console.log("   quit     - Abort and exit");
			console.log("");
		}

		// Log run start
		flowLogger.info({ feature, flowPath, maxIterations }, "Starting flow run");

		// Declare variables outside try block for catch block access
		let rl: ReadlineInterface | null = null;
		let flowState: "running" | "paused" | "completed" | "aborted" = "running";

		try {
			// Load flow
			const yamlContent = readFileSync(flowPath, "utf-8");
			const flow = parseYaml(yamlContent) as FlowYaml;
			flowLogger.debug({ flowName: flow.flow?.name }, "Flow loaded");

			// Create hub and registry
			const sessionId = `horizon-run-${Date.now()}`;
			const hub = new HubImpl(sessionId);
			const registry = new NodeRegistry();
			flowLogger.debug({ sessionId }, "Hub and registry created");

			// Register nodes
			await registerNodePacks(registry);
			flowLogger.debug("Node packs registered");

			// Subscribe to events for progress output and logging
			hub.subscribe("node:start", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string };
				console.log(`\n[${e.nodeId}] Starting...`);
				nodeLogger.info({ nodeId: e.nodeId, event: "start" }, `Node ${e.nodeId} starting`);
			});

			hub.subscribe("node:complete", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string; output?: unknown };
				console.log(`[${e.nodeId}] Complete`);

				// Log full output to file
				nodeLogger.info({ nodeId: e.nodeId, event: "complete", output: e.output }, `Node ${e.nodeId} complete`);

				if (verbose && e.output) {
					console.log(`  Output: ${JSON.stringify(e.output, null, 2).slice(0, 200)}...`);
				}
			});

			hub.subscribe("loop:iterate", (event: EnrichedEvent) => {
				const e = event.event as unknown as {
					edgeFrom: string;
					edgeTo: string;
					iteration: number;
					maxIterations: number;
				};
				console.log(`\n[LOOP] ${e.edgeFrom} → ${e.edgeTo} (iteration ${e.iteration}/${e.maxIterations})`);
				flowLogger.info(
					{
						event: "loop:iterate",
						from: e.edgeFrom,
						to: e.edgeTo,
						iteration: e.iteration,
						maxIterations: e.maxIterations,
					},
					`Loop iteration ${e.iteration}/${e.maxIterations}`,
				);
			});

			hub.subscribe("node:error", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string; error: string };
				console.error(`[${e.nodeId}] ERROR: ${e.error}`);
				nodeLogger.error({ nodeId: e.nodeId, error: e.error }, `Node ${e.nodeId} error`);
			});

			// Interactive stdin handler
			let currentNode = "";
			const injectedMessages: string[] = [];

			// Resume mechanism - resolver is set when paused, called when user types "resume"
			let resumeResolver: ((msg: string) => void) | null = null;

			// Track current node
			hub.subscribe("node:start", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string };
				currentNode = e.nodeId;
			});

			if (interactive) {
				rl = createInterface({
					input: process.stdin,
					output: process.stdout,
					prompt: "horizon> ",
				});

				rl.on("line", (line) => {
					const cmd = line.trim().toLowerCase();
					const args = line.trim().slice(cmd.split(" ")[0].length).trim();

					if (cmd === "pause") {
						if (flowState === "running") {
							hub.abort({ resumable: true });
							flowState = "paused";
							console.log("⏸️  Flow paused. Use 'resume' to continue.");
							flowLogger.info("Flow paused by user");
						} else {
							console.log(`Cannot pause: flow is ${flowState}`);
						}
					} else if (cmd === "resume" || cmd.startsWith("resume ")) {
						if (flowState === "paused" && resumeResolver) {
							const resumeMsg = args || "user resumed";
							flowState = "running";
							console.log("▶️  Flow resumed.");
							flowLogger.info({ message: resumeMsg }, "Flow resumed by user");
							// Trigger the resume - this unblocks the execution loop
							resumeResolver(resumeMsg);
							resumeResolver = null;
						} else if (flowState !== "paused") {
							console.log(`Cannot resume: flow is ${flowState}`);
						} else {
							console.log("Resume not ready - flow may still be stopping");
						}
					} else if (cmd === "status") {
						console.log(`📊 Status:`);
						console.log(`   State: ${flowState}`);
						console.log(`   Current node: ${currentNode || "none"}`);
						console.log(`   Hub status: ${hub.status}`);
						console.log(`   Injected messages: ${injectedMessages.length}`);
					} else if (cmd.startsWith("inject")) {
						const msg = args || line.slice(7).trim();
						if (msg) {
							injectedMessages.push(msg);
							console.log(`💉 Message queued: "${msg}"`);
							flowLogger.info({ message: msg }, "Message injected");
							// Emit inject event for the flow to pick up
							hub.emit({ type: "user:inject", message: msg });
						} else {
							console.log("Usage: inject <message>");
						}
					} else if (cmd === "quit" || cmd === "exit") {
						console.log("🛑 Aborting flow...");
						hub.abort();
						flowState = "aborted";
						flowLogger.info("Flow aborted by user");
						rl?.close();
					} else if (cmd === "help") {
						console.log("Commands: pause, resume, status, inject <msg>, quit, help");
					} else if (cmd) {
						console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
					}

					if (rl && flowState !== "completed" && flowState !== "aborted") {
						rl.prompt();
					}
				});

				rl.on("close", () => {
					if (flowState !== "completed" && flowState !== "aborted") {
						console.log("\n👋 Stdin closed, flow continues in background.");
					}
				});

				// Start the prompt after a brief delay to let flow output appear first
				setTimeout(() => rl?.prompt(), 500);
			}

			// Claude-specific events for detailed observability
			hub.subscribe("claude:message", (event: EnrichedEvent) => {
				const e = event.event as unknown as {
					messageType: string;
					messageCount: number;
					details: Record<string, unknown>;
				};

				// Log to file with full details
				nodeLogger.debug(
					{ event: "claude:message", messageType: e.messageType, count: e.messageCount, details: e.details },
					`Claude message #${e.messageCount}: ${e.messageType}`,
				);

				// Show brief progress to console
				if (verbose) {
					if (e.messageType === "tool_use" && e.details.tool) {
						console.log(`    🔧 Tool: ${e.details.tool}`);
					} else if (e.messageType === "assistant" && e.details.contentPreview) {
						console.log(`    💬 ${String(e.details.contentPreview).slice(0, 60)}...`);
					}
				}
			});

			hub.subscribe("claude:complete", (event: EnrichedEvent) => {
				const e = event.event as unknown as {
					messageCount: number;
					success: boolean;
					durationMs?: number;
					numTurns?: number;
				};

				nodeLogger.info(
					{
						event: "claude:complete",
						messageCount: e.messageCount,
						success: e.success,
						durationMs: e.durationMs,
						numTurns: e.numTurns,
					},
					`Claude complete: ${e.messageCount} messages, ${e.numTurns} turns, ${e.durationMs}ms`,
				);

				if (verbose) {
					console.log(`    ✅ ${e.numTurns} turns, ${e.durationMs}ms`);
				}
			});

			// Execute flow with pause/resume support
			console.log("\nExecuting flow...\n");
			flowLogger.info("Flow execution starting");

			let flowComplete = false;
			let result: { outputs: Record<string, unknown> } = { outputs: {} };

			while (!flowComplete) {
				result = await executeFlow(flow, registry, hub, {
					feature,
					maxReviewIterations: maxIterations,
				});

				// Check if flow paused vs completed
				if (hub.status === "paused") {
					flowState = "paused";
					console.log("\n⏸️  Flow paused. Type 'resume' to continue.");
					flowLogger.info({ nodeId: currentNode }, "Flow paused, waiting for resume");

					// Wait for resume command - this Promise is resolved by the readline handler
					const resumeMessage = await new Promise<string>((resolve) => {
						resumeResolver = resolve;
					});

					// Resume the hub and loop back to re-execute
					await hub.resume(sessionId, resumeMessage);
					flowState = "running";
					console.log("\n▶️  Resuming flow execution...\n");
					flowLogger.info({ message: resumeMessage }, "Flow resuming");
				} else {
					// Flow completed normally
					flowComplete = true;
				}
			}

			flowLogger.info({ outputs: Object.keys(result.outputs) }, "Flow completed successfully");
			flowState = "completed";

			console.log("\n===========================");
			console.log("Flow Complete!");
			console.log(`\nOutputs: ${Object.keys(result.outputs).length} nodes`);

			if (verbose) {
				console.log("\nFull outputs:");
				console.log(JSON.stringify(result.outputs, null, 2));
			}

			// Clean up interactive mode
			if (rl) {
				rl.close();
			}

			await flushLogs();
		} catch (error) {
			flowState = "aborted";
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;

			flowLogger.error({ error: errorMessage, stack: errorStack }, "Flow failed");

			console.error("\nFlow failed:");
			if (error instanceof Error) {
				console.error("  Message:", error.message);
				console.error("  Stack:", error.stack);
			} else {
				console.error("  Error:", error);
			}

			// Clean up interactive mode
			if (rl) {
				rl.close();
			}

			await flushLogs();
			process.exit(1);
		}
	});

// Status command (connects to server)
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

// Inject command (connects to server)
program
	.command("inject <message>")
	.description("Inject a message into the running flow")
	.option("-p, --port <number>", "Server port", "3002")
	.action(async (message: string, options) => {
		const port = options.port;
		await sendWebSocketCommand(port, { type: "inject", message });
	});

// Pause command (connects to server)
program
	.command("pause")
	.description("Pause the running flow")
	.option("-p, --port <number>", "Server port", "3002")
	.action(async (options) => {
		const port = options.port;
		await sendWebSocketCommand(port, { type: "pause" });
	});

// Resume command (connects to server)
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

		ws.onopen = () => {
			ws.send(JSON.stringify(command));
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data as string);
			if (data.type === "ack") {
				console.log(`✓ ${data.message}`);
				ws.close();
				resolve();
			} else if (data.type === "error") {
				console.error(`✗ ${data.error}`);
				ws.close();
				reject(new Error(data.error));
			}
		};

		ws.onerror = () => {
			console.error(`Cannot connect to server on port ${port}`);
			reject(new Error("Connection failed"));
		};

		// Timeout after 5 seconds
		setTimeout(() => {
			ws.close();
			reject(new Error("Command timeout"));
		}, 5000);
	});
}

/**
 * Register node packs.
 */
async function registerNodePacks(registry: NodeRegistry): Promise<void> {
	const {
		claudeNode,
		echoNode,
		constantNode,
		controlIfNode,
		controlSwitchNode,
		controlNoopNode,
		controlFailNode,
		controlForeachNode,
	} = await import("@open-harness/kernel");

	// Register core control nodes
	registry.register(controlIfNode);
	registry.register(controlSwitchNode);
	registry.register(controlNoopNode);
	registry.register(controlFailNode);
	registry.register(controlForeachNode);

	// Register utility nodes
	registry.register(echoNode);
	registry.register(constantNode);

	// Register claude agent node
	registry.register(claudeNode);
}

program.parse();
