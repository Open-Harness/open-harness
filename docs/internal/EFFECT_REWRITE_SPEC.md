# Open Harness Effect Rewrite Specification

> Technical architecture for rebuilding Open Harness with Effect, implementing the Mental Model v2.

---

## Why Effect?

Effect provides the primitives we need without building them ourselves:

| Need | Effect Primitive |
|------|------------------|
| Typed errors | `Effect<A, E, R>` |
| Dependency injection | `Layer`, `Context` |
| Structured concurrency | `Fiber`, `Scope` |
| Resource safety | `acquireRelease`, `Scope` |
| Streaming | `Stream` |
| Runtime validation | `Schema` |
| Interruption | Built into `Effect` |

---

## Core Types

### Signal

Signals are data with runtime validation via Schema.

```typescript
import { Schema as S } from "@effect/schema";

// Base signal schema
const SignalSchema = <T extends S.Schema.Any>(payloadSchema: T) =>
  S.Struct({
    id: S.String,
    name: S.String,
    payload: payloadSchema,
    timestamp: S.DateFromString,
  });

// Type derived from schema
type Signal<T> = S.Schema.Type<ReturnType<typeof SignalSchema<S.Schema<T>>>>;

// Define signals with schemas
const TaskCompleted = S.Struct({
  taskId: S.String,
  outcome: S.Literal("success", "failure", "partial"),
  summary: S.String,
});

type TaskCompletedSignal = Signal<typeof TaskCompleted.Type>;
```

### State

State is a `Ref` - Effect's mutable reference with transactional updates.

```typescript
import { Ref } from "effect";

// State is just a Ref
type WorkflowState<S> = Ref.Ref<S>;

// Read state
const getState = <S>(ref: WorkflowState<S>) => Ref.get(ref);

// Update state (transactional)
const updateState = <S>(ref: WorkflowState<S>, f: (s: S) => S) =>
  Ref.update(ref, f);
```

### Handler

Handlers are Effect functions: Signal + State → Effect of Signals.

```typescript
import { Effect } from "effect";

type Handler<S, T, E = never, R = never> = (
  signal: Signal<T>,
  state: WorkflowState<S>
) => Effect.Effect<Signal<unknown>[], E, R>;

// Example handler
const taskCompletedHandler: Handler<MyState, TaskCompletedPayload> = (
  signal,
  stateRef
) =>
  Effect.gen(function* () {
    // Update state
    yield* Ref.update(stateRef, (s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === signal.payload.taskId
          ? { ...t, status: signal.payload.outcome }
          : t
      ),
    }));

    // Get updated state to decide next signals
    const state = yield* Ref.get(stateRef);

    // Return next signals
    if (state.tasks.every((t) => t.status === "success")) {
      return [{ name: "workflow:complete", payload: {} }];
    }
    return [{ name: "task:next", payload: {} }];
  });
```

### Agent

Agents are Effect services that call LLMs.

```typescript
import { Context, Effect, Layer } from "effect";

// Agent service interface
interface AgentService {
  readonly run: (
    prompt: string,
    signal: Signal<unknown>
  ) => Effect.Effect<Signal<unknown>[], AgentError>;
}

const AgentService = Context.GenericTag<AgentService>("AgentService");

// Agent definition (config, not runtime)
interface AgentDef<S> {
  name: string;
  activatesOn: string[];
  prompt: (state: S, signal: Signal<unknown>) => string;
  emits: string[];
}

// Agent implementation uses a Harness
const makeAgentService = (harness: HarnessService): AgentService => ({
  run: (prompt, signal) =>
    Effect.gen(function* () {
      const response = yield* harness.complete(prompt);
      // Parse response into signals
      return parseAgentResponse(response, signal);
    }),
});
```

### Harness

The LLM adapter as an Effect service.

```typescript
// Harness error type
class HarnessError extends Data.TaggedError("HarnessError")<{
  message: string;
  cause?: unknown;
}> {}

// Harness service interface
interface HarnessService {
  readonly complete: (
    prompt: string
  ) => Effect.Effect<string, HarnessError>;

  readonly stream: (
    prompt: string
  ) => Stream.Stream<string, HarnessError>;
}

const HarnessService = Context.GenericTag<HarnessService>("HarnessService");

// Claude implementation
const ClaudeHarnessLive = Layer.succeed(HarnessService, {
  complete: (prompt) =>
    Effect.tryPromise({
      try: () => claudeClient.messages.create({ ... }),
      catch: (e) => new HarnessError({ message: "Claude API failed", cause: e }),
    }),

  stream: (prompt) =>
    Stream.async((emit) => {
      // Streaming implementation
    }),
});
```

### Adapter

Adapters are Stream operators that observe signals.

