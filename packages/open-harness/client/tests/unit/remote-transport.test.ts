import { describe, expect, test } from "bun:test";
import type { UIMessageChunk } from "ai";
import { RemoteAIKitTransport } from "../../src/index.js";

class FakeEventSource {
	static instances: FakeEventSource[] = [];

	readonly url: string;

	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	closed = false;

	constructor(url: string) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}

	emitMessage(data: string) {
		this.onmessage?.({ data });
	}

	emitError(event: unknown = new Error("boom")) {
		this.onerror?.(event);
	}

	close() {
		this.closed = true;
	}
}

describe("RemoteAIKitTransport", () => {
	test("POSTs to /api/chat and streams chunks from /api/events/:runId", async () => {
		FakeEventSource.instances = [];
		(globalThis as unknown as { EventSource?: unknown }).EventSource = FakeEventSource as unknown as typeof EventSource;

		globalThis.fetch = (async (url: string) => {
			expect(url).toBe("https://example.com/api/chat");
			return new Response(JSON.stringify({ runId: "run-123" }), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const transport = new RemoteAIKitTransport({
			serverUrl: "https://example.com",
		});

		const stream = await transport.sendMessages({
			trigger: "submit-message",
			chatId: "chat",
			messageId: undefined,
			messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }],
		});

		// Allow start() to run and create the EventSource
		await new Promise((r) => setTimeout(r, 0));

		expect(FakeEventSource.instances.length).toBe(1);
		const es = FakeEventSource.instances[0];
		if (!es) {
			throw new Error("Expected EventSource instance");
		}
		expect(es.url).toBe("https://example.com/api/events/run-123");

		const reader = stream.getReader();

		es.emitMessage(JSON.stringify({ type: "text-start", id: "m" } satisfies UIMessageChunk));
		es.emitMessage(
			JSON.stringify({
				type: "text-delta",
				id: "m",
				delta: "hello",
			} satisfies UIMessageChunk),
		);
		es.emitMessage(JSON.stringify({ type: "text-end", id: "m" } satisfies UIMessageChunk));

		const r1 = await reader.read();
		const r2 = await reader.read();
		const r3 = await reader.read();
		const r4 = await reader.read();

		expect(r1.value).toEqual({ type: "text-start", id: "m" });
		expect(r2.value).toEqual({ type: "text-delta", id: "m", delta: "hello" });
		expect(r3.value).toEqual({ type: "text-end", id: "m" });
		expect(r4.done).toBe(true);
		expect(es.closed).toBe(true);
	});

	test("abortSignal closes stream and EventSource", async () => {
		FakeEventSource.instances = [];
		(globalThis as unknown as { EventSource?: unknown }).EventSource = FakeEventSource as unknown as typeof EventSource;

		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ runId: "run-1" }), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			})) as unknown as typeof fetch;

		const ac = new AbortController();
		const transport = new RemoteAIKitTransport({
			serverUrl: "https://example.com",
		});

		const stream = await transport.sendMessages({
			trigger: "submit-message",
			chatId: "chat",
			messageId: undefined,
			messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }],
			abortSignal: ac.signal,
		});

		await new Promise((r) => setTimeout(r, 0));
		const es = FakeEventSource.instances[0];
		if (!es) {
			throw new Error("Expected EventSource instance");
		}

		const reader = stream.getReader();
		ac.abort();

		const result = await reader.read();
		expect(result.done).toBe(true);
		expect(es.closed).toBe(true);
	});
});
