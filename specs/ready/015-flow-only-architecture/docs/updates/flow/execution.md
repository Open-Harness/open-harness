# Flow Execution Protocol (Draft)

This document describes how a FlowSpec runs on the Flow runtime.

## Execution model

**Key invariant**: Flow is the runtime. It is the only runtime.

### High-level flow

1. Parse and validate the FlowSpec YAML
2. Compile the DAG (topological sort, validate edges)
3. Run inside FlowRuntime:
   - Use `phase("Run Flow", ...)` to wrap the entire flow
   - For each node (eligible by readiness rules):
     - Evaluate node `when`
     - Resolve edge `when` for upstream edges
     - Use `task("node:<id>", ...)` to wrap the node execution
     - Resolve bindings in `node.input`
     - Look up `NodeType` from registry
     - Execute the node (may call `AgentDefinition.execute(...)`)
     - Store output or error marker

## Scheduling

### Sequential (MVP)

Nodes are executed sequentially in topological order, gated by edge `when`.

**Note**: In sequential mode, `control.merge` with `mode: any` behaves like `mode: all`. The distinction only matters under parallel scheduling.

### Parallel (later)

Independent nodes (no dependencies between them) can run in parallel.

## Edge routing

- Edge `when` evaluated on source completion.
- A node runs when **all incoming edges are resolved** and **at least one fired**.
- `control.merge` can override readiness (`all` vs `any`).

## Skip rules

If a node’s `when` evaluates to `false`:
- The node is skipped
- The engine records a skip marker in outputs

If all incoming edges are skipped:
- The node is skipped

## Failure rules

### Flow-level (`flow.policy.failFast`)

- `failFast: true` (default): first node failure fails the flow run
- `failFast: false`: flow continues unless blocked by downstream dependencies

### Node-level (`node.policy.continueOnError`)

- `continueOnError: false` (default): node failure is a flow failure when `failFast: true`
- `continueOnError: true`: the engine records an error marker for that node output and continues

## Retry

### NodePolicy.retry

```yaml
policy:
  retry:
    maxAttempts: number
    backoffMs: number?
```

Semantics:
- `maxAttempts` is total attempts (including first)
- `backoffMs` is delay between attempts (constant in MVP)
- Retries apply to node execution failures only

## Timeout

### NodePolicy.timeoutMs

```yaml
policy:
  timeoutMs: number
```

Semantics:
- Node run is aborted if it exceeds the timeout
- Aborted nodes are treated as failures

## Event emission

The runtime emits:
- `harness:start` / `harness:complete`
- `phase:start` / `phase:complete` / `phase:failed`
- `task:start` / `task:complete` / `task:failed`
- `agent:*` events from agent-backed nodes

## Key invariants

1. Flow runtime owns lifecycle and inbox routing
2. Edge routing is explicit via `when`
3. Policies are enforced by runtime, not just schema
