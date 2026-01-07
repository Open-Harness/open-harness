---
title: "Node Execution Engine"
lastUpdated: "2026-01-07T16:37:37.893Z"
lastCommit: "72a1693673d110e1b19885762e3ceaafec16c6da"
lastCommitDate: "2026-01-07T16:12:52Z"
scope:
  - execution
  - node-execution
  - runtime-engine
  - error-handling
  - retries
  - timeouts
---

# Node Execution Engine

Handles the execution of individual nodes within flows, including input/output schema validation, retry logic, timeouts, and cancellation handling.

## What's here

- **`executor.ts`** — Node execution engine with retry and timeout support
- **`runtime.ts`** — Flow runtime orchestrating node execution across the DAG
- **`errors.ts`** — Error types and Result-based API for error handling

## Architecture

```
┌────────────────────────────────────────┐
│  HarnessRuntime (runtime.ts)           │
│  - Orchestrates flow execution         │
│  - Manages event bus                   │
│  - Coordinates scheduler + executor    │
└─────────────────┬──────────────────────┘
                  │
┌─────────────────▼──────────────────────┐
│  DefaultScheduler (compiler/scheduler) │
│  - Determines ready nodes              │
│  - Tracks completion                   │
└─────────────────┬──────────────────────┘
                  │
┌─────────────────▼──────────────────────┐
│  DefaultExecutor (executor.ts)         │
│  - Runs single node                    │
│  - Retries on failure                  │
│  - Enforces timeouts                   │
│  - Handles cancellation                │
└─────────────────┬──────────────────────┘
                  │
┌─────────────────▼──────────────────────┐
│  Node Implementation (from registry)   │
│  - run(context, input) -> output       │
│  - inputSchema, outputSchema           │
│  - policy (retry, timeout)             │
└────────────────────────────────────────┘
```

## Usage

### Execute a Single Node

```typescript
import { DefaultExecutor } from './executor.js';

const executor = new DefaultExecutor();
const result = await executor.runNode({
  registry,
  node: { id: 'claude', type: 'claude', policy: { retry: { maxAttempts: 3 } } },
  runContext,
  input: { prompt: 'Analyze this code' },
});

if (result.error) {
  console.error('Node failed:', result.error);
} else {
  console.log('Output:', result.output);
}
```

### Execute a Node with Result-Based Error Handling

```typescript
import { DefaultExecutor } from './executor.js';

const executor = new DefaultExecutor();
const result = await executor.runNodeResult({
  registry,
  node,
  runContext,
  input,
});

result.match(
  (execution) => {
    console.log('Node succeeded:', execution.output);
  },
  (err) => {
    if (err.code === 'EXECUTION_TIMEOUT') {
      console.error('Node timed out');
    } else if (err.code === 'CANCELLED') {
      console.error('Node was interrupted');
    } else if (err.code === 'NODE_NOT_FOUND') {
      console.error('Node type not registered');
    } else {
      console.error('Execution failed:', err.message);
    }
    console.log('Node ID:', err.nodeId, 'Run ID:', err.runId);
  }
);
```

### Run a Complete Flow

```typescript
import { createHarness } from '@open-harness/sdk/server';

const harness = createHarness({
  registry,
  persistenceBackend,
  eventHandler: (event) => {
    console.log('Event:', event);
  },
});

const run = await harness.runFlow(flowDefinition, {
  input: { /* flow input */ },
});

console.log('Run completed:', run.status);
```

## Node Execution Lifecycle

1. **Node Selection** — Scheduler determines which nodes are ready
2. **Input Resolution** — Bindings are evaluated to resolve node input
3. **Execution** — Node runs with timeout enforcement
4. **Schema Validation** — Input/output validated against schemas
5. **Retry Logic** — On failure, retry up to maxAttempts with backoff
6. **Cancellation** — Flow cancellation interrupts execution
7. **Result Emission** — Completion event emitted with output or error

## Retry and Timeout Configuration

Define retry and timeout policies on each node:

```yaml
nodes:
  - id: claude-analysis
    type: claude
    policy:
      # Retry configuration
      retry:
        maxAttempts: 3          # Total attempts
        backoffMs: 1000         # Delay between retries
      
      # Timeout enforcement
      timeoutMs: 30000          # Max execution time (30s)
```

