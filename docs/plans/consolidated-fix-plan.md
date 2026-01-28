# Consolidated Fix Plan: Post-Migration Audit

**Date:** 2026-01-27
**Status:** DECISIONS MADE — awaiting execution
**Source:** Deep audit report, spec drift analysis, validation report, CLI manual testing
**Decision maker:** Aaron (AbuUsama)

---

## Context

All 24 migration tasks (of 25) are marked complete. Typecheck passes across all 5 packages. 219 of 223 tests pass (4 client failures expected). However, three independent analyses revealed systemic gaps that mean the system does not work end-to-end despite individual tasks passing.

This document records the decisions made for each issue group. Another agent will execute these fixes.

---

## Group 1: CLI is Non-Functional (BLOCKING)

**Decision: Option A — Hardcode providers to unblock**

### What to do

Import `AnthropicProvider` into `apps/cli/src/commands/run.tsx` and register it in the `OpenScaffold.create()` call. Since we only have one provider (Anthropic), hardcode the standard models:

```typescript
import { AnthropicProvider } from "@open-scaffold/server"

const scaffold = OpenScaffold.create({
  database: `file:${resolve(options.database)}`,
  mode: "live",
  providers: {
    "claude-sonnet-4-5": AnthropicProvider({ model: "claude-sonnet-4-5" }),
    "claude-haiku-4-5": AnthropicProvider({ model: "claude-haiku-4-5" }),
    "claude-opus-4-5": AnthropicProvider({ model: "claude-opus-4-5" }),
  }
})
```

### Files to change

- `apps/cli/src/commands/run.tsx` (lines 32-35)

### Future note (DO NOT implement now)

Aaron does not like the current pattern where providers are mapped by model name at registration time, separate from the agents that use them. The preferred future design is for providers and models to live on the agent definitions themselves. This is a larger architectural change to be addressed later.

---

## Group 2: OpenScaffold Layer Gaps (HIGH)

**Decision: Option B — Fix gaps + throw on empty registry**

### What to do

1. Add `ProviderModeContext` to the `AppServices` type union in `OpenScaffold.ts`
2. Add a `ProviderModeContext` layer to `combinedLayer` in the `create()` method (use the `mode` from config)
3. At construction time, if `providers` is empty/undefined and the caller hasn't explicitly opted out, **throw an error** — not a warning. The error should say something like: `"OpenScaffold created without providers. Any workflow with agent phases will fail. Pass providers to OpenScaffold.create() or set providers: {} to explicitly opt out."`

### Files to change

- `packages/server/src/OpenScaffold.ts` (lines 108-113 for type, lines 174-195 for layer, constructor for validation)

### Discussion needed

The throw-on-empty behavior needs a way to opt out for test scenarios where you genuinely want no providers (e.g., testing non-agent workflows). Consider accepting `providers: {}` (explicit empty object) as the opt-out signal, vs `providers: undefined` (not provided) as the error case.

---

## Group 3: RuntimeConfig.database — Wire It (LOW-MEDIUM)

**Decision: Option A — Wire `database` field to auto-construct EventStore**

### What to do

In `execute.ts` and `run.ts`, when `runtime.database` is provided but `runtime.eventStore` is not, auto-construct a LibSQL-backed EventStore:

```typescript
// Pseudocode for the layer construction:
const eventStoreLayer = runtime.eventStore
  ? Layer.succeed(EventStore, runtime.eventStore)
  : runtime.database
    ? EventStoreLibSQL({ url: runtime.database })
    : InMemoryEventStore  // Only if neither provided
```

Same pattern for `EventBus` if applicable.

### Files to change

- `packages/core/src/Next/execute.ts` (layer construction, ~lines 296-330)
- `packages/core/src/Next/run.ts` (if it has its own layer construction)

### Decision: Default database path (one code path)

**DECIDED:** Option 3 — default to a persistent database. No InMemory fallback.

When neither `database` nor `eventStore` is provided, default to:

```
~/.openscaffold/scaffold.db
```

The `~/.openscaffold/` directory is the standard config/data directory for OpenScaffold. Create it if it doesn't exist.

