# Phase 7 Handoff Prompt

**Date:** 2026-01-08
**Status:** Phase 6-7 complete, Phase 8-9 ready to start
**Branch:** `v0.2.0/stabilization`

---

## Context for Next Agent

You are continuing work on the Open Harness v0.2.0 eval system. Phases 6 and 7 are complete. Your task is to implement Phase 8 (DX layer + fixtures) and Phase 9 (DX audit).

## Canonical Documents (READ THESE FIRST)

| Document | Purpose | Priority |
|----------|---------|----------|
| `docs/internal/milestones/v0.2.0/VERSION_PLAN.md` | Master release plan, scope, and criteria | **READ FIRST** |
| `docs/internal/milestones/v0.2.0/EVAL_COMPLETION_PLAN.md` | Detailed eval implementation plan with exact files | **READ SECOND** |
| `docs/internal/milestones/v0.2.0/DX_AUDIT_CHECKLIST.md` | 5-dimension DX audit criteria (Phase 9) | Reference |
| `packages/internal/core/src/eval/README.md` | Implementation-level documentation | Reference |
| `apps/docs/content/0.2.0/03-patterns/evals-pattern.md` | User-facing pattern doc (must match final API) | Reference |

## What's Done

### Phase 6: Core Types ✅
- `types.ts` - EvalDataset, EvalCase, EvalVariant, Assertion, Score, etc.
- `dataset.ts` - loadDataset(), validateDataset()
- `assertions.ts` - evaluateAssertions(), metric extraction
- `scorers/*` - latency, cost, tokens, similarity, llm-judge
- `cache.ts` - Judge cache interface

### Phase 7: Engine ✅
- `engine.ts` - createEvalEngine()
- `runner.ts` - runCase(), runDataset(), runMatrix()
- `compare.ts` - compareToBaseline() with configurable thresholds
- `report.ts` - generateReport() (Markdown + JSON)
- `hooks.ts` - EvalHooks interface + helpers

### Tests ✅
- 121 tests passing across eval modules
- All quality gates pass (typecheck, lint, test)

## What's Next

### Phase 8: DX Layer + Fixtures

**8.0 DX Layer (NEW FILES TO CREATE)**

```
packages/internal/core/src/eval/
  dx-types.ts    # SuiteConfig, VariantDef, Gate types
  dx.ts          # defineSuite, variant, gates, runSuite

packages/internal/core/tests/eval/
  dx.test.ts     # DX layer tests
```

The DX layer provides ergonomic API on top of Phase 7 primitives:

```typescript
import { defineSuite, variant, gates, runSuite } from "@open-harness/core";

const suite = defineSuite({
  flow: myWorkflow,
  cases: [
    { id: "test-1", input: { task: "..." }, assertions: [...] },
  ],
  variants: [
    variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" }),
    variant("claude/opus", { model: "claude-3-opus-latest" }),
  ],
  baseline: "claude/sonnet",
  gates: [
    gates.noRegressions(),
    gates.passRate(0.9),
    gates.latencyUnder(30000),
    gates.costUnder(1.0),
  ],
});

const report = await runSuite(suite);
```

**Implementation Notes:**
- `defineSuite()` builds `EvalDataset` + `EvalVariant[]` from config
- `runSuite()` wraps `createEvalEngine()` + `engine.runMatrix()` + gate evaluation
- Gates evaluate against `MatrixResult` and produce pass/fail
- ~150-200 lines of convenience code on top of existing primitives

**8.1 Fixtures**

```
packages/open-harness/core/tests/fixtures/evals/
  datasets/
    coder-reviewer.v1.json       # Real dataset (not fabricated)
  goldens/
    recording-eval__*.json       # Recorded from live SDK
    recording-eval__*.jsonl
  provenance/
    *.events.json                # Runtime events with recording:linked
```

**8.2 Scripts**

```
packages/open-harness/core/scripts/
  eval.ts                        # CLI entry point
  record-eval-goldens.ts         # Record fixtures from live SDK
```

**8.3-8.4 Validation + Checklist**

See EVAL_COMPLETION_PLAN.md section 8.3-8.4.

### Phase 9: DX Audit (HARD GATE)

**THIS IS A BLOCKING RELEASE GATE.**

1. Self-audit against `DX_AUDIT_CHECKLIST.md` (50+ items across 5 dimensions)
2. Fresh-eyes test: Someone unfamiliar uses eval with ONLY public docs
3. Documentation sync: `evals-pattern.md` must match implementation
4. Fix all Critical issues, document workarounds for High issues

## Key Constraints

1. **DX is non-negotiable** - Don't ship primitives without ergonomic layer
2. **Fixtures must be REAL** - Record from live SDK, never fabricate
3. **Documentation must match code** - All examples must be copy-paste runnable
4. **Fresh-eyes test required** - If someone can't use it from docs, it's not ready

## Package Structure Reminder

```
@internal/core          → Implementation (private)
@open-harness/core      → Re-exports @internal/core (published)
```

Eval lives in `@internal/core/src/eval/` and is exported via `@open-harness/core`.

## Commands

```bash
# From repo root
bun run typecheck    # Type check
bun run lint         # Lint
bun run test         # Run tests

# From packages/internal/core
bun test             # Run core tests only (faster iteration)
```

## Recent Commits (for context)

```
d4185f4 docs: add Phase 8 DX layer and Phase 9 DX audit to eval plan
aa6cde4 feat(eval): add configurable comparison thresholds
c959061 feat(eval): phase 7 complete - engine, runner, compare, report
10d2ada docs: add Phase 6 handoff prompt
0c452aa feat(eval): phase 6 complete - types, dataset, assertions, scorers
```

## Start Here

1. Read `VERSION_PLAN.md` for overall context
2. Read `EVAL_COMPLETION_PLAN.md` Phase 8 section for exact files
3. Implement `dx-types.ts` and `dx.ts`
4. Write tests in `dx.test.ts`
5. Run quality gates
6. Proceed to fixtures (8.1) and scripts (8.2)
7. After Phase 8, run DX audit (Phase 9)

## Questions to Ask If Unclear

- What workflow should the `coder-reviewer.v1` dataset test?
- Who will do the fresh-eyes test for Phase 9?
- Are there specific gate thresholds that should be defaults?

---

*Generated by Phase 7 agent on 2026-01-08*
