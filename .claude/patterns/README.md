---
title: "Anti-Patterns Registry"
description: "Historical patterns learned from retrospectives"
---

# Anti-Patterns Registry

Central registry of known anti-patterns learned from retrospectives. This is part of the oharnes historical awareness system.

## Purpose

Agents don't learn from their mistakes by default. This registry captures patterns that caused failures so future implementations avoid repeating them.

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Retrospective  │────▶│  oharnes.close   │────▶│ anti-patterns   │
│  identifies     │     │  crystallizes    │     │ .yaml updated   │
│  root cause     │     │  decision        │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Scout reads     │◀────│  Next           │
                        │  registry        │     │  implementation │
                        └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Includes        │
                        │  "Historical     │
                        │  Warnings" in    │
                        │  context         │
                        └──────────────────┘
```

## Registry Structure

### `anti-patterns.yaml`

```yaml
# Metadata
last_updated: "2025-12-26"
source_retros: [...]

# Grep-able patterns with context
code_patterns:
  - pattern: "regex pattern"
    context: "where it's a problem (e.g., tests/unit/**)"
    issue: "what's wrong"
    recommendation: "what to do instead"
    severity: critical|high|medium
    source: "which retrospective"

# Non-grep-able systemic issues
structural_patterns:
  - name: "pattern-name"
    description: "what it is"
    detection: "how to spot it"
    mitigation: "how to prevent it"
    source: "which retrospective"

# High-risk file locations
problem_paths:
  - glob: "file pattern"
    risk: critical|high|medium
    note: "why it's risky"
    check: "what to verify"
```

## Consumers

### Scout (Context Curator)
- Reads registry in **Step 5: Load Historical Patterns**
- Includes relevant patterns in "Historical Warnings" section
- Flags problem_paths that match task targets

### Verifier
- Reads registry for code_patterns to grep
- Uses patterns instead of hard-coded list
- References registry in behavioral verification

## Maintenance

### Automatic (via oharnes.close)
When `oharnes.close` crystallizes a retrospective decision:
1. Reads `decisions.yaml` for new patterns
2. Appends to appropriate section in `anti-patterns.yaml`
3. Updates `source_retros` list
4. Bumps `last_updated`

### Manual
To add a pattern manually:
1. Identify root cause from retrospective
2. Determine if grep-able (code_pattern) or structural
3. Add with source reference
4. Update `last_updated`

## Design Decisions

### Why Static File vs. Dynamic Lookup?

| Approach | Pros | Cons |
|----------|------|------|
| **Static registry** (chosen) | Fast, explicit, version-controlled | Manual maintenance |
| Dynamic retro scanning | Always fresh | Slower, may find noise |

We chose static because:
- Retrospectives produce **curated** patterns (not raw dumps)
- Registry is reviewable and auditable
- Single file read is fast
- Version control tracks changes

### Why YAML?

- Human-readable for manual edits
- Structured for programmatic access
- Comments for context
- Widely supported

## Example Usage

Scout output with historical awareness:
```markdown
### Historical Warnings
_From `.claude/patterns/anti-patterns.yaml`_

- **static-validation-only**: Don't just check files exist - verify runtime behavior
- **Problem path**: `tests/unit/**` - frequently misclassified in past cycles
```

Verifier output with git history:
```yaml
git_history_checks:
  - file: "tests/unit/parser.test.ts"
    in_recent_fixes: true
    fix_commits:
      - "abc123 fix: parser test categorization"
    scrutiny: elevated
```

## Related Files

- `.claude/agents/oharnes.implement-scout.md` - Reads registry, outputs warnings
- `.claude/agents/oharnes.implement-verifier.md` - Uses patterns + git check
- `.claude/commands/oharnes.close.md` - Updates registry after retros
