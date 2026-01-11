# P5: v0.3.0 Landing PRD

**Status:** Specification
**Created:** 2026-01-11
**Author:** Claude Opus 4.5

---

## Executive Summary

This is the final cleanup epic before shipping v0.3.0. It addresses accumulated technical debt, restores the clean package structure, defers eval to v0.3.1, and ensures documentation/code quality are production-ready.

**Goals:**
1. Restore clean `adapters/` + `internal/` + `open-harness/` package structure
2. Defer P0-6 Signal-Native Eval to v0.3.1 (we have `@open-harness/vitest` for now)
3. Audit all documentation for consistency and accuracy
4. Verify all examples work
5. Sweep codebase for quality issues (TODOs, incomplete code, lint errors)

---

## Problem Statement

### Package Structure Degradation

The v0.3.0 signals work added packages at the root level, breaking the clean structure:

**What We Have (Mess):**
```
packages/
├── core/                 → @signals/core      ❌ Confusing!
├── signals/              → @signals/bus       ❌ Name mismatch!
├── providers/            → @signals/provider-*
├── internal/             → @internal/*        ✅
├── open-harness/         → @open-harness/*    ✅
├── sdk/                  → Legacy?
└── stores/               → Empty?
```

**What We Want (Clean):**
```
packages/
├── adapters/             # Optional integrations
│   ├── providers/        # LLM provider adapters
│   │   ├── claude/
│   │   └── openai/
│   └── stores/           # Persistence adapters
├── internal/             # Private implementation
│   ├── core/
│   ├── server/
│   └── client/
└── open-harness/         # Published API
    ├── core/             # Absorbs @signals/core
    ├── server/
    ├── client/
    ├── react/
    ├── testing/
    └── vitest/
```

### Eval Scope Creep

P0-6 Signal-Native Eval is a large feature (1500+ line spec) that overlaps significantly with existing `@open-harness/vitest` functionality:

| Feature | @open-harness/vitest | @open-harness/eval |
|---------|---------------------|-------------------|
| Trajectory assertions | `toHaveSignalsInOrder` | `signal.trajectory` |
| Signal contains | `toContainSignal` | `signal.contains` |
| Signal count | `toHaveSignalCount` | `signal.count` |
| Metric assertions | Custom matchers | `metric.*` |

**Decision:** Defer eval to v0.3.1. For v0.3.0, `@open-harness/vitest` provides sufficient testing capabilities.

### Documentation/Code Quality

Multiple agents have worked on v0.3.0. Need a comprehensive sweep to ensure:
- No broken links
- No stale references to deleted code
- No incomplete implementations (TODOs, placeholders)
- No "funny comments" or temporary hacks
- All examples actually run

---

## Deliverables

### W1: Package Structure Cleanup

**Scope:** Restore clean 3-folder structure, eliminate `@signals/*` namespace.

**Tasks:**

1. **Move signals core into open-harness/core**
   - Merge `packages/core/` (@signals/core) into `packages/open-harness/core/`
   - Update all imports from `@signals/core` → `@open-harness/core`
   - Delete `packages/core/`

2. **Move signal bus into internal**
   - Move `packages/signals/` (@signals/bus) → `packages/internal/signals/`
   - Rename package to `@internal/signals`
   - Update all imports

3. **Move providers into adapters**
   - Move `packages/providers/` → `packages/adapters/providers/`
   - Rename packages:
     - `@signals/provider-claude` → `@open-harness/provider-claude`
     - `@signals/provider-openai` → `@open-harness/provider-openai`
   - Update all imports

4. **Clean up root level**
   - Delete empty `packages/stores/` (stores are in `open-harness/stores/`)
   - Evaluate `packages/sdk/` - keep if needed for single-import, else delete

5. **Update workspace configuration**
   - Update `bun.lock`
   - Update turbo.json if needed
   - Update tsconfig paths

**Verification:**
```bash
# Only these folders should exist at packages/ level:
ls packages/
# Expected: adapters/ internal/ open-harness/ (optionally sdk/)

# All imports should resolve
bun run typecheck

# All tests should pass
bun run test
```

---

### W2: Eval Deferral

**Scope:** Move P0-6 to v0.3.1, clean up partial implementation, update docs.

**Tasks:**

1. **Delete @open-harness/eval package**
   - Remove `packages/open-harness/eval/`
   - Remove from workspace configuration

2. **Update roadmap**
   - Mark P0-6 as "Deferred to v0.3.1"
   - Remove from Phase 0 gate requirements
   - Add note explaining deferral rationale

3. **Update documentation references**
   - Remove eval guide placeholder from docs
   - Update any references to `@open-harness/eval`
   - Keep P0-6 spec in `specs/` for future reference

4. **Update CLAUDE.md**
   - Remove eval from active technologies
   - Update package structure section

**Verification:**
- No references to `@open-harness/eval` in codebase (except specs/)
- Docs build without broken links
- Roadmap accurately reflects deferral

---

### W3: Documentation Audit

**Scope:** Verify all documentation is accurate, consistent, and current.

**Tasks:**

1. **Link audit**
   ```bash
   bun run docs:lint-links  # Verify no broken links
   ```

2. **API reference audit**
   - `reference/api/runtime.mdx` - Matches actual API
   - `reference/api/events.mdx` - Signal types are current
   - `reference/types/runtime-event.mdx` - Types are current

3. **Guide accuracy audit**
   - `guides/agents/claude-agent.mdx` - Code examples work
   - `guides/agents/custom-agents.mdx` - Provider examples work
   - `guides/testing/*.mdx` - All test examples run

4. **Concept accuracy audit**
   - `concepts/architecture.mdx` - Reflects actual architecture
   - `concepts/event-system.mdx` - Signal types are current

