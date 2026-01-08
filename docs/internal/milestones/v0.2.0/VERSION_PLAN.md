# v0.2.0 Version Plan

**Status:** Recovery Mode — Retroactive planning after experimentation
**Branch:** `feat/provider-trait-recording-eval`
**Target:** Land v0.2.0 with eval system, documentation, and codebase health
**Created:** 2026-01-08
**Last Updated:** 2026-01-08

---

## Vision & User Narrative

**What is v0.2.0 to users?**

Open Harness v0.2.0 is the **"production-ready foundations"** release. It transforms the framework from "interesting experiment" to "you can actually build with this":

1. **Provider Abstraction** — Your workflows work on Claude, OpenCode, or Codex without code changes.
2. **Recording & Replay** — Every provider call is recorded. Replay is deterministic. No more "it worked on my machine."
3. **Built-In Evaluations** — Not just "run a workflow" but "measure if it's better." Datasets, variants, baselines, reports.

The key insight: **Complexity lives in the framework, simplicity lives in your code.** You define skills, scripts, and evals. The framework handles orchestration, state, recording, and scaling.

**One-sentence pitch:** "v0.2.0 lets you build agent systems you can test, measure, and trust."

---

## Scope

### In Scope (Release Blockers)

| Area | Description | Status |
|------|-------------|--------|
| **Eval System** | Phases 6-8 from EVAL_COMPLETION_PLAN.md. Types, engine, fixtures, scripts. | Pending |
| **Documentation** | apps/docs/content/0.2.0/ complete and accurate. User can onboard from docs alone. | Partial |
| **Release Announcement** | "What's new in v0.2.0" content written. Forces clarity on user value. | Not started |
| **Neverthrow (Critical Paths)** | Error handling for eval-related code paths only. Not full 46-bead refactor. | Not started |
| **Codebase Health Audit** | Tech debt check, test coverage review, consistency audit before release. | Not started |
| **Provider Abstraction** | ProviderTrait, adapter model, multi-provider support. | Done ✅ |
| **Recording & Replay** | RecordingStore, withRecording(), file/sqlite adapters. | Done ✅ |
| **Runtime Clean Break** | Phases 1-5 of provider/runtime simplification. | Done ✅ |

### Out of Scope (v0.3.0 or Later)

| Area | Reason |
|------|--------|
| **Full Neverthrow Refactor** | 46 beads, 6 weeks. Too large for v0.2.0. Will be the primary v0.3.0 epic. |
| **Beads Tooling** | Not working properly. Deprecated for now. May revisit in v0.3.0. |
| **OpenPros Integration** | Exciting but requires v0.3.0 planning sprint. See v0.3.0 Preview section. |
| **Production Monitoring** | Eval hooks exist but ops tooling is outside scope. |
| **UI/TUI Dashboard** | No eval report dashboard. Reports are Markdown + JSON for now. |

---

## What's Done

### Phase 1-5: Provider + Runtime Clean Break (Complete ✅)

**Reference:** `docs/internal/decisions/PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md`

- ✅ Removed old inbox/session cruft
- ✅ Simplified NodeRunContext (pure providers with minimal context)
- ✅ Provider trait abstraction (Claude, OpenCode, Codex)
- ✅ Recording infrastructure (withRecording wrapper, stores)
- ✅ Runtime plugs directly into RunStore snapshots
- ✅ Pause/resume is workflow-level, not provider-level

### Recording & Replay Infrastructure (Complete ✅)

**Reference:** `packages/internal/core/src/recording/README.md`

- ✅ Recording<TOutput> type with metadata
- ✅ RecordingStore interface (memory, file, sqlite adapters)
- ✅ withRecording() wrapper for providers
- ✅ Mode support: record, replay, live
- ✅ Deterministic replay when recording exists

### Provider Architecture Decisions (Complete ✅)

**Reference:** `docs/internal/decisions/PROVIDER_ARCHITECTURE.md`

