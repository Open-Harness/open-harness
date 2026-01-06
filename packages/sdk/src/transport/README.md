# Transport

Adapters that connect the runtime to external systems (UI, CLI, etc.).
Transports translate runtime events into outbound messages and feed inbound
commands back into the runtime.

## What's here
- Transport: start/stop lifecycle interface (shared contract).

## Structure
- websocket.ts: Transport interface declaration.

Note: WebSocketTransport has been moved to `@open-harness/transport-websocket` package.

## Usage
Create a transport with a runtime instance and start it.

```ts
import { WebSocketTransport } from "@open-harness/transport-websocket";

const transport = new WebSocketTransport(runtime, { port: 42069, path: "/ws" });
await transport.start();
```

## Wire Protocol
Messages are JSON envelopes:

```json
{ "type": "event", "event": { "type": "node:start", "nodeId": "a", "runId": "..." } }
{ "type": "command", "command": { "type": "abort", "resumable": true } }
```

## Extending
- Implement Transport for new protocols (SSE, gRPC, native IPC, etc.).
- Ensure command translation feeds runtime.dispatch and event translation
  subscribes via runtime.onEvent.
- Keep any wire protocol documented and versioned for clients.
