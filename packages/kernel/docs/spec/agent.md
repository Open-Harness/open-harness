# Agent Protocol

Agents are executable units that emit events and return results.

## AgentDefinition contract

```typescript
interface AgentDefinition<TIn = unknown, TOut = unknown> {
  name: string;
  emitsStartComplete?: boolean;
  execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}
```

### `emitsStartComplete`

If `true`, the agent implementation is responsible for emitting:
- `agent:start` (with `runId`)
- `agent:complete` (with `runId`)

This is useful for provider adapters (e.g., streaming SDKs) that want tighter control over run lifecycle events.

If `false` or omitted, the harness emits these events automatically.

## Execute context

```typescript
interface AgentExecuteContext {
  hub: Hub;
  inbox: AgentInbox;
  runId: string;
}
```

### `hub`

The hub for emitting events. Agents should emit `agent:*` events via `hub.emit(...)`.

### `inbox`

Read-only inbox for messages injected by channels (via `hub.sendToRun(runId, ...)`).

```typescript
interface AgentInbox extends AsyncIterable<InjectedMessage> {
  pop(): Promise<InjectedMessage>;
  drain(): InjectedMessage[];
}

interface InjectedMessage {
  content: string;
  timestamp: Date;
}
```

A provider wrapper can:
- Concurrently `for await (const msg of inbox)` and forward messages to the underlying SDK session
- Or `await inbox.pop()` when it wants to block for the next message

### `runId`

Unique ID for this particular agent execution. This is the routing key for `hub.sendToRun(runId, ...)`.

**Important**: When multiple runs of the same agent can be active concurrently, channels should:
1. Listen for `agent:start` events to get the `runId`
2. Call `hub.sendToRun(runId, message)` (not `hub.sendTo(agentName, message)`)

## ExecutableAgent (runtime view)

At runtime, workflow code sees:

```typescript
interface ExecutableAgent<TIn = unknown, TOut = unknown> {
  name: string;
  execute(input: TIn): Promise<TOut>;
}
```

The harness wraps `AgentDefinition` to provide this simpler interface (no context args).

## Key invariants

1. **Agents emit events via hub** - they don't "print directly"
2. **Agents can receive injected messages** - via `inbox` (if the provider wrapper supports it)
3. **runId is the routing key** - for run-scoped message injection
