# Contributing to Open Scaffold

**SDK development guide for contributors.**

This document explains the internal architecture, Effect patterns, and how all pieces fit together. If you're building ON the SDK, read [Building Workflows](./building-workflows.md). If you're building THE SDK, read this.

---

## Prerequisites

- Effect-TS knowledge (the SDK is built on Effect)
- TypeScript
- Understanding of event sourcing concepts

---

## Core Principle: Effect All The Way Down

The SDK is built on Effect-TS. Understanding Effect is prerequisite to understanding the internals.

### Why Effect?

| Need | Effect Solution | Why Not Alternatives |
|------|-----------------|---------------------|
| Typed errors | `Effect<A, E, R>` | Try/catch loses type info |
| Dependency injection | `Context.Tag` + `Layer` | Manual DI is verbose and error-prone |
| Streaming | `Stream.Stream<A, E, R>` | AsyncIterable lacks backpressure, cancellation |
| Resource management | `Scope` + `acquireRelease` | Manual cleanup is error-prone |
| Concurrency | `Fiber`, `Queue`, `PubSub` | Raw promises lack structured concurrency |

### The Effect Type

```typescript
Effect.Effect<Success, Error, Requirements>
```

- `Success`: What you get when it works
- `Error`: Typed failure cases (not exceptions)
- `Requirements`: Services needed to run

**Critical rule:** Service interfaces must have `Requirements = never`. Dependencies are handled at the Layer level, not in the interface.

```typescript
// CORRECT
interface EventStoreService {
  append(sessionId: SessionId, event: AnyEvent): Effect.Effect<void, StoreError>
}

// WRONG - don't put requirements in service interfaces
interface EventStoreService {
  append(sessionId: SessionId, event: AnyEvent): Effect.Effect<void, StoreError, Logger>
}
```

---

## Package Architecture

```
@open-scaffold/core         (shared, platform-agnostic)
├── Domain/                 Types, events, errors, IDs
├── Services/               Effect Context.Tags (interfaces only)
├── Engine/                 Effect compositions using services
└── Layers/                 Dies if called (type-checking only)

@open-scaffold/server       (Node.js, implements services)
├── store/                  LibSQL implementations
├── provider/               Anthropic provider
├── services/               Live EventBus, etc.
└── http/                   Server, routes, SSE

@open-scaffold/client       (Browser, consumes HTTP/SSE)
├── http/                   Fetch-based client
└── react/                  Hooks
```

**Why this split?**

1. **Core is testable in isolation** - Stubs allow type-checking without real implementations
2. **Core is platform-agnostic** - No Node.js dependencies
3. **Server provides implementations** - Real databases, real providers
4. **Client is separate** - Different runtime (browser), different dependencies

---

## Service Architecture

### The Pattern: Tag + Interface + Layer

Every service follows this pattern:

```typescript
// 1. Define the interface (what it does)
interface EventStoreService {
  readonly append: (sessionId: SessionId, event: AnyEvent) => Effect.Effect<void, StoreError>
  readonly getEvents: (sessionId: SessionId) => Effect.Effect<ReadonlyArray<AnyEvent>, StoreError>
}

// 2. Create the Tag (identity in the Effect context)
class EventStore extends Context.Tag("@open-scaffold/EventStore")<
  EventStore,
  EventStoreService
>() {}

// 3. Implement as a Layer (how it works)
const EventStoreLive = (config: LibSQLConfig): Layer.Layer<EventStore, never, never> =>
  Layer.effect(
    EventStore,
    Effect.gen(function* () {
      const db = yield* createConnection(config)
      return EventStore.of({
        append: (sessionId, event) => /* implementation */,
        getEvents: (sessionId) => /* implementation */,
      })
    })
  )

// 4. Stub for type-checking (dies if called)
const EventStoreStub = Layer.succeed(
  EventStore,
  EventStore.of({
    append: () => Effect.die("EventStore.append not implemented"),
    getEvents: () => Effect.die("EventStore.getEvents not implemented"),
  })
)
```

### Services in This System

| Service | Purpose | Lives In |
|---------|---------|----------|
| `EventStore` | Persist events (the tape) | core (tag), server (impl) |
| `EventBus` | Broadcast events to live subscribers | core (tag), server (impl) |
| `StateSnapshotStore` | Persist state checkpoints | core (tag), server (impl) |
| `StateCache` | Typed in-memory state + subscriptions | core (tag + impl) |
| `AgentProvider` | Protocol for AI providers | core (tag), server (Anthropic) |
| `ProviderRecorder` | Cache provider responses | core (tag), server (impl) |

---

## The Database Model

### Single Database, Multiple Concerns

Everything lives in one LibSQL database. The separation is logical (tables), not physical (files).

