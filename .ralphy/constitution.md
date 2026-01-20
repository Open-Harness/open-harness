# Project Constitution: Effect Workflow System (core-v2)

Machine-checkable rules for Ralphy task validation. MUST rules block execution, SHOULD rules warn.

> Based on `.specify/memory/constitution.md` - Open Harness Core Principles

---

## MUST Rules (Critical - Block on Violation)

### MUST-001: Event-Based Architecture

All state changes MUST flow through immutable events. Events are typed facts about what happened.

**Grep patterns that indicate violation:**
- `state\s*=`
- `state\..*\s*=`
- `mutate`
- `Object\.assign.*state`
- `\.push\(`
- `\.pop\(`
- `\.splice\(`

**Why this matters:**
Event sourcing requires immutability. Direct state mutation breaks time-travel debugging and deterministic replay.

---

### MUST-002: Pure Handlers

Handlers MUST be pure functions with no side effects. They receive (event, state) and return { state, events[] }.

**Grep patterns that indicate violation:**
- `fetch\(`
- `axios`
- `http\.`
- `fs\.(read|write)`
- `console\.(log|error|warn)`
- `Math\.random`
- `Date\.now`
- `new Date\(\)`
- `setTimeout`
- `setInterval`

**Why this matters:**
Handler purity enables deterministic replay. Same inputs must always produce same outputs.

---

### MUST-003: Effect Stays Internal

Effect types MUST NOT appear in public API exports. Consumers see Promises and plain objects.

**Grep patterns that indicate violation in index.ts:**
- `export.*Effect`
- `export.*Layer`
- `export.*Context\.Tag`
- `export.*Stream`
- `export.*Exit`
- `export.*Cause`
- `export.*Fiber`

**Why this matters:**
Clean DX is essential for adoption. Consumers should not need to learn Effect to use the library.

---

### MUST-004: Explicit Verification Commands

Tasks MUST include specific, runnable verification commands.

**Grep patterns that indicate violation:**
- `verify it works`
- `check that.*works`
- `make sure.*correct`
- `ensure.*properly`
- `test manually`

**Why this matters:**
Vague verification leads to incomplete testing. Every task needs a provable command.

---

### MUST-005: No Mock Fixtures for Integration

Integration tests MUST NOT use fabricated fixtures. All fixtures MUST come from real SDK/system interactions.

**Grep patterns that indicate violation:**
- `mock harness`
- `mock.*fixture`
- `fake.*fixture`
- `stub.*response`
- `fabricated.*data`
- `manually.*created.*fixture`

**Why this matters:**
Mock-based integration tests prove nothing about real system behavior. They mask bugs that only appear with real SDK responses.

---

### MUST-006: No Console Output

Production code MUST NOT use console.log/error/warn. Use Effect logger or structured output functions.

**Grep patterns that indicate violation:**
- `console\.log`
- `console\.error`
- `console\.warn`
- `console\.debug`
- `console\.info`

**Why this matters:**
Structured output is queryable, testable, and maintainable. Raw console calls create noise and indicate sloppy design.

---

### MUST-007: Structured Output Required for Agents

All agents MUST have an `outputSchema` defined using Zod. This is not optional.

**Grep patterns that indicate violation:**
- `outputSchema\?\s*:`
- `outputSchema:\s*undefined`
- `agent\({[^}]*}\)`

**Why this matters:**
Structured output ensures workflow state updates are predictable and type-safe. Handler logic can rely on known output shapes.

---

### MUST-008: No Rationalization Language

Tasks MUST NOT contain language that rationalizes rule violations.

**Grep patterns that indicate violation:**
- `That's OK for`
- `acceptable.*mock`
- `just for testing`
- `temporarily`
- `will fix later`
- `good enough for now`
- `we can skip`
- `not needed for now`

**Why this matters:**
If you know it's wrong, don't do it. Rationalization indicates awareness of violation.

---

## SHOULD Rules (Medium - Warn Only)

### SHOULD-001: Reference Source Documentation

Tasks SHOULD reference the original spec documents where applicable.

**Good:**
```yaml
details: |
  Per spec.md FR-028: Tape MUST provide rewind()
```

**Bad:**
```yaml
details: |
  Add a rewind function
```

---

### SHOULD-002: Include Context

Tasks SHOULD include a CONTEXT section explaining why the task exists.

---

### SHOULD-003: Atomic Tasks

Tasks SHOULD be atomic - completable in one focused session.

**Indicators of non-atomic:**
- Tasks with more than 10 steps
- Tasks spanning multiple systems
- Tasks requiring multiple agent calls

---

### SHOULD-004: Clear Success Criteria

Tasks SHOULD define explicit success criteria beyond "it works."

**Good:**
```yaml
verify:
  - command: "bun run typecheck"
    expect: "Zero errors"
  - command: "bun test src/tape/Tape.test.ts"
    expect: "All tests pass"
```

**Bad:**
```yaml
verify:
  - command: "bun test"
    expect: "It works"
```

---

### SHOULD-005: Cross-Reference Spec Requirements

Tasks SHOULD link to specific FR-XXX requirements from spec.md.

**Good:**
```yaml
title: "3.3: Implement stepBack() (FR-030)"
```

---

### SHOULD-006: Group Related Tasks

Tasks in the same logical unit SHOULD share `parallel_group` numbers.

---

## Project-Specific Rules

### MUST-009: Branch from dev

All feature work MUST branch from `dev`, not `master`.

**Why this matters:**
`master` is the stable production branch. Branching from `master` causes severe merge conflicts.

---

### MUST-010: Beads Sync Before Session End

ALWAYS run `bd sync` before ending any session. Unpushed beads changes cause problems for other agents.

**Grep patterns that indicate violation:**
- `skip.*sync`
- `no need.*sync`

---

### MUST-011: Claude Code Auth Only

NEVER set or look for `ANTHROPIC_API_KEY`. Use Claude Code subscription auth.

**Grep patterns that indicate violation:**
- `ANTHROPIC_API_KEY`
- `process\.env\.ANTHROPIC`
- `apiKey`

---

## Changelog

- 2026-01-21: Initial constitution from Speckit constitution adapted for 001-effect-refactor
