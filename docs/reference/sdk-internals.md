# Open Scaffold SDK Internals

**For developers building the SDK itself.**

This document explains the internal architecture, Effect patterns, and how all pieces fit together. If you're building ON the SDK, read `mental-model.md`. If you're building THE SDK, read this.

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
  //                                                                      ↑ no R
}

// WRONG
interface EventStoreService {
  append(sessionId: SessionId, event: AnyEvent): Effect.Effect<void, StoreError, Logger>
  //                                                                              ↑ bad
}
```

---

## Package Architecture

```
@open-scaffold/core         (shared, platform-agnostic)
├── Domain/                 Types, events, errors, IDs
├── Services/               Effect Context.Tags (interfaces only)
├── Programs/               Effect compositions using services
└── Layers/Stubs/           Dies if called (type-checking only)

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
| `ProviderCache` | Cache provider responses | core (tag), server (impl) |
| `WorkflowRuntime` | Orchestrate handlers + agents | core (tag + impl) |

---

## The Database Model

### Single Database, Multiple Concerns

Everything lives in one LibSQL database. The separation is logical (tables), not physical (files).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  open-scaffold.db                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ sessions                                                                 ││
│  │ ─────────                                                                ││
│  │ Session lifecycle and metadata                                           ││
│  │ • id, workflow_name, created_at, completed_at                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ events                                                                   ││
│  │ ──────                                                                   ││
│  │ THE TAPE - immutable, append-only event log                              ││
│  │ • id, session_id, position, name, payload, timestamp, caused_by          ││
│  │ • Source of truth for workflow state                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ state_snapshots                                                          ││
│  │ ───────────────                                                          ││
│  │ Periodic state checkpoints for fast recovery                             ││
│  │ • session_id, position, state_json, created_at                           ││
│  │ • Avoids O(n) handler replay for large sessions                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ provider_cache                                                           ││
│  │ ──────────────                                                           ││
│  │ Cached AI responses for deterministic replay                             ││
│  │ • request_hash (PRIMARY KEY), stream_data, result, cached_at             ││
│  │ • Keyed by hash of (prompt + schema + options)                           ││
│  │ • Enables record/playback modes without separate DB                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why One Database?

1. **Simpler mental model** - One connection, one migration path
2. **Atomic operations** - Can use transactions across concerns if needed
3. **No confusion** - "Where is X stored?" has one answer
4. **Same schema everywhere** - Dev, test, prod all use the same structure

### The Hash-Based Cache

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

This enables:
- **Record once**: Call real API, cache response
- **Replay forever**: Same prompt returns cached response
- **No API costs in tests**: Playback mode never hits the network

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

### Fixed: Stream All The Way

The streaming issue has been fixed. The architecture now maintains Stream throughout:

```typescript
// Provider creates Stream from SDK's AsyncIterable
stream: (options) => Stream.fromAsyncIterable(streamQuery(options), mapError)

// withRecording transforms Stream, keeps it as Stream
const withRecording = (provider, recorder, mode) => ({
  stream: (options) => mode === "live"
    ? provider.stream(options).pipe(Stream.tap(recorder.append))
    : Stream.fromEffect(recorder.lookup(hash)).pipe(Stream.flatMap(...))
})

// Runner uses Stream directly - no conversion to AsyncIterable
yield* agent.provider.stream(options).pipe(
  Stream.mapEffect((event) => eventStore.append(sessionId, event)),
  Stream.runDrain
)
```

### Correct Architecture

```typescript
// AgentProvider interface - returns Stream
interface AgentProvider {
  readonly stream: (options: ProviderRunOptions) => Stream.Stream<AgentStreamEvent, ProviderError>
}

// withRecording - transforms Stream, no conversion
// Two modes: "live" (call + record) and "playback" (replay)
const withRecording = (
  provider: AgentProvider,
  recorder: ProviderRecorder,
  mode: ProviderMode
): AgentProvider => ({
  name: provider.name,

  stream: (options) => {
    const hash = hashRequest(options)

    switch (mode) {
      case "live":
        // Call real SDK, record responses
        return provider.stream(options).pipe(
          Stream.tap((event) => recorder.append(hash, event)),
          Stream.onDone(() => recorder.finalize(hash))
        )

      case "playback":
        // Replay from recordings
        return Stream.fromEffect(recorder.lookup(hash)).pipe(
          Stream.flatMap((entry) =>
            entry
              ? Stream.fromIterable(entry.streamData)
              : Stream.fail(new RecordingMiss({ hash }))
          )
        )
    }
  }
})

// Runner uses Stream directly - no AsyncIterable
const runAgentWithStreaming = (agent: Agent) =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore

    yield* agent.provider.stream(options).pipe(
      Stream.mapEffect((streamEvent) => {
        const domainEvent = mapStreamEvent(streamEvent)
        return domainEvent
          ? eventStore.append(sessionId, domainEvent)
          : Effect.void
      }),
      Stream.runDrain
    )
  })
```

