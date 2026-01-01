# Node Catalog (v1)

This document defines the canonical node set for Flow. It is the source of truth for node availability in the runtime and for UI/editor tooling.

## Conventions

- Each node type is registered in the Flow registry.
- Agent nodes are **stateful**, **injectable**, and may **stream**.
- Control nodes shape graph execution but do not call external providers.
- Full input/output schemas live in the registered `NodeTypeDefinition` sources.

## A) Control Nodes

| Node | Input | Output | Notes |
| --- | --- | --- | --- |
| `control.switch` | `{ value, cases: [{ when, route }] }` | `{ route, value }` | Routes by first matching case |
| `control.if` | `{ condition: WhenExpr }` | `{ condition: boolean }` | Binary branch |
| `control.merge` | `{ mode: \"all\" \\| \"any\" }` | `{ merged: true }` | Overrides readiness rules |
| `control.foreach` | `{ items: unknown[], as?: string, body: NodeId[] }` | `{ iterations: [...] }` | Session per iteration |
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
- Use V2 SDK session pattern (subscribe to `session:message` events).
- Emit `agent:*` and `agent:tool:*` events.
- Support streaming (`agent:text`).
- Multi-turn via `hub.sendToRun(runId, message)`.

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
  supportsMultiTurn?: boolean;  // V2: uses session:message subscription
  isLongLived?: boolean;
  isAgent?: boolean;
  isContainer?: boolean;        // Container nodes like control.foreach
  createsSession?: boolean;     // Creates fresh session per iteration
}
```

Rules:
- All `agent.*` nodes set `isAgent: true` and `supportsMultiTurn: true`.
- Container nodes (`control.foreach`) set `isContainer: true` and `createsSession: true`.
- Long-lived nodes must be explicit (not part of MVP).

## Key invariants

1. Channel interfaces are **not** nodes.
2. Agent nodes use V2 SDK session pattern for multi-turn.
3. Control nodes define routing and structure only.
4. Container nodes (`control.foreach`) create fresh sessions per iteration.

## control.foreach Details

The `control.foreach` node iterates over an array, executing child nodes for each item with session isolation:

```yaml
nodes:
  - id: process_tasks
    type: control.foreach
    input:
      items: "{{ taskCreator.tasks }}"
      as: "task"
    body:
      - validate_task
      - execute_task
      - report_result
```

**Session Isolation**: Each iteration gets a fresh `sessionId` via `createSessionId()`. This ensures:
- No state leakage between iterations
- Clean context for each batch item
- Proper lifecycle events (`session:start`, `session:end`)

**Events Emitted**:
- `session:start` at iteration begin (with new sessionId)
- `session:end` at iteration end
- Child node events inherit the iteration's sessionId
