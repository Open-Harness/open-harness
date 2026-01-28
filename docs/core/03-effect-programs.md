# Effect Programs

**Date**: 2026-01-26
**Status**: Implementation Complete
**Package**: `@open-scaffold/core`

This document describes the Effect program compositions that implement workflow execution.

---

## Program Organization

Programs are organized by concern:

```
Programs/
+-- Execution/           # Core workflow execution and processing
|   +-- executeWorkflow.ts
|   +-- runPhase.ts
|   +-- runAgent.ts
|   +-- mapStreamEvent.ts
+-- Recording/           # Event persistence and broadcast
|   +-- createSession.ts
|   +-- recordEvent.ts
|   +-- observeEvents.ts
+-- Session/             # Session lifecycle
|   +-- loadSession.ts
|   +-- forkSession.ts
|   +-- resumeSession.ts
+-- State/               # State computation
|   +-- computeStateAt.ts
|   +-- getCurrentState.ts
+-- workflow.ts          # Top-level entry points
```

---

## Core Execution Programs

### executeWorkflow

The main workflow execution loop that runs phases until termination.

```typescript
const executeWorkflow = <S>(
  workflowDef: WorkflowDef<S>,
  queue: Queue.Queue<AnyEvent>,
  options: ExecutionOptions
): Effect.Effect<ExecutionResult, WorkflowError, Services> =>
  Effect.gen(function* () {
    const stateCache = yield* StateCache

    while (true) {
      // 1. Check if workflow reached terminal phase
      const state = yield* stateCache.get(sessionId)
      const currentPhase = workflowDef.phases[state.currentPhase]
      if (currentPhase.terminal) {
        return { terminated: true, reason: "terminal_phase" }
      }

      // 2. Run the current phase's agent
      const agent = currentPhase.run
      const newEvents = yield* runPhase(workflowDef, agent, state, sessionId)

      // 3. Advance to next phase
      yield* stateCache.set(sessionId, { ...state, currentPhase: currentPhase.next })

      // 4. Enqueue follow-up events
      yield* Queue.offerAll(queue, newEvents)
    }
  })
```

**Why bounded queue?** Backpressure. Default size 1000 prevents runaway event generation.

**Why phase-based loop?** Each iteration runs one phase's agent, updates state, and advances to the next phase.

---

### runPhase

Runs a single phase by executing its agent.

```typescript
const runPhase = <S>(
  workflowDef: WorkflowDef<S>,
  agent: AgentDef<S, unknown>,
  state: S,
  sessionId: SessionId
): Effect.Effect<ReadonlyArray<AnyEvent>, PhaseError, Services> =>
  Effect.gen(function* () {
    const stateCache = yield* StateCache
    const eventStore = yield* EventStore
    const eventBus = yield* EventBus

    // 1. Run the agent
    const agentEvents = yield* runAgent(agent, state, sessionId)

    // 2. Record all generated events
    for (const event of agentEvents) {
      yield* eventStore.append(sessionId, event)
      yield* eventBus.publish(sessionId, event)
    }

    // 3. Apply state update from agent output
    const newState = applyAgentUpdate(agent, state)
    yield* stateCache.set(sessionId, newState)

    return agentEvents
  })
```

**Why agent before state update?** Agent runs with current state, then state is updated with the agent's structured output.

---

### runAgent

Executes an agent with streaming and recording support.

