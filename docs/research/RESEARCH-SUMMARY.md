# Research Summary: Workflow DSL Patterns

**Date**: 2026-01-01
**Purpose**: Inform graph model + session design for V2 SDK migration

---

## Key Finding: Code-First Has Won

The industry trend is clear across Temporal, Prefect 2.x, Dagster, and Airflow's TaskFlow API:

**Code naturally expresses dynamic behavior, while YAML/JSON struggles with:**
- Loops and iteration
- Conditionals and branching
- State management
- Session handling

---

## How Tools Handle Loops

| Approach | Tools | Mechanism |
|----------|-------|-----------|
| **Native code loops** | Temporal, Prefect | Just write `for`/`while` in code |
| **Task unrolling** | Airflow `.expand()` | Create N tasks at runtime |
| **Meta-nodes** | n8n `SplitInBatches`, Windmill `forloopflow` | Special node types for iteration |

**Key insight**: Pure DAGs cannot represent loops. Tools either use meta-nodes or embrace code.

---

## How n8n Handles It

n8n is closest to our visual builder goal:

1. **Item-centric model**: Nodes process arrays of items (implicit iteration)
2. **SplitInBatches node**: Explicit loop with "loop" and "done" outputs
3. **Back-edge handling**: Loop node maintains state, tracks batch index
4. **JSON serialization**: `nodes[]` + `connections{}` structure

**Session/State**: `staticData` object persists across executions, scoped globally or per-node.

---

## React Flow Patterns

For n8n-style visual builders:

1. **Parent-child via `parentId`**: Loop containers use `parentId` + `extent: 'parent'`
2. **Multiple handles**: Condition nodes have multiple output handles (true/false)
3. **Serialization**: Strip runtime state (selected, dragging), keep position
4. **FlowSpec mapping**: `node.type` → namespaced types, `edge.data.condition` → `when`

---

## Recommendations for Our System

### 1. Keep YAML for Shareability
React Flow UI needs data to visualize. YAML/JSON is essential for:
- AI generation
- Storage/sharing
- Visual editing

### 2. Add Loop Node Type
```yaml
nodes:
  - id: process-tasks
    type: control.foreach
    input:
      items: "{{ taskCreator.tasks }}"
      as: "task"
    # Loop body defined by child nodes with parentId
```

### 3. Session Scoping via Flow
Session lifecycle owned by flow, not nodes:
- Fresh session at loop boundary (per-task)
- SessionId passed through node input/output
- Nodes are stateless; flow manages threading

### 4. Hybrid Approach
```
┌─────────────────────────────────────────────┐
│  React Flow UI (Visual Editing)             │
│  ↓                                          │
│  FlowSpec YAML (Storage/Sharing)            │
│  ↓                                          │
│  Executor (Code-level control)              │
│  ↓                                          │
│  V2 SDK Sessions (Runtime)                  │
└─────────────────────────────────────────────┘
```

---

## Session Threading Model

Based on research and discussion:

```
Flow
└── Phase
    └── Task (flow-level work unit)
        └── Session scope (fresh per task)
            ├── Node invocation (Turn 1)
            ├── Node invocation (Turn 2)  ← Same sessionId
            └── Node invocation (Turn 3)
        └── Session ends
    └── Next Task
        └── New session scope (fresh sessionId)
```

**Key primitives**:
- `sessionId` flows through node input/output
- `AbortController` for interruption
- Turn events for observability: `turn:start`, `turn:complete`, `turn:aborted`

---

## Files Generated

Full research documents attempted:
- `n8n-workflow-model.md` - n8n's JSON schema, loops, state
- `react-flow-patterns.md` - React Flow data model, nesting, serialization
- `workflow-dsl-patterns.md` - Temporal, Prefect, Dagster, Airflow comparison

*Note: Agent file writes failed due to permissions. Re-run agents or manually recreate from agent outputs.*

---

## Next Steps

1. Decide: Add `control.foreach` node type vs. code-level loops only
2. Decide: Session scope at task boundary vs. explicit session nodes
3. Update FlowSpec YAML schema for loop constructs
4. Implement sessionId threading in node input/output
5. Build React Flow ↔ FlowSpec converter
