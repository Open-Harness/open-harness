---
title: "Runtime State Management"
lastUpdated: "2026-01-07T16:37:37.893Z"
lastCommit: "72a1693673d110e1b19885762e3ceaafec16c6da"
lastCommitDate: "2026-01-07T16:12:52Z"
scope:
  - state-management
  - runtime-state
  - snapshots
  - persistence
---

# Runtime State Management

Defines the runtime state model, snapshot schema, and state-store contract used by node execution and persistence.

## What's here

This directory and the `state/` module include:
- **FlowDefinition** — YAML-based flow structure.
- **RunSnapshot / RunState** — Snapshot schema for runtime state.
- **StateStore** — Key-value state store available to node execution.
- **Runtime events** — Flow/node/agent/state event shapes.
- **CancelContext** — Internal cancellation context (runtime uses `AbortSignal` externally).

## State Architecture

```
FlowDefinition (Input)
        │
        ▼
RunState (Mutable)
  ├─ status: "idle" | "running" | "paused" | "aborted" | "complete"
  ├─ outputs: Record<nodeId, unknown>
  ├─ state: Record<string, unknown>
  ├─ nodeStatus: Record<nodeId, NodeStatus>
  ├─ edgeStatus: Record<edgeId, EdgeStatus>
  ├─ loopCounters: Record<edgeId, number>
  ├─ inbox: RuntimeCommand[] (legacy, kept empty)
  └─ agentSessions: Record<nodeId, sessionId>
        │
        └─ snapshots at intervals
                │
                └─ RunSnapshot (Serializable)
```

## Key Contracts

### RunSnapshot / RunState

`RunState` is an internal alias of `RunSnapshot` with optional runtime-only fields.

```typescript
type NodeStatus = "pending" | "running" | "done" | "failed";
type EdgeStatus = "pending" | "fired" | "skipped";

type RunSnapshot = {
  runId?: string;
  status: "idle" | "running" | "paused" | "aborted" | "complete";
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  loopCounters: Record<string, number>;
  inbox: RuntimeCommand[]; // legacy, kept empty
  agentSessions: Record<string, string>;
};
```

### StateStore

StateStore is a key-value store exposed to nodes via `NodeRunContext.state`.

```typescript
interface StateStore {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  patch(patch: StatePatch): void;
  snapshot(): Record<string, unknown>;
}
```

## Interruption (Pause/Stop)

Nodes receive an `AbortSignal` via `NodeRunContext.signal`. The runtime triggers it
for pause/stop/timeout. Nodes should listen and exit early when aborted.

```typescript
if (ctx.signal.aborted) {
  // cleanup and return
}
```

## Events Emitted

As state changes, the runtime emits events:

- `flow:start` — Run begins
- `flow:paused` — Pause requested
- `flow:resumed` — Resume requested
- `flow:aborted` — Hard stop requested
- `flow:complete` — Flow finished
- `node:start` — Node execution begins
- `node:complete` — Node succeeded
- `node:error` — Node failed
- `node:skipped` — Node skipped by gate/when
- `edge:fire`, `loop:iterate`, `state:patch`
- `command:received` — Runtime command ingested
- Agent events (`agent:*`) for provider streams

## Snapshots and Resume

Snapshots are persisted via `RunStore` (see `../persistence/README.md`).

```typescript
const store = new InMemoryRunStore();
const runtime = createRuntime({ flow, registry, store });

const snapshot = await runtime.pause();
await store.saveSnapshot(snapshot);

const resumed = createRuntime({ flow, registry, store, resume: { snapshot } });
await resumed.resume("continue");
```

## Testing

You can validate state transitions using runtime snapshots:

```typescript
const runtime = createRuntime({ flow, registry });
await runtime.run();
const snapshot = runtime.getSnapshot();
expect(snapshot.status).toBe("complete");
```

## See Also

- `../execution/README.md` — Node execution engine
- `../persistence/README.md` — RunStore persistence
- `../../state/` — Flow types, events, snapshot schema
