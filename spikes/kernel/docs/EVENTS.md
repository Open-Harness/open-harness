# Minimal Event Set

The kernel only commits to a **small, stable** set of events. Everything else is an extension event.

All events are delivered in the canonical envelope:

```ts
type EnrichedEvent = {
  id: string;
  timestamp: Date;
  context: EventContext;
  event: BaseEvent;
}
```

## Context (automatic)

Context is automatically propagated using `hub.scoped(...)` (AsyncLocalStorage).

- `context.sessionId` — always present
- `context.phase` — present inside `phase(...)`
- `context.task` — present inside `task(...)`
- `context.agent` — present inside `agents.foo.execute(...)`

## Workflow lifecycle

- `harness:start` `{ name }`
- `harness:complete` `{ success, durationMs }`

## Phase lifecycle

- `phase:start` `{ name, phaseNumber? }`
- `phase:complete` `{ name, phaseNumber? }`

## Task lifecycle

- `task:start` `{ taskId }`
- `task:complete` `{ taskId, result? }`
- `task:failed` `{ taskId, error, stack? }`

## Agent lifecycle (minimal)

- `agent:start` `{ agentName }`
- `agent:complete` `{ agentName, success }`

Optional (providers/middleware may emit):

- `agent:thinking` `{ content }`
- `agent:text` `{ content }`
- `agent:tool:start` `{ toolName, input? }`
- `agent:tool:complete` `{ toolName, result?, isError? }`

## Session (bidirectional)

Emitted by the harness when interactive mode is used:

- `session:prompt` `{ promptId, prompt, choices? }`
- `session:reply` `{ promptId, content, choice? }`
- `session:abort` `{ reason? }`

## Extension events

Any other `type: string` is allowed and forwarded unchanged.

# Minimal Event Model

The kernel lives or dies on **one canonical event contract**.

## Envelope (always)

Every emitted event is wrapped in an envelope that includes:
- a stable `id`
- `timestamp`
- hierarchical `context` (session → phase/task/agent)
- the actual event payload (`event`)

```ts
export interface EnrichedEvent<E extends BaseEvent = BaseEvent> {
  id: string;
  timestamp: Date;
  context: EventContext;
  event: E;
}
```

## Context (hierarchical)

```ts
export interface EventContext {
  sessionId: string;
  phase?: { name: string; number?: number };
  task?: { id: string };
  agent?: { name: string; type?: string };
}
```

## Minimal required event types

These are the **kernel minimum** (everything else is extension).

### Workflow lifecycle

- `harness:start`
- `harness:complete`

### Orchestration helpers

- `phase:start`, `phase:complete`, `phase:failed`
- `task:start`, `task:complete`, `task:failed`

### Agent execution

- `agent:start`
- `agent:complete`
- Optional but common:
  - `agent:thinking` (short internal reasoning signal)
  - `agent:text` (output streaming chunks)
  - `agent:tool:start` / `agent:tool:complete`

### Narratives (optional plugin produces these)

- `narrative`

### Interactive session (optional)

- `session:prompt`
- `session:reply`
- `session:abort`
  - `session:prompt` supports `choices[]` and `allowText` for “choices + free-text fallback”

### Interactive message injection (optional but core to bidirectional channels)

- `session:message` (emitted when channels call `hub.send()` / `hub.sendTo()`)

## Extension events

Everything else uses the extension hook:

```ts
type ExtensionEvent = { type: string; [k: string]: unknown }
```

Rule: **extension events must still be enveloped + contextualized** like every other event.

