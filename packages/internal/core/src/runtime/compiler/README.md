---
title: "Flow Compilation and Scheduling"
lastUpdated: "2026-01-07T10:33:43.219Z"
lastCommit: "7dd3f50eceaf866d8379e1c40b63b5321da7313f"
lastCommitDate: "2026-01-07T10:32:30Z"
scope:
  - compiler
  - scheduling
  - flow-compilation
  - dag-construction
  - error-handling
---

# Flow Compilation and Scheduling

Converts flow YAML definitions into an internal graph representation and determines node execution order based on dependencies.

## What's here

- **`compiler.ts`** — Converts FlowDefinition into CompiledFlow (DAG with adjacency lists)
- **`scheduler.ts`** — Determines which nodes are ready to execute given current state
- **`errors.ts`** — Error types and Result-based API for error handling

## Architecture

```
FlowDefinition (YAML)
        │
        ▼
    Parser
        │
        ▼
    Validator (Zod Schema)
        │
        ▼
GraphCompiler.compile()
        │
        ▼
CompiledFlow (DAG)
    - nodes: []
    - edges: []
    - adjacency: Map<from -> [to1, to2, ...]>
    - incoming: Map<to -> [edge1, edge2, ...]>
    - gateByNode: Map<nodeId -> AND|OR>
        │
        ▼
DefaultScheduler.nextReadyNodes()
        │
        ▼
Ready Node IDs for execution
```

## Usage

### Parse and Compile a Flow

```typescript
import { GraphCompiler } from './compiler.js';

const compiler = new GraphCompiler();

// From YAML string
const flow = parseFlowYaml(`
nodes:
  - id: start
    type: input
  - id: process
    type: claude
  - id: end
    type: output

edges:
  - from: start
    to: process
  - from: process
    to: end
`);

const compiled = compiler.compile(flow);
// compiled.nodes, compiled.adjacency, etc.
```

### Use Result-Based Error Handling

```typescript
const result = compiler.compileResult(flow);

result.match(
  (compiled) => {
    console.log('Compilation succeeded');
    console.log('Nodes:', compiled.nodes.map(n => n.id));
  },
  (err) => {
    if (err.code === 'INVALID_FLOW_DEFINITION') {
      console.error('Invalid flow:', err.message);
      console.error('Details:', err.details);
    } else if (err.code === 'CYCLE_DETECTED') {
      console.error('Flow has circular dependency');
    } else {
      console.error('Compilation error:', err.message);
    }
  }
);
```

### Determine Ready Nodes

```typescript
import { DefaultScheduler } from './scheduler.js';

const scheduler = new DefaultScheduler();

// Given current flow state
const readyNodes = scheduler.nextReadyNodes(runSnapshot, compiledFlow);
console.log('Nodes ready to execute:', readyNodes);

// Or with error handling
const result = scheduler.nextReadyNodesResult(runSnapshot, compiledFlow);
result.match(
  (ready) => {
    console.log('Ready nodes:', ready);
  },
  (err) => {
    console.error('Scheduling error:', err.message);
  }
);
```

## Flow Definition Structure

### Nodes

```yaml
nodes:
  - id: node-1              # Unique identifier
    type: claude            # Node type from registry
    policy:                 # Optional execution policy
      retry:
        maxAttempts: 3
        backoffMs: 1000
      timeoutMs: 30000      # 30 second timeout
```

### Edges

```yaml
edges:
  - from: node-a            # Source node
    to: node-b              # Target node
    gate: AND               # Optional: AND (default) or OR
    maxIterations: 5        # Optional: loop edge (forEach)
    when: condition         # Optional: conditional execution
    forEach:
      in: "{{ items }}"     # Binding for loop source
      as: item              # Variable name
```

### Gate Logic

- **AND (default)** — Target node waits for ALL incoming edges to complete
- **OR** — Target node waits for ANY ONE incoming edge to complete

Example:

```yaml
nodes:
  - id: reviewer1
  - id: reviewer2
  - id: merge_result

edges:
  - from: reviewer1
    to: merge_result
    gate: OR              # Either reviewer completes triggers merge
  - from: reviewer2
    to: merge_result
    gate: OR
```

## Node Readiness Rules

A node is ready when:

1. **Not yet executed** — status is not "done", "failed", or "running"
2. **All incoming edges satisfied**:
   - For **non-loop edges**: all predecessor nodes must be done
   - For **loop edges**: skipped (managed by forEach)
3. **Gate condition met**:
   - **AND gate**: ALL incoming edges must have status "done"
   - **OR gate**: AT LEAST ONE incoming edge must have status "done"

## Error Codes

**Result-based API** (`CompilationError`):

| Code | Meaning | Recovery |
|------|---------|----------|
| `INVALID_FLOW_DEFINITION` | Flow structure invalid | Check YAML schema |
| `INVALID_NODE_DEFINITION` | Node has missing/invalid fields | Verify node config |
| `INVALID_EDGE_DEFINITION` | Edge is malformed | Check edge structure |
| `CYCLE_DETECTED` | Flow has circular dependency | Refactor flow |
| `SCHEDULING_ERROR` | Scheduler failed | Report bug |
| `SCHEMA_VALIDATION_ERROR` | Type validation failed | Fix field types |
| `MISSING_REQUIRED_FIELD` | Required field is missing | Add field |

## Validation

All flow definitions are validated against Zod schema:

```typescript
import { FlowDefinitionSchema } from './compiler.js';

const result = FlowDefinitionSchema.safeParse(input);
if (!result.success) {
  console.error('Invalid flow:', result.error);
}
```

## Performance Notes

1. **Compilation** — O(N+E) where N = nodes, E = edges
2. **Scheduling** — O(N) per call; run on each node completion
3. **DAG** — Represented as:
   - `adjacency` — Map for forward traversal (efficient for scheduling)
   - `incoming` — Map for backward traversal (efficient for validation)
4. **Caching** — Compiled flows reused across runs; no re-compilation needed

## Example: Multi-Stage Workflow

```yaml
nodes:
  - id: input
    type: input
  - id: coder
    type: claude
  - id: reviewer
    type: claude
  - id: merge
    type: merge
  - id: output
    type: output

edges:
  - from: input
    to: coder
  - from: coder
    to: reviewer
  - from: reviewer
    to: merge
  - from: merge
    to: output
```

**Execution flow:**
1. `input` ready → execute
2. After `input` done → `coder` ready → execute
3. After `coder` done → `reviewer` ready → execute
4. After `reviewer` done → `merge` ready → execute
5. After `merge` done → `output` ready → execute

## Example: Parallel Branches with OR Gate

```yaml
nodes:
  - id: start
  - id: fast_path
  - id: slow_path
  - id: continue

edges:
  - from: start
    to: fast_path
  - from: start
    to: slow_path
  - from: fast_path
    to: continue
    gate: OR
  - from: slow_path
    to: continue
    gate: OR
```

**Execution flow:**
1. `start` ready → execute
2. After `start` done → both `fast_path` and `slow_path` ready → execute in parallel
3. Whichever finishes first triggers `continue` (OR gate means "any one")

## Testing

See `tests/unit/compiler.test.ts` for:
- Flow parsing and validation
- Compilation (DAG construction)
- Cycle detection
- Node readiness logic
- Gate logic (AND/OR)
- Error handling
- Scheduler tests

Run:

```bash
bun run test tests/unit/compiler.test.ts
```

## See Also

- `../execution/README.md` — Node execution engine
- `../expressions/README.md` — Binding resolution
- `errors.ts` — Error types and Result helpers
