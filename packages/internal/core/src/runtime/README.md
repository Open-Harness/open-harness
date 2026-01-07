---
title: "Runtime Execution Pipeline"
lastUpdated: "2026-01-07T00:00:00Z"
lastCommit: "placeholder"
lastCommitDate: "2026-01-07T00:00:00Z"
scope:
  - execution
  - compilation
  - scheduling
  - state-management
---

# Runtime

Execution pipeline for V3 flows. This folder owns compilation, scheduling,
execution, bindings, and run snapshots.

## What's here
- Flow compiler and graph utilities.
- Scheduler to decide which nodes run next.
- Executor to run nodes and record outputs.
- JSONata expression evaluation for bindings and conditions.
- Runtime implementation and in-memory event/state/inbox helpers.
- Snapshot types for persistence and resume.

## Structure
- compiler.ts: FlowDefinition validation + compile step.
- scheduler.ts: ready-node selection.
- executor.ts: node execution contract.
- expressions.ts: JSONata expression evaluator (core engine).
- bindings.ts: {{ }} resolution using JSONata.
- when.ts: conditional evaluation (JSONata strings or structured AST).
- snapshot.ts: RunSnapshot/RunState types.
- runtime.ts: Runtime API + in-memory implementations.

## Usage
Create a runtime with a flow and node registry, subscribe to events, and run.

```ts
import { createRuntime } from "../runtime/runtime.js";

const runtime = createRuntime({ flow, registry });
const unsubscribe = runtime.onEvent((event) => {
  // Observe flow/node events here.
  console.log(event.type);
});

await runtime.run();
unsubscribe();
```

## Resume
If you persist snapshots via a RunStore, you can resume with a run id:

```ts
const resumed = createRuntime({
  flow,
  registry,
  store,
  resume: { runId },
});
await resumed.run();
```

## JSONata Expressions

Bindings use JSONata for full expression support. Templates use `{{ expr }}` syntax.

### Path Resolution
```yaml
input:
  name: "{{ task.title }}"           # Simple path
  author: "{{ task.metadata.author }}" # Nested path
  first: "{{ tasks[0] }}"            # Array access
```

### Operators & Functions
```yaml
input:
  passed: "{{ score > 80 }}"                      # Comparison
  ready: "{{ $exists(reviewer) and reviewer.passed }}"  # Logical
  default: '{{ $exists(feedback) ? feedback : "None" }}'  # Ternary
```

### Iteration Context (forEach)
In forEach loops, these variables are available:
- `$iteration`: Current index (0-based)
- `$first`: True on first iteration
- `$last`: True on last iteration
- `$maxIterations`: Total count

```yaml
edges:
  - from: generator
    to: processor
    forEach:
      in: "{{ items }}"
      as: item
# Inside processor, use: $first, $iteration, etc.
```

### When Conditions
Two formats supported:

**JSONata string (preferred):**
```yaml
when: "status = 'done'"
when: "$exists(reviewer) and reviewer.passed = true"
when: "$iteration < 5"
```

**Structured AST:**
```yaml
when:
  equals:
    var: status
    value: done
```

## Extending
- Swap in custom compiler/scheduler/executor implementations if you need
  different graph semantics or execution policies.
- Add new runtime events/commands in core and emit them here.
