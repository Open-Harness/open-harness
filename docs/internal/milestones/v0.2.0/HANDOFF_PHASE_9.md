# Phase 9 Handoff Prompt

**Date:** 2026-01-08
**Status:** Phase 8 complete, Phase 9 (DX Audit) ready to start
**Branch:** `v0.2.0/stabilization`

---

## Context for Next Agent

You are continuing work on the Open Harness v0.2.0 eval system. Phases 6-8 are complete. Your task is to:

1. **Audit** the eval system DX against the checklist
2. **Fix** any Critical/High issues found
3. **Document** issues that won't be fixed
4. **Verify** documentation matches implementation

## Canonical Documents (READ THESE FIRST)

| Document | Purpose | Priority |
|----------|---------|----------|
| `docs/internal/milestones/v0.2.0/VERSION_PLAN.md` | Master release plan, scope, and criteria | **READ FIRST** |
| `docs/internal/milestones/v0.2.0/DX_AUDIT_CHECKLIST.md` | The audit checklist you're executing | **READ SECOND** |
| `packages/internal/core/src/eval/README.md` | Eval system implementation docs | **Reference** |
| `apps/starter-kit/README.md` | Working example with CLI | **Reference** |

## What's Done

### Phase 6-7: Core Types + Engine ✅
- All eval primitives implemented and tested
- 161+ tests passing

### Phase 8.0: DX Layer ✅
- `defineSuite()`, `variant()`, `gates.*`, `runSuite()` implemented
- 40 comprehensive tests

### Phase 8.1-8.2: Fixtures + Scripts ✅
- `apps/starter-kit/` created with working example
- `bun run eval` CLI working (tested with live Claude API)
- `bun run record` CLI working
- End-to-end flow validated:
  - baseline: 100% pass rate
  - candidate: 67% pass rate
  - Regression/improvement detection working
  - Metrics captured: latency, cost, tokens

## What's Next: DX Audit (Phase 9)

### This is a HARD GATE

v0.2.0 **does not ship** until this audit passes.

### The 5 Dimensions to Audit

| Dimension | Focus | Critical Items |
|-----------|-------|----------------|
| **1. API Ergonomics** | Is the happy path obvious? | Suite in <10 lines, single function to run |
| **2. Progressive Disclosure** | Start simple, add complexity? | Minimal example in <20 lines |
| **3. Documentation Completeness** | Every export documented? | All examples runnable |
| **4. Consistency Check** | Similar things work similarly? | Patterns reused |
| **5. First-Run Experience** | 0→working in 15 min? | Fresh-eyes test |

### Severity Levels

- **Critical**: Blocks release. Must fix.
- **High**: Should fix. If not fixed, requires documented workaround.
- **Medium**: Nice to fix. Document if not fixing.
- **Low**: Polish. Fix if time permits.

## Your Task: Execute the Audit

### Step 1: Self-Audit (1-2 hours)

Go through each item in `DX_AUDIT_CHECKLIST.md` and mark pass/fail:

1. Read the eval README and starter-kit README
2. Try the examples in the docs
3. Check type definitions for completeness
4. Verify error messages are helpful
5. Note any issues found

### Step 2: Fix Critical/High Issues

For each Critical or High issue that fails:
1. Determine if it can be fixed quickly
2. If yes, fix it
3. If no, document a workaround

### Step 3: Documentation Sync

Verify `apps/docs/content/0.2.0/03-patterns/evals-pattern.md`:
1. Does it exist?
2. Does it match the actual `defineSuite()` API?
3. Are all examples runnable?

If it doesn't exist or is wrong, create/update it.

### Step 4: Fresh-Eyes Test (Simulated)

Since you're the auditor, simulate a fresh-eyes test:
1. Pretend you've never seen the code
2. Use ONLY the public docs (README files)
3. Try to:
   - Create a simple dataset (2-3 cases)
   - Define 2 variants
   - Run the suite
   - Understand the report output
4. Record confusion points

### Step 5: Write Audit Summary

Create `docs/internal/milestones/v0.2.0/DX_AUDIT_RESULTS.md` with:

```markdown
## DX Audit Summary

**Date:** 2026-01-08
**Auditor:** [Agent]

### Results by Dimension

| Dimension | Critical | High | Medium | Low | Pass? |
|-----------|----------|------|--------|-----|-------|
| 1. API Ergonomics | X/4 | X/4 | X/4 | - | Y/N |
| 2. Progressive Disclosure | X/2 | X/4 | X/2 | - | Y/N |
| 3. Doc Completeness | X/4 | X/4 | X/4 | - | Y/N |
| 4. Consistency | - | X/4 | X/4 | - | Y/N |
| 5. First-Run Experience | X/4 | X/2 | - | - | Y/N |

### Blocking Issues (must fix before release)
[list]

### Documented Workarounds
[list]

### Deferred to v0.3.0
[list]

### Fresh-Eyes Test Results
- Time to complete: XX minutes
- Confusion points: [list]
- Suggestions: [list]

### Release Recommendation
[ ] PASS - Ready to ship
[ ] CONDITIONAL PASS - Ship after fixing [list]
[ ] FAIL - Must address [list] before shipping
```

## Key Files to Check

### API Surface (Dimension 1, 4)
```
packages/internal/core/src/eval/
├── dx.ts           # defineSuite, variant, gates, runSuite
├── dx-types.ts     # SuiteConfig, VariantDef, Gate types
├── types.ts        # Core types (Dataset, Assertion, etc.)
└── index.ts        # Public exports
```

### Documentation (Dimension 3)
```
packages/internal/core/src/eval/README.md     # Implementation docs
apps/starter-kit/README.md                    # Usage docs
apps/starter-kit/EXAMPLE_SPEC.md              # Design doc
apps/docs/content/0.2.0/03-patterns/          # User-facing docs (may not exist)
```

### Examples (Dimension 2, 5)
```
apps/starter-kit/src/
├── workflows/simple-coder.ts      # Workflow factory example
├── evals/prompt-comparison.ts     # Suite definition example
├── evals/run.ts                   # CLI runner
└── evals/record.ts                # Fixture recording
```

## Definition of Done (Phase 9)

- [ ] All Critical items in DX_AUDIT_CHECKLIST.md pass
- [ ] All High items pass OR have documented workarounds
- [ ] `evals-pattern.md` exists and matches implementation
- [ ] All code examples in docs verified working
- [ ] DX_AUDIT_RESULTS.md written with release recommendation
- [ ] No broken examples in documentation

## Commands

```bash
# From repo root
bun run typecheck
bun run lint
bun run test

# From apps/starter-kit
bun run eval --help
bun run eval --mode live --cases add-numbers
bun run record --help
```

## Known Issues from Phase 8

1. **maxTurns default**: Had to change from 1 to 10 because Agent SDK uses tools even for simple tasks
2. **Cost variance**: The "candidate" prompt sometimes costs more due to different model routing
3. **Fizzbuzz flakiness**: The "candidate" variant failed fizzbuzz in one run (67% pass rate vs 100% baseline)

These are not bugs - they demonstrate the eval system working correctly (detecting regressions).

## Questions to Resolve

1. **evals-pattern.md**: Does this doc exist? If not, should we create it?
2. **Public package exports**: Is `@open-harness/core` exporting the eval APIs correctly?
3. **CI integration**: Should we add the eval to CI in replay mode?

---

*Generated by Phase 8 agent on 2026-01-08*
