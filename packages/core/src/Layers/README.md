# Layers

Service implementations. Stubs for validation, Live for production.

## Layer Composition

```
┌─────────────────────────────────────────────────────────────┐
│                     AppLayerStub                             │
│  (proves architecture compiles - all stubs composed)         │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  EventStoreStub   StateSnapshotStoreStub   EventBusStub
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      AgentServiceStub  WorkflowRuntimeStub  AgentFixtureStoreStub
```

Note: StateCache is a factory function (not a Context.Tag service), so it has no stub.
It is created at runtime by programs that need typed state caching.

## Directory Structure

```
Layers/
├── Stubs/
│   ├── EventStoreStub.ts
│   ├── StateSnapshotStoreStub.ts
│   ├── EventBusStub.ts
│   ├── AgentServiceStub.ts
│   ├── WorkflowRuntimeStub.ts
│   ├── AgentFixtureStoreStub.ts
│   ├── AppLayerStub.ts
│   └── index.ts
└── index.ts
```

## Stub Pattern

All stubs use Effect.die("not implemented"):
- Satisfies types at compile time
- Fails fast at runtime if accidentally used
- Forces implementation before production use

```typescript
import { Effect, Layer } from "effect"
import { EventStore } from "../../Services/EventStore.js"

export const EventStoreStub = Layer.succeed(
  EventStore,
  EventStore.of({
    append: () => Effect.die("EventStore.append not implemented"),
    read: () => Effect.die("EventStore.read not implemented"),
  })
)
```

## Usage

```typescript
import { AppLayerStub } from "@open-scaffold/core/Stubs"

// Proves the entire program type-checks
const program = myWorkflow.pipe(
  Effect.provide(AppLayerStub)
)

// Will fail at runtime - stubs are for validation only
await Effect.runPromise(program) // throws "not implemented"
```

## Dependencies

- **Uses**: Services (tags), Domain (types)
- **Used by**: Tests, type validation
