# Architecture Decisions: Code Comparisons

This document shows concrete code for each architectural fork in the migration plan.
Review each section, pick your option, and we'll update migration-plan.md accordingly.

---

## Q1: How does the runtime talk to EventStore/EventBus?

The runtime (`executeWorkflow`) needs to persist events and broadcast them for SSE.
There are two ways to wire this.

### Option A: Callback Bridge (current plan)

The runtime stays self-contained. The server passes in a callback.

```typescript
// ── runtime.ts (core package) ──────────────────────────────
// Runtime has NO knowledge of EventStore or EventBus.
// It just calls a callback when events happen.

export interface ExecuteOptions<Input> {
  readonly input: Input
  readonly sessionId?: string
  // Server injects this:
  readonly onEvent?: (event: AnyInternalEvent) => Effect.Effect<void>
}

// Inside emitEvent():
const emitEvent = <S>(
  ctx: RuntimeContext<S>,
  options: ExecuteOptions<unknown>,  // need to thread options through
  name: string,
  payload: unknown
): Effect.Effect<AnyInternalEvent> =>
  Effect.gen(function*() {
    const causedBy = yield* Ref.get(ctx.lastEventIdRef)
    const event = yield* makeInternalEvent(name, payload, causedBy)

    // Accumulate internally
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])
    yield* Ref.set(ctx.lastEventIdRef, event.id)

    // Call external sink if provided
    if (options.onEvent) {
      yield* options.onEvent(event)
    }

    return event
  })


// ── server Routes.ts ───────────────────────────────────────
// Server wires the callback to EventStore + EventBus
export const createSessionRoute = <S>(ctx: RouteContext<S>) =>
  Effect.gen(function*() {
    const store = yield* EventStore
    const bus = yield* EventBus
    const sessionId = yield* makeSessionId()

    // This is the bridge: callback → services
    const onEvent = (event: AnyInternalEvent) =>
      Effect.gen(function*() {
        yield* store.append(sessionId, event)
        yield* bus.publish(sessionId, event)
      })

    const fiber = yield* Effect.forkDaemon(
      executeWorkflow(ctx.workflow, {
        input,
        sessionId,
        onEvent  // <── bridge
      })
    )

    return { status: 201, body: { sessionId } }
  })


// ── standalone use (execute.ts) ────────────────────────────
// No callback needed — events accumulate in the Ref internally
const execution = execute(myWorkflow, {
  input: "Build API",
  runtime: { providers: { "claude-sonnet-4-5": provider } }
  // No onEvent → events returned in result.events
})
```

**What the runtime requires**: `ProviderRegistry | ProviderRecorder | ProviderModeContext`
**What the server provides additionally**: EventStore, EventBus (wired via callback)

### Option B: Native Effect Layers (recommended)

The runtime *requires* EventStore and EventBus as Effect layers.
Server provides LibSQL implementations. Standalone provides in-memory.

