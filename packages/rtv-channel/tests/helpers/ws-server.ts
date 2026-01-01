import { WebSocketServer, type WebSocket } from "ws";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

type JsonValue = Record<string, unknown>;

export type TestServer = {
	url: string;
	waitForConnection: () => Promise<void>;
	waitForMessage: (
		predicate: (msg: JsonValue) => boolean,
		options?: { timeoutMs?: number },
	) => Promise<JsonValue>;
	send: (msg: JsonValue) => void;
	close: () => Promise<void>;
	messages: JsonValue[];
};

export async function createTestServer(): Promise<TestServer> {
	const wss = new WebSocketServer({ port: 0 });
	await once(wss, "listening");
	const address = wss.address() as AddressInfo;
	const url = `ws://127.0.0.1:${address.port}`;
	const messages: JsonValue[] = [];
	let socket: WebSocket | null = null;

	wss.on("connection", (ws) => {
		socket = ws;
		ws.on("message", (data) => {
			try {
				const msg = JSON.parse(data.toString()) as JsonValue;
				messages.push(msg);
			} catch {}
		});
	});

	const waitForConnection = async () => {
		if (socket) return;
		await once(wss, "connection");
	};

	const waitForMessage = async (
		predicate: (msg: JsonValue) => boolean,
		options?: { timeoutMs?: number },
	): Promise<JsonValue> => {
		const timeoutMs = options?.timeoutMs ?? 2000;
		const start = Date.now();
		for (;;) {
			const found = messages.find(predicate);
			if (found) return found;
			if (Date.now() - start > timeoutMs) {
				throw new Error("Timed out waiting for message");
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	};

	const send = (msg: JsonValue) => {
		if (!socket) throw new Error("No client connected");
		socket.send(JSON.stringify(msg));
	};

	const close = async () =>
		new Promise<void>((resolve) => {
			try {
				socket?.close();
			} catch {}
			wss.close(() => resolve());
		});

	return {
		url,
		waitForConnection,
		waitForMessage,
		send,
		close,
		messages,
	};
}
