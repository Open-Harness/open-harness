# Service Contracts

**Date**: 2026-01-26
**Status**: Implementation Complete
**Package**: `@open-scaffold/core` (Tags), `@open-scaffold/server` (Implementations)

This document defines all Effect service contracts with their interfaces, errors, and architectural rationale.

---

## Design Principle

```
PUBLIC API (SDK consumers)          INTERNAL (implementation)
─────────────────────────────────   ─────────────────────────────────
Zod schemas                         Effect Schema
Promise<T>                          Effect<T, E, R>
Plain TypeScript interfaces         Context.Tag services
Class errors (for instanceof)       Data.TaggedError
```

**Effect is hidden from users.** The public API uses plain TypeScript + Zod.

---

## Service Pattern

Every service follows this pattern:

```typescript
// 1. Define the interface
interface EventStoreService {
  readonly append: (sessionId: SessionId, event: AnyEvent) => Effect.Effect<void, StoreError>
  readonly getEvents: (sessionId: SessionId) => Effect.Effect<ReadonlyArray<AnyEvent>, StoreError>
}

// 2. Create the Tag
class EventStore extends Context.Tag("@open-scaffold/EventStore")<
  EventStore,
  EventStoreService
>() {}

// 3. Stub for compile-time validation
const EventStoreStub = Layer.succeed(EventStore, EventStore.of({
  append: () => Effect.die("EventStore.append not implemented"),
  getEvents: () => Effect.die("EventStore.getEvents not implemented"),
}))

// 4. Implement as Layer
const EventStoreLive = (config: Config): Layer.Layer<EventStore> =>
  Layer.effect(EventStore, Effect.gen(function* () {
    // ... implementation
    return EventStore.of({ append, getEvents })
  }))
```

**Critical rule:** Service interfaces have `R = never`. Dependencies are at the Layer level.

---

## Persistence Services

### EventStore

The append-only event log. Source of truth for all workflow history.

```typescript
interface EventStoreService {
  readonly append: (
    sessionId: SessionId,
    event: AnyEvent
  ) => Effect.Effect<void, StoreError>

  readonly getEvents: (
    sessionId: SessionId
  ) => Effect.Effect<ReadonlyArray<AnyEvent>, StoreError>

  readonly getEventsFrom: (
    sessionId: SessionId,
    fromPosition: number
  ) => Effect.Effect<ReadonlyArray<AnyEvent>, StoreError>

  readonly listSessions: () => Effect.Effect<ReadonlyArray<SessionId>, StoreError>

  readonly deleteSession: (
    sessionId: SessionId
  ) => Effect.Effect<void, StoreError>
}

class EventStore extends Context.Tag("@open-scaffold/EventStore")<
  EventStore,
  EventStoreService
>() {}
```

**Implementation**: `EventStoreLive` in `@open-scaffold/server`

**Why append-only?** Events are facts. You can't change history. This enables replay, debugging, and audit.

---

### StateSnapshotStore

Periodic state checkpoints for fast recovery.

```typescript
interface StateSnapshotStoreService {
  readonly getLatest: (
    sessionId: SessionId
  ) => Effect.Effect<StateSnapshot | null, StoreError>

  readonly save: (
    snapshot: StateSnapshot
  ) => Effect.Effect<void, StoreError>

  readonly delete: (
    sessionId: SessionId
  ) => Effect.Effect<void, StoreError>
}

interface StateSnapshot {
  readonly sessionId: SessionId
  readonly position: number      // Event count at snapshot
  readonly state: unknown        // Serialized state
  readonly timestamp: Date
}

class StateSnapshotStore extends Context.Tag("@open-scaffold/StateSnapshotStore")<
  StateSnapshotStore,
  StateSnapshotStoreService
>() {}
```

**Implementation**: `StateSnapshotStoreLive` in `@open-scaffold/server`

**Why snapshots?** For large sessions (10k+ events), replaying all handlers on recovery is O(n). Snapshots make it O(1) + delta.

**Snapshot frequency**: Every 1000 events by default. Configurable.

---

### ProviderRecorder

Records and replays agent provider responses.

