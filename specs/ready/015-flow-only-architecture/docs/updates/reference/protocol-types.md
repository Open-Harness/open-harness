# Protocol Types (Draft, Flow-Only)

This is a draft view of type-level changes required for Flow-only execution.

## Edge

```typescript
export interface Edge {
  from: NodeId;
  to: NodeId;
  when?: WhenExpr;
}
```

## NodeCapabilities

```typescript
export interface NodeCapabilities {
  isStreaming?: boolean;
  supportsInbox?: boolean;
  isLongLived?: boolean;
  isAgent?: boolean;
}
```

## Flow Runtime types

```typescript
export interface FlowRunnerOptions {
  sessionId?: string;
  input?: Record<string, unknown>;
  channels?: ChannelDefinition<any>[];
  policy?: FlowPolicy;
}

export interface FlowRunResult {
  outputs: Record<string, unknown>;
  events: EnrichedEvent[];
  durationMs: number;
  status: HubStatus;
}

export interface FlowInstance extends Hub {
  attach(channel: ChannelDefinition<any>): this;
  startSession(): this;
  run(): Promise<FlowRunResult>;
}
```

## AgentInbox (Flow-only additions)

```ts
export interface AgentInbox extends AsyncIterable<InjectedMessage> {
  pop(): Promise<InjectedMessage>;
  drain(): InjectedMessage[];
  close(): void;
}
```

## SDKUserMessage (Claude SDK reference)

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
