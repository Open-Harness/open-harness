# v0.2.0 RESCUE MAP

**Branch:** `v0.2.0/stabilization`
**Created:** 2026-01-08
**Purpose:** Single source of truth for landing v0.2.0

---

## 🗺️ YOU ARE HERE

```
v0.2.0 Progress
═══════════════════════════════════════════════════════════════════

INFRASTRUCTURE (Done)
├── Provider Trait ✅ ████████████████████████████████ 100%
├── Recording System ✅ ████████████████████████████████ 100%
├── Runtime Engine ✅ ████████████████████████████████ 100%
├── State Management ✅ ████████████████████████████████ 100%
└── Store Adapters ✅ ████████████████████████████████ 100%

EVAL SYSTEM (Not Started)
├── Phase 6: Types ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
├── Phase 7: Engine ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
└── Phase 8: Fixtures ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%

DOCUMENTATION (Partial)
├── User Docs Structure ✅ ████████████████████████████████ 100%
├── User Docs Content ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░ ~25%
└── Internal Docs ✅ ████████████████████████████████ 100%

RELEASE PREP (Not Started)
├── Release Announcement ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
├── Codebase Audit ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
└── Final Testing ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%

═══════════════════════════════════════════════════════════════════
OVERALL: ████████████░░░░░░░░░░░░░░░░░░░░ ~35% complete
```

---

## 📁 WHAT EXISTS RIGHT NOW

### Code (128 source files, 33 tests)

| Directory | Status | Description |
|-----------|--------|-------------|
| `packages/internal/core/src/providers/` | ✅ Done | ProviderTrait, adapter, context, events |
| `packages/internal/core/src/recording/` | ✅ Done | withRecording, stores, types |
| `packages/internal/core/src/runtime/` | ✅ Done | Compiler, executor, expressions |
| `packages/internal/core/src/state/` | ✅ Done | Snapshot, events, cancellation |
| `packages/stores/recording-store/` | ✅ Done | File, SQLite, testing adapters |
| `packages/stores/run-store/` | ✅ Done | SQLite, testing adapters |
| `packages/internal/core/src/eval/` | ❌ Missing | **THE MAIN WORK** |

### Documentation

| Location | Files | Status |
|----------|-------|--------|
| `apps/docs/content/0.2.0/` | 15 | Structure done, content partial |
| `docs/internal/milestones/v0.2.0/` | 4 | VERSION_PLAN, EVAL_COMPLETION_PLAN, etc. |
| `docs/internal/decisions/` | 2 | PROVIDER_ARCHITECTURE, CLEAN_BREAK_PLAN |
| `docs/internal/templates/` | 1 | VERSION_PLAN_TEMPLATE |
| `docs/internal/archive/` | 8 | Historical planning docs |

---

## 📋 COMPLETE TASK LIST

### Phase 6: Eval Types (Week 1)
**Create:** `packages/internal/core/src/eval/`

| Task | File | Lines Est. | Status |
|------|------|-----------|--------|
| 6.1 | `types.ts` | ~200 | ⬜ |
| 6.2 | `dataset.ts` | ~100 | ⬜ |
| 6.3 | `assertions.ts` | ~150 | ⬜ |
| 6.4 | `cache.ts` | ~50 | ⬜ |
| 6.5 | `scorers/index.ts` | ~30 | ⬜ |
| 6.6 | `scorers/latency.ts` | ~30 | ⬜ |
| 6.7 | `scorers/cost.ts` | ~30 | ⬜ |
| 6.8 | `scorers/tokens.ts` | ~30 | ⬜ |
| 6.9 | `scorers/similarity.ts` | ~50 | ⬜ |
| 6.10 | `scorers/llm-judge.ts` | ~80 | ⬜ |
| 6.11 | `index.ts` | ~20 | ⬜ |
| 6.12 | `README.md` | ~100 | ⬜ |
| 6.13 | Add `recording:linked` to state/events.ts | ~20 | ⬜ |

**Tests:** `packages/internal/core/tests/eval/`

| Task | File | Status |
|------|------|--------|
| 6.T1 | `types.test.ts` | ⬜ |
| 6.T2 | `dataset.test.ts` | ⬜ |
| 6.T3 | `assertions.test.ts` | ⬜ |
| 6.T4 | `scorers.test.ts` | ⬜ |

---

### 🚧 PHASE 6 QUALITY GATE

**Gate Command (must pass before Phase 7):**
```bash
bun run typecheck && bun run lint && bun run test
```

