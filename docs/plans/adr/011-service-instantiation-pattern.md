# ADR-011: Service Instantiation Pattern

**Status:** Proposed
**Date:** 2026-01-29
**Decision Area:** Service Architecture
**Related Issues:** ARCH-002

---

## Context

The codebase has **inconsistent patterns** for how services are instantiated and wired together:

| Location | Pattern | Problem |
|----------|---------|---------|
| `Server.ts` | `ManagedRuntime.make(fullLayer)` inside `createServer()` | Runtime created imperatively, hard to test |
| `Engine/runtime.ts` | `Layer.mergeAll(...).pipe(Effect.provide(...))` | Different composition style |
| `test/helpers.ts` | `Layer.mergeAll(...)` with explicit in-memory layers | Yet another pattern |

### Root Causes

1. **No standardized Layer composition pattern** — Each package invents its own
2. **ManagedRuntime vs pure Effect** — Server uses ManagedRuntime for long-running; core uses pure Effect
3. **Test layer setup is ad-hoc** — Tests manually compose layers differently each time
4. **No clear boundary** — When to use `Layer.succeed` vs `Layer.effect` vs `Layer.scoped`

### Critical Question

How do we standardize service instantiation across:
- **Production server** (long-running, ManagedRuntime)
- **Core execution** (pure Effect, short-lived)
- **Tests** (ephemeral, in-memory)
- **Client** (browser environment, different constraints)

---

## Decision

**TODO:** Decide on standardized pattern after discussion

### Options to Consider

**Option A: Standardized Layer Factories**

```typescript
// packages/core/src/Layers/AppLayer.ts
export const makeAppLayer = (config: AppConfig) =>
  Layer.mergeAll(
    EventStoreLive({ url: config.database }),
    EventBusLive,
    StateSnapshotStoreLive({ url: config.database }),
    ProviderModeContextLive(config.mode),
    // ... etc
  )

// Server usage
const layer = makeAppLayer({ database: "./data.db", mode: "live" })
const runtime = ManagedRuntime.make(layer)

// Test usage
const testLayer = makeAppLayer({ database: ":memory:", mode: "playback" })
```

**Option B: Environment-Specific Presets**

```typescript
// Pre-defined layer combinations
export const ProductionLayers = Layer.mergeAll(...)
export const TestLayers = Layer.mergeAll(InMemoryEventStore, ...)
export const BrowserLayers = Layer.mergeAll(HttpEventStore, ...)
```

**Option C: Explicit Service Tags with Defaults**

```typescript
// Each service provides a default layer
export const EventStoreLive = Layer.effect(...)
export const EventStoreTest = Layer.effect(InMemoryEventStore)

// Caller explicitly chooses
const program = myEffect.pipe(
  Effect.provide(EventStoreTest) // or EventStoreLive
)
```

**Option D: Dependency Injection Container**

```typescript
// Registry pattern
const container = new Container()
container.register(EventStore, () => new EventStoreLive(...))
container.register(EventBus, () => new EventBusLive())
```

---

## Design Principles

> **TODO:** Agree on principles

| Principle | Description |
|-----------|-------------|
| Testability | Must be easy to swap real services for test doubles |
| Explicitness | Dependencies should be visible, not hidden in globals |
| Composability | Layers should compose without conflicts |
| Environment-aware | Different environments (node, browser, test) have different needs |
| Fail-fast | Invalid configuration should throw immediately, not at runtime |

---

## Alternatives Considered

> **TODO:** Fill in after discussion

---

## Consequences

> **TODO:** Fill in after decision

---

## Implementation Notes

> **TODO:** Fill in after decision

### Files to Create

| File | Purpose |
|------|---------|
| `packages/core/src/Layers/AppLayer.ts` | Centralized layer composition |
| `packages/core/src/Layers/TestLayer.ts` | Test-specific layer preset |
| `packages/server/src/Layers/ServerLayer.ts` | Server-specific additions |

### Files to Refactor

| File | Current | New |
|------|---------|-----|
| `server/src/http/Server.ts` | Inline `Layer.mergeAll` | Use `AppLayer` factory |
| `core/src/Engine/runtime.ts` | Direct layer usage | Use `AppLayer` factory |
| `testing/src/helpers.ts` | Ad-hoc layer setup | Use `TestLayer` preset |

---

## Related Files

- `packages/server/src/http/Server.ts` — Current ManagedRuntime usage
- `packages/core/src/Engine/runtime.ts` — Core execution layer setup
- `packages/core/src/Layers/*.ts` — Existing layer definitions
- `packages/testing/src/helpers.ts` — Test layer composition

---

## Open Questions

1. Should we have a single `AppLayer` factory with config, or environment-specific presets?
2. How do we handle optional services (e.g., ProviderRecorder is required for server but not for core)?
3. Should Layer composition be eager (module load) or lazy (first use)?
4. How do we enforce that tests always use test doubles, not real services?
