# Agent Protocol (Draft)

Defines the Agent contract and execution semantics in Flow-only runtime.

## AgentDefinition

```typescript
export interface AgentDefinition<TIn = unknown, TOut = unknown> {
  name: string;
  emitsStartComplete?: boolean;
  execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}
```

## RunId semantics

- Each agent invocation gets a **fresh `runId`**.
- Multiple agents can run in the same task scope but have distinct runIds.

## Inbox semantics

- All agent nodes receive an inbox for the duration of their run.
- `hub.sendToRun(runId, message)` injects into the agent inbox.
- Multi-turn agents must consume an async iterable prompt stream that yields:\n
  1) initial messages from input\n
  2) subsequent user messages from the inbox\n
- The prompt stream must terminate via explicit inbox close (`inbox.close()`), or by SDK maxTurns if configured.

## Async prompt stream contract

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

### SDK user message shape (Claude SDK)

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

## Key invariants

1. RunId is per invocation (no implicit memory).
2. Inbox exists for every agent-backed node.
