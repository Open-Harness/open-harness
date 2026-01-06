import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { HTTPSSEClient } from "../../src/client/transports/http-sse-client.js";

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;

  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onopen: (() => void) | null = null;

  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);

    // Simulate successful connection on next tick.
    setTimeout(() => this.onopen?.(), 0);
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  emitError(event: unknown = new Error("boom")) {
    this.onerror?.(event);
  }

  close() {
    this.closed = true;
  }
}

describe("HTTPSSEClient", () => {
  test("connect parses SSE messages and invokes callback", async () => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource?: unknown }).EventSource =
      FakeEventSource as unknown as typeof EventSource;

    const client = new HTTPSSEClient({ serverUrl: "https://example.com" });
    const seen: unknown[] = [];

    await client.connect("run-1", (e) => seen.push(e));

    await new Promise((r) => setTimeout(r, 0));
    const es = FakeEventSource.instances[0];
    if (!es) {
      throw new Error("Expected EventSource instance");
    }
    expect(es.url).toBe("https://example.com/api/events/run-1");

    es.emitMessage({ hello: "world" });
    await new Promise((r) => setTimeout(r, 0));

    expect(seen).toEqual([{ hello: "world" }]);
    client.disconnect();
    expect(es.closed).toBe(true);
  });

  test("reconnects on error", async () => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource?: unknown }).EventSource =
      FakeEventSource as unknown as typeof EventSource;

    const client = new HTTPSSEClient({
      serverUrl: "https://example.com",
      reconnectDelay: 1,
      maxReconnectAttempts: 1,
      timeout: 60_000,
    });

    await client.connect("run-1", () => undefined);
    await new Promise((r) => setTimeout(r, 0));

    const es1 = FakeEventSource.instances[0];
    if (!es1) {
      throw new Error("Expected first EventSource instance");
    }
    es1.emitError();

    await new Promise((r) => setTimeout(r, 10));
    expect(FakeEventSource.instances.length).toBe(2);
  });

  test("sendCommand posts to /api/commands", async () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://example.com/api/commands");
      expect(init?.method).toBe("POST");
      return new Response("", { status: 202 });
    }) as unknown as typeof fetch;

    const client = new HTTPSSEClient({ serverUrl: "https://example.com" });
    await client.sendCommand({ type: "abort" });
  });

  test("startChat posts to /api/chat and returns runId", async () => {
    globalThis.fetch = (async (url: string) => {
      expect(url).toBe("https://example.com/api/chat");
      return new Response(JSON.stringify({ runId: "run-123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new HTTPSSEClient({ serverUrl: "https://example.com" });
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
    ];

    await expect(client.startChat(messages)).resolves.toEqual({
      runId: "run-123",
    });
  });
});
