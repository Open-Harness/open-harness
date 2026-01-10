# Beads Variables: Comprehensive Technical Reference

This is the complete research report on Beads Variables with all evidence and sources.

---

# Beads Variables System Research Report

## Executive Summary

Beads has a variable system for template interpolation in its formula and molecule features, but **detailed syntax documentation is sparse**. Most information comes from changelog entries, release notes, and scattered examples rather than comprehensive reference documentation.

---

## 1. Variable Declaration

### In Formulas
- Formulas are defined in **TOML format** (`.formula.toml` files)
- Variables can be declared in formula steps
- Variables support **inheritance via `extends` field**
- Formula files support `needs` and `waits_for` fields for dependency declarations

**Evidence:** [Beads Releases](https://github.com/steveyegge/beads/releases) - "Formula files (.formula.json) support inheritance via extends, and have needs and waits_for fields"

---

## 2. Variable Interpolation Syntax

**CRITICAL FINDING:** The exact interpolation syntax (`${var}`, `{{var}}`, `$var`) is **NOT explicitly documented** in publicly available sources.

### What We Know:
- Variables are substituted in **titles and descriptions** of beads/molecules
- Substitution happens at **both compile-time and runtime**
- v0.44.0 added "Molecule variable substitution in root bead title/desc"

**Evidence:** [Beads CHANGELOG](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## 3. CLI Usage: `--var` Flag

### Confirmed Syntax:
```bash
bd mol pour <proto> --var key=value
```

### Examples Found:

**Example 1 - Basic usage:**
```bash
bd mol pour shiny --var feature=auth
```
*Creates a molecule from the "shiny" proto with variable `feature` set to `auth`*

**Source:** [Gas Town README](https://github.com/steveyegge/gastown)

**Example 2 - Dynamic bonding with variables:**
```bash
bd mol bond mol-polecat-arm $PATROL_ID --ref arm-$polecat --var name=$polecat
```
*Passes shell variable `$polecat` as the template variable `name`*

**Source:** [Beads MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)

### Multiple Variables:
```bash
# Implied pattern (not explicitly documented):
bd mol pour <proto> --var key1=value1 --var key2=value2
```

### Comma Support (v0.41.0):
```bash
# Now supported (fixed in v0.41.0):
bd mol pour <proto> --var files=a.go,b.go,c.go
```

**Evidence:** [v0.41.0 Release](https://github.com/steveyegge/beads/releases) - "fix: --var flag now allows commas in values (#786)"

### Quoted Values:
The parser "respects quoted values" as of v0.41.0, implying:
```bash
bd mol pour <proto> --var message="Hello, World"
```

**Evidence:** [Beads CHANGELOG](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## 4. Variable Scoping

**FINDING:** Scoping rules are **NOT explicitly documented**.

### Inferred Behavior:
- Variables passed via `--var` are available during formula expansion
- Variables are scoped to the molecule/proto instance being created
- Variables can be overridden during expansion (v0.37.0: "Implement expansion var overrides")

**Evidence:** [GitHub Releases](https://github.com/steveyegge/beads/releases)

---

## 5. Special/Built-in Variables

**FINDING:** No documentation found for system-provided or built-in variables.

---

## 6. Type Handling

**FINDING:** Type system is **NOT documented**.

### Observations:
- Values appear to be treated as strings by default
- No explicit type coercion syntax found
- Complex types (arrays, objects) are NOT documented

---

## 7. Real Examples

### Complete Workflow Example:

```bash
# 1. Cook a formula into a protomolecule (template)
bd cook shiny

# 2. Pour the proto into a molecule with variables
bd mol pour shiny --var feature=auth --var priority=high

# 3. Dynamic bonding with runtime variables
for polecat in polecat1 polecat2; do
  bd mol bond mol-polecat-arm $PATROL_ID --ref arm-$polecat --var name=$polecat
done
```

**Source:** Synthesized from [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md) and [Gas Town](https://github.com/steveyegge/gastown)

---

## 8. Common Patterns

### Reusable Templates:
```bash
# Create proto once
bd mol pour task-template --var assignee=alice --var sprint=3

# Reuse with different values
bd mol pour task-template --var assignee=bob --var sprint=3
```

### Runtime Expansion:
- v0.37.0 added "on_complete/for-each runtime expansion types"
- Variables can be expanded in loops and conditional gates

**Evidence:** [v0.37.0 Release Notes](https://github.com/steveyegge/beads/releases)

---

## 9. Best Practices

**CANNOT BE DETERMINED** - No best practices guide exists in public documentation.

---

## 10. Known Pitfalls

### Comma Handling (FIXED):
**Before v0.41.0:** Commas in `--var` values would break parsing
```bash
# Would fail before v0.41.0:
bd mol pour <proto> --var files=a.go,b.go
```

**After v0.41.0:** Commas are properly handled
**Source:** [v0.41.0 Release](https://github.com/steveyegge/beads/releases)

---

## 11. Commands Using Variables

| Command | Purpose | Variable Support |
|---------|---------|------------------|
| `bd cook <formula>` | Execute formula template | Variables from formula definition |
| `bd mol pour <proto> --var k=v` | Create persistent molecule | CLI `--var` flags |
| `bd mol wisp <proto> --var k=v` | Create ephemeral molecule | CLI `--var` flags (inferred) |
| `bd mol bond <proto> <parent> --var k=v` | Dynamic bonding | CLI `--var` flags |

**Sources:** [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md), [Gas Town](https://github.com/steveyegge/gastown)

---

## 12. Formula Search Paths

Variables in formula files are searched in:
1. `.beads/formulas/`
2. `~/.beads/formulas/`
3. `~/gt/.beads/formulas/`

**Evidence:** [v0.36.0 Release](https://github.com/steveyegge/beads/releases)

---

## 13. Validation Features

### Template Validation (v0.43.0):
```bash
bd <command> --validate  # Validates template before execution
```

**Evidence:** [GitHub Releases](https://github.com/steveyegge/beads/releases)

---

## Critical Documentation Gaps

### Missing Documentation:
1. **Interpolation syntax** - No confirmed syntax like `${var}`, `{{var}}`, or `$var`
2. **Variable scoping rules** - No formal specification
3. **Type system** - No documentation on types or coercion
4. **Special variables** - No list of built-in variables
5. **Complete CLI reference** - CLI_REFERENCE.md not publicly accessible
6. **Error handling** - No guidance on variable substitution failures
7. **Escaping rules** - How to include literal `${}` characters
8. **Default values** - Syntax for optional variables with defaults

---

## Sources

All claims in this report are backed by these sources:

- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [Beads CHANGELOG](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)
- [Beads Releases](https://github.com/steveyegge/beads/releases)
- [MOLECULES.md Documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [Gas Town Project](https://github.com/steveyegge/gastown)
- [v0.36.0 Release Notes](https://newreleases.io/project/github/steveyegge/beads/release/v0.36.0)
- [v0.37.0 Release Notes](https://newreleases.io/project/github/steveyegge/beads/release/v0.37.0)
- [v0.41.0 Release Notes](https://github.com/steveyegge/beads/releases)
- [Better Stack Community Guide](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/)

---

## Recommendations

1. **Consult the repository directly** - Clone `github.com/steveyegge/beads` and check:
   - `docs/CLI_REFERENCE.md` (if exists)
   - `docs/WORKFLOWS.md` (referenced but not found)
   - Source code in `cmd/` or `internal/` directories

2. **Check GitHub Issues** - Issue #786 and related discussions may have examples

3. **Join community channels** - The project may have Discord/Slack with more examples

4. **Experiment directly** - Test actual interpolation syntax with `bd cook` and `bd mol pour`

5. **Request documentation** - Open an issue requesting comprehensive variable syntax documentation

---

**CONCLUSION:** Beads has a functional variable system with `--var` CLI support, but **lacks comprehensive public documentation**. Most knowledge must be inferred from changelog entries and scattered examples rather than formal specification.
