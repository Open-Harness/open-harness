# Node Catalog (v1)

This document defines the canonical node set for Flow. It is the source of truth for node availability in the runtime and for UI/editor tooling.

## Conventions

- Each node type is registered in the Flow registry.
- Agent nodes are **stateful**, **injectable**, and may **stream**.
- Control nodes shape graph execution but do not call external providers.
- Full input/output schemas live in `../../spec.md#appendix-a-node-schemas-v1`.

## A) Control Nodes

| Node | Input | Output | Notes |
| --- | --- | --- | --- |
| `control.switch` | `{ value, cases: [{ when, route }] }` | `{ route, value }` | Routes by first matching case |
| `control.if` | `{ condition: WhenExpr }` | `{ condition: boolean }` | Binary branch |
| `control.merge` | `{ mode: \"all\" \\| \"any\" }` | `{ merged: true }` | Overrides readiness rules |
| `control.foreach` | `{ list: unknown[], as?: string }` | `{ item, index, count }` | Emits per item |
| `control.loop` | `{ while: WhenExpr, maxIterations?: number }` | `{ iteration }` | Stops when condition false |
| `control.wait` | `{ ms?: number, until?: string }` | `{ waitedMs }` | Delay or event wait |
| `control.gate` | `{ prompt, choices?, allowText? }` | `{ response }` | Uses session prompt |
| `control.subflow` | `{ name, input? }` | `{ outputs }` | Executes nested flow |
| `control.fail` | `{ message }` | (throws) | Fails the run |
| `control.noop` | `{ value? }` | `{ value? }` | Structural only |

## B) Agent Nodes

| Node | Input | Output | Notes |
| --- | --- | --- | --- |
| `agent.run` | `{ input, tools?, system?, model?, metadata? }` | `{ result }` | Full agent config |
| `agent.plan` | `{ input }` | `{ result }` | Preset agent |
| `agent.classify` | `{ input }` | `{ result }` | Preset agent |
| `agent.coder` | `{ input }` | `{ result }` | Preset agent (tools) |
| `agent.reviewer` | `{ input }` | `{ result }` | Preset agent |
| `agent.summarize` | `{ input }` | `{ result }` | Preset agent |
| `claude.agent` | `{ prompt \\| messages, options? }` | `{ text, structuredOutput?, usage? }` | Canonical Claude node |

All agent nodes:
- Always have inbox support.
- Emit `agent:*` and `agent:tool:*` events.
- Support streaming (`agent:text`).

## C) Data / Transform

| Node | Input | Output | Notes |
| --- | --- | --- | --- |
| `data.map` | `{ list, template? }` | `{ list }` | Map items |
| `data.filter` | `{ list, when }` | `{ list }` | Filter items |
| `data.reduce` | `{ list, initial? }` | `{ value }` | Reduce items |
| `data.merge` | `{ objects }` | `{ object }` | Merge objects |
| `data.pick` | `{ object, keys }` | `{ object }` | Pick keys |
| `data.set` | `{ object, path, value }` | `{ object }` | Set field |
| `data.json.parse` | `{ text }` | `{ value }` | Parse JSON |
| `data.json.stringify` | `{ value }` | `{ text }` | Stringify JSON |
| `data.template` | `{ template, values? }` | `{ text }` | Render string |
| `data.validate` | `{ value, schema }` | `{ valid, errors? }` | Validate |

## D) System / Runtime

| Node | Input | Output | Notes |
| --- | --- | --- | --- |
| `system.log` | `{ level, message }` | `{ ok: true }` | Emit log |
| `system.metrics` | `{ name, value, tags? }` | `{ ok: true }` | Emit metric |
| `system.cache.get` | `{ key }` | `{ value? }` | Cache read |
| `system.cache.set` | `{ key, value, ttlMs? }` | `{ ok: true }` | Cache write |
| `system.state.get` | `{ key }` | `{ value? }` | Runtime state read |
| `system.state.set` | `{ key, value }` | `{ ok: true }` | Runtime state write |

## Channels (not nodes)

Channels are **interfaces** to a running flow (console, voice, websocket, etc.). They attach to the runtime and are **not** declared as nodes in the graph.

```typescript
const instance = createFlowRunner(flow, registry, {
  channels: [ConsoleChannel(), VoiceChannel()],
});
```

## Capabilities (NodeType)

The registry should expose capabilities so the runtime can enforce invariants:

```typescript
interface NodeCapabilities {
  isStreaming?: boolean;
  supportsInbox?: boolean;
  isLongLived?: boolean;
  isAgent?: boolean;
}
```

Rules:
- All `agent.*` nodes set `isAgent: true` and `supportsInbox: true`.
- Control and data nodes do not set `supportsInbox`.
- Long-lived nodes must be explicit (not part of MVP).

## Key invariants

1. Channel interfaces are **not** nodes.
2. Agent nodes are stateful and injectable.
3. Control nodes define routing and structure only.
