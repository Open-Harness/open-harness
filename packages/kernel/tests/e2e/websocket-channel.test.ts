/**
 * WebSocket Channel Integration Tests
 *
 * Tests the WebSocket channel with real WebSocket connections.
 * Uses Bun's built-in WebSocket client.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	createWebSocketChannel,
	type WebSocketChannelConfig,
} from "../../src/channels/websocket.js";
import { HubImpl } from "../../src/engine/hub.js";

const TEST_PORT = 9876; // Use high port to avoid conflicts

interface WSMessage {
	type: string;
	payload?: {
		id: string;
		timestamp: string;
		context: { sessionId: string };
		event: { type: string; [k: string]: unknown };
	};
	command?: string;
	message?: string;
	error?: string;
}

function createTestHub() {
	return new HubImpl("test-ws-session");
}

function createTestChannel(config: WebSocketChannelConfig = {}) {
	return createWebSocketChannel({ port: TEST_PORT, ...config });
}

async function connectClient(): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
		ws.onopen = () => resolve(ws);
		ws.onerror = (e) => reject(e);
	});
}

async function waitForMessage(
	ws: WebSocket,
	filter?: (msg: WSMessage) => boolean,
	timeout = 1000,
): Promise<WSMessage> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("Timeout waiting for message"));
		}, timeout);

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data) as WSMessage;
			if (!filter || filter(msg)) {
				clearTimeout(timer);
				resolve(msg);
			}
		};
	});
}

async function waitForMessages(
	ws: WebSocket,
	count: number,
	timeout = 1000,
): Promise<WSMessage[]> {
	const messages: WSMessage[] = [];
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			resolve(messages); // Return what we have on timeout
		}, timeout);

		ws.onmessage = (event) => {
			messages.push(JSON.parse(event.data));
			if (messages.length >= count) {
				clearTimeout(timer);
				resolve(messages);
			}
		};
	});
}

/** Wait for a specific event type */
async function waitForEventType(
	ws: WebSocket,
	eventType: string,
	timeout = 1000,
): Promise<WSMessage> {
	return waitForMessage(
		ws,
		(msg) => msg.type === "event" && msg.payload?.event.type === eventType,
		timeout,
	);
}

/** Wait for a message of a specific type (ack, error, event) */
async function waitForMessageType(
	ws: WebSocket,
	msgType: string,
	timeout = 1000,
): Promise<WSMessage> {
	return waitForMessage(ws, (msg) => msg.type === msgType, timeout);
}

