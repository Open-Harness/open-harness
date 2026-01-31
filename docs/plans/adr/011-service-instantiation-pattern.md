# ADR-011: Service Instantiation Pattern

**Status:** Accepted
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

**Chosen Approach:** Option A — Standardized Layer Factories

We will use a centralized factory function `makeAppLayer` that takes a configuration object and returns the appropriate Layer composition. This provides a single source of truth for service wiring while remaining flexible across environments.

### Rationale

| Criterion | Option A | Option B | Option C | Option D |
|-----------|----------|----------|----------|----------|
| Testability | ✅ Easy config swap | ⚠️ Separate presets | ⚠️ Manual per-call | ❌ Runtime registry |
| Explicitness | ✅ Config visible | ✅ Clear intent | ✅ At call site | ❌ Hidden in container |
| Composability | ✅ Effect-native | ✅ Effect-native | ✅ Effect-native | ❌ Custom pattern |
| DRY | ✅ Single factory | ❌ Duplication | ❌ Repetition everywhere | ⚠️ Registration boilerplate |
| Type Safety | ✅ Full | ✅ Full | ✅ Full | ⚠️ Runtime errors possible |

Option A best balances flexibility with consistency. It preserves Effect's Layer system, makes dependencies visible through the config object, and avoids the duplication of environment-specific presets.

### Selected Pattern

```typescript
// packages/core/src/Layers/AppLayer.ts
export interface AppLayerConfig {
  database: string
  mode: "live" | "playback"
  enableRecorder?: boolean
}

export const makeAppLayer = (config: AppLayerConfig) =>
  Layer.mergeAll(
    EventStoreLive({ url: config.database }),
    EventBusLive,
    StateSnapshotStoreLive({ url: config.database }),
    ProviderModeContextLive(config.mode),
    config.enableRecorder 
      ? ProviderRecorderLive({ url: config.database })
      : Layer.empty
  )
```

### Usage Patterns

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

### Positive

- **Single source of truth** for service composition — all environments use the same factory
- **Explicit configuration** makes dependencies visible and required
- **Easy testing** — swap to `:memory:` database and `playback` mode via config
- **Type-safe** — invalid configurations caught at compile time
- **Extensible** — adding new services only requires updating the factory

### Negative

- **Config object may grow** — as services are added, the config interface expands
- **All services wired together** — even if a particular flow doesn't need all services
- **Breaking change** for existing code using ad-hoc layer composition

### Mitigations

- Use `Layer.empty` for optional services instead of making everything required
- Group related config into sub-objects (e.g., `database: { url, authToken }`)
- Document that `makeAppLayer` is the blessed path — code review any inline `Layer.mergeAll`

---

## Implementation Notes

### Implementation Strategy

1. Create `AppLayer.ts` with `makeAppLayer` factory
2. Create `TestLayer.ts` as thin wrapper around `makeAppLayer` with test defaults
3. Refactor existing code to use factories (one package at a time)
4. Add lint rule to discourage inline `Layer.mergeAll` outside layer files

### Optional Services Pattern

For services that aren't always needed (e.g., ProviderRecorder):

```typescript
config.enableRecorder 
  ? ProviderRecorderLive({ url: config.database })
  : Layer.empty
```

The Effect runtime will ignore `Layer.empty`, so the program only gets the services it needs.

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