```typescript
const runAgent = <S, O>(
  agent: AgentDef<S, O>,
  state: S,
  sessionId: SessionId
): Effect.Effect<ReadonlyArray<AnyEvent>, AgentError, Services> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    const eventBus = yield* EventBus
    const providerRecorder = yield* ProviderRecorder
    const modeContext = yield* ProviderModeContext

    const prompt = agent.prompt(state)
    const hash = computeHash(prompt, agent.output)

    // Emit agent:started
    yield* recordEvent(sessionId, AgentStarted.create({
      agentName: agent.name,
    }))

    let result: O
    const events: AnyEvent[] = []

    if (modeContext.mode === "playback") {
      // Replay from recording
      const recording = yield* providerRecorder.load(hash)
      if (!recording) {
        return yield* Effect.fail(new RecordingNotFound({ hash }))
      }

      // Emit recorded stream events
      for (const streamEvent of recording.streamEvents) {
        const domainEvent = mapStreamEvent(streamEvent, agent.name)
        if (domainEvent) {
          yield* recordEvent(sessionId, domainEvent)
          events.push(domainEvent)
        }
      }

      result = recording.result as O
    } else {
      // Live mode: call provider and record
      const streamEvents: AgentStreamEvent[] = []

      yield* agent.provider.stream({
        prompt,
        outputSchema: agent.output,
      }).pipe(
        Stream.tap((streamEvent) => {
          streamEvents.push(streamEvent)
          const domainEvent = mapStreamEvent(streamEvent, agent.name)
          if (domainEvent) {
            events.push(domainEvent)
            return recordEvent(sessionId, domainEvent)
          }
          return Effect.void
        }),
        Stream.runDrain
      )

      // Extract result from last event
      const resultEvent = streamEvents.find(e => e.type === "result")
      result = resultEvent?.value as O

      // Save recording
      yield* providerRecorder.save(hash, {
        hash,
        streamEvents,
        result,
        metadata: { recordedAt: new Date(), prompt, model: agent.model }
      })
    }

    // Validate output against schema
    const parsed = agent.output.safeParse(result)
    if (!parsed.success) {
      return yield* Effect.fail(new AgentError({
        agentName: agent.name,
        phase: "output",
        cause: parsed.error
      }))
    }

    // Apply state update via immer-style draft
    // (handled by caller in runPhase)

    // Emit agent:completed
    yield* recordEvent(sessionId, AgentCompleted.create({
      agentName: agent.name,
      outcome: "success"
    }))

    return events
  })
```

**Why buffer then save?** Stream must complete before we know the full response. Buffer in memory, save atomically.

**Why hash-based lookup?** Same prompt + schema = same recording. Deterministic test replay.

---

### mapStreamEvent

Converts provider stream events to domain events.

```typescript
const mapStreamEvent = (
  streamEvent: AgentStreamEvent,
  agentName: string,
  causedBy?: EventId
): AnyEvent | null => {
  switch (streamEvent.type) {
    case "text_delta":
      return TextDelta.create({ delta: streamEvent.delta, agentName }, causedBy)

    case "text_complete":
      return TextComplete.create({ text: streamEvent.text, agentName }, causedBy)

    case "thinking_delta":
      return ThinkingDelta.create({ delta: streamEvent.delta, agentName }, causedBy)

    case "thinking_complete":
      return ThinkingComplete.create({ thinking: streamEvent.thinking, agentName }, causedBy)

    case "tool_call":
      return ToolCalled.create({
        toolId: streamEvent.id,
        toolName: streamEvent.name,
        input: streamEvent.input,
        agentName
      }, causedBy)

    case "tool_result":
      return ToolResult.create({
        toolId: streamEvent.id,
        output: streamEvent.output,
        isError: streamEvent.isError,
        agentName
      }, causedBy)

    case "usage":
      return UsageReported.create({
        inputTokens: streamEvent.inputTokens,
        outputTokens: streamEvent.outputTokens,
        agentName
      }, causedBy)

    case "session_init":
      return AgentSession.create({
        providerSessionId: streamEvent.sessionId,
        agentName
      }, causedBy)

    default:
      return null  // stop, result handled separately
  }
}
```

---

## Recording Programs

### createSession

Initializes a new workflow session.

```typescript
const createSession = <S>(
  workflowDef: WorkflowDef<S>,
  input: unknown
): Effect.Effect<SessionId, StoreError, Services> =>
  Effect.gen(function* () {
    const sessionId = SessionId.make(crypto.randomUUID())
    const stateCache = yield* StateCache

    // Initialize state via start function
    const initialState = structuredClone(workflowDef.initialState)
    workflowDef.start(input, initialState)
    yield* stateCache.set(sessionId, initialState)

    // Record workflow:start event
    yield* recordEvent(sessionId, WorkflowStart.create({
      workflowName: workflowDef.name,
      input
    }))

    return sessionId
  })
```