describe("WebSocket Channel Integration", () => {
	let hub: HubImpl;

	beforeEach(() => {
		hub = createTestHub();
	});

	afterEach(async () => {
		await hub.stop();
		// Small delay for cleanup
		await new Promise((r) => setTimeout(r, 50));
	});

	describe("Connection", () => {
		it("accepts WebSocket connections", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			expect(ws.readyState).toBe(WebSocket.OPEN);

			ws.close();
		});

		it("handles multiple clients", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws1 = await connectClient();
			const ws2 = await connectClient();
			const ws3 = await connectClient();

			expect(ws1.readyState).toBe(WebSocket.OPEN);
			expect(ws2.readyState).toBe(WebSocket.OPEN);
			expect(ws3.readyState).toBe(WebSocket.OPEN);

			ws1.close();
			ws2.close();
			ws3.close();
		});

		it("health endpoint reports client count", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			// Check with no clients
			let response = await fetch(`http://localhost:${TEST_PORT}/health`);
			let data = await response.json();
			expect(data.status).toBe("ok");
			expect(data.clients).toBe(0);

			// Connect a client
			const ws = await connectClient();
			await new Promise((r) => setTimeout(r, 50)); // Let connection register

			response = await fetch(`http://localhost:${TEST_PORT}/health`);
			data = await response.json();
			expect(data.clients).toBe(1);

			ws.close();
		});
	});

	describe("Event Streaming", () => {
		it("streams events to connected clients", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			hub.startSession();

			// Wait for the specific event type we emit
			const messagePromise = waitForEventType(ws, "test:event");

			// Emit an event
			hub.emit({ type: "test:event", data: "hello" });

			const message = await messagePromise;
			expect(message.type).toBe("event");
			expect(message.payload?.event.type).toBe("test:event");
			expect(message.payload?.event.data).toBe("hello");

			ws.close();
		});

		it("broadcasts to all clients", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws1 = await connectClient();
			const ws2 = await connectClient();
			hub.startSession();

			const msg1Promise = waitForEventType(ws1, "broadcast:test");
			const msg2Promise = waitForEventType(ws2, "broadcast:test");

			hub.emit({ type: "broadcast:test" });

			const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);
			expect(msg1.payload?.event.type).toBe("broadcast:test");
			expect(msg2.payload?.event.type).toBe("broadcast:test");

			ws1.close();
			ws2.close();
		});

		it("includes event context in messages", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			const messagePromise = waitForEventType(ws, "context:test");

			hub.emit({ type: "context:test" });

			const message = await messagePromise;
			expect(message.payload?.context.sessionId).toBe("test-ws-session");
			expect(message.payload?.timestamp).toBeDefined();
			expect(message.payload?.id).toBeDefined();

			ws.close();
		});
	});

	describe("Commands", () => {
		it("handles send command", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			hub.startSession();

			// Wait for initial connection events to pass
			await new Promise((r) => setTimeout(r, 50));

			const messagesPromise = waitForMessages(ws, 2);

			ws.send(JSON.stringify({ type: "send", message: "Hello from client" }));

			const messages = await messagesPromise;

			// Should receive ack and the session:message event
			const ack = messages.find((m) => m.type === "ack");
			const event = messages.find(
				(m) => m.payload?.event.type === "session:message",
			);

			expect(ack?.command).toBe("send");
			expect(event?.payload?.event.content).toBe("Hello from client");

			ws.close();
		});

		it("handles reply command", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			hub.startSession();
			await new Promise((r) => setTimeout(r, 50));

			const messagesPromise = waitForMessages(ws, 2);

			ws.send(
				JSON.stringify({
					type: "reply",
					promptId: "prompt-123",
					content: "User choice",
					choice: "A",
				}),
			);

			const messages = await messagesPromise;

			const ack = messages.find((m) => m.type === "ack");
			const event = messages.find(
				(m) => m.payload?.event.type === "session:reply",
			);

			expect(ack?.command).toBe("reply");
			expect(event?.payload?.event.promptId).toBe("prompt-123");
			expect(event?.payload?.event.content).toBe("User choice");

			ws.close();
		});

		it("handles abort command", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			hub.startSession();
			hub.setStatus("running");
			await new Promise((r) => setTimeout(r, 50));

			const messagesPromise = waitForMessages(ws, 2);

			ws.send(JSON.stringify({ type: "abort", reason: "User cancelled" }));

			const messages = await messagesPromise;

			const ack = messages.find((m) => m.type === "ack");
			const event = messages.find(
				(m) => m.payload?.event.type === "session:abort",
			);

			expect(ack?.command).toBe("abort");
			expect(event?.payload?.event.reason).toBe("User cancelled");
			expect(hub.status).toBe("aborted");

			ws.close();
		});

		it("returns error for invalid command", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			const messagePromise = waitForMessageType(ws, "error");

			ws.send(JSON.stringify({ type: "invalid_command" }));

			const message = await messagePromise;
			expect(message.type).toBe("error");
			expect(message.error).toContain("Unknown command");

			ws.close();
		});

		it("returns error for invalid JSON", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			const messagePromise = waitForMessageType(ws, "error");

			ws.send("not valid json");

			const message = await messagePromise;
			expect(message.type).toBe("error");

			ws.close();
		});
	});

	describe("Lifecycle", () => {
		it("emits websocket:started on start", async () => {
			const events: string[] = [];
			hub.subscribe("websocket:*", (e) => {
				events.push(e.event.type);
			});

			hub.registerChannel(createTestChannel());
			await hub.start();

			expect(events).toContain("websocket:started");
		});

		it("emits websocket:connected on client connect", async () => {
			const events: { type: string; clientId?: string }[] = [];
			hub.subscribe("websocket:connected", (e) => {
				events.push(e.event as { type: string; clientId: string });
			});

			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			await new Promise((r) => setTimeout(r, 50));

			expect(events.length).toBe(1);
			expect(events[0].clientId).toBeDefined();

			ws.close();
		});

		it("emits websocket:disconnected on client disconnect", async () => {
			const events: string[] = [];
			hub.subscribe("websocket:disconnected", (e) => {
				events.push(e.event.type);
			});

			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			await new Promise((r) => setTimeout(r, 50));

			ws.close();
			await new Promise((r) => setTimeout(r, 50));

			expect(events).toContain("websocket:disconnected");
		});

		it("closes clients on hub stop", async () => {
			hub.registerChannel(createTestChannel());
			await hub.start();

			const ws = await connectClient();
			expect(ws.readyState).toBe(WebSocket.OPEN);

			await hub.stop();
			await new Promise((r) => setTimeout(r, 100));

			expect(ws.readyState).toBe(WebSocket.CLOSED);
		});

		it("emits websocket:stopped on stop", async () => {
			const events: string[] = [];
			hub.subscribe("websocket:stopped", (e) => {
				events.push(e.event.type);
			});

			hub.registerChannel(createTestChannel());
			await hub.start();
			await hub.stop();

			expect(events).toContain("websocket:stopped");
		});
	});
});