- ✅ Pause/resume is workflow concern, not provider concern
- ✅ Inbox removed entirely (providers are pure functions)
- ✅ Session-based restart works for all providers
- ✅ Clean Runtime API: pause(), resume(), stop()

---

## What's Pending

### Critical Path 1: New DX API (Phase 8 REVISED)

**Reference:** `docs/internal/milestones/v0.2.0/SDK_DX_DECISIONS.md`, `DX_IMPLEMENTATION_RESEARCH.md`

> **NOTE:** Phases 6-7 are COMPLETE. Phase 8 OLD (`defineSuite`, `runSuite`) is OBSOLETE.
> This section describes Phase 8 REVISED: the new public API.

#### Phase 6: Eval Core Types ✅ DONE

All files exist: `types.ts`, `assertions.ts`, `scorers/*`, `dataset.ts`, `cache.ts`

#### Phase 7: Eval Engine ✅ DONE

All files exist: `runner.ts`, `engine.ts`, `compare.ts`, `report.ts`, `hooks.ts`

#### Phase 8 REVISED: New DX API + Vitest Plugin

**Locked Decisions (from SDK_DX_DECISIONS.md + DX_IMPLEMENTATION_RESEARCH.md):**
- `agent()`, `harness()`, `run()` as public API
- Fixtures as `run()` option (not separate concept)
- `FIXTURE_MODE` env var for record/replay/live
- `@open-harness/vitest` plugin for reporter + matchers
- DEPRECATE: `defineSuite()`, `runSuite()`, `variant()`, `gates.*`

**Files to Create:**
```
packages/internal/core/src/api/
├── index.ts              # Re-exports
├── agent.ts              # agent() factory
├── harness.ts            # harness() factory
├── run.ts                # run() unified entry point
├── types.ts              # Agent, Harness, RunOptions, RunResult
└── defaults.ts           # setDefaultStore(), setDefaultMode()

packages/open-harness/vitest/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Main exports
│   ├── plugin.ts         # Vite plugin (minimal)
│   ├── reporter.ts       # Aggregation + gates
│   ├── matchers.ts       # toHaveLatencyUnder, toCostUnder
│   └── setup.ts          # Auto-setup file
```

**Acceptance Criteria:**
- [ ] `agent({ prompt })` creates Agent type
- [ ] `harness({ agents, edges })` creates Harness type
- [ ] `run(agent, input)` executes and returns RunResult
- [ ] `run(agent, input, { fixture: 'name' })` records/replays via existing withRecording
- [ ] `FIXTURE_MODE=record|replay|live` env var controls mode
- [ ] `setDefaultStore()`, `setDefaultMode()` configure defaults
- [ ] Multi-agent fixtures use hierarchical IDs: `<fixture>/<nodeId>/inv<N>`
- [ ] `@open-harness/vitest` package exists and is installable
- [ ] Reporter aggregates results, fails CI if pass rate < threshold
- [ ] Custom matchers work: `expect(result).toHaveLatencyUnder(5000)`
- [ ] Old APIs (`runFlow`, `createHarness`) have deprecation warnings

**Files to Deprecate (add console.warn):**
- `runFlow()` → alias to `run()`
- `createHarness()` → internal only
- `createRuntime()` → internal only

**Files to Remove:**
- `dx.ts`, `dx-types.ts` (or mark as deprecated/internal)

#### Phase 9: DX Audit (HARD GATE)

**Reference:** `docs/internal/milestones/v0.2.0/DX_AUDIT_CHECKLIST.md`

**Purpose:** Systematically verify eval DX before release. This is a **blocking gate**.

**Process:**
1. Self-audit against DX_AUDIT_CHECKLIST.md (5 dimensions)
2. Fresh-eyes test: unfamiliar person uses eval with ONLY public docs
3. Documentation sync: evals-pattern.md matches implementation

