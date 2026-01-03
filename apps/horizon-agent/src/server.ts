/**
 * Horizon Agent WebSocket Server
 *
 * Extends the kernel's WebSocket channel pattern with horizon-specific commands:
 * - start: Start a new flow execution
 * - pause: Pause the current flow (resumable)
 * - resume: Resume a paused flow with optional message injection
 * - inject: Inject a message into the running flow
 * - status: Get current flow status
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EnrichedEvent, FlowYaml } from "@open-harness/kernel";
import { executeFlow, HubImpl, NodeRegistry } from "@open-harness/kernel";
import type { Server, ServerWebSocket } from "bun";
import { parse as parseYaml } from "yaml";

/** WebSocket data attached to each connection */
interface WSData {
	id: string;
}

/** Server configuration */
export interface HorizonServerConfig {
	/** Port to listen on (default: 3002) */
	port?: number;
	/** Path for WebSocket connections (default: "/ws") */
	path?: string;
	/** Default flow file path */
	flowPath?: string;
}

/** Command message from client */
interface HorizonCommand {
	type: "start" | "pause" | "resume" | "inject" | "status";
	/** For start: flow input */
	input?: Record<string, unknown>;
	/** For start: override flow path */
	flowPath?: string;
	/** For resume/inject: message to inject */
	message?: string;
	/** For resume: session ID to resume */
	sessionId?: string;
}

/** Server state */
interface ServerState {
	hub: HubImpl | null;
	registry: NodeRegistry | null;
	currentFlow: FlowYaml | null;
	isRunning: boolean;
	sessionId: string | null;
}

/**
 * Create and start a Horizon Agent WebSocket server.
 */
