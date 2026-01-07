---
title: "Runtime System Hub"
lastUpdated: "2026-01-07T00:00:00Z"
lastCommit: "placeholder"
lastCommitDate: "2026-01-07T00:00:00Z"
scope:
  - runtime
  - flow-execution
  - architecture
  - subsystems
---

# Runtime System Hub

Complete orchestration of flow execution from YAML definition through final output.

## The 4 Subsystems

The runtime is organized into four logical subsystems that work together:

```
User Input (YAML Flow Definition)
        │
        ▼
    Compiler
    ├─ Parse YAML
    ├─ Validate schema
    ├─ Build DAG (nodes + edges)
    ├─ Detect cycles
    └─ Output: CompiledFlow
        │
        ▼
    Scheduler
    ├─ Determine ready nodes
    ├─ Apply gate logic (AND/OR)
    ├─ Respect edge completion
    └─ Output: Ready node IDs
        │
        ▼
    Execution
    ├─ Run ready nodes in parallel
    ├─ Resolve input bindings
    ├─ Enforce timeouts + retries
    ├─ Handle cancellation
    └─ Output: Node results
        │
        ▼
    State
    ├─ Track node/edge status
    ├─ Store outputs + errors
    ├─ Create snapshots
    └─ Persist for recovery
        │
        ▼
    Event Bus
    ├─ Emit flow:started
    ├─ Emit node:completed/failed
    ├─ Emit snapshot:created
    └─ User receives events
```

## Subsystem Breakdown

### 1. Compiler (`compiler/`)

**Purpose:** Convert user YAML into executable DAG

**Key Files:**
- `compiler.ts` — GraphCompiler class + flow parsing
- `scheduler.ts` — DefaultScheduler determines ready nodes
- `errors.ts` — Compilation error types + Result API
- `README.md` — Full documentation

**Inputs:**
- FlowDefinition (YAML-based)

**Outputs:**
- CompiledFlow (nodes, edges, adjacency maps)
- Or CompilationError (invalid definition)

**Example:**
```typescript
const compiler = new GraphCompiler();
const compiled = compiler.compile(flowDef);
```

**Error Handling:**
- `INVALID_FLOW_DEFINITION` — Schema validation failed
- `CYCLE_DETECTED` — Circular dependency
- `INVALID_NODE_DEFINITION` — Missing/bad node fields
- `GATE_CONFLICT` — Conflicting AND/OR settings

---

### 2. Execution (`execution/`)

**Purpose:** Run individual nodes with retry/timeout/cancellation

**Key Files:**
- `executor.ts` — DefaultExecutor runs nodes
- `runtime.ts` — HarnessRuntime orchestrates full flow
- `errors.ts` — Execution error types + Result API
- `README.md` — Full documentation

**Inputs:**
- ExecutorContext (node, registry, input, runContext)

**Outputs:**
- NodeExecutionResult (output or error)
- Or ExecutionError (timeout, failed, cancelled)

**Example:**
```typescript
const executor = new DefaultExecutor();
const result = await executor.runNode(context);
if (result.error) {
  console.error('Node failed:', result.error);
} else {
  console.log('Output:', result.output);
}
```

**Error Handling:**
- `EXECUTION_TIMEOUT` — Node exceeded timeoutMs
- `EXECUTION_FAILED` — Node threw exception
- `CANCELLED` — Flow was cancelled
- `NODE_NOT_FOUND` — Type not in registry

**Features:**
- Automatic retries with exponential backoff
- Timeout enforcement
- Cancellation interrupts execution
- Input/output schema validation

---

### 3. Expressions (`expressions/`)

**Purpose:** Evaluate JSONata expressions for bindings and conditions

**Key Files:**
- `expressions.ts` — JSONata evaluator + template parsing
- `bindings.ts` — Binding resolution
- `when.ts` — Conditional execution
- `errors.ts` — Expression error types + Result API
- `README.md` — Full documentation

**Inputs:**
- JSONata expression string
- ExpressionContext (variables, data)

**Outputs:**
- Evaluated result (any type)
- Or ExpressionError (parse, evaluation, validation)

**Example:**
```typescript
const context = { task: { title: "Hello" }, $iteration: 2 };
const result = await evaluateExpression("task.title", context);
// result: "Hello"

const template = await resolveTemplate("Task: {{ task.title }}", context);
// template: "Task: Hello"
```

**Supported Syntax:**
- Paths: `task.title`, `items[0]`, `items[-1]`
- Operators: `=`, `!=`, `>`, `<`, `and`, `or`
- Functions: `$exists()`, `$not()`, `$count()`, etc.
- Ternary: `condition ? true : false`
- String concat: `'prefix' & value`

---

### 4. State (`state/`)

**Purpose:** Manage execution state, snapshots, and persistence

**Key Files:**
- `types.ts` — FlowDefinition, NodeDefinition, RunState
- `state.ts` — State machine contract
- `events.ts` — Event type definitions
- `cancel.ts` — Cancellation context
- `snapshot.ts` — RunSnapshot type
- `README.md` — Full documentation

**Inputs:**
- RunState updates (node status, outputs, errors)

**Outputs:**
- RunSnapshot (serializable state)
- Events (flow:started, node:completed, etc.)

**Example:**
```typescript
// Track execution
state.nodeStatus[nodeId] = "done";
state.nodeOutput[nodeId] = { result: 42 };

// Create checkpoint
const snapshot = state.toSnapshot();
await stateStore.saveSnapshot(snapshot);

// Resume from checkpoint
const resumed = await stateStore.loadSnapshot(runId);
```

