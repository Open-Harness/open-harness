# Runtime

Execution pipeline for V3 flows. This folder owns compilation, scheduling,
execution, bindings, and run snapshots.

## What's here
- Flow compiler and graph utilities.
- Scheduler to decide which nodes run next.
- Executor to run nodes and record outputs.
- Binding and "when" evaluation helpers.
- Runtime implementation and in-memory event/state/inbox helpers.
- Snapshot types for persistence and resume.

## Structure
- compiler.ts: FlowDefinition validation + compile step.
- scheduler.ts: ready-node selection.
- executor.ts: node execution contract.
- bindings.ts: {{ }} resolution helpers.
- when.ts: conditional evaluation.
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

## Extending
- Swap in custom compiler/scheduler/executor implementations if you need
  different graph semantics or execution policies.
- Extend bindings/when evaluation to support new expression forms.
- Add new runtime events/commands in core and emit them here.
