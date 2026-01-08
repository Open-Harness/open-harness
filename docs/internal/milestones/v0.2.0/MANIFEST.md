# v0.2.0 Release Manifest

**Status:** Implementation Phase
**Last Updated:** 2026-01-08
**Branch:** `v0.2.0/stabilization`

---

## Current State (Honest Assessment)

| Component | Status | Notes |
|-----------|--------|-------|
| Provider/Runtime (Phases 1-5) | ✅ Done | Full execution infrastructure |
| Recording Infrastructure | ✅ Done | `withRecording()`, stores |
| Eval Primitives (Phases 6-7) | ✅ Done | Types, engine, scorers |
| API Types (`agent`, `harness`, `run`) | ✅ Done | Types and factories work |
| **`run()` Execution** | ✅ **Done** | Provider injection, real metrics |
| Vitest Plugin | ❌ Not Started | Ready to implement |
| Documentation | ❌ Blocked | Blocked by Vitest Plugin |

**Phase 1 Complete (2026-01-08):** `run()` now executes providers via injection pattern. Tests verify real behavior.

---

## Quality Standards (ALL Tasks)

```bash
bun run typecheck    # Zero errors
bun run lint         # Zero warnings
bun run test         # All tests pass
```

**Code Requirements:**
- No `any` types
- No `// TODO`, `// FIXME`, `// HACK` comments
- No `console.log` debugging
- No commented-out code
- No unused imports/variables
- Tests verify BEHAVIOR, not just shape

---

## Locked Decisions (Do Not Revisit)

These 13 decisions are final. Implementation must follow them exactly.

| # | Decision | Choice |
|---|----------|--------|
| 1 | Two Concerns | Running vs Evals are separate |
| 2 | Running API | `run()` - ONE function for all execution |
| 3 | Definition API | `agent()` + `harness()` |
| 4 | Eval Framework | Vitest (not custom) |
| 5 | Vitest Integration | Full plugin (`@open-harness/vitest`) |
| 6 | State Importance | Fundamental (Level 2 in examples) |
| 7 | Recording Level | Agent/Provider level |
| 8 | Harness Role | Coordinator of agent recordings |
| 9 | Fixtures | First-class `run()` option |
| 10 | Multi-Agent IDs | Hierarchical: `<fixture>/<nodeId>/inv<N>` |
| 11 | Naming | Public: "fixture", Internal: "recording" |
| 12 | Return Shape | `{ output, state?, metrics, fixtures? }` |
| 13 | Deprecations | `runFlow`, `createHarness`, `createRuntime` → internal |

---

## Critical Path

```
Phase 1: Fix run() ──→ Phase 2: Vitest Plugin ──→ Phase 3: Cleanup ──→ Phase 4: Docs ──→ Phase 5: Example ──→ Phase 6: DX Audit ──→ Phase 7: Ship
     │                        │                         │                    │                  │                    │                   │
   BLOCKER              Depends on P1              Depends on P2        Depends on P3      Depends on P4         YOU (human)        Final
```

---

## Phase 1: Fix run() Execution ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-01-08)
**Effort:** Medium

`run()` now executes providers via injection pattern. All quality gates pass.

### Implementation Summary

**Provider Injection Pattern:**
```typescript
// Option 1: Pass provider in run() options
const result = await run(myAgent, { prompt: "Hello" }, { provider: customProvider })

// Option 2: Set default provider globally
setDefaultProvider(createClaudeNode())
const result = await run(myAgent, { prompt: "Hello" })
```

**Files Changed:**
- `api/types.ts` — Added `Provider`, `AgentInput`, `AgentOutput` types
- `api/defaults.ts` — Added `setDefaultProvider()`, `getDefaultProvider()`
- `api/run.ts` — Complete rewrite to execute providers
- `api/index.ts` — Updated exports
- `tests/api/run.test.ts` — Mock provider + behavior verification tests

### Task 1.1: Wire Single Agent Execution ✅

- [x] Create provider injection via `RunOptions.provider` or `setDefaultProvider()`
- [x] Create execution context with `NodeRunContext`
- [x] Return real output from provider (`text`, `structuredOutput`)
- [x] Extract real metrics (`latencyMs`, `cost`, `tokens`)

### Task 1.2: Wire Harness Execution ✅

