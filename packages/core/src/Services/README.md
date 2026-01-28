# Services

Effect Context.Tag definitions - contracts without implementations.

## Service Dependency Graph

```
┌──────────────┐     ┌─────────────────────┐
│  EventStore  │     │ StateSnapshotStore  │
│  (persist)   │     │    (snapshots)      │
└──────┬───────┘     └─────────┬───────────┘
       │                       │
       └───────────┬───────────┘
                   ▼
         ┌─────────────────┐
         │   StateCache    │  (factory, not service)
         │  (typed cache)  │  Uses EventStore + StateSnapshotStore
         └────────┬────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│            EventBus                   │
│     (broadcast to SSE clients)        │
└──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│          AgentService                 │
│   (orchestrates agent execution)      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│       AgentFixtureStore              │
│  (cache agent responses for replay)   │
└──────────────────────────────────────┘
```

## Files

| File | Service | Purpose |
|------|---------|---------|
| EventStore.ts | EventStore | Persist and retrieve events |
| StateSnapshotStore.ts | StateSnapshotStore | Persist state snapshots for efficient recovery |
| StateCache.ts | StateCache (factory) | Typed state cache using Effect.Cache |
| EventBus.ts | EventBus | Broadcast events to subscribers |
| AgentService.ts | AgentService | Orchestrate agent execution |
| AgentProvider.ts | AgentProvider | AI provider abstraction |
| WorkflowRuntime.ts | WorkflowRuntime | Top-level workflow orchestration |
| AgentFixtureStore.ts | AgentFixtureStore | Cache agent responses for replay |

## Pattern

All services follow:
1. Interface type (operations)
2. Context.Tag (DI token)
3. R = never (no requirements on operations)

```typescript
import { Context, Effect } from "effect"

// 1. Define the service interface
export interface EventStoreService {
  readonly append: (event: AnyEvent) => Effect.Effect<void, StoreError>
  readonly read: (sessionId: SessionId) => Effect.Effect<AnyEvent[], StoreError>
}

// 2. Create the Context.Tag
export class EventStore extends Context.Tag("@open-scaffold/EventStore")<
  EventStore,
  EventStoreService
>() {}
```

## Dependencies

- **Uses**: Domain (types, errors)
- **Used by**: Programs, Layers
