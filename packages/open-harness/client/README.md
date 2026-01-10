---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @open-harness/client

Client-side transport utilities for Open Harness.

## Status: Re-export Package

This package re-exports the internal client implementation for public consumption.

## Current Exports

```typescript
import {
  HttpSseClient,
  RemoteTransport,
  // Error types
  TransportError,
  ConnectionError,
  ParseError,
} from "@open-harness/client";
```

## HttpSseClient

HTTP + Server-Sent Events client for streaming responses:

```typescript
import { HttpSseClient } from "@open-harness/client";

const client = new HttpSseClient({
  baseUrl: "http://localhost:3000",
});

// Stream events from an endpoint
for await (const event of client.stream("/chat", { prompt: "Hello" })) {
  console.log("Event:", event);
}
```

## RemoteTransport

Higher-level transport abstraction:

```typescript
import { RemoteTransport } from "@open-harness/client";

const transport = new RemoteTransport({
  baseUrl: "http://localhost:3000",
});

// Connect and stream
await transport.connect();
for await (const signal of transport.signals()) {
  console.log("Signal:", signal);
}
```

## Error Handling

```typescript
import { TransportError, ConnectionError, ParseError } from "@open-harness/client";

try {
  await client.stream("/chat", input);
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error("Connection failed:", error.message);
  } else if (error instanceof ParseError) {
    console.error("Parse failed:", error.message);
  }
}
```

## See Also

- [@open-harness/core](../core/README.md) - Core API
- [@open-harness/server](../server/README.md) - Server utilities
