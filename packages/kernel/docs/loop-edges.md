# Loop Edges: Controlled Cycles in DAG Workflows

This document explains how loop edges work, when to use them, and how they're implemented.

---

## 1. The Problem

**DAGs can't have cycles.** That's by definition.

But many real workflows need cycles:
- Coder → Reviewer → (reject) → Coder → Reviewer → (approve) → Done
- Generate → Validate → (invalid) → Generate → Validate → (valid) → Done
- Agent → Human Approval → (deny) → Agent → ...

**The solution**: Partition edges into two types:
1. **Forward edges** - Used for topological sort (must be acyclic)
2. **Loop edges** - Evaluated at runtime (can create cycles)

---

## 2. How It Works

### Edge Types

```yaml
edges:
  # Forward edge (default) - part of DAG
  - from: coder
    to: reviewer

  # Loop edge - evaluated at runtime, creates controlled cycle
  - from: reviewer
    to: coder
    type: loop
    maxIterations: 3
    when:
      not:
        equals:
          var: reviewer.structuredOutput.passed
          value: true
```

### Compilation

The compiler partitions edges:

```typescript
const forwardEdges = edges.filter(e => e.type !== "loop");
const loopEdges = edges.filter(e => e.type === "loop");

// Only forwardEdges are used for topological sort
const order = topologicalSort(nodes, forwardEdges);
```

This means:
- Forward edges define the execution order
- Loop edges can point "backwards" in the order
- The DAG constraint applies only to forward edges

### Execution

After each node completes, the executor checks loop edges:

```
1. Execute node in topological order
2. After node completes, check outgoing loop edges
3. For each loop edge where `when` evaluates to true:
   a. Increment iteration counter
   b. If counter >= maxIterations, throw LoopIterationExceededError
   c. Emit loop:iterate event
   d. Jump back to target node in execution order
4. Continue execution
```

---

## 3. Required Properties

### maxIterations (Required for loop edges)

Every loop edge MUST specify `maxIterations` to prevent infinite loops:

```yaml
- from: reviewer
  to: coder
  type: loop
  maxIterations: 5  # Required!
```

The validator enforces this at parse time - you'll get an error if missing.

### when (Conditional)

Loop edges typically need a condition:

```yaml
when:
  not:
    equals:
      var: reviewer.structuredOutput.passed
      value: true
```

Without a condition, the loop would trigger on every execution (up to maxIterations).

---

## 4. Events

Loop execution emits events for observability:

```typescript
// When a loop iteration triggers
{
  type: "loop:iterate",
  edgeFrom: "reviewer",
  edgeTo: "coder",
  iteration: 2,        // Current iteration (1-indexed)
  maxIterations: 5     // Maximum allowed
}
```

Subscribe to these events to track loop progress:

```typescript
hub.subscribe("loop:iterate", (event) => {
  console.log(`Loop ${event.edgeFrom} → ${event.edgeTo}: iteration ${event.iteration}/${event.maxIterations}`);
});
```

---

## 5. Error Handling

### LoopIterationExceededError

When maxIterations is reached:

```typescript
class LoopIterationExceededError extends Error {
  edgeFrom: string;
  edgeTo: string;
  maxIterations: number;
}
```

Catch this to handle loop exhaustion:

```typescript
try {
  await executeFlow(flow, registry, hub, input);
} catch (error) {
  if (error instanceof LoopIterationExceededError) {
    console.log(`Loop ${error.edgeFrom} → ${error.edgeTo} exceeded ${error.maxIterations} iterations`);
    // Handle gracefully - maybe save partial results
  }
}
```

---

## 6. Example: Coder-Reviewer Loop

A complete example of an iterative refinement workflow:

```yaml
flow:
  name: coder-reviewer-loop
  input:
    task: string

nodes:
  - id: coder
    type: claude.agent
    input:
      prompt: |
        Implement: {{ flow.input.task }}

        {% if reviewer.text %}
        Previous feedback: {{ reviewer.text }}
        Please address these issues.
        {% endif %}

  - id: reviewer
    type: claude.agent
    input:
      prompt: |
        Review this implementation:
        {{ coder.text }}

        Return JSON: { "passed": boolean, "feedback": string }

edges:
  # Forward: coder runs first, then reviewer
  - from: coder
    to: reviewer

  # Loop: reviewer sends back to coder on rejection
  - from: reviewer
    to: coder
    type: loop
    maxIterations: 3
    when:
      not:
        equals:
          var: reviewer.structuredOutput.passed
          value: true
```

### Execution Flow

```
1. coder executes → produces implementation
2. reviewer executes → produces { passed: false, feedback: "..." }
3. Loop edge evaluates: passed !== true → triggers
4. coder executes again (now with reviewer.text available)
5. reviewer executes again → produces { passed: true }
6. Loop edge evaluates: passed === true → does not trigger
7. Flow completes
```

---

## 7. Design Decisions

### Why not allow cycles in forward edges?

**Topological sort requires acyclic graphs.** We use topological sort to determine execution order. If forward edges had cycles, we couldn't determine order.

### Why require maxIterations?

**Safety.** Infinite loops are a common bug. Requiring an explicit limit forces developers to think about failure modes and provides a guaranteed termination.

### Why evaluate conditions at runtime?

**Data-dependent branching.** The loop condition often depends on the output of the source node (e.g., `reviewer.structuredOutput.passed`). This data only exists at runtime.

---

## 8. Implementation Notes

### Files

- `src/protocol/flow.ts` - Edge type definition with `type` and `maxIterations`
- `src/flow/validator.ts` - Zod schema enforcing maxIterations on loop edges
- `src/flow/compiler.ts` - Edge partitioning into forwardEdges/loopEdges
- `src/flow/executor.ts` - Loop edge tracking and iteration logic

### Key Types

```typescript
// Edge type discriminator
export type EdgeType = "forward" | "loop";

// Extended Edge interface
export interface Edge {
  from: NodeId;
  to: NodeId;
  when?: WhenExpr;
  type?: EdgeType;        // default: "forward"
  maxIterations?: number; // required if type === "loop"
}

// Compiled flow includes partitioned edges
export interface CompiledFlow {
  nodes: NodeSpec[];
  order: NodeSpec[];
  edges: Edge[];
  forwardEdges: Edge[];
  loopEdges: Edge[];
}
```

### Iteration Tracking

```typescript
type LoopEdgeState = {
  edge: Edge;
  iterationCount: number;
};

// Indexed by source node for efficient lookup
const loopEdgeIndex = {
  outgoing: Map<string, LoopEdgeState[]>
};
```

---

*Document created: 2026-01-03*
*Status: Stable - validated through E2E testing*