```typescript
interface ProviderRecorderService {
  readonly load: (
    hash: string
  ) => Effect.Effect<RecordedResponse | null, StoreError>

  readonly save: (
    hash: string,
    response: RecordedResponse
  ) => Effect.Effect<void, StoreError>

  readonly delete: (
    hash: string
  ) => Effect.Effect<void, StoreError>

  readonly list: () => Effect.Effect<ReadonlyArray<RecordingMetadata>, StoreError>
}

interface RecordedResponse {
  readonly hash: string
  readonly streamEvents: ReadonlyArray<AgentStreamEvent>
  readonly result: unknown
  readonly metadata: {
    readonly recordedAt: Date
    readonly prompt: string
    readonly model: string
  }
}

class ProviderRecorder extends Context.Tag("@open-scaffold/ProviderRecorder")<
  ProviderRecorder,
  ProviderRecorderService
>() {}
```

**Implementation**: `ProviderRecorderLive` in `@open-scaffold/server`

**Hash computation**: SHA-256 of prompt + outputSchema + tools. Same request = same hash.

**Why record stream events?** Playback reproduces the exact streaming experience, not just final result.

---

## Runtime Services

### EventBus

Live broadcast to SSE subscribers.

```typescript
interface EventBusService {
  readonly publish: (
    sessionId: SessionId,
    event: AnyEvent
  ) => Effect.Effect<void>

  readonly subscribe: (
    sessionId: SessionId
  ) => Stream.Stream<AnyEvent>
}

class EventBus extends Context.Tag("@open-scaffold/EventBus")<
  EventBus,
  EventBusService
>() {}
```

**Implementation**: `EventBusLive` (in-memory PubSub)

**Why in-memory?** EventBus is ephemeral. Only for live connections. EventStore is the durable source of truth.

**Why Stream return?** Composes naturally with Effect. Supports backpressure and cancellation.

---

### StateCache\<S\>

Typed in-memory state cache with reactive subscriptions.

```typescript
interface StateCache<S> {
  readonly get: (
    sessionId: SessionId
  ) => Effect.Effect<S, SessionNotFound | StoreError | HandlerError>

  readonly set: (
    sessionId: SessionId,
    state: S
  ) => Effect.Effect<void>

  readonly subscribe: (
    sessionId: SessionId
  ) => Effect.Effect<SubscriptionRef<S>, SessionNotFound | StoreError | HandlerError>

  readonly invalidate: (
    sessionId: SessionId
  ) => Effect.Effect<void>
}
```

**Implementation**: Factory function (not a Tag) - creates typed cache per workflow.

**Why generic S?** Preserves type safety. `cache.get()` returns `S`, not `unknown`.

**Why SubscriptionRef?** Enables reactive UI updates. Client subscribes, gets notified on state changes.

**Why not Effect.Cache?** SubscriptionRef provides reactive updates. Effect.Cache is for memoization.

---

### ProviderModeContext

Tracks live vs playback mode.

```typescript
interface ProviderModeContextValue {
  readonly mode: "live" | "playback"
}

class ProviderModeContext extends Context.Tag("@open-scaffold/ProviderModeContext")<
  ProviderModeContext,
  ProviderModeContextValue
>() {}
```

**Why a service?** Mode is set at server level, not per-provider. All programs can access it.

**Two modes only:**
- `"live"` - Call real SDK, automatically record responses
- `"playback"` - Replay recorded responses, no SDK calls

---

## Provider Services

### AgentProvider

Abstract interface for Agent SDKs.

```typescript
interface AgentProviderService {
  readonly name: string

  readonly stream: (
    options: ProviderRunOptions
  ) => Stream.Stream<AgentStreamEvent, ProviderError>

  readonly info: () => ProviderInfo
}

interface ProviderRunOptions {
  readonly prompt: string
  readonly tools?: ReadonlyArray<unknown>
  readonly outputSchema: ZodType<unknown>  // REQUIRED
  readonly providerOptions?: Record<string, unknown>
}

interface ProviderInfo {
  readonly name: string
  readonly model: string
  readonly capabilities: ReadonlyArray<string>
}

class AgentProvider extends Context.Tag("@open-scaffold/AgentProvider")<
  AgentProvider,
  AgentProviderService
>() {}
```

**Implementation**: `AnthropicProvider` in `@open-scaffold/server`

**Why outputSchema required?** Enforces reliable structured output. Providers convert Zod to JSON Schema for the SDK.

**Why Stream return?** Enables true streaming. No buffering. Events flow as they arrive.

---

### AgentStreamEvent