### Stream Patterns to Use

| Pattern | When To Use |
|---------|-------------|
| `Stream.fromAsyncIterable` | Wrapping external async iterables (SDK) |
| `Stream.tap` | Side effects without changing the stream |
| `Stream.mapEffect` | Effectful transformation per element |
| `Stream.flatMap` | One-to-many transformations |
| `Stream.runDrain` | Consume stream for side effects only |
| `Stream.runCollect` | ONLY at the absolute end, for final result |
| `Stream.onDone` | Cleanup after stream completes |
| `Stream.ensuring` | Cleanup even on failure |

### Stream Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad |
|--------------|--------------|
| `Stream.runCollect` mid-pipeline | Buffers everything, defeats streaming |
| Converting to AsyncIterable and back | Loses backpressure, interruption |
| Nested `runPromise` inside streams | Breaks structured concurrency |
| Manual async generators | Hard to manage, error-prone |

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
    ├── EventStore.append(sessionId, event)   → Persists to DB
    │
    └── EventBus.publish(sessionId, event)    → Broadcasts to SSE subscribers
```

Both happen. Every event is both persisted AND broadcast.

### The Read Paths

**Historical (replay):**
```
EventStore.getEventsFrom(sessionId, position)
    │
    ▼
Stream of past events
```

**Live (SSE):**
```
EventBus.subscribe(sessionId)
    │
    ▼
Stream of new events as they happen
```

**Combined (observeEvents):**
```
Historical events ─┬─► Concatenated stream
Live subscription ─┘
```

---

## The Event Loop

The core execution model:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EVENT LOOP                                                                  │
│                                                                              │
│  while (!terminated && !aborted) {                                          │
│    │                                                                         │
│    ├── 1. Dequeue event                                                     │
│    │       Effect.flatMap(Queue.take(eventQueue))                           │
│    │                                                                         │
│    ├── 2. Find matching handler                                             │
│    │       handlers.find(h => h.activatesOn.includes(event.name))           │
│    │                                                                         │
│    ├── 3. Run handler (pure, synchronous)                                   │
│    │       handler(event, state) → { state, events }                        │
│    │                                                                         │
│    ├── 4. Update state                                                      │
│    │       stateRef.set(newState)                                           │
│    │                                                                         │
│    ├── 5. Record event + broadcast                                          │
│    │       recordEvent(sessionId, event)                                    │
│    │                                                                         │
│    ├── 6. Find activated agents                                             │
│    │       agents.filter(a => a.activatesOn.includes(event.name))           │
│    │       agents.filter(a => !a.when || a.when(state))                     │
│    │                                                                         │
│    ├── 7. Run agents (async, streaming)                                     │
│    │       for each agent: runAgentWithStreaming(agent, state, event)       │
│    │                                                                         │
│    ├── 8. Queue new events                                                  │
│    │       Queue.offerAll(eventQueue, handlerEvents ++ agentEvents)         │
│    │                                                                         │
│    └── 9. Check termination                                                 │
│            until(state) → terminated = true                                 │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Properties

1. **Single-threaded event processing** - One event at a time
2. **Handlers are synchronous** - No async in handlers
3. **Agents are asynchronous** - Stream processing
4. **Events are ordered** - Position monotonically increases
5. **Causality is tracked** - `causedBy` links events

---

## Provider Modes

**Two modes** for AI providers (not three):

| Mode | Behavior | Use Case |
|------|----------|----------|
| `live` | Call API + **always cache** | Development, production |
| `playback` | Return cached response | Testing, CI |

**Why only two modes?**

The user asked: "What is the use case for NOT recording?"

Answer: There isn't one. In live mode, we always cache the response. This means:
- Every live run is automatically recorded
- No special "recording session" needed
- If something goes wrong, you have the replay data
- Hash-based dedup prevents cache bloat

### Mode via Effect Context

Mode is **explicit and consistent** across all providers:

```typescript
// Server sets the mode via Effect Context
const server = createServer({
  workflow,
  mode: "live",  // or "playback"
  db: "file:./my-app.db"
})

// Internally, this provides ProviderModeContext to the runtime
// All providers read from this context - consistent mode everywhere

class ProviderModeContext extends Context.Tag("@open-scaffold/ProviderModeContext")<
  ProviderModeContext,
  { readonly mode: ProviderMode }
