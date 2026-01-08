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

**Phase 6 Done When:**
- [ ] All types compile
- [ ] Dataset loads from JSON
- [ ] Assertions evaluate against artifact
- [ ] 25+ tests passing

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

**Phase 7 Done When:**
- [ ] Engine runs a case
- [ ] Engine runs a matrix (cases × variants)
- [ ] recording:linked events emitted
- [ ] Deterministic replay works
- [ ] 35+ tests passing

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

**Phase 8 Done When:**
- [ ] Real dataset exists in repo
- [ ] CI runs eval in replay mode
- [ ] User docs complete
- [ ] Release announcement ready

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