**Acceptance Criteria:**
- [ ] All "Critical" DX audit items pass
- [ ] All "High" items pass OR have documented workarounds
- [ ] Fresh-eyes test completes successfully
- [ ] `apps/docs/content/0.2.0/03-patterns/evals-pattern.md` matches `defineSuite()` API
- [ ] No broken examples in documentation

### Critical Path 2: Documentation Completeness

**Location:** `apps/docs/content/0.2.0/`

**Required Sections:**
- [ ] 01-foundations/philosophy.md — Core philosophy, mental model
- [ ] 01-foundations/zen.md — Design principles (the "zen" of Open Harness)
- [ ] 02-architecture/architecture.md — System architecture overview
- [ ] 02-architecture/providers.md — Provider trait, adapters, multi-provider
- [ ] 02-architecture/telemetry.md — Events, observability
- [ ] 03-patterns/evals-pattern.md — **MUST MATCH FINAL IMPLEMENTATION**
- [ ] 03-patterns/skills-pattern.md — Skill authoring
- [ ] 03-patterns/scripts-pattern.md — Script authoring
- [ ] 04-getting-started/quickstart.md — 5-minute onboarding
- [ ] 04-getting-started/vision.md — Where this is going
- [ ] 04-getting-started/what-can-i-build.md — Concrete examples
- [ ] 04-getting-started/why-open-harness.md — Value proposition
- [ ] 05-reference/getting-started.md — API reference entry
- [ ] 05-reference/contributing.md — Contribution guide

**Verification:**
- [ ] All docs compile without errors
- [ ] All code examples in docs actually work
- [ ] No stale references to old APIs
- [ ] Types in docs match types in code

### Critical Path 3: Release Announcement

**Purpose:** Forces clarity on what users get from v0.2.0.

**Content Required:**
- [ ] "What's New" summary (3-5 bullet points)
- [ ] Provider abstraction explanation + example
- [ ] Recording & replay explanation + example
- [ ] Eval system explanation + example
- [ ] Breaking changes (if any)
- [ ] Upgrade path from v0.1.x (if applicable)
- [ ] Links to relevant docs

**Format:** Can be a blog post draft, CHANGELOG entry, or GitHub release notes template.

### Critical Path 4: Neverthrow (Critical Paths Only)

**Scope:** Error handling for eval-related code paths. NOT the full 46-bead refactor.

