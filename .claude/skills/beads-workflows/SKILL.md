---
name: beads-workflows
description: Design and implement agent workflows using Beads git-native issue tracking. Covers formulas, variables, wisps, bonds, distills, and workflow patterns for building multi-agent systems with persistent state. USE WHEN building workflows with Open Harness, designing agent coordination, or implementing long-horizon tasks with Beads as the state layer.
---

# Beads Workflows - Quick Reference

## When to Activate This Skill

- "Build a workflow with Beads"
- "Design agent coordination using Beads"
- "Create formula for X workflow"
- "Implement multi-agent workflow"
- "Use Beads for persistent agent state"
- User wants to design workflows leveraging Beads features

## Core Concept

**Beads** = Git-native issue tracker designed for AI agents with:
- **Persistent memory** for long-horizon tasks
- **Dependency graphs** for workflow orchestration
- **Multi-agent coordination** via conflict-free git storage
- **Advanced features** for reusable workflow templates

## Quick Command Reference

### Essential Commands

```bash
# Finding Work
bd ready                # Show unblocked issues
bd blocked              # Show blocked issues
bd list --status open   # List all open issues

# Creating & Managing Work
bd create "Task" -p 2 -t task
bd update <id> --status in_progress
bd close <id>

# Dependencies
bd dep add <issue> <depends-on>   # issue needs depends-on
bd dep tree <id>                  # Visualize dependency tree
```

### Molecule Workflow Commands

```bash
# Templates → Instances
bd cook <formula>                 # Formula → Proto
bd mol pour <proto> --var k=v     # Proto → Mol (persistent)
bd mol wisp <proto>               # Proto → Wisp (ephemeral)

# Bonding (connect work graphs)
bd mol bond A B                   # B depends on A

# Cleanup
bd mol squash <id>                # Compress to digest
bd mol burn <id>                  # Discard wisp
bd mol wisp gc                    # Clean orphaned wisps
```

## Decision Trees

### Mol vs Wisp?

**Use Mol** (persistent) when:
- Multi-session work
- Need crash recovery
- Requires audit trail
- Feature implementation

**Use Wisp** (ephemeral) when:
- Routine patrols/checks
- One-time exploration
- Will likely burn after completion
- Don't need history

### Bond vs Dep?

**Use `bd dep add`** when:
- Dependencies **within** same epic
- Static relationships
- Known at creation time

**Use `bd mol bond`** when:
- Connecting **separate** molecules
- Dynamic discovery at runtime
- Compound multi-day workflows

## Common Workflow Patterns

### 1. Sequential Pipeline

```bash
bd create "Phase 1" -t task
bd create "Phase 2" -t task
bd create "Phase 3" -t task
bd dep add <phase2> <phase1>  # Phase 2 needs Phase 1
bd dep add <phase3> <phase2>  # Phase 3 needs Phase 2
```

### 2. Parallel Fanout with Gate

```bash
bd create "Aggregate" -t task --label gate
bd create "Task A" -t task
bd create "Task B" -t task
bd create "Task C" -t task

# Aggregate waits for all
bd dep add <aggregate> <taskA> --type waits-for
bd dep add <aggregate> <taskB> --type waits-for
bd dep add <aggregate> <taskC> --type waits-for
```

### 3. Dynamic Runtime Bonding

```bash
# Patrol discovers work at runtime
for item in $(discover_work); do
  bd mol bond mol-arm $PATROL_ID \
    --ref arm-$item \
    --var name=$item
done
```

### 4. Reusable Formula Pattern

```toml
# .beads/formulas/review-cycle.formula.toml
formula = "review-cycle"
description = "Design → Implement → Test → Review"

[[steps]]
id = "design"
description = "Architecture design"

[[steps]]
id = "implement"
needs = ["design"]

[[steps]]
id = "test"
needs = ["implement"]

[[steps]]
id = "review"
needs = ["test"]
```

```bash
bd cook review-cycle
bd mol pour review-cycle --var feature=auth
```

## Key Principles

### 1. **Children are Parallel by Default**
Only explicit dependencies create sequential execution.

### 2. **Only `blocks` Affects Execution**
Other link types (`related`, `discovered-from`) are non-blocking.

### 3. **Dependency Direction Matters**
`bd dep add B A` means "B needs A" (not "A before B").

### 4. **Always Close Completed Work**
Blocked issues stay blocked forever without closure.

### 5. **Wisps Need Terminal Actions**
Always `burn`, `squash`, or `pour` completed wisps.

## Advanced Features

| Feature | Command | Use Case |
|---------|---------|----------|
| **Formulas** | `bd cook` | Reusable TOML workflow templates |
| **Variables** | `--var k=v` | Parameterize formulas/molecules |
| **Wisps** | `bd mol wisp` | Ephemeral workflows (patrols) |
| **Bonds** | `bd mol bond` | Connect separate molecules |
| **Distills** | `bd mol distill` | Extract formula from existing epic |

## Common Pitfalls

❌ **Don't**:
- Assume numbered steps run sequentially (add deps explicitly)
- Leave wisps without terminal action (creates orphans)
- Mix `bd dep add` and `bd mol bond` within same epic
- Create circular dependencies

✅ **Do**:
- Close work when complete
- Use `bd ready` to find next work
- Run `bd mol wisp gc` periodically
- Think "who needs who?" for dependencies

## Integration with Open Harness

When building Open Harness workflows:

1. **Use Beads for state** - Long-running workflow state persists across sessions
2. **Agent coordination** - Multiple agents can query same Beads database
3. **Dependency orchestration** - Let Beads handle execution order, focus agents on work
4. **Template library** - Build formula library for common Open Harness patterns
5. **Crash recovery** - Workflows survive agent crashes/restarts

## Supplementary Resources

For comprehensive deep dive with complete technical references:
```
read ${PAI_DIR}/skills/beads-workflows/CLAUDE.md
```

For detailed advanced feature documentation:
```
read ${PAI_DIR}/skills/beads-workflows/reference/<feature>.md
```

## Sources

All information based on evidence from:
- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [Beads Documentation](https://github.com/steveyegge/beads/tree/main/docs)
- [Gas Town Multi-Agent Manager](https://github.com/steveyegge/gastown)
- Steve Yegge's Beads blog posts (Medium)
- Community resources and guides
