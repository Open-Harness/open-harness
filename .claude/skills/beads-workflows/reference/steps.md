# Beads Steps: Comprehensive Technical Reference

This is the complete research report on Beads Steps (workflow patterns) with all evidence and sources.

---

# Beads Steps & Workflow Patterns Research Report

## Executive Summary

"Steps" in Beads is **conceptual terminology**, not a distinct entity type. Steps refer to issues within workflows that have dependency relationships (`needs`, `waits_for`) creating sequential or parallel execution patterns. This report documents how to structure multi-step workflows using Beads' dependency system.

---

## 1. What Are "Steps"?

**Key Finding**: Steps are not a formal Beads type. The term refers to **issues organized with dependencies** to create workflow patterns.

### Terminology Clarification

| Term | What It Is | How It's Created |
|------|------------|------------------|
| **Step** | Conceptual - an issue in a workflow | `bd create "Step name" -t task` |
| **Issue** | Base unit in Beads | `bd create` |
| **Epic** | Parent with child issues | `bd create -t epic --parent <parent-id>` |
| **Formula** | TOML template defining workflow structure | `.beads/formulas/name.formula.toml` |

**Source**: [Beads Documentation](https://github.com/steveyegge/beads/tree/main/docs)

---

## 2. Dependency Types for Workflow Patterns

### `needs` - Sequential Dependencies

**Purpose**: Task B cannot start until Task A completes

**Syntax**:
```bash
bd dep add <task-b> <task-a>  # Task B needs Task A
```

**Formula syntax**:
```toml
[[steps]]
id = "implement"
needs = ["design"]  # Sequential: design must finish first
```

**Use case**: Enforcing execution order

---

### `waits_for` - Fanout Gate Dependencies

**Purpose**: Aggregate task waits for multiple parallel tasks to complete

**Syntax**:
```bash
bd dep add <aggregate> <task-a> --type waits-for
bd dep add <aggregate> <task-b> --type waits-for
bd dep add <aggregate> <task-c> --type waits-for
```

**Formula syntax**:
```toml
[[steps]]
id = "aggregate"
waits_for = ["task-a", "task-b", "task-c"]  # Gate pattern
```

**Use case**: Parallel fanout with synchronization point

**Source**: [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 3. Common Workflow Patterns

### Pattern 1: Sequential Pipeline

**Structure**: Steps execute in strict order

**Implementation**:
```bash
bd create "Step 1: Design" -t task -p 2
bd create "Step 2: Implement" -t task -p 2
bd create "Step 3: Test" -t task -p 2
bd create "Step 4: Deploy" -t task -p 2

# Add sequential dependencies
bd dep add <step2> <step1>
bd dep add <step3> <step2>
bd dep add <step4> <step3>
```

**Formula equivalent**:
```toml
formula = "sequential-pipeline"

[[steps]]
id = "design"

[[steps]]
id = "implement"
needs = ["design"]

[[steps]]
id = "test"
needs = ["implement"]

[[steps]]
id = "deploy"
needs = ["test"]
```

**Visual**:
```
Design → Implement → Test → Deploy
```

---

### Pattern 2: Parallel Fanout with Gate

**Structure**: Multiple tasks execute in parallel, then aggregate

**Implementation**:
```bash
bd create "Aggregate Results" -t task -p 2 --label gate
bd create "Process File A" -t task -p 2
bd create "Process File B" -t task -p 2
bd create "Process File C" -t task -p 2

# Aggregate waits for all
bd dep add <aggregate> <file-a> --type waits-for
bd dep add <aggregate> <file-b> --type waits-for
bd dep add <aggregate> <file-c> --type waits-for
```

**Formula equivalent**:
```toml
formula = "parallel-fanout"

[[steps]]
id = "file-a"

[[steps]]
id = "file-b"

[[steps]]
id = "file-c"

[[steps]]
id = "aggregate"
waits_for = ["file-a", "file-b", "file-c"]
```

**Visual**:
```
File A ┐
File B ├──→ Aggregate
File C ┘
```

---

### Pattern 3: Diamond (Parallel + Merge + Continue)

**Structure**: Parallel tasks, merge point, then continue sequentially

**Implementation**:
```bash
bd create "Setup" -t task
bd create "Path A" -t task
bd create "Path B" -t task
bd create "Merge" -t task
bd create "Finalize" -t task

# Setup blocks both paths
bd dep add <path-a> <setup>
bd dep add <path-b> <setup>

# Merge waits for both paths
bd dep add <merge> <path-a> --type waits-for
bd dep add <merge> <path-b> --type waits-for

# Finalize needs merge
bd dep add <finalize> <merge>
```

**Visual**:
```
        ┌→ Path A ┐
Setup ──┤         ├──→ Merge → Finalize
        └→ Path B ┘
```

---

### Pattern 4: Conditional Branching

**Structure**: Different paths based on outcomes

**Implementation**:
```bash
bd create "Check Condition" -t task
bd create "Path: Success" -t task
bd create "Path: Failure" -t task

# Success path needs condition
bd dep add <success-path> <condition>

# Failure path is conditional (runs if condition fails)
bd mol bond <failure-path> <condition> --type conditional
```

**Use case**: Error handling, alternative workflows

---

## 4. Execution Model

### How Agents Process Steps

**Algorithm**:
1. **Query ready work**: `bd ready` finds unblocked issues
2. **Claim work**: Agent marks issue `in_progress`
3. **Execute**: Agent performs the work
4. **Complete**: Agent runs `bd close <id>`
5. **Repeat**: Next `bd ready` finds newly-unblocked work

**Key insight**: "Children are parallel by default. Only explicit dependencies create sequence."

**Source**: [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 5. Formula-Based Step Definitions

### Workflow in Formula Files

Formulas define step structure in TOML:

```toml
formula = "feature-workflow"
description = "Standard feature implementation"

[[steps]]
id = "spec"
description = "Write specification"

[[steps]]
id = "design"
needs = ["spec"]
description = "Design architecture"

[[steps]]
id = "implement"
needs = ["design"]
description = "Implement feature"

[[steps]]
id = "test"
needs = ["implement"]
description = "Write tests"

[[steps]]
id = "review"
waits_for = ["implement", "test"]
description = "Code review (waits for both)"
```

**Usage**:
```bash
bd cook feature-workflow
bd mol pour feature-workflow --var feature=authentication
```

**Source**: [Gas Town Repository](https://github.com/steveyegge/gastown)

---

## 6. Multi-Step Workflow Examples

### Example 1: Landing the Plane

From Beads documentation, the "Landing the Plane" workflow for session completion:

```toml
formula = "land-the-plane"

[[steps]]
id = "file-issues"
description = "Create issues for remaining work"

[[steps]]
id = "run-gates"
needs = ["file-issues"]
description = "Run quality gates (tests, lint, build)"

[[steps]]
id = "update-issues"
needs = ["run-gates"]
description = "Close finished work, update in-progress"

[[steps]]
id = "sync-push"
needs = ["update-issues"]
description = "bd sync && git push"

[[steps]]
id = "verify"
needs = ["sync-push"]
description = "Verify git status clean and pushed"

[[steps]]
id = "handoff"
needs = ["verify"]
description = "Provide context for next session"
```

**Source**: [AGENT_INSTRUCTIONS.md](https://github.com/steveyegge/beads/blob/main/AGENT_INSTRUCTIONS.md)

---

### Example 2: Feature Development Workflow

```bash
# Create epic for feature
FEATURE=$(bd create "Implement Auth System" -t epic -p 1)

# Create workflow steps as child issues
bd create "Write spec" -t task --parent $FEATURE
bd create "Design API" -t task --parent $FEATURE
bd create "Implement" -t task --parent $FEATURE
bd create "Write tests" -t task --parent $FEATURE
bd create "Review" -t task --parent $FEATURE

# Add dependencies (children are parallel by default)
bd dep add <design> <spec>
bd dep add <implement> <design>
bd dep add <tests> <implement>
bd dep add <review> <tests>
```

---

## 7. Common Pitfalls

### 1. Assuming Numbered Steps Execute Sequentially

**Mistake**: Naming issues "Step 1", "Step 2", "Step 3" without adding dependencies

**Reality**: Children under same parent **run in parallel by default**

**Fix**: Always add explicit `needs` dependencies for sequential execution

---

### 2. Temporal Language Confusion

**Mistake**: Thinking "Step 1 before Step 2" means `bd dep add step1 step2`

**Correct**: Think "Step 2 needs Step 1" → `bd dep add step2 step1`

**Remember**: `bd dep add B A` means "B depends on A"

---

### 3. Forgetting Gate Pattern for Parallel Aggregation

**Mistake**: Using `needs` for aggregation instead of `waits_for`

**Correct approach**:
```bash
# WRONG: Sequential (file-b waits for file-a, aggregate waits for file-b)
bd dep add <file-b> <file-a>
bd dep add <aggregate> <file-b>

# RIGHT: Parallel fanout with gate
bd dep add <aggregate> <file-a> --type waits-for
bd dep add <aggregate> <file-b> --type waits-for
```

---

### 4. No Visualization of Complex Workflows

**Problem**: Hard to understand complex dependency graphs

**Solution**:
```bash
bd dep tree <epic-id>    # Visualize dependencies
bd show <id>             # See specific issue relationships
bd blocked               # Find what's blocking execution
```

---

## 8. Step Lifecycle Management

### Creating Steps

```bash
# As individual issues
bd create "Step name" -t task -p 2

# As part of epic (hierarchy)
bd create "Step name" -t task --parent <epic-id>

# From formula (template)
bd cook my-workflow
bd mol pour my-workflow --var key=value
```

### Tracking Step Progress

```bash
bd ready                              # Show ready steps
bd list --status in_progress          # Show claimed steps
bd show <id>                          # View step details
bd dep tree <epic-id>                 # Visualize workflow
```

### Completing Steps

```bash
bd update <id> --status in_progress   # Claim step
# ... do the work ...
bd close <id>                         # Mark complete
```

**Critical**: Always close completed steps to unblock dependent work

---

## 9. Advanced: Dynamic Step Generation

### Runtime Step Discovery

```bash
# Discover steps at runtime
for item in $(discover_work_items); do
  STEP=$(bd create "Process $item" -t task --parent $EPIC)
  bd dep add <aggregate> $STEP --type waits-for
done
```

**Use case**: When number of steps unknown until runtime (file processing, worker surveys)

**Source**: [MOLECULES.md - Dynamic bonding](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 10. Integration with Open Harness

### Using Steps for Agent Workflows

```typescript
// Open Harness agent queries ready steps
const readySteps = await exec(`bd ready --json`);
const nextStep = readySteps[0];

// Claim step
await exec(`bd update ${nextStep.id} --status in_progress`);

// Execute with Open Harness SDK
await agent.execute(nextStep.description);

// Complete step
await exec(`bd close ${nextStep.id}`);

// Next agent session picks up newly-ready steps
```

**Key insight**: Steps persist in Beads across agent sessions, enabling long-horizon workflows

---

## Sources

All claims in this report are backed by evidence from:

- [Beads MOLECULES.md Documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads QUICKSTART.md](https://github.com/steveyegge/beads/blob/main/docs/QUICKSTART.md)
- [Beads AGENT_INSTRUCTIONS.md](https://github.com/steveyegge/beads/blob/main/AGENT_INSTRUCTIONS.md)
- [Beads CHANGELOG](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)
- [Gas Town Repository](https://github.com/steveyegge/gastown)
- [Beads FAQ](https://github.com/steveyegge/beads/blob/main/docs/FAQ.md)
- [Beads GitHub Repository](https://github.com/steveyegge/beads)

---

## Conclusion

"Steps" in Beads is conceptual terminology for issues organized with dependencies to create workflow patterns. The power comes from two dependency types:
- **`needs`** for sequential execution
- **`waits_for`** for parallel fanout with gates

By understanding these patterns and avoiding common pitfalls (especially assuming sequential execution from naming), you can build complex multi-step workflows that persist across sessions and enable autonomous agent execution.

**Key takeaway**: Children are parallel by default - sequence requires explicit dependencies.
