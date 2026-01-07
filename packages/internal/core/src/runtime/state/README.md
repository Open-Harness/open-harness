---
title: "Runtime State Management"
lastUpdated: "2026-01-07T10:33:43.219Z"
lastCommit: "7dd3f50eceaf866d8379e1c40b63b5321da7313f"
lastCommitDate: "2026-01-07T10:32:30Z"
scope:
  - state-management
  - runtime-state
  - snapshots
  - persistence
---

# Runtime State Management

Manages the state of flow execution, including node status, edge completion, snapshots, and persistence contracts.

## What's here

This directory contains type definitions and interfaces for:
- **FlowDefinition** — YAML-based flow structure
- **RunSnapshot** — Snapshot of execution state at a point in time
- **RunState** — Mutable state during flow execution
- **StateStore** — Contract for state storage implementations
- **Event types** — Runtime events (flow:started, node:completed, etc.)
- **Cancellation context** — Flow cancellation management

All types are defined in `state/`, `types.ts`, `events.ts`, `cancel.ts`, and `snapshot.ts`.

## State Architecture

```
FlowDefinition (Input)
        │
        ├─ validates against schema
        ├─ converted to CompiledFlow
        │
RunState (Mutable)
        ├─ nodeStatus: Map<nodeId -> "pending" | "running" | "done" | "failed">
        ├─ edgeStatus: Map<edgeKey -> "pending" | "done">
        ├─ nodeOutput: Map<nodeId -> output>
        ├─ nodeError: Map<nodeId -> error>
        │
        └─ snapshots at intervals
                │
                └─ RunSnapshot (Immutable point-in-time)
                        ├─ runId
                        ├─ flowId
                        ├─ nodeStatus
                        ├─ edgeStatus
                        ├─ nodeOutput / nodeError
                        ├─ timestamp
                        │
                        └─ persisted to StateStore
```

## Key Contracts

### RunState (Mutable)

Tracks current execution progress:

```typescript
interface RunState {
  runId: string;
  flowId: string;
  nodeStatus: Record<string, NodeExecutionStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  nodeOutput: Record<string, unknown>;
  nodeError: Record<string, string>;
  stateVariables: Record<string, unknown>;
}

type NodeExecutionStatus = "pending" | "running" | "done" | "failed";
type EdgeStatus = "pending" | "done";
```

### RunSnapshot (Immutable)

Point-in-time capture for persistence:

```typescript
interface RunSnapshot {
  runId: string;
  flowId: string;
  nodeStatus: Record<string, NodeExecutionStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  nodeOutput: Record<string, unknown>;
  nodeError: Record<string, string>;
  stateVariables: Record<string, unknown>;
  timestamp: string;  // ISO 8601
  completedAt?: string;
  cancelledAt?: string;
}
```

### StateStore (Persistence)

Interface for storing and retrieving state:

```typescript
interface StateStore {
  // Save a snapshot
  saveSnapshot(snapshot: RunSnapshot): Promise<void>;
  
  // Load latest snapshot for a run
  loadSnapshot(runId: string): Promise<RunSnapshot | null>;
  
  // List all snapshots for a run (for resume/checkpoint)
  listSnapshots(runId: string): Promise<RunSnapshot[]>;
  
  // Delete snapshots (cleanup)
  deleteSnapshots(runId: string): Promise<void>;
}
```

## Node Execution Status

```
pending ──> running ──> done
              ├──────> failed
```

- **pending** — Awaiting execution (prerequisites not met or not yet started)
- **running** — Currently executing
- **done** — Completed successfully
- **failed** — Execution failed (error captured in nodeError)

## Edge Status

- **pending** — Source node not yet done
- **done** — Source node completed; edge activated

## State Updates During Execution

### 1. Node Starts

```typescript
nodeStatus[nodeId] = "running";
```

### 2. Node Completes (Success)

```typescript
nodeStatus[nodeId] = "done";
nodeOutput[nodeId] = output;
// All outgoing edges become "done"
for (const edge of outgoing) {
  edgeStatus[edgeKey(edge)] = "done";
}
```

### 3. Node Completes (Failure)

```typescript
nodeStatus[nodeId] = "failed";
nodeError[nodeId] = errorMessage;
// Flow continues based on error handling (may stop or continue)
```

## Cancellation

When flow is cancelled:

```typescript
cancelContext.cancelled = true;
cancelContext.reason = "User requested";

// All running nodes check cancellation and stop
// No new nodes start
// Flow emits cancellation event
```

