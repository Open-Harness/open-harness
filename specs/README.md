---
title: "Specifications"
description: "Feature specifications and design documents"
---

# Specifications

This directory contains feature specifications and design documents for Open Harness.

## Contents

| Directory | Description |
|-----------|-------------|
| `backlog/` | Backlog items and cycle planning |
| `f2-reactive-agent/` | Reactive agent feature spec |
| `p0-6-signal-native-eval/` | Signal-native evaluation spec |
| `v030-landing/` | v0.3.0 release landing page spec |

| File | Description |
|------|-------------|
| `reactive-state-plan.md` | Reactive state system design |

## Specification Format

Each feature spec follows the SpecKit format:

```
specs/<feature-name>/
├── spec.md       # Feature specification
├── plan.md       # Implementation plan (optional)
├── tasks.md      # Task breakdown (optional)
└── README.md     # Spec overview
```

## Workflow

1. **Specify** - Define requirements in `spec.md`
2. **Plan** - Break down into implementation plan
3. **Task** - Create actionable tasks
4. **Implement** - Build the feature
5. **Verify** - Validate against spec

## Commands

Use oharnes commands for spec workflow:

```bash
# Create or update spec
/oharnes.specify

# Generate implementation plan
/oharnes.plan

# Generate tasks
/oharnes.tasks

# Run implementation
/oharnes.implement
```

## Backlog

The `backlog/` directory contains:

- Cycle planning documents
- Feature candidates
- Technical debt items
- Retrospective inputs

## See Also

- [`research/`](../research/README.md) - Technical explorations
- [`docs/internal/`](../docs/internal/README.md) - Architecture decisions
- [`.claude/commands/`](../.claude/README.md) - oharnes commands
