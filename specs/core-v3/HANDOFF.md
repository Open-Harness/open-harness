# Core-v3 Implementation Handoff

## Skill Activation

Activate these skills before proceeding:

```
/effect-ts-architect
/wide-events-pino
```

Read these artifacts:
- `specs/core-v3/01-domain-map.md` - Effect primitives + service boundaries
- `specs/core-v3/02-service-contracts.md` - Public API + internal Effect services

---

## Context Summary

**Building**: `packages/core-v3` + `apps/core-v3-demo`

**Architecture**:
| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React SPA + Tanstack Router | Pure client, no SSR |
| Backend | Effect HTTP server | All Effect internally |
| Public API | Zod + Promises | Effect hidden from users |
| Observability | Effect.log + withSpan | Wide events pattern |
| Testing | TDD | Tests first |

**Key Principle**: Effect is an implementation detail. Public API uses Zod + Promises.

---

## Completed Phases

### Phase 0: Ecosystem Check ✓
Effect primitives identified: `SubscriptionRef`, `Queue`, `PubSub`, `Stream`, `Schema`, `@effect/platform`

### Phase 1: Domain Discovery ✓
Services mapped: EventStore, StateStore, EventBus, AgentProvider, AgentService, WorkflowRuntime, HttpApi

### Phase 2: Service Contracts ✓
- Public types: Event, Handler, Agent, Workflow (Zod, Promises)
- Internal services: `Context.Tag` for each service
- Internal errors: `Data.TaggedError` for all error types

---

## Remaining Phases

### Phase 3: Effect Programs
Compose business logic using the service contracts:

1. **Workflow execution loop**
   - Event queue processing
   - Handler dispatch
   - Agent activation
   - State updates

2. **Agent execution flow**
   - Prompt generation
   - AgentProvider streaming
   - Output parsing
   - Event emission

3. **SSE streaming**
   - EventBus → HTTP Stream
   - State subscriptions

### Phase 4: Layer Architecture
Design dependency graph:
```
ConfigService (no deps)
    ↓
EventStore, StateStore, EventBus (infrastructure)
    ↓
AgentProvider (external SDK)
    ↓
AgentService (uses AgentProvider)
    ↓
WorkflowRuntime (uses all)
    ↓
HttpApi (uses WorkflowRuntime)
```

Create stub layers to prove architecture compiles.

### Phase 5: Implementation Handoff
Generate literal task list with:
- File paths
- Dependencies
- Test requirements
- Priority order

---

## TDD Integration

**Tests are NOT a separate phase - they're woven throughout.**

For each service contract:
1. Write test first (what should this do?)
2. Implement stub layer (prove types align)
3. Implement live layer (actual behavior)
4. Tests pass

**Test categories**:
| Category | What | Tools |
|----------|------|-------|
| Unit | Pure functions (handlers) | `vitest` |
| Service | Effect services with test layers | `vitest` + Effect `TestContext` |
| Integration | Full workflow execution | `vitest` + mock AgentProvider |
| E2E (frontend) | Agent Browser scripts | `agent-browser` CLI |

**Effect testing pattern**:
```typescript
import { Effect, TestContext } from "effect"

const test = Effect.gen(function* () {
  // Arrange
  const store = yield* EventStore

  // Act
  yield* store.append(sessionId, event)

  // Assert
  const events = yield* store.getEvents(sessionId)
  expect(events).toHaveLength(1)
}).pipe(
  Effect.provide(EventStoreTest),  // Test layer
  Effect.provide(TestContext.TestContext)
)

await Effect.runPromise(test)
```

---

## Observability Integration

**Wide events pattern with Effect**:

```typescript
// Every workflow execution emits one wide event
const executeWorkflow = (config: RuntimeConfig) =>
  Effect.gen(function* () {
    const startTime = Date.now()

    // ... execution ...

    yield* Effect.log("workflow:completed").pipe(
      Effect.annotateLogs({
        workflowId,
        sessionId,
        duration_ms: Date.now() - startTime,
        event_count: events.length,
        agent_calls: agentCallCount,
        outcome: terminated ? "completed" : "interrupted",
      })
    )
  }).pipe(
    Effect.withSpan("workflow.execute", { attributes: { workflowId } })
  )
```

---

## File Structure Target

```
packages/core-v3/
├── src/
│   ├── public/           # Public API (no Effect exports)
│   │   ├── event.ts
│   │   ├── handler.ts
│   │   ├── agent.ts
│   │   ├── workflow.ts
│   │   └── index.ts      # Main entry point
│   ├── internal/         # Effect implementation
│   │   ├── errors.ts     # Data.TaggedError
│   │   ├── schema.ts     # Effect Schema types
│   │   ├── services/
│   │   │   ├── EventStore.ts
│   │   │   ├── StateStore.ts
│   │   │   ├── EventBus.ts
│   │   │   ├── AgentProvider.ts
│   │   │   ├── AgentService.ts
│   │   │   └── WorkflowRuntime.ts
│   │   ├── layers/
│   │   │   ├── stubs.ts      # Stub layers (prove types)
│   │   │   ├── memory.ts     # In-memory implementations
│   │   │   └── claude.ts     # Claude AgentProvider
│   │   └── programs/
│   │       └── workflows.ts  # Effect programs
│   └── index.ts          # Re-exports public/index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── package.json

apps/core-v3-demo/
├── src/
│   ├── routes/           # Tanstack Router
│   ├── components/
│   └── lib/
│       └── client.ts     # SSE client
└── package.json
```

---

## Instructions

1. **Read the artifacts** listed above
2. **Activate skills** for Effect patterns and observability
3. **Phase 3**: Write Effect programs with tests (TDD)
4. **Phase 4**: Design layers, create stubs, prove compilation
5. **Phase 5**: Generate implementation task list

**Remember**:
- Effect is internal - never expose to public API
- Zod for user-facing schemas
- Tests first for each service
- Wide events for observability
- Agent Browser for frontend testing (after backend works)

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema | Zod (public), Effect Schema (internal) | Users know Zod |
| Errors | Data.TaggedError | Effect idiomatic |
| Provider name | AgentProvider (not LLMProvider) | Agents are stateful |
| EventStore vs EventBus | Separate services | Different concerns |
| Frontend | Tanstack Router SPA | Clean separation from backend |
