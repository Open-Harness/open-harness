# FlowSpec Protocol (Draft)

Defines the FlowSpec YAML schema and semantics for Flow-only execution.

## Schema

```yaml
flow:
  name: string
  version?: number
  description?: string
  input?: object
  policy?:
    failFast?: boolean

nodes:
  - id: NodeId
    type: NodeTypeId
    input: object
    config?: object
    when?: WhenExpr
    policy?:
      timeoutMs?: number
      retry?: { maxAttempts: number, backoffMs?: number }
      continueOnError?: boolean

edges:
  - from: NodeId
    to: NodeId
    when?: WhenExpr
```

## Edge `when`

Edges may include `when` conditions. The condition is evaluated when the **source node completes**. If it resolves to `false`, that edge is skipped.

## Runtime attachment (channels)

Channels are external interfaces and do not appear in FlowSpec. They attach at runtime:

```typescript
const flow = parseFlowYaml(source);
const registry = createRegistryWithNodes();

const instance = createFlowRunner(flow, registry, {
  channels: [ConsoleChannel(), VoiceChannel()],
});

await instance.run();
```

**Preferred**: pass channels in `createFlowRunner(...)` options for deterministic startup ordering. Use `attach()` for dynamic additions.

## Node `config`

`config` is passed through to the NodeType implementation. Agent nodes must forward config to the underlying agent runner.

## Channels (not in FlowSpec)

Channels are runtime interfaces and do not appear in FlowSpec. They are attached when creating a flow runner.

## Key invariants

1. Edges define dependencies; the graph is never inferred from order or bindings.
2. Edge `when` gates routing between nodes.
3. `policy` fields are enforced by the runtime, not just validated.