```
┌─────────────────────────────────────────────────────────────────┐
│  open-scaffold.db                                               │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ sessions                                                    │ │
│  │ Session lifecycle and metadata                              │ │
│  │ • id, workflow_name, created_at, completed_at               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ events                                                      │ │
│  │ THE TAPE - immutable, append-only event log                 │ │
│  │ • id, session_id, position, name, payload, timestamp        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ state_snapshots                                             │ │
│  │ Periodic state checkpoints for fast recovery                │ │
│  │ • session_id, position, state_json, created_at              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ provider_cache                                              │ │
│  │ Cached AI responses for deterministic replay                │ │
│  │ • request_hash, stream_data, result, cached_at              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Why One Database?

1. **Simpler mental model** - One connection, one migration path
2. **Atomic operations** - Transactions across concerns if needed
3. **No confusion** - "Where is X stored?" has one answer
4. **Same schema everywhere** - Dev, test, prod use same structure

### Hash-Based Provider Cache

The `provider_cache` table is keyed by a hash of the request:

```typescript
const requestHash = hash({
  prompt: options.prompt,
  outputSchema: options.outputSchema,
  providerOptions: options.providerOptions,
  tools: options.tools
})
```

Same request → same hash → same cached response.

---

## Stream Architecture

### The Golden Rule

**Keep everything as Effect `Stream` until the absolute edge of the system.**

```
GOOD:
  Anthropic SDK → Stream.Stream → transformations → Stream.runForEach → side effects

BAD:
  Anthropic SDK → AsyncIterable → Stream → buffer → AsyncIterable → for await
```

### Stream Patterns

| Pattern | When To Use |
|---------|-------------|
| `Stream.fromAsyncIterable` | Wrapping external async iterables (SDK) |
| `Stream.tap` | Side effects without changing the stream |
| `Stream.mapEffect` | Effectful transformation per element |
| `Stream.flatMap` | One-to-many transformations |
| `Stream.runDrain` | Consume stream for side effects only |
| `Stream.runCollect` | ONLY at the absolute end |

### Stream Anti-Patterns

| Anti-Pattern | Why It's Bad |
|--------------|--------------|
| `Stream.runCollect` mid-pipeline | Buffers everything, defeats streaming |
| Converting to AsyncIterable and back | Loses backpressure, interruption |
| Nested `runPromise` inside streams | Breaks structured concurrency |

---

## Event System

### Two Services, Two Concerns

| Service | Purpose | Implementation |
|---------|---------|----------------|
| `EventStore` | Persistence (the tape) | LibSQL |
| `EventBus` | Live broadcast (SSE) | In-memory PubSub |

**EventStore** is durable. Survives restarts. Source of truth.

**EventBus** is ephemeral. Lives only for the session. Powers real-time UI.

### The Write Path

```
Event Created
    │
    ▼
recordEvent(sessionId, event)
    │
    ├── EventStore.append()   → Persists to DB
    │
    └── EventBus.publish()    → Broadcasts to SSE
```

Both happen. Every event is both persisted AND broadcast.

---

## Provider Modes

**Two modes** for AI providers:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `live` | Call API + **always cache** | Development, production |
| `playback` | Return cached response | Testing, CI |

In live mode, we always cache. This means:
- Every live run is automatically recorded
- No special "recording session" needed
- If something goes wrong, you have replay data
- Hash-based dedup prevents cache bloat

---

## Testing Strategy

### Integration Tests (Real Services)

Use real LibSQL with in-memory database:

```typescript
const TestLayer = Layer.mergeAll(
  EventStoreLive({ url: ":memory:" }),
  EventBusLive,
  ProviderRecorderLive({ url: ":memory:" })
)
```

### Recording-Based Tests

Record once with live mode, replay forever with playback:

```typescript
// First time: live mode (calls API, records responses)
const scaffold = OpenScaffold.create({
  database: "./data/test.db",
  mode: "live",
  providers: {}  // Required - empty object to opt out of providers
})

// Subsequent times: playback mode (replays recordings)
const scaffold = OpenScaffold.create({
  database: "./data/test.db",
  mode: "playback",
  providers: {}  // Required - empty object to opt out of providers
})
```

---

## Key Principles

1. **Effect all the way down** - Use Effect primitives, not Promise/async
2. **Stream for streaming** - Keep as Stream until the edge
3. **Services have no requirements** - Dependencies at Layer level
4. **One database** - Logical separation (tables), not physical (files)
5. **Mode is explicit** - No magic env vars
6. **Stubs die** - Fast failure if stub used at runtime
7. **Events are the truth** - Everything derives from the tape

---

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (turbo + tsdown)
pnpm typecheck        # Type check (turbo + tsc -b)
pnpm test             # Run tests (vitest)
pnpm lint             # Lint (eslint)
```

## Server Defaults

| Constant | Value | Defined In |
|----------|-------|------------|
| `DEFAULT_PORT` | `42069` | `@open-scaffold/server/src/constants.ts` |
| `DEFAULT_HOST` | `"127.0.0.1"` | `@open-scaffold/server/src/constants.ts` |

---

## Next Steps

- [Architecture](./architecture.md) -- System overview with diagrams
- [API Reference](./api-reference.md) -- Complete type signatures
