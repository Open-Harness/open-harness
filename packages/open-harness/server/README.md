---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @open-harness/server

Server utilities for Open Harness.

## Status: Minimal Package

Most v0.2.0 server code was deleted as part of the v0.3.0 migration. This package now provides only essential middleware utilities.

## Current Exports

```typescript
import { createHealthRoute, corsMiddleware, errorHandler } from "@open-harness/server";
```

### `createHealthRoute()`

Creates a Hono health check route:

```typescript
import { Hono } from "hono";
import { createHealthRoute } from "@open-harness/server";

const app = new Hono();
app.route("/health", createHealthRoute());
// GET /health returns { status: "ok" }
```

### `corsMiddleware`

CORS middleware for Hono:

```typescript
import { corsMiddleware } from "@open-harness/server";

app.use("*", corsMiddleware);
```

### `errorHandler`

Error handling middleware:

```typescript
import { errorHandler } from "@open-harness/server";

app.onError(errorHandler);
```

## Building v0.3.0 Servers

For v0.3.0, build custom Hono routes that consume Provider signals:

```typescript
import { Hono } from "hono";
import { ClaudeProvider, createSignal } from "@open-harness/core";

const app = new Hono();

app.post("/chat", async (c) => {
  const provider = new ClaudeProvider();
  const input = await c.req.json();

  const signals: Signal[] = [];
  for await (const signal of provider.run(input, { signal: c.req.raw.signal })) {
    signals.push(signal);
  }

  return c.json({ signals });
});
```

## Deleted Exports (v0.2.0)

The following were removed in v0.3.0:

- `createChatRoute`, `createCommandsRoute`, `createEventsRoute` - Old API routes
- `createLocalAIKitTransport`, `WebSocketTransport` - Old transports
- `createHarness`, `runFlow`, `registerStandardNodes` - Old harness utilities
- Claude agent/node types - Use `ClaudeProvider` from @open-harness/core

## See Also

- [@open-harness/core](../core/README.md) - Providers and signals
- [Hono documentation](https://hono.dev/) - Web framework