5. **Tutorial audit**
   - `learn/quickstart.mdx` - Steps actually work
   - `learn/migration.mdx` - Migration steps are correct

6. **Internal docs audit**
   - `docs/internal/milestones/v0.3.0/ROADMAP.md` - Reflects reality
   - `docs/internal/milestones/v0.3.0/ARCHITECTURE.md` - Current

**Verification:**
```bash
bun run docs:build        # Docs site builds
bun run docs:lint-links   # No broken links
```

---

### W4: Examples Audit

**Scope:** Verify all examples run and are up-to-date.

**Tasks:**

1. **Run each example**
   ```bash
   cd examples/simple-reactive && bun run start
   cd examples/trading-agent && bun run start
   cd examples/recording-replay && bun run start
   cd examples/multi-provider && bun run start  # May need API keys
   cd examples/testing-signals && bun run test
   ```

2. **Verify READMEs match code**
   - Code examples in README are current
   - Installation steps work
   - Output matches what README says

3. **Check for stale dependencies**
   - All examples use current package versions
   - No deprecated APIs used

**Verification:**
- All examples run without errors
- All example tests pass

---

### W5: Code Quality Sweep

**Scope:** Find and fix all code quality issues.

**Tasks:**

1. **Type errors**
   ```bash
   bun run typecheck 2>&1 | tee typecheck-report.txt
   ```
   - Fix all errors
   - No `@ts-ignore` or `@ts-expect-error` without explanation

2. **Lint errors**
   ```bash
   bun run lint 2>&1 | tee lint-report.txt
   ```
   - Fix all errors and warnings
   - No eslint-disable without explanation

3. **TODO/FIXME sweep**
   ```bash
   grep -r "TODO\|FIXME\|XXX\|HACK" packages/ --include="*.ts" | tee todo-report.txt
   ```
   - Resolve or convert to GitHub issues
   - Delete stale TODOs

4. **Incomplete implementation sweep**
   ```bash
   grep -r "throw new Error.*not implemented\|NotImplementedError\|// TODO" packages/ --include="*.ts"
   ```
   - Implement or remove dead code

5. **Placeholder detection**
   ```bash
   grep -r "placeholder\|PLACEHOLDER\|stub\|STUB" packages/ --include="*.ts"
   ```
   - Replace with real implementations

6. **"Funny comment" sweep**
   ```bash
   grep -r "wtf\|WTF\|hack\|HACK\|fixme\|FIXME\|xxx\|XXX\|temporary\|TEMPORARY" packages/ --include="*.ts" -i
   ```
   - Clean up or document properly

7. **Dead code detection**
   - Functions never called
   - Exports never imported
   - Run `bun run lint` with unused detection

8. **Console.log sweep**
   ```bash
   grep -r "console\.\(log\|error\|warn\|debug\)" packages/ --include="*.ts"
   ```
   - Replace with proper logging or remove

**Verification:**
```bash
bun run typecheck  # Zero errors
bun run lint       # Zero errors, minimal warnings
bun run test       # All tests pass
```

---

## Implementation Order

```
W1: Package Structure → W2: Eval Deferral → W3: Docs Audit → W4: Examples Audit → W5: Code Quality
     (blocking)              (blocking)          (parallel)        (parallel)         (last)
```

**Why this order:**
1. Package structure changes affect imports everywhere - do first
2. Eval deferral removes code and doc references - do second
3. Docs/Examples audits can run in parallel after structure is stable
4. Code quality sweep is comprehensive final pass

---

## Success Criteria

### Must Have (Release Blockers)

- [ ] Package structure is clean (3 folders only)
- [ ] No `@signals/*` namespace (all `@open-harness/*` or `@internal/*`)
- [ ] `@open-harness/eval` removed (deferred to v0.3.1)
- [ ] Zero type errors
- [ ] Zero lint errors
- [ ] All tests pass
- [ ] Docs build successfully
- [ ] No broken links in docs
- [ ] All examples run

### Should Have

- [ ] No TODOs without linked issue
- [ ] No console.log in production code
- [ ] All READMEs accurate

### Nice to Have

- [ ] Bundle size verification
- [ ] Performance benchmarks

---

## Risks

1. **Import path changes break things**
   - Mitigation: Comprehensive typecheck and test after each change

2. **Hidden dependencies on deleted eval code**
   - Mitigation: Search for all imports before deletion

3. **Examples rely on removed APIs**
   - Mitigation: Run each example, verify against README

---

## Appendix: Package Rename Map

| Current | New | Notes |
|---------|-----|-------|
| `packages/core` | DELETE | Merge into `open-harness/core` |
| `packages/signals` | `packages/internal/signals` | Rename to `@internal/signals` |
| `packages/providers/claude` | `packages/adapters/providers/claude` | Rename to `@open-harness/provider-claude` |
| `packages/providers/openai` | `packages/adapters/providers/openai` | Rename to `@open-harness/provider-openai` |
| `packages/stores` | DELETE | Empty folder |
| `packages/sdk` | EVALUATE | Keep for single-import or delete |
| `packages/open-harness/eval` | DELETE | Defer to v0.3.1 |

---

## Appendix: Quality Check Commands

```bash
# Full quality gate
bun run typecheck && bun run lint && bun run test && bun run docs:build

# Find TODOs
grep -rn "TODO\|FIXME\|XXX" packages/ --include="*.ts" | wc -l

# Find incomplete implementations
grep -rn "not implemented\|NotImplemented" packages/ --include="*.ts"

# Find console statements
grep -rn "console\." packages/ --include="*.ts" | grep -v "test\|spec"

# Find ts-ignore
grep -rn "@ts-ignore\|@ts-expect-error" packages/ --include="*.ts"

# Link check
bun run docs:lint-links
```