---

### recordEvent

Persists event to store and broadcasts to subscribers.

```typescript
const recordEvent = (
  sessionId: SessionId,
  event: AnyEvent
): Effect.Effect<void, StoreError, EventStore | EventBus> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    const eventBus = yield* EventBus

    yield* eventStore.append(sessionId, event)
    yield* eventBus.publish(sessionId, event)
  })
```

**Why both store and bus?** Store = durable (replay). Bus = live (SSE). Both happen for every event.

---

### observeEvents

Creates a stream of events for SSE.

```typescript
const observeEvents = (
  sessionId: SessionId,
  fromPosition: number = 0
): Stream.Stream<AnyEvent, SessionNotFound | StoreError, Services> =>
  Stream.unwrap(Effect.gen(function* () {
    const eventStore = yield* EventStore
    const eventBus = yield* EventBus

    // Get historical events
    const historical = yield* eventStore.getEventsFrom(sessionId, fromPosition)

    // Subscribe to live events
    const live = eventBus.subscribe(sessionId)

    // Concatenate: historical first, then live
    return Stream.concat(
      Stream.fromIterable(historical),
      live
    )
  }))
```

**Why fromPosition?** SSE reconnection. Client resumes from last received event.

**Why Stream.unwrap?** The setup is effectful (reading history). Unwrap converts Effect<Stream> to Stream.

---

## Session Programs

### loadSession

Loads events for an existing session.

```typescript
const loadSession = (
  sessionId: SessionId
): Effect.Effect<ReadonlyArray<AnyEvent>, SessionNotFound | StoreError, EventStore> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    const events = yield* eventStore.getEvents(sessionId)

    if (events.length === 0) {
      return yield* Effect.fail(new SessionNotFound({ sessionId }))
    }

    return events
  })
```

---

### forkSession

Copies events from one session to a new session.

```typescript
const forkSession = (
  sourceSessionId: SessionId
): Effect.Effect<SessionId, SessionNotFound | StoreError, Services> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore

    // Load source events
    const events = yield* loadSession(sourceSessionId)

    // Create new session ID
    const newSessionId = SessionId.make(crypto.randomUUID())

    // Copy events to new session
    for (const event of events) {
      yield* eventStore.append(newSessionId, event)
    }

    // Record fork event
    yield* recordEvent(newSessionId, SessionForked.create({
      sourceSessionId,
      position: events.length
    }))

    return newSessionId
  })
```

**Why copy events?** Forked session is independent. Changes to fork don't affect source.

**Why current position only?** Forking from past would require re-running agents (non-deterministic).

---

### resumeSession

Resumes a paused session.

```typescript
const resumeSession = <S>(
  workflowDef: WorkflowDef<S>,
  sessionId: SessionId
): Effect.Effect<WorkflowResult<S>, WorkflowError, Services> =>
  Effect.gen(function* () {
    const stateCache = yield* StateCache

    // Load events and compute current state
    const events = yield* loadSession(sessionId)
    const state = yield* computeStateFromEvents(workflowDef, events)

    // Update cache
    yield* stateCache.set(sessionId, state)

    // Record resume event
    yield* recordEvent(sessionId, SessionResumed.create({
      position: events.length
    }))

    // Continue workflow execution (queue any pending events)
    const queue = yield* Queue.bounded<AnyEvent>(1000)

    return yield* executeWorkflow(workflowDef, queue, { sessionId })
  })
```

---

## State Programs

### computeStateAt

Computes state at an arbitrary position (time-travel). This is a pure function that replays events up to the given position.

