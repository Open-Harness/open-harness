# Flow Execution Protocol

This document describes how a FlowSpec runs on the kernel.

## Execution model

**Key invariant**: Flow is not a new runtime. It is a library layer that uses the kernel's `phase/task` helpers and `AgentDefinition` contract.

### High-level flow

1. Parse and validate the FlowSpec YAML
2. Compile the DAG (topological sort, validate edges)
3. Run inside a harness:
   - Use `phase("Run Flow", ...)` to wrap the entire flow
   - For each node (in topological order):
     - Evaluate `when` (if present)
     - If skipped, record skip marker and continue
     - Use `task("node:<id>", ...)` to wrap the node execution
     - Resolve bindings in `node.input`
     - Look up `NodeType` from registry
     - Execute the node (may call `AgentDefinition.execute(...)`)
     - Store the output

## Scheduling

### Sequential (MVP)

Nodes are executed **sequentially** in topological order:

- A node is eligible to run when all upstream dependencies have completed (success or failure)
- The engine waits for each node to complete before starting the next

### Parallel (later)

Independent nodes (no dependencies between them) can run in parallel.

## Skip rules

If `when` evaluates to `false`:
- The node is **skipped** (not executed)
- The engine records a skip marker in outputs
- Downstream nodes can still run if they don't depend on that output

## Failure rules

### Workflow-level (`flow.policy.failFast`)

- `failFast: true` (default): first node failure fails the flow run
- `failFast: false`: flow continues executing other runnable nodes unless a node's own policy says otherwise

### Node-level (`node.policy.continueOnError`)

- `continueOnError: false` (default): node failure is a flow failure when `failFast: true`
- `continueOnError: true`: the engine records an error marker for that node output and continues

## Retry

### NodePolicy.retry

```yaml
policy:
  retry:
    maxAttempts: number    # >= 1 (total attempts including the first)
    backoffMs: number?     # default: 0 (constant backoff)
```

Semantics:
- `maxAttempts` is the total number of attempts (including the first)
- `backoffMs` is the delay between attempts (constant backoff in MVP)
- Retries only apply to node execution failures (not skip conditions)

## Timeout

### NodePolicy.timeoutMs

```yaml
policy:
  timeoutMs: number
```

Semantics:
- Node run is aborted if it exceeds the timeout
- Aborted nodes are treated as failures

## Deterministic node completion

**Invariant**: "Task-like nodes" must end (even if underlying provider session is open).

- Nodes that call LLM providers should terminate after producing their output
- Long-lived interactive nodes (voice websocket sessions, etc.) are explicitly opt-in and are not part of MVP

## Event emission

The flow engine emits events via the hub:

- `phase:start` / `phase:complete` for the flow run
- `task:start` / `task:complete` / `task:failed` for each node
- `agent:*` events from nodes that use `AgentDefinition` (if the node type wraps an agent)

## Key invariants

1. **Flow runs inside a harness** - it uses `phase/task` helpers, not a separate runtime
2. **Nodes are deterministic** - they must complete (even if the underlying provider session stays open)
3. **Edges define dependencies** - the graph is never inferred from bindings or ordering
