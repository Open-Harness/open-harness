# Domain Map

**Date**: 2026-01-26
**Status**: Implementation Complete
**Package**: `@open-scaffold/core`

This document maps the domain entities, services, and their relationships as implemented.

---

## Architecture Overview

Open Scaffold is an event-sourced workflow runtime built on Effect-TS. The architecture follows a **server/client model** with a clear separation of concerns.

```
+-------------------------------------------------------------------------+
|                           DOMAIN LAYER                                   |
|                                                                          |
|  Events (facts)      Agents (AI actors)       Phases (flow control)     |
|  +-- EventId         +-- Agent<S, O>          +-- PhaseConfig           |
|  +-- AnyEvent        +-- AgentProvider        +-- phase.terminal()      |
|                                                                          |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                           SERVICE LAYER                                  |
|                                                                          |
|  Persistence          Broadcast           Provider                      |
|  +-- EventStoreLive   +-- EventBus        +-- AgentProvider             |
|  +-- StateSnapshot    +-- StateCache<S>   +-- ProviderRecorderLive      |
|                                                                          |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                           PROGRAM LAYER                                  |
|                                                                          |
|  Execution            Recording           Session                       |
|  +-- executeWorkflow  +-- recordEvent     +-- createSession             |
|  +-- runPhase         +-- observeEvents   +-- forkSession               |
|  +-- runAgent                             +-- resumeSession             |
|                                                                          |
+-------------------------------------------------------------------------+
```

---

## Why Effect-TS?

| Need | Effect Solution | Why Not Alternatives |
|------|-----------------|---------------------|
| Typed errors | `Effect<A, E, R>` | Try/catch loses type info |
| Dependency injection | `Context.Tag` + `Layer` | Manual DI is verbose |
| Streaming | `Stream.Stream<A, E, R>` | AsyncIterable lacks backpressure |
| Resource management | `Scope` + `acquireRelease` | Manual cleanup is error-prone |
| Concurrency | `Fiber`, `Queue`, `PubSub` | Raw promises lack structure |
| Session context | `FiberRef` | Thread-local without threads |

**Key principle**: Effect is internal. The public API exposes plain TypeScript + Zod via `agent()`, `phase()`, `workflow()`, `execute()`, and `run()`.

---

## Core Domain Entities

### Events

Events are immutable facts about what happened. They form the source of truth.

```typescript
interface Event<Name extends string, Payload> {
  readonly id: EventId           // UUID, branded type
  readonly name: Name            // "plan:created", "agent:started"
  readonly payload: Payload      // Event-specific data
  readonly timestamp: Date       // When it happened
  readonly causedBy?: EventId    // Causality chain
}
```

**Why branded EventId?** Prevents mixing with other UUIDs at compile time.

**Why causedBy?** Creates a causal graph for debugging and replay.

**Built-in event categories:**

| Category | Events | Purpose |
|----------|--------|---------|
| Workflow | `workflow:start`, `user:input` | Session lifecycle |
| Agent | `agent:started`, `agent:completed`, `agent:stopped` | Agent execution tracking |
| Streaming | `text:delta`, `text:complete`, `thinking:*` | Real-time content |
| Tools | `tool:called`, `tool:result` | Tool use tracking |
| VCR | `session:paused`, `session:resumed`, `agent:session` | Pause/resume/fork |
| HITL | `input:requested`, `input:response` | Human-in-the-loop |
| Metrics | `usage:reported`, `error:occurred` | Observability |

### Agents

Agents are AI actors with a model, prompt, output schema, and state update function.

```typescript
// Public API
const myAgent = agent({
  name: "my-agent",
  model: "claude-sonnet-4-5",
  output: z.object({ result: z.string() }),
  prompt: (state) => `Process: ${state.input}`,
  update: (output, draft) => { draft.result = output.result }
})
```

**Internal representation:**

```typescript
interface Agent<S, O> {
  readonly name: string
  readonly model: string                        // Model identifier
  readonly output: ZodType<O>                   // REQUIRED output schema
  readonly prompt: (state: S) => string         // Prompt builder
  readonly update: (output: O, draft: S) => void // State update (immer-style)
}
```

**Why output schema required?** Enforces reliable structured output. No fragile text parsing.

### Phases

Phases define workflow stages and transitions.

```typescript
// Public API
const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { input: "", result: "" },
  start: (input, draft) => { draft.input = input },
  phases: {
    work: { run: myAgent, next: "done" },
    done: phase.terminal()
  }
})
```

### Workflows

Workflows compose agents and phases with initial state and a start function.

```typescript
// Public API via workflow() builder
interface WorkflowConfig<S> {
  readonly name: string
  readonly initialState: S
  readonly start: (input: unknown, draft: S) => void
  readonly phases: Record<string, PhaseConfig>
}
```

---

## Service Boundaries

### Persistence Services

| Service | Responsibility | Storage |
|---------|---------------|---------|
| **EventStoreLive** | Append-only event log (the tape) | LibSQL |
| **StateSnapshotStoreLive** | Periodic state checkpoints | LibSQL |
| **ProviderRecorderLive** | Record/replay provider responses | LibSQL |