**Files to Add neverthrow To:**
- [ ] packages/internal/core/src/eval/*.ts (new code, build with neverthrow from start)
- [ ] packages/internal/core/src/recording/*.ts (if errors leak into eval)
- [ ] packages/internal/core/src/runtime/execution/runtime.ts (if errors affect eval execution)

**Acceptance Criteria:**
- [ ] Eval code paths use Result<T, E> pattern
- [ ] Errors are typed (not generic Error)
- [ ] No uncaught throws in eval hot paths
- [ ] Error recovery is documented

### Critical Path 5: Codebase Health Audit

**Purpose:** Ensure the codebase is release-ready, not just feature-ready.

**Audit Checklist:**
- [ ] **Test Coverage:** Run coverage report. Identify gaps in critical paths.
- [ ] **Tech Debt:** List known tech debt items. Decide: fix now or document for v0.3.0.
- [ ] **Consistency:** Naming conventions, export patterns, file structure.
- [ ] **Dead Code:** Remove unused exports, stale files, commented-out code.
- [ ] **Dependencies:** Audit package.json. Remove unused deps. Update stale deps.
- [ ] **Types:** Ensure strict mode passes everywhere. No `any` in public APIs.
- [ ] **READMEs:** Every package has a README that matches current behavior.

**Output:** AUDIT_REPORT.md documenting findings + decisions.

---

## Critical Path Dependency Graph (REVISED)

```
                    ┌─────────────────────────────────┐
                    │         v0.2.0 Release           │
                    └─────────────────────────────────┘
                                    ▲
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │  DX Audit    │         │    Docs     │         │   Release   │
    │  (Phase 9)   │         │   (NEW DX)  │         │Announcement │
    └─────────────┘         └─────────────┘         └─────────────┘
           │                        │                        │
           ▼                        │                        │
    ┌─────────────┐                 │                        │
    │Phase 8 NEW  │◄────────────────┘                        │
    │agent/run/   │                                          │
    │vitest plugin│◄─────────────────────────────────────────┘
    └─────────────┘
           │
           ▼
    ┌─────────────────────────────────────────────────────────┐
    │              FOUNDATIONS (ALL DONE ✅)                   │
    ├─────────────────────────────────────────────────────────┤
    │  Provider/Runtime (1-5) ✅   │   Eval Primitives (6-7) ✅ │
    │  Recording/withRecording ✅  │   Scorers/Assertions ✅    │
    └─────────────────────────────────────────────────────────┘
```

**THE CRITICAL PATH IS NOW PHASE 8 REVISED:**
1. ✅ Foundations done (Provider, Runtime, Recording, Eval primitives)
2. 🔴 **Phase 8 NEW** — `agent()`, `harness()`, `run()`, `@open-harness/vitest`
3. ⏳ Documentation — Update for new DX (depends on Phase 8)
4. ⏳ DX Audit — Verify new DX works (depends on Phase 8 + Docs)
5. ⏳ Release — Announcement, CHANGELOG (depends on all above)

**Sequencing:**
1. **Parallel Track A:** Eval code (Phases 6→7→8) + Neverthrow for eval paths
2. **Parallel Track B:** Documentation completeness + Code-docs sync verification
3. **Parallel Track C:** Codebase health audit
4. **Final:** Release announcement (requires A+B+C context)

---

## Release Criteria

**v0.2.0 ships when ALL of these are true:**

### Code (REVISED for new DX)
- [x] Eval phases 6-7 complete (types, engine, scorers) ✅ DONE
- [ ] Phase 8 NEW complete: `agent()`, `harness()`, `run()` implemented
- [ ] `run()` accepts `{ fixture, mode, store }` options
- [ ] `FIXTURE_MODE` env var controls record/replay/live
- [ ] Multi-agent fixtures use hierarchical IDs
- [ ] `@open-harness/vitest` package exists with reporter + matchers
- [ ] Old APIs deprecated with console.warn: `runFlow()`, `createHarness()`
- [ ] Old Phase 8 (`defineSuite`, `runSuite`) marked deprecated or removed
- [ ] At least one example test using new DX runs in CI
- [ ] Deterministic replay proven: same fixture × 2 = same results
- [ ] All tests green: `bun run test` passes
- [ ] Types clean: `bun run typecheck` passes
- [ ] Lint clean: `bun run lint` passes

### DX Audit (Phase 9 - HARD GATE)
- [ ] All "Critical" items in DX_AUDIT_CHECKLIST.md pass (updated for new DX)
- [ ] Fresh-eyes test: unfamiliar person can create + run test using only public docs
- [ ] No broken code examples in documentation

### Documentation
- [ ] All apps/docs/content/0.2.0/ sections complete
- [ ] 03-patterns/evals-pattern.md matches final implementation
- [ ] All code examples in docs verified working
- [ ] No stale API references

### Quality
- [ ] Codebase health audit complete
- [ ] Tech debt documented (fix or defer decision made)
- [ ] Test coverage gaps identified and addressed (or documented)

### Release
- [ ] Release announcement draft complete
- [ ] CHANGELOG updated
- [ ] Version bumped in package.json files
- [ ] PR from dev → master ready

---

## v0.3.0 Preview

**Purpose:** Capture what we're thinking about for v0.3.0 so it doesn't get lost.

### Likely In Scope
- **Full Neverthrow Refactor** — The 46-bead initiative. Error handling across entire codebase.
- **OpenPros Integration** — How pros compile into provider trait prompts. (See notes2.md)
- **Beads Tooling Revisit** — Evaluate if we want git-native issue tracking. Needs proper setup.
- **Production Monitoring Hooks** — Eval hooks → ops tooling bridge.

### Under Consideration
- **UI/TUI Dashboard** — Eval report visualization
- **Workflow Builder** — Visual flow definition tool
- **Plugin System** — Third-party extensions

### v0.3.0 Planning Process
We will create VERSION_PLAN.md for v0.3.0 BEFORE starting any implementation work. See VERSION_PLAN_TEMPLATE.md.

---

## Retrospective

### What Worked

1. **Experimentation Phase** — Exploring the hybrid eval model, provider abstraction, and recording infrastructure without rigid upfront planning allowed us to discover the right architecture.

2. **EVAL_COMPLETION_PLAN.md Quality** — The feature-level planning document is excellent. Locked decisions, clear file locations, concrete acceptance criteria.

3. **Provider Clean Break** — Phases 1-5 created solid foundations. The provider trait + adapter model is clean and extensible.

4. **Documentation Investment** — Starting apps/docs/content/0.2.0/ early means we have a structure to fill in.

### What Didn't Work

1. **No Version Plan Upfront** — We should have defined "what IS v0.2.0?" before diving into feature work. The scope crept and scattered.

2. **Experimentation Without Capture** — Good ideas got lost in chat/notes instead of captured in version scope.

3. **Beads Premature Adoption** — Tried to use Beads for tracking before it was properly set up. Created confusion, not clarity.

4. **Multiple Initiatives Conflation** — The 46-bead neverthrow work got mixed into v0.2.0 context. Should have been clearly separate.

5. **Context Loss During Interruption** — 4 days with other models + no clear version plan = recovery overhead.

### Process Improvements for v0.3.0

1. **VERSION_PLAN.md First** — Before ANY implementation, create VERSION_PLAN.md with vision, scope, and critical path.

2. **Scope Lock** — Once VERSION_PLAN.md is approved, scope is locked. New ideas go to "v0.4.0 Preview" section.

3. **Simple Tracking** — Use markdown checklists in VERSION_PLAN.md until tooling (Beads) is properly configured.

4. **Regular Checkpoints** — Weekly review of VERSION_PLAN.md progress. Update status, capture blockers.

5. **Handoff Resilience** — VERSION_PLAN.md should be sufficient context for anyone (human or AI) to continue the work.

---

## How to Use This Document

**If you have 10 minutes:** Read "Vision & User Narrative" + "Scope" + "Critical Path Dependency Graph"

**If you have 30 minutes:** Add "What's Pending" sections for the area you're working on

**If you have 2 hours:** Read full document + referenced EVAL_COMPLETION_PLAN.md

**To track progress:** Update the checkbox items in "What's Pending" and "Release Criteria" as you complete work.

**When blocked:** Check the dependency graph. Is there prerequisite work not done?

**For context:** See "What's Done" and "Retrospective" sections.

---

## References

| Document | Purpose |
|----------|---------|
| `docs/internal/milestones/v0.2.0/EVAL_COMPLETION_PLAN.md` | Detailed eval system implementation plan (Phases 6-8) |
| `docs/internal/milestones/v0.2.0/EVAL_HISTORY_SUMMARY.md` | Why we chose the hybrid eval model |
| `docs/internal/decisions/PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md` | Phases 1-5 context (done) |
| `docs/internal/decisions/PROVIDER_ARCHITECTURE.md` | Design decisions for provider model |
| `docs/internal/templates/VERSION_PLAN_TEMPLATE.md` | Template for future version plans |
| `apps/docs/content/0.2.0/` | User-facing documentation |
| `notes2.md` | OpenPros integration notes (v0.3.0 context) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-08 | Initial VERSION_PLAN.md created (retroactive) |
