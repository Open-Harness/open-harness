# Node Registry Protocol

The Node Registry maps `node.type` (NodeTypeId) to `NodeTypeDefinition` (TypeScript implementation).

## NodeTypeDefinition

```typescript
interface NodeTypeDefinition<TIn, TOut> {
  type: string;  // NodeTypeId
  inputSchema: ZodSchema<TIn>;
  outputSchema: ZodSchema<TOut>;
  capabilities?: NodeCapabilities;
  run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}
```

### Schemas

- `inputSchema`: Zod schema for validating `node.input` (after binding resolution)
- `outputSchema`: Zod schema for validating node output

### Capabilities

```typescript
interface NodeCapabilities {
  /** Emits streaming `agent:text` during run */
  isStreaming?: boolean;
  /** Supports receiving run-scoped injected messages */
  supportsInbox?: boolean;
  /** Long-lived session semantics (voice websocket, etc.) */
  isLongLived?: boolean;
}
```

### Run context

```typescript
interface NodeRunContext {
  hub: Hub;
  runId: string;
  inbox?: AgentInbox;  // present if supportsInbox is true
}
```

## NodeRegistry

```typescript
class NodeRegistry {
  register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void;
  get(type: NodeTypeId): NodeTypeDefinition<any, any>;
}
```

### Registration

```typescript
registry.register({
  type: "claude.agent",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.string(),
  capabilities: { isStreaming: true, supportsInbox: true },
  run: async (ctx, input) => {
    // implementation
  },
});

## Node Packs (CLI registry UX)

Node packs are named bundles of node definitions used by the CLI to build the
registry from an explicit allowlist.

```ts
interface NodePack {
  register(registry: NodeRegistry): void;
}
```

**YAML** declares required packs:

```yaml
flow:
  name: my-flow
  nodePacks: [core, claude]
```

**oh.config.ts** allowlists implementations:

```ts
import { corePack, claudePack } from "@open-harness/kernel";

export const nodePacks = {
  core: corePack,
  claude: claudePack,
};
```

If a flow requests a pack not present in `oh.config.ts`, the CLI fails fast with
a clear error.
```

## Library vs user responsibilities

### Library provides

- Engine + compiler + binding resolver
- Registry interfaces + base types
- Built-in control/utility nodes (e.g., `condition.equals`)
- Reference provider nodes (e.g., `claude.agent`, `claude.structured`)
- Transport adapters (console + websocket skeleton)

### User provides

- Domain nodes (their business logic)
- Provider presets (models/options)
- External tool servers (MCP or otherwise)
- Optional state reducers (later)

## NodeType naming

Recommended pattern: `namespace.kind`

Examples:
- `claude.agent`
- `claude.structured`
- `condition.equals`
- `mcp.geo.country_info`

## Key invariants

1. **NodeType is TypeScript** - implementations are in TypeScript, not YAML
2. **Schemas are Zod** - for validation and type safety
3. **Registry is in-memory** (MVP) - later: plugin loading, namespacing, capability queries
