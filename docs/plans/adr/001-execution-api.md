# ADR-001: Execution API Design

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Execution API Design
**Related Issues:** API-001, API-003, API-004, API-005, ARCH-003, DEAD-001, DEAD-002

---

## Context

The codebase had **6 different execution functions** exported from `@open-scaffold/core`:

| Function | Return Type | Purpose |
|----------|-------------|---------|
| `executeWorkflow()` | `Effect<WorkflowResult>` | Low-level Effect API |
| `streamWorkflow()` | `Stream<AnyEvent>` | Effect Stream (broken - doesn't actually stream) |
| `execute()` | `WorkflowExecution` | AsyncIterator + control methods |
| `run()` | `Promise<RunResult>` | Simple Promise + observer callbacks |
| `runSimple()` | `Promise<WorkflowResult>` | Convenience wrapper |
| `runWithText()` | `Promise<{text, result}>` | Convenience wrapper |

Plus 2 types adding confusion:
- `WorkflowHandle<S>` - Exported but **never implemented**
- `WorkflowExecution<S>` - Returned by `execute()`

### Problems Identified

1. **Too many choices** - Users don't know which to use
2. **Effect leaking into public API** - `executeWorkflow()` exposes Effect types
3. **`streamWorkflow()` is misleading** - Doesn't actually stream in real-time
4. **`WorkflowHandle` is a stub** - Exported interface with no implementation
5. **HITL gap in `run()`** - Can receive `input:requested` but can't respond
6. **Async iterator complexity** - `execute()` requires for-await pattern

---

## Decision

**Consolidate to a single public API: `run()`**

The `run()` function will return a `WorkflowExecution<S>` object that:
1. **Implements `PromiseLike`** - Can be awaited directly
2. **Has control methods** - `pause()`, `resume()`, `abort()`
3. **Uses observer callbacks** - Events delivered via callbacks, not async iterator
4. **Supports HITL** - `onInputRequested` callback returns the response

### New API Shape

```typescript
interface WorkflowExecution<S> extends PromiseLike<WorkflowResult<S>> {
  readonly sessionId: string
  readonly isPaused: boolean
  pause(): void
  resume(): void
  abort(): void
}

interface RunOptions<S, Input> {
  readonly input: Input
  readonly runtime: RuntimeConfig
  readonly sessionId?: string
  readonly signal?: AbortSignal
  readonly observer?: WorkflowObserver<S>
}

function run<S, Input>(
  workflow: WorkflowDef<S, Input>,
  options: RunOptions<S, Input>
): WorkflowExecution<S>
```

### Usage Examples

```typescript
// Simple: just await
const result = await run(workflow, { input: "Hello", runtime })

// With streaming
const result = await run(workflow, {
  input: "Hello",
  runtime,
  observer: {
    onTextDelta: ({ delta }) => process.stdout.write(delta)
  }
})

// With HITL - return value from callback becomes response
const result = await run(workflow, {
  input: "Hello",
  runtime,
  observer: {
    onInputRequested: async (request) => {
      return await promptUser(request.prompt)
    }
  }
})

// With pause/resume
const execution = run(workflow, { input: "Hello", runtime })
execution.pause()
execution.resume()
const result = await execution
```

---

## What Gets Removed from Public API

| Export | Reason |
|--------|--------|
| `execute()` | Merged into `run()` |
| `executeWorkflow()` | Internal only (server uses directly) |
| `streamWorkflow()` | Broken (doesn't actually stream) |
| `runSimple()` | Redundant (just `await run(...)`) |
| `runWithText()` | Redundant (use `observer.onTextDelta`) |
| `WorkflowHandle` | Never implemented |
| `WorkflowExecution` type | Renamed/merged into run's return type |

---

## What Gets Kept

| Export | Notes |
|--------|-------|
| `run()` | Enhanced to return `WorkflowExecution<S>` |
| Observer pattern | Events via callbacks |
| AbortSignal support | Via `options.signal` |
| Pause/resume | Via returned execution handle |

---

## Alternatives Considered

### Option A: Keep All 6 Functions
- Document when to use each
- **Rejected:** Too confusing, no clear guidance

### Option B: Keep 3 Functions (Effect / Iterator / Promise)
- `executeWorkflow()` for Effect users
- `execute()` for async iterator
- `run()` for Promise
- **Rejected:** Still leaks Effect, async iterator adds complexity

### Option C: Keep Only `run()` Without Enhancements
- Simple Promise API
- **Rejected:** No HITL support, no pause/resume

### Option D (Chosen): Enhanced `run()` with Control Methods
- Single entry point
- Observer callbacks (not async iterator)
- Returns awaitable handle with control methods
- **Accepted:** Best DX, covers all use cases

---

## Consequences

### Positive
- Single clear way to run workflows
- No Effect in public API
- Familiar patterns (Promise, callbacks, AbortSignal)
- HITL via async callback return values
- Pause/resume available when needed

### Negative
- Breaking change for users of `execute()`
- Async iterator pattern removed (some may prefer it)
- Need to migrate tests from `execute()` to `run()`

### Migration Path
1. Users using `await run(...)` - No change needed
2. Users using `execute()` for-await - Switch to `run()` with observer callbacks
3. Users using `execute().respond()` - Switch to `onInputRequested` returning response

---

## Implementation Notes

1. **`onInputRequested` must be async-aware** - Runtime waits for callback to return
2. **Pause/resume wiring** - Already exists in runtime, just needs to be exposed
3. **`executeWorkflow()` stays internal** - Server package imports directly from Engine/runtime.ts
4. **Remove from index.ts** - Only export `run()` and related types

---

## Related Files

- `packages/core/src/Engine/run.ts` - Enhance to return `WorkflowExecution`
- `packages/core/src/Engine/execute.ts` - Remove or make internal
- `packages/core/src/Engine/runtime.ts` - Keep `executeWorkflow()` internal
- `packages/core/src/index.ts` - Update exports
