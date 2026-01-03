# Kernel V3 Architecture (Graph-First Runtime)

Last updated: 2026-01-03

This document describes the V3 architecture for the kernel. It is not a spec. It defines
system boundaries, core abstractions, file layout, class shapes, public interfaces, and
testing strategy. Implementation details are intentionally omitted.

V3 is a standalone package under packages/kernel-v3. V2 will be removed after migration.

---

## 1. Goals

- Graph-first execution model that maps cleanly to ReactFlow.
- Deterministic, testable runtime with explicit state and command handling.
- Transport-agnostic core (WebSocket is an adapter, not a core dependency).
- Optional persistence for pause/resume via snapshot + event log.
- Clear module boundaries and explicit public API.

## 2. Non-Goals (V3.0)

- Full distributed execution.
- Automatic parallel scheduling (allowed later, but not required now).
- Backwards compatibility with V2 (no compatibility layer planned).
- All V2 node types on day one (parity plan below).

---

## 3. System Boundary

V3 core is a runtime library.

IN SCOPE
- Flow definition + compilation
- Runtime execution + state management
- Event emission and command ingestion
- Optional persistence interface

OUT OF SCOPE
- Web servers
- WebSocket server lifecycle
- UI implementation
- CLI tooling

Adapters live outside the core runtime.

---

## 4. Core Concepts (Types)

Graph-first means edges are first-class control flow. The runtime is not a DAG. Cycles
are allowed and controlled by edge conditions and iteration caps.

```ts
export type FlowDefinition = {
  name: string;
  version?: number;
  state?: StateSchemaDefinition;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
};

export type NodeDefinition = {
  id: string;
  type: string;
  input: Record<string, unknown>;
  when?: WhenExpr;
  policy?: NodePolicy;
  ui?: { x: number; y: number; label?: string; color?: string };
};

export type EdgeDefinition = {
  id?: string;
  from: string;
  to: string;
  when?: WhenExpr;
  gate?: "any" | "all";
  forEach?: { in: string; as: string };
  maxIterations?: number;
};

export type StateSchemaDefinition = {
  initial: Record<string, unknown>;
  schema?: Record<string, unknown>;
};
```

---

## 5. Runtime Architecture

The runtime owns state and execution. It emits events and consumes commands.

### 5.1 Public Runtime Interface

```ts
export type RuntimeStatus = "idle" | "running" | "paused" | "aborted" | "complete";

export type RuntimeCommand =
  | { type: "send"; message: string; runId: string }
  | { type: "reply"; promptId: string; content: string; runId: string }
  | { type: "abort"; resumable?: boolean; reason?: string }
  | { type: "resume"; message?: string };

export type RuntimeEvent =
  | { type: "flow:start"; flowName: string }
  | { type: "flow:complete"; flowName: string; status: "complete" | "failed" }
  | { type: "node:start"; nodeId: string; runId: string }
  | { type: "node:complete"; nodeId: string; runId: string; output: unknown }
  | { type: "node:error"; nodeId: string; runId: string; error: string }
  | { type: "edge:fire"; edgeId?: string; from: string; to: string }
  | { type: "loop:iterate"; edgeId?: string; iteration: number }
  | { type: "state:patch"; patch: StatePatch }
  | { type: "command:received"; command: RuntimeCommand }
  | { type: "flow:paused" | "flow:resumed" | "flow:aborted" };

// All runtime events include a timestamp (ms since epoch).
type TimestampedRuntimeEvent = RuntimeEvent & { timestamp: number };

export type RunSnapshot = {
  runId?: string;
  status: RuntimeStatus;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeStatus: Record<string, "pending" | "running" | "done" | "failed">;
  edgeStatus: Record<string, "pending" | "fired" | "skipped">;
  loopCounters: Record<string, number>;
  inbox: RuntimeCommand[];
  agentSessions: Record<string, string>;
};

export interface Runtime {
  run(input?: Record<string, unknown>): Promise<RunSnapshot>;
  dispatch(command: RuntimeCommand): void;
  onEvent(listener: (e: RuntimeEvent) => void): () => void;
  getSnapshot(): RunSnapshot;
}
```

