# ADR-012: Phase Lifecycle Specification

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Phase Execution
**Related Issues:** ARCH-017
**Depends On:** [ADR-006](./006-state-sourcing-model.md) (State Sourcing Model)

---

## Context

The codebase has **under-specified phase semantics**:

| Gap | Current State | Risk |
|-----|-------------|------|
| Error handling | Undefined what happens when a phase throws | Workflow crashes silently or hangs |
| Recovery | No rollback or retry mechanism | Partial state mutations leave workflow in bad state |
| Guards | No validation before phase entry | Can enter phase with invalid state |
| Snapshots | Unclear when state snapshots are created | Resume points are unpredictable |
| Termination | Unclear how terminal phases work | May not properly clean up resources |

### Current Phase Execution (Simplified)

```typescript
// From Engine/phase.ts — current flow is linear with no error recovery
const runPhase = (phase: PhaseDef, state: S) => {
  // No guards, no validation
  // No try/catch around phase execution
  // No rollback on failure
  const result = phase.run(state)
  return result
}
```

### Critical Questions

1. **What happens when a phase throws?** Crash? Retry? Rollback? Pause?
2. **Can phases have preconditions/guards?** "Only enter this phase if X"
3. **Should failed phases be retryable?** With backoff? With modified state?
4. **How do we handle partial failures?** Agent returns malformed output?
5. **When exactly are snapshots created?** Start of phase? End? On state change?

---

## Decision

**Option C: Guards + Pre/Post Hooks with Configurable Retry**

Phases have a defined lifecycle with entry guards, setup/teardown hooks, and configurable error recovery. This provides enough structure for robust workflows without the complexity of a full state machine.

### Phase Lifecycle State Machine

```
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌──────────┐
│  Idle   │───▶│ Guard Check │───▶│  Before │───▶│  Running │
└─────────┘    └─────────────┘    └─────────┘    └─────┬────┘
                                                       │
                              ┌────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │   Completion    │
                    │ (success/error) │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │  After   │      │   Retry  │      │   Fail   │
    │ (success)│      │ (config) │      │ (terminal│
    └────┬─────┘      └────┬─────┘      │  error)  │
         │                 │            └──────────┘
         ▼                 │
    ┌──────────┐           │ (if attempts left)
    │  Next    │◄──────────┘
    │  Phase   │
    └──────────┘
```

### Selected Approach

```typescript
interface PhaseDef<S, Output = unknown> {
  // Core definition (existing)
  name?: string
  agent?: AgentDef<S, Output>
  human?: HumanConfig | ((state: S, output?: Output) => HumanConfig | null)
  next?: string | ((state: S, output?: Output) => string)
  terminal?: boolean

  // NEW: Lifecycle hooks
  guard?: (state: S) => boolean | Effect.Effect<boolean>
  before?: (state: S) => Effect.Effect<void>
  after?: (output: Output, state: S) => Effect.Effect<void>

  // NEW: Error recovery configuration
  onError?: PhaseErrorConfig<S>
}

interface PhaseErrorConfig<S> {
  // Retry configuration
  maxRetries?: number           // Default: 0 (no retry)
  backoff?: "fixed" | "exponential"
  delayMs?: number              // Base delay, doubles on exponential

  // Recovery strategy
  strategy: "fail" | "retry" | "pause"

  // Optional: Transform state before retry
  onRetry?: (error: unknown, state: S) => Effect.Effect<S>
}
```

---

## Guard Conditions

Phases can define entry guards that validate preconditions before execution.

### Guard Behavior

```typescript
const deployPhase = phase({
  name: "deploy",
  guard: (state) => state.buildStatus === "success",
  agent: deployAgent,
  next: "verify"
})
```

**Guard outcomes:**
- **Returns `true`**: Phase executes normally
- **Returns `false`**: Phase is **skipped**, workflow proceeds to `next` phase
- **Throws error**: Treated as phase failure, `onError` strategy applied

### Async Guards

For guards requiring I/O or complex validation:

