import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { createChatRoute } from "../../../src/server/api-routes/chat";
import { MockRuntime } from "../../../src/testing/mocks/mock-runtime";

describe("createChatRoute", () => {
  test("returns runId and dispatches send command", async () => {
    const runtime = new MockRuntime();
    const app = createChatRoute(runtime);

    const messages: UIMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
    ];

    const res = await app.fetch(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      }),
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { runId: string };
    expect(typeof json.runId).toBe("string");
    expect(json.runId.length).toBeGreaterThan(0);

    const dispatched = runtime.getDispatchedCommands();
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]).toEqual({
      type: "send",
      runId: json.runId,
      message: "hello",
    });
  });

  test("returns 400 when messages are missing", async () => {
    const runtime = new MockRuntime();
    const app = createChatRoute(runtime);

    const res = await app.fetch(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(400);
  });
});
