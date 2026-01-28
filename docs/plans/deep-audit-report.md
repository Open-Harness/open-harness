# Deep Audit Report: Codex Migration

**Date:** 2026-01-27
**Scope:** All 18 completed tasks + CLI (Task #19 in-progress)
**Method:** Code inspection, test execution, dependency chain analysis

---

## 1. Executive Summary

All 18 completed tasks pass their stated Definition of Done criteria at the code level. However, a deeper investigation reveals **systemic gaps** in integration testing, provider wiring, and layer construction that mean the system does not work end-to-end despite individual tasks passing.

**Key findings:**
- CLI cannot run any workflow (missing provider registration)
- OpenScaffold.ts is missing ProviderModeContext in its service layer
- 39% of tests are shallow (type/structure checks, not behavior)
- Zero error-path tests exist
- No end-to-end integration test exercises the full pipeline

---

## 2. Critical Integration Gaps

### Gap A: CLI Provider Registration (Task #19)

**Severity:** BLOCKING — CLI is non-functional

**Location:** `apps/cli/src/commands/run.tsx:32-35`

**Problem:** `runCommand` creates `OpenScaffold.create({ database, mode })` without passing `providers`. The server's ProviderRegistry is empty. Any workflow with an agent phase fails immediately:

```
ProviderNotFoundError: No provider registered for model: claude-sonnet-4-5
```

**Fix required:** Import `AnthropicProvider` and register it:
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

**Open question:** Should providers be auto-detected from the workflow's agent definitions instead of hardcoded?

---

### Gap B: OpenScaffold Missing ProviderModeContext

**Severity:** HIGH — affects all server-side workflow execution

**Location:** `packages/server/src/OpenScaffold.ts:108-113`

**Problem:** The `AppServices` type union does not include `ProviderModeContext`:
```typescript
type AppServices =
  | Services.EventStore
  | Services.StateSnapshotStore
  | Services.EventBus
  | Services.ProviderRecorder
  | ProviderRegistry
  // ProviderModeContext is MISSING
```

The `combinedLayer` built in `create()` (lines 174-195) also does not include a `ProviderModeContext` layer. The `createServer()` method passes `mode` to the underlying `createServer` function (line 228), which constructs its own `ProviderModeContext` layer — so the server path works. But if `OpenScaffold`'s runtime is ever used to run workflows directly (not through the HTTP server), it will fail.

**Fix required:** Add `ProviderModeContext` to both `AppServices` and `combinedLayer`.

---

### Gap C: Empty ProviderRegistry Fails Silently

**Severity:** MEDIUM — poor developer experience

**Locations:**
- `packages/core/src/Next/execute.ts:299-305`
- `packages/server/src/http/Server.ts:299-306`
- `packages/server/src/OpenScaffold.ts:173-185`

**Problem:** All three entry points create a ProviderRegistry even when `providers` is empty or undefined. The registry is valid (no error), but any agent execution immediately fails with `ProviderNotFoundError`. There's no early validation or warning.

**Fix required:** Either:
1. Validate at construction time that the workflow's required models have providers, OR
2. Log a warning when ProviderRegistry is empty but workflow contains agent phases

---

### Gap D: RuntimeConfig.database is Misleading

**Severity:** LOW — API confusion

**Location:** `packages/core/src/Next/execute.ts:68-76`

**Problem:** `RuntimeConfig` has a `database?: string` field documented as "Used by the server package." But `execute()` never reads it — events always go to InMemoryEventStore unless `eventStore` is explicitly provided. A developer passing `database: "./my.db"` to `execute()` would expect persistence but get in-memory storage.

**Fix required:** Either remove the field from `RuntimeConfig` or wire it to construct a LibSQL-backed EventStore.

---

## 3. Test Quality Assessment

### Overview

| Category | Count | Solid | Shallow | Gap |
|----------|-------|-------|---------|-----|
| Core tests | 14 | 6 | 8 | 0 |
| Server tests | 9 | 7 | 1 | 1 |
| **Total** | **23** | **13** | **9** | **1** |

**Grade: B-** — 57% of tests exercise real behavior.

### Solid Tests (13)

These tests exercise real Effect pipelines, actual persistence, and behavioral contracts:

- `compute-state-at.test.ts` — Pure function, comprehensive edge cases
- `in-memory-layers.test.ts` — Real EventStore/EventBus operations
- `next-runtime.test.ts` — State init, Immer patches, phase transitions
- `next-observer.test.ts` — Observer callback order, lifecycle
- `next-hitl.test.ts` — Queue wiring, respond() unblocking
- `next-resume.test.ts` — Resume from checkpoint, skip start()
- `next-execute.test.ts` (streaming tests) — Real-time event ordering
- `interaction.test.ts` — Interaction creation, response handling
- `eventbus-live.test.ts` — Session isolation in PubSub
- `programs.test.ts` — Persistence, fork behavior, determinism
- `provider-recording.test.ts` — Real SDK recording + playback round-trip
- `vcr-integration.test.ts` — Full HTTP server with real stores
- `vcr-routes.test.ts` — Individual route behavior

### Shallow Tests (9)

These only test types, shapes, and factory validation — NOT runtime behavior:

- `next-agent.test.ts` — Agent factory fields only. Never executes agent in workflow.
- `next-workflow.test.ts` — Workflow factory structure. No execution.
- `next-phase.test.ts` — Phase factory shapes. No phase execution.
- `next-types.test.ts` — Constants and error constructors. Compile-time checks.
- `next-config.test.ts` — Interface field acceptance. No behavioral test.
- `next-run.test.ts` — Callback signatures. Doesn't verify callbacks fire.
- `next-execute.test.ts` (interface tests) — Shape checks only.
- `provider-streaming.test.ts` — Mock provider stream shape. No real SDK.
- `hitl-integration.test.ts` — Marked as failing (timeout issues).

### Missing Test Categories

1. **No EventStore integration test** — No test verifies events are persisted to EventStore during workflow execution
2. **No EventBus integration test** — No test verifies EventBus publishes events during execution (only tested in isolation)
3. **No ProviderRegistry pipeline test** — No test exercises: registry lookup → provider.stream() → agent result
4. **No error path tests** — No tests for: rate limits, auth failures, context exceeded, network errors, invalid output schemas, abort/cancellation
5. **No recording round-trip in core** — `provider-recording.test.ts` (server) tests this, but core has no equivalent
6. **No end-to-end CLI test** — CLI is never exercised in tests

---

## 4. Mock Provider Limitations

**File:** `packages/core/test/helpers/mock-provider.ts`

The `createMockProvider` helper returns canned responses based on prompt substring matching. Issues:

1. **No output schema validation** — Mock returns any object. Real SDK validates against Zod schema. Tests pass with invalid shapes.
2. **No streaming simulation** — Events are pre-built into array and emitted instantly. Real SDK sends deltas over time.
3. **No tool use** — No tool_use/tool_result events. Agent tool paths untested.
4. **No error simulation** — Cannot test rate limits, network errors, auth failures.
5. **noopRecorder** returns `Effect.void` for all methods — recording pipeline never exercised in core tests.

**Per CLAUDE.md philosophy:** The project mandates "no mocks" and real recordings. The mock provider violates this — it should be replaced with `ProviderRecorder` playback of real recorded responses.

---

## 5. Layer Dependency Chain

### What executeWorkflow Requires (R type)

From `runtime.ts:571-577`:
```
ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
```

### Provider Matrix by Entry Point

| Entry Point | ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus | Notes |
|---|---|---|---|---|---|---|
| `execute()` | From runtime.providers | noop fallback | From runtime.mode | InMemory fallback | InMemory fallback | All provided |
| `run()` | From runtime.providers | noop fallback | From runtime.mode | InMemory fallback | InMemory fallback | All provided |
| `Server.ts` | From options.providers | From options | From options | From options | Created inline | All provided |
| `OpenScaffold.ts` | From config.providers | LibSQL-backed | **MISSING** | LibSQL-backed | Live PubSub | ProviderModeContext gap |
| CLI `runCommand` | **MISSING** | Via OpenScaffold | Via OpenScaffold | Via OpenScaffold | Via OpenScaffold | No providers passed |
| Test helpers | Mock provider | noop | "live" | InMemory | InMemory | All provided |

---

## 6. Test Failures (Current)

```
Test Files:  2 failed | 22 passed (24)
Tests:       4 failed | 219 passed (223)
Typecheck:   PASSES (all 5 packages)
```

**Failing tests:**
1. `client/hooks.test.tsx` — Uses old `define-event [OLD]` API (3 failures)
2. `client/http-client-vcr.test.ts` — fetch mock count assertion (1 failure)

Both are client-side and expected to be addressed by a client test rewrite.

---

## 7. Recommendations

### Priority 1: Fix Blocking Issues
1. Wire AnthropicProvider into CLI `runCommand`
2. Add ProviderModeContext to OpenScaffold.ts
3. Add early validation for empty ProviderRegistry when workflow has agents

### Priority 2: Replace Mock Provider
Per CLAUDE.md "no mocks" philosophy:
1. Record real Anthropic responses for test workflows
2. Use ProviderRecorder playback in tests instead of createMockProvider
3. Commit recorded fixtures to repo

### Priority 3: Add Integration Tests
1. Workflow → EventStore persistence verification
2. Workflow → EventBus real-time broadcast verification
3. ProviderRegistry → provider.stream() → result pipeline
4. Full CLI end-to-end test (run + replay)

### Priority 4: Add Error Path Tests
1. ProviderNotFoundError when model missing
2. Rate limit / network error handling
3. Invalid output schema handling
4. Workflow abort / cancellation cleanup

### Priority 5: Upgrade Shallow Tests
Add execution tests to: next-agent, next-workflow, next-phase, next-run, next-config