Events emitted by providers during streaming.

```typescript
type AgentStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "text_complete"; text: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "thinking_complete"; thinking: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; output: unknown; isError: boolean }
  | { type: "stop"; reason: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "session_init"; sessionId: string }  // Provider session ID
  | { type: "result"; value: unknown }
```

**Why session_init?** Captures provider session ID for multi-turn conversations. Required for resume.

---

### AgentService

Runs agents and emits domain events.

```typescript
interface AgentServiceOps {
  readonly run: (
    agent: Agent<unknown, unknown>,
    state: unknown,
    trigger: AnyEvent,
    sessionId: SessionId
  ) => Stream.Stream<AnyEvent, AgentError>
}

class AgentService extends Context.Tag("@open-scaffold/AgentService")<
  AgentService,
  AgentServiceOps
>() {}
```

**Implementation**: Core implementation using `runAgentWithStreaming` program.

**Why Stream return?** Agent execution is streaming. Events flow as they're generated.

---

### WorkflowRuntime

Orchestrates the entire workflow execution.

```typescript
interface WorkflowRuntimeService {
  readonly run: (
    workflowDef: WorkflowDef<unknown>,
    options: RunOptions
  ) => Effect.Effect<WorkflowResult<unknown>, WorkflowError>

  readonly observe: (
    sessionId: SessionId
  ) => Stream.Stream<AnyEvent, SessionNotFound>
}

interface RunOptions {
  readonly input: unknown
  readonly sessionId?: SessionId  // Optional, generated if not provided
}

class WorkflowRuntime extends Context.Tag("@open-scaffold/WorkflowRuntime")<
  WorkflowRuntime,
  WorkflowRuntimeService
>() {}
```

**Implementation**: Core implementation using `runWorkflow` program.

---

## Error Types

All errors extend `Data.TaggedError` for typed error handling.

### StoreError

```typescript
class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "read" | "write" | "delete" | "list"
  readonly cause: unknown
}> {}
```

### SessionNotFound

```typescript
class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: SessionId
}> {}
```

### WorkflowNotFound

```typescript
class WorkflowNotFound extends Data.TaggedError("WorkflowNotFound")<{
  readonly workflowId: WorkflowId
}> {}
```

### AgentError

```typescript
class AgentError extends Data.TaggedError("AgentError")<{
  readonly agentName: string
  readonly phase: "prompt" | "execution" | "output"
  readonly cause: unknown
}> {}
```

### ProviderError

```typescript
class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly code: "RATE_LIMITED" | "CONTEXT_EXCEEDED" | "AUTH_FAILED" | "NETWORK" | "UNKNOWN"
  readonly message: string
  readonly retryable: boolean
  readonly cause?: unknown
}> {}
```

### ValidationError

```typescript
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly errors: ReadonlyArray<{ path: string; message: string }>
}> {}
```

### HandlerError

```typescript
class HandlerError extends Data.TaggedError("HandlerError")<{
  readonly handlerName: string
  readonly cause: unknown
}> {}
```

### RecordingNotFound

```typescript
class RecordingNotFound extends Data.TaggedError("RecordingNotFound")<{
  readonly hash: string
}> {}
```

---

## Session Context

Ambient session ID propagation via FiberRef.

```typescript
const SessionContext = FiberRef.unsafeMake<SessionId | null>(null)

// Set session context
Effect.locally(SessionContext, sessionId)(program)

// Read session context
const sessionId = yield* FiberRef.get(SessionContext)
```

**Why FiberRef?** Session ID flows through the fiber tree without explicit passing. All logging automatically includes it.

---

## Layer Composition

Services compose into a full application layer:

```typescript
const AppLayer = Layer.mergeAll(
  EventStoreLive({ url: "file:./data/events.db" }),
  StateSnapshotStoreLive({ url: "file:./data/events.db" }),
  ProviderRecorderLive({ url: "file:./data/events.db" }),
  EventBusLive,
  ProviderModeContextLive({ mode: "live" }),
  AnthropicProviderLayer,
  AgentServiceLive,
  WorkflowRuntimeLive,
  LoggerPretty,
)

// Run a program
Effect.runPromise(
  program.pipe(Effect.provide(AppLayer))
)
```

---

## Next

See [03-effect-programs.md](./03-effect-programs.md) for Effect program compositions.
