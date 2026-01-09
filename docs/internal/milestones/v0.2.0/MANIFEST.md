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
| **Vitest Plugin** | ✅ **Done** | Matchers, reporter, types |
| **Old API Cleanup** | ✅ **Done** | Removed `defineSuite`/`runSuite` DX layer |
| **Documentation** | ✅ **Done** | Updated all docs to new API |

**Phase 1 Complete (2026-01-08):** `run()` now executes providers via injection pattern. Tests verify real behavior.

**Phase 2 Complete (2026-01-08):** `@open-harness/vitest` package with matchers (`toHaveLatencyUnder`, `toCostUnder`, `toHaveTokensUnder`), `OpenHarnessReporter` with quality gates, and TypeScript declarations.

**Phase 3 Complete (2026-01-08):** Removed old DX layer (`defineSuite`, `runSuite`, `variant`, `gates`). Cleaned up starter-kit for Phase 5 rebuild.

**Phase 4 Complete (2026-01-08):** Updated all documentation to use new API (`agent`, `harness`, `run`) with Vitest integration. Removed all old API references.

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

## Phase 2: Vitest Plugin ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-01-08)
**Depends on:** Phase 1 ✅
**Effort:** Medium

Vitest plugin with custom matchers, reporter, and type declarations implemented. All quality gates pass.

### Package Structure

**Directory:** `packages/open-harness/vitest/`
**npm name:** `@open-harness/vitest`

```
packages/open-harness/vitest/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Public exports
│   ├── matchers.ts       # Custom vitest matchers
│   ├── reporter.ts       # Aggregation + gates reporter
│   ├── setup.ts          # Auto-setup file for setupFiles config
│   └── types.ts          # TypeScript declarations
└── tests/
    ├── matchers.test.ts
    └── reporter.test.ts
```

---

### Task 2.1: Create Package

**File:** `packages/open-harness/vitest/package.json`

```json
{
  "name": "@open-harness/vitest",
  "version": "0.2.0-alpha.1",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./setup": "./src/setup.ts"
  },
  "peerDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5"
  },
  "dependencies": {
    "@open-harness/core": "workspace:*"
  }
}
```

- [x] Create `package.json` with vitest ^2.0.0 peer dependency
- [x] Create `tsconfig.json` extending root config
- [x] Add to turbo pipeline in root `turbo.json`
- [x] Verify `bun install` resolves workspace

---

### Task 2.2: Implement Matchers

**File:** `packages/open-harness/vitest/src/matchers.ts`

```typescript
import type { RunResult } from '@open-harness/core'

export const matchers = {
  toHaveLatencyUnder(received: RunResult, threshold: number) {
    const latencyMs = received.metrics.latencyMs
    const pass = latencyMs < threshold
    return {
      pass,
      message: () => pass
        ? `Expected latency >= ${threshold}ms, got ${latencyMs}ms`
        : `Expected latency < ${threshold}ms, got ${latencyMs}ms`,
    }
  },

  toCostUnder(received: RunResult, maxUsd: number) {
    const cost = received.metrics.cost
    const pass = cost < maxUsd
    return {
      pass,
      message: () => pass
        ? `Expected cost >= $${maxUsd}, got $${cost}`
        : `Expected cost < $${maxUsd}, got $${cost}`,
    }
  },

  toHaveTokensUnder(received: RunResult, maxTokens: number) {
    const total = received.metrics.tokens.input + received.metrics.tokens.output
    const pass = total < maxTokens
    return {
      pass,
      message: () => pass
        ? `Expected tokens >= ${maxTokens}, got ${total}`
        : `Expected tokens < ${maxTokens}, got ${total}`,
    }
  },
}

export function setupMatchers() {
  // @ts-expect-error - vitest global
  expect.extend(matchers)
}
```

- [x] Implement `toHaveLatencyUnder(threshold: number)`
- [x] Implement `toCostUnder(maxUsd: number)`
- [x] Implement `toHaveTokensUnder(maxTokens: number)`
- [x] Create `setupMatchers()` function
- [x] Write tests for all matchers

---

### Task 2.3: TypeScript Declarations

**File:** `packages/open-harness/vitest/src/types.ts`

```typescript
interface OpenHarnessMatchers<R = unknown> {
  toHaveLatencyUnder(threshold: number): R
  toCostUnder(maxUsd: number): R
  toHaveTokensUnder(maxTokens: number): R
}

declare module 'vitest' {
  interface Assertion<T> extends OpenHarnessMatchers<T> {}
  interface AsymmetricMatchersContaining extends OpenHarnessMatchers {}
}
```