```typescript
const expensivePhase = phase({
  name: "external-validation",
  guard: (state) => Effect.gen(function*() {
    const externalService = yield* ExternalService
    const isValid = yield* externalService.validate(state.data)
    return isValid
  }),
  agent: processAgent,
  terminal: true
})
```

---

## Snapshot Points

Per ADR-006 (State Sourcing), snapshots are created at specific points for resume/fork optimization.

### When Snapshots Are Created

| Point | When | Rationale |
|-------|------|-----------|
| **Phase End** | After successful phase completion | Natural checkpoint, state is stable |
| **Before HITL** | When `input:requested` event emitted | Resume should restart from HITL point |
| **On Pause** | When workflow paused | Explicit user checkpoint |
| **Every N events** | Configurable (default: 1000) | Recovery optimization |

### Snapshot Configuration

```typescript
interface WorkflowConfig {
  // ... other config
  snapshotEvery?: number  // Event count, default: 1000
}
```

**Note:** Snapshots are an optimization, not required for correctness. Event sourcing guarantees correct state replay from any point.

---

## Error Recovery Strategies

### Supported Strategies

| Strategy | Use Case | Behavior |
|----------|----------|----------|
| **fail** (default) | Unrecoverable errors, invalid state | Workflow terminates with `PhaseError` |
| **retry** | Transient errors (network, rate limits) | Re-run phase with exponential backoff |
| **pause** | Needs human intervention | Enter HITL state via ADR-002, wait for resume |

### Retry Configuration

```typescript
const flakyPhase = phase({
  name: "external-api",
  agent: apiAgent,
  onError: {
    strategy: "retry",
    maxRetries: 3,
    backoff: "exponential",
    delayMs: 1000  // 1s, 2s, 4s
  },
  next: "process"
})
```

### State Transformation on Retry

Sometimes you need to modify state before retrying:

```typescript
const retryWithBackoff = phase({
  name: "rate-limited",
  agent: apiAgent,
  onError: {
    strategy: "retry",
    maxRetries: 5,
    onRetry: (error, state) => Effect.succeed({
      ...state,
      retryCount: (state.retryCount ?? 0) + 1,
      lastError: error.message
    })
  }
})
```

### Pause for Human Input (HITL Integration)

Per ADR-002, phases can pause for human intervention:

```typescript
const criticalPhase = phase({
  name: "deploy-production",
  agent: deployAgent,
  onError: {
    strategy: "pause"  // Enters HITL, human decides retry/fail
  },
  human: {
    prompt: (state, error) => `Deploy failed: ${error.message}. Retry?`,
    type: "approval"
  }
})
```

---

## Alternatives Considered

### Option A: Simple Fail-Fast

**Rejected** — Too brittle for real-world workflows. Network hiccups, temporary rate limits, or transient provider errors would kill entire workflows.

### Option B: Retry with Backoff Only

**Rejected** — Retry alone doesn't handle cases requiring human judgment or complex setup/teardown. Guard conditions and lifecycle hooks are needed for robust workflows.

### Option D: Full State Machine

**Rejected** — Overkill for current needs. Explicit transition tables add complexity without clear benefit over the simpler hook-based approach. Can be added later if needed.

---

## Consequences

### Positive

- **Type-safe phase definitions** — Discriminated unions prevent invalid configs at compile time
- **Clear error handling** — Every phase defines its recovery strategy
- **Automatic retry** — Transient failures handled without code changes
- **Human intervention** — Pause strategy integrates with ADR-002 HITL
- **Preconditions** — Guards prevent entering phases with invalid state
- **Resource cleanup** — `after` hook ensures cleanup even on failure

### Negative

- **More complex phase definitions** — Additional configuration required
- **Retry can mask bugs** — Infinite retries on permanent failures waste resources
- **Ordering matters** — Hooks add implicit dependencies between phases

### Migration Path

1. Add optional `guard`, `before`, `after`, `onError` to `PhaseDef`
2. Default behavior unchanged (fail-fast if no `onError` specified)
3. Existing workflows continue working without modification
4. Gradually add lifecycle config to phases as needed

---

## Type-Safe Phase Definitions (Discriminated Unions)

