/**
 * WebSocket Channel for ReactFlow UI
 *
 * Streams all hub events to connected WebSocket clients.
 * Receives commands from clients: send, reply, abort.
 *
 * Uses Bun.serve() for WebSocket support.
 */

import type { Server, ServerWebSocket } from "bun";
import type { ChannelDefinition } from "../protocol/channel.js";
import type { EnrichedEvent } from "../protocol/events.js";
import type { Hub } from "../protocol/hub.js";

/** WebSocket data attached to each connection */
interface WSData {
	id: string;
}

/** Configuration for WebSocket channel */
export interface WebSocketChannelConfig {
	/** Port to listen on (default: 3001) */
	port?: number;
	/** Path for WebSocket connections (default: "/ws") */
	path?: string;
}

/** Command message from client */
interface ClientCommand {
	type: "send" | "reply" | "abort" | "sendTo" | "sendToRun";
	/** For send/sendTo/sendToRun */
	message?: string;
	/** For sendTo */
	agent?: string;
	/** For sendToRun */
	runId?: string;
	/** For reply */
	promptId?: string;
	content?: string;
	choice?: string;
	/** For abort */
	reason?: string;
}

/** State for the WebSocket channel */
interface WebSocketChannelState {
	server: Server<WSData> | null;
	clients: Set<ServerWebSocket<WSData>>;
	eventSubscription: (() => void) | null;
}

/**
 * Creates a WebSocket channel definition for hub registration.
 *
 * @example
 * ```ts
 * const hub = new HubImpl("session");
 * hub.registerChannel(createWebSocketChannel({ port: 3001 }));
 * await hub.start();
 * ```
 */
export function createWebSocketChannel(
	config: WebSocketChannelConfig = {},
): ChannelDefinition<WebSocketChannelState> {
	const port = config.port ?? 3001;
	const wsPath = config.path ?? "/ws";

	return {
		name: "websocket",

		state: () => ({
			server: null,
			clients: new Set(),
			eventSubscription: null,
		}),

		onStart: async ({ hub, state, emit }) => {
			// Start WebSocket server
			state.server = Bun.serve({
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
								clients: state.clients.size,
							}),
							{ headers: { "Content-Type": "application/json" } },
						);
					}

					return new Response("Not Found", { status: 404 });
				},

				websocket: {
					open(ws: ServerWebSocket<WSData>) {
						state.clients.add(ws);
						emit({
							type: "websocket:connected",
							clientId: ws.data.id,
							clientCount: state.clients.size,
						});
					},

					close(ws: ServerWebSocket<WSData>) {
						state.clients.delete(ws);
						emit({
							type: "websocket:disconnected",
							clientId: ws.data.id,
							clientCount: state.clients.size,
						});
					},

					message(ws: ServerWebSocket<WSData>, message) {
						handleClientMessage(hub, ws, message, emit);
					},
				},
			});

			// Subscribe to all hub events and broadcast to clients
			state.eventSubscription = hub.subscribe("*", (event: EnrichedEvent) => {
				broadcastEvent(state.clients, event);
			});

			emit({
				type: "websocket:started",
				port,
				path: wsPath,
			});
		},

		onComplete: async ({ state, emit }) => {
			// Unsubscribe from hub events
			if (state.eventSubscription) {
				state.eventSubscription();
				state.eventSubscription = null;
			}

			// Close all client connections
			for (const client of state.clients) {
				try {
					client.close(1000, "Server shutting down");
				} catch {
					// Ignore close errors
				}
			}
			state.clients.clear();

			// Stop server
			if (state.server) {
				state.server.stop();
				state.server = null;
			}

			emit({ type: "websocket:stopped" });
		},

		// No event handlers needed - we use direct subscription for efficiency
		on: {},
	};
}

/**
 * Broadcast an event to all connected WebSocket clients.
 */
function broadcastEvent(
	clients: Set<ServerWebSocket<WSData>>,
	event: EnrichedEvent,
): void {
	const message = JSON.stringify({
		type: "event",
		payload: {
			id: event.id,
			timestamp: event.timestamp.toISOString(),
			context: event.context,
			event: event.event,
		},
	});

	for (const client of clients) {
		try {
			client.send(message);
		} catch {
			// Client disconnected, will be cleaned up on close
		}
	}
}

/**
 * Handle incoming command from WebSocket client.
 */
function handleClientMessage(
	hub: Hub,
	ws: ServerWebSocket<WSData>,
	message: string | Buffer,
	emit: (event: { type: string; [k: string]: unknown }) => void,
): void {
	try {
		const msgStr = typeof message === "string" ? message : message.toString();
		const command = JSON.parse(msgStr) as ClientCommand;

		switch (command.type) {
			case "send":
				if (command.message) {
					hub.send(command.message);
					sendAck(ws, "send", "Message sent");
				}
				break;

			case "sendTo":
				if (command.agent && command.message) {
					hub.sendTo(command.agent, command.message);
					sendAck(ws, "sendTo", `Message sent to ${command.agent}`);
				}
				break;

			case "sendToRun":
				if (command.runId && command.message) {
					hub.sendToRun(command.runId, command.message);
					sendAck(ws, "sendToRun", `Message sent to run ${command.runId}`);
				}
				break;

			case "reply":
				if (command.promptId && command.content) {
					hub.reply(command.promptId, {
						content: command.content,
						choice: command.choice,
						timestamp: new Date(),
					});
					sendAck(ws, "reply", `Replied to prompt ${command.promptId}`);
				}
				break;

			case "abort":
				hub.abort(command.reason);
				sendAck(ws, "abort", "Abort requested");
				break;

			default:
				sendError(
					ws,
					`Unknown command type: ${(command as { type: string }).type}`,
				);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Parse error";
		sendError(ws, errorMessage);
		emit({
			type: "websocket:error",
			clientId: ws.data.id,
			error: errorMessage,
		});
	}
}

/**
 * Send acknowledgment to client.
 */
function sendAck(
	ws: ServerWebSocket<WSData>,
	command: string,
	message: string,
): void {
	try {
		ws.send(
			JSON.stringify({
				type: "ack",
				command,
				message,
			}),
		);
	} catch {
		// Client disconnected
	}
}

/**
 * Send error to client.
 */
function sendError(ws: ServerWebSocket<WSData>, error: string): void {
	try {
		ws.send(
			JSON.stringify({
				type: "error",
				error,
			}),
		);
	} catch {
		// Client disconnected
	}
}

// Re-export for convenience
export type { WebSocketChannelState };