```typescript
// ── runtime.ts (core package) ──────────────────────────────
// Runtime natively uses EventStore + EventBus as dependencies.
// No callback. No threading options through.

export interface ExecuteOptions<Input> {
  readonly input: Input
  readonly sessionId?: string
  // No onEvent — it's handled by layers
}

// emitEvent is clean — just uses services directly
const emitEvent = <S>(
  ctx: RuntimeContext<S>,
  name: string,
  payload: unknown
): Effect.Effect<AnyInternalEvent, StoreError, EventStore | EventBus> =>
  Effect.gen(function*() {
    const store = yield* EventStore
    const bus = yield* EventBus
    const causedBy = yield* Ref.get(ctx.lastEventIdRef)
    const event = yield* makeInternalEvent(name, payload, causedBy)

    // Persist + broadcast (single path, always)
    yield* store.append(ctx.sessionId, event)
    yield* bus.publish(ctx.sessionId, event)

    // Track internally too (for result.events)
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])
    yield* Ref.set(ctx.lastEventIdRef, event.id)

    return event
  })


// executeWorkflow signature gains EventStore + EventBus in R
export const executeWorkflow = <S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: ExecuteOptions<Input>
): Effect.Effect<
  WorkflowResult<S>,
  WorkflowError | ...,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
>


// ── server Routes.ts ───────────────────────────────────────
// Server just calls executeWorkflow. No bridge needed.
// EventStore and EventBus are already in the ManagedRuntime.
export const createSessionRoute = <S>(ctx: RouteContext<S>) =>
  Effect.gen(function*() {
    const sessionId = yield* makeSessionId()

    // That's it. The runtime uses EventStore/EventBus directly.
    const fiber = yield* Effect.forkDaemon(
      executeWorkflow(ctx.workflow, { input, sessionId })
    )

    return { status: 201, body: { sessionId } }
  })


// ── standalone use (execute.ts) ────────────────────────────
// Must provide layers — but we supply in-memory defaults
export function execute<S, Input>(
  workflow: WorkflowDef<S, Input>,
  options: ExecuteWithRuntimeOptions<Input>
): WorkflowExecution<S> {
  // Build layers including in-memory EventStore + EventBus
  const runtimeLayer = Layer.mergeAll(
    ProviderRegistryLayer,
    ProviderModeLayer,
    ProviderRecorderLayer,
    InMemoryEventStoreLayer,  // <── new: always provided
    InMemoryEventBusLayer     // <── new: always provided
  )
  // ...rest unchanged
}


// ── in-memory implementations (Layers/Stubs/) ─────────────
// These are trivial — already have EventStoreStub/EventBusStub
export const InMemoryEventStoreLayer = Layer.succeed(
  EventStore,
  {
    append: (_, __) => Effect.void,
    getEvents: (_) => Effect.succeed([]),
    getEventsFrom: (_, __) => Effect.succeed([]),
    listSessions: () => Effect.succeed([]),
    deleteSession: (_) => Effect.void
  }
)
```

