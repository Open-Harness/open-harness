# ADR-006: State Sourcing Model

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** State Sourcing Model
**Related Issues:** ARCH-009, ARCH-010, ARCH-011, ARCH-018, ARCH-019, DOC-005

---

## Executive Summary

**Decision:** Adopt true event sourcing. Events are the single source of truth. State is always derived from events, never mutated directly.

**Why:** This ensures forking, replay, and resume always produce correct, deterministic state. It aligns with Effect's reactive primitives (SubscriptionRef, PubSub, Stream) and enables the eval system's fork-based comparisons.

**Impact on Public API:** None. The `run()` API, React hooks, and all consumer-facing code remain unchanged. This is purely an internal architectural decision.

---

## Table of Contents

1. [The Problem Explained](#the-problem-explained)
2. [What Is Event Sourcing](#what-is-event-sourcing)
3. [The Decision](#the-decision)
4. [Architecture Deep Dive](#architecture-deep-dive)
5. [How Caching Works](#how-caching-works)
6. [How Forking Works](#how-forking-works)
7. [Consumer DX Impact](#consumer-dx-impact)
8. [Options Considered](#options-considered)
9. [Implementation Guide](#implementation-guide)
10. [Related Files](#related-files)

---

## The Problem Explained

### Where State Currently Lives

When a workflow runs, state exists in **4 different places**:

| Location | What It Is | When It's Used |
|----------|------------|----------------|
| `Ref<S>` | Effect's mutable reference | During execution — agents read/write here |
| Events | `state:updated` events in EventStore | Persisted for resume/replay |
| Snapshots | Periodic state checkpoints | Fast resume optimization |
| Client cache | React hook state | UI rendering |

### The Current Flow (State-First)

When an agent updates state, here's what happens in `runtime.ts`:

```typescript
// Step 1: Mutate the Ref (state changes NOW)
const currentState = yield* Ref.get(ctx.stateRef)
const [newState, patches, inversePatches] = produceWithPatches(currentState, updater)
yield* Ref.set(ctx.stateRef, newState)  // ← Mutation happens HERE

// Step 2: Emit an event (AFTER the mutation)
yield* emitEvent(ctx, "state:updated", {
  state: newState,
  patches,
  inversePatches,
})
```

### The Problem: What If Step 2 Fails?

```typescript
yield* Ref.set(ctx.stateRef, newState)      // ✅ Succeeded — Ref now says X
yield* emitEvent(ctx, "state:updated", ...)  // ❌ Fails — database is down
```

Now:
- The `Ref` says state is `X`
- The `EventStore` says state is `Y` (the previous state)
- **They disagree**

If the workflow completes, the `Ref` value is returned to the user. But if someone later tries to **resume** or **fork** from this session by loading events from the database, they'll compute `Y`, not `X`.

### Why This Matters for Evals and Forking

The eval system design requires forking:

```typescript
// From eval-system-design.md
const resultA = await fork({
  from: baseline.sessionId,
  at: { phase: "coding", occurrence: "first" },
  workflow: opusCoderVariant,
})

const resultB = await fork({
  from: baseline.sessionId,
  at: { phase: "coding", occurrence: "first" },
  workflow: gptCoderVariant,
})
```

Both forks need to start with **the exact same state**. They load state by:

1. Querying events from `EventStore`
2. Computing state from those events
3. Starting execution from that computed state

If the `Ref` and `EventStore` can disagree, forking becomes unreliable. Fork A might see different state than Fork B, even though they're forking from "the same point".

### The Problem Statement

**Events should be the single source of truth, but currently they're not. State is mutated first, then events are emitted. This creates a window where they can diverge, making fork, resume, and replay unreliable.**

---

## What Is Event Sourcing

### The Core Principle

In true event sourcing:

1. **Events describe what happened** — they are facts, intents, immutable records
2. **State is derived by folding over events** — computed, never stored as primary
3. **Events are immutable** — append-only log, you can't change the past
4. **State is a projection** — a view over the event history

```typescript
// Pure event sourcing: state is ALWAYS derived
const currentState = events.reduce(
  (state, event) => applyEvent(state, event),
  initialState
)
```

### The Philosophical Difference

**State-First (Current Model):**
```
1. Mutate the Ref (state changes)
2. THEN emit an event (record what happened)
```

The Ref is the source of truth. Events are an **audit log** — they describe what *already happened* to state.

**Analogy:** You update your bank balance, then write in your ledger what you did.

**Event Sourcing (New Model):**
```
1. Emit an event (describe what should happen)
2. THEN derive state from events
```

Events are the source of truth. State is **computed** — it's just a view over the event history.

**Analogy:** You write in your ledger, and your bank balance is calculated from the ledger entries.

### Why Event Sourcing Is "Philosophically Correct"

Because **events are facts**. They describe what happened. You can't change the past.

State is an **interpretation** of those facts. It's computed, not stored. This means:

1. **You can always recompute state** — just replay events
2. **You can compute state at any point in time** — replay events up to that point
3. **Events and state can never disagree** — because state IS events
4. **Time travel is free** — `deriveState(events.slice(0, n))` gives state at position n

### The Time Travel Superpower

With event sourcing, you get this for free:

```typescript
// State at event #100
const stateAt100 = deriveState(events.slice(0, 100), initial)

// State at event #500
const stateAt500 = deriveState(events.slice(0, 500), initial)

// State now (all events)
const stateNow = deriveState(events, initial)
```

This is exactly what forking needs:

```typescript
// Fork at event #100
const forkedState = deriveState(events.slice(0, 100), initial)
// Continue from there with a different workflow variant
```

---

## The Decision

**Adopt true event sourcing. Events are the single source of truth. State is always derived from events.**

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Source of truth | `Ref<S>` during execution | Events (always) |
| State mutation | `Ref.update()` then emit event | Emit event, projection derives state |
| State access | `Ref.get()` | `SubscriptionRef.get()` (derived) |
| Divergence possible? | Yes (between Ref and EventStore) | No (state IS events) |
| Time travel | Not possible | `deriveState(events.slice(0, n))` |
| Fork correctness | Hope events match Ref | Guaranteed (state derived from events) |

### Effect Primitives Used

| Primitive | Purpose |
|-----------|---------|
| `PubSub` | EventHub for event distribution |
| `Stream` | Processing event sequences |
| `SubscriptionRef` | Reactive derived state |
| `Effect.forkScoped` | Background projection fiber |
| `Scope` | Automatic cleanup when workflow ends |
| `Match.exhaustive` | Type-safe event handling |
| `Cache` | Memoization in StateCache |

This isn't inventing new patterns — it's using Effect's built-in tools for exactly what they were designed for.

---

## Architecture Deep Dive

### The Complete Picture

```
                         User runs workflow
                                │
                                ▼
                    ┌───────────────────────┐
                    │     run(workflow)     │
                    │   (Public API - ADR-001)   │
                    └───────────┬───────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNAL ARCHITECTURE                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    EventHub (PubSub)                     │   │
│  │                     (ADR-004)                            │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                     │
│       ┌───────────────────┼───────────────────┐                 │
│       ▼                   ▼                   ▼                 │
│  ┌─────────┐      ┌──────────────┐     ┌───────────┐           │
│  │EventStore│     │StateProjection│    │ Observer  │           │
│  │(persist)│      │(SubscriptionRef)│   │ Callbacks │           │
│  └─────────┘      └───────┬──────┘     └───────────┘           │
│                           │                                     │
│                           ▼                                     │
│                   ┌───────────────┐                             │
│                   │  StateCache   │                             │
│                   │ (Effect.Cache │                             │
│                   │ + snapshots)  │                             │
│                   └───────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │  fork()  │    │ React    │    │  SSE     │
         │  (evals) │    │ Hooks    │    │ Clients  │
         └──────────┘    └──────────┘    └──────────┘
```

### Component Responsibilities

| Component | Purpose | ADR |
|-----------|---------|-----|
| `run()` | Public execution API | ADR-001 |
| `EventHub` | PubSub for event distribution | ADR-004 |
| `StateProjection` | Fiber that derives state from events | ADR-006 |
| `StateCache` | Cache + snapshot optimization | ADR-006 |
| `fork()` | Load state at point, continue with variant | Eval design |
| React hooks | Subscribe to state changes | Client package |
| SSE | Stream events to browser | Server package |

### State Projection Fiber

A background fiber watches events and maintains derived state:

```typescript
const makeStateProjection = <S>(
  hub: EventHub,
  initial: S
): Effect.Effect<SubscriptionRef.SubscriptionRef<S>, never, Scope.Scope> =>
  Effect.gen(function*() {
    // Create reactive state holder
    const stateRef = yield* SubscriptionRef.make(initial)

    // Subscribe to events from EventHub
    const eventStream = yield* hub.subscribe()

    // Fork a fiber that updates state when events arrive
    yield* Effect.forkScoped(
      eventStream.pipe(
        Stream.runForEach((event) =>
          Match.value(event).pipe(
            Match.tag("StateIntent", (intent) =>
              SubscriptionRef.update(stateRef, (current) =>
                applyPatches(current, intent.patches)
              )
            ),
            Match.tag("StateCheckpoint", (checkpoint) =>
              SubscriptionRef.set(stateRef, checkpoint.state as S)
            ),
            Match.orElse(() => Effect.void)  // Ignore other events
          )
        )
      )
    )

    return stateRef
  })
```

### Agent State Access

Agents read state from the `SubscriptionRef` and emit events (not mutations):

```typescript
const executeAgent = <S>(
  agent: AgentDef<S>,
  stateRef: SubscriptionRef.SubscriptionRef<S>,
  hub: EventHub
) =>
  Effect.gen(function*() {
    // Read current state (derived from events)
    const state = yield* SubscriptionRef.get(stateRef)

    // Generate prompt from state
    const prompt = agent.prompt(state)

    // Call agentic SDK (provider is on agent per ADR-010)
    const output = yield* runProvider(agent.provider, prompt)

    // Compute state update as patches
    const patches = computePatches(state, agent.update, output)

    // Emit event (NOT mutation — the projection will update state)
    yield* hub.publish(new StateIntent({
      intentId: crypto.randomUUID(),
      patches,
      timestamp: new Date(),
    }))

    return output
  })
```

### The Critical Change

**Before (state-first):**
```typescript
// Mutate first, emit second
yield* Ref.update(stateRef, updater)
yield* emitEvent("state:updated", { state: newState })
```

**After (event-first):**
```typescript
// Emit first, projection updates state
yield* hub.publish(new StateIntent({ patches }))
// State is updated by the projection fiber automatically
```

### How Agents See State Changes

When Agent A emits a `StateIntent`:

1. Event goes to `EventHub`
2. Projection fiber receives event
3. Projection applies patches to `SubscriptionRef`
4. Agent B (reading from same `SubscriptionRef`) sees updated state

```
Agent A                    Projection              Agent B
   │                           │                      │
   │  publish(StateIntent)     │                      │
   │───────────────────────────▶                      │
   │                           │                      │
   │                    apply patches                 │
   │                           │                      │
   │                    SubscriptionRef               │
   │                      updated                     │
   │                           │                      │
   │                           │◀──── read state ────│
   │                           │                      │
```

---

## How Caching Works

### The Problem Caching Solves

If state is derived from events, then every time you read state, you have to:

1. Load all events from database
2. Replay them to compute state

If there are 10,000 events, this is slow.

### The Solution: Snapshots

A snapshot is a **checkpoint** — a saved copy of derived state at a specific event position.

```typescript
interface Snapshot<S> {
  state: S              // The computed state
  position: number      // "State after event #1500"
  createdAt: Date
}
```

To get current state:

1. Load the latest snapshot (e.g., at position 1500)
2. Load events after that position (e.g., events 1501-1750)
3. Apply those 250 events to the snapshot state

Instead of replaying 1750 events, you replay 250. Much faster.

### When Are Snapshots Created?

| Trigger | When | Tradeoff |
|---------|------|----------|
| Every N events | After every 100/1000 events | Regular, predictable |
| On phase change | When entering a new phase | Natural checkpoint |
| On pause | When workflow is paused | Good resume point |
| On demand | User explicitly requests checkpoint | Manual control |

**Default:** Snapshot every 1000 events AND on phase change AND on pause.

### StateCache Implementation

```typescript
const makeStateCache = <S>(config: StateCacheConfig<S>) =>
  Effect.gen(function*() {
    const eventStore = yield* EventStore
    const snapshotStore = yield* StateSnapshotStore

    // Recompute state from snapshot + events
    const recomputeState = (sessionId: SessionId) =>
      Effect.gen(function*() {
        // 1. Get latest snapshot
        const snapshot = yield* snapshotStore.getLatest(sessionId)
        const startPosition = snapshot?.position ?? 0

        // 2. Get events after snapshot
        const events = yield* eventStore.getEventsFrom(sessionId, startPosition)

        // 3. Derive state by applying patches
        const state = deriveState(events, snapshot?.state ?? config.initialState)

        // 4. Save new snapshot if we replayed many events
        if (events.length >= config.snapshotEvery) {
          yield* snapshotStore.save({
            sessionId,
            state,
            position: startPosition + events.length,
            createdAt: new Date(),
          })
        }

        return state
      })

    // Effect.Cache for memoization
    const cache = yield* Cache.make({
      capacity: config.capacity ?? 100,
      timeToLive: Duration.infinity,
      lookup: recomputeState,
    })

    // SubscriptionRef for live sessions
    const liveRefs = new Map<string, SubscriptionRef.SubscriptionRef<S>>()

    return {
      get: (sessionId) => cache.get(sessionId),

      subscribe: (sessionId) => Effect.gen(function*() {
        const existing = liveRefs.get(sessionId)
        if (existing) return existing

        const state = yield* cache.get(sessionId)
        const ref = yield* SubscriptionRef.make(state)
        liveRefs.set(sessionId, ref)
        return ref
      }),

      invalidate: (sessionId) => cache.invalidate(sessionId),
    }
  })
```

### State Derivation Function

```typescript
// Derive state by applying patches (not scanning for last state:updated)
const deriveState = <S>(
  events: ReadonlyArray<WorkflowEvent>,
  initial: S
): S => {
  let state = initial

  for (const event of events) {
    if (event._tag === "StateIntent") {
      state = applyPatches(state, event.patches)
    } else if (event._tag === "StateCheckpoint") {
      state = event.state as S  // Checkpoint contains full state
    }
  }

  return state
}

// Optimized: start from nearest checkpoint
const deriveStateOptimized = <S>(
  events: ReadonlyArray<WorkflowEvent>,
  initial: S
): S => {
  // Find last checkpoint
  const checkpointIndex = events.findLastIndex(e => e._tag === "StateCheckpoint")

  if (checkpointIndex >= 0) {
    const checkpoint = events[checkpointIndex] as StateCheckpoint
    const remainingEvents = events.slice(checkpointIndex + 1)
    return deriveState(remainingEvents, checkpoint.state as S)
  }

  return deriveState(events, initial)
}
```

---

## How Forking Works

### Fork With Event Sourcing

```typescript
const fork = (options: ForkOptions) => Effect.gen(function*() {
  const eventStore = yield* EventStore

  // 1. Load events from parent session
  const parentEvents = yield* eventStore.getAllEvents(options.from)

  // 2. Find the fork point
  const forkIndex = findForkPoint(parentEvents, options.at)

  // 3. Derive state at fork point (THE KEY STEP)
  //    This is GUARANTEED correct because state IS events
  const stateAtFork = deriveState(
    parentEvents.slice(0, forkIndex),
    options.workflow.initialState
  )

  // 4. Create new session
  const childSessionId = generateSessionId()

  // 5. Store lineage information
  yield* eventStore.append(childSessionId, new SessionForked({
    parentSessionId: options.from,
    forkIndex,
    initialState: stateAtFork,
    timestamp: new Date(),
  }))

  // 6. Determine which phase we're in at fork point
  const phaseAtFork = getPhaseAtForkPoint(parentEvents, forkIndex)

  // 7. Continue execution with the variant workflow
  return yield* executeWorkflow(options.workflow, {
    sessionId: childSessionId,
    initialState: stateAtFork,
    resumePhase: phaseAtFork,
  })
})
```

### Why This Matters for Evals

From the eval system design:

```typescript
const resultA = await fork({
  from: baseline.sessionId,
  at: { phase: "coding", occurrence: "first" },
  workflow: opusCoderVariant,
})

const resultB = await fork({
  from: baseline.sessionId,
  at: { phase: "coding", occurrence: "first" },
  workflow: gptCoderVariant,
})
```

With event sourcing:

- Both forks load the same events from EventStore
- Both forks derive state from those events using `deriveState()`
- Both forks start with **provably identical state**
- Any difference in results is purely due to the variant (model/prompt)

This is the **isolation** needed for valid A/B comparisons. Without event sourcing, we'd be hoping the Ref and EventStore agreed at fork time.

### Fork Point Specification

From the eval design, fork points must be explicit:

```typescript
type ForkAt =
  | { phase: string; occurrence: "first" | "last" | number }
  | { eventIndex: number }
  | { where: (state: unknown) => boolean }
```

Examples:
- `{ phase: "coding", occurrence: "first" }` — First entry to "coding" phase
- `{ phase: "coding", occurrence: 2 }` — Second entry to "coding" phase
- `{ eventIndex: 47 }` — Exact event position
- `{ where: (s) => s.tasks.length > 5 }` — First point where predicate is true

---

## Consumer DX Impact

### External DX: Unchanged

The public API remains exactly the same:

```typescript
// This is unchanged
const result = await run(workflow, {
  input: "Hello",
  runtime,
  observer: {
    onTextDelta: ({ delta }) => process.stdout.write(delta),
    onStateChanged: (state) => console.log("State:", state),
  }
})

console.log(result.state)  // Final state
console.log(result.events) // All events
```

### React Hooks: Unchanged

```typescript
// This is unchanged
const { state, events, isRunning } = useWorkflow(sessionId)
```

The hook subscribes to state changes. Whether state comes from a `Ref` or is derived from events via `SubscriptionRef` — the hook doesn't know or care. It just gets notified when state changes.

### What Changes Is Internal Only

Internally, instead of:
```
Ref.update() → emit event
```

We do:
```
emit event → projection derives state → SubscriptionRef updated → subscribers notified
```

The `SubscriptionRef` notifies subscribers exactly like `Ref` would. From the consumer's perspective, nothing changes.

### Why Internal Complexity Is Acceptable

Our design goals:

1. **Best external DX** — simple, clean public API
2. **Effect-native internals** — use Effect primitives correctly
3. **Complexity hidden inside** — users don't see the event sourcing machinery

Event sourcing adds internal complexity, but:
- It uses Effect's designed-for-this primitives (PubSub, SubscriptionRef, Stream)
- It enables features users want (forking, replay, time travel)
- It's invisible to consumers

This is the right tradeoff.

---

## Options Considered

### Option A: Accept Current Model (State-First with Documentation)

**Description:** Keep existing architecture, document it clearly, wire up StateCache.

**Pros:**
- Minimal implementation effort
- Current tests continue to work

**Cons:**
- Divergence risk remains
- Forking may produce incorrect state
- Not philosophically sound

**Verdict:** Rejected. Doesn't solve the core problem.

### Option B: True Event Sourcing (Chosen)

**Description:** Events are source of truth, state is always derived.

**Pros:**
- Single source of truth (events)
- Forking is guaranteed correct
- Time travel is free
- Effect-idiomatic (SubscriptionRef, PubSub, Stream)
- Philosophically sound

**Cons:**
- Requires projection fiber
- State derivation adds indirection

**Verdict:** Accepted. Solves the problem correctly, uses Effect properly.

### Option C: Hybrid (State-First Execution + Checkpoints)

**Description:** Keep Ref-based mutation but emit StateCheckpoint events for resume.

**Pros:**
- Less change to execution path
- Checkpoints help resume performance

**Cons:**
- Still has divergence window between checkpoints
- Not philosophically pure
- Complexity of two models

**Verdict:** Rejected. Half-measure that doesn't solve the core problem.

### Option D: CQRS-Lite (Command/Query Separation)

**Description:** Separate write path (commands to Ref) from read path (queries derive from events).

**Pros:**
- Clear separation of concerns
- Write path is fast

**Cons:**
- Two different state representations
- More complexity for marginal benefit
- Doesn't solve divergence for fork

**Verdict:** Rejected. Overengineered for our needs.

### Evaluation Criteria (How We Decided)

| Criterion | Weight | Option A | Option B | Option C | Option D |
|-----------|--------|----------|----------|----------|----------|
| Philosophical purity | 30% | C | A+ | B | A- |
| Effect idiomaticity | 25% | B+ | A | A- | A |
| External DX unchanged | 25% | A | A | A | A |
| Runtime correctness | 20% | C | A | B+ | A- |
| **Weighted Total** | | 73 | **93** | 80 | 85 |

Option B wins because it's both philosophically correct AND uses Effect properly.

---

## Implementation Guide

### New Event Types

Add to `Domain/Events.ts` (per ADR-004):

```typescript
// Intent to change state (emitted by agents)
export class StateIntent extends Data.TaggedClass("StateIntent")<{
  readonly intentId: string
  readonly patches: ReadonlyArray<Patch>
  readonly inversePatches: ReadonlyArray<Patch>
  readonly timestamp: Date
}> {}

// Checkpoint with full state (for snapshot optimization)
export class StateCheckpoint extends Data.TaggedClass("StateCheckpoint")<{
  readonly state: unknown
  readonly position: number
  readonly phase: string
  readonly timestamp: Date
}> {}

// Session was forked from another
export class SessionForked extends Data.TaggedClass("SessionForked")<{
  readonly parentSessionId: string
  readonly forkIndex: number
  readonly initialState: unknown
  readonly timestamp: Date
}> {}

// Update WorkflowEvent union
export type WorkflowEvent =
  | WorkflowStarted
  | WorkflowCompleted
  | PhaseEntered
  | PhaseExited
  | AgentStarted
  | AgentCompleted
  | StateIntent      // NEW
  | StateCheckpoint  // NEW
  | SessionForked    // NEW
  | TextDelta
  | ThinkingDelta
  | ToolCalled
  | ToolResult
  | InputRequested
  | InputReceived
```

### State Projection Service

Create `Services/StateProjection.ts`:

```typescript
import { Context, Effect, Match, PubSub, Scope, Stream, SubscriptionRef } from "effect"
import { applyPatches } from "immer"
import { EventHub } from "./EventHub.js"
import type { WorkflowEvent, StateIntent, StateCheckpoint } from "../Domain/Events.js"

export class StateProjection extends Context.Tag("@open-scaffold/StateProjection")<
  StateProjection,
  {
    /** Get current derived state */
    readonly get: () => Effect.Effect<unknown>

    /** Subscribe to state changes */
    readonly subscribe: () => Effect.Effect<
      SubscriptionRef.SubscriptionRef<unknown>,
      never,
      Scope.Scope
    >
  }
>() {}

export const makeStateProjection = <S>(
  initial: S
): Effect.Effect<StateProjection, never, EventHub | Scope.Scope> =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const stateRef = yield* SubscriptionRef.make<S>(initial)
    const eventStream = yield* hub.subscribe()

    // Fork projection fiber (tied to scope)
    yield* Effect.forkScoped(
      eventStream.pipe(
        Stream.runForEach((event) =>
          Match.value(event).pipe(
            Match.tag("StateIntent", (intent: StateIntent) =>
              SubscriptionRef.update(stateRef, (current) =>
                applyPatches(current, intent.patches as any)
              )
            ),
            Match.tag("StateCheckpoint", (checkpoint: StateCheckpoint) =>
              SubscriptionRef.set(stateRef, checkpoint.state as S)
            ),
            Match.orElse(() => Effect.void)
          )
        )
      )
    )

    return StateProjection.of({
      get: () => SubscriptionRef.get(stateRef),
      subscribe: () => Effect.succeed(stateRef),
    })
  })
```

### Updated Runtime Context

Modify `Engine/runtime.ts`:

```typescript
// BEFORE: Direct Ref
interface RuntimeContext<S> {
  readonly stateRef: Ref.Ref<S>
  // ...
}

// AFTER: SubscriptionRef backed by projection
interface RuntimeContext<S> {
  readonly stateProjection: StateProjection
  readonly stateRef: SubscriptionRef.SubscriptionRef<S>  // For reading
  // ...
}
```

### Updated State Mutation

Modify agent execution to emit events instead of mutating:

```typescript
// BEFORE: Mutate then emit
const updateState = <S>(ctx: RuntimeContext<S>, updater: (draft: Draft<S>) => void) =>
  Effect.gen(function*() {
    const currentState = yield* Ref.get(ctx.stateRef)
    const [newState, patches, inversePatches] = produceWithPatches(currentState, updater)
    yield* Ref.set(ctx.stateRef, newState)  // Mutation HERE
    yield* emitEvent(ctx, "state:updated", { state: newState, patches, inversePatches })
    return newState
  })

// AFTER: Emit intent, projection handles state
const updateState = <S>(ctx: RuntimeContext<S>, updater: (draft: Draft<S>) => void) =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const currentState = yield* SubscriptionRef.get(ctx.stateRef)
    const [_, patches, inversePatches] = produceWithPatches(currentState, updater)

    // Emit intent — projection will update state
    yield* hub.publish(new StateIntent({
      intentId: crypto.randomUUID(),
      patches,
      inversePatches,
      timestamp: new Date(),
    }))

    // Return updated state (projection has already applied patches)
    return yield* SubscriptionRef.get(ctx.stateRef)
  })
```

### Updated StateCache

Modify `Services/StateCache.ts`:

```typescript
// Change computeStateAt to deriveState
export const deriveState = <S>(
  events: ReadonlyArray<WorkflowEvent>,
  initial: S
): S => {
  let state = initial

  for (const event of events) {
    Match.value(event).pipe(
      Match.tag("StateIntent", (intent) => {
        state = applyPatches(state, intent.patches as any)
      }),
      Match.tag("StateCheckpoint", (checkpoint) => {
        state = checkpoint.state as S
      }),
      Match.orElse(() => {})
    )
  }

  return state
}

// Optimized version using checkpoints
export const deriveStateOptimized = <S>(
  events: ReadonlyArray<WorkflowEvent>,
  initial: S
): S => {
  const checkpointIndex = events.findLastIndex(
    (e): e is StateCheckpoint => e._tag === "StateCheckpoint"
  )

  if (checkpointIndex >= 0) {
    const checkpoint = events[checkpointIndex]
    const remainingEvents = events.slice(checkpointIndex + 1)
    return deriveState(remainingEvents, checkpoint.state as S)
  }

  return deriveState(events, initial)
}
```

### Checkpoint Emission

Add checkpoint emission at strategic points:

```typescript
// In phase execution
const executePhase = (...) => Effect.gen(function*() {
  // ... phase logic ...

  // Emit checkpoint on phase completion
  const currentState = yield* SubscriptionRef.get(ctx.stateRef)
  yield* hub.publish(new StateCheckpoint({
    state: currentState,
    position: yield* getCurrentEventPosition(ctx),
    phase: phaseName,
    timestamp: new Date(),
  }))
})

// On pause
const pauseWorkflow = (...) => Effect.gen(function*() {
  yield* Ref.set(ctx.isPausedRef, true)

  // Emit checkpoint on pause
  const currentState = yield* SubscriptionRef.get(ctx.stateRef)
  yield* hub.publish(new StateCheckpoint({
    state: currentState,
    position: yield* getCurrentEventPosition(ctx),
    phase: yield* getCurrentPhase(ctx),
    timestamp: new Date(),
  }))
})
```

### Implementation Tasks

| Task | Priority | Complexity | Description |
|------|----------|------------|-------------|
| Add new event types | 1 | Low | StateIntent, StateCheckpoint, SessionForked |
| Create StateProjection service | 1 | Medium | Fiber that derives state from events |
| Update RuntimeContext | 1 | Medium | Use SubscriptionRef instead of Ref |
| Change agent execution | 1 | Medium | Emit StateIntent instead of Ref.update |
| Update deriveState function | 1 | Low | Apply patches instead of scanning for state:updated |
| Wire StateCache to EventHub | 2 | Medium | Subscribe to events, invalidate on StateIntent |
| Add checkpoint emission | 2 | Low | Emit on phase change, pause, every N events |
| Implement fork() | 2 | Medium | Load events, derive state, continue execution |
| Update tests | 3 | Medium | Adapt to event-first model |
| Remove old state:updated emission | 3 | Low | After all else works |

### Migration Strategy

1. **Phase 1: Add new infrastructure** (non-breaking)
   - Add new event types
   - Create StateProjection service
   - Add deriveState function

2. **Phase 2: Dual-write** (compatibility)
   - Emit both StateIntent AND state:updated
   - StateProjection handles StateIntent
   - Old code still works with state:updated

3. **Phase 3: Switch over** (breaking)
   - Change agents to use StateProjection
   - Update RuntimeContext to use SubscriptionRef
   - Tests use new model

4. **Phase 4: Cleanup** (final)
   - Remove state:updated emission
   - Remove old Ref-based code
   - Update documentation

---

## Related Files

### Files to Create

| File | Purpose |
|------|---------|
| `packages/core/src/Services/StateProjection.ts` | Fiber that derives state from events |
| `packages/core/src/Engine/fork.ts` | Fork implementation |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/Domain/Events.ts` | Add StateIntent, StateCheckpoint, SessionForked |
| `packages/core/src/Engine/runtime.ts` | Use StateProjection, emit StateIntent |
| `packages/core/src/Engine/utils.ts` | Replace computeStateAt with deriveState |
| `packages/core/src/Services/StateCache.ts` | Wire to EventHub, use deriveState |
| `packages/core/src/Services/EventHub.ts` | Ensure StateIntent/StateCheckpoint in union |

### Files to Delete

None — we're adding, not removing.

---

## References

- [ADR-001: Execution API Design](./001-execution-api.md) — Public `run()` API
- [ADR-004: Event/Observer Pattern](./004-event-observer-pattern.md) — EventHub with PubSub
- [Eval System Design](../eval-system-design.md) — Fork-based comparisons
- [Effect SubscriptionRef](https://effect.website/docs/state-management/subscriptionref/) — Reactive state
- [Effect PubSub](https://effect.website/docs/concurrency/pubsub/) — Event distribution
- [Event Sourcing (Martin Fowler)](https://martinfowler.com/eaaDev/EventSourcing.html) — Pattern overview
