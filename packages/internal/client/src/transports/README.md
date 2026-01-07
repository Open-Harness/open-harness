# Client Transports

Transport layer for receiving runtime events and sending commands to an Open Harness server.

## What's here

- **`errors.ts`**: Structured error types for transport failures (parse, network, timeout, invalid response)
- **`http-sse-client/`**: HTTP Server-Sent Events (SSE) client for production use
- **`remote/`**: Remote transport adapter (integrates HTTPSSEClient into AI SDK ChatTransport)

## Error Handling

All network operations return `Result<T, TransportError>` types powered by `neverthrow`:

```typescript
import { parseJSON, fetchWithResult } from './errors.js';

// Parsing JSON
const result = parseJSON<MyData>(jsonString);
result.match(
  (data) => console.log('Parsed:', data),
  (err) => console.error('Parse failed:', err.code, err.message)
);

// HTTP requests
const res = await fetchWithResult(url, options);
res.match(
  (response) => console.log('Success'),
  (err) => {
    if (err.code === 'NETWORK_ERROR') {
      // Handle network failure
    }
  }
);
```

### Error Codes

- **`PARSE_ERROR`**: JSON or text parsing failure
- **`NETWORK_ERROR`**: Fetch or connection failure
- **`INVALID_RESPONSE`**: HTTP error status or missing data
- **`TIMEOUT`**: Operation exceeded timeout duration

## HTTPSSEClient

Low-level client for SSE connections with automatic reconnection.

### Usage

```typescript
const client = new HTTPSSEClient({
  serverUrl: 'http://localhost:3000',
  timeout: 30 * 60 * 1000,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
});

// Subscribe to events
await client.connect(runId, (event) => {
  console.log('Event:', event.type);
});

// Send commands
const cmdResult = await client.sendCommand({
  type: 'pause',
  runId,
});

cmdResult.match(
  () => console.log('Sent'),
  (err) => console.error('Send failed:', err.message)
);

// Start chat session
const chatResult = await client.startChat(messages);
chatResult.match(
  ({ runId }) => console.log('New run:', runId),
  (err) => console.error('Chat failed:', err.message)
);

// Cleanup
client.disconnect();
```

### Reconnection Strategy

- Exponential backoff: delay × 2^(attempt) capped at 30s
- Respects `maxReconnectAttempts`
- Resets attempt counter on successful connection
- Auto-reconnects on error; manual reconnect via `connect()` again

## Architecture

```
┌─────────────────────────┐
│  Remote Transport       │ (ChatTransport wrapper)
├─────────────────────────┤
│  HTTPSSEClient          │ (SSE connection + commands)
├─────────────────────────┤
│  errors.ts              │ (Result<T, TransportError>)
└─────────────────────────┘
```

## Extending

To add a new transport (e.g., WebSocket):

1. Implement similar to `HTTPSSEClient`
2. Use `Result<T, TransportError>` for errors
3. Wrap in `ChatTransport` adapter for use with AI SDK
4. Export from package index

## Testing

Transport errors are intentionally kept simple to avoid mocking complexity. Tests should:

1. Mock `fetch` using a test utility
2. Use fixtures with recorded event streams
3. Verify `Result` types (both `.isOk()` and `.isErr()` branches)