```typescript
import { Stream } from "effect";

type Renderer<T> = (signal: Signal<T>) => string | null;
type RendererMap = Record<string, Renderer<unknown>>;

interface AdapterService {
  readonly process: (signal: Signal<unknown>) => Effect.Effect<void>;
}

const AdapterService = Context.GenericTag<AdapterService>("AdapterService");

// Terminal adapter implementation
const makeTerminalAdapter = (renderers: RendererMap): AdapterService => ({
  process: (signal) =>
    Effect.sync(() => {
      const renderer = renderers[signal.name];
      if (renderer) {
        const output = renderer(signal);
        if (output) console.log(output);
      }
    }),
});

const TerminalAdapterLive = (renderers: RendererMap) =>
  Layer.succeed(AdapterService, makeTerminalAdapter(renderers));
```

---

## The Runtime Loop

The workflow runtime as a Stream processor.

```typescript
import { Stream, Effect, Ref, Queue } from "effect";

interface WorkflowRuntime<S> {
  readonly state: Ref.Ref<S>;
  readonly signals: Queue.Queue<Signal<unknown>>;
  readonly run: Effect.Effect<S, WorkflowError, HarnessService | AdapterService>;
}

const createRuntime = <S>(config: WorkflowConfig<S>): Effect.Effect<WorkflowRuntime<S>> =>
  Effect.gen(function* () {
    // Initialize state
    const state = yield* Ref.make(config.initialState);

    // Signal queue for async signal emission
    const signals = yield* Queue.unbounded<Signal<unknown>>();

    // Emit initial signal
    yield* Queue.offer(signals, { name: "workflow:start", payload: {} });

    const run = Effect.gen(function* () {
      const adapter = yield* AdapterService;
      const harness = yield* HarnessService;

      // Process signals until done
      while (true) {
        const signal = yield* Queue.take(signals);

        // Render to adapters (parallel, fire-and-forget)
        yield* Effect.fork(adapter.process(signal));

        // Find handler for this signal
        const handler = config.handlers[signal.name];
        if (handler) {
          const newSignals = yield* handler(signal, state);
          yield* Queue.offerAll(signals, newSignals);
        }

        // Check agents
        for (const agent of Object.values(config.agents)) {
          if (agent.activatesOn.includes(signal.name)) {
            const currentState = yield* Ref.get(state);
            const prompt = agent.prompt(currentState, signal);
            const agentSignals = yield* makeAgentService(harness).run(prompt, signal);
            yield* Queue.offerAll(signals, agentSignals);
          }
        }

        // Check termination
        const currentState = yield* Ref.get(state);
        if (config.until(currentState)) {
          return currentState;
        }

        // Check if queue is empty (deadlock prevention)
        const isEmpty = yield* Queue.isEmpty(signals);
        if (isEmpty) {
          return currentState;
        }
      }
    });

    return { state, signals, run };
  });
```

---

## Recording & Replay

Recording and replay as Stream middleware.

```typescript
// Recording store interface
interface RecordingStore {
  readonly save: (id: string, signals: Signal<unknown>[]) => Effect.Effect<void>;
  readonly load: (id: string) => Effect.Effect<Signal<unknown>[]>;
}

const RecordingStore = Context.GenericTag<RecordingStore>("RecordingStore");

// Record mode: tap the signal stream
const withRecording = <S>(
  runtime: WorkflowRuntime<S>,
  recordingId: string
): Effect.Effect<S, WorkflowError, RecordingStore | HarnessService | AdapterService> =>
  Effect.gen(function* () {
    const store = yield* RecordingStore;
    const recorded: Signal<unknown>[] = [];

    // Wrap signal processing to record
    const originalRun = runtime.run;
    // ... intercept and record signals

    const result = yield* originalRun;
    yield* store.save(recordingId, recorded);
    return result;
  });

// Replay mode: feed signals from recording, skip harness
const replay = <S>(
  config: WorkflowConfig<S>,
  recordingId: string
): Effect.Effect<S, WorkflowError, RecordingStore | AdapterService> =>
  Effect.gen(function* () {
    const store = yield* RecordingStore;
    const signals = yield* store.load(recordingId);

    // Create runtime with mock harness that returns recorded responses
    const mockHarness = makeMockHarness(signals);

    // Run with recorded signals
    // ...
  });
```

---

## Error Handling

Typed errors throughout the system.

