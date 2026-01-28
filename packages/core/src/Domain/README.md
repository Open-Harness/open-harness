# Domain

Core types that define the vocabulary of the system.

## Type Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                        Domain Types                          │
├─────────────────────────────────────────────────────────────┤
│  IDs (branded)     │ SessionId, EventId, WorkflowId         │
│  Events (schema)   │ AnyEvent, Event<Name, Payload>         │
│  Handlers (pure)   │ Handler, HandlerResult                 │
│  Agents (AI)       │ Agent, AgentProvider                   │
│  Workflows         │ Workflow, WorkflowDefinition           │
│  Errors (tagged)   │ StoreError, ProviderError, etc.        │
│  Context           │ SessionContext (FiberRef)              │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Contains | Pattern |
|------|----------|---------|
| Ids.ts | Branded ID types | Schema.brand() |
| Errors.ts | Error types | Data.TaggedError |
| Event.ts | Event types + built-in events | Schema.Class |
| Handler.ts | Handler types | Pure functions |
| Agent.ts | Agent + Provider | Public interfaces |
| Workflow.ts | Workflow types | Configuration |
| Context.ts | FiberRef | Ambient context |
| Hash.ts | Request hashing | Pure utility |
| Interaction.ts | HITL helpers | createInteraction factory |

## Patterns

### Branded IDs

```typescript
import { SessionId, EventId } from "./Ids.js"

// IDs are branded strings - type-safe but compatible with string operations
const sessionId: SessionId = "sess_123" as SessionId
```

### Tagged Errors

```typescript
import { StoreError, ProviderError } from "./Errors.js"

// Tagged errors enable exhaustive pattern matching
const handle = (error: StoreError | ProviderError) => {
  switch (error._tag) {
    case "StoreError": return "Storage failed"
    case "ProviderError": return "Provider failed"
  }
}
```

## Dependencies

- **Uses**: effect (Data, Schema), zod (public API)
- **Used by**: Services, Programs, Layers
