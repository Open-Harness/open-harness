# Flow Registry Protocol (Draft)

Defines how NodeTypes are registered and what capabilities they advertise.

## NodeType

```typescript
export interface NodeTypeDefinition<TIn, TOut> {
  type: string;
  inputSchema: ZodSchema<TIn>;
  outputSchema: ZodSchema<TOut>;
  capabilities?: NodeCapabilities;
  run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}
```

## Capabilities

```typescript
interface NodeCapabilities {
  isStreaming?: boolean;
  supportsInbox?: boolean;
  isLongLived?: boolean;
  isAgent?: boolean;
}
```

### Rules

- All `agent.*` nodes set `isAgent: true` and `supportsInbox: true`.
- Agent nodes should emit `agent:*` and `agent:tool:*` events.
- Non-agent nodes do not require inbox support.
- Long-lived nodes are opt-in and not part of MVP.

## Key invariants

1. Registry is the source of truth for node implementations.
2. Capabilities inform runtime behavior (inbox creation, streaming).