**Mandatory Quality Checks:**
- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun run test` — 0 failures, no regressions vs baseline

**Meaningful Test Requirements (what tests MUST prove):**

| Test | What It Proves | Why It Matters |
|------|----------------|----------------|
| Load valid dataset JSON | `loadDataset()` parses real JSON without throwing | Can't run evals without loading datasets |
| Reject invalid dataset | Missing required fields throw ValidationError | Catch malformed datasets before runtime |
| Assertion: output.contains | Path resolution finds nested values in artifact | Core assertion logic works |
| Assertion: output.equals | Equality comparison handles edge cases (null, undefined, nested) | Assertions don't silently pass |
| Assertion: metric.latency_ms.max | Extracts latency from agent:complete events | Metric assertions work |
| Assertion: behavior.no_errors | Detects errors in nodeErrors map | Error detection works |
| Scorer: latency returns Score | Pure function input → Score output | Scorers are composable |
| Scorer: cost returns Score | Extracts cost from events | Cost tracking works |
| recording:linked event type | Event compiles and can be emitted | Hybrid model glue exists |

**Phase 6 Exit Criteria (ALL must be true):**
- [ ] Quality gate command passes
- [ ] At least 20 tests covering the cases above
- [ ] Can load a test dataset fixture (committed to repo)
- [ ] Can evaluate assertions against a mock artifact
- [ ] recording:linked event type exists in state/events.ts

**Phase 6 Commit Message Template:**
```
feat(eval): phase 6 complete - types, dataset, assertions, scorers

Quality gate: typecheck ✓ lint ✓ tests ✓ (X tests, 0 failures)

- EvalDataset, EvalCase, EvalVariant, EvalArtifact types
- loadDataset() with validation
- evaluateAssertions() with path resolution
- Scorers: latency, cost, tokens, similarity, llm-judge (stub)
- recording:linked event type added

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Phase 7: Eval Engine (Week 2-3)
**Create:** Additional files in `packages/internal/core/src/eval/`

| Task | File | Lines Est. | Status |
|------|------|-----------|--------|
| 7.1 | `engine.ts` | ~200 | ⬜ |
| 7.2 | `runner.ts` | ~300 | ⬜ |
| 7.3 | `compare.ts` | ~100 | ⬜ |
| 7.4 | `report.ts` | ~150 | ⬜ |
| 7.5 | `hooks.ts` | ~80 | ⬜ |

**Tests:**

| Task | File | Status |
|------|------|--------|
| 7.T1 | `runner.test.ts` | ⬜ |
| 7.T2 | `compare.test.ts` | ⬜ |
| 7.T3 | `report.test.ts` | ⬜ |
| 7.T4 | `packages/open-harness/core/tests/eval/eval-matrix.test.ts` | ⬜ |

---

### 🚧 PHASE 7 QUALITY GATE

**Gate Command (must pass before Phase 8):**
```bash
bun run typecheck && bun run lint && bun run test
```

**Mandatory Quality Checks:**
- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun run test` — 0 failures, no regressions vs Phase 6 baseline

**Meaningful Test Requirements (what tests MUST prove):**

| Test | What It Proves | Why It Matters |
|------|----------------|----------------|
| runCase() executes and returns result | End-to-end case execution works | Core runner functionality |
| runCase() emits recording:linked events | Provider calls are indexed | Hybrid model actually works |
| runMatrix() handles multiple variants | Variant switching works | Can compare providers |
| Deterministic replay test | Same input → same output (run twice, diff results) | Replay is trustworthy |
| compare() finds assertion failures | Baseline comparison detects regressions | CI can catch regressions |
| compare() finds metric regressions | Budget comparison works (latency > max) | Performance tracking works |
| report() generates valid Markdown | Report is human-readable | Results are usable |
| report() generates valid JSON | Report is machine-readable | Automation possible |

**Determinism Verification Test (REQUIRED):**
```typescript
test('deterministic replay', async () => {
  const result1 = await engine.runCase({ dataset, caseId, variant, mode: 'replay' });
  const result2 = await engine.runCase({ dataset, caseId, variant, mode: 'replay' });

  // Must be identical - if not, replay is broken
  expect(result1.assertions).toEqual(result2.assertions);
  expect(result1.metrics).toEqual(result2.metrics);
});
```

**Phase 7 Exit Criteria (ALL must be true):**
- [ ] Quality gate command passes
- [ ] At least 15 new tests (35+ total)
- [ ] Determinism test passes
- [ ] Engine runs against a test fixture (not fabricated - real runtime events)
- [ ] recording:linked events appear in event stream
- [ ] Comparison identifies at least one intentional regression in test

**Phase 7 Commit Message Template:**
```
feat(eval): phase 7 complete - engine, runner, compare, report

Quality gate: typecheck ✓ lint ✓ tests ✓ (X tests, 0 failures)

- createEvalEngine() with full API
- runCase(), runDataset(), runMatrix()
- Deterministic replay verified
- Baseline comparison with regression detection
- Markdown + JSON report generation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Phase 8: Fixtures & Landing (Week 4)

| Task | Description | Status |
|------|-------------|--------|
| 8.1 | Create dataset: `coder-reviewer.v1.json` | ⬜ |
| 8.2 | Create fixture directory structure | ⬜ |
| 8.3 | Record goldens (live SDK, one-time) | ⬜ |
| 8.4 | Capture provenance fixtures | ⬜ |
| 8.5 | Create `scripts/eval.ts` | ⬜ |
| 8.6 | Create `scripts/record-eval-goldens.ts` | ⬜ |
| 8.7 | Update `apps/docs/content/0.2.0/03-patterns/evals-pattern.md` | ⬜ |
| 8.8 | Write release announcement draft | ⬜ |
| 8.9 | Run codebase health audit | ⬜ |
| 8.10 | Final test run, verify CI | ⬜ |

