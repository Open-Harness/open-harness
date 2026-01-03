/**
 * Horizon Agent WebSocket Server (v3)
 *
 * Uses kernel-v3 runtime for flow execution with WebSocket streaming.
 *
 * Commands:
 * - start: Start a new flow execution
 * - pause: Pause the current flow (resumable)
 * - resume: Resume a paused flow with optional message injection
 * - inject: Inject a message into the running flow
 * - status: Get current flow status
 */

import { resolve } from "node:path";
import type { RunSnapshot, RuntimeEvent } from "@open-harness/kernel-v3";
import type { Server, ServerWebSocket } from "bun";
import { createHorizonRuntime, type HorizonRuntime } from "./runtime/horizon-runtime.js";

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
	input?: {
		feature?: string;
		maxReviewIterations?: number;
	};
	/** For start: override flow path */
	flowPath?: string;
	/** For resume/inject: message to inject */
	message?: string;
}

/** Server state */
interface ServerState {
	runtime: HorizonRuntime | null;
	isRunning: boolean;
	unsubscribe: (() => void) | null;
	lastSnapshot: RunSnapshot | null;
}

/**
 * Create and start a Horizon Agent WebSocket server.
 */
export async function createHorizonServer(config: HorizonServerConfig = {}): Promise<Server<WSData>> {
	const port = config.port ?? 3002;
	const wsPath = config.path ?? "/ws";
	const defaultFlowPath = config.flowPath ?? "./flows/agent-loop.yaml";

	const state: ServerState = {
		runtime: null,
		isRunning: false,
		unsubscribe: null,
		lastSnapshot: null,
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
						runId: state.lastSnapshot?.runId ?? null,
					}),
					{ headers: { "Content-Type": "application/json" } },
				);
			}

			// Status endpoint
			if (url.pathname === "/status") {
				const snapshot = state.runtime?.getSnapshot();
				return new Response(
					JSON.stringify({
						isRunning: state.isRunning,
						runId: snapshot?.runId ?? null,
						status: snapshot?.status ?? null,
						nodeStatus: snapshot?.nodeStatus ?? null,
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
				await handleCommand(ws, message, state, clients, defaultFlowPath);
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
	defaultFlowPath: string,
): Promise<void> {
	try {
		const msgStr = typeof message === "string" ? message : message.toString();
		const command = JSON.parse(msgStr) as HorizonCommand;

		switch (command.type) {
			case "start":
				await handleStart(ws, command, state, clients, defaultFlowPath);
				break;

			case "pause":
				handlePause(ws, state, clients);
				break;

			case "resume":
				handleResume(ws, command, state, clients);
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
	defaultFlowPath: string,
): Promise<void> {
	if (state.isRunning) {
		sendError(ws, "Flow is already running. Pause or wait for completion.");
		return;
	}

	const flowPath = resolve(command.flowPath ?? defaultFlowPath);
	const feature = command.input?.feature;

	if (!feature) {
		sendError(ws, 'Missing required input: feature (e.g., { "input": { "feature": "..." } })');
		return;
	}

	try {
		// Clean up previous runtime
		if (state.unsubscribe) {
			state.unsubscribe();
			state.unsubscribe = null;
		}

		// Create new Horizon runtime
		state.runtime = createHorizonRuntime({
			flowPath,
			enablePersistence: true,
		});

		// Subscribe to runtime events and broadcast
		state.unsubscribe = state.runtime.onEvent((event: RuntimeEvent) => {
			broadcast(clients, {
				type: "flow:event",
				event,
			});
		});

		// Set isRunning BEFORE starting the promise to prevent race conditions
		// with incoming start commands
		state.isRunning = true;
		sendAck(ws, "start", `Flow started with feature: ${feature}`);

		// Execute flow in background - we don't await because the WebSocket
		// handler needs to return. Events are broadcast via the subscription.
		state.runtime
			.run({
				feature,
				maxReviewIterations: command.input?.maxReviewIterations ?? 5,
			})
			.then((result) => {
				state.lastSnapshot = result;
				// Only clear isRunning if flow truly completed (not paused)
				state.isRunning = result.status === "running";

				if (result.status === "paused") {
					broadcast(clients, {
						type: "flow:paused",
						runId: result.runId,
					});
				} else {
					broadcast(clients, {
						type: "flow:complete",
						status: result.status,
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
function handlePause(ws: ServerWebSocket<WSData>, state: ServerState, clients: Set<ServerWebSocket<WSData>>): void {
	if (!state.isRunning || !state.runtime) {
		sendError(ws, "No flow is running");
		return;
	}

	state.runtime.pause();
	sendAck(ws, "pause", "Flow paused");

	broadcast(clients, {
		type: "flow:paused",
		runId: state.runtime.getSnapshot().runId,
	});
}

/**
 * Handle resume command - resume paused flow.
 */
function handleResume(
	ws: ServerWebSocket<WSData>,
	command: HorizonCommand,
	state: ServerState,
	clients: Set<ServerWebSocket<WSData>>,
): void {
	if (!state.runtime) {
		sendError(ws, "No runtime available to resume");
		return;
	}

	const snapshot = state.runtime.getSnapshot();
	if (snapshot.status !== "paused") {
		sendError(ws, `Cannot resume: flow is ${snapshot.status}`);
		return;
	}

	state.runtime.resume(command.message);
	state.isRunning = true;
	sendAck(ws, "resume", "Flow resumed");

	broadcast(clients, {
		type: "flow:resumed",
		runId: snapshot.runId,
	});
}

/**
 * Handle inject command - inject message into running flow.
 */
function handleInject(ws: ServerWebSocket<WSData>, command: HorizonCommand, state: ServerState): void {
	if (!state.isRunning || !state.runtime) {
		sendError(ws, "No flow is running");
		return;
	}

	if (!command.message) {
		sendError(ws, "No message to inject");
		return;
	}

	const snapshot = state.runtime.getSnapshot();
	const runId = snapshot.runId;

	if (!runId) {
		sendError(ws, "No active run to inject message into");
		return;
	}

	state.runtime.dispatch({
		type: "send",
		runId,
		message: command.message,
	});

	sendAck(ws, "inject", "Message injected");
}

/**
 * Handle status command - return current state.
 */
function handleStatus(ws: ServerWebSocket<WSData>, state: ServerState): void {
	const snapshot = state.runtime?.getSnapshot();
	const horizonState = state.runtime?.getState();

	const status = {
		isRunning: state.isRunning,
		runId: snapshot?.runId ?? null,
		status: snapshot?.status ?? null,
		nodeStatus: snapshot?.nodeStatus ?? null,
		taskCount: horizonState?.tasks.length ?? 0,
		currentTaskIndex: horizonState?.currentTaskIndex ?? 0,
		completedTasks: horizonState?.completedTasks.length ?? 0,
	};

	ws.send(JSON.stringify({ type: "status", ...status }));
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
