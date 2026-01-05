# Beads Wisps: Comprehensive Technical Reference

This is the complete research report on Beads Wisps with all evidence and sources.

---

# Command Syntax

### Core Commands

```bash
# Create ephemeral wisp from proto template
bd mol wisp <proto>

# List orphaned wisps
bd mol wisp list

# Garbage collection - clean up old wisps
bd mol wisp gc

# Discard a wisp without creating records
bd mol burn <id>

# Convert wisp to permanent digest record (discovery preservation)
bd mol squash <id>

# Promote wisp to persistent molecule (full audit trail)
bd mol pour <id>
```

**Source**: [MOLECULES.md documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

# Lifecycle

Wisps progress through distinct phases:

## 1. Creation (Vapor Phase)
- Command: `bd mol wisp <proto>` instantiates an ephemeral workflow from a proto template
- Wisps are created in `.beads/` directory with `Wisp=true` flag
- Marked as "No" for synced status (not persisted to Git)
- Automatically use direct mode execution, bypassing daemon overhead

## 2. Execution
- Agent processes ready work items until blocked or complete
- Can dynamically bond dependencies at runtime based on discoveries
- Supports parallel execution of independent work items

## 3. Terminal States

Three possible outcomes:

**A. Squash** (Preserve Discovery)
- Command: `bd mol squash <id>`
- Converts wisp to single-line digest summary
- Commits compressed record to git
- Use when: Important discovery occurred but full audit trail unnecessary

**B. Pour** (Promote to Persistence)
- Command: `bd mol pour <id>`
- Elevates ephemeral wisp to full persistent molecule
- Creates complete audit trail
- Use when: Critical discoveries emerge requiring full history

**C. Burn** (Discard)
- Command: `bd mol burn <id>`
- Permanently discards wisp without creating records
- Use when: Routine patrol found nothing noteworthy

**Sources**:
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

# Wisp vs Mol: Comparison Table

| Aspect | Wisp | Mol |
|--------|------|-----|
| **Persistence** | Ephemeral (not synced to Git) | Persistent (synced to Git) |
| **Creation** | `bd mol wisp <proto>` | `bd mol pour <proto>` |
| **Storage** | `.beads/` directory, marked `Wisp=true` | `.beads/issues.jsonl` + Git |
| **Audit Trail** | Minimal/none | Full history retained |
| **Performance** | Fast (skips daemon overhead) | Standard (daemon managed) |
| **Use Case** | Routine cycles, patrols, one-shots | Feature work, important discoveries |
| **Promotion Path** | Can be poured → mol or squashed → digest | N/A (already persistent) |
| **Git Pollution** | Zero (transient) | Full commit history |
| **Crash Recovery** | Lost if agent crashes | Survives restarts/interruptions |

**Sources**:
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads: Memory for Your Coding Agents](https://paddo.dev/blog/beads-memory-for-coding-agents/)

---

# Garbage Collection

### Command
```bash
bd mol wisp gc
```

### Purpose
Reclaims storage from old/orphaned wisps that were never properly disposed of.

### Cleanup Strategy Pattern

```bash
# 1. Identify orphaned wisps
bd mol wisp list

# 2. Review each wisp - decide fate:
bd mol squash <id>    # If contains useful discovery
bd mol pour <id>      # If needs full audit trail
bd mol burn <id>      # If routine/uninteresting

# 3. Reclaim storage
bd mol wisp gc
```

**Source**: [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

# Storage Details

### Location
- **Directory**: `.beads/` (local, not synced)
- **Marking**: `Wisp=true` flag in internal database
- **Synced Status**: Explicitly marked "No"

### How Wisps Are Tracked
Wisps exist in the Beads database with hash-based IDs and behave like regular Beads for query/dependency purposes, but are excluded from:
- JSONL export to `.beads/issues.jsonl`
- Git commits via daemon
- Cross-session persistence

### Storage Characteristics
- **Phase**: "Vapor" phase (chemistry metaphor)
- **Visibility**: Queryable via `bd ready`, `bd list`, `bd mol wisp list`
- **Lifespan**: Session-scoped unless explicitly promoted

**Sources**:
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

# The --pour Flag (Conversion)

### Syntax
```bash
bd mol pour <id>
```

### Purpose
Promotes an ephemeral wisp into a persistent molecule with full audit trail retention.

### When to Pour
- **Critical discoveries**: Finding emerged that requires historical record
- **Unexpected complexity**: Routine patrol uncovered deeper issue
- **Feature work**: What started as exploration became implementation
- **Handoff requirement**: Next agent needs full context

### Safety Mechanism
Version 0.40.0 introduced "Pour warning for vapor-phase formulas" - the system alerts users when attempting to pour formulas specifically designed for ephemeral use, preventing accidental creation of persistent noise.

**Source**: [Beads Changelog v0.40.0](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

# Real Examples

### Patrol Cycle Pattern

All patrol agents (Refinery, Witness, Deacon, Polecats) create wisp molecules for every patrol run:

```
patrol-x7k (wisp)
├── preflight (initialization)
├── survey-workers
│   ├── ace (dynamically bonded)
│   ├── nux (dynamically bonded)
│   └── toast (dynamically bonded)
└── aggregate (waits for all arms)
```

**Workflow**:
1. Patrol agent creates wisp from patrol proto
2. Executes preflight checks
3. Discovers workers at runtime, bonds arms dynamically
4. Aggregates results
5. Terminal decision:
   - No issues found → `bd mol burn`
   - Minor issues → `bd mol squash` (digest summary)
   - Critical issues → `bd mol pour` (full promotion)

**Sources**:
- [Gas Town article](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

### Dynamic Bonding Example

When the number of children isn't known until runtime:

```bash
# Wisp discovers work items at runtime
bd mol wisp patrol-proto

# Agent discovers 3 polecats need checking
# Bonds dependencies dynamically:
bd mol bond patrol-x7k polecat-1
bd mol bond patrol-x7k polecat-2
bd mol bond patrol-x7k polecat-3

# Execute until complete
# Decide fate based on findings
```

**Source**: [MOLECULES.md dynamic bonding section](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

# Common Patterns & Use Cases

### 1. Routine Patrol Cycles (Primary Use Case)
- **Pattern**: Recurring checks that usually find nothing
- **Wisp Advantage**: No git pollution from repetitive work
- **Terminal Action**: Usually `burn`, occasionally `squash`
- **Examples**: Code quality checks, dependency updates, test runs

### 2. One-Shot Exploratory Work
- **Pattern**: Quick investigation or proof-of-concept
- **Wisp Advantage**: Fast execution without audit overhead
- **Terminal Action**: `burn` if dead-end, `pour` if promising

### 3. Scaffolding Operations
- **Pattern**: Temporary work structure for coordination
- **Wisp Advantage**: Clean orchestration without permanent records
- **Example**: Parallel sub-task coordination that aggregates to parent

### 4. Cleanup/Maintenance Tasks
- **Pattern**: Automated housekeeping (log rotation, cache clearing)
- **Wisp Advantage**: Transient by nature, no history needed
- **Terminal Action**: Always `burn`

**Sources**:
- [Beads: Memory for Your Coding Agents](https://paddo.dev/blog/beads-memory-for-coding-agents/)
- [Beads Architecture Guide](https://debugg.ai/resources/beads-memory-ai-coding-agents-automated-pm-developer-workflows)

---

# Pitfalls & Common Mistakes

### 1. Orphaned Wisps
**Problem**: Wisps left in database when agent crashes or user interrupts

**Symptoms**:
- `.beads/` directory grows without bound
- `bd mol wisp list` shows old wisps
- Storage consumption increases

**Solution**:
```bash
bd mol wisp list     # Identify orphans
bd mol burn <id>     # Dispose each
bd mol wisp gc       # Reclaim storage
```

### 2. Over-Promotion (Pour Pollution)
**Problem**: Pouring routine wisps defeats their purpose

**Symptoms**:
- Git history cluttered with routine patrol records
- Issues database bloated with low-value audit trails

**Prevention**:
- Reserve `pour` for genuine discoveries
- Use `squash` for "something happened, but details unimportant"
- Default to `burn` for routine findings

**Mitigation**: Version 0.40.0 added warnings for vapor-phase formula promotion

### 3. No Crash Recovery
**Problem**: Wisps don't survive agent restarts

**Impact**: Long-running wisp workflows lost on crash

**Solution**:
- Pour wisps for work spanning multiple sessions
- Use persistent mols for fragile/interruptible work
- Structure wisps as atomic, completable units

### 4. Missing Terminal Actions
**Problem**: Forgetting to burn/squash/pour completed wisps

**Symptoms**:
- Completed wisps linger in database
- Unclear whether work finished or abandoned

**Prevention**:
- Always explicitly terminate wisps
- Build terminal action into patrol workflows
- Use `bd mol wisp list` regularly to audit

**Sources**:
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

# Decision Matrix: When to Use Wisps

| Scenario | Use Wisp? | Reasoning |
|----------|-----------|-----------|
| Routine patrol/check | YES | No audit trail needed, will burn |
| One-time exploration | YES | Fast, can promote if valuable |
| Feature implementation | NO | Needs persistence, crash recovery |
| Multi-session work | NO | Wisps don't survive restarts |
| Parallel sub-tasks | YES | Clean coordination, aggregate and burn |
| Critical bug investigation | NO | Audit trail essential from start |
| Cleanup/maintenance | YES | Transient by nature |
| Dependency scanning | YES | Routine, burn unless issues found |

**Rule of Thumb**: If you're confident you'll burn it, use a wisp. If there's any chance of needing history, use a mol.

---

# Sources

All information in this report is derived from:

- [Beads MOLECULES.md Documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)
- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [Welcome to Gas Town (Steve Yegge, Jan 2026)](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
- [Beads: Memory for Your Coding Agents](https://paddo.dev/blog/beads-memory-for-coding-agents/)
- [Beads Architecture Guide](https://debugg.ai/resources/beads-memory-ai-coding-agents-automated-pm-developer-workflows)
- [Beads Best Practices (Steve Yegge, Nov 2025)](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c)
- [Beads Git-Friendly Issue Tracker Guide](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/)
