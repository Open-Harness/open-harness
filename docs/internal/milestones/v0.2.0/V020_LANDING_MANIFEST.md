# v0.2.0 Landing Manifest

**Status:** Implementation Phase
**Last Updated:** 2026-01-08
**Branch:** `v0.2.0/stabilization`

---

## Overview

This manifest tracks all implementation work to land v0.2.0.

**What's Complete:** Provider/Runtime (1-5), Recording, Eval Primitives (6-7)
**What's Pending:** New DX API (Phase 8 Revised), Vitest Plugin, Documentation
**Blocker:** Phase 8 Revised must complete before docs can be updated

---

## Quality Standards (Apply to ALL Tasks)

Every task must satisfy these before being checked off:

```bash
bun run typecheck    # Zero errors
bun run lint         # Zero warnings (Biome satisfied)
bun run test         # All tests pass
```

**Code cleanliness:**
- No `any` types in changed/new files
- No `// TODO`, `// FIXME`, `// HACK` comments
- No `console.log` debugging left in code
- No commented-out code
- No unused imports or variables

**Test requirements:**
- New functionality has tests that verify BEHAVIOR
- Tests have meaningful assertions
- No test regressions

---

## Completion Status

### ✅ COMPLETE — Provider/Runtime (Phases 1-5)

- [x] Remove old inbox/session cruft
- [x] Simplify NodeRunContext
- [x] Provider trait abstraction (Claude, OpenCode, Codex)
- [x] Recording infrastructure (`withRecording`, stores)
- [x] Runtime plugs into RunStore snapshots
- [x] Pause/resume at workflow level

### ✅ COMPLETE — Recording Infrastructure

- [x] `Recording<T>` type with metadata
- [x] `RecordingStore` interface
- [x] `InMemoryRecordingStore` implementation
- [x] `FileRecordingStore` implementation
- [x] `SqliteRecordingStore` implementation
- [x] `withRecording()` wrapper for providers
- [x] Mode support: record, replay, live

### ✅ COMPLETE — Eval Primitives (Phases 6-7)

- [x] `types.ts` — EvalDataset, EvalCase, EvalVariant, EvalArtifact
- [x] `assertions.ts` — evaluateAssertions()
- [x] `dataset.ts` — loadDataset()
- [x] `cache.ts` — Judge cache
- [x] `scorers/*.ts` — latency, cost, tokens, similarity, llm-judge
- [x] `engine.ts` — createEvalEngine()
- [x] `runner.ts` — runCase(), runDataset(), runMatrix()
- [x] `compare.ts` — Baseline comparison
- [x] `report.ts` — Markdown + JSON reports
- [x] `hooks.ts` — EvalHooks interface

---

## Execution Plan

### ✅ Phase 8: Core API (COMPLETE)

**Depends on:** Phases 1-7 ✅
**Blocks:** Phase 9, 10, 11, 12, 13, 14

#### Task 8.1: Create API Types ✅

**File:** `packages/internal/core/src/api/types.ts`

- [x] Define `Agent` type
- [x] Define `Harness` type
- [x] Define `RunOptions` type (fixture, mode, store, variant)
- [x] Define `RunResult` type (output, state, metrics, fixtures)
- [x] Define `FixtureStore` type alias
- [x] Export all types

#### Task 8.2: Implement agent() ✅

**File:** `packages/internal/core/src/api/agent.ts`

- [x] `agent(config: AgentConfig): Agent`
- [x] Wraps prompt into Agent structure
- [x] Test: agent creates correct type
- [x] Test: agent preserves prompt

#### Task 8.3: Implement harness() ✅

**File:** `packages/internal/core/src/api/harness.ts`

- [x] `harness(config: HarnessConfig): Harness`
- [x] Accepts `agents: Record<string, Agent>`
- [x] Accepts `edges: Edge[]`
- [x] Builds internal FlowDefinition
- [x] Test: harness creates correct type
- [x] Test: harness preserves agents and edges

#### Task 8.4: Implement run() ✅

**File:** `packages/internal/core/src/api/run.ts`

- [x] `run(target: Agent | Harness, input, options?): Promise<RunResult>`
- [x] Detect target type and dispatch
- [x] Handle `fixture` option — hierarchical IDs for multi-agent
- [x] Handle `mode` option — pass to withRecording
- [x] Handle `store` option
- [x] Handle `FIXTURE_MODE` env var as default
- [x] Return structured `RunResult`
- [x] Test: run executes agent
- [x] Test: run executes harness
- [x] Test: run with fixture records to store
- [x] Test: run with replay loads from store
- [x] Test: replay is deterministic
- [x] Test: multi-agent produces hierarchical fixture IDs

#### Task 8.5: Implement defaults ✅

**File:** `packages/internal/core/src/api/defaults.ts`

- [x] `setDefaultStore(store): void`
- [x] `setDefaultMode(mode): void`
- [x] `getDefaultStore(): FixtureStore | undefined`
- [x] `getDefaultMode(): string`
- [x] Test: defaults are set and retrieved

#### Task 8.6: Create index and exports ✅

**File:** `packages/internal/core/src/api/index.ts`

- [x] Export all API functions
- [x] Export all types

**File:** `packages/open-harness/core/src/index.ts`

- [x] Re-export API from `@internal/core/api`

#### Task 8.7: Phase 8 Quality Gate ✅

- [x] `bun run typecheck` — zero errors (13/13 packages)
- [x] `bun run lint` — zero warnings (13/13 packages)
- [x] `bun test packages/internal/core/tests/api/` — all pass (56 tests, 104 assertions)
- [x] All tests have meaningful assertions

