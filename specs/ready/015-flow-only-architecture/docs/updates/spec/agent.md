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

## Key invariants

1. RunId is per invocation (no implicit memory).
2. Inbox exists for every agent-backed node.