## Events Emitted

As state changes, events are emitted:

- `flow:started` — RunState created
- `node:started` — nodeStatus[id] = "running"
- `node:completed` — nodeStatus[id] = "done"
- `node:failed` — nodeStatus[id] = "failed"
- `flow:completed` — All nodes done/failed
- `flow:cancelled` — Cancellation triggered
- `snapshot:created` — RunSnapshot persisted

## Snapshot Checkpointing

Snapshots enable resuming interrupted flows:

```typescript
// Create snapshot periodically or after each node
const snapshot = currentRunState.toSnapshot();
await stateStore.saveSnapshot(snapshot);

// Later: resume from checkpoint
const checkpoint = await stateStore.loadSnapshot(runId);
const resumedState = RunState.fromSnapshot(checkpoint);
// Continue execution from pending nodes
```

## State Persistence Strategies

### In-Memory (No Persistence)

```typescript
class InMemoryStateStore implements StateStore {
  private snapshots = new Map<string, RunSnapshot[]>();
  
  async saveSnapshot(snapshot: RunSnapshot) {
    if (!this.snapshots.has(snapshot.runId)) {
      this.snapshots.set(snapshot.runId, []);
    }
    this.snapshots.get(snapshot.runId)!.push(snapshot);
  }
  
  async loadSnapshot(runId: string) {
    const snaps = this.snapshots.get(runId) ?? [];
    return snaps.length > 0 ? snaps[snaps.length - 1] : null;
  }
}
```

### Database Persistence

```typescript
class DatabaseStateStore implements StateStore {
  constructor(private db: Database) {}
  
  async saveSnapshot(snapshot: RunSnapshot) {
    await this.db.insert('run_snapshots', {
      run_id: snapshot.runId,
      flow_id: snapshot.flowId,
      data: JSON.stringify(snapshot),
      timestamp: snapshot.timestamp,
    });
  }
  
  async loadSnapshot(runId: string) {
    const row = await this.db.query(
      'SELECT data FROM run_snapshots WHERE run_id = ? ORDER BY timestamp DESC LIMIT 1',
      [runId]
    );
    return row ? JSON.parse(row.data) : null;
  }
}
```

## Error Handling in State

Errors are stored alongside state:

```typescript
// On node failure
nodeError[nodeId] = error.message;
nodeStatus[nodeId] = "failed";

// Flow can:
// 1. Stop (if error is critical)
// 2. Continue (if error is recoverable)
// 3. Retry (based on policy)
// 4. Skip (if optional)
```

## State Recovery and Resume

Resume flows from checkpoint:

```typescript
// 1. Load last snapshot
const snapshot = await stateStore.loadSnapshot(runId);

// 2. Create RunState from snapshot
const state = RunState.fromSnapshot(snapshot);

// 3. Determine pending nodes
const pending = state.nodeStatus
  .filter(status => status === "pending")
  .keys();

// 4. Continue execution from pending nodes
for (const nodeId of pending) {
  await executor.runNode(nodeId, state);
}
```

## Concurrency and Thread Safety

State updates must be atomic:

```typescript
// ✓ Atomic: Update node AND edges together
runState.update(() => {
  nodeStatus[id] = "done";
  for (const edge of outgoing) {
    edgeStatus[edgeKey(edge)] = "done";
  }
});

// ✗ Non-atomic: Separate updates can race
nodeStatus[id] = "done";
for (const edge of outgoing) {
  edgeStatus[edgeKey(edge)] = "done";  // May be read in-between
}
```

## Testing State

Test state transitions with snapshots:

```typescript
const initialState = RunState.create(flowDef, runId);
const initialSnapshot = initialState.toSnapshot();

// Execute one node
state.nodeStatus[nodeId] = "done";
state.nodeOutput[nodeId] = { result: 42 };

// Verify snapshot captures state
const snapshot = state.toSnapshot();
expect(snapshot.nodeOutput[nodeId]).toEqual({ result: 42 });

// Verify resume from snapshot
const resumed = RunState.fromSnapshot(snapshot);
expect(resumed.nodeOutput).toEqual(initialState.nodeOutput);
```

## See Also

- `../compiler/README.md` — Flow compilation and scheduling
- `../execution/README.md` — Node execution engine
- `../expressions/README.md` — Expression evaluation for bindings
- Type definitions: `types.ts`, `events.ts`, `cancel.ts`, `snapshot.ts`
