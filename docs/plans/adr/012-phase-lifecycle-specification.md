# ADR-012: Phase Lifecycle Specification

**Status:** Proposed
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

**TODO:** Decide on phase lifecycle semantics after discussion

### Lifecycle States

> **TODO:** Define state machine

```
Pending → Guard Check → Running → (Success | Failure)
                                          ↓
                                    (Retry | Rollback | Terminal)
```

### Options to Consider

**Option A: Simple Fail-Fast**

```typescript
// Phase throws → workflow fails immediately
// No retry, no rollback
// Simplest, but brittle
interface PhaseLifecycle {
  onError: "fail"  // Only option
}
```

**Option B: Retry with Backoff**

```typescript
// Phase can define retry policy
interface PhaseConfig {
  retry?: {
    maxAttempts: number
    backoff: "fixed" | "exponential"
    delayMs: number
  }
  onExhausted: "fail" | "skip" | "terminal"
}
```

**Option C: Guards + Pre/Post Hooks**

```typescript
// Rich lifecycle with hooks
interface PhaseLifecycle<S> {
  guard?: (state: S) => boolean | Effect<boolean>
  before?: (state: S) => Effect<void>  // Setup
  run: (state: S) => Effect<Output>
  after?: (output: Output, state: S) => Effect<void>  // Cleanup
  onError: (error: unknown, state: S) => Effect<"retry" | "rollback" | "fail">
}
```

**Option D: State Machine with Explicit Transitions**

```typescript
// Phases define valid transitions
const phase = definePhase({
  name: "planning",
  transitions: {
    success: { to: "coding", guard: hasValidPlan },
    failure: { to: "planning", retry: true },  // Self-retry
    maxRetries: { to: "terminal" }
  }
})
```

---

## Guard Conditions

> **TODO:** Decide if phases need entry guards

```typescript
// Example: Only enter "deploy" phase if we have a valid build
const deployPhase = phase({
  name: "deploy",
  guard: (state) => state.buildStatus === "success",
  run: async (state) => { ... }
})

// Guard failure options:
// A: Skip phase (jump to next)
// B: Fail workflow
// C: Auto-run prerequisite phase first
```

---

## Snapshot Points

> **TODO:** Define when snapshots are created

| Point | Pros | Cons |
|-------|------|------|
| Phase start | Clean resume point | Might miss state from previous phase |
| Phase end | Captures all phase work | Failed phase = no snapshot |
| Every state change | Finest granularity | Too many snapshots, overhead |
| Terminal phases only | Minimal overhead | Coarse resume granularity |

---

## Error Recovery Strategies

> **TODO:** Define recovery options

| Strategy | When to Use | Implementation |
|----------|-------------|----------------|
| **Fail** | Unrecoverable errors | Throw, terminate workflow |
| **Retry** | Transient errors (network) | Re-run same phase with backoff |
| **Rollback** | Partial state mutation bad | Revert to pre-phase snapshot, retry |
| **Skip** | Optional phase failed | Log warning, continue to next |
| **Pause** | Needs human intervention | Enter HITL state, wait for resume |

---

## Alternatives Considered

> **TODO:** Fill in after discussion

---

## Consequences

> **TODO:** Fill in after decision

---

## Implementation Notes

> **TODO:** Fill in after decision

### Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/Engine/phase.ts` | Add lifecycle hooks, guard checks |
| `packages/core/src/Engine/runtime.ts` | Handle phase errors with recovery strategy |
| `packages/core/src/Domain/Phase.ts` | Add PhaseLifecycle interface |
| `packages/core/src/Services/StateCache.ts` | Ensure snapshots align with lifecycle |

---

## Related Files

- `packages/core/src/Engine/phase.ts` — Current phase execution
- `packages/core/src/Engine/runtime.ts` — Workflow runtime
- `packages/core/src/Domain/Phase.ts` — Phase definitions
- [ADR-006](./006-state-sourcing-model.md) — State sourcing (snapshots, resume)
- [ADR-002](./002-hitl-architecture.md) — HITL (pause/resume on failure)

---

## Open Questions

1. Should retry policies be defined per-phase, per-workflow, or global?
2. How many retry attempts before giving up? Configurable?
3. Should guards be able to trigger automatic phase transitions?
4. Do we need a "compensating action" pattern (Saga) for rollback?
5. How do we surface phase failures to observers? Same events or special error events?