- [x] Dynamic import of `createRuntime()` to avoid circular deps
- [x] Build registry with provider for each agent
- [x] Convert `RunSnapshot` → `RunResult`

### Task 1.3: Add Behavior Tests ✅

- [x] Test that `result.output` is not undefined
- [x] Test that provider is actually called (tracking provider)
- [x] Test that correct input is passed to provider
- [x] Test that real metrics are returned

### Task 1.4: Phase 1 Quality Gate ✅

- [x] `bun run typecheck` — 13 packages pass
- [x] `bun run lint` — 13 packages pass
- [x] `bun run test` — All tests pass
- [x] Manual verification: `run()` calls provider.run()

---

## Phase 2: Vitest Plugin

**Status:** 🔴 Not Started
**Depends on:** Phase 1
**Effort:** Light

### Task 2.1: Create Package

**Directory:** `packages/open-harness/vitest/`

- [ ] `package.json` with vitest peer dependency
- [ ] `tsconfig.json`
- [ ] `src/index.ts`

### Task 2.2: Implement Matchers

**File:** `packages/open-harness/vitest/src/matchers.ts`

```typescript
expect.extend({
  toHaveLatencyUnder(result: RunResult, threshold: number) {
    const pass = result.metrics.latencyMs < threshold;
    return { pass, message: () => `...` };
  },
  toCostUnder(result: RunResult, threshold: number) {
    const pass = result.metrics.cost < threshold;
    return { pass, message: () => `...` };
  },
});
```

- [ ] `toHaveLatencyUnder(threshold: number)`
- [ ] `toCostUnder(threshold: number)`
- [ ] TypeScript declarations for matchers
- [ ] Tests for matchers

### Task 2.3: Implement Reporter

**File:** `packages/open-harness/vitest/src/reporter.ts`

```typescript
export class OpenHarnessReporter extends DefaultReporter {
  constructor(config: { passRate?: number }) { ... }

  onFinished() {
    // Calculate pass rate
    // Fail if below threshold
  }
}
```

- [ ] Aggregates test results
- [ ] Calculates pass rate
- [ ] Fails CI if pass rate below threshold
- [ ] Tests for reporter

### Task 2.4: Phase 2 Quality Gate

- [ ] `bun run typecheck` — zero errors
- [ ] `bun run lint` — zero warnings
- [ ] `bun test packages/open-harness/vitest/` — all pass

---

## Phase 3: Remove Old API

**Status:** 🔴 Not Started
**Depends on:** Phase 2
**Effort:** Light (mechanical)

### Task 3.1: Delete Old DX Files

- [ ] Delete `packages/internal/core/src/eval/dx.ts`
- [ ] Delete `packages/internal/core/src/eval/dx-types.ts`
- [ ] Remove from `packages/internal/core/src/eval/index.ts`

### Task 3.2: Remove Old Exports

- [ ] Remove `runFlow` from public exports
- [ ] Remove `createHarness` from public exports
- [ ] Remove `createRuntime` from public exports

### Task 3.3: Migrate Any Tests Using Old API

- [ ] Find tests using old API (`grep -r "defineSuite\|runSuite"`)
- [ ] Migrate to new API
- [ ] Verify all pass

### Task 3.4: Phase 3 Quality Gate

- [ ] `grep -r "defineSuite\|runSuite" packages/` — returns nothing
- [ ] `bun run typecheck` — zero errors
- [ ] `bun run test` — all pass

---

## Phase 4: Documentation

**Status:** 🔴 Blocked
**Depends on:** Phase 3
**Effort:** Light

### Task 4.1: Update evals-pattern.md

- [ ] Remove `defineSuite`, `runSuite` examples
- [ ] Add new API examples (`agent`, `harness`, `run`)
- [ ] Add fixture examples
- [ ] Add vitest examples

### Task 4.2: Update quickstart.md

- [ ] Use new API throughout
- [ ] Show fixture workflow

### Task 4.3: Update Other Docs

- [ ] Find all old API references
- [ ] Update to new API

### Task 4.4: Phase 4 Quality Gate

- [ ] `grep -r "defineSuite\|runSuite\|runFlow" apps/docs/` — returns nothing
- [ ] `cd apps/docs && bun run build` — succeeds

---

## Phase 5: Integration Example