- [x] Create type declarations augmenting vitest's `Assertion` interface
- [x] Export types from `index.ts`
- [x] Verify TypeScript autocomplete works

---

### Task 2.4: Implement Reporter

**File:** `packages/open-harness/vitest/src/reporter.ts`

```typescript
import type { Reporter, File, TaskResultPack } from 'vitest/node'

export interface GateConfig {
  /** Minimum pass rate (0-1). Default: 0.8 (80%) */
  passRate?: number
  /** Maximum allowed latency in ms (optional) */
  maxLatencyMs?: number
  /** Maximum allowed cost in USD (optional) */
  maxCostUsd?: number
}

export class OpenHarnessReporter implements Reporter {
  private passed = 0
  private failed = 0
  private config: Required<Pick<GateConfig, 'passRate'>> & GateConfig

  constructor(config: GateConfig = {}) {
    this.config = { passRate: 0.8, ...config }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    for (const [id, result] of packs) {
      if (result?.state === 'pass') this.passed++
      if (result?.state === 'fail') this.failed++
    }
  }

  onFinished(files?: File[]) {
    const total = this.passed + this.failed
    if (total === 0) return

    const passRate = this.passed / total

    console.log('\n────────────────────────────────────')
    console.log(`Open Harness: ${this.passed}/${total} passed (${(passRate * 100).toFixed(1)}%)`)

    if (passRate < this.config.passRate) {
      console.error(`❌ Gate FAILED: pass rate ${(passRate * 100).toFixed(1)}% < ${(this.config.passRate * 100).toFixed(1)}%`)
      process.exitCode = 1
      return
    }

    console.log('✅ All gates passed')
    console.log('────────────────────────────────────\n')
  }
}
```

- [x] Implement `Reporter` interface from `vitest/node`
- [x] Track pass/fail counts via `onTaskUpdate`
- [x] Output summary in `onFinished`
- [x] Evaluate pass rate gate (default: 80%)
- [x] Set `process.exitCode = 1` on gate failure
- [x] Write tests for reporter

---

### Task 2.5: Setup File

**File:** `packages/open-harness/vitest/src/setup.ts`

```typescript
import { setupMatchers } from './matchers.js'

// Auto-register matchers when used as setupFile
setupMatchers()
```

- [x] Create setup file that calls `setupMatchers()`
- [x] Export from package.json `"./setup"` path
- [x] Document auto vs manual setup options

---

### Task 2.6: Public Exports

**File:** `packages/open-harness/vitest/src/index.ts`

```typescript
// Matchers
export { matchers, setupMatchers } from './matchers.js'

// Reporter
export { OpenHarnessReporter } from './reporter.js'
export type { GateConfig } from './reporter.js'

// Types (re-export for convenience)
export type { RunResult, RunMetrics } from '@open-harness/core'

// Convenience re-exports
export { run, agent, harness } from '@open-harness/core'
```

- [x] Export matchers and setupMatchers
- [x] Export reporter and GateConfig
- [x] Re-export core functions for convenience
- [x] Ensure all types properly exported

---

### Task 2.7: JSDoc Documentation ✅

- [x] JSDoc on `OpenHarnessReporter` with vitest.config.ts example
- [x] JSDoc on all matchers with usage examples
- [x] JSDoc on `GateConfig` interface

---

### Task 2.8: Phase 2 Quality Gate ✅

- [x] `bun run typecheck` — zero errors (all 17 packages)
- [x] `bun run lint` — zero warnings (all 17 packages)
- [x] `bun test packages/open-harness/vitest/` — all 21 tests pass
- [x] Manual: matchers work in vitest test file
- [x] Manual: reporter outputs summary and fails on low pass rate

---

### Usage Example

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { OpenHarnessReporter } from '@open-harness/vitest'

export default defineConfig({
  test: {
    setupFiles: ['@open-harness/vitest/setup'],
    reporters: ['default', new OpenHarnessReporter({ passRate: 0.8 })],
  }
})
```

```typescript
// tests/my-agent.test.ts
import { test, expect } from 'vitest'
import { run, agent } from '@open-harness/vitest'

const myAgent = agent({ prompt: 'You are helpful.' })