export async function createHorizonServer(config: HorizonServerConfig = {}): Promise<Server<WSData>> {
	const port = config.port ?? 3002;
	const wsPath = config.path ?? "/ws";

	const state: ServerState = {
		hub: null,
		registry: null,
		currentFlow: null,
		isRunning: false,
		sessionId: null,
	};

	const clients = new Set<ServerWebSocket<WSData>>();

	const server = Bun.serve<WSData>({
		port,
		fetch(req, server) {
			const url = new URL(req.url);

			// Upgrade WebSocket connections
			if (url.pathname === wsPath) {
				const upgraded = server.upgrade(req, {
					data: { id: crypto.randomUUID() },
				});
				if (upgraded) return undefined;
				return new Response("WebSocket upgrade failed", { status: 400 });
			}

			// Health check endpoint
			if (url.pathname === "/health") {
				return new Response(
					JSON.stringify({
						status: "ok",
						clients: clients.size,
						flowRunning: state.isRunning,
						sessionId: state.sessionId,
					}),
					{ headers: { "Content-Type": "application/json" } },
				);
			}

			// Status endpoint
			if (url.pathname === "/status") {
				return new Response(
					JSON.stringify({
						isRunning: state.isRunning,
						sessionId: state.sessionId,
						hubStatus: state.hub?.status ?? null,
						flowName: state.currentFlow?.flow?.name ?? null,
					}),
					{ headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response("Not Found", { status: 404 });
		},

		websocket: {
			open(ws: ServerWebSocket<WSData>) {
				clients.add(ws);
				broadcast(clients, {
					type: "server:connected",
					clientId: ws.data.id,
					clientCount: clients.size,
				});
			},

			close(ws: ServerWebSocket<WSData>) {
				clients.delete(ws);
				broadcast(clients, {
					type: "server:disconnected",
					clientId: ws.data.id,
					clientCount: clients.size,
				});
			},

			async message(ws: ServerWebSocket<WSData>, message) {
				await handleCommand(ws, message, state, clients, config);
			},
		},
	});

	console.log(`Horizon Agent server started on ws://localhost:${port}${wsPath}`);
	return server;
}

/**
 * Handle incoming command from WebSocket client.
 */
async function handleCommand(
	ws: ServerWebSocket<WSData>,
	message: string | Buffer,
	state: ServerState,
	clients: Set<ServerWebSocket<WSData>>,
	config: HorizonServerConfig,
): Promise<void> {
	try {
		const msgStr = typeof message === "string" ? message : message.toString();
		const command = JSON.parse(msgStr) as HorizonCommand;

		switch (command.type) {
			case "start":
				await handleStart(ws, command, state, clients, config);
				break;

			case "pause":
				handlePause(ws, state);
				break;

			case "resume":
				await handleResume(ws, command, state, clients);
				break;

			case "inject":
				handleInject(ws, command, state);
				break;

			case "status":
				handleStatus(ws, state);
				break;

			default:
				sendError(ws, `Unknown command: ${(command as { type: string }).type}`);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Parse error";
		sendError(ws, errorMessage);
	}
}

/**
 * Handle start command - begin flow execution.
 */
async function handleStart(
	ws: ServerWebSocket<WSData>,
	command: HorizonCommand,
	state: ServerState,
	clients: Set<ServerWebSocket<WSData>>,
	config: HorizonServerConfig,
): Promise<void> {
	if (state.isRunning) {
		sendError(ws, "Flow is already running. Pause or wait for completion.");
		return;
	}

	const flowPath = command.flowPath ?? config.flowPath;
	if (!flowPath) {
		sendError(ws, "No flow path specified");
		return;
	}

	try {
		// Load flow YAML
		const absolutePath = resolve(flowPath);
		const yamlContent = readFileSync(absolutePath, "utf-8");
		const flow = parseYaml(yamlContent) as FlowYaml;
		state.currentFlow = flow;

		// Create new hub and registry
		state.sessionId = `horizon-${Date.now()}`;
		state.hub = new HubImpl(state.sessionId);
		state.registry = new NodeRegistry();

		// Register node packs (simplified - in production, load from oh.config.ts)
		await registerNodePacks(state.registry);

		// Subscribe to hub events and broadcast
		state.hub.subscribe("*", (event: EnrichedEvent) => {
			broadcast(clients, {
				type: "flow:event",
				event: {
					id: event.id,
					timestamp: event.timestamp.toISOString(),
					context: event.context,
					payload: event.event,
				},
			});
		});

		state.isRunning = true;
		sendAck(ws, "start", `Flow started: ${flow.flow.name}`);

		// Execute flow (don't await - runs in background)
		executeFlow(flow, state.registry, state.hub, command.input)
			.then((result) => {
				// Check if flow paused vs completed
				if (state.hub?.status === "paused") {
					// Flow paused - don't mark as not running, broadcast paused
					broadcast(clients, {
						type: "flow:paused",
						sessionId: state.sessionId,
					});
				} else {
					state.isRunning = false;
					broadcast(clients, {
						type: "flow:complete",
						outputs: result.outputs,
					});
				}
			})
			.catch((error) => {
				state.isRunning = false;
				broadcast(clients, {
					type: "flow:error",
					error: error instanceof Error ? error.message : String(error),
				});
			});
	} catch (error) {
		state.isRunning = false;
		sendError(ws, `Failed to start flow: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Handle pause command - pause flow execution (resumable).
 */
function handlePause(ws: ServerWebSocket<WSData>, state: ServerState): void {
	if (!state.isRunning || !state.hub) {
		sendError(ws, "No flow is running");
		return;
	}

	state.hub.abort({ reason: "User requested pause", resumable: true });
	sendAck(ws, "pause", "Flow paused");
}

/**
 * Handle resume command - resume paused flow.
 */
async function handleResume(
	ws: ServerWebSocket<WSData>,
	command: HorizonCommand,
	state: ServerState,
	clients: Set<ServerWebSocket<WSData>>,
): Promise<void> {
	if (!state.hub || !state.sessionId) {
		sendError(ws, "No paused session to resume");
		return;
	}

	const sessionId = command.sessionId ?? state.sessionId;

	try {
		// Use default message if not provided (hub.resume requires non-empty message)
		const resumeMessage = command.message?.trim() || "user resumed flow";
		await state.hub.resume(sessionId, resumeMessage);
		state.isRunning = true;
		sendAck(ws, "resume", `Flow resumed: ${sessionId}`);

		// Re-execute flow from paused state
		if (state.currentFlow && state.registry) {
			executeFlow(state.currentFlow, state.registry, state.hub)
				.then((result) => {
					// Check if flow paused again vs completed
					if (state.hub?.status === "paused") {
						// Flow paused again - don't mark as not running
						broadcast(clients, {
							type: "flow:paused",
							sessionId: state.sessionId,
						});
					} else {
						state.isRunning = false;
						broadcast(clients, {
							type: "flow:complete",
							outputs: result.outputs,
						});
					}
				})
				.catch((error) => {
					state.isRunning = false;
					broadcast(clients, {
						type: "flow:error",
						error: error instanceof Error ? error.message : String(error),
					});
				});
		}
	} catch (error) {
		sendError(ws, `Resume failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Handle inject command - inject message into running flow.
 */
function handleInject(ws: ServerWebSocket<WSData>, command: HorizonCommand, state: ServerState): void {
	if (!state.isRunning || !state.hub) {
		sendError(ws, "No flow is running");
		return;
	}

	if (!command.message) {
		sendError(ws, "No message to inject");
		return;
	}

	state.hub.send(command.message);
	sendAck(ws, "inject", "Message injected");
}

/**
 * Handle status command - return current state.
 */
function handleStatus(ws: ServerWebSocket<WSData>, state: ServerState): void {
	const status = {
		isRunning: state.isRunning,
		sessionId: state.sessionId,
		hubStatus: state.hub?.status ?? null,
		flowName: state.currentFlow?.flow?.name ?? null,
	};

	ws.send(JSON.stringify({ type: "status", ...status }));
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

/**
 * Broadcast message to all connected clients.
 */
function broadcast(clients: Set<ServerWebSocket<WSData>>, message: Record<string, unknown>): void {
	const json = JSON.stringify(message);
	for (const client of clients) {
		try {
			client.send(json);
		} catch {
			// Client disconnected
		}
	}
}

/**
 * Send acknowledgment to client.
 */
function sendAck(ws: ServerWebSocket<WSData>, command: string, message: string): void {
	try {
		ws.send(JSON.stringify({ type: "ack", command, message }));
	} catch {
		// Client disconnected
	}
}

/**
 * Send error to client.
 */
function sendError(ws: ServerWebSocket<WSData>, error: string): void {
	try {
		ws.send(JSON.stringify({ type: "error", error }));
	} catch {
		// Client disconnected
	}
}
