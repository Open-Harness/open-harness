import { Hono } from "hono";
import type { Runtime, RuntimeCommand } from "@internal/core";

export function createCommandsRoute(runtime: Runtime) {
  const app = new Hono();

  app.post("/api/commands", async (c) => {
    let command: RuntimeCommand;
    try {
      command = await c.req.json<RuntimeCommand>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!command || typeof command !== "object" || !("type" in command)) {
      return c.json({ error: "Missing command type" }, 400);
    }

    runtime.dispatch(command);
    return c.json({ success: true }, 202);
  });

  return app;
}
