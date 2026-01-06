# @open-harness/transport-websocket

WebSocket transport implementation for Open Harness.

## Purpose

Provides real-time bidirectional communication with Open Harness runtime over WebSocket. Enables:
- Real-time event streaming from runtime to clients
- Command dispatch from clients to runtime
- Connection management, reconnection, and error handling

## Key Files

- **`src/websocket.ts`** - Main `WebSocketTransport` implementation
  - Connects to runtime via `runtime.onEvent()` and `runtime.dispatch()`
  - Handles WebSocket connection lifecycle
  - Transforms between WebSocket messages and runtime events/commands

## Usage

```typescript
import { WebSocketTransport } from "@open-harness/transport-websocket";

const transport = new WebSocketTransport({
  url: "ws://localhost:3000",
  runtime,
});
```

## Dependencies

- `@open-harness/sdk` - For runtime interfaces and event types
