# Project Constitution

Machine-checkable rules for Ralphy task validation. MUST rules block execution, SHOULD rules warn.

> Project: open-harness
> Created: 2026-01-19

---

## MUST Rules (Critical - Block on Violation)

### MUST-001: No Fabricated Fixtures

Tasks MUST NOT allow fabricated fixtures, mock harnesses, or hand-written fake data.

**Grep patterns that indicate violation:**
- `mock harness`
- `createMockHarness`
- `createSimpleMockHarness`
- `createDeterministicMockHarness`
- `fake.*fixture`
- `fabricated`
- `hand-written.*mock`

**Why this matters:**
Fabricated fixtures prove nothing about real SDK behavior. All fixtures must come from real recordings.

---

### MUST-002: No Rationalization Language

Tasks MUST NOT contain language that rationalizes rule violations.

**Grep patterns that indicate violation:**
- `That's OK for`
- `acceptable.*mock`
- `just for testing`
- `temporarily`
- `will fix later`
- `good enough for now`
- `for now`
- `OK to use mock`
- `fine to use fake`

**Why this matters:**
If you know it's wrong, don't do it. Rationalization indicates awareness of violation.

---

### MUST-003: Real API Required

Tasks involving SDK/API integration MUST run against the real system.

**Grep patterns that indicate violation:**
- `simulate.*api`
- `fake.*server`
- `mock.*endpoint`
- `skip.*real`
- `without.*api`
- `bypass.*network`

**Why this matters:**
Simulated systems hide integration bugs that only appear with real APIs.

---

### MUST-004: Explicit Verification Commands

Tasks MUST include specific, runnable verification commands.

**Grep patterns that indicate violation:**
- `verify it works`
- `check that.*works`
- `make sure.*correct`
- `ensure.*properly`
- `test manually`
- `should work`

**Why this matters:**
Vague verification leads to incomplete testing. Every task needs a provable command.

---

### MUST-005: Factory Pattern for Fixtures

Tasks that create fixtures MUST use a factory pattern loading from real recordings.

**Grep patterns that indicate violation:**
- `manually create.*fixture`
- `hand-write.*fixture`
- `hardcode.*response`
- `inline.*mock`

**Why this matters:**
Factory pattern ensures all fixtures are traceable to real recordings.

---

## SHOULD Rules (Medium - Warn Only)

### SHOULD-001: Reference Source Documentation

Tasks SHOULD reference relevant docs (CLAUDE.md, README, DEFINITION_OF_DONE.md) where applicable.

---

### SHOULD-002: Include Context

Tasks SHOULD include a CONTEXT section explaining why the task exists.

---

### SHOULD-003: Atomic Tasks

Tasks SHOULD be atomic - completable in one focused session.

**Indicators of non-atomic:**
- Tasks with more than 10 steps
- Tasks spanning multiple systems

---

### SHOULD-004: Clear Success Criteria

Tasks SHOULD define explicit success criteria beyond "it works."

**Good:**
```yaml
VERIFY:
- bun test passes with 0 failures
- Recording file exists in database
```

**Bad:**
```yaml
VERIFY:
- It works
- Tests pass
```

---

## Project-Specific Rules

### MUST-006: CLAUDE.md Fixture Rule

Tasks MUST NOT violate the CLAUDE.md rule about fixtures.

**Grep patterns that indicate violation:**
- `fabricate.*fixture`
- `create.*fake.*data`
- `made-up.*data`

**Why this matters:**
CLAUDE.md explicitly states: "You are NOT allowed to fabricate fixtures"

---

## Changelog

- 2026-01-19: Initial constitution for golden recording PRD cycle