>() {}
```

**Why context?**
- Providers are configured on agents, not the server
- But mode should be consistent across all agents
- Context provides a clean way to share configuration

### Live Mode Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LIVE MODE (always records)                                                  │
│                                                                              │
│  1. Hash the request (prompt + schema + options)                            │
│  2. Call real API, get stream                                               │
│  3. As each event arrives:                                                  │
│     - Append to cache buffer (Ref)                                          │
│     - Yield to consumer                                                     │
│  4. On stream completion:                                                   │
│     - Save to provider_cache table                                          │
│                                                                              │
│  Result: API called AND response cached for future replay                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Playback Mode Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLAYBACK MODE                                                               │
│                                                                              │
│  1. Hash the request                                                        │
│  2. Look up hash in cache                                                   │
│  3. If found: Stream from cached data                                       │
│  4. If not found: Fail with CacheMiss                                       │
│                                                                              │
│  Result: Same events as original, no API call, deterministic                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Composition

### Building the Runtime

```typescript
// Individual layers
const EventStoreLayer = EventStoreLive(config)
const EventBusLayer = EventBusLive
const ProviderCacheLayer = ProviderCacheLibSQL(config)
const StateSnapshotLayer = StateSnapshotStoreLive(config)

// Compose into app layer
const AppLayer = Layer.mergeAll(
  EventStoreLayer,
  EventBusLayer,
  ProviderCacheLayer,
  StateSnapshotLayer
)

// Run with layer
Effect.runPromise(
  myProgram.pipe(Effect.provide(AppLayer))
)
```

### Layer Dependencies

```
                     ┌──────────────────┐
                     │    AppLayer      │
                     └────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌───────────────┐
│  EventStore   │    │   EventBus     │    │ ProviderCache │
│   (LibSQL)    │    │   (PubSub)     │    │   (LibSQL)    │
└───────────────┘    └────────────────┘    └───────────────┘
```

Layers have no interdependencies. Each is self-contained.

---

## Error Handling

### Typed Errors

```typescript
// Define error types
class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly provider: string
  readonly message: string
}> {}

class CacheMiss extends Data.TaggedError("CacheMiss")<{
  readonly hash: string
}> {}

// Use in Effect
const getEvents = (sessionId: SessionId): Effect.Effect<
  ReadonlyArray<AnyEvent>,
  StoreError  // Typed error
> => ...
```

### Error Recovery

```typescript
// Catch specific errors
effect.pipe(
  Effect.catchTag("CacheMiss", (error) =>
    // Fall back to live provider
    liveProvider.stream(options)
  )
)

// Catch all errors
effect.pipe(
  Effect.catchAll((error) =>
    Effect.logError("Operation failed", error).pipe(
      Effect.zipRight(Effect.fail(error))
    )
  )
)
```

---

## Testing Strategy

### Unit Tests (Pure Programs)

Test Effect programs with stubs:

```typescript
import { Layer } from "effect"

const TestLayer = Layer.mergeAll(
  EventStoreStub,
  EventBusStub,
  ProviderCacheStub
)

it("processes events correctly", async () => {
  const result = await Effect.runPromise(
    myProgram.pipe(Effect.provide(TestLayer))
  )
  expect(result).toBe(...)
})
```

### Integration Tests (Real Services)

Use real LibSQL with in-memory database:

```typescript
const TestLayer = Layer.mergeAll(
  EventStoreLive({ url: ":memory:" }),
  EventBusLive,
  ProviderCacheLibSQL({ url: ":memory:" })
)
```

### Recording-Based Tests

Record once with live mode, replay forever with playback:

```typescript
// First time: live mode (calls API, records responses)
const scaffold = await OpenScaffold.create({
  dbUrl: "file:./data/test.db",
  mode: "live"
})
// Run test, API called, responses recorded

// Subsequent times: playback mode (replays recordings)
const scaffold = await OpenScaffold.create({
  dbUrl: "file:./data/test.db",
  mode: "playback"
})
// Run test, no API calls, recorded responses used
```

**Two modes only:**
- `"live"` - Call real SDK, automatically record responses
- `"playback"` - Replay recorded responses, no SDK calls

---

## Summary of Key Principles

1. **Effect all the way down** - Use Effect primitives, not Promise/async
2. **Stream for streaming** - Keep as Stream until the edge
3. **Services have no requirements** - Dependencies at Layer level
4. **One database** - Logical separation (tables), not physical (files)
5. **Mode is explicit** - No magic env vars
6. **Stubs die** - Fast failure if stub used at runtime
7. **Events are the truth** - Everything derives from the tape