**What the runtime requires**: `ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus`
**What changes**: Server is simpler (no callback wiring). Standalone needs stubs (but they're trivial).

### Rubric

| Criterion | Option A (Callback) | Option B (Native Layers) |
|-----------|---------------------|--------------------------|
| Idiomatic Effect | ❌ Callbacks break composition | ✅ Pure layer-based DI |
| Server simplicity | ❌ Must wire callback manually | ✅ Just provide layers |
| Standalone simplicity | ✅ No layers needed | ⚠️ Must provide stubs (trivial) |
| Testability | ⚠️ Must mock callback | ✅ Swap layers |
| Real-time SSE | ⚠️ Must thread callback everywhere | ✅ Bus always available |
| Type safety | ⚠️ Callback signature loosely typed | ✅ Effect tracks requirements |
| Code complexity | ⚠️ emitEvent needs options arg | ✅ emitEvent is clean |

**My recommendation: Option B.** The callback approach is a hack that works against Effect's design. With Option B, the runtime's type signature *tells you* it needs storage and broadcasting. The server provides real layers; standalone provides stubs. This is exactly how Effect is designed to work. The in-memory stubs are ~10 lines each and already exist as `EventStoreStub` and `EventBusStub`.

---

## Q2: What happens to Programs/ after migration?

Currently `Programs/` has 6 subdirectories with ~12 files. After deleting the old execution pipeline, here's what remains:

### What survives

```
Programs/
├── Recording/
│   ├── createSession.ts    → generates sessionId + initial event
│   └── recordEvent.ts      → store.append() + bus.publish()
├── Session/
│   ├── loadSession.ts      → getEvents() from store
│   ├── forkSession.ts      → copy events to new session
│   └── resumeSession.ts    → load state + restart workflow
├── State/
│   ├── computeStateAt.ts   → find last state:updated event
│   └── getCurrentState.ts  → get latest state from cache/store
├── Observation/
│   ├── observeEvents.ts    → SSE stream from EventBus
│   └── observeState.ts     → state change stream
├── workflow.ts             → loadWorkflowTape (tape loading)
└── index.ts
```

### Option A: Keep Programs/ (slimmed down)

Leave it. It's a useful organizational pattern for Effect programs that compose services. The remaining programs are legitimate reusable compositions (not old-API artifacts).

```
Programs/                    ← stays as-is, just smaller
├── Recording/
├── Session/
├── State/
├── Observation/
└── index.ts
```

The server imports `Programs.observeEvents()`, `Programs.recordEvent()`, etc. These are pure Effect programs — they compose `EventStore`, `EventBus`, and `StateSnapshotStore` into useful operations. That's exactly what programs are for.

### Option B: Fold into server + runtime

Move `Recording/` and `Observation/` into the server (they're only used there). Move `State/` into the runtime. Delete `Programs/`.

```
packages/core/src/
├── Next/
│   ├── runtime.ts          ← absorbs computeStateAt, getCurrentState
│   └── ...
├── Domain/                  ← (or Types/)
└── Services/

packages/server/src/
├── programs/                ← absorbs recording, observation, session management
│   ├── recordEvent.ts
│   ├── observeEvents.ts
│   ├── loadSession.ts
│   └── forkSession.ts
```

### Option C: Fold into Services (recommended)

Programs are just compositions of services. Put them *on* the services. Instead of `Programs.recordEvent(sessionId, event)` which internally does `store.append() + bus.publish()`, make the EventStore service do both:

```typescript
// BEFORE: Separate program composes two services
// Programs/Recording/recordEvent.ts
export const recordEvent = (sessionId, event) =>
  Effect.gen(function*() {
    const store = yield* EventStore
    const bus = yield* EventBus
    yield* store.append(sessionId, event)
    yield* bus.publish(sessionId, event)
  })

// AFTER: Just use the services directly
// If the runtime uses Option B (native layers), emitEvent already does:
//   store.append() + bus.publish()
// So recordEvent.ts is deleted — it's just what emitEvent does.

// For observeEvents, it's really just EventBus.subscribe():
// BEFORE:
export const observeEvents = (options) => {
  const bus = yield* EventBus
  return bus.subscribe(options.sessionId)
}
// AFTER: Just call bus.subscribe() directly in the route.
```

The "programs" that remain are really just 1-2 line wrappers around service calls. They don't add meaningful composition. With Option B for Q1 (native layers), most of these go away naturally because the runtime handles recording internally.

**What actually needs to survive as standalone functions:**

| Program | Still needed? | Why |
|---------|--------------|-----|
| `recordEvent` | ❌ No (runtime does it) | Runtime's emitEvent handles store+bus |
| `createSession` | ❌ No (runtime does it) | Runtime emits workflow:started |
| `computeStateAt` | ✅ Yes (server state route) | Scan events for state:updated |
| `getCurrentState` | ⚠️ Maybe | Could be `computeStateAt(events, events.length)` |
| `loadSession` | ✅ Yes (resume needs it) | Load events from store |
| `forkSession` | ✅ Yes (fork route) | Copy events to new session |
| `observeEvents` | ⚠️ Thin | Just `bus.subscribe()` + optional history |
| `observeState` | ⚠️ Thin | Just filter state:updated from bus |
| `resumeSession` | ✅ Yes | Load + restart workflow |
| `loadWorkflowTape` | ✅ Yes (replay UI) | Load events + compute state |

**My recommendation: Option A (keep Programs/, slimmed).** The directory is still useful as an organizational unit for these 5-6 surviving functions. They're genuine Effect compositions. Folding them into the server or services would scatter related logic. But we should delete the ones that become redundant when the runtime uses native layers.

---

## Q3: Where do provider types live?

After migration, `Domain/Agent.ts` will contain only these provider types:

```typescript
// These survive — they're the LLM abstraction layer:
export type ProviderMode = "live" | "playback"
export interface AgentProvider { name: string; stream: (options) => Stream<AgentStreamEvent> }
export interface ProviderRunOptions { prompt, tools?, outputSchema?, providerOptions?, resume? }
export interface AgentRunResult { text?, thinking?, output?, usage?, stopReason }
export type AgentStreamEvent = { _tag: "TextDelta" | "ThinkingDelta" | "ToolCall" | ... }

// These get DELETED — old event-driven agent:
export interface Agent<S, O> { ... }       // ← old API
export interface AgentOptions<S, O> { ... } // ← old API
export function agent<S, O>(...) { ... }    // ← old API (name collision with Next/agent.ts)
```

The awkwardness: a file called `Agent.ts` that no longer has an `Agent` type — just `AgentProvider` and stream event types. And `Next/provider.ts` already imports from it.

### Option A: Rename to Domain/Provider.ts

```
packages/core/src/
├── Domain/
│   ├── Provider.ts          ← renamed from Agent.ts, same content minus old Agent<S,O>
│   ├── Ids.ts
│   ├── Context.ts
│   ├── Errors.ts
│   ├── Hash.ts
│   ├── Interaction.ts
│   └── index.ts             ← exports from Provider.ts instead of Agent.ts
├── Next/
│   └── provider.ts          ← import { AgentProvider } from "../Domain/Provider.js"
```

Minimal change. Just a rename.

### Option B: Move into Next/provider.ts

Co-locate provider types with the ProviderRegistry that uses them.

```
packages/core/src/
├── Next/
│   └── provider.ts          ← now DEFINES AgentProvider, AgentStreamEvent, etc.
│                               Plus ProviderRegistry, runAgentDef (already there)
├── Domain/
│   ├── Ids.ts
│   ├── Context.ts
│   ├── Errors.ts
│   ├── Hash.ts
│   ├── Interaction.ts
│   └── index.ts             ← no more Agent/Provider exports

// Next/provider.ts becomes:
export type ProviderMode = "live" | "playback"
export interface AgentProvider { ... }
export interface ProviderRunOptions { ... }
export interface AgentRunResult { ... }
export type AgentStreamEvent = { ... }
// Plus existing:
export class ProviderRegistry extends Context.Tag(...) { ... }
export const runAgentDef = ...
```

**Problem**: The server's `AnthropicProvider` imports `AgentProvider` and `AgentStreamEvent`. If those move into `Next/provider.ts`, the server imports from `@open-scaffold/core` → `Next/provider.ts`. That's fine, they're re-exported from `core/index.ts`.

### Option C: Top-level Provider/ module

```
packages/core/src/
├── Provider/
│   ├── types.ts             ← AgentProvider, AgentStreamEvent, ProviderRunOptions, etc.
│   ├── registry.ts          ← ProviderRegistry (moved from Next/provider.ts)
│   ├── runner.ts            ← runAgentDef (moved from Next/provider.ts)
│   └── index.ts
├── Next/
│   ├── runtime.ts           ← import { runAgentDef } from "../Provider/runner.js"
│   └── ...
├── Domain/                   ← no provider types
```

Clean separation, but creates a new directory and moves code out of Next/.

### Rubric

| Criterion | A: Domain/Provider.ts | B: Next/provider.ts | C: Provider/ module |
|-----------|-----------------------|----------------------|---------------------|
| Minimal change | ✅ Just rename | ⚠️ Move types across files | ❌ New directory + moves |
| Logical grouping | ⚠️ Provider types in "Domain" | ✅ All provider code together | ✅ Clean module |
| Import clarity | ⚠️ Domain feels wrong | ✅ One import path | ✅ Explicit module |
| After Q5 rename | Better if Domain→Types | Makes sense | Redundant if Domain→Types |

**My recommendation: Option B** if we're going to rename Domain → Types anyway (Q5). Provider types belong with ProviderRegistry and runAgentDef. Having them in one file is clean. The file is ~400 lines total which is fine.

If we keep Domain as-is, **Option A** is the safest minimal change.

---

## Q4: EventStore/EventBus — required or optional in runtime?

### What "in-memory" means here

Let me clarify what the in-memory part is about, since you asked.

**EventStore** = persistent storage. LibSQL (SQLite) in the server. Holds all events for all sessions. Used for:
- Replay (load a past session's events)
- State reconstruction (scan for `state:updated` events)
- Session listing (what sessions exist?)

**EventBus** = real-time broadcast. PubSub in-memory. Used for:
- SSE streaming (browser subscribes, gets live events)
- State observation (watch for state changes)

**In-memory EventStore** = a `Map<SessionId, Event[]>` that lives in process memory. Data lost on restart. Used for:
- Standalone/testing: When you `run(workflow, { ... })` from a script, you don't need LibSQL. You just want the result.
- Unit tests: Don't want database dependency.

### The question

Should the runtime *always* persist to EventStore + broadcast to EventBus, even in standalone mode?

### Option A: Always required (recommended)

```typescript
// runtime.ts — always uses EventStore + EventBus
const emitEvent = <S>(ctx: RuntimeContext<S>, name: string, payload: unknown) =>
  Effect.gen(function*() {
    const store = yield* EventStore
    const bus = yield* EventBus
    const event = yield* makeInternalEvent(name, payload, ...)
    yield* store.append(ctx.sessionId, event)
    yield* bus.publish(ctx.sessionId, event)
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])
    return event
  })

// execute.ts — standalone mode provides in-memory stubs
const runtimeLayer = Layer.mergeAll(
  ProviderRegistryLayer,
  ProviderModeLayer,
  ProviderRecorderLayer,
  // Always provide these — in-memory for standalone:
  Layer.succeed(EventStore, makeInMemoryEventStore()),
  Layer.succeed(EventBus, makeInMemoryEventBus())
)

// In-memory EventStore (~15 lines):
const makeInMemoryEventStore = (): EventStoreService => {
  const sessions = new Map<string, AnyInternalEvent[]>()
  return {
    append: (sid, event) => Effect.sync(() => {
      const list = sessions.get(sid) ?? []
      list.push(event)
      sessions.set(sid, list)
    }),
    getEvents: (sid) => Effect.sync(() => sessions.get(sid) ?? []),
    getEventsFrom: (sid, pos) => Effect.sync(() => (sessions.get(sid) ?? []).slice(pos)),
    listSessions: () => Effect.sync(() => [...sessions.keys()]),
    deleteSession: (sid) => Effect.sync(() => { sessions.delete(sid) })
  }
}

// In-memory EventBus (~10 lines):
const makeInMemoryEventBus = (): EventBusService => ({
  publish: (_, __) => Effect.void,  // no subscribers in standalone
  subscribe: (_) => Stream.empty    // no one listening
})
```

**Key point**: The runtime code has ONE path. No `if (onEvent) { ... }` branching. Server provides LibSQL. Standalone provides stubs. Tests swap either.

### Option B: Optional (current plan)

```typescript
// runtime.ts — conditionally calls callback
const emitEvent = <S>(
  ctx: RuntimeContext<S>,
  options: { onEvent?: (e: AnyInternalEvent) => Effect.Effect<void> },
  name: string,
  payload: unknown
) =>
  Effect.gen(function*() {
    const event = yield* makeInternalEvent(name, payload, ...)
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])

    // Conditional: only if server provided callback
    if (options.onEvent) {
      yield* options.onEvent(event)
    }

    return event
  })
```

### Why always-required is better for your LibSQL goal

You said "we want to use one database, keep all data in the database." Option A aligns perfectly:

- **Server mode**: LibSQL EventStore → all events in SQLite
- **Standalone mode**: In-memory EventStore → events in Map (ephemeral, which is correct — you're running a script)
- **Test mode**: In-memory EventStore → events in Map (inspectable, deterministic)

There's never a case where you'd want the runtime to *not* have an event store. Even standalone mode benefits: you can inspect `result.events` (which comes from the in-memory store). The in-memory store is not a "separate option" — it's just the layer you provide when you don't need persistence.

**My recommendation: Option A (always required).** This directly enables Q1 Option B (native layers). No conditional paths in the runtime. The server provides LibSQL layers, standalone provides in-memory layers. Clean.

---

## Q5: What to call the Domain/ directory?

After migration, Domain/ contains:

```
Domain/
├── Ids.ts           ← SessionId, EventId, WorkflowId (branded types + Zod schemas)
├── Context.ts       ← SessionContext (FiberRef for ambient session info)
├── Errors.ts        ← AgentError, ProviderError, StoreError, etc. (Data.TaggedError)
├── Hash.ts          ← hashProviderRequest (deterministic request hashing)
├── Interaction.ts   ← HITL types (InteractionConfig, request/response payloads)
├── Provider.ts      ← AgentProvider, AgentStreamEvent, ProviderRunOptions (if Q3=A)
└── index.ts
```

### Option A: Keep `Domain/`

Familiar DDD terminology. "Domain" = core business types. Nothing wrong with it.

### Option B: Rename to `Types/`

```
packages/core/src/
├── Types/
│   ├── Ids.ts
│   ├── Context.ts
│   ├── Errors.ts
│   ├── Hash.ts
│   ├── Interaction.ts
│   └── index.ts
├── Next/            ← (or Runtime/)
├── Services/
├── Programs/
└── Layers/
```

Accurate but generic. Every directory has "types."

### Option C: Rename to `Shared/`

Same as B but emphasizes these are cross-cutting concerns used by Next/, Services/, Programs/.

### Option D: Dissolve into parent (recommended if Q3=B)

If provider types move into `Next/provider.ts`, the remaining files are small enough to live at root:

```
packages/core/src/
├── ids.ts            ← SessionId, EventId, etc.
├── context.ts        ← SessionContext
├── errors.ts         ← All error types
├── hash.ts           ← Provider request hashing
├── interaction.ts    ← HITL types
├── Next/             ← (or Runtime/)
├── Services/
├── Programs/
└── Layers/
```

Flat structure. No sub-directory needed for 5 files.

### Rubric

| Criterion | A: Domain/ | B: Types/ | C: Shared/ | D: Dissolve |
|-----------|-----------|-----------|------------|-------------|
| Accuracy | ⚠️ Not really DDD | ⚠️ Generic | ⚠️ Vague | ✅ Files speak for themselves |
| Convention | ✅ Familiar | ⚠️ Unusual | ⚠️ Unusual | ✅ Common in small packages |
| Import paths | `../Domain/Errors.js` | `../Types/Errors.js` | `../Shared/Errors.js` | `../errors.js` |
| Migration effort | ✅ Zero | ⚠️ Rename imports | ⚠️ Rename imports | ⚠️ Move + rename imports |

**My recommendation: Option A (keep Domain/) for now.** It's a cosmetic rename with real churn. Renaming every import path across the codebase for a slightly more accurate directory name isn't worth it during a migration. If it bugs you later, it's a single find-and-replace.

If Q3=B (provider types move to Next/), then **Option D** becomes attractive because Domain/ shrinks to just 5 small files.

---

---

## Q6: Testing Philosophy — No Mocks, Real Implementations Only

### Principle

**Never use mocks or stubs that fake behavior.** Every test should exercise real code paths.
Fixtures come from real API recordings (ProviderRecorder), not fabricated data.

This means:
- ❌ No `EventStoreStub` that returns `Effect.succeed([])`
- ❌ No mock providers that return hardcoded JSON
- ❌ No `AppLayerStub` that wires fake services together
- ✅ LibSQL with `:memory:` — real SQL, real migrations, real behavior
- ✅ ProviderRecorder playback — real API responses, recorded and replayed
- ✅ EventBusLive (PubSub) — already in-memory by nature, nothing to fake

### Impact on Architecture

**Delete the entire `Layers/Stubs/` directory:**
- `AgentServiceStub.ts` — old API, deleted anyway
- `WorkflowRuntimeStub.ts` — old API, deleted anyway
- `EventStoreStub.ts` — replaced by `EventStoreLive({ url: ":memory:" })`
- `EventBusStub.ts` — replaced by real `EventBusLive`
- `StateSnapshotStoreStub.ts` — replaced by `StateSnapshotStoreLive({ url: ":memory:" })`
- `ProviderRecorderStub.ts` — replaced by `ProviderRecorderLive({ url: ":memory:" })`
- `AppLayerStub.ts` — replaced by `makeTestLayer()`
- `index.ts` — deleted

**New test helper (in `packages/testing` or `packages/server`):**

```typescript
export const makeTestLayer = () => {
  const db = ":memory:"
  return Layer.mergeAll(
    EventStoreLive({ url: db }),
    StateSnapshotStoreLive({ url: db }),
    ProviderRecorderLive({ url: db }),
    Layer.effect(EventBus, EventBusLive),
    Layer.succeed(ProviderModeContext, { mode: "playback" })
  )
}
```

**Standalone APIs (`run()`, `execute()`) require a database path:**

```typescript
// RuntimeConfig gains a required database field
export interface RuntimeConfig {
  readonly providers: Record<string, AgentProvider>
  readonly database: string   // ":memory:" or "./data/app.db"
  readonly mode?: ProviderMode
}

// Usage: standalone script
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: {
    providers: { "claude-sonnet-4-5": anthropicProvider },
    database: "./data/workflow.db",
    mode: "live"
  }
})

// Usage: quick ephemeral run
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: {
    providers: { "claude-sonnet-4-5": anthropicProvider },
    database: ":memory:",
    mode: "live"
  }
})
```

### What about pure functions?

Functions like `computeStateAt` take arrays as input — they don't use services.
No mocks needed. No database needed. They're just functions operating on data.

```typescript
// This is fine — pure function, no services involved
const result = computeStateAt(events, position)
// events comes from a real recording or a real test run
```

---

---

## Q7: Always Persist — Default Database Behavior

### Principle

**Storage is cheap. Always persist.** Even throwaway runs should be browsable later.
Like ChatGPT persisting throwaway chats — you probably won't look, but you can.

This means `run()` / `execute()` should default to a **file**, not `:memory:`.

### Default database location

```typescript
export interface RuntimeConfig {
  readonly providers: Record<string, AgentProvider>
  readonly mode?: ProviderMode  // default: "live"
  // Default: "./scaffold.db" (current working directory)
  // Tests explicitly pass ":memory:"
  readonly database?: string
}

// Simple script — persists automatically to ./scaffold.db
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: { providers: { "claude-sonnet-4-5": provider } }
})

// Explicit path
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: {
    providers: { "claude-sonnet-4-5": provider },
    database: "./data/my-project.db"
  }
})

// Tests — ephemeral (only place ":memory:" is used)
const testLayer = makeTestLayer()  // uses ":memory:" internally
```

### Who uses what

| Context | Database | Why |
|---------|----------|-----|
| Server (`OpenScaffold.create`) | Explicit file path (required) | Production data |
| Standalone `run()` / `execute()` | Default `./scaffold.db` | Always persist, storage is cheap |
| Tests | `:memory:` via `makeTestLayer()` | Ephemeral, real implementation |

---

---

## Q8: Consumer Callback API — WorkflowObserver Protocol

### Decision: Single `observer` object with typed concern-mapped methods

Replace flat callback props (`onEvent`, `onText`, `onStateChange`, etc.) with a
`WorkflowObserver<S>` protocol that groups callbacks by consumer concern, not by event type.

```typescript
interface StreamChunk {
  readonly type: "text" | "thinking"
  readonly delta: string
  readonly agent: string
}

interface InputRequest {
  readonly prompt: string
  readonly type: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
}

interface WorkflowObserver<S> {
  // State (THE primary hook — state is prime)
  stateChanged?(state: S, patches?: ReadonlyArray<Patch>): void

  // Phase lifecycle
  phaseChanged?(phase: string, from?: string): void

  // Streaming content (combines text + thinking)
  streamed?(chunk: StreamChunk): void

  // Agent activity (for loading indicators)
  agentStarted?(info: { agent: string; phase?: string }): void
  agentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void

  // HITL (only hook that returns — control flow, not observation)
  inputRequested?(request: InputRequest): Promise<string>

  // Lifecycle
  started?(sessionId: string): void
  completed?(result: WorkflowResult<S>): void
  errored?(error: WorkflowError): void

  // Escape hatch (raw events for logging/debugging)
  event?(event: AnyInternalEvent): void
}
```

### Usage examples

```typescript
// run() API
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: { providers: { ... } },
  observer: {
    stateChanged: (state) => setState(state),
    streamed: (chunk) => process.stdout.write(chunk.delta),
    inputRequested: (req) => showPrompt(req.prompt)
  }
})

// Headless — no observer needed
const result = await run(myWorkflow, { input: goal, runtime: { ... } })
```

### Why this is better

- **Concern-mapped, not event-mapped** — consumers think "show state" not "handle state:updated event"
- **Composable** — pass observer objects around, merge them, build hooks on top
- **Typed** — `StreamChunk` discriminated union replaces `onText` + `onThinking` positional args
- **`inputRequested` takes a typed object** — not `(prompt, type, options?)` positional args
- **Consistent naming** — all past-tense: `stateChanged`, `phaseChanged`, `agentStarted`
- **`event` is the escape hatch**, not the primary interface

---

## Q9: Effect Naming Convention — Live Suffix

### Decision: Rename all implementations to `FooLive`

Standard Effect convention: `Foo` (Tag) + `FooLive` (production Layer).
Config determines behavior, not the name.

```
// Before (inconsistent)                    // After (conventional)
EventStoreLive({ url })               →  EventStoreLive({ url })
StateSnapshotStoreLive({ url })       →  StateSnapshotStoreLive({ url })
ProviderRecorderLive({ url })         →  ProviderRecorderLive({ url })
EventBusLive                            →  EventBusLive (already correct)
ProviderModeContext                     →  ProviderModeLive({ mode })

// File renames in packages/server/src/store/
EventStore.ts                           →  EventStoreLive.ts
StateSnapshotStore.ts                   →  StateSnapshotStoreLive.ts
ProviderRecorderLive.ts               →  ProviderRecorderLive.ts
```

### Why

- Config determines behavior: `EventStoreLive({ url: ":memory:" })` vs `EventStoreLive({ url: "./data/app.db" })`
- If we ever swap LibSQL, the name doesn't change
- Consistent with `EventBusLive` which already follows the convention
- Standard across Effect ecosystem (`HttpClientLive`, `FileSystemLive`, etc.)

---

## Final Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q1 | **B: Native Effect layers** | Idiomatic Effect; no callback plumbing; server just provides layers |
| Q2 | **C: Fold into services / delete Programs/** | Programs/ was designed for old event-loop. Remaining helpers move to server package. `computeStateAt` becomes a utility function. |
| Q3 | **B: Move to Next/provider.ts** | Co-locate provider types with ProviderRegistry and runAgentDef |
| Q4 | **A: Always required** | One code path; LibSQL everywhere; `:memory:` only for tests |
| Q5 | **A: Keep Domain/ for now** | Not worth the churn during migration |
| Q6 | **No mocks policy** | Delete all stubs; use real LibSQL `:memory:` + real EventBusLive |
| Q7 | **Always persist by default** | `run()` defaults to `./scaffold.db`; only tests use `:memory:` |
| Q8 | **WorkflowObserver protocol** | Single `observer` object with concern-mapped methods; replaces flat callbacks |
| Q9 | **Live naming convention** | `EventStoreLive` → `EventStoreLive`; standard Effect convention |

### How these reinforce each other

```
Q1 (native layers) ──→ EventStore/EventBus always in type signature
        │
Q4 (always required) ──→ ONE code path, no conditionals
        │
Q6 (no mocks) ──→ layers are always REAL implementations
        │
Q7 (always persist) ──→ default database file; `:memory:` only for tests
        │
Q2 (delete Programs/) ──→ runtime handles recording natively; helpers move to server
        │
Q3 (provider in Next/) ──→ clean module; Domain/ stays minimal
```

### Post-migration directory structure

```
packages/core/src/
├── Next/                    ← (rename to Runtime/ in Phase 9?)
│   ├── agent.ts             ← agent() factory
│   ├── phase.ts             ← phase() factory
│   ├── workflow.ts          ← workflow() factory
│   ├── types.ts             ← Event types, error types
│   ├── provider.ts          ← AgentProvider + ProviderRegistry + runAgentDef
│   ├── runtime.ts           ← executeWorkflow (uses EventStore/EventBus natively)
│   ├── execute.ts           ← async iterator API
│   ├── run.ts               ← Promise API with callbacks
│   ├── utils.ts             ← computeStateAt (pure function)
│   └── index.ts
├── Domain/                  ← shared types (keep name for now)
│   ├── Ids.ts
│   ├── Context.ts
│   ├── Errors.ts
│   ├── Hash.ts
│   ├── Interaction.ts
│   └── index.ts
├── Services/                ← Effect Context.Tags (interfaces only)
│   ├── EventStore.ts
│   ├── EventBus.ts
│   ├── StateSnapshotStore.ts
│   ├── ProviderRecorder.ts
│   ├── ProviderMode.ts
│   ├── StateCache.ts
│   └── index.ts
├── Layers/                  ← (stubs deleted, only Logger remains)
│   ├── Logger.ts
│   └── index.ts
└── index.ts                 ← public API surface

packages/server/src/
├── programs/                ← server-specific helpers (moved from core)
│   ├── observeEvents.ts
│   ├── loadSession.ts
│   ├── forkSession.ts
│   └── resumeSession.ts
├── http/
├── provider/
├── services/
├── store/
└── index.ts
```
