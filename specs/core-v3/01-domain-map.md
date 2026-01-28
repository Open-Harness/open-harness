# Core-v3 Domain Map

**Date**: 2026-01-22
**Status**: Phase 1 Complete - Pending Phase 2 (Service Contracts)

---

## Effect Primitives Identified

| Need | Effect Solution | Rationale |
|------|-----------------|-----------|
| Workflow state | `SubscriptionRef` | Reactive state, notifies on changes → SSE |
| Event queue | `Queue.bounded` | Backpressure, ordered processing |
| Event broadcast | `PubSub` | Multiple SSE clients per workflow |
| SSE streaming | `Stream` | Composes with PubSub naturally |
| HTTP server | `@effect/platform` | Effect-native HTTP + streaming |
| Agent wrapper | Custom service | Wrap Claude Agent SDK (and others) |
| Validation | `Schema` | Events, requests, responses |
| Observability | `Effect.log` + `withSpan` | Wide events with fiber context |
| Config | `Config` | Environment variables |
| Resource cleanup | `Scope` + `acquireRelease` | Agent sessions, connections |
| Testing time | `TestClock` | Workflow tests without delays |

---

## Service Boundaries

### WorkflowService (Orchestration)
Core workflow operations - creates, starts, dispatches events, manages lifecycle.

| Operation | Signature | Errors |
|-----------|-----------|--------|
| `create` | `(definition: WorkflowDefinition) → WorkflowId` | `ValidationError` |
| `start` | `(workflowId, input) → void` | `WorkflowNotFound` |
| `dispatch` | `(workflowId, event) → void` | `WorkflowNotFound` |
| `getState` | `(workflowId) → State` | `WorkflowNotFound` |
| `subscribe` | `(workflowId) → Stream<Event>` | `WorkflowNotFound` |

**Dependencies**: EventStore, StateStore, EventBus, AgentService

---

### EventStore (Persistence - Tape)
Append-only event log. The source of truth for workflow history.

| Operation | Signature | Errors |
|-----------|-----------|--------|
| `append` | `(workflowId, event) → void` | `StoreError` |
| `getEvents` | `(workflowId) → Event[]` | `StoreError` |
| `getEventsFrom` | `(workflowId, position) → Event[]` | `StoreError` |

**Dependencies**: None (infrastructure)

---

### StateStore (Computed State)
Caches computed state from events. Uses SubscriptionRef for reactive updates.

| Operation | Signature | Errors |
|-----------|-----------|--------|
| `get` | `(workflowId) → State` | `NotFound` |
| `set` | `(workflowId, state) → void` | - |
| `subscribe` | `(workflowId) → Stream<State>` | `NotFound` |

**Dependencies**: None (uses SubscriptionRef internally)

---

### EventBus (Broadcast)
Broadcasts events to live subscribers. Separate from EventStore (persistence vs live).

| Operation | Signature | Errors |
|-----------|-----------|--------|
| `publish` | `(workflowId, event) → void` | - |
| `subscribe` | `(workflowId) → Stream<Event>` | - |

**Dependencies**: None (uses PubSub internally)

---

### AgentService (Agent Execution)
Runs agents within workflow context. Coordinates with AgentProvider.

| Operation | Signature | Errors |
|-----------|-----------|--------|
| `run` | `(agent, context, state) → Stream<AgentEvent>` | `AgentError` |

**Dependencies**: AgentProvider

---

### AgentProvider (External Agent SDK)
Wraps external agent SDKs (Claude Agent SDK, etc.). Agents have state, tools, multi-turn conversations.

| Operation | Signature | Errors |
|-----------|-----------|--------|
| `chat` | `(messages, options) → Stream<Chunk>` | `ProviderError` |
| `complete` | `(messages, options) → Result` | `ProviderError` |

**Dependencies**: None (external SDK wrapper)

**Implementations**:
- `ClaudeAgentProvider` - Wraps `@anthropic-ai/claude-agent-sdk`
- `MockAgentProvider` - For testing

---

### HttpApi (Transport)
REST + SSE endpoints. Pure transport layer.

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/workflows` | POST | Create workflow |
| `/workflows/:id/start` | POST | Start with input |
| `/workflows/:id/events` | POST | Dispatch event |
| `/workflows/:id/state` | GET | Current state |
| `/workflows/:id/stream` | GET | SSE event stream |

**Dependencies**: WorkflowService

---

## Data Flow

```
Frontend (React SPA + Tanstack Router)
    │
    ▼ HTTP/SSE
┌─────────────────────────────────────────────┐
│                  HttpApi                     │
│            (@effect/platform)                │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│              WorkflowService                 │
│    (orchestrates handlers + agents)          │
└─────────────────────────────────────────────┘
    │         │          │           │
    ▼         ▼          ▼           ▼
EventStore  StateStore  EventBus  AgentService
 (append)   (SubRef)   (PubSub)       │
    │                      │           ▼
    ▼                      ▼      AgentProvider
  [Tape]              [SSE]      (Claude SDK)
```

---

## Key Design Decisions

1. **EventBus separate from EventStore**
   - Store = persistence (tape, replay)
   - Bus = live broadcast (SSE, real-time)

2. **StateStore uses SubscriptionRef**
   - Clients subscribe to state changes reactively
   - No polling needed

3. **AgentService returns Stream**
   - Streaming chunks as they arrive
   - Not buffered results

4. **AgentProvider not LLMProvider**
   - Agents have state, tools, multi-turn
   - Not stateless completion calls

---

## Next Phase

Phase 2: Define service contracts (Tags) with Effect types.
