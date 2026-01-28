# Stub Layers

**Date**: 2026-01-26
**Status**: Implementation Complete
**Package**: `@open-scaffold/core`

This document describes the stub layer pattern used for compile-time architecture validation.

---

## Purpose

Stub layers serve one purpose: **prove the architecture compiles**.

They are not for testing. They are not for development. They exist to validate that:
1. All service dependencies are satisfied
2. Effect type signatures align
3. The Layer composition graph is complete

```typescript
// If this compiles, the architecture is valid
const AppLayerStub = Layer.mergeAll(
  EventStoreStub,
  StateSnapshotStoreStub,
  ProviderRecorderStub,
  EventBusStub,
  AgentServiceStub,
  WorkflowRuntimeStub,
)

// Type-check only - never run
type Validated = Effect.Effect<void, never, never>
const _: Validated = Effect.void.pipe(Effect.provide(AppLayerStub))
```

---

## Design Pattern

Every stub follows this pattern:

```typescript
// Stub dies immediately if called
const EventStoreStub = Layer.succeed(
  EventStore,
  EventStore.of({
    append: () => Effect.die("EventStore.append not implemented"),
    getEvents: () => Effect.die("EventStore.getEvents not implemented"),
    getEventsFrom: () => Effect.die("EventStore.getEventsFrom not implemented"),
    listSessions: () => Effect.die("EventStore.listSessions not implemented"),
    deleteSession: () => Effect.die("EventStore.deleteSession not implemented"),
  })
)
```

**Why Effect.die?** Immediate termination with clear message. No confusion about stub behavior.

**Why not Effect.fail?** Failure implies recoverable error. Stubs should never be "recovered from."

---

## Available Stubs

### EventStoreStub

```typescript
const EventStoreStub = Layer.succeed(
  EventStore,
  EventStore.of({
    append: () => Effect.die("EventStore.append not implemented"),
    getEvents: () => Effect.die("EventStore.getEvents not implemented"),
    getEventsFrom: () => Effect.die("EventStore.getEventsFrom not implemented"),
    listSessions: () => Effect.die("EventStore.listSessions not implemented"),
    deleteSession: () => Effect.die("EventStore.deleteSession not implemented"),
  })
)
```

---

### StateSnapshotStoreStub

```typescript
const StateSnapshotStoreStub = Layer.succeed(
  StateSnapshotStore,
  StateSnapshotStore.of({
    getLatest: () => Effect.succeed(null),  // No snapshots
    save: () => Effect.die("StateSnapshotStore.save not implemented"),
    delete: () => Effect.die("StateSnapshotStore.delete not implemented"),
  })
)
```

**Why getLatest returns null?** Many programs check for snapshots optionally. Returning null allows programs to fall back to event replay without dying.

---

### ProviderRecorderStub

```typescript
const ProviderRecorderStub = Layer.succeed(
  ProviderRecorder,
  ProviderRecorder.of({
    load: () => Effect.die("ProviderRecorder.load not implemented"),
    save: () => Effect.die("ProviderRecorder.save not implemented"),
    delete: () => Effect.die("ProviderRecorder.delete not implemented"),
    list: () => Effect.die("ProviderRecorder.list not implemented"),
  })
)
```

---

### EventBusStub

```typescript
const EventBusStub = Layer.succeed(
  EventBus,
  EventBus.of({
    publish: () => Effect.die("EventBus.publish not implemented"),
    subscribe: () => Stream.die("EventBus.subscribe not implemented"),
  })
)
```

**Why Stream.die?** The subscribe method returns a Stream, not an Effect. Use Stream.die for consistency.

---

### AgentServiceStub

```typescript
const AgentServiceStub = Layer.succeed(
  AgentService,
  AgentService.of({
    run: () => Stream.die("AgentService.run not implemented"),
  })
)
```

---

### WorkflowRuntimeStub

```typescript
const WorkflowRuntimeStub = Layer.succeed(
  WorkflowRuntime,
  WorkflowRuntime.of({
    run: () => Effect.die("WorkflowRuntime.run not implemented"),
    observe: () => Stream.die("WorkflowRuntime.observe not implemented"),
  })
)
```

---

## Layer Composition

Stubs compose just like real implementations:

