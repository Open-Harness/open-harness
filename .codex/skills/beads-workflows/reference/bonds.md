# Beads Bonds: Comprehensive Technical Reference

This is the complete research report on Beads Bonds (connecting work graphs) with all evidence and sources.

---

# **Beads Bonds: Comprehensive Research Report**

## Executive Summary

Beads **bonds** connect work graphs (molecules) to enable autonomous, multi-session workflow execution by agents. The `bd mol bond` command creates dependency relationships between molecules, allowing agents to traverse compound workflows that can span days across multiple sessions.

---

## 1. Command Syntax

### Basic Command

```bash
bd mol bond A B [--type <type>]
```

**Default behavior**: B depends on A (sequential blocking)

### Command Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--type <type>` | Specify bond type | `--type parallel`, `--type conditional` |
| `--ref <name>` | Reference identifier for dynamic bonding | `--ref arm-$polecat` |
| `--var <key>=<value>` | Pass variables to template instantiation | `--var name=$polecat` |

**Sources**:
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [CHANGELOG.md - Bond command features](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## 2. Bonding Types

### Sequential (Default)
```bash
bd mol bond A B
```
- **Semantics**: B depends on A (sequential by default)
- **Behavior**: B cannot start until A completes
- **Blocking**: Yes - creates blocking dependency
- **Use case**: Tasks that must execute in order

### Parallel
```bash
bd mol bond A B --type parallel
```
- **Semantics**: Organizational link without blocking
- **Behavior**: Issues run concurrently despite the bond
- **Blocking**: No - non-blocking relationship
- **Use case**: Grouping related but independent work

### Conditional
```bash
bd mol bond A B --type conditional
```
- **Semantics**: B executes only if A fails
- **Behavior**: B runs as error recovery/fallback path
- **Blocking**: Conditional - triggered by failure
- **Use case**: Error handling and alternative workflows

**Sources**:
- [MOLECULES.md - Bond types](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 3. Bonding Matrix: Operand Combinations

| Operands | Result | What Happens |
|----------|--------|--------------|
| **Epic + Epic** | Dependency edge | Creates blocking relationship between two existing work graphs |
| **Proto + Epic** | Spawn & attach | Instantiates proto as new issues, attaches them to the epic |
| **Proto + Proto** | Compound template | Creates reusable multi-molecule template |

**Key insight**: "Bonding = adding dependencies. `bd mol bond A B` creates a dependency between work graphs."

**Sources**:
- [MOLECULES.md - Bonding operands](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 4. Dependency Semantics

### What Bonds Create

Bonds create **blocking dependencies** (the `blocks` relationship type) between work graphs.

### Dependency Direction

**CRITICAL**: The syntax `bd mol bond A B` means **B depends on A**.

**Common mistake**: "Thinking 'Phase 1 comes before Phase 2' leads to `bd dep add phase1 phase2` when it should be `bd dep add phase2 phase1` (Phase 2 needs Phase 1)."

### Blocking vs Non-Blocking

| Type | Blocks Execution? | Purpose |
|------|-------------------|---------|
| `blocks` | **YES** | Only type that affects `bd ready` output |
| `related` | No | Thematic connection |
| `parent-child` | No | Hierarchical organization |
| `discovered-from` | No | Work discovery traceability |

**Key principle**: "blocks = sequential. No dep = parallel."

**Sources**:
- [MOLECULES.md - Dependencies](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Peter Warnock - Blocking relationships](https://peterwarnock.com/tools/beads-distributed-task-management-for-agents/)

---

## 5. Compound Workflows & Traversal

### How Agents Execute Bonded Workflows

1. **Identify ready work**: `bd ready` returns unblocked issues
2. **Claim work**: Mark issue as `in_progress`
3. **Complete work**: `bd close` closes the issue
4. **Follow bonds**: Agent automatically continues to next molecule

**Multi-day execution**: "The compound work graph can span days" because bonds persist across agent sessions.

**Autonomous orchestration**: "This is how orchestrators run autonomous workflows - agents follow the dependency graph, handing off between sessions, until all work closes."

### Traversal Mechanics

**When A blocks B**:
- Completing A unblocks B
- Agent can continue from A into B seamlessly
- Compound work graph can span multiple days

**Handoff pattern**: "One agent closes a bead; the next `bd ready` picks the follow-on, with audit trails preserving who did what and when."

**Sources**:
- [MOLECULES.md - Compound execution](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Steve Yegge - Agent workflow traversal](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a)

---

## 6. Dynamic Bonding Patterns

### The "Christmas Ornament" Pattern

**Pattern**: Discover work items at runtime and bond them dynamically.

**Real example from documentation**:
```bash
for polecat in $(gt polecat list); do
  bd mol bond mol-polecat-arm $PATROL_ID \
    --ref arm-$polecat --var name=$polecat
done
```

**What this does**:
1. Discovers polecats (workers) dynamically
2. Bonds each polecat arm to the patrol molecule
3. Creates variable-length dependency chains based on discovered data
4. Uses `--ref` to name each bond
5. Uses `--var` to pass variables to template instantiation

**Use case**: When you don't know the number of sub-tasks until runtime (e.g., surveying workers, processing discovered files)

**Sources**:
- [MOLECULES.md - Dynamic bonding](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Gas Town example](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)

---

## 7. Real-World Examples

### Example 1: Simple Sequential Workflow

```bash
# Create epic with tasks
bd create "Feature X" -t epic
bd create "Design" -t task --parent <epic-id>
bd create "Implement" -t task --parent <epic-id>
bd create "Test" -t task --parent <epic-id>

# Add dependencies (children are parallel by default)
bd dep add <implement-id> <design-id>   # implement needs design
bd dep add <test-id> <implement-id>     # test needs implement
```

### Example 2: Patrol with Dynamic Arms

From Gas Town documentation:

```bash
# Create patrol molecule with phases
bd mol pour patrol-template \
  --var patrol_name="Survey Workers"

# Discover workers and bond arms dynamically
for polecat in $(gt polecat list); do
  bd mol bond mol-polecat-arm $PATROL_ID \
    --ref arm-$polecat \
    --var name=$polecat
done
```

This creates:
```
Patrol (parent molecule)
├─ Preflight (phase 1)
├─ Survey Workers (phase 2)
│  ├─ Arm 1 (bonded dynamically)
│  ├─ Arm 2 (bonded dynamically)
│  └─ Arm N (bonded dynamically)
└─ Aggregate (phase 3)
```

**Sources**:
- [MOLECULES.md - Examples](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Gas Town patrol pattern](https://github.com/steveyegge/gastown)

---

## 8. Molecule Lifecycle Commands

### Template Instantiation

```bash
bd mol pour <proto> --var k=v    # Proto → Mol (persistent)
bd mol wisp <proto>               # Proto → Wisp (ephemeral)
```

### Bonding

```bash
bd mol bond A B [--type <type>]   # Connect work graphs
```

### Cleanup

```bash
bd mol squash <id>                # Mol/Wisp → Digest (permanent record)
bd mol burn <id>                  # Wisp → nothing (discard)
```

**Lifecycle flow**:
```
Formula (JSON macro)
  ↓
Proto (template issue)
  ↓
Pour → Mol (persistent) ──┐
  or                      ├→ Squash → Digest (permanent)
Wisp → Wisp (ephemeral) ──┘  or
                             Burn → deleted
```

**Sources**:
- [MOLECULES.md - Lifecycle](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 9. Use Cases: When to Bond vs When to Use Dependencies

### Use `bd dep add` when:
- Adding dependencies **within** an epic/molecule
- Tasks are siblings under the same parent
- Static relationships known at creation time
- Working with a fixed set of tasks

**Example**:
```bash
bd create "Task A" --parent <epic>
bd create "Task B" --parent <epic>
bd dep add <task-b> <task-a>  # B needs A
```

### Use `bd mol bond` when:
- Connecting **separate molecules/work graphs**
- Number of children unknown until runtime
- Dynamic workflow discovery
- Multi-molecule compound workflows
- Traversing work that spans sessions

**Example**:
```bash
bd mol bond epic-phase1 epic-phase2  # Phase 2 depends on Phase 1
```

**Key distinction**: "Use `bd dep add` for dependencies within a single epic/molecule, and `bd mol bond` for connecting separate molecules or work graphs together, especially when dealing with dynamic workflows."

**Sources**:
- [MOLECULES.md - Bonding vs dependencies](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 10. Common Pitfalls

### 1. Dependency Direction Confusion

**Mistake**: Thinking "A comes before B" means `bd mol bond A B`

**Reality**: `bd mol bond A B` means **B depends on A**

**Fix**: Always think "who needs who?" not "who comes first?"

### 2. Assuming Sequential Execution from Names

**Mistake**: Naming tasks "Step 1", "Step 2", "Step 3" and expecting sequential execution

**Reality**: "Steps named 'Step 1', 'Step 2', 'Step 3' run in parallel unless dependencies are explicitly added."

**Fix**: Always explicitly add dependencies with `bd dep add` or `bd mol bond`

### 3. Orphaned Blocked Issues

**Mistake**: Creating dependencies to issues that never get closed

**Reality**: "Blocked issues stay blocked forever if their blockers aren't closed."

**Fix**: Always close completed work with `bd close`

### 4. No Work Showing as Ready

**Symptom**: `bd ready` returns empty even with open issues

**Cause**: All issues have open blockers

**Debug commands**:
```bash
bd blocked                # Show blocked issues
bd dep tree <issue-id>    # Visualize dependency chain
```

### 5. Circular Dependencies

**Mistake**: Creating dependency cycles (A → B → C → A)

**Reality**: "bd prevents dependency cycles, which break ready work detection"

**Fix**: Design DAG (Directed Acyclic Graph) workflows

**Sources**:
- [TROUBLESHOOTING.md](https://github.com/steveyegge/beads/blob/main/docs/TROUBLESHOOTING.md)
- [MOLECULES.md - Common mistakes](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 11. Ready Work Detection

### How `bd ready` Works

**Algorithm**:
1. Find all open issues
2. Exclude issues with status `in_progress` (claimed)
3. Exclude issues with open `blocks` dependencies
4. Rank by priority (0=Critical → 4=Backlog)
5. Return highest-priority unblocked issues

**Key insight**: "Only `blocks` dependencies affect ready work detection."

### Checking Status

```bash
bd ready          # Show ready work
bd blocked        # Show blocked work
bd status         # Overall database status
```

**Sources**:
- [Peter Warnock - Ready work detection](https://peterwarnock.com/tools/beads-distributed-task-management-for-agents/)
- [TROUBLESHOOTING.md - Blocked issues](https://github.com/steveyegge/beads/blob/main/docs/TROUBLESHOOTING.md)

---

## 12. Multi-Agent Coordination

### How Bonds Enable Multi-Agent Workflows

**Concurrency safety**:
- Hash-based collision-resistant IDs
- Git-based distributed synchronization
- Custom merge driver for safe concurrent edits
- Append-only JSONL prevents conflicts

**Agent coordination**:
1. Agents query same database via git
2. See what's claimed (`status: in_progress`)
3. Work on different ready issues
4. Follow bonds to next work

**Handoff pattern**: "When you return to continue an epic, the executor checks `bd epic status`, sees which tasks are closed, gets the next ready task, and continues—the state survived because it lives in beads, not in the agent's context window."

**Sources**:
- [Steve Yegge - Multi-agent coordination](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a)
- [Peter Warnock - Distributed execution](https://peterwarnock.com/tools/beads-distributed-task-management-for-agents/)

---

## 13. Architecture Principles

### Why Bonding Works

**Offload complexity**: "LLMs are excellent at semantic reasoning but notoriously unreliable at algorithmic graph traversal, which is why Beads offloads this complexity."

**Persistent state**: "A temporal dependency graph ('beads on a chain') gives agents stable, structured, long-horizon memory with query semantics."

**Session-independent**: Bonds persist in git, not agent context, enabling work to span days and sessions.

**Execution model**:
```
compute ready set → pick task → work it → record discovered work → repeat
```

**Sources**:
- [JX0 - Agent context loss solution](https://jx0.ca/solving-agent-context-loss)
- [Steve Yegge - Architecture](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a)

---

## 14. Historical Context

### Command Evolution

**Deprecated**: `bd template bond` (old command)
**Current**: `bd mol bond` (replacement)

**Feature additions** (from CHANGELOG):
- Added `--ref` flag for dynamic bonding
- Added `--var` flag for variable substitution
- Added formula name support

**Sources**:
- [CHANGELOG.md](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## Summary Table

| Aspect | Key Insight | Evidence |
|--------|-------------|----------|
| **Command** | `bd mol bond A B` | B depends on A (sequential by default) |
| **Types** | Sequential, parallel, conditional | Sequential blocks, parallel doesn't, conditional triggers on failure |
| **Operands** | Epic+Epic, Proto+Epic, Proto+Proto | Different combinations produce different outcomes |
| **Dependencies** | Only `blocks` affects execution | `related`, `discovered-from`, `parent-child` are non-blocking |
| **Direction** | `bond A B` = B needs A | Common mistake: thinking "A before B" |
| **Traversal** | Agents follow graph automatically | "Compound work graph can span days" |
| **Dynamic** | Christmas ornament pattern | `for...do bd mol bond --ref --var` loop |
| **Lifecycle** | Pour → Bond → Squash/Burn | Persistent (pour) vs ephemeral (wisp) |
| **Use Cases** | Separate molecules, dynamic workflows | Use `bd dep add` within epic, `bd mol bond` between epics |
| **Pitfalls** | Direction confusion, orphaned blockers | Always close completed work |

---

## References & Sources

All claims in this report are backed by evidence from:

1. [MOLECULES.md - Primary bonding documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
2. [CHANGELOG.md - Feature history](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)
3. [TROUBLESHOOTING.md - Common issues](https://github.com/steveyegge/beads/blob/main/docs/TROUBLESHOOTING.md)
4. [Peter Warnock - Beads overview](https://peterwarnock.com/tools/beads-distributed-task-management-for-agents/)
5. [Steve Yegge - Introducing Beads](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a)
6. [Steve Yegge - Gas Town announcement](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
7. [JX0 - Solving agent context loss](https://jx0.ca/solving-agent-context-loss)
8. [Gas Town GitHub repository](https://github.com/steveyegge/gastown)
9. [Beads main repository](https://github.com/steveyegge/beads)
10. [Better Stack - Beads guide](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/)

---

**Report compiled**: 2026-01-05

**Methodology**: Systematic web search across official documentation, blog posts, tutorials, and community resources. All claims verified with direct evidence from authoritative sources.
