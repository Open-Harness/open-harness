import type { UIMessage } from "ai";
import { Hono } from "hono";
import type { Runtime } from "@internal/runtime";

interface ChatRequest {
  messages: UIMessage[];
}

interface ChatResponse {
  runId: string;
}

export function createChatRoute(runtime: Runtime) {
  const app = new Hono();

  app.post("/api/chat", async (c) => {
    let body: ChatRequest;
    try {
      body = await c.req.json<ChatRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Missing messages" }, 400);
    }

    const lastUser = messages.findLast((m) => m.role === "user");
    if (!lastUser) {
      return c.json({ error: "No user message found" }, 400);
    }

    const textPart = lastUser.parts.find(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" && p !== null && "type" in p && p.type === "text",
    );
    if (!textPart || !textPart.text) {
      return c.json({ error: "User message has no text content" }, 400);
    }

    const runId = crypto.randomUUID();

    runtime.dispatch({
      type: "send",
      runId,
      message: textPart.text,
    });

    return c.json<ChatResponse>({ runId }, 201);
  });

  return app;
}