Layer construction becomes:

```typescript
const eventStoreLayer = runtime.eventStore
  ? Layer.succeed(EventStore, runtime.eventStore)
  : EventStoreLive({ url: runtime.database ?? `file:${homedir()}/.openscaffold/scaffold.db` })
```

This eliminates the InMemory fallback entirely. One code path: always persistent. The `InMemoryEventStore` and `InMemoryEventBus` implementations can remain in the codebase for unit testing purposes, but they are never used as silent fallbacks in production code paths.

---

## Group 4: Replace Mock Provider (MEDIUM)

**Decision: Option A — Record real responses, use ProviderRecorder playback**

### What to do

1. Create a recording script/test that runs test workflows against the real Anthropic API in "live" mode
2. `ProviderRecorder` captures all stream events during live execution
3. Export/commit the recorded fixtures to the repo (e.g., `packages/core/test/fixtures/`)
4. Rewrite all 9+ test files that use `createMockProvider` to use `ProviderRecorder` in "playback" mode instead
5. Delete `packages/core/test/helpers/mock-provider.ts` entirely

### Files to change

- `packages/core/test/helpers/mock-provider.ts` (DELETE)
- All test files importing `createMockProvider` or `noopRecorder`:
  - `packages/core/test/next-execute.test.ts`
  - `packages/core/test/next-runtime.test.ts`
  - `packages/core/test/next-observer.test.ts`
  - `packages/core/test/next-hitl.test.ts`
  - `packages/core/test/next-resume.test.ts`
  - `packages/core/test/next-run.test.ts` (if it uses mock)
  - Any others importing from `./helpers/mock-provider`
- New fixtures directory: `packages/core/test/fixtures/` (recorded responses)
- New recording script or test helper

### Scope warning

This is a large change. It touches every core test that exercises agent execution. Should be broken into sub-tasks:

1. Build the recording harness (script that runs workflows in live mode and saves fixtures)
2. Record fixtures for each test workflow
3. Migrate tests one file at a time
4. Delete mock-provider.ts last

### Error path testing approach

For error-path fixtures, record real error responses:

| Error Type | How to Record |
|------------|---------------|
| Rate limit (429) | Burst requests to trigger rate limit, capture the error response |
| Auth failure (401) | Use an invalid API key for one recording |
| Context exceeded | Send a prompt exceeding the model's context window |
| Schema validation | Record a valid response, then corrupt the fixture file manually to simulate bad output |
| Network errors | **SKIP** — cannot record real network failures. Accept that this path is not tested. |

---

## Group 5: Test Quality (MEDIUM)

**Decision: Option A first (integration tests), then Option C (full rewrite)**

### Phase 1: Integration tests (do first)

Add 4 integration tests that exercise real pipelines:

1. **EventStore persistence** — Run a workflow, verify events are persisted to EventStore (not just in-memory)
2. **EventBus broadcast** — Run a workflow, verify EventBus publishes events during execution (subscribe before run, collect events, assert)
3. **ProviderRegistry pipeline** — Exercise: registry lookup -> provider.stream() -> agent result (with recorded fixture)
4. **CLI E2E** — Spawn the CLI process, run a workflow in headless mode, verify JSON-line output (depends on Group 1 fix)

### Phase 2: Full test rewrite (do after Phase 1)

Upgrade 9 shallow tests to include behavioral assertions:

| Test File | Current State | What to Add |
|-----------|--------------|-------------|
| `next-agent.test.ts` | Factory fields only | Execute agent in a workflow, verify update() mutates state |
| `next-workflow.test.ts` | Structure only | Execute workflow, verify phase transitions |
| `next-phase.test.ts` | Shape only | Execute phase, verify next() routing |
| `next-types.test.ts` | Constants/constructors | Keep as-is (these are genuinely compile-time checks) |
| `next-config.test.ts` | Field acceptance | Verify config affects runtime behavior |
| `next-run.test.ts` | Callback signatures | Verify callbacks actually fire during execution |
| `next-execute.test.ts` (interface) | Shape checks | Already has streaming tests — merge or remove shape-only section |
| `provider-streaming.test.ts` | Mock stream shape | Replace with recorded fixture playback |
| `hitl-integration.test.ts` | Failing (timeout) | Fix timeout, verify full HITL round-trip |

