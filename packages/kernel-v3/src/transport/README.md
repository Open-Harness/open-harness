# Transport

Adapters that connect the runtime to external systems (UI, CLI, etc.).
Transports translate runtime events into outbound messages and feed inbound
commands back into the runtime.

## What's here
- Transport: start/stop lifecycle interface.
- WebSocketTransport: planned runtime <-> WebSocket adapter.

## Structure
- websocket.ts: Transport interface + WebSocketTransport declaration.

## Usage
Create a transport with a runtime instance and start it.

```ts
import { WebSocketTransport } from "../transport/websocket.js";

const transport = new WebSocketTransport(runtime, { port: 7777, path: "/ws" });
await transport.start();
```

## Extending
- Implement Transport for new protocols (SSE, gRPC, native IPC, etc.).
- Ensure command translation feeds runtime.dispatch and event translation
  subscribes via runtime.onEvent.
- Keep any wire protocol documented and versioned for clients.
