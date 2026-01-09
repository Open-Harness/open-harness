# Handoff: Phase 8 NEW — DX API Implementation

**Date:** 2026-01-08
**Status:** Ready to implement
**Branch:** `v0.2.0/stabilization`
**Blocker for:** v0.2.0 release

---

## TL;DR

Implement the new public API: `agent()`, `harness()`, `run()` with fixture support, plus `@open-harness/vitest` plugin.

**All decisions are locked. No design work needed. Just implementation.**

---

## Current State

| Component | Status |
|-----------|--------|
| Provider/Runtime (Phases 1-5) | ✅ Done |
| Recording infrastructure | ✅ Done (`withRecording()`, stores) |
| Eval primitives (Phases 6-7) | ✅ Done (types, engine, scorers) |
| Old Phase 8 (`defineSuite`, etc) | ✅ Done but OBSOLETE |
| **Phase 8 NEW** | 🔴 **NOT STARTED** |
| `@open-harness/vitest` | 🔴 **NOT STARTED** |
| Documentation for new DX | ⏳ Blocked by Phase 8 |

---

## Read First (Required Context)

1. **SDK_DX_DECISIONS.md** — All 13 locked decisions
2. **DX_IMPLEMENTATION_RESEARCH.md** — Codebase analysis, locked decisions section
3. **VERSION_PLAN.md** — Updated critical path and release criteria

---

## What to Implement

### 1. Core API (`packages/internal/core/src/api/`)

```typescript
// agent.ts
export function agent(config: AgentConfig): Agent

// harness.ts
export function harness(config: HarnessConfig): Harness

// run.ts
export async function run(
  target: Agent | Harness,
  input: unknown,
  options?: RunOptions
): Promise<RunResult>

// types.ts
export interface Agent { type: 'agent'; prompt: string; ... }
export interface Harness { type: 'harness'; agents: Record<string, Agent>; edges: Edge[]; ... }
export interface RunOptions {
  fixture?: string;
  mode?: 'live' | 'record' | 'replay';
  store?: FixtureStore;
  variant?: Record<string, unknown>;
}
export interface RunResult<T = unknown> {
  output: T;
  state?: Record<string, unknown>;
  metrics: { latencyMs: number; cost: number; tokens: { input: number; output: number } };
  fixtures?: string[];
}

// defaults.ts
export function setDefaultStore(store: FixtureStore): void
export function setDefaultMode(mode: 'live' | 'record' | 'replay'): void
```

**Implementation notes:**
- `agent()` wraps existing `ProviderTrait` + `NodeTypeDefinition`
- `harness()` wraps existing `FlowDefinition` + `createHarness()`
- `run()` calls existing `runFlow()` internally, adds fixture handling
- Fixture support uses existing `withRecording()` with hierarchical IDs

### 2. Vitest Plugin (`packages/open-harness/vitest/`)

```
packages/open-harness/vitest/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts      # Exports: plugin, reporter, matchers, setup helpers
    ├── plugin.ts     # Vite plugin (minimal, mainly config)
    ├── reporter.ts   # Aggregation + gates (fail if pass rate < threshold)
    ├── matchers.ts   # toHaveLatencyUnder(), toCostUnder()
    └── setup.ts      # Auto-registers matchers
```

**Implementation notes:**
- Reporter extends vitest's `DefaultReporter`
- Matchers use `expect.extend()`
- Plugin is minimal, mainly wires reporter

### 3. Deprecations

Add `console.warn` to:
- `runFlow()` in `packages/internal/server/src/harness/harness.ts`
- `createHarness()` in same file
- `createRuntime()` in `packages/internal/core/src/runtime/execution/runtime.ts`

Mark as `@deprecated`:
- `dx.ts`, `dx-types.ts` exports

### 4. Exports

Update `packages/open-harness/core/src/index.ts`:
```typescript
// New public API
export { agent, harness, run, setDefaultStore, setDefaultMode } from './api'
export type { Agent, Harness, RunOptions, RunResult, FixtureStore } from './api/types'
```

---

## Fixture ID Generation

For multi-agent harnesses, fixture IDs must be hierarchical:

```typescript
// Single agent
fixture: 'my-test' → recording ID: 'my-test'

// Multi-agent harness
fixture: 'code-review'
  → coder node: 'code-review/coder/inv0'
  → reviewer node: 'code-review/reviewer/inv0'
```

This happens in `run()` when setting up `withRecording()` for each provider.

---

## Mode Resolution

```typescript
function resolveMode(options?: RunOptions): 'live' | 'record' | 'replay' {
  // 1. Explicit option wins
  if (options?.mode) return options.mode

  // 2. Env var
  const envMode = process.env.FIXTURE_MODE
  if (envMode === 'record' || envMode === 'replay') return envMode

  // 3. Default
  return getDefaultMode() ?? 'live'
}
```

---

## Acceptance Criteria

- [ ] `agent({ prompt })` creates Agent type
- [ ] `harness({ agents, edges })` creates Harness type
- [ ] `run(agent, input)` executes and returns RunResult
- [ ] `run(agent, input, { fixture: 'name' })` records with hierarchical ID
- [ ] `run(agent, input, { fixture: 'name', mode: 'replay' })` replays
- [ ] `FIXTURE_MODE=record|replay|live` env var works
- [ ] `setDefaultStore()`, `setDefaultMode()` configure defaults
- [ ] `@open-harness/vitest` installable as dependency
- [ ] Reporter aggregates pass rate, fails if < threshold
- [ ] `expect(result).toHaveLatencyUnder(5000)` works
- [ ] Old APIs show deprecation warning
- [ ] All tests pass: `bun run test`
- [ ] Types clean: `bun run typecheck`

---

## What NOT to Change

- `withRecording()` internals — keep as-is, just use from `run()`
- `RecordingStore` interface — keep as-is, alias as `FixtureStore`
- Eval engine (runner, assertions, scorers) — keep as-is, used internally
- Provider implementations — keep as-is

---

## Example: End-to-End Test

```typescript
// packages/open-harness/core/tests/api/run.test.ts
import { test, expect } from 'vitest'
import { agent, run } from '@open-harness/core'
import { FileFixtureStore } from '@open-harness/stores'

const store = new FileFixtureStore('./fixtures')

const greeter = agent({
  prompt: 'You are a friendly greeter. Say hello.',
})

test('agent returns greeting', async () => {
  const result = await run(greeter, { prompt: 'Hi!' }, {
    fixture: 'greeter/hello',
    store,
  })

  expect(result.output.text).toMatch(/hello/i)
  expect(result.metrics.latencyMs).toBeLessThan(10000)
})
```

---

## After Phase 8

1. **Update documentation** — All examples use new DX
2. **DX Audit** — Fresh-eyes test with new API
3. **Release** — Announcement, CHANGELOG

---

## Questions?

All design decisions are in:
- `SDK_DX_DECISIONS.md` (13 locked decisions)
- `DX_IMPLEMENTATION_RESEARCH.md` (codebase mapping)

If something is unclear, check those docs first. If still unclear, ask — but the answer should be derivable from locked decisions.