**State Contracts:**
- `StateStore` — Persistence interface (in-memory, DB, etc.)
- `RunSnapshot` — Immutable point-in-time capture
- `RunState` — Mutable execution state

---

## How They Work Together

### Full Execution Flow

```
1. User provides FlowDefinition (YAML)
   │
   ├─> Compiler.compile() validates + builds DAG
   │   Output: CompiledFlow
   │
2. Runtime creates initial RunState
   │
3. Loop until flow complete:
   ├─> Scheduler.nextReadyNodes(state, compiled)
   │   Determines which nodes can execute
   │   Respects gate logic, edge completion, cancellation
   │   Output: Ready node IDs
   │
   ├─> For each ready node (in parallel):
   │   ├─> Expressions.resolveTemplate(input, context)
   │   │   Evaluates {{ bindings }} to real values
   │   │
   │   ├─> Executor.runNode(node, input, context)
   │   │   - Checks cancellation
   │   │   - Enforces timeouts
   │   │   - Retries on failure
   │   │   - Validates schemas
   │   │   Output: NodeExecutionResult
   │   │
   │   ├─> Update State:
   │   │   - nodeStatus[id] = "done" / "failed"
   │   │   - nodeOutput[id] = result
   │   │   - edgeStatus[key] = "done"
   │   │
   │   └─> Emit event: node:completed / node:failed
   │
   ├─> Create snapshot of current state
   │   └─> Emit event: snapshot:created
   │
   └─> Check for flow completion or cancellation
       If cancelled: emit flow:cancelled
       If all nodes done: emit flow:completed
```

### Information Flow

```
FlowDefinition
    ↓
Compiler → CompiledFlow (DAG structure)
    ↓
Scheduler → Ready nodes (based on state)
    ↓
Expressions → Resolved input (from {{ bindings }})
    ↓
Execution → Node outputs
    ↓
State → Status updates + snapshots
    ↓
Events → User events
```

### Error Handling at Each Stage

```
Stage         Error Type              Handling
────────────────────────────────────────────────
Compiler      CompilationError       ✗ Stop (invalid flow)
              INVALID_FLOW_DEFINITION
              CYCLE_DETECTED

Execution     ExecutionError         ↻ Retry or ✗ Stop
              EXECUTION_TIMEOUT
              EXECUTION_FAILED
              CANCELLED

Expressions   ExpressionError        ✗ Stop or ↻ Use default
              EVALUATION_ERROR
              UNDEFINED_BINDING

State         (No errors)             ✓ Always succeeds
```

---

## Result-Based Error Handling

All 4 subsystems support neverthrow Result types for structured error handling:

```typescript
// Compiler
const result1 = compiler.compileResult(definition);
result1.match(
  (compiled) => { /* use compiled flow */ },
  (err) => { /* handle CompilationError */ }
);

// Execution
const result2 = await executor.runNodeResult(context);
result2.match(
  (execution) => { /* use output */ },
  (err) => { /* handle ExecutionError */ }
);

// Expressions
const result3 = await evaluateExpressionResult(expr, ctx);
result3.match(
  (value) => { /* use value */ },
  (err) => { /* handle ExpressionError */ }
);

// Scheduler
const result4 = scheduler.nextReadyNodesResult(state, compiled);
result4.match(
  (ready) => { /* continue with ready nodes */ },
  (err) => { /* handle CompilationError */ }
);
```

---

## Testing the Full Flow

```typescript
import { createHarness } from '@open-harness/sdk/server';

const harness = createHarness({
  registry,
  persistenceBackend,
  eventHandler: (event) => {
    if (event.type === 'flow:completed') {
      console.log('Flow succeeded:', event);
    } else if (event.type === 'node:failed') {
      console.log('Node failed:', event);
    }
  },
});

const run = await harness.runFlow(flowDef, { input: { /* ... */ } });
console.log('Final status:', run.status);
```

---

## Documentation Structure

Each subsystem has:
- **README.md** — Architecture, usage examples, error codes
- **errors.ts** — Error type definitions + Result helpers
- **types** — Interface contracts
- **tests/** — Comprehensive test coverage

### Quick Reference

| Subsystem | Key Class | Main Method | Error Type |
|-----------|-----------|------------|-----------|
| Compiler | `GraphCompiler` | `compile()` | `CompilationError` |
| Scheduler | `DefaultScheduler` | `nextReadyNodes()` | `CompilationError` |
| Execution | `DefaultExecutor` | `runNode()` | `ExecutionError` |
| Expressions | (Functions) | `evaluateExpression()` | `ExpressionError` |
| Runtime | `HarnessRuntime` | `runFlow()` | Mixed errors |
| State | (Types only) | (Interface) | (No errors) |

---

## Performance Characteristics

```
Compilation     O(N+E)          One-time per flow
Scheduling      O(N)            Per node completion
Execution       O(nodeRuntimes) Parallel by policy
Expressions     O(1)            Cached (after first use)
State           O(1)            Hash-based lookups
```

---

## See Also

- `compiler/README.md` — Flow compilation and DAG construction
- `execution/README.md` — Node execution engine with retries/timeouts
- `expressions/README.md` — JSONata binding resolution
- `state/README.md` — State management and persistence
- `../../nodes/README.md` — Built-in node types
- `../../persistence/README.md` — Persistence backends
