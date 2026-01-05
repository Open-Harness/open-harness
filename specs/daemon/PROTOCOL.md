# WebSocket Protocol (v1)

This daemon uses the **runtime envelope** already implemented in the SDK.
It does not introduce a new protocol for v1.

## Endpoint

- Default: `ws://localhost:42069/ws`
- Configurable via CLI flags.

## Envelope

All WebSocket messages are JSON objects with a `type` field.

```json
{ "type": "event", "event": { ...RuntimeEvent... } }
{ "type": "command", "command": { ...RuntimeCommand... } }
```

The envelope is compatible with `WebSocketTransport` in
`packages/sdk/src/transport/websocket.ts`.

## RuntimeCommand (Inbound)

```ts
// from packages/sdk/src/core/events.ts
export type RuntimeCommand =
  | { type: "send"; message: string; runId: string }
  | { type: "reply"; promptId: string; content: string; runId: string }
  | { type: "abort"; resumable?: boolean; reason?: string }
  | { type: "resume"; message?: string };
```

### Examples

Pause the run:
```json
{ "type": "command", "command": { "type": "abort", "resumable": true } }
```

Resume the run:
```json
{ "type": "command", "command": { "type": "resume", "message": "continue" } }
```

Send a message into a running node:
```json
{ "type": "command", "command": { "type": "send", "runId": "<run-id>", "message": "hello" } }
```

## RuntimeEvent (Outbound)

```ts
// from packages/sdk/src/core/events.ts
export type RuntimeEvent = RuntimeEventPayload & { timestamp: number };
```

Selected examples:

```json
{ "type": "event", "event": { "type": "flow:start", "flowName": "greeting", "timestamp": 1710000000000 } }
```

```json
{ "type": "event", "event": { "type": "node:start", "nodeId": "a", "runId": "r1", "timestamp": 1710000000001 } }
```

```json
{ "type": "event", "event": { "type": "agent:text:delta", "runId": "r1", "nodeId": "b", "content": "Hi", "timestamp": 1710000000002 } }
```

## Validation and Error Handling

- Invalid JSON: ignore and log.
- Unknown `type`: ignore and log.
- `send`/`reply` missing `runId`: runtime throws; daemon logs error and may close.
- No server responses other than runtime events.

No new error events are defined in v1 to avoid changing runtime contracts.

## Connection Lifecycle

- Clients may connect before or during a run.
- There is no replay of past events; clients only receive events emitted after
  they connect.
- If a run is paused, clients remain connected and can issue `resume`.
- On completion or abort (non-resumable), daemon exits and WS closes.

## Compatibility Notes

- This protocol is identical to the SDK `WebSocketTransport` envelope.
- It is intended for non-TS clients to implement with minimal friction.

