# Beads Workflows: Comprehensive Guide for Open Harness

## Purpose

This skill teaches you to design and implement agent workflows using Beads as the persistent state and coordination layer. You're building Open Harness workflows that will dogfood your own SDK - this guide shows you how to leverage Beads' advanced features for multi-agent, long-horizon task orchestration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Workflow Design Principles](#workflow-design-principles)
3. [Advanced Features Deep Dive](#advanced-features-deep-dive)
4. [Workflow Patterns Library](#workflow-patterns-library)
5. [Open Harness Integration](#open-harness-integration)
6. [Troubleshooting & Anti-Patterns](#troubleshooting--anti-patterns)

---

## Architecture Overview

### The Beads Stack

```
┌─────────────────────────────────────┐
│ Formulas (TOML templates)           │ ← Reusable workflow definitions
├─────────────────────────────────────┤
│ Protos (frozen templates)           │ ← Compiled from formulas
├─────────────────────────────────────┤
│ Molecules (active workflows)        │ ← Persistent (mols) or ephemeral (wisps)
├─────────────────────────────────────┤
│ Epics (parent + children)           │ ← Hierarchical task groups
├─────────────────────────────────────┤
│ Issues (individual tasks)           │ ← Base unit of work
├─────────────────────────────────────┤
│ Git (JSONL storage)                 │ ← Distributed persistence
└─────────────────────────────────────┘
```

**Key insight**: You typically work at **Molecules** and **Issues** layers. Formulas and Protos are optional for reusable patterns.

### Why Beads for Workflows?

| Challenge | Beads Solution |
|-----------|----------------|
| **Context window limits** | State persists in git, not agent memory |
| **Multi-session work** | Workflows span days, survive crashes |
| **Agent coordination** | Git-based conflict-free collaboration |
| **Execution order** | Dependency graphs handle sequencing |
| **Long-horizon tasks** | Persistent memory with audit trails |

---

## Workflow Design Principles

### 1. Think in Dependency Graphs, Not Scripts

**Bad (imperative scripting)**:
```bash
# This doesn't work - agents need explicit dependencies
run_step1
run_step2
run_step3
```

**Good (dependency declaration)**:
```bash
bd create "Step 1"
bd create "Step 2"
bd create "Step 3"
bd dep add <step2> <step1>  # Step 2 needs Step 1
bd dep add <step3> <step2>  # Step 3 needs Step 2

# Agent autonomously executes: bd ready → claim → complete → repeat
```

### 2. Parallelize by Default, Sequence Explicitly

**Default behavior**: All children run in parallel.

**Make it sequential**: Add explicit `needs` dependencies.

```toml
# Formula example
[[steps]]
id = "parallel-task-1"

[[steps]]
id = "parallel-task-2"

# These run in parallel! To sequence them:
[[steps]]
id = "parallel-task-2"
needs = ["parallel-task-1"]  # Now sequential
```

### 3. Choose the Right Abstraction

| Need | Use |
|------|-----|
| One-off work | **Issues** (`bd create`) |
| Related tasks | **Epic** (parent + children) |
| Reusable pattern | **Formula** → Proto → Mol |
| Routine checks | **Wisp** (ephemeral) |
| Multi-molecule flow | **Bonds** (`bd mol bond`) |

### 4. Ephem human vs Persistent State

**Ephemeral (Wisps)** for:
- Patrol cycles
- Automated checks
- Exploration tasks
- Routine maintenance

**Persistent (Mols)** for:
- Feature implementation
- Complex workflows
- Multi-session work
- Audit trail needs

**Rule of thumb**: If you'll likely `burn` it, use a wisp.

---

## Advanced Features Deep Dive

### Formulas: Reusable Workflow Templates

**Purpose**: Define workflow patterns once, reuse with variables.

**File structure**:
```toml
# .beads/formulas/feature-workflow.formula.toml
formula = "feature-workflow"
description = "Standard feature implementation flow"

[[steps]]
id = "spec"
description = "Write specification"

[[steps]]
id = "implement"
needs = ["spec"]
description = "Implement feature"

[[steps]]
id = "test"
needs = ["implement"]
description = "Write tests"

[[steps]]
id = "review"
needs = ["test"]
description = "Code review"
```

**Usage**:
```bash
bd cook feature-workflow
bd mol pour feature-workflow --var feature=authentication
```

**When to use**:
- Repeating same workflow structure
- Enforcing process consistency
- Complex dependency graphs
- Team coordination patterns

**Detailed reference**: `reference/formulas.md`

---

### Variables: Parameterizing Workflows

**CLI usage**:
```bash
bd mol pour my-proto --var name=auth --var priority=high
```

**Multiple variables**:
```bash
bd mol pour deployment \
  --var env=production \
  --var region=us-west \
  --var replicas=3
```

**Comma support** (v0.41.0+):
```bash
bd mol pour file-processor --var files=a.go,b.go,c.go
```

**⚠️ Documentation gap**: Variable interpolation syntax within TOML files is unclear. Test with actual `bd cook` commands.

**Detailed reference**: `reference/variables.md`

---

### Wisps: Ephemeral Workflows

**Lifecycle**:
```
Create → Execute → Terminal Action
  ↓         ↓           ↓
wisp    bd ready    burn/squash/pour
```

**Commands**:
```bash
bd mol wisp patrol-proto      # Create
bd mol burn <wisp-id>          # Discard
bd mol squash <wisp-id>        # Preserve digest
bd mol pour <wisp-id>          # Promote to persistent
bd mol wisp gc                 # Cleanup orphans
```

**Real-world pattern** (Gas Town patrol):
```bash
bd mol wisp patrol-template

# Discover work at runtime
for worker in $(gt workers list); do
  bd mol bond arm-$worker $PATROL_ID
done

# Execute until complete
# Terminal action based on findings:
# - Nothing found → bd mol burn
# - Minor issues → bd mol squash
# - Critical issues → bd mol pour
```

**Detailed reference**: `reference/wisps.md`

---

### Bonds: Connecting Work Graphs

**Purpose**: Link separate molecules for compound workflows.

**Syntax**:
```bash
bd mol bond A B [--type <type>]
```

**⚠️ CRITICAL**: `bd mol bond A B` means **B depends on A** (not "A before B").

**Bonding matrix**:

| Operands | Result |
|----------|--------|
| Epic + Epic | Dependency edge between work graphs |
| Proto + Epic | Spawn proto as new issues, attach to epic |
| Proto + Proto | Create compound template |

**Dynamic bonding** (Christmas ornament pattern):
```bash
for item in $(discover_dynamically); do
  bd mol bond mol-arm $PARENT_ID \
    --ref arm-$item \
    --var name=$item
done
```

**vs `bd dep add`**:
- Use `bd dep add` **within** same epic
- Use `bd mol bond` **between** separate molecules

**Detailed reference**: `reference/bonds.md`

---

### Distills: Extracting Formulas from Epics

**Purpose**: Reverse-engineer formula from organic workflow evolution.

**Command**:
```bash
bd mol distill <epic-id> <formula-name> \
  --var concrete-value=variable-name
```

**Use case**: Team develops workflow naturally, then wants to templatize it for reuse.

**Workflow**:
```
Pour formula → Adapt organically → Distill back to formula → Reuse updated pattern
```

**Status**: Command exists but **severely under-documented**. No user-facing examples available.

**Detailed reference**: `reference/distills.md`

---

## Workflow Patterns Library

### Pattern 1: Sequential Pipeline

**Use case**: Tasks must execute in strict order.

**Implementation**:
```bash
bd create "Design" -t task
bd create "Implement" -t task
bd create "Test" -t task
bd create "Deploy" -t task

bd dep add <implement> <design>
bd dep add <test> <implement>
bd dep add <deploy> <test>
```

**Formula version**:
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

---

### Pattern 2: Parallel Fanout with Aggregate Gate

**Use case**: Multiple independent tasks, then aggregate results.

**Implementation**:
```bash
bd create "Aggregate" -t task --label gate
bd create "Task A" -t task
bd create "Task B" -t task
bd create "Task C" -t task

# Aggregate waits for all tasks
bd dep add <aggregate> <taskA> --type waits-for
bd dep add <aggregate> <taskB> --type waits-for
bd dep add <aggregate> <taskC> --type waits-for
```

**Visual**:
```
  Task A ┐
  Task B ├──→ Aggregate
  Task C ┘
```

---

### Pattern 3: Patrol Cycle (Wisp Pattern)

**Use case**: Routine checks that usually find nothing.

**Implementation**:
```bash
# Create ephemeral patrol workflow
bd mol wisp patrol-proto

# Agent executes patrol phases
bd ready | xargs -I {} bd update {} --status in_progress

# Terminal decision:
if [ critical_issues_found ]; then
  bd mol pour $PATROL_ID  # Promote to persistent
elif [ minor_issues_found ]; then
  bd mol squash $PATROL_ID  # Preserve digest
else
  bd mol burn $PATROL_ID  # Discard
fi
```

---

### Pattern 4: Dynamic Discovery with Runtime Bonding

**Use case**: Number of sub-tasks unknown until runtime.

**Implementation**:
```bash
# Create parent molecule
PARENT=$(bd mol pour discovery-proto)

# Discover work at runtime
for item in $(scan_and_discover); do
  bd mol bond mol-worker $PARENT \
    --ref worker-$item \
    --var target=$item
done

# Agent autonomously processes all bonded workers
```

**Real-world example**: Gas Town polecat patrols.

---

### Pattern 5: Multi-Day Compound Workflow

**Use case**: Workflow spans multiple agent sessions across days.

**Implementation**:
```bash
# Day 1: Setup phase
bd mol pour setup-phase
# Agent works on setup, closes when done

# Day 2: Implementation phase
bd mol bond impl-phase setup-phase  # impl depends on setup
bd mol pour impl-phase
# Different agent picks up via `bd ready`

# Day 3: Review phase
bd mol bond review-phase impl-phase
bd mol pour review-phase
# Yet another agent continues the flow
```

**Key**: State persists in git, not agent context.

---

## Open Harness Integration

### Use Beads as State Layer for Open Harness Workflows

**Architecture**:
```
┌─────────────────────────────────────┐
│  Open Harness (Agent SDK)           │
│  - Agent orchestration              │
│  - Tool execution                   │
│  - Context management               │
└──────────────┬──────────────────────┘
               │
               ├──(queries)──→  Beads
               │                  │
               ├─(claims work)──→ │
               │                  │
               └─(reports done)─→ │
                                  │
                         ┌────────┴────────┐
                         │ Git (persistence)│
                         └─────────────────┘
```

### Integration Patterns

#### 1. Agent Work Queue Pattern

```typescript
// Open Harness agent queries Beads for work
const readyWork = await exec(`bd ready --json`);
const nextTask = readyWork[0];

// Claim work
await exec(`bd update ${nextTask.id} --status in_progress`);

// Execute with Open Harness SDK
await agent.execute(nextTask.description);

// Report completion
await exec(`bd close ${nextTask.id}`);
```

#### 2. Multi-Agent Coordination

```typescript
// Agent A (design specialist)
const designTasks = await exec(`bd ready --label design --json`);

// Agent B (implementation specialist)
const implTasks = await exec(`bd ready --label implement --json`);

// Beads ensures correct execution order via dependencies
```

#### 3. Crash Recovery

```typescript
// Agent crashes mid-workflow
// On restart:
const inProgress = await exec(`bd list --status in_progress --json`);
// Resume from last known state
```

#### 4. Workflow Template Library

```typescript
// Build library of Open Harness patterns as Beads formulas
await exec(`bd cook open-harness/feature-workflow`);
await exec(`bd cook open-harness/refactor-workflow`);
await exec(`bd cook open-harness/test-workflow`);

// Instantiate for specific feature
await exec(`bd mol pour open-harness/feature-workflow --var feature=auth`);
```

---

## Troubleshooting & Anti-Patterns

### Common Mistakes

#### 1. Temporal Language Confuses Dependencies

**Mistake**:
```bash
# Thinking "Phase 1 before Phase 2"
bd dep add phase1 phase2  # WRONG!
```

**Correct**:
```bash
# Think "Phase 2 needs Phase 1"
bd dep add phase2 phase1  # RIGHT
```

#### 2. Numbered Steps Run in Parallel

**Mistake**: Naming steps "Step 1", "Step 2", "Step 3" and expecting sequential execution.

**Reality**: Children are parallel by default. **Add deps explicitly**.

#### 3. Orphaned Wisps Accumulate

**Problem**: Wisps left without terminal action.

**Fix**:
```bash
bd mol wisp list     # Identify orphans
bd mol burn <id>     # Clean up
bd mol wisp gc       # Garbage collect
```

#### 4. Blocked Work Stays Blocked

**Problem**: Forgetting to close completed work.

**Debug**:
```bash
bd blocked           # Show what's blocked
bd dep tree <id>     # Visualize dependency chain
```

**Fix**: Always `bd close` when done.

#### 5. Wrong Abstraction Choice

**Mistake**: Using `bd mol bond` within same epic (use `bd dep add` instead).

**Rule**:
- `bd dep add` → within epic
- `bd mol bond` → between molecules

---

## Reference Documentation

For complete technical details with all sources and evidence:

- **Formulas**: `reference/formulas.md` - TOML syntax, command reference, examples
- **Variables**: `reference/variables.md` - CLI usage, interpolation, scoping
- **Wisps**: `reference/wisps.md` - Lifecycle, GC, patrol patterns
- **Bonds**: `reference/bonds.md` - Bonding matrix, traversal, dynamic bonding
- **Distills**: `reference/distills.md` - Command status, use cases, limitations
- **Steps**: `reference/steps.md` - Workflow patterns, dependency types

---

## Sources

All information derived from extensive research across:

- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [Beads Official Documentation](https://github.com/steveyegge/beads/tree/main/docs)
- [Gas Town Multi-Agent Manager](https://github.com/steveyegge/gastown)
- Steve Yegge's Beads blog posts and tutorials
- Community guides and third-party resources

**Research methodology**: 6 parallel research agents conducted systematic evidence-backed investigation of each advanced feature with source verification.

---

## Next Steps

When building Open Harness workflows:

1. **Start simple**: Use Issues and Epics before formulas
2. **Add reusability**: Extract common patterns to formulas
3. **Optimize for agents**: Use wisps for ephemeral work
4. **Enable coordination**: Bond molecules for complex flows
5. **Iterate**: Distill organic workflows back to templates

**Remember**: You're dogfooding your own workflow system. Design patterns that Open Harness users will want to adopt.