The current `PhaseDef` interface has all optional fields, allowing invalid configurations at compile time. We fix this with discriminated unions:

```typescript
// ═══════════════════════════════════════════════════════════════
// Phase Types (Discriminated by 'type' field)
// ═══════════════════════════════════════════════════════════════

export interface AgentPhase<S, Phases extends string, Ctx = void> {
  readonly type: "agent"
  readonly name?: string
  readonly run: Ctx extends void ? AgentDef<S, any, void> : AgentDef<S, any, Ctx>
  readonly forEach?: (state: S) => ReadonlyArray<Ctx>
  readonly parallel?: number
  readonly until?: (state: S, output?: unknown) => boolean
  readonly human?: HumanConfig<S> | ((state: S, output?: unknown) => HumanConfig<S> | null)
  readonly onResponse?: (response: string, draft: Draft<S>) => void
  readonly next: Phases | ((state: S, output?: unknown) => Phases)

  // Lifecycle hooks (from this ADR)
  readonly guard?: (state: S) => boolean | Effect.Effect<boolean>
  readonly before?: (state: S) => Effect.Effect<void>
  readonly after?: (output: unknown, state: S) => Effect.Effect<void>
  readonly onError?: PhaseErrorConfig<S>
}

export interface HumanPhase<S, Phases extends string> {
  readonly type: "human"
  readonly name?: string
  readonly human: HumanConfig<S> | ((state: S) => HumanConfig<S>)
  readonly onResponse: (response: string, draft: Draft<S>) => void
  readonly next: Phases | ((state: S) => Phases)

  // Lifecycle hooks
  readonly guard?: (state: S) => boolean | Effect.Effect<boolean>
  readonly before?: (state: S) => Effect.Effect<void>
  readonly after?: (state: S) => Effect.Effect<void>
}

export interface TerminalPhase {
  readonly type: "terminal"
  readonly name?: string
}

// ═══════════════════════════════════════════════════════════════
// Union Type
// ═══════════════════════════════════════════════════════════════

export type PhaseDef<S, Phases extends string, Ctx = void> =
  | AgentPhase<S, Phases, Ctx>
  | HumanPhase<S, Phases>
  | TerminalPhase
```

### Factory Functions (Type-Safe)

```typescript
// Agent phase with full type inference
export function agentPhase<S, Phases extends string, Ctx = void>(
  def: Omit<AgentPhase<S, Phases, Ctx>, "type">
): AgentPhase<S, Phases, Ctx> {
  return { type: "agent", ...def }
}

// Human-only phase
export function humanPhase<S, Phases extends string>(
  def: Omit<HumanPhase<S, Phases>, "type">
): HumanPhase<S, Phases> {
  return { type: "human", ...def }
}

// Terminal phase
export function terminalPhase(name?: string): TerminalPhase {
  return { type: "terminal", name }
}

// Shorthand: phase.terminal()
export const terminal = terminalPhase
```

### Usage Examples

```typescript
// BEFORE (loose types, runtime errors)
const badPhase = phase({}) // Compiles, throws at runtime

// AFTER (strict types, compile-time errors)
const planning = agentPhase({
  type: "agent", // Discriminator
  run: planner,
  next: "coding"
})

const review = humanPhase({
  type: "human",
  human: { prompt: "Approve?", type: "approval" },
  onResponse: (response, draft) => { draft.approved = response === "yes" },
  next: "deploy"
})

const done = terminalPhase("done")

// In workflow definition
const workflow = defineWorkflow({
  phases: {
    planning,
    coding: agentPhase({ run: coder, next: "review" }),
    review,
    deploy: agentPhase({ run: deployer, terminal: terminalPhase() })
  }
})
```

### Migration Path

1. Add new discriminated union types alongside existing `PhaseDef`
2. Deprecate old `phase()` factory with JSDoc `@deprecated`
3. Update examples and docs to use new factories
4. In next major version, remove old interface

## Implementation Notes

### Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/Domain/Phase.ts` | Add `guard`, `before`, `after`, `onError` to `PhaseDef` |
| `packages/core/src/Engine/phase.ts` | Implement lifecycle execution: guard → before → run → after |
| `packages/core/src/Engine/runtime.ts` | Add error handling with retry logic, HITL integration |
| `packages/core/src/Services/StateCache.ts` | Emit `StateCheckpoint` event at snapshot points |

### Execution Flow

```typescript
const executePhase = <S, Output>(
  phase: PhaseDef<S, Output>,
  ctx: RuntimeContext<S>
): Effect.Effect<Output, PhaseError, Services> =>
  Effect.gen(function*() {
    // 1. Guard check
    if (phase.guard) {
      const canEnter = yield* Effect.tryPromise(() => Promise.resolve(phase.guard!(ctx.state)))
      if (!canEnter) {
        return yield* Effect.fail(new PhaseError({
          fromPhase: ctx.currentPhase,
          toPhase: phase.name ?? "unknown",
          message: "Guard condition failed"
        }))
      }
    }

    // 2. Before hook
    if (phase.before) {
      yield* phase.before(ctx.state)
    }

    // 3. Execute with retry logic
    const output = yield* executeWithRetry(phase, ctx)

    // 4. After hook (always runs on success)
    if (phase.after) {
      yield* phase.after(output, ctx.state)
    }

    // 5. Emit checkpoint event
    yield* emitCheckpoint(ctx)

    return output
  })

const executeWithRetry = <S, Output>(
  phase: PhaseDef<S, Output>,
  ctx: RuntimeContext<S>,
  attempt: number = 0
): Effect.Effect<Output, PhaseError, Services> =>
  Effect.gen(function*() {
    const result = yield* Effect.tryCatch(
      () => runAgent(phase.agent!, ctx.state),
      (error) => error
    )

    if (result._tag === "Right") {
      return result.right
    }

    const error = result.left
    const config = phase.onError ?? { strategy: "fail" }

    // Handle according to strategy
    switch (config.strategy) {
      case "fail":
        return yield* Effect.fail(new PhaseError({
          fromPhase: ctx.currentPhase,
          toPhase: phase.name ?? "unknown",
          message: String(error)
        }))

      case "retry":
        if (attempt < (config.maxRetries ?? 0)) {
          const delay = config.backoff === "exponential"
            ? (config.delayMs ?? 1000) * Math.pow(2, attempt)
            : (config.delayMs ?? 1000)

          yield* Effect.sleep(Duration.millis(delay))

          const newState = config.onRetry
            ? yield* config.onRetry(error, ctx.state)
            : ctx.state

          return yield* executeWithRetry(phase, { ...ctx, state: newState }, attempt + 1)
        }
        // Max retries exhausted, fail
        return yield* Effect.fail(new PhaseError({
          fromPhase: ctx.currentPhase,
          toPhase: phase.name ?? "unknown",
          message: `Max retries exceeded: ${error}`
        }))

      case "pause":
        // Trigger HITL via ADR-002
        yield* requestHumanInput(ctx, error)
        // After human response, retry once
        return yield* executeWithRetry(phase, ctx, attempt)
    }
  })
```

---

## Related Files

- `packages/core/src/Engine/phase.ts` — Current phase execution
- `packages/core/src/Engine/runtime.ts` — Workflow runtime
- `packages/core/src/Domain/Phase.ts` — Phase definitions
- [ADR-006](./006-state-sourcing-model.md) — State sourcing (snapshots, resume)
- [ADR-002](./002-hitl-architecture.md) — HITL (pause/resume on failure)

---

## Open Questions (Resolved)

1. ~~Should retry policies be defined per-phase, per-workflow, or global?~~ **Per-phase** — most flexible, workflow-level can be added later
2. ~~How many retry attempts before giving up? Configurable?~~ **Yes, configurable via `maxRetries`** — default 0 (no retry)
3. ~~Should guards be able to trigger automatic phase transitions?~~ **No** — guards are boolean, transitions handled by `next`
4. ~~Do we need a "compensating action" pattern (Saga) for rollback?~~ **Not for now** — event sourcing provides replay; rollback can be added if needed
5. ~~How do we surface phase failures to observers?~~ **Standard error events** — `phase:failed` event with error details