test('agent responds quickly and cheaply', async () => {
  const result = await run(myAgent, { prompt: 'Hello' })

  expect(result.output).toBeDefined()
  expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
  expect(result).toCostUnder(0.01)         // < $0.01
  expect(result).toHaveTokensUnder(1000)   // < 1000 total tokens
})
```

---

## Phase 3: Remove Old API ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-01-08)
**Depends on:** Phase 2 ✅
**Effort:** Light (mechanical)

Removed the Phase 8 DX layer (`defineSuite`, `runSuite`, `variant`, `gates`) since it's replaced by the Vitest plugin. The old starter-kit demo code was also deleted; Phase 5 will rebuild it.

### Task 3.1: Delete Old DX Files ✅

- [x] Delete `packages/internal/core/src/eval/dx.ts`
- [x] Delete `packages/internal/core/src/eval/dx-types.ts`
- [x] Remove from `packages/internal/core/src/eval/index.ts`
- [x] Delete `packages/internal/core/tests/eval/dx.test.ts`
- [x] Update `packages/internal/core/src/eval/README.md` to remove DX documentation

### Task 3.2: Clean Up Starter Kit ✅

- [x] Delete `apps/starter-kit/src/evals/` (used old DX API)
- [x] Delete `apps/starter-kit/src/workflows/` (used old DX API)
- [x] Update `apps/starter-kit/src/index.ts` (placeholder until Phase 5)
- [x] Remove old scripts from `apps/starter-kit/package.json`

**Note:** `runFlow`, `createHarness`, `createRuntime` are already internal-only (in `@internal/*` packages, not exposed in `@open-harness/*` public API). No changes needed.

### Task 3.3: Verify Old API Removed ✅

- [x] `grep -r "defineSuite\|runSuite" packages/` — returns nothing
- [x] All old API references cleaned up

### Task 3.4: Phase 3 Quality Gate ✅

- [x] `bun run typecheck` — zero errors (14 packages pass)
- [x] `bun run lint` — zero warnings (14 packages pass)
- [x] `bun run test` — all pass

---

## Phase 4: Documentation ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-01-08)
**Depends on:** Phase 3 ✅
**Effort:** Light

Documentation updated to remove all old API references (`defineSuite`, `runSuite`, `runFlow`) and showcase the new v0.2.0 API (`agent`, `harness`, `run`) with Vitest integration.

### Task 4.1: Update evals-pattern.md ✅

- [x] Remove `defineSuite`, `runSuite` examples
- [x] Add new API examples (`agent`, `harness`, `run`)
- [x] Add fixture examples
- [x] Add vitest examples

### Task 4.2: Update quickstart.md ✅

- [x] Use new API throughout
- [x] Show fixture workflow

### Task 4.3: Update Other Docs ✅

- [x] Find all old API references
- [x] Update to new API

**Files Updated:**
- `apps/docs/content/0.2.0/03-patterns/evals-pattern.md` — Complete rewrite for Vitest-based evals
- `apps/docs/content/docs/learn/quickstart.mdx` — New agent-first API
- `apps/docs/content/docs/reference/api/runtime.mdx` — Updated to run() API
- `apps/docs/content/docs/concepts/architecture.mdx` — Agent/harness architecture
- `apps/docs/content/docs/guides/agents/custom-agents.mdx` — New agent patterns
- `apps/docs/content/docs/learn/troubleshooting.mdx` — Updated error references

### Task 4.4: Phase 4 Quality Gate ✅

- [x] `grep -r "defineSuite\|runSuite\|runFlow" apps/docs/` — returns nothing
- [x] `cd apps/docs && bun run build` — succeeds
- [x] `bun run typecheck` — zero errors
- [x] `bun run lint` — zero warnings

---

## Phase 5: Integration Example

**Status:** 🟡 Ready to Start
**Depends on:** Phase 4 ✅
**Effort:** Light

**Note (Phase 3):** The old `apps/starter-kit/` eval code using `defineSuite`/`runSuite` was deleted in Phase 3. Phase 5 should rebuild it using the new Vitest-based API.

### Task 5.1: Create Quickstart Example

**Directory:** `examples/quickstart/`

- [ ] `package.json`
- [ ] `vitest.config.ts`
- [ ] `src/agent.ts`
- [ ] `tests/agent.test.ts`

### Task 5.2: Rebuild Starter Kit (Optional)

**Directory:** `apps/starter-kit/`

The starter-kit was cleared in Phase 3. Options:
- Option A: Rebuild with new `@open-harness/vitest` API (prompt comparison example)
- Option B: Remove the package entirely if examples/quickstart is sufficient
- [ ] Decide approach (rebuild or remove)
- [ ] Implement decision

### Task 5.3: Phase 5 Quality Gate

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
