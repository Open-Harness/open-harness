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

If `false` or omitted, the runtime emits these events automatically.

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
  close(): void;
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

## Async prompt stream (Claude SDK)

Multi-turn agent nodes must provide an **async iterable** prompt stream to the Claude SDK.

Contract:
- Yield initial messages from node input (prompt or messages array)
- Then yield new user messages from `AgentInbox`
- Terminate via explicit inbox close or SDK maxTurns

```ts
async function* promptStream(
  initial: SDKUserMessage[],
  inbox: AgentInbox,
  sessionId: string,
): AsyncGenerator<SDKUserMessage> {
  for (const msg of initial) yield msg;
  for await (const injected of inbox) {
    yield toSdkUserMessage(injected, sessionId);
  }
}
```

### SDK user message shape

```ts
type SDKUserMessage = {
  type: "user";
  message: { role: "user"; content: string };
  parent_tool_use_id: string | null;
  session_id: string;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
};
```

## ExecutableAgent (runtime view)

At runtime, workflow code sees:

```typescript
interface ExecutableAgent<TIn = unknown, TOut = unknown> {
  name: string;
  execute(input: TIn): Promise<TOut>;
}
```

The runtime wraps `AgentDefinition` to provide this simpler interface (no context args).

## Key invariants

1. **Agents emit events via hub** - they don't "print directly"
2. **Agents can receive injected messages** - via `inbox`
3. **runId is the routing key** - for run-scoped message injection
