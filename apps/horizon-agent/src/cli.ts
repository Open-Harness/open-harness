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

import { Command } from "commander";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { FlowYaml } from "@open-harness/kernel";
import { HubImpl } from "@open-harness/kernel";
import { executeFlow } from "@open-harness/kernel";
import { NodeRegistry } from "@open-harness/kernel";
import type { EnrichedEvent } from "@open-harness/kernel";
import { createHorizonServer } from "./server.js";

const program = new Command();

program
	.name("horizon")
	.description("Multi-agent implementation system")
	.version("0.1.0");

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
	.action(async (feature: string, options) => {
		const flowPath = resolve(options.flow);
		const maxIterations = parseInt(options.maxIterations, 10);
		const verbose = options.verbose ?? false;

		console.log("Horizon Agent - Direct Run");
		console.log("===========================");
		console.log(`Feature: ${feature}`);
		console.log(`Flow: ${flowPath}`);
		console.log(`Max review iterations: ${maxIterations}`);
		console.log("");

		try {
			// Load flow
			const yamlContent = readFileSync(flowPath, "utf-8");
			const flow = parseYaml(yamlContent) as FlowYaml;

			// Create hub and registry
			const sessionId = `horizon-run-${Date.now()}`;
			const hub = new HubImpl(sessionId);
			const registry = new NodeRegistry();

			// Register nodes
			await registerNodePacks(registry);

			// Subscribe to events for progress output
			hub.subscribe("node:start", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string };
				console.log(`\n[${e.nodeId}] Starting...`);
			});

			hub.subscribe("node:complete", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string; output?: unknown };
				console.log(`[${e.nodeId}] Complete`);
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
			});

			hub.subscribe("node:error", (event: EnrichedEvent) => {
				const e = event.event as { nodeId: string; error: string };
				console.error(`[${e.nodeId}] ERROR: ${e.error}`);
			});

			// Execute flow
			console.log("\nExecuting flow...\n");
			const result = await executeFlow(flow, registry, hub, {
				feature,
				maxReviewIterations: maxIterations,
			});

			console.log("\n===========================");
			console.log("Flow Complete!");
			console.log(`\nOutputs: ${Object.keys(result.outputs).length} nodes`);

			if (verbose) {
				console.log("\nFull outputs:");
				console.log(JSON.stringify(result.outputs, null, 2));
			}
		} catch (error) {
			console.error("\nFlow failed:", error instanceof Error ? error.message : String(error));
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
async function sendWebSocketCommand(
	port: string,
	command: Record<string, unknown>,
): Promise<void> {
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
