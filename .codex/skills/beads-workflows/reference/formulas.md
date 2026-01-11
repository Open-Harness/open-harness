# Beads Formulas: Comprehensive Technical Reference

This is the complete research report on Beads Formulas with all evidence and sources.

---

# Beads Formulas System: Evidence-Backed Research Report

## Executive Summary

Based on comprehensive web research, **Beads formulas** are a workflow orchestration system using **TOML format** (not JSON) introduced in recent versions (v0.36.0+) of the Beads issue tracker. The formula system is part of "Gas Town," a multi-agent workspace manager. **Critical finding**: Documentation is sparse and scattered across changelog entries and GitHub repositories, with minimal complete examples publicly available.

---

## 1. Command Syntax: `bd cook`

### Basic Command
```bash
bd cook <formula-name>
```

**Purpose**: Converts a formula (TOML template) into a "protomolecule" (frozen template) stored in the Beads database.

### Available Flags

| Flag | Purpose | Source |
|------|---------|--------|
| `--prefix` | Custom issue prefix when cooking | [v0.36.0 Release](https://newreleases.io/project/github/steveyegge/beads/release/v0.36.0) |
| `--var` | Variable interpolation (supports commas in values) | [Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md) |

### Related Commands

```bash
bd formula list              # List available formulas
bd cook <formula>            # Cook formula into protomolecule
bd mol pour <proto> --var    # Instantiate protomolecule into molecule
bd mol pour <proto> --wisp   # Create ephemeral wisp workflow
```

**Source**: [Gas Town Repository](https://github.com/steveyegge/gastown)

---

## 2. File Structure: `.formula.toml`

### Naming Convention
```
.beads/formulas/<name>.formula.toml
```

### Search Paths (in order)
1. `.beads/formulas/` (project-local)
2. `~/.beads/formulas/` (user-global)
3. `~/gt/.beads/formulas/` (Gas Town directory)

**Source**: [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md), [Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

### JSON vs TOML
**Important**: Despite early references to `.formula.json`, the current system uses **TOML format**. The beads-release formula was converted from JSON to TOML in December 2025.

**Source**: [v0.37.0 Release](https://newreleases.io/project/github/steveyegge/beads/release/v0.37.0)

---

## 3. Formula Schema (TOML)

### Complete Structure

```toml
formula = "formula-name"
description = "Human-readable description"

[[steps]]
id = "step-id"
description = "What this step does"
needs = ["prerequisite-step-id"]  # Optional: sequential dependencies
waits_for = ["parallel-task"]     # Optional: gate dependencies

[[steps]]
id = "another-step"
description = "Second step"
needs = ["step-id"]
```

### Field Definitions

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `formula` | string | Yes | Formula identifier/name |
| `description` | string | Yes | Human-readable summary |
| `[[steps]]` | array | Yes | Workflow step definitions |
| `steps.id` | string | Yes | Unique step identifier |
| `steps.description` | string | Yes | Step purpose |
| `steps.needs` | array[string] | No | Sequential blocking dependencies |
| `steps.waits_for` | array[string] | No | Gate/fanout dependencies |

**Source**: [Gas Town Repository](https://github.com/steveyegge/gastown), [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 4. Variable Interpolation Syntax

### Evidence Status: **UNCLEAR**

**What we know**:
- The `--var` flag exists for passing variables
- Variables can contain commas (fixed in recent version)
- Example usage: `bd mol pour shiny --var feature=auth`

**What we don't know**:
- Exact template syntax within TOML files (e.g., `${var}`, `{{var}}`, `%var%`)
- How variables are referenced in step descriptions
- Whether conditionals/loops are supported

**Source**: [Gas Town Repository](https://github.com/steveyegge/gastown), [Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## 5. Dependency System

### Two Dependency Types

#### `needs` - Sequential Dependencies
**Purpose**: Blocking dependencies where Step B cannot start until Step A completes.

**Syntax**:
```toml
[[steps]]
id = "implement"
needs = ["design"]  # Must complete "design" first
```

**CLI Equivalent**:
```bash
bd dep add <issue> <depends-on>
```

#### `waits_for` - Gate Dependencies
**Purpose**: Fanout pattern where an aggregate task waits for multiple parallel tasks.

**Syntax**:
```toml
[[steps]]
id = "aggregate"
waits_for = ["task1", "task2", "task3"]
```

**CLI Equivalent**:
```bash
bd dep add <aggregate> <fileA> --type waits-for
```

**Source**: [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md), [Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## 6. Formula Composition

### Inheritance: `extends`

**Evidence**: Formula files support inheritance via an `extends` field.

**Status**: **SYNTAX UNCLEAR**. No concrete examples found.

**Likely Pattern** (inferred):
```toml
formula = "advanced-workflow"
extends = "basic-workflow"
description = "Extends basic with extra steps"
```

**Source**: [Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## 7. Real-World Example

### The "Shiny" Formula

```toml
formula = "shiny"
description = "Design before code, review before ship"

[[steps]]
id = "design"
description = "Think about architecture"

[[steps]]
id = "implement"
needs = ["design"]

[[steps]]
id = "test"
needs = ["implement"]

[[steps]]
id = "submit"
needs = ["test"]
```

**Workflow**:
```bash
bd cook shiny                          # Cook into protomolecule
bd mol pour shiny --var feature=auth   # Create runnable molecule
```

**Source**: [Gas Town Repository](https://github.com/steveyegge/gastown)

---

## 8. Architecture: The "Chemistry Metaphor"

Formulas exist in a 5-layer hierarchy:

| Layer | Metaphor | Purpose | Storage |
|-------|----------|---------|---------|
| **Formulas** | Ice-9 (source) | TOML templates | `.beads/formulas/*.formula.toml` |
| **Protos** | Solid (frozen) | Compiled templates | Beads database |
| **Molecules** | Liquid (flowing) | Active workflows | Beads database + JSONL |
| **Wisps** | Vapor (ephemeral) | Temporary workflows | Database only (not persisted) |
| **Issues** | (base layer) | Individual tasks | `.beads/issues.jsonl` + git |

**Workflow**:
1. Write formula (TOML)
2. `bd cook` → protomolecule (database)
3. `bd mol pour` → molecule or wisp (active work)
4. Steps become issues/beads in the graph

**Source**: [Gas Town](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04), [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

---

## 9. Use Cases

### When to Use Formulas

✅ **Good for**:
- Repeatable multi-step workflows
- Enforcing process consistency (design → code → test → review)
- Complex dependency graphs
- Cross-cutting concerns (e.g., "Rule of Five" reviews)

❌ **Not needed for**:
- Ad-hoc tasks
- Simple linear workflows (use protos instead)
- One-off work

### The "Rule of Five" Formula

**Concept**: Jeffrey Emanuel discovered that having an LLM review work 4-5 times (with different focus areas) produces superior results.

**Implementation**: You can create a formula that wraps any workflow with 5 review iterations, where each review has a slightly broader scope than the previous.

**Source**: [Six New Tips for Better Coding With Agents](https://steve-yegge.medium.com/six-new-tips-for-better-coding-with-agents-d4e9c86e42a9)

---

## 10. Common Pitfalls

### 1. Mixing JSON and TOML
**Problem**: Early versions used `.formula.json`, current versions use `.formula.toml`.
**Fix**: Use TOML format exclusively.

### 2. Vapor-Phase Formula Misuse
**Problem**: Using formulas designed for wisps (ephemeral) with `bd mol pour` creates persistent molecules unnecessarily.
**Fix**: Use `--wisp` flag for temporary workflows.
**Source**: [v0.40.0 Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

### 3. Variable Comma Handling
**Problem**: Earlier versions failed when variables contained commas.
**Fix**: Upgrade to v0.36.0+ where `--var` supports commas.
**Source**: [Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

### 4. Incomplete Documentation
**Problem**: Formulas are a recent feature with minimal public docs.
**Reality**: Most syntax details must be inferred from changelogs and release notes.

---

## 11. Known Unknowns

Despite exhaustive research, the following remain **undocumented**:

1. **Variable interpolation syntax** within TOML files
2. **Conditional logic** support (if/else)
3. **Loops** or iteration constructs
4. **`extends` inheritance syntax** (exact format unclear)
5. **Built-in variables** or functions
6. **Validation** or schema checking
7. **Error handling** in formulas
8. **Inline protos** (ephemeral proto definitions)

---

## 12. Version History

| Version | Date | Formula Changes |
|---------|------|-----------------|
| v0.36.0 | 2025 | Formula parser added, `bd cook` introduced, `--prefix` flag |
| v0.37.0 | 2025 | TOML format adopted, `needs`/`waits_for` support |
| v0.39.1 | 2025-12-27 | Refactoring of formula code |
| v0.40.0 | 2025-12-28 | Vapor-phase formula warnings |
| v0.41.0 | 2025-12-29 | `runCook` internal refactoring |

**Source**: [Beads Releases](https://github.com/steveyegge/beads/releases)

---

## Sources

All claims in this report are backed by these sources:

- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [Gas Town Repository](https://github.com/steveyegge/gastown)
- [Beads Changelog](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)
- [MOLECULES.md Documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Beads v0.36.0 Release](https://newreleases.io/project/github/steveyegge/beads/release/v0.36.0)
- [Beads v0.37.0 Release](https://newreleases.io/project/github/steveyegge/beads/release/v0.37.0)
- [Welcome to Gas Town (Medium)](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
- [Six New Tips for Better Coding With Agents](https://steve-yegge.medium.com/six-new-tips-for-better-coding-with-agents-d4e9c86e42a9)
- [Beads: A Git-Friendly Issue Tracker](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/)
- [Introducing Beads: A coding agent memory system](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a)

---

## Conclusion

The Beads formula system is a **recently introduced, under-documented feature** (v0.36.0+) for defining reusable TOML-based workflow templates. While the core structure (`formula`, `steps`, `needs`, `waits_for`) is confirmed, many advanced features (variable syntax, conditionals, inheritance) remain unclear due to sparse public documentation.

**Recommendation**: For definitive syntax details, consult the Beads source code directly or run `bd cook --help` with a recent version installed.
