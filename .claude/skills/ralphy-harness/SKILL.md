---
name: ralphy-harness
description: |
  Open Harness specific Ralphy workflow with ADR-driven task generation.
  Creates PRDs linked to technical debt inventory, generates constitution
  from CLAUDE.md rules, and produces tasks.yaml for single-agent execution.

  USE WHEN user says 'ralphy', 'run ralphy', 'create prd', 'generate tasks',
  'implement ADRs', 'tech debt tasks', 'run task list', or wants to execute
  the open-harness technical debt cleanup autonomously.
---

# Ralphy Harness Skill

Project-specific Ralphy workflow for Open Harness technical debt resolution.

## Quick Start

```bash
# Already initialized - run tasks
ralphy --yaml .ralphy/tasks.yaml

# Or generate fresh tasks from PRD
/ralphy-harness:tasks
```

## Project Context

This project has:
- **13 ADRs** in `docs/plans/adr/`
- **Technical debt inventory** tracking 96 issues (65 resolved, 31 remaining)
- **Constitution** derived from CLAUDE.md rules
- **Config** set for single-agent, no-worktree execution

## Commands

| Command | Description |
|---------|-------------|
| `/ralphy-harness:tasks` | Generate tasks.yaml from PRD with ADR links |
| `/ralphy-harness:validate` | Validate tasks against constitution |
| `/ralphy-harness:run` | Execute with `ralphy --yaml .ralphy/tasks.yaml` |

## Execution Mode

Per `.ralphy/config.yaml`:
```yaml
ralphy:
  worktrees: false      # Single agent, no worktrees
  parallel: false       # Sequential execution
  max_parallel: 1       # One task at a time
  branch_per_task: true # Each task gets a branch
  create_pr: true       # Create PRs for review
```

**Run command:**
```bash
ralphy --yaml .ralphy/tasks.yaml --no-parallel
```

## Key Files

| File | Purpose |
|------|---------|
| `.ralphy/config.yaml` | Project settings, ADR rules encoded |
| `.ralphy/constitution.md` | MUST/SHOULD rules with grep patterns |
| `.ralphy/PRD.md` | Links to ADRs, lists 31 remaining issues |
| `.ralphy/tasks.yaml` | Generated task list (flat format) |

## Constitution Rules (from CLAUDE.md)

### MUST Rules (Block on Violation)

1. **No mocks/stubs** - Use real implementations with `:memory:`
2. **No API key checks** - Subscription handles auth
3. **No build artifacts in src/** - Use `pnpm build` → `dist/`
4. **Use ProviderRecorder** - For all provider testing
5. **Follow ADR decisions** - No ProviderRegistry, events are source of truth

### SHOULD Rules (Warn Only)

1. Use Data.TaggedClass for events (ADR-004)
2. Use Match.exhaustive for dispatch (ADR-004)
3. Agent owns provider directly (ADR-010)
4. Three-tier hook architecture (ADR-013)

## Task Format

Each task must have:

```yaml
- title: "1.1: [Clear action] (ADR-0XX)"
  completed: false
  parallel_group: 1
  adr: "ADR-004"  # Source ADR
  details: |
    ## What
    [Specific change to make]

    ## Files
    - path/to/file.ts

    ## Context
    Per ADR-004: [relevant decision text]
  acceptance:
    - "Criterion 1 - verifiable"
    - "Criterion 2 - verifiable"
  verify:
    - command: "pnpm typecheck"
      expect: "No errors"
    - command: "pnpm test"
      expect: "All pass"
```

## ADR Reference

| ADR | Key Decision | Constraint |
|-----|--------------|------------|
| 001 | Single `run()` API | No execute(), streamWorkflow() |
| 002 | Inline human on phase | Delete Interaction.ts |
| 003 | `/internal` entrypoints | Route handlers internal |
| 004 | PubSub + TaggedClass | Match.exhaustive dispatch |
| 005 | Effect Schema | No JSON.parse casts |
| 006 | Event sourcing | State derived, not stored |
| 010 | Agent owns provider | No ProviderRegistry |
| 013 | React Query + 3-tier | Grouped hooks |

## Remaining Issues (31)

**By Category:**
- Architecture: 6 (ARCH-002, 014-017, 022)
- Tests: 14 (TEST-001-011, 014-016)
- Documentation: 4 (DOC-001, 002, 004, 006)
- Dead Code: 3 (DEAD-007, 008, 012)
- Types: 3 (TYPE-002, 007, 008)
- API: 1 (API-012)

## References

For full details:
- `references/task-generation-rules.md` - How to decompose ADRs into tasks
- `.ralphy/constitution.md` - All MUST/SHOULD rules
- `.ralphy/PRD.md` - Full PRD with issue mappings
- `docs/plans/adr/technical-debt-inventory.md` - Issue tracker
