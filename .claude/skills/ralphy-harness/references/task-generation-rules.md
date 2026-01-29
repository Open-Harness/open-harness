# Task Generation Rules

Rules for decomposing ADRs and technical debt into Ralphy tasks.

## Core Principles

### 1. Each Task Must Be Atomic

A task is atomic if:
- It can be completed in one focused session
- It has a single clear outcome
- It doesn't require decisions during execution

**Too big:**
```yaml
- title: "Implement ADR-004 event system"  # Multiple files, multiple concepts
```

**Right size:**
```yaml
- title: "1.1: Create WorkflowEvent union type with Data.TaggedClass (ADR-004)"
- title: "1.2: Implement EventHub service with PubSub (ADR-004)"
- title: "1.3: Add Match.exhaustive dispatch in runtime (ADR-004)"
```

### 2. Each Task Must Have Acceptance Criteria

Acceptance criteria must be:
- **Verifiable** - Can be checked programmatically or visually
- **Specific** - No ambiguity about what "done" means
- **Complete** - All aspects of the task covered

**Bad criteria:**
```yaml
acceptance:
  - "Events work correctly"
  - "Tests pass"
```

**Good criteria:**
```yaml
acceptance:
  - "WorkflowEvent is a discriminated union with _tag field"
  - "All 26 event types extend Data.TaggedClass"
  - "TypeScript compiles without errors"
  - "Existing tests still pass"
```

### 3. Each Task Must Have Verification Commands

Verification commands must:
- Be runnable without manual intervention
- Have clear expected output
- Cover the acceptance criteria

```yaml
verify:
  - command: "pnpm typecheck"
    expect: "No errors"
  - command: "grep -r 'Data.TaggedClass' packages/core/src/Engine/types.ts"
    expect: "Multiple matches"
  - command: "pnpm test packages/core"
    expect: "All tests pass"
```

### 4. Reference Source ADR

Every implementation task must reference its source ADR:

```yaml
- title: "1.1: Create WorkflowEvent union (ADR-004)"
  adr: "ADR-004"
  details: |
    Per ADR-004 "Decision" section:
    > Use Data.TaggedClass for all event definitions with _tag discriminator

    Implementation:
    1. Import Data from effect
    2. Define each event as class extending Data.TaggedClass
    3. Create WorkflowEvent union type
```

## Task Categories

### Implementation Tasks

For ADR implementation:

```yaml
- title: "X.Y: [Verb] [what] in [where] (ADR-0XX)"
  details: |
    ## What
    [Specific code change]

    ## Why
    Per ADR-0XX: [quote relevant decision]

    ## Files
    - packages/core/src/Engine/types.ts

    ## Steps
    1. [Step 1]
    2. [Step 2]
  acceptance:
    - "[Verifiable criterion 1]"
    - "[Verifiable criterion 2]"
  verify:
    - command: "[check command]"
      expect: "[expected output]"
```

### Test Tasks

For test coverage issues:

```yaml
- title: "7.X: Add tests for [component] (TEST-00X)"
  issue: "TEST-001"
  details: |
    ## What
    Add unit tests for SSE parsing functions

    ## Coverage Required
    - parseSSEMessage normal case
    - parseSSEMessage edge cases (empty, malformed)
    - createSSEStream integration

    ## Test Pattern
    Use real implementations with :memory: databases (per CLAUDE.md)
  acceptance:
    - "parseSSEMessage has 3+ test cases"
    - "createSSEStream has integration test"
    - "No mocks or stubs used"
  verify:
    - command: "pnpm test packages/client --coverage"
      expect: "SSE.ts > 80% coverage"
```

### Cleanup Tasks

For dead code removal:

```yaml
- title: "8.X: Delete [unused code] (DEAD-00X)"
  issue: "DEAD-007"
  details: |
    ## What
    Delete unused Logger layer exports

    ## Files to Modify
    - packages/core/src/Layers/Logger.ts (delete)
    - packages/core/src/Layers/index.ts (remove exports)

    ## Verification
    No imports of deleted items exist
  acceptance:
    - "Logger.ts deleted"
    - "No dangling imports"
    - "Build succeeds"
  verify:
    - command: "! test -f packages/core/src/Layers/Logger.ts"
      expect: "File does not exist"
    - command: "pnpm build"
      expect: "Build succeeds"
```

### Documentation Tasks

For documentation issues:

```yaml
- title: "8.X: Document [topic] (DOC-00X)"
  issue: "DOC-001"
  details: |
    ## What
    Add execution API decision matrix to docs

    ## Content
    - When to use run()
    - Observer callback patterns
    - Error handling approach

    ## Location
    docs/api/execution.md
  acceptance:
    - "Decision matrix table exists"
    - "All options documented"
    - "Examples provided"
  verify:
    - command: "test -f docs/api/execution.md"
      expect: "File exists"
    - command: "grep -c '|' docs/api/execution.md"
      expect: "> 5 (has table)"
```

## Phase Organization

Group tasks by dependency and logical order:

```yaml
# Phase 1: Foundation (no dependencies)
parallel_group: 1

# Phase 2: Depends on Phase 1
parallel_group: 2

# Phase 3: Depends on Phase 2
parallel_group: 3
```

**For Open Harness:**

| Phase | Focus | ADRs | parallel_group |
|-------|-------|------|----------------|
| 1 | Event System | ADR-004 | 1 |
| 2 | State Sourcing | ADR-006 | 2 |
| 3 | Type Safety | ADR-005 | 3 |
| 4 | API Consolidation | ADR-001, 003 | 4 |
| 5 | Provider/HITL | ADR-002, 010 | 5 |
| 6 | React Hooks | ADR-013 | 6 |
| 7 | Test Coverage | TEST-* | 7 |
| 8 | Cleanup | DEAD-*, DOC-* | 8 |

## Validation Checklist

Before finalizing tasks.yaml:

- [ ] Every task has `title`, `completed`, `details`
- [ ] Every task has `acceptance` with verifiable criteria
- [ ] Every task has `verify` with runnable commands
- [ ] Implementation tasks reference source ADR
- [ ] Issue tasks reference issue ID
- [ ] Tasks are atomic (single outcome)
- [ ] No mocks/stubs mentioned in any task
- [ ] Phase order respects dependencies

## Anti-Patterns to Avoid

### Over-Engineering

❌ **Bad:**
```yaml
- title: "Create comprehensive event system with full type safety"
  details: |
    Build the entire event system including...
    [500 words of requirements]
```

✅ **Good:**
```yaml
- title: "1.1: Define AgentStarted event class (ADR-004)"
- title: "1.2: Define AgentCompleted event class (ADR-004)"
- title: "1.3: Create WorkflowEvent union type (ADR-004)"
```

### Vague Acceptance

❌ **Bad:**
```yaml
acceptance:
  - "Code is clean"
  - "Tests are good"
```

✅ **Good:**
```yaml
acceptance:
  - "ESLint passes with no errors"
  - "Test coverage > 80%"
  - "No any types in new code"
```

### Missing Context

❌ **Bad:**
```yaml
details: "Implement the event system"
```

✅ **Good:**
```yaml
details: |
  Per ADR-004 section "Event Definition":
  > Each event uses Data.TaggedClass with _tag discriminator

  File: packages/core/src/Engine/types.ts

  Steps:
  1. Import { Data } from "effect"
  2. Create class AgentStarted extends Data.TaggedClass("AgentStarted")
  3. Define payload shape in class body
```
