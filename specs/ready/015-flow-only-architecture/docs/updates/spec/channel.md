# Channel Protocol (Draft)

Channels are **interfaces** to a running flow (console, websocket, voice, etc.). They attach to the runtime and are not represented as nodes.

## ChannelDefinition

```typescript
export interface ChannelDefinition<TState> {
  name: string;
  state?: () => TState;
  onStart?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
  onComplete?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
  on: Record<string, ChannelHandler<TState>>;
}
```

## Key invariants

1. Channels attach to runtime, not to nodes.
2. Channels can observe events and send commands to the hub.
