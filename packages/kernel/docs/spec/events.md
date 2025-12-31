# Events Protocol

## Canonical envelope

All events are emitted via the hub and delivered in a single envelope:

```typescript
interface EnrichedEvent<T extends BaseEvent = BaseEvent> {
  id: string;
  timestamp: Date;
  context: EventContext;
  event: T;
}
```

**Invariant**: No adapter shims. No "sometimes it's `{ type }` and sometimes it's `{ event: { type } }`". Everything uses this envelope.

## Context (hierarchical)

Context is automatically propagated using `hub.scoped(...)` (AsyncLocalStorage):

```typescript
interface EventContext {
  sessionId: string;  // always present
  phase?: { name: string; number?: number };
  task?: { id: string };
  agent?: { name: string; type?: string };
}
```

- `context.sessionId` - always present
- `context.phase` - present inside `phase(...)`
- `context.task` - present inside `task(...)`
- `context.agent` - present inside `agents.foo.execute(...)`

Any `hub.emit(...)` inside a scoped block inherits the context automatically.

## Required event types (kernel contract)

### Harness lifecycle

- `harness:start` - `{ name: string }`
- `harness:complete` - `{ success: boolean; durationMs: number }`

### Phase lifecycle

- `phase:start` - `{ name: string; phaseNumber?: number }`
- `phase:complete` - `{ name: string; phaseNumber?: number }`
- `phase:failed` - `{ name: string; error: string; stack?: string; phaseNumber?: number }`

### Task lifecycle

- `task:start` - `{ taskId: string }`
- `task:complete` - `{ taskId: string; result?: unknown }`
- `task:failed` - `{ taskId: string; error: string; stack?: string }`

### Agent lifecycle

- `agent:start` - `{ agentName: string; runId: string }`
- `agent:complete` - `{ agentName: string; success: boolean; runId: string }`

**Optional but common** (providers/middleware may emit):

- `agent:thinking` - `{ content: string; runId?: string }`
- `agent:text` - `{ content: string; runId?: string }`
- `agent:tool:start` - `{ toolName: string; input?: unknown; runId?: string }`
- `agent:tool:complete` - `{ toolName: string; result?: unknown; isError?: boolean; runId?: string }`

### Interactive/session (optional)

- `session:prompt` - `{ promptId: string; prompt: string; choices?: string[]; allowText?: boolean }`
- `session:reply` - `{ promptId: string; content: string; choice?: string }`
- `session:abort` - `{ reason?: string }`
- `session:message` - `{ content: string; agentName?: string; runId?: string }` (emitted when channels call `hub.send()` / `hub.sendTo()`)

## Extension events

Any other `type: string` is allowed and forwarded unchanged:

```typescript
type ExtensionEvent = { type: string; [k: string]: unknown }
```

**Rule**: Extension events must still be enveloped + contextualized like every other event.

## Key invariants

1. **Single event envelope** end-to-end
2. **All events flow through the hub** (agents/runtime don't "print directly")
3. **Context propagation is automatic** (no manual context threading)