---

### 🔴 Phase 9: Vitest Plugin

**Depends on:** Phase 8
**Blocks:** Phase 10, 11, 12, 13, 14

#### Task 9.1: Create package

**Directory:** `packages/open-harness/vitest/`

- [ ] Create `package.json`
- [ ] Create `tsconfig.json`
- [ ] Create `src/index.ts`

#### Task 9.2: Implement matchers

**File:** `packages/open-harness/vitest/src/matchers.ts`

- [ ] `toHaveLatencyUnder(threshold: number)`
- [ ] `toCostUnder(threshold: number)`
- [ ] TypeScript declarations
- [ ] Test: matcher passes when condition met
- [ ] Test: matcher fails when condition not met

#### Task 9.3: Implement reporter

**File:** `packages/open-harness/vitest/src/reporter.ts`

- [ ] `OpenHarnessReporter` class
- [ ] Accepts `{ passRate: number }` config
- [ ] Aggregates test results
- [ ] Fails CI if pass rate below threshold
- [ ] Test: reporter calculates pass rate
- [ ] Test: reporter fails when threshold not met

#### Task 9.4: Implement setup

**File:** `packages/open-harness/vitest/src/setup.ts`

- [ ] Auto-registers matchers

#### Task 9.5: Phase 9 Quality Gate

- [ ] `bun run typecheck` — zero errors
- [ ] `bun run lint` — zero warnings
- [ ] `bun test packages/open-harness/vitest/` — all pass

---

### 🔴 Phase 10: Remove Old API

**Depends on:** Phase 8, Phase 9
**Blocks:** Phase 11, 12, 13, 14

#### Task 10.1: Delete old DX files

- [ ] Delete `packages/internal/core/src/eval/dx.ts`
- [ ] Delete `packages/internal/core/src/eval/dx-types.ts`
- [ ] Remove from `packages/internal/core/src/eval/index.ts`

#### Task 10.2: Remove old exports

- [ ] Remove `runFlow` from public exports
- [ ] Remove `createHarness` from public exports
- [ ] Remove `createRuntime` from public exports

#### Task 10.3: Migrate tests

- [ ] Find tests using old API
- [ ] Migrate to new API
- [ ] Verify all pass

#### Task 10.4: Phase 10 Quality Gate

- [ ] `grep -r "defineSuite\|runSuite" packages/` — returns nothing
- [ ] `bun run typecheck` — zero errors
- [ ] `bun run lint` — zero warnings
- [ ] `bun run test` — all pass

---

### 🔴 Phase 11: Documentation

**Depends on:** Phase 10
**Blocks:** Phase 12, 13, 14

#### Task 11.1: Update evals-pattern.md

- [ ] Remove `defineSuite`, `runSuite` examples
- [ ] Add new API examples
- [ ] Add fixture examples
- [ ] Add vitest examples

#### Task 11.2: Update quickstart.md

- [ ] Use new API throughout
- [ ] Show fixture workflow

#### Task 11.3: Update other docs

- [ ] Find and update all old API references

#### Task 11.4: Phase 11 Quality Gate

- [ ] `grep -r "defineSuite\|runSuite\|runFlow" apps/docs/` — returns nothing
- [ ] `cd apps/docs && bun run build` — succeeds

---

### 🔴 Phase 12: Integration Example

**Depends on:** Phase 11
**Blocks:** Phase 13, 14

#### Task 12.1: Create example

**Directory:** `examples/quickstart/`

- [ ] `package.json`
- [ ] `vitest.config.ts`
- [ ] `src/agent.ts`
- [ ] `tests/agent.test.ts`

#### Task 12.2: Phase 12 Quality Gate

- [ ] `FIXTURE_MODE=record bun test` — creates fixtures
- [ ] `FIXTURE_MODE=replay bun test` — uses fixtures, passes
- [ ] Replay twice produces identical results

---

### 🔴 Phase 13: DX Audit (HARD GATE)

**Depends on:** Phase 12
**Blocks:** Phase 14

#### Task 13.1: Fresh-eyes test

- [ ] Someone unfamiliar reads only quickstart.md
- [ ] They create agent, write test, run it
- [ ] Document friction points

#### Task 13.2: Fix friction points

- [ ] Address every issue
- [ ] Re-test

#### Task 13.3: Sign-off

- [ ] Human attestation: "I followed docs, it worked"

---

### 🔴 Phase 14: Release

**Depends on:** Phase 13

#### Task 14.1: Final quality check

- [ ] `bun run typecheck` — zero errors
- [ ] `bun run lint` — zero warnings
- [ ] `bun run test` — all pass

#### Task 14.2: Version and changelog

- [ ] Update version to 0.2.0 in all package.json
- [ ] Write CHANGELOG.md entry

#### Task 14.3: Ship

- [ ] PR: `v0.2.0/stabilization` → `master`
- [ ] PR approved and merged
- [ ] Git tag `v0.2.0` created and pushed

---

## Session Workflow

### On Start

```
1. Read this manifest
2. Find first unchecked task ([ ])
3. Work on it
```

### During

```
1. Complete task
2. Check it off: [x]
3. Commit code + manifest
4. Run quality gate
5. Continue to next task
```

### On End

```
1. Commit all progress
2. Push to remote
3. Manifest is the handoff
```

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `SDK_DX_DECISIONS.md` | 13 locked design decisions |
| `DX_IMPLEMENTATION_RESEARCH.md` | Codebase analysis |
| `VERSION_PLAN.md` | Original vision and scope |

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