---

### 🚧 PHASE 8 QUALITY GATE (RELEASE GATE)

**Gate Command (must pass before release):**
```bash
bun run typecheck && bun run lint && bun run test
```

**Mandatory Quality Checks:**
- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun run test` — 0 failures, no regressions vs Phase 7 baseline

**Meaningful Test/Verification Requirements:**

| Verification | What It Proves | Why It Matters |
|--------------|----------------|----------------|
| Real dataset committed | `coder-reviewer.v1.json` exists with 2+ cases | Not fabricated test data |
| Golden recordings committed | `goldens/recording-eval__*.json` files exist | Replay has real data |
| Provenance fixtures committed | `provenance/*.events.json` with recording:linked | Hybrid index works |
| CI eval runs in replay mode | `bun run eval --mode replay` passes | Automated regression detection |
| Docs example compiles | Code blocks in evals-pattern.md are valid TS | Docs aren't stale |
| No stale API references | Grep for old type names returns empty | Docs match code |

**Documentation Verification (REQUIRED):**
```bash
# Verify evals-pattern.md code examples are valid
grep -E "```(typescript|ts)" apps/docs/content/0.2.0/03-patterns/evals-pattern.md

# Verify no references to old/removed types
grep -rE "(OldTypeName|DeprecatedType)" apps/docs/content/0.2.0/
# Should return empty
```

**Phase 8 Exit Criteria (ALL must be true):**
- [ ] Quality gate command passes
- [ ] Real dataset with 2+ cases committed
- [ ] Golden recordings from live SDK committed
- [ ] Provenance fixtures with recording:linked events committed
- [ ] `scripts/eval.ts` runs successfully in replay mode
- [ ] `apps/docs/content/0.2.0/03-patterns/evals-pattern.md` matches implementation
- [ ] Release announcement draft exists
- [ ] Codebase health audit complete (findings documented)

**Phase 8 / Release Commit Message Template:**
```
feat(eval): phase 8 complete - fixtures, scripts, docs - v0.2.0 ready

Quality gate: typecheck ✓ lint ✓ tests ✓ (X tests, 0 failures)

- Real dataset: coder-reviewer.v1.json (N cases)
- Golden recordings from live SDK
- Provenance fixtures with recording:linked
- scripts/eval.ts and record-eval-goldens.ts
- Documentation updated to match implementation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## 📚 DOCUMENT MAP

```
docs/internal/
├── README.md                              ← How to use docs/internal/
│
├── milestones/v0.2.0/
│   ├── RESCUE_MAP.md                      ← YOU ARE HERE
│   ├── VERSION_PLAN.md                    ← Vision, scope, release criteria
│   ├── EVAL_COMPLETION_PLAN.md            ← Detailed eval implementation spec
│   └── EVAL_HISTORY_SUMMARY.md            ← Why hybrid model was chosen
│
├── decisions/
│   ├── PROVIDER_ARCHITECTURE.md           ← Provider design decisions
│   └── PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md ← Phases 1-5 (done)
│
├── templates/
│   └── VERSION_PLAN_TEMPLATE.md           ← Copy this for v0.3.0
│
└── archive/                               ← Historical (not canonical)
    └── (neverthrow planning, old exploration docs)

apps/docs/content/0.2.0/                   ← User-facing documentation
├── 01-foundations/                        ← Philosophy, zen
├── 02-architecture/                       ← Architecture, providers, telemetry
├── 03-patterns/                           ← Evals, skills, scripts
├── 04-getting-started/                    ← Quickstart, vision, why
└── 05-reference/                          ← Getting started, contributing
```

---

## 🚀 CRITICAL PATH

```
TODAY
  │
  ▼
┌─────────────────┐
│ Phase 6: Types  │ ← START HERE
│ (1 week)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 7: Engine │
│ (1.5 weeks)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 8: Land   │
│ (1-2 weeks)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   v0.2.0 SHIP   │
└─────────────────┘
```

**Timeline:** ~4 weeks total

---

## ✅ RELEASE CRITERIA

**v0.2.0 ships when ALL checked:**

### Code
- [ ] Eval phases 6-8 complete
- [ ] At least one real dataset in CI (replay mode)
- [ ] Deterministic replay proven
- [ ] All tests green

### Docs
- [ ] `apps/docs/content/0.2.0/` complete
- [ ] Evals pattern doc matches implementation

### Release
- [ ] Release announcement ready
- [ ] CHANGELOG updated
- [ ] PR from dev → master ready

---

## 🔧 QUICK COMMANDS

```bash
# Check build status
bun run typecheck
bun run lint
bun run test

# View current branch
git branch --show-current

# Push to remote
git push -u origin v0.2.0/stabilization
```

---

## 📞 NEXT ACTION

**Start Phase 6:** Create `packages/internal/core/src/eval/types.ts`

See `EVAL_COMPLETION_PLAN.md` for detailed type definitions.
