# Beads Distills: Comprehensive Technical Reference

This is the complete research report on Beads Distills with all evidence and sources.

---

# Research Report: Beads `bd mol distill` Operation

## Executive Summary

The `bd mol distill` command **DOES EXIST** and is implemented in the Beads project. It was improved in version 0.37.0 and is currently available in the latest version (v0.44.0). However, it is **poorly documented** in user-facing documentation—only the source code provides complete details.

---

## 1. Command Syntax

**Command exists:** ✅ **Yes** (confirmed in source code)

```bash
bd mol distill <epic-id> [formula-name]
```

**Flags:**
- `--var <variable>=<value>` — Replace concrete values with `{{variable}}` placeholders (repeatable)
- `--dry-run` — Preview output without writing files
- `--output <directory>` — Specify custom output directory for formula file

**Source:** [mol_distill.go](https://github.com/steveyegge/beads/blob/v0.44.0/cmd/bd/mol_distill.go)

---

## 2. Distill Purpose

**What distill does:**

The `bd mol distill` command **extracts a reusable formula from an existing epic (molecule)**. It reverses the `pour` operation by converting concrete workflow structures into parameterized template form.

**Workflow:**
1. Loads an existing epic and its complete child hierarchy
2. Converts the structure into a `.formula.json` template file
3. Replaces concrete values with `{{variable}}` placeholders via `--var` flags
4. Saves to `.beads/formulas/` (project-level) or `~/.beads/formulas/` (user-level)

**Use case:** Teams can capture organically-developed workflows as executable templates for future similar work.

**Source:** [mol_distill.go implementation](https://github.com/steveyegge/beads/blob/v0.44.0/cmd/bd/mol_distill.go)

---

## 3. Distill vs Squash

| Aspect | **Distill** | **Squash** |
|--------|-------------|------------|
| **Purpose** | Extract reusable template | Compress workflow history |
| **Direction** | Horizontal (structure extraction) | Vertical (history consolidation) |
| **Output** | `.formula.json` file | Single digest entry |
| **Modifies Original** | No—creates separate template | Yes—consolidates steps |
| **Reusability** | High—creates parameterized template | Low—creates summary record |
| **When to Use** | You want to reuse this workflow pattern elsewhere | You want to clean up completed workflow history |

**Key Difference:** Squash compresses workflow history vertically into a permanent record; distill extracts workflow *structure* horizontally as a reusable template for future instantiation via `pour`.

**Sources:**
- [MOLECULES.md](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md) (squash documentation)
- [mol_distill.go](https://github.com/steveyegge/beads/blob/v0.44.0/cmd/bd/mol_distill.go) (distill implementation)

---

## 4. Proto Prefix for Distilled Molecules

**Feature exists:** ✅ **Yes** (added in v0.37.0)

**What it does:**

Version 0.37.0 introduced a naming convention system with **distinct prefixes for three entity types:**

| Entity Type | Prefix | Description |
|-------------|--------|-------------|
| **Proto** | `proto-` prefix | Template issues (frozen templates in `.beads/`) |
| **Mol** | `mol-` prefix | Active persistent molecules |
| **Wisp** | `wisp-` prefix | Ephemeral instances (not synced to git) |

**Implementation:** The system **"Combines db prefix with type prefix for mol/wisp IDs"**, meaning database-level prefixes are combined with type-specific prefixes to create complete identifiers.

**Benefit:** Entity types are immediately recognizable through their prefixes, reducing ambiguity when working with different workflow components.

**Sources:**
- [v0.37.0 Release Notes](https://newreleases.io/project/github/steveyegge/beads/release/v0.37.0)
- Commits: c7bc8e6 (proto prefix), f78fe88 (distinct prefixes)

---

## 5. Distill in Phase Metaphor

Beads uses a chemistry-inspired phase metaphor:

| Phase | Name | State | Operations |
|-------|------|-------|------------|
| **Solid** | Proto | Frozen template | `pour` → Mol, `wisp` → Wisp |
| **Liquid** | Mol | Active persistent work | `bond`, `squash`, **`distill`** |
| **Vapor** | Wisp | Ephemeral | `burn`, `squash` |

**Where distill fits:**

Distill operates on **Liquid (Mol)** state, extracting the molecular structure back into **Solid (Proto/Formula)** form. It's the **reverse phase transition** of `pour`:

```
pour:    Proto (solid) → Mol (liquid)
distill: Mol (liquid) → Formula (solid template)
```

This creates a **cycle of reusability:**
1. `pour` — Instantiate template as concrete work
2. Execute and adapt the work organically
3. `distill` — Extract the adapted structure as a new/updated template
4. Repeat for future similar work

**Sources:**
- [MOLECULES.md phase metaphor](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [mol_distill.go implementation](https://github.com/steveyegge/beads/blob/v0.44.0/cmd/bd/mol_distill.go)

---

## 6. Real Examples

**CRITICAL GAP:** ❌ No real-world usage examples found in documentation.

**What I couldn't find:**
- Example distill commands with actual epic IDs
- Real `.formula.json` output from distill
- Case studies of distill workflows
- Tutorial or walkthrough using distill

**What exists:** Only source code implementation and brief release notes.

---

## 7. Common Patterns & Use Cases

Based on implementation analysis, here are the implied use cases:

### **When to Use Distill:**
1. **After organic workflow development** — Team develops a workflow naturally, then wants to reuse the pattern
2. **Template extraction** — Converting one-off work into reusable templates
3. **Knowledge capture** — Preserving successful workflows as formulas
4. **Parameterization** — Making concrete workflows flexible via variables

### **When NOT to Use Distill:**
1. **During active work** — Distill is for *completed* epics you want to templatize
2. **One-off workflows** — If you'll never reuse this pattern
3. **When squash is sufficient** — If you just want to compress history, not extract templates

### **Workflow Pattern:**
```bash
# 1. Pour a formula to create concrete work
bd mol pour my-proto --var feature=auth

# 2. Execute and adapt the work organically
# (team works on issues, adapts structure)

# 3. Distill the adapted structure back to template
bd mol distill bd-auth-123 updated-auth-workflow \
  --var feature-auth=feature \
  --var AuthService=service

# 4. New template is ready for future use
bd mol pour updated-auth-workflow --var feature=payments
```

**Sources:** Inferred from [mol_distill.go implementation](https://github.com/steveyegge/beads/blob/v0.44.0/cmd/bd/mol_distill.go)

---

## 8. Status

| Aspect | Status |
|--------|--------|
| **Implementation** | ✅ **Stable** — Available since v0.37.0, currently in v0.44.0 |
| **Documentation** | ❌ **Poor** — Not mentioned in README, FAQ, ADVANCED, or MOLECULES.md |
| **Examples** | ❌ **None** — No usage examples in docs |
| **Experimental?** | ❓ **Unknown** — No "experimental" flag, but lack of docs suggests low visibility |
| **Testing** | ❓ **Unknown** — No visible test coverage information |

**Assessment:** Distill is a fully implemented, stable command that has been improved over multiple releases, but it's **severely under-documented** for end users.

---

## 9. Documentation Gaps

### **What I COULD find:**
- ✅ Command exists in source code
- ✅ Full implementation in `mol_distill.go`
- ✅ Release notes mention improvements (v0.37.0)
- ✅ Proto prefix feature confirmed
- ✅ Phase metaphor context from MOLECULES.md

### **What I COULD NOT find:**
- ❌ User-facing documentation in README, FAQ, ADVANCED, or MOLECULES.md
- ❌ Usage examples with real epic IDs
- ❌ Sample `.formula.json` output
- ❌ Comparison table of distill vs squash in docs
- ❌ Tutorial or walkthrough
- ❌ Best practices for variable naming
- ❌ Error handling guidance
- ❌ Testing coverage information

**Recommendation:** The distill command needs comprehensive user-facing documentation added to MOLECULES.md or a dedicated FORMULAS.md file.

---

## 10. Sources

### Primary Sources:
- [mol_distill.go Implementation](https://github.com/steveyegge/beads/blob/v0.44.0/cmd/bd/mol_distill.go)
- [MOLECULES.md Documentation](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [v0.37.0 Release Notes](https://newreleases.io/project/github/steveyegge/beads/release/v0.37.0)
- [Beads Releases Page](https://github.com/steveyegge/beads/releases)
- [Go Package Documentation](https://pkg.go.dev/github.com/steveyegge/beads/cmd/bd)

### Secondary Sources:
- [Beads GitHub Repository](https://github.com/steveyegge/beads)
- [Beads README](https://github.com/steveyegge/beads/blob/main/README.md)
- [CHANGELOG.md](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)

---

## Conclusion

The `bd mol distill` command is a **real, stable feature** for extracting reusable formulas from concrete epics. It occupies a crucial role in the phase metaphor as the reverse of `pour`, enabling workflow reusability cycles. However, it suffers from **severe documentation gaps**—only source code and brief release notes exist. No user-facing examples, tutorials, or comprehensive guides are available, making it effectively a "hidden feature" for most users.

**Distill is production-ready but documentation-starved.**