### 5.2 Execution Components (Internal)

```ts
class Compiler {
  compile(def: FlowDefinition): CompiledFlow;
}

type CompiledFlow = {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  adjacency: Map<string, string[]>;
  incoming: Map<string, EdgeDefinition[]>;
};

class Scheduler {
  nextReadyNodes(state: RunState, graph: CompiledFlow): string[];
}

class Executor {
  runNode(nodeId: string, ctx: NodeRunContext): Promise<void>;
}

class EventBus {
  emit(e: RuntimeEvent): void;
  subscribe(fn: (e: RuntimeEvent) => void): () => void;
}
```

---

## 6. Node Registry

```ts
export interface NodeTypeDefinition<TIn, TOut> {
  type: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  capabilities?: { streaming?: boolean; multiTurn?: boolean };
  run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}

export interface NodeRegistry {
  register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void;
  get(type: string): NodeTypeDefinition<unknown, unknown>;
  has(type: string): boolean;
}
```

Node execution context:

```ts
export interface NodeRunContext {
  runId: string;
  emit: (e: RuntimeEvent) => void;
  state: StateStore;
  inbox: CommandInbox;
}
```

---

## 7. State and Commands

```ts
export type StatePatch =
  | { op: "set"; path: string; value: unknown }
  | { op: "merge"; path: string; value: Record<string, unknown> };

export interface StateStore {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  patch(p: StatePatch): void;
  snapshot(): Record<string, unknown>;
}

export interface CommandInbox {
  next(): RuntimeCommand | undefined;
  enqueue(cmd: RuntimeCommand): void;
}
```

State is declared in FlowDefinition and mutated at runtime. The runtime emits state:patch
events and supports snapshot reads for UI bootstrap.

---

## 8. Persistence (Optional)

Persistence is opt-in. It enables pause/resume by saving full runtime state and event log.

```ts
export interface RunStore {
  appendEvent(runId: string, event: RuntimeEvent): void;
  saveSnapshot(runId: string, snapshot: RunSnapshot): void;
  loadSnapshot(runId: string): RunSnapshot | null;
  loadEvents(runId: string, afterSeq?: number): RuntimeEvent[];
}
```

SQLite-backed implementation should include:
- events table (append-only)
- snapshots table (periodic)

Resume is implemented by loading snapshot, replaying events, then continuing execution.

---

## 9. Transport Adapters

Transports are adapters around Runtime. They do not live in core.

```ts
export interface Transport {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class WebSocketTransport implements Transport {
  constructor(runtime: Runtime, opts: { port: number; path: string });
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

---

## 10. File Structure

```
packages/kernel-v3/
  src/
    core/
      types.ts
      events.ts
      state.ts
    runtime/
      runtime.ts
      compiler.ts
      scheduler.ts
      executor.ts
      bindings.ts
      when.ts
      snapshot.ts
    registry/
      registry.ts
    persistence/
      run-store.ts
      sqlite-run-store.ts
    transport/
      websocket.ts
    index.ts
```

---

## 11. Testing Strategy

Unit Tests
- binding resolution
- when evaluation
- edge gating (any/all)
- loop counter enforcement
- state store mutations

Integration Tests
- run a small graph with branching, loops, and retries
- forEach edge spawns multiple runs
- state patches reflect runtime updates

Contract Tests
- event stream matches expected shape
- command ingestion and effects

Persistence Tests
- snapshot and resume restore node status, edge status, loop counters, inbox

UI Tests (optional)
- ReactFlow receives event stream and renders nodes/edges correctly

---

## 12. V3 Build Checklist

- Parse and compile graph definitions
- Execute nodes with when + policy
- Edge gating (any/all)
- Loop edges with maxIterations
- forEach edge fan-out (replaces container nodes)
- State store + state:patch events
- Command ingestion (send/reply/abort/resume)
- Optional persistence + resume

---

## 13. Open Decisions

- Default gate: "any" or "all"
- Parallel execution or sequential only for V3.0
- Event naming stability vs V2 compatibility
```
