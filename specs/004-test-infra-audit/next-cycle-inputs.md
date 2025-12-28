# Next Cycle Inputs

**Source**: Retrospective decisions from 004-test-infra-audit
**Generated**: 2025-12-26
**Pattern**: static-validation-insufficient (recurring from 003)

---

## Executive Summary

The 004-test-infra-audit retrospective identified that oharnes.implement verification agents validated static properties but not runtime behavior. This is a **recurring pattern** from 003-harness-renderer.

**Core Insight**: Agents should provide high-signal contextualized output, not raw data dumps. The scout should be a "Context Curator" that extracts WHY/WHAT/HOW, and verification should be smart (context-aware) not dumb (run all tests).

---

## Decisions to Implement

### 1. Enhance Verifier with Behavioral Verification (P0)

**Root Cause**: RC001 - Verifier checked existence, not behavior

**File**: `.claude/agents/oharnes.implement-verifier.md`

**Implementation**:
- Add Step 6 "Behavioral Verification" to workflow
- For test files: execute `timeout 30s bun run test {test_path}`
- Grep unit tests for API patterns that indicate wrong categorization:
  - `createRecordingContainer`
  - `fetch(`
  - `ANTHROPIC_API_KEY`
- Return `behavioral_checks` field in output with results
- Mark verification failed if behavioral checks fail

**Acceptance Criteria**:
- [ ] Verifier executes tests for test-related tasks
- [ ] Verifier greps for API patterns in unit tests
- [ ] False positives eliminated (misclassified test would be caught)

---

### 2. Transform Scout into Context Curator (P0)

**Root Cause**: RC002 - Scout validated location, not categorization

**File**: `.claude/agents/oharnes.implement-scout.md` (significant rewrite)

**Implementation**:
Transform scout output from:
```
Files to read:
- src/services/user.ts
- tests/unit/user.test.ts
```

To:
```markdown
## Context Manifest for T005

### Why These Files
- `src/services/user.ts:15-28`: UserService interface you MUST extend
- `tests/unit/user.test.ts:10-35`: Pattern for unit test structure

### Key Interfaces (copy-paste ready)
\`\`\`typescript
// src/services/user.ts:15-28
interface UserService {
  getUser(id: string): Promise<User>;
}
\`\`\`

### Patterns to Follow
- DI pattern at user.ts:5 (constructor injection)
- Validation at user.ts:30 (always validateInput before save)

### Categorization Warnings
- ⚠️ tests/unit/parser.test.ts imports createRecordingContainer - SHOULD BE integration test
```

**Key Principle**: Scout reduces cognitive load by extracting:
1. **WHY** files matter (relevance framing)
2. **WHAT** to look at (line numbers, interfaces)
3. **HOW** to use them (patterns, anti-patterns)
4. **WARNINGS** for categorization mismatches

**Acceptance Criteria**:
- [ ] Scout output includes line numbers for each file
- [ ] Scout output includes at least 1 interface/pattern per file
- [ ] Scout flags categorization mismatches (e.g., API calls in unit/)
- [ ] Implementer can work from scout output without reading full files

---

### 3. Create Verification Designer Agent (P0)

**Root Cause**: RC003 - No behavioral verification gate

**File**: `.claude/agents/oharnes.implement-verification-designer.md` (new)

**Implementation**:
Create smart verification agent that:
1. Reads spec.md to understand what's being built
2. Assesses risk and complexity of the feature
3. Designs appropriate verification strategy:
   - High-risk API: unit + integration + smoke test
   - Documentation: link validation + render check
   - Infra/config: smoke test + rollback test
   - Low-risk: quick sanity check
4. Outputs verification plan with:
   - `verification_type`: comprehensive | standard | minimal
   - `commands_to_run`: specific test commands with timeouts
   - `checks`: recordings unchanged, no network calls, etc.
   - `new_tests_needed`: if existing tests insufficient

**Example Output**:
```markdown
## Verification Design for 004-test-infra-audit

### Risk Assessment
- Complexity: HIGH (test infrastructure affects all tests)
- Blast radius: HIGH (breaks tests = blocks all work)
- Verification level: COMPREHENSIVE

### Verification Plan
1. Unit tests: `timeout 5s bun run test:unit`
2. Smoke test: `timeout 30s bun run test` exits 0
3. Behavioral check: recordings/ unchanged after safe test run
4. Manual review: TESTING.md documentation quality

### Verification Not Needed
- E2E tests: no E2E for test infrastructure
```

**Folded Issues**:
- RC005 (recording protection): Designer checks recordings/ unchanged
- RC006 (timeout discipline): Designer specifies timeouts by category

**Acceptance Criteria**:
- [ ] Designer reads spec and determines risk level
- [ ] Designer outputs appropriate verification for feature type
- [ ] Designer specifies timeouts based on test category
- [ ] Designer checks recordings/ unchanged for safe test runs

---

### 4. Document Bun CLI Patterns (P1)

**Root Cause**: RC004 - Bun CLI dual-mode confusion

**File**: `.specify/memory/constitution.md`

**Implementation**:
Add section:

```markdown
## Tool Patterns

### Bun CLI Dual Modes

Bun has two distinct test execution modes:

| Command | Behavior |
|---------|----------|
| `bun test` | Built-in test runner. **Ignores package.json scripts.** |
| `bun run test` | npm script runner. **Executes package.json "test" script.** |

**When to use each**:
- Use `bun run test` when package.json scripts configure test behavior (paths, preloads, filters)
- Use `bun test` only for quick ad-hoc test runs where you specify paths directly

**Common mistake**: Running `bun test` expecting it to respect package.json configuration. It won't.
```

**Acceptance Criteria**:
- [ ] Constitution documents `bun test` vs `bun run test` distinction
- [ ] Clear guidance on when to use each

---

## Implementation Sequence

1. **RC002 (Scout → Context Curator)**: Do first - provides better context for all subsequent work
2. **RC001 (Verifier behavioral checks)**: Add behavioral verification to per-task checks
3. **RC003 (Verification Designer)**: Create smart phase-level gate
4. **RC004 (Bun docs)**: Quick documentation update

---

## Suggested Spec Additions for Future Features

When creating future feature specs, consider including:

### 1. Verification Strategy Section
```markdown
## Verification Strategy

Risk: HIGH | MEDIUM | LOW
Blast radius: What breaks if this fails?

Required Verification:
- [ ] Unit tests pass
- [ ] No recording modifications
- [ ] Documentation renders
```

### 2. Context Hints for Scout
```markdown
## Implementation Context

Key files to understand:
- `src/core/agent.ts:50-100` - Agent base class
- `src/types/events.ts` - Event type definitions

Patterns to follow:
- Dependency injection in constructors
- Error wrapping with ServiceError
```

---

## Success Metrics

After implementing these decisions:

| Metric | Before | After |
|--------|--------|-------|
| False positive rate | 100% (verifier passed wrong categorization) | 0% |
| Time to discovery | Post-implementation | Per-task (immediate) |
| Scout output value | Low (file list) | High (contextualized guidance) |
| Verification appropriateness | None (no gate) | Context-aware per feature |

---

**Generated by**: /oharnes.close
**Date**: 2025-12-26