```typescript
// Stub layer for architecture validation
const CoreStubLayer = Layer.mergeAll(
  EventStoreStub,
  StateSnapshotStoreStub,
  ProviderRecorderStub,
  EventBusStub,
)

// Test that programs type-check against stubs
const programTypeCheck = Effect.gen(function* () {
  const eventStore = yield* EventStore
  const events = yield* eventStore.getEvents(sessionId)
  // ...
}).pipe(Effect.provide(CoreStubLayer))

// Compilation success = architecture valid
```

---

## When to Use Stubs

### Use Stubs For

1. **CI type checking** - Validate architecture without running code
2. **IDE feedback** - Catch type errors before running tests
3. **Incremental development** - Define contracts before implementations

### Don't Use Stubs For

1. **Unit tests** - Use real in-memory implementations
2. **Integration tests** - Use real LibSQL with :memory:
3. **Development** - Use real implementations

---

## Real vs Stub Implementations

| Service | Stub | Real Implementation |
|---------|------|---------------------|
| EventStore | EventStoreStub | EventStoreLive |
| StateSnapshotStore | StateSnapshotStoreStub | StateSnapshotStoreLive |
| ProviderRecorder | ProviderRecorderStub | ProviderRecorderLive |
| EventBus | EventBusStub | EventBusLive (PubSub) |
| AgentService | AgentServiceStub | AgentServiceLive |
| WorkflowRuntime | WorkflowRuntimeStub | WorkflowRuntimeLive |

---

## Testing Approach

Stubs are NOT for testing. Here's the correct testing approach:

### Unit Tests

Use real implementations with in-memory storage:

```typescript
const TestLayer = Layer.mergeAll(
  EventStoreLive({ url: ":memory:" }),
  StateSnapshotStoreLive({ url: ":memory:" }),
  ProviderRecorderLive({ url: ":memory:" }),
  EventBusLive,
)
```

### Integration Tests

Use real implementations with temporary files:

```typescript
const IntegrationLayer = Layer.mergeAll(
  EventStoreLive({ url: "file:./tmp/test.db" }),
  // ...
)
```

### Recording-Based Tests

Record once in live mode, replay forever in playback:

```typescript
// Record: live mode
const scaffold = await OpenScaffold.create({
  dbUrl: "file:./data/test.db",
  mode: "live"
})
// Run test against real SDK

// Replay: playback mode
const scaffold = await OpenScaffold.create({
  dbUrl: "file:./data/test.db",
  mode: "playback"
})
// Run test with recorded responses
```

---

## File Structure

```
packages/core/src/Layers/
├── Stubs/
│   ├── EventStoreStub.ts
│   ├── StateSnapshotStoreStub.ts
│   ├── ProviderRecorderStub.ts
│   ├── EventBusStub.ts
│   ├── AgentServiceStub.ts
│   ├── WorkflowRuntimeStub.ts
│   └── index.ts           # Re-exports all stubs
├── Logger.ts              # Logger configurations
└── index.ts               # Layer exports
```

---

## Validation Script

Add to CI to validate architecture:

```typescript
// scripts/validate-architecture.ts
import { Effect, Layer } from "effect"
import {
  EventStoreStub,
  StateSnapshotStoreStub,
  ProviderRecorderStub,
  EventBusStub,
  AgentServiceStub,
  WorkflowRuntimeStub,
} from "@open-scaffold/core"

const AppLayerStub = Layer.mergeAll(
  EventStoreStub,
  StateSnapshotStoreStub,
  ProviderRecorderStub,
  EventBusStub,
  AgentServiceStub,
  WorkflowRuntimeStub,
)

// This line type-checks. If it compiles, architecture is valid.
const _: Effect.Effect<void, never, never> = Effect.void.pipe(
  Effect.provide(AppLayerStub)
)

console.log("Architecture validation passed")
```

Run with:

```bash
npx tsx scripts/validate-architecture.ts
```

---

## Summary

| Principle | Practice |
|-----------|----------|
| Stubs die on call | Use `Effect.die()` / `Stream.die()` |
| Stubs are for type checking | Never run stub code in production or tests |
| Same interface as real | Stub implements exact same service interface |
| Compose like real layers | Use `Layer.mergeAll` to validate composition |

---

## Back to Docs

- [01-domain-map.md](./01-domain-map.md) - Domain entities and services
- [02-service-contracts.md](./02-service-contracts.md) - Service interfaces
- [03-effect-programs.md](./03-effect-programs.md) - Effect programs