```typescript
import { Data } from "effect";

// Error hierarchy
class WorkflowError extends Data.TaggedError("WorkflowError")<{
  message: string;
  cause?: unknown;
}> {}

class HandlerError extends Data.TaggedError("HandlerError")<{
  signal: string;
  message: string;
  cause?: unknown;
}> {}

class AgentError extends Data.TaggedError("AgentError")<{
  agent: string;
  message: string;
  cause?: unknown;
}> {}

class HarnessError extends Data.TaggedError("HarnessError")<{
  message: string;
  cause?: unknown;
}> {}

// Union type for workflow errors
type AllErrors = WorkflowError | HandlerError | AgentError | HarnessError;

// Handlers can declare their error types
type Handler<S, T, E = never> = (
  signal: Signal<T>,
  state: WorkflowState<S>
) => Effect.Effect<Signal<unknown>[], E>;
```

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Config    │  │  Renderers  │  │      Recording ID       │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
│         ▼                ▼                      ▼                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    WorkflowRuntime                          ││
│  │                                                             ││
│  │  Requires: HarnessService, AdapterService, RecordingStore   ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                │                      │                │
│         ▼                ▼                      ▼                │
│  ┌───────────┐    ┌───────────┐    ┌─────────────────────────┐  │
│  │  Claude   │    │ Terminal  │    │    SQLite Store         │  │
│  │  Harness  │    │  Adapter  │    │    (or Memory)          │  │
│  └───────────┘    └───────────┘    └─────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Layer composition:

```typescript
// Compose the full application
const AppLive = Layer.mergeAll(
  ClaudeHarnessLive,
  TerminalAdapterLive(myRenderers),
  SqliteRecordingStoreLive("./recordings.db")
);

// Run the workflow
const program = Effect.gen(function* () {
  const runtime = yield* createRuntime(myConfig);
  return yield* runtime.run;
});

Effect.runPromise(program.pipe(Effect.provide(AppLive)));
```

---

## Package Structure

```
packages/
├── core/                    # Effect-based primitives
│   ├── signal.ts           # Signal type + Schema
│   ├── handler.ts          # Handler type
│   ├── agent.ts            # Agent service
│   ├── adapter.ts          # Adapter service
│   ├── runtime.ts          # Workflow runtime
│   └── errors.ts           # Error types
│
├── harnesses/
│   ├── claude/             # Claude harness Layer
│   └── openai/             # OpenAI harness Layer
│
├── adapters/
│   ├── terminal/           # Terminal adapter Layer
│   └── pino/               # Pino logging adapter Layer
│
├── stores/
│   ├── memory/             # In-memory recording store
│   └── sqlite/             # SQLite recording store
│
└── testing/
    └── replay/             # Replay utilities for tests
```

---

## API Surface

### Creating a Workflow

```typescript
import { createWorkflow, defineSignal, defineHandler } from "@open-harness/core";
import { ClaudeHarness } from "@open-harness/harness-claude";
import { terminalAdapter } from "@open-harness/adapter-terminal";

// Define signals
const TaskCompleted = defineSignal("task:completed", {
  taskId: S.String,
  outcome: S.Literal("success", "failure"),
});

// Define handlers
const handlers = {
  [TaskCompleted.name]: defineHandler(TaskCompleted, (signal, state) =>
    Effect.gen(function* () {
      yield* Ref.update(state, (s) => ({ ...s, done: true }));
      return [];
    })
  ),
};

// Define workflow
const workflow = createWorkflow({
  initialState: { tasks: [], done: false },
  handlers,
  agents: { /* ... */ },
  until: (s) => s.done,
});

// Run it
const result = await workflow.run({
  harness: ClaudeHarness({ model: "sonnet" }),
  adapters: [terminalAdapter({ renderers: myRenderers })],
});
```

### Testing with Replay

```typescript
import { replay } from "@open-harness/testing";

test("workflow completes successfully", async () => {
  const result = await replay("recordings/happy-path.json", {
    adapters: [], // No output needed in tests
  });

  expect(result.state.done).toBe(true);
  expect(result.state.tasks).toHaveLength(3);
});
```

---

## Migration Path

### Phase 1: Core Types
- Define Signal, Handler, Agent, Adapter as Effect types
- No runtime yet, just types and schemas

### Phase 2: Runtime
- Build the signal queue loop
- Implement handler dispatch
- Add agent activation

### Phase 3: Harnesses
- Port Claude harness to Effect
- Add streaming support via Stream

### Phase 4: Adapters
- Port terminal adapter
- Port logs adapter

### Phase 5: Recording
- Implement signal capture
- Implement replay mode

### Phase 6: Migration
- Adapter layer for old API
- Gradual migration of existing workflows

---

## Open Questions

1. **Schema library**: `@effect/schema` or `zod` with Effect wrapper?
2. **Streaming signals**: Should agents emit Stream<Signal> for streaming LLM responses?
3. **Parallel handlers**: Should multiple handlers for same signal run in parallel?
4. **Signal ordering**: Strict FIFO or allow priority signals?
5. **Backpressure**: What happens when signals emit faster than handlers process?

---

*Version: 1.0*
*Status: Draft specification for Effect rewrite*
