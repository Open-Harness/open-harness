---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @internal/client

Internal client-side transport implementations for Open Harness.

**Note:** This is a private package. Use `@open-harness/client` for the public API.

## Structure

```
src/
└── transports/
    ├── errors.ts           # TransportError and result types
    ├── http-sse-client/    # HTTP + Server-Sent Events client
    └── remote/             # Higher-level remote transport
```

## HTTPSSEClient

HTTP client with Server-Sent Events for streaming responses.

```typescript
import { HTTPSSEClient } from "@internal/client";

const client = new HTTPSSEClient({
  serverUrl: "http://localhost:3000",
  timeout: 30 * 60 * 1000,        // 30 minutes (default)
  reconnectDelay: 1000,           // 1 second (default)
  maxReconnectAttempts: 5,        // (default)
});

// Connect to event stream
await client.connect(runId, (event) => {
  console.log("Event:", event);
});

// Send commands
await client.sendCommand({ type: "pause", runId });

// Chat
await client.chat(runId, messages);

// Disconnect
client.disconnect();
```

### Features

- **Auto-reconnect** - Exponential backoff on connection failure
- **Timeout handling** - Configurable connection timeout
- **Result types** - Uses `neverthrow` for type-safe error handling
- **SSE parsing** - Handles event stream parsing and validation

## RemoteTransport

Higher-level abstraction over HTTPSSEClient for signal-based communication.

```typescript
import { RemoteTransport } from "@internal/client";

const transport = new RemoteTransport({
  baseUrl: "http://localhost:3000",
});

// Connect and stream signals
await transport.connect();

for await (const signal of transport.signals()) {
  console.log("Signal:", signal);
}
```

## Error Handling

All operations return `Result<T, TransportError>` using neverthrow:

```typescript
import { TransportError, parseJSON, fetchWithResult } from "@internal/client";

// Error codes
type TransportErrorCode =
  | "PARSE_ERROR"      // JSON parsing failed
  | "NETWORK_ERROR"    // HTTP request failed
  | "TIMEOUT"          // Request timed out
  | "INVALID_RESPONSE" // Unexpected response format
;

// Usage
const result = parseJSON<MyData>(jsonString);

result.match(
  (data) => console.log("Success:", data),
  (error) => {
    if (error.code === "PARSE_ERROR") {
      console.error("JSON invalid:", error.message);
    }
  }
);
```

### Helper Functions

```typescript
// Parse JSON with Result type
const result = parseJSON<T>(text);

// Fetch with automatic error wrapping
const result = await fetchWithResult(url, options);
```

## Options

### HTTPSSEClientOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serverUrl` | `string` | required | Base server URL |
| `timeout` | `number` | `1800000` | Connection timeout (ms) |
| `reconnectDelay` | `number` | `1000` | Initial reconnect delay (ms) |
| `maxReconnectAttempts` | `number` | `5` | Max reconnection attempts |

## Dependencies

- `neverthrow` - Type-safe error handling with Result types

## See Also

- [@open-harness/client](../../open-harness/client/README.md) - Public API
- [@open-harness/server](../../open-harness/server/README.md) - Server utilities
