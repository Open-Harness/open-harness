# Transport Packages

Transport layer implementations for different communication protocols and integrations.

## Packages

### `websocket/`
**@open-harness/transport-websocket**

WebSocket transport for real-time bidirectional communication with Open Harness runtime. Enables:
- Real-time event streaming
- Command dispatch over WebSocket
- Connection management and reconnection

**Key Files:**
- `src/websocket.ts` - WebSocket transport implementation

**Usage:**
```typescript
import { WebSocketTransport } from "@open-harness/transport-websocket";

const transport = new WebSocketTransport({
  url: "ws://localhost:3000",
  runtime,
});
```

### `ai-sdk/`
**@open-harness/ai-sdk**

Vercel AI SDK adapter for React integration. Transforms Open Harness runtime events into AI SDK message chunks for use with `useChat()` hook.

**Key Files:**
- `src/transport.ts` - `OpenHarnessChatTransport` implementing AI SDK `ChatTransport` interface
- `src/transforms.ts` - Event transformation logic (text, reasoning, tools, errors)
- `src/types.ts` - Type definitions for transport options and custom data types

**Features:**
- Transforms runtime events to AI SDK chunks (text-start, text-delta, text-end, etc.)
- Supports reasoning/thinking parts
- Tool use integration
- Step markers for node execution
- Custom data parts for flow metadata

**Usage:**
```typescript
import { OpenHarnessChatTransport } from "@open-harness/ai-sdk";
import { useChat } from "@ai-sdk/react";

const transport = new OpenHarnessChatTransport(runtime, {
  sendReasoning: true,
  sendStepMarkers: true,
});

const { messages, input, handleSubmit } = useChat({
  transport,
});
```

## Transport Interface

Transports implement interfaces from `@open-harness/sdk`:
- Connect to runtime via `runtime.onEvent()` and `runtime.dispatch()`
- Handle connection lifecycle (connect, disconnect, reconnect)
- Transform between transport protocol and runtime events/commands