**Retry logic:**
- First attempt runs immediately
- On failure, wait `backoffMs`, then retry
- Repeat up to `maxAttempts`
- If still failing after all attempts, return error

**Timeout behavior:**
- Execution wrapped in `Promise.race([nodeRun, timeoutPromise])`
- On timeout, `Error("Node execution timed out after Xms")` thrown
- Executor catches and returns error result

## Error Codes

**Result-based API** (`ExecutionError`):

| Code | Meaning | Recovery |
|------|---------|----------|
| `NODE_NOT_FOUND` | Node type not in registry | Register missing node type |
| `EXECUTION_TIMEOUT` | Node exceeded timeoutMs | Increase timeout or optimize node |
| `EXECUTION_FAILED` | Node threw exception | Check node implementation; retry |
| `SCHEMA_VALIDATION_ERROR` | Input/output validation failed | Correct input or schema |
| `CANCELLED` | Flow was interrupted (pause/stop) | Resume or restart flow |
| `INPUT_VALIDATION_ERROR` | Binding resolution failed | Check binding expressions |
| `OUTPUT_VALIDATION_ERROR` | Output schema validation failed | Check node output |

**Example error handling:**

```typescript
result.match(
  (output) => {
    console.log('Success');
  },
  (err) => {
    // err.code is ExecutionErrorCode
    // err.nodeId, err.runId for tracking
    // err.originalError for root cause
  }
);
```

## Pause/Stop Handling

Pause or stop a running flow:

```typescript
const runtime = createRuntime({ flow, registry });
const runPromise = runtime.run();
// ... flow is running ...
runtime.pause(); // Soft stop, resumable
await runPromise;

// Later
await runtime.resume("continue");

// Hard stop (not resumable)
runtime.stop();
```

**Behavior:**
- Runtime uses `AbortSignal` for interruptions
- `pause()` aborts running nodes and returns a paused snapshot
- `stop()` aborts running nodes and marks the run as aborted
- Nodes should listen to `ctx.signal` to handle interruptions

## Input/Output Binding

Nodes declare input and output schemas:

```typescript
const myNode: NodeDefinition = {
  type: 'my-node',
  inputSchema: z.object({
    title: z.string(),
    count: z.number().optional(),
  }),
  outputSchema: z.object({
    result: z.string(),
    success: z.boolean(),
  }),
  async run(ctx, input) {
    // input is typed: { title: string; count?: number }
    const result = await doWork(input.title, input.count);
    return { result, success: true };
    // output is validated against outputSchema
  },
};
```

**Schema validation:**
- Input validated after binding resolution
- Output validated before emission
- Invalid data returns `*_VALIDATION_ERROR`

## Event Emission

The runtime emits events for every state change:

```typescript
const harness = createHarness({
  registry,
  eventHandler: (event) => {
    if (event.type === 'node:start') {
      console.log(`Node ${event.nodeId} started`);
    } else if (event.type === 'node:complete') {
      console.log(`Node ${event.nodeId} output:`, event.output);
    } else if (event.type === 'node:error') {
      console.log(`Node ${event.nodeId} error:`, event.error);
    }
  },
});
```

**Key events:**
- `flow:start` — Flow execution began
- `node:start` — Node execution began
- `node:complete` — Node succeeded, output available
- `node:error` — Node failed with error
- `flow:complete` — Flow finished (all nodes done)
- `flow:aborted` — Flow was stopped (hard abort)

## Performance Considerations

1. **Parallel Execution** — Nodes execute in parallel when DAG allows (scheduler determines readiness)
2. **Timeouts** — Use reasonable timeouts to prevent hung flows; defaults to no timeout
3. **Retry Backoff** — Exponential backoff reduces load during transient failures
4. **Schema Validation** — Zod validation adds overhead; only validate critical fields
5. **Caching** — Expression cache improves binding resolution performance

## Testing

See `tests/unit/executor.test.ts` and `tests/integration/runtime.test.ts` for:
- Retry logic validation
- Timeout enforcement
- Pause/stop handling
- Schema validation
- Event emission
- Multi-node DAG execution

Run:

```bash
bun run test tests/unit/executor.test.ts
bun run test tests/integration/runtime.test.ts
```

## See Also

- `../compiler/README.md` — Flow compilation and DAG construction
- `../expressions/README.md` — Binding resolution with JSONata
- `../state/` — State management and snapshots
- `errors.ts` — Error types and Result helpers