**Status:** 🔴 Blocked
**Depends on:** Phase 4
**Effort:** Light

### Task 5.1: Create Example

**Directory:** `examples/quickstart/`

- [ ] `package.json`
- [ ] `vitest.config.ts`
- [ ] `src/agent.ts`
- [ ] `tests/agent.test.ts`

### Task 5.2: Phase 5 Quality Gate

- [ ] `FIXTURE_MODE=record bun test` — creates fixtures
- [ ] `FIXTURE_MODE=replay bun test` — uses fixtures, passes
- [ ] Replay twice produces identical results

---

## Phase 6: DX Audit (HARD GATE)

**Status:** 🔴 Blocked
**Depends on:** Phase 5
**Effort:** Requires Human

### Task 6.1: Fresh-Eyes Test

- [ ] Someone unfamiliar reads ONLY quickstart.md
- [ ] They create agent, write test, run it
- [ ] Document friction points

### Task 6.2: Fix Friction Points

- [ ] Address every issue found
- [ ] Re-test

### Task 6.3: Sign-Off

- [ ] Human attestation: "I followed docs, it worked"

---

## Phase 7: Release

**Status:** 🔴 Blocked
**Depends on:** Phase 6

### Task 7.1: Final Quality Check

- [ ] `bun run typecheck` — zero errors
- [ ] `bun run lint` — zero warnings
- [ ] `bun run test` — all pass

### Task 7.2: Version and Changelog

- [ ] Update version to 0.2.0 in all package.json files
- [ ] Write CHANGELOG.md entry

### Task 7.3: Ship

- [ ] PR: `v0.2.0/stabilization` → `master`
- [ ] PR approved and merged
- [ ] Git tag `v0.2.0` created and pushed

---

## Quick Reference: The New API

```typescript
import { agent, harness, run } from '@open-harness/core'
import { FileFixtureStore } from '@open-harness/stores'

const store = new FileFixtureStore('./fixtures')

// Define
const myAgent = agent({ prompt: 'You are helpful.' })

// Run live
const result = await run(myAgent, { prompt: 'Hello' })

// Run with fixture
const result = await run(myAgent, { prompt: 'Hello' }, {
  fixture: 'my-test',
  mode: 'record',  // or 'replay'
  store,
})

// Result shape
{
  output: T,
  state?: Record<string, unknown>,
  metrics: { latencyMs, cost, tokens: { input, output } },
  fixtures?: string[],
}
```

**Mode via env:**
```bash
FIXTURE_MODE=record bun test  # Record
FIXTURE_MODE=replay bun test  # Replay
bun test                      # Live
```

---

## Session Workflow

### On Start
1. Read this manifest
2. Find first unchecked task
3. Work on it

### During
1. Complete task
2. Check it off: `[x]`
3. Commit code + manifest
4. Run quality gate
5. Continue to next task

### On End
1. Commit all progress
2. Push to remote
3. Manifest is the handoff

---

## Archived Documents

Previous tracking documents are in `./archive/`. Key reference:
- `archive/SDK_DX_DECISIONS.md` — Original 13 locked decisions
- `archive/DX_IMPLEMENTATION_RESEARCH.md` — Codebase analysis

---

## Infrastructure Reference

### Existing Components (Use These)

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProviderTrait` | `core/src/providers/trait.ts` | Provider interface |
| `withRecording()` | `core/src/recording/with-recording.ts` | Record/replay wrapper |
| `createRuntime()` | `core/src/runtime/execution/runtime.ts` | Workflow execution |
| `RecordingStore` | `core/src/recording/store.ts` | Storage interface |
| `createClaudeNode()` | `server/src/providers/claude.ts` | Claude SDK integration |

### New API (Phase 1 Complete)

| Component | Location | Status |
|-----------|----------|--------|
| `agent()` | `core/src/api/agent.ts` | ✅ Works |
| `harness()` | `core/src/api/harness.ts` | ✅ Works |
| `run()` | `core/src/api/run.ts` | ✅ Works |
| Types | `core/src/api/types.ts` | ✅ Works |
| Defaults | `core/src/api/defaults.ts` | ✅ Works |
| `Provider` type | `core/src/api/types.ts` | ✅ New |
| `setDefaultProvider()` | `core/src/api/defaults.ts` | ✅ New |