### Phase 3: Error path tests (do after mock replacement)

Depends on Group 4 completion (recorded error fixtures). Add tests for:

- `ProviderNotFoundError` when model missing from registry
- Rate limit handling and retry behavior
- Auth failure propagation
- Invalid output schema handling
- Workflow abort/cancellation cleanup

### Fix failing client tests

Separately from the above, fix the 4 failing client tests:
- `client/hooks.test.tsx` — 3 failures, uses old `defineEvent` API
- `client/http-client-vcr.test.ts` — 1 failure, fetch mock count assertion

---

## Group 6: Spec Drift Resolution (LOW)

**Decision: Update plan to match code (mostly), with specific code changes**

### Code changes needed

| Drift | Action |
|-------|--------|
| `recordEvent` relocated to server/programs/ | **Accept** — update plan to say "relocated" not "deleted" |
| Stale build artifacts in `packages/core/build/` | **Delete** — run `pnpm clean` or `rm -rf packages/core/build/` |
| `WorkflowObserver.completed` signature differs | **Accept** — `{ state, events }` is better than `WorkflowResult<S>`, update plan |
| `WorkflowObserver.errored` takes `unknown` | **Accept** — more flexible, update plan |
| Flat callbacks in `run.ts` not `@deprecated` | **REMOVE flat callbacks entirely** — do not deprecate, just delete them. The observer pattern replaces them. |
| `RuntimeConfig.database` ignored | **Fix** — covered in Group 3 |
| `Next/` not renamed | **Verify** — Task #24 may have addressed this. If not, rename. |
| EventStore/EventBus optional (two paths) | **Fix** — covered in Group 3 discussion |
| Mock provider still exists | **Fix** — covered in Group 4 |

### Files to change for flat callback removal

- `packages/core/src/Next/run.ts` — Remove `onEvent`, `onStateChange`, `onText`, `onPhaseChange` etc. from `RunOptions`. Keep only `observer` field.
- Any tests using flat callbacks — migrate to observer pattern
- `packages/core/src/index.ts` — Update exports if needed

### Documentation cleanup

- Delete `docs/plans/migration-plan.md` (old v1 plan, superseded by v2)
- Delete `HANDOFF.md` and `PLAN.md` if they exist (abandoned UI component library work)
- **FREEZE** `migration-plan-v2.md` — add a header marking it as historical/completed. The migration is finished. Do not update it. Write a new "current architecture" document instead.
- Clean up `docs/plans/validation-prompt.md` (git status shows deleted)

---

## Execution Order

Recommended sequence (respects dependencies):

```
1. Group 1  — Fix CLI providers (unblocks manual testing)
2. Group 2  — Fix OpenScaffold gaps (unblocks server-side execution)
3. Group 3  — Wire RuntimeConfig.database (resolve code path question first)
4. Group 6  — Remove flat callbacks, clean build artifacts, update docs
5. Group 4  — Record fixtures, replace mock provider (large, independent)
6. Group 5 Phase 1 — Integration tests (depends on Groups 1-3 being fixed)
7. Group 5 Phase 2 — Upgrade shallow tests (depends on Group 4 for fixtures)
8. Group 5 Phase 3 — Error path tests (depends on Group 4 for error fixtures)
```

---

## Open Questions — ALL RESOLVED

| # | Question | Decision |
|---|----------|----------|
| 1 | Group 2: How to opt out of provider validation? | **Still open** — implementer should use `providers: {}` as opt-out signal (simplest approach). If that's insufficient, revisit. |
| 2 | Group 3: Should InMemory fallback exist? | **RESOLVED** — No. Default to `~/.openscaffold/scaffold.db`. One code path, always persistent. |
| 3 | Group 4: Network error testing? | **RESOLVED** — Skip it. Cannot record real network failures. |
| 4 | Group 6: migration-plan-v2.md? | **RESOLVED** — Freeze as historical. Migration is complete. Write new "current architecture" doc. |