**Why single database?** Logical separation (tables), not physical (files). Simplifies deployment.

**Why snapshots?** For large sessions, avoids O(n) replay on recovery.

### Runtime Services

| Service | Responsibility | Implementation |
|---------|---------------|----------------|
| **EventBus** | Live broadcast to SSE clients | In-memory PubSub |
| **StateCache\<S\>** | Typed in-memory state + subscriptions | SubscriptionRef |
| **ProviderModeContext** | Track live vs playback mode | FiberRef |

**Why EventBus in-memory?** It's ephemeral. EventStoreLive is the durable source of truth.

**Why StateCache typed?** Preserves generic `S` throughout. No `unknown` casts.

### Provider Services

| Service | Responsibility | Implementation |
|---------|---------------|----------------|
| **AgentProvider** | Wrap Agent SDK | Anthropic |
| **AgentService** | Run agent and emit events | Core |
| **WorkflowRuntime** | Orchestrate agents + phases | Core |

---

## ID Types (Branded)

All IDs are branded strings to prevent mixing at compile time.

```typescript
type EventId = string & { readonly _brand: "EventId" }
type SessionId = string & { readonly _brand: "SessionId" }
type WorkflowId = string & { readonly _brand: "WorkflowId" }
type AgentId = string & { readonly _brand: "AgentId" }
```

**Why branded?** `handleEvent(sessionId, eventId)` and `handleEvent(eventId, sessionId)` would both compile without branding. With branding, the compiler catches the mistake.

---

## Error Types

All errors use Effect's `Data.TaggedError` for typed error handling.

| Error | When | Fields |
|-------|------|--------|
| `WorkflowNotFound` | Workflow ID not in registry | `workflowId` |
| `SessionNotFound` | Session ID not in store | `sessionId` |
| `StoreError` | Read/write/delete failed | `operation`, `cause` |
| `AgentError` | Agent execution failed | `agentName`, `phase`, `cause` |
| `ProviderError` | SDK call failed | `code`, `message`, `retryable` |
| `ValidationError` | Schema parse failed | `schema`, `errors` |
| `RecordingNotFound` | Playback mode, no recording | `hash` |

**Why typed errors?** Forces callers to handle specific failure modes. No generic `catch (e)`.

---

## Data Flow

### Write Path

```
Event Created
    |
    v
recordEvent(sessionId, event)
    |
    +-- EventStoreLive.append()  -> Persists to LibSQL
    |
    +-- EventBus.publish()       -> Broadcasts to SSE subscribers
```

Every event is both persisted AND broadcast.

### Read Paths

**Historical (replay):**
```
EventStoreLive.getEventsFrom(sessionId, position)
    |
    v
Stream of past events
```

**Live (SSE):**
```
EventBus.subscribe(sessionId)
    |
    v
Stream of new events as they happen
```

---

## The VCR Metaphor

The workflow is like a VCR tape. Events are recorded as they happen.

| Control | Implementation | Effect |
|---------|---------------|--------|
| **Play** | `executeWorkflow` runs | Process phases forward |
| **Pause** | `SessionPaused` event | Loop stops, holds state |
| **Resume** | `resumeSession` program | Restart from pause point |
| **Rewind** | `computeStateAt(events, position)` | Replay to past position |
| **Fork** | `forkSession` program | Copy tape to new session |

**Why no time-travel fork?** Forking only works from current position. Forking from the past would require re-running agents, which is non-deterministic.

---

## Two-Mode System

| Mode | Behavior |
|------|----------|
| `live` | Call real Agent SDK, automatically record responses |
| `playback` | Replay recorded responses, no SDK calls |

**Why only two modes?** The original three-mode system (passthrough/record/playback) was confusing. "Live" always records, making tests reproducible.

**Where is mode set?** At server level via `ProviderModeContext`, not per-provider.

---

## HITL (Human-in-the-Loop)

HITL uses the event system. No new primitives needed.

```
1. Agent emits input:requested event
2. Workflow pauses on empty queue (natural pause)
3. Client receives event, shows approval UI
4. User clicks, client POSTs input:response
5. Workflow continues with next phase
```

**Why not SDK canUseTool?** SDK timeouts (60s) are unsuitable for human response times. Event-based is non-blocking.

---

## Package Structure

```
packages/core/src/
+-- Domain/           # Types, branded IDs, errors
|   +-- Event.ts      # Event, EventId
|   +-- Agent.ts      # Agent, AgentProvider, ProviderMode
|   +-- Interaction.ts # HITL createInteraction helper
|   +-- Errors.ts     # All TaggedErrors
|   +-- Context.ts    # SessionContext FiberRef
+-- Engine/           # Public API runtime
|   +-- agent.ts      # agent() builder
|   +-- phase.ts      # phase() builder
|   +-- workflow.ts   # workflow() builder
|   +-- execute.ts    # execute() async iterator
|   +-- run.ts        # run() Promise API
+-- Services/         # Effect Context.Tags
+-- Programs/         # Effect compositions
+-- Layers/           # Logger configs
+-- index.ts          # Public API exports
```

---

## Next

See [02-service-contracts.md](./02-service-contracts.md) for complete service interfaces.
