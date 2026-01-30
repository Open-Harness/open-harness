# ADR-Aware Ralphy Workflow

This reference documents the workflow for using Ralphy with Architecture Decision Records (ADRs).

## Overview

When a project has ADRs, Ralphy should:
1. Read the technical debt inventory
2. Link PRD tasks to specific ADR decisions
3. Validate that tasks don't violate ADR constraints
4. Generate tasks that implement ADR specifications

## Workflow

### Step 1: Discover ADRs

```bash
# Find ADR directory
find . -name "*.md" -path "*/adr/*" | head -20

# Find technical debt inventory
find . -name "technical-debt-inventory.md" -o -name "tech-debt*.md"
```

### Step 2: Extract ADR Decisions

For each ADR, extract:
- **Status**: Proposed, Accepted, Implemented, Superseded
- **Issues Resolved**: List of issue IDs
- **Key Decisions**: What must be implemented
- **Constraints**: What must NOT be done

### Step 3: Build PRD with ADR Links

PRD structure for ADR-driven projects:

```markdown
# PRD: [Feature/Cleanup Name]

## Canonical Sources

### Accepted ADRs
| ADR | Title | Key Changes |
|-----|-------|-------------|
| [ADR-001](path) | Name | Changes |

### Issues to Resolve
| ID | Issue | ADR |
|----|-------|-----|
| ARCH-001 | Description | ADR-004 |

## Implementation Phases

### Phase N: [ADR-0XX Implementation]
- Read ADR-0XX for full specification
- Tasks derived from ADR decisions
- Verify against ADR constraints
```

### Step 4: Generate Constitution from ADRs

Extract MUST/SHOULD rules from ADRs:

```markdown
## MUST Rules

### MUST-001: [From ADR-0XX]
[Decision that must be followed]

**Grep patterns that indicate violation:**
- `pattern from ADR "what NOT to do" section`
```

### Step 5: Task Generation

Each task should:
1. Reference its source ADR
2. Include acceptance criteria from ADR
3. Have verification commands
4. Be atomic and testable

```yaml
tasks:
  - title: "1.1: Implement Data.TaggedClass events (ADR-004)"
    completed: false
    parallel_group: 1
    adr: "ADR-004"
    details: |
      Per ADR-004 section "Decision":
      - Use Data.TaggedClass for event definitions
      - Include _tag discriminator
      - Create WorkflowEvent union type

      Files to modify:
      - packages/core/src/Engine/types.ts
    verify:
      - command: "bun run typecheck"
        expect: "No errors"
    acceptance:
      - "All events use Data.TaggedClass"
      - "WorkflowEvent union includes all event types"
      - "Match.exhaustive compiles without errors"
```

## Validation Integration

### Pre-Generation Validation

Before generating tasks, validate PRD against constitution:

```bash
# Check PRD doesn't mention forbidden patterns
grep -E "mock|stub|fake" PRD.md && echo "VIOLATION: PRD mentions mocks"

# Verify ADR references exist
for adr in $(grep -oE "ADR-[0-9]+" PRD.md | sort -u); do
  ls docs/plans/adr/*${adr}*.md || echo "MISSING: $adr"
done
```

### Post-Generation Validation

After generating tasks.yaml:

```bash
# Run constitution validator
~/.claude/skills/ralphy/scripts/validate.sh \
  .ralphy/tasks.yaml \
  .ralphy/constitution.md
```

## ADR Compliance Checklist

For each task, verify:

- [ ] Task references source ADR
- [ ] Implementation matches ADR "Decision" section
- [ ] No violations of ADR "What NOT to do" section
- [ ] Acceptance criteria derived from ADR
- [ ] Verification commands test ADR compliance

## Example: Effect-TS Project

For projects using Effect-TS with ADRs:

### Typical ADR-Derived Rules

```markdown
## MUST Rules

### MUST: Use Effect Schema at Boundaries (ADR-005)
**Violation patterns:**
- `JSON.parse.*as`
- `as unknown as`
- `response.json() as`

### MUST: Events Are Source of Truth (ADR-006)
**Violation patterns:**
- `mutate.*then.*emit`
- `state.*before.*event`

### MUST: Agent Owns Provider (ADR-010)
**Violation patterns:**
- `ProviderRegistry`
- `getProvider`
```

### Task Phases from ADRs

```yaml
# Phase 1: Event System (ADR-004)
# Phase 2: State Sourcing (ADR-006)
# Phase 3: Type Safety (ADR-005)
# Phase 4: API Consolidation (ADR-001, ADR-003)
# Phase 5: Provider Model (ADR-010)
```

## Integration with Technical Debt Inventory

If project has `technical-debt-inventory.md`:

1. Read inventory for remaining issues
2. Map issues to ADRs (from "Issues Resolved" column)
3. Generate tasks for unresolved issues
4. Track completion in inventory

```bash
# Count resolved vs remaining
grep -c "✅ \*\*Resolved\*\*" technical-debt-inventory.md
grep -c "Needs Investigation" technical-debt-inventory.md
```