```typescript
const computeStateAt = <S>(
  events: ReadonlyArray<AnyEvent>,
  position: number,
  workflowDef?: WorkflowDef<S>
): S => {
  // Pure function: replays events to derive state at position
  let state = workflowDef?.initialState ?? {} as S
  const targetEvents = events.slice(0, position)

  for (const event of targetEvents) {
    state = applyEvent(state, event)
  }

  return state
}
```

**With snapshots (Effect version):**

```typescript
const computeStateAtWithSnapshots = <S>(
  workflowDef: WorkflowDef<S>,
  sessionId: SessionId,
  position: number
): Effect.Effect<S, SessionNotFound | StoreError, Services> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    const snapshotStore = yield* StateSnapshotStore

    // Check for snapshot before position
    const snapshot = yield* snapshotStore.getLatest(sessionId)

    let state: S
    let startPosition: number

    if (snapshot && snapshot.position <= position) {
      state = snapshot.state as S
      startPosition = snapshot.position
    } else {
      state = workflowDef.initialState
      startPosition = 0
    }

    // Get events from start to target position
    const events = yield* eventStore.getEventsFrom(sessionId, startPosition)
    const targetEvents = events.slice(0, position - startPosition)

    // Replay events to compute state
    for (const event of targetEvents) {
      state = applyEvent(state, event)
    }

    return state
  })
```

**Why snapshots?** For position 10000, replaying 10000 events is slow. Snapshot at 9000 + 1000 events is fast.

---

### getCurrentState

Shorthand for state at end of tape.

```typescript
const getCurrentState = <S>(
  workflowDef: WorkflowDef<S>,
  sessionId: SessionId
): Effect.Effect<S, SessionNotFound | StoreError, Services> =>
  Effect.gen(function* () {
    const events = yield* loadSession(sessionId)
    return computeStateAt(events, events.length, workflowDef)
  })
```

---

## Top-Level Programs

### runWorkflow

Main entry point for workflow execution.

```typescript
const runWorkflow = <S>(
  workflowDef: WorkflowDef<S>,
  options: RunOptions
): Effect.Effect<WorkflowResult<S>, WorkflowError, Services> =>
  Effect.gen(function* () {
    // Create or load session
    const sessionId = options.sessionId ?? (yield* createSession(workflowDef, options.input))

    // Set session context for logging
    return yield* Effect.locally(SessionContext, sessionId)(
      Effect.gen(function* () {
        // Create event queue
        const queue = yield* Queue.bounded<AnyEvent>(1000)

        // Seed with initial event
        if (!options.sessionId) {
          yield* Queue.offer(queue, UserInput.create({ input: options.input }))
        }

        // Run workflow execution
        const result = yield* executeWorkflow(workflowDef, queue, { sessionId })

        // Get final state
        const stateCache = yield* StateCache
        const finalState = yield* stateCache.get(sessionId)

        // Load all events for tape
        const events = yield* loadSession(sessionId)

        return {
          sessionId,
          state: finalState,
          events,
          tape: { sessionId, events, finalState },
          terminated: result.terminated
        }
      })
    )
  })
```

**Why Effect.locally?** Sets SessionContext FiberRef for the scope. All nested logging includes sessionId.

---

## Program Patterns

### Effect.gen

Readable async/concurrent code:

```typescript
Effect.gen(function* () {
  const a = yield* getA()
  const b = yield* getB()
  return a + b
})
```

### Effect.withSpan

OpenTelemetry tracing:

```typescript
const myProgram = Effect.gen(function* () {
  // ...
}).pipe(Effect.withSpan("myProgram", { attributes: { sessionId } }))
```

### Stream.tap

Side effects without changing the stream:

```typescript
stream.pipe(
  Stream.tap((event) => recordEvent(sessionId, event)),
  Stream.runDrain
)
```

### Stream.mapEffect

Effectful transformation per element:

```typescript
stream.pipe(
  Stream.mapEffect((event) => runPhase(event)),
  Stream.runCollect
)
```

---

## Next

See [04-stub-layers.md](./04-stub-layers.md) for stub implementations.
