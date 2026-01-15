# A2UI Integration Research

**Status:** Research Complete
**Date:** 2026-01-15
**Branch:** `feat/a2ui-integration-research`

## Executive Summary

Research into integrating Google's A2UI (Agent-to-User Interface) protocol with Open Harness to provide automatic UI generation for agent workflows. A2UI is a declarative JSON protocol that enables agents to generate rich, interactive UIs without executable code.

## What is A2UI?

A2UI is an open-source declarative UI protocol by Google (January 2026) that enables AI agents to generate user interfaces through structured JSON - "safe like data, expressive like code."

**Problem it solves:**
- Text-only agent interactions require multiple back-and-forth exchanges
- Running LLM-generated code presents security risks
- Multi-agent ecosystems need standardized UI communication

**Repository:** https://github.com/google/A2UI
**Spec:** https://a2ui.org/specification/v0.8-a2ui/

## A2UI Protocol Core Concepts

### Message Types (Server → Client)

| Message | Purpose |
|---------|---------|
| `surfaceUpdate` | Defines component tree as flat list with ID references |
| `dataModelUpdate` | Updates state at JSON Pointer paths |
| `beginRendering` | Signals client to render |
| `deleteSurface` | Removes a surface |

### Client → Server

| Message | Purpose |
|---------|---------|
| `userAction` | User interactions (clicks, form submissions) |
| `error` | Client-side error reporting |

### Example A2UI Message

```json
{
  "surfaceUpdate": {
    "surfaceId": "workflow-ui",
    "components": [
      {
        "id": "header",
        "component": {
          "Text": {
            "text": { "literalString": "Agent Response" },
            "usageHint": "h1"
          }
        }
      },
      {
        "id": "content",
        "component": {
          "Text": {
            "text": { "path": "/response/content" }
          }
        }
      }
    ]
  }
}
```

### Key Design Decisions in A2UI

1. **Flat component lists** - Components use ID references, not nesting (LLM-friendly)
2. **Data binding via paths** - JSON Pointer syntax (`/path/to/data`)
3. **Transport agnostic** - Works over JSONL, WebSocket, SSE, etc.
4. **Standard component catalog** - Text, Button, TextField, Card, Column, Row, etc.

## Open Harness Architecture (Relevant APIs)

### Signal System

```typescript
interface Signal<T = unknown> {
  id: string;           // Unique ID
  name: string;         // Colon-separated (e.g., "text:delta")
  payload: T;           // Event data
  timestamp: string;    // ISO timestamp
  source?: SignalSource;
}
```

### SignalBus

```typescript
bus.emit(signal)                    // Emit signal
bus.subscribe(["pattern:*"], fn)    // Subscribe with glob patterns
bus.history()                       // Get signal history
```

### Signal Types Emitted

| Signal | Payload | When |
|--------|---------|------|
| `workflow:start` | `{ agents, state, runId }` | Execution begins |
| `workflow:end` | `{ durationMs, state }` | Execution ends |
| `agent:activated` | `{ agent, trigger }` | Agent activates |
| `harness:start` | `{ harness, model }` | LLM call begins |
| `harness:end` | `{ output, usage }` | LLM call ends |
| `text:delta` | `{ content }` | Streaming chunk |
| `tool:call` | `{ name, input }` | Tool invoked |
| `tool:result` | `{ name, output }` | Tool completed |

## Integration Options

### Option 1: Pure Transformer Function

A stateless function that converts a single signal to an A2UI message.

```typescript
import { signalToA2UI } from "@open-harness/a2ui";

const message = signalToA2UI(signal, { surfaceId: "main" });
// Returns A2UIMessage | null
```

**Pros:** Maximum control, testable, composable
**Cons:** More boilerplate for users

### Option 2: Async Generator Stream

An async generator that yields A2UI messages from a SignalBus.

```typescript
import { createA2UIStream } from "@open-harness/a2ui";

const stream = createA2UIStream(bus, { surfaceId: "main" });

for await (const message of stream) {
  websocket.send(JSON.stringify(message));
}
```

**Pros:** Streaming-native, works with existing transport patterns
**Cons:** Requires understanding generators

### Option 3: Callback Subscriber

A subscriber that calls a callback with A2UI messages.

```typescript
import { subscribeA2UI } from "@open-harness/a2ui";

const unsubscribe = subscribeA2UI(bus, {
  surfaceId: "main",
  onMessage: (msg) => websocket.send(JSON.stringify(msg)),
  onUserAction: (action) => bus.emit(createSignal("user:action", action)),
});
```

**Pros:** Familiar pattern, handles bidirectional flow
**Cons:** Less composable than generators

## Default Signal → A2UI Mappings

| Signal Pattern | A2UI Component | Behavior |
|----------------|----------------|----------|
| `workflow:start` | `beginRendering` | Initialize surface |
| `text:delta` | `dataModelUpdate` | Append to streaming path |
| `text:complete` | `surfaceUpdate` + `dataModelUpdate` | Complete message |
| `harness:start` | `surfaceUpdate` (Card) | "Thinking..." indicator |
| `harness:end` | `surfaceUpdate` (Card) | Complete response |
| `tool:call` | `surfaceUpdate` (Card) | Tool name + args |
| `tool:result` | `surfaceUpdate` (Card) | Tool output |
| `harness:error` | `surfaceUpdate` (Card, error) | Error display |

## Proposed Package Structure

```
@open-harness/a2ui
├── src/
│   ├── transformer.ts      # signalToA2UI()
│   ├── stream.ts           # createA2UIStream()
│   ├── subscriber.ts       # subscribeA2UI()
│   ├── mappings/
│   │   ├── default.ts      # Default signal→component mappings
│   │   └── index.ts
│   ├── types.ts            # A2UI message types
│   └── index.ts
├── package.json
└── README.md
```

## Open Questions

1. **SignalBus access during runReactive** - Currently `runReactive` creates its own bus internally. To enable real-time A2UI streaming, should we:
   - Add `signalBus?: SignalBus` option to runReactive?
   - Expose signals via callback during execution?
   - Use the existing reporter pattern?

2. **userAction handling** - How should inbound actions convert to signals?
   - Generic `user:action` signal?
   - Mapped to specific patterns like `user:submit`, `user:click`?
   - Direct state mutations?

3. **Component catalog** - Should we:
   - Use A2UI's standard catalog exactly?
   - Define Open Harness-specific components?
   - Support custom catalogs?

## Next Steps

1. Decide on primary integration pattern (transformer vs stream vs subscriber)
2. Prototype the core transformer function
3. Define default signal→component mappings
4. Handle bidirectional flow (userAction → Signal)
5. Create example with web client

## References

- [A2UI Official Site](https://a2ui.org/)
- [A2UI GitHub](https://github.com/google/A2UI)
- [A2UI Specification v0.8](https://a2ui.org/specification/v0.8-a2ui/)
- [A2UI Transports](https://a2ui.org/transports/)
- [CopilotKit A2UI Integration](https://www.copilotkit.ai/blog/build-with-googles-new-a2ui-spec-agent-user-interfaces-with-a2ui-ag-ui)
