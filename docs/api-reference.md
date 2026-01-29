# API Reference

**Complete type signatures and function reference.**

---

## Core Primitives

### `agent<S, O, Ctx>(config)`

Create an agent definition.

```typescript
import { agent } from "@open-scaffold/core"

const myAgent = agent({
  name: "my-agent",
  model: "claude-sonnet-4-20250514",
  output: z.object({ result: z.string() }),
  prompt: (state) => `Process: ${state.input}`,
  update: (output, draft) => { draft.result = output.result }
})
```

**Type Signature:**

```typescript
function agent<S, O, Ctx = void>(def: AgentDef<S, O, Ctx>): AgentDef<S, O, Ctx>

interface AgentDef<S = unknown, O = unknown, Ctx = void> {
  /** Unique name for this agent */
  readonly name: string

  /** Model identifier (e.g., "claude-sonnet-4-20250514") */
  readonly model: string

  /** Zod schema for structured output */
  readonly output: z.ZodType<O>

  /** Generate prompt from state (and optional context) */
  readonly prompt: Ctx extends void
    ? (state: S) => string
    : (state: S, ctx: Ctx) => string

  /** Update state with agent output (Immer draft) */
  readonly update: Ctx extends void
    ? (output: O, draft: Draft<S>) => void
    : (output: O, draft: Draft<S>, ctx: Ctx) => void

  /** Provider-specific options (tools, temperature, etc.) */
  readonly options?: Record<string, unknown>
}
```

---

### `phase<S, Phases, Ctx>(config)`

Create a phase definition for workflow state machines.

```typescript
import { phase } from "@open-scaffold/core"

const working = phase<State, "planning" | "working" | "done">({
  run: worker,
  until: (state) => state.tasks.every(t => t.done),
  next: "done"
})
```

**Type Signature:**

```typescript
function phase<S, Phases extends string, Ctx = void>(
  def: PhaseDef<S, Phases, Ctx>
): PhaseDef<S, Phases, Ctx>

interface PhaseDef<S = unknown, Phases extends string = string, Ctx = void> {
  /** Agent to run in this phase */
  readonly run?: Ctx extends void
    ? AgentDef<S, any, void>
    : AgentDef<S, any, Ctx>

  /** Human-in-the-loop configuration */
  readonly human?: HumanConfig<S>

  /** Process human response and update state */
  readonly onResponse?: (response: string, draft: Draft<S>) => void

  /** Maximum concurrent agent executions (requires forEach) */
  readonly parallel?: number

  /** Generate context items for parallel execution */
  readonly forEach?: (state: S) => ReadonlyArray<Ctx>

  /** Exit condition (return true to exit phase) */
  readonly until?: (state: S, output?: unknown) => boolean

  /** Next phase (static string or dynamic function) */
  readonly next?: Phases | ((state: S) => Phases)

  /** Mark as terminal phase (workflow ends here) */
  readonly terminal?: boolean
}

interface HumanConfig<S> {
  readonly prompt: (state: S) => string
  readonly type: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
}
```

### `phase.terminal()`

Create a terminal phase (workflow ends here).

```typescript
import { phase } from "@open-scaffold/core"

const done = phase.terminal()
```

---

### `workflow<S, Input, Phases>(config)`

Create a workflow definition. Two forms: simple (single agent) or phased (state machine).

**Simple Workflow:**

```typescript
import { workflow } from "@open-scaffold/core"

const chatWorkflow = workflow({
  name: "chat",
  initialState: { messages: [], done: false },
  start: (input, draft) => {
    draft.messages.push({ role: "user", content: input })
  },
  agent: chatAgent,
  until: (state) => state.done
})
```

**Phase Workflow:**

```typescript
const scaffoldWorkflow = workflow({
  name: "planner-worker-judge",
  initialState: { goal: "", tasks: [], verdict: null },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: planner, next: "working" },
    working: { run: worker, parallel: 5, forEach: (s) => s.tasks, next: "judging" },
    judging: { run: judge, next: (s) => s.verdict === "continue" ? "planning" : "done" },
    done: phase.terminal()
  }
})
```

**Type Signatures:**

```typescript
// Simple workflow (single agent)
interface SimpleWorkflowDef<S, Input = string> {
  readonly name: string
  readonly initialState: S
  readonly start: (input: Input, draft: Draft<S>) => void
  readonly agent: AgentDef<S, any, void>
  readonly until?: (state: S) => boolean
}

// Phase workflow (state machine)
interface PhaseWorkflowDef<S, Input = string, Phases extends string = string> {
  readonly name: string
  readonly initialState: S
  readonly start: (input: Input, draft: Draft<S>) => void
  readonly phases: { readonly [P in Phases]: PhaseDef<S, Phases, any> }
  readonly startPhase?: Phases
}

// Discriminated union
type WorkflowDef<S, Input = string, Phases extends string = string> =
  | SimpleWorkflowDef<S, Input>
  | PhaseWorkflowDef<S, Input, Phases>

// Type guards
function isSimpleWorkflow<S, Input>(def: WorkflowDef<S, Input, string>): def is SimpleWorkflowDef<S, Input>
function isPhaseWorkflow<S, Input, Phases extends string>(def: WorkflowDef<S, Input, Phases>): def is PhaseWorkflowDef<S, Input, Phases>
```

---

## Execution

### `run(workflow, options)`

Run a workflow with observer callbacks. Returns final result as a Promise.

```typescript
import { run } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Hello",
  runtime: {
    providers: { "claude-sonnet-4-20250514": provider },
    mode: "live"
  },
  observer: {
    onStateChanged: (state) => console.log(state),
    onTextDelta: ({ delta }) => process.stdout.write(delta)
  }
})
```

**Type Signature:**

```typescript
function run<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: RunOptions<S, Input>
): Promise<RunResult<S>>

interface RunOptions<S, Input> {
  /** Input to the workflow's start() function */
  readonly input: Input

  /** Runtime configuration */
  readonly runtime: RuntimeConfig

  /** Optional session ID (generates UUID if not provided) */
  readonly sessionId?: string

  /** Abort signal for cancellation */
  readonly signal?: AbortSignal

  /** Observer for lifecycle callbacks */
  readonly observer?: WorkflowObserver<S>
}

interface RunResult<S> {
  /** Final state after completion */
  readonly state: S

  /** Session ID */
  readonly sessionId: string

  /** All events generated */
  readonly events: ReadonlyArray<AnyEvent>

  /** Whether completed normally */
  readonly completed: boolean

  /** Final phase (for phased workflows) */
  readonly exitPhase?: string

  /** Total execution duration */
  readonly durationMs: number
}
```

---

### `execute(workflow, options)`

Run a workflow with an async iterator interface. For advanced use cases requiring HITL, pause/resume.

```typescript
import { execute } from "@open-scaffold/core"

const execution = execute(myWorkflow, {
  input: "Hello",
  runtime: { providers, mode: "live" }
})

// Iterate over events
for await (const event of execution) {
  if (event.name === "input:requested") {
    execution.respond("approved")
  }
}

// Get final result
const result = await execution.result
```

**Type Signature:**

```typescript
function execute<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: ExecuteWithRuntimeOptions<Input>
): WorkflowExecution<S>

interface ExecuteWithRuntimeOptions<Input> {
  readonly input: Input
  readonly runtime: RuntimeConfig
  readonly sessionId?: string
}

interface WorkflowExecution<S> {
  /** Async iterator for events */
  [Symbol.asyncIterator](): AsyncIterator<AnyEvent, undefined>

  /** Promise resolving to final result */
  readonly result: Promise<WorkflowResult<S>>

  /** Session ID */
  readonly sessionId: string

  /** Provide HITL response */
  respond(value: string): void

  /** Pause execution */
  pause(): Promise<void>

  /** Resume paused execution */
  resume(): Promise<void>

  /** Check if paused */
  readonly isPaused: boolean

  /** Abort execution */
  abort(): void
}
```

---

### `RuntimeConfig`

Configuration for workflow execution runtime.

```typescript
interface RuntimeConfig {
  /** Provider instances keyed by model name */
  readonly providers: Record<string, AgentProvider>

  /** "live" for API calls, "playback" for recordings */
  readonly mode?: ProviderMode  // default: "live"

  /** Database URL for persistence */
  readonly database?: string    // default: ~/.openscaffold/scaffold.db

  /** Custom ProviderRecorder service */
  readonly recorder?: ProviderRecorderService

  /** Custom EventStore service */
  readonly eventStore?: EventStoreService

  /** Custom EventBus service */
  readonly eventBus?: EventBusService
}

type ProviderMode = "live" | "playback"
```

---

## Observer Protocol

### `WorkflowObserver<S>`

All methods are optional. Implement only callbacks you need.

```typescript
interface WorkflowObserver<S> {
  // ─── Lifecycle ───
  onStarted?(sessionId: string): void
  onCompleted?(result: { state: S; events: ReadonlyArray<AnyEvent> }): void
  onErrored?(error: unknown): void

  // ─── State ───
  onStateChanged?(state: S, patches?: ReadonlyArray<unknown>): void
  onPhaseChanged?(phase: string, from?: string): void

  // ─── Agent Lifecycle ───
  onAgentStarted?(info: { agent: string; phase?: string }): void
  onAgentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void

  // ─── Streaming ───
  onTextDelta?(info: { agent: string; delta: string }): void
  onThinkingDelta?(info: { agent: string; delta: string }): void

  // ─── Tools ───
  onToolCall?(info: { agent: string; toolId: string; toolName: string; input: unknown }): void
  onToolResult?(info: { agent: string; toolId: string; output: unknown; isError: boolean }): void

  // ─── HITL (async - return the response) ───
  onInputRequested?(request: InputRequest): Promise<string>

  // ─── Raw Catch-all ───
  onEvent?(event: AnyEvent): void
}

interface InputRequest {
  readonly prompt: string
  readonly type: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
}
```

---

## Events

### Event Names

| Constant | Value | Description |
|----------|-------|-------------|
| `EVENTS.WORKFLOW_STARTED` | `"workflow:started"` | Workflow execution started |
| `EVENTS.WORKFLOW_COMPLETED` | `"workflow:completed"` | Workflow execution completed |
| `EVENTS.PHASE_ENTERED` | `"phase:entered"` | Entered a new phase |
| `EVENTS.PHASE_EXITED` | `"phase:exited"` | Exited a phase |
| `EVENTS.AGENT_STARTED` | `"agent:started"` | Agent execution started |
| `EVENTS.AGENT_COMPLETED` | `"agent:completed"` | Agent execution completed |
| `EVENTS.STATE_UPDATED` | `"state:updated"` | State was updated |
| `EVENTS.TEXT_DELTA` | `"text:delta"` | Streaming text chunk |
| `EVENTS.THINKING_DELTA` | `"thinking:delta"` | Streaming thinking chunk |
| `EVENTS.TOOL_CALLED` | `"tool:called"` | Tool was invoked |
| `EVENTS.TOOL_RESULT` | `"tool:result"` | Tool returned result |
| `EVENTS.INPUT_REQUESTED` | `"input:requested"` | Human input requested |
| `EVENTS.INPUT_RESPONSE` | `"input:response"` | Human input received |

### Event Payloads

```typescript
// workflow:started
interface WorkflowStartedPayload {
  readonly sessionId: string
  readonly workflowName: string
  readonly input: unknown
}

// workflow:completed
interface WorkflowCompletedPayload {
  readonly sessionId: string
  readonly finalState: unknown
  readonly exitPhase?: string
}

// phase:entered
interface PhaseEnteredPayload {
  readonly phase: string
  readonly fromPhase?: string
}

// phase:exited
interface PhaseExitedPayload {
  readonly phase: string
  readonly reason: "next" | "terminal" | "error"
}

// agent:started
interface AgentStartedPayload {
  readonly agentName: string
  readonly phase?: string
  readonly context?: unknown
}

// agent:completed
interface AgentCompletedPayload {
  readonly agentName: string
  readonly output: unknown
  readonly durationMs: number
}

// state:updated
interface StateUpdatedPayload {
  readonly state: unknown
  readonly patches?: ReadonlyArray<unknown>
  readonly inversePatches?: ReadonlyArray<unknown>
}

// text:delta
interface TextDeltaPayload {
  readonly agentName: string
  readonly delta: string
}

// thinking:delta
interface ThinkingDeltaPayload {
  readonly agentName: string
  readonly delta: string
}

// tool:called
interface ToolCalledPayload {
  readonly agentName: string
  readonly toolId: string
  readonly toolName: string
  readonly input: unknown
}

// tool:result
interface ToolResultPayload {
  readonly agentName: string
  readonly toolId: string
  readonly output: unknown
  readonly isError: boolean
}

// input:requested (phase-level HITL via `phase({ human: {...} })`)
interface InputRequestedPayload {
  readonly promptText: string
  readonly inputType: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
}

// input:requested (custom interaction via `createInteraction()`)
// NOTE: React hooks parse this format, not InputRequestedPayload
interface InteractionRequestPayload {
  readonly interactionId: string
  readonly agentName: string
  readonly prompt: string
  readonly inputType: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
}

// input:response
interface InputResponsePayload {
  readonly response: string
}

// input:response (for interactions)
interface InteractionResponsePayload {
  readonly interactionId: string
  readonly value: string
  readonly approved?: boolean        // For approval type
  readonly selectedIndex?: number    // For choice type
}
```

### Event Base Type

```typescript
interface Event<N extends string = string, P = unknown> {
  readonly id: EventId          // UUID v4
  readonly name: N              // Event name
  readonly payload: P           // Event-specific data
  readonly timestamp: Date      // Creation time
  readonly causedBy?: EventId   // Causality tracking
}

type AnyEvent = Event<string, unknown>
```

---

## Error Types

All errors extend Effect's `Data.TaggedError` internally.

| Error Class | Tag | Fields | When |
|-------------|-----|--------|------|
| `WorkflowAgentError` | `"WorkflowAgentError"` | `agentName`, `message`, `cause?` | Agent execution failed |
| `WorkflowValidationError` | `"WorkflowValidationError"` | `agentName`, `message`, `path?` | Output doesn't match Zod schema |
| `WorkflowPhaseError` | `"WorkflowPhaseError"` | `fromPhase`, `toPhase`, `message` | Invalid phase transition |
| `WorkflowStoreError` | `"WorkflowStoreError"` | `operation`, `message`, `cause?` | Storage operation failed |
| `WorkflowProviderError` | `"WorkflowProviderError"` | `agentName`, `code`, `message`, `retryable` | LLM API error |
| `WorkflowTimeoutError` | `"WorkflowTimeoutError"` | `phase?`, `agentName?`, `timeoutMs` | Execution timed out |
| `WorkflowAbortedError` | `"WorkflowAbortedError"` | `phase?`, `reason` | Manually aborted |

**Provider Error Codes:**

```typescript
type ProviderErrorCode =
  | "RATE_LIMITED"      // 429 Too Many Requests
  | "CONTEXT_EXCEEDED"  // Token limit exceeded
  | "AUTH_FAILED"       // Invalid API key
  | "NETWORK"           // Connection failed
  | "UNKNOWN"           // Other errors
```

---

## Server

### `OpenScaffold.create(config)`

Create an OpenScaffold instance for running workflows as HTTP servers.

```typescript
import { OpenScaffold, AnthropicProvider } from "@open-scaffold/server"

const scaffold = OpenScaffold.create({
  database: "./data/app.db",       // Required: LibSQL path
  mode: "live",                    // Required: "live" | "playback"
  providers: {                     // Required (use {} to opt out)
    "claude-sonnet-4-5": AnthropicProvider()
  }
})
```

**Type Signature:**

```typescript
interface OpenScaffoldConfig {
  /** Path to SQLite database file */
  readonly database: string

  /** Provider mode (required - no default) */
  readonly mode: ProviderMode

  /** Provider registry (required - pass {} to opt out) */
  readonly providers?: Record<string, AgentProvider>
}

class OpenScaffold {
  static create(config: OpenScaffoldConfig): OpenScaffold

  /** Provider mode */
  get mode(): ProviderMode

  /** Database path */
  get database(): string

  /** Create HTTP server */
  createServer<S>(options: ServerOptions<S>): OpenScaffoldServer

  /** List all sessions */
  listSessions(): Promise<Array<SessionInfo>>

  /** Get provider recorder (advanced) */
  getProviderRecorder(): Promise<ProviderRecorderService>

  /** Dispose and release resources */
  dispose(): Promise<void>
}
```

---

### `scaffold.createServer(options)`

Create an HTTP server for a workflow.

```typescript
const server = scaffold.createServer({
  workflow: myWorkflow,
  host: "127.0.0.1",    // Optional (default: 127.0.0.1)
  port: 42069           // Optional (default: 42069)
})

await server.start()
// Server running at http://127.0.0.1:42069
```

**Type Signature:**

```typescript
interface ServerOptions<S> {
  readonly workflow: WorkflowDef<S, string, string>
  readonly host?: string   // default: "127.0.0.1"
  readonly port?: number   // default: 42069
}

interface OpenScaffoldServer {
  readonly port: number
  start(): Promise<void>
  stop(): Promise<void>
  address(): Promise<{ host: string; port: number }>
}

interface SessionInfo {
  id: string
  workflowName: string
  createdAt: Date
  eventCount: number
}

class OpenScaffoldError extends Error {
  readonly operation: string
  readonly cause: unknown
}
```

---

## HTTP Endpoints

Default port: **42069**

### Session Endpoints

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/sessions` | `{ input: string }` | `{ sessionId: string }` |
| `GET` | `/sessions` | - | `{ sessions: Array<SessionInfo> }` |
| `GET` | `/sessions/:id` | - | `{ sessionId, running: boolean }` |
| `GET` | `/sessions/:id/events` | `?history=true&fromPosition=N` | SSE stream |
| `GET` | `/sessions/:id/state` | `?position=N` | `{ state, position?, eventsReplayed? }` |
| `POST` | `/sessions/:id/input` | `{ input: string }` or `{ event: AnyEvent }` | `{ ok: true }` |
| `DELETE` | `/sessions/:id` | - | `{ ok: true }` |

### VCR Control Endpoints

| Method | Path | Response |
|--------|------|----------|
| `POST` | `/sessions/:id/pause` | `{ ok: true, wasPaused: boolean }` |
| `POST` | `/sessions/:id/resume` | `{ ok: true, wasResumed: boolean }` |
| `POST` | `/sessions/:id/fork` | `{ sessionId, originalSessionId, eventsCopied }` |

### Recording Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/recordings` | `{ recordings: Array<RecordingEntryMeta> }` |
| `GET` | `/recordings/:id` | `{ hash, prompt, provider, result, streamData, recordedAt }` |
| `DELETE` | `/recordings/:id` | `{ ok: true }` |
| `GET` | `/providers/status` | `{ provider: ProviderStatus }` |

---

## Services (Advanced)

These are Effect services for direct integration. Most users should use `run()`, `execute()`, or `OpenScaffold`.

### EventStore

Persists workflow events (the tape).

```typescript
interface EventStoreService {
  append(sessionId: SessionId, event: AnyEvent): Effect<void, StoreError>
  getEvents(sessionId: SessionId): Effect<ReadonlyArray<AnyEvent>, StoreError>
  getEventsFrom(sessionId: SessionId, position: number): Effect<ReadonlyArray<AnyEvent>, StoreError>
  listSessions(): Effect<ReadonlyArray<SessionId>, StoreError>
  deleteSession(sessionId: SessionId): Effect<void, StoreError>
}

// Context tag
class EventStore extends Context.Tag("@open-scaffold/EventStore")<EventStore, EventStoreService>() {}
```

### EventBus

Broadcasts events to subscribers (SSE).

```typescript
interface EventBusService {
  publish(sessionId: SessionId, event: AnyEvent): Effect<void, never>
  subscribe(sessionId: SessionId): Stream<AnyEvent, never>
}

// Context tag
class EventBus extends Context.Tag("@open-scaffold/EventBus")<EventBus, EventBusService>() {}
```

### ProviderRecorder

Records provider responses for deterministic replay.

```typescript
interface ProviderRecorderService {
  load(hash: string): Effect<RecordingEntry | null, StoreError>
  save(entry: Omit<RecordingEntry, "recordedAt">): Effect<void, StoreError>
  delete(hash: string): Effect<void, StoreError>
  list(): Effect<ReadonlyArray<RecordingEntryMeta>, StoreError>

  // Incremental recording API (crash-safe)
  startRecording(hash: string, metadata: { prompt: string; provider: string }): Effect<string, StoreError>
  appendEvent(recordingId: string, event: AgentStreamEvent): Effect<void, StoreError>
  finalizeRecording(recordingId: string, result: AgentRunResult): Effect<void, StoreError>
}

interface RecordingEntry {
  readonly hash: string
  readonly prompt: string
  readonly provider: string
  readonly streamData: ReadonlyArray<AgentStreamEvent>
  readonly result: AgentRunResult
  readonly recordedAt: Date
}

// Context tag
class ProviderRecorder extends Context.Tag("@open-scaffold/ProviderRecorder")<ProviderRecorder, ProviderRecorderService>() {}
```

### StateSnapshotStore

Persists state snapshots for efficient recovery.

```typescript
interface StateSnapshotStoreService {
  getLatest(sessionId: SessionId): Effect<StateSnapshot | null, StoreError>
  save(snapshot: StateSnapshot): Effect<void, StoreError>
  delete(sessionId: SessionId): Effect<void, StoreError>
}

interface StateSnapshot<S = unknown> {
  readonly sessionId: SessionId
  readonly state: S
  readonly position: number    // Event index
  readonly createdAt: Date
}

// Context tag
class StateSnapshotStore extends Context.Tag("@open-scaffold/StateSnapshotStore")<StateSnapshotStore, StateSnapshotStoreService>() {}
```

---

## React Hooks

### Session Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `useCreateSession` | `() => (input: string) => Promise<string>` | Create new session |
| `useConnectSession` | `() => (id: string) => Promise<void>` | Connect to session |
| `useSessionId` | `() => string \| null` | Current session ID |
| `useDisconnect` | `() => () => Promise<void>` | Disconnect from session |
| `useStatus` | `() => ConnectionStatus` | Connection status |
| `useIsConnected` | `() => boolean` | Check if connected |

### Events & State Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `useEvents` | `() => ReadonlyArray<AnyEvent>` | All events |
| `useFilteredEvents` | `(opts: { name?: string \| string[] }) => ReadonlyArray<AnyEvent>` | Filter events |
| `useWorkflowState<S>` | `() => S \| undefined` | Current state |
| `useSendInput` | `() => (event: AnyEvent) => Promise<void>` | Send input event |
| `usePosition` | `() => number` | Current position |

### VCR Control Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `useStateAt<S>` | `(position: number) => { state, isLoading, error, refetch }` | State at position |
| `usePause` | `() => () => Promise<PauseResult>` | Pause session |
| `useResume` | `() => () => Promise<ResumeResult>` | Resume session |
| `useFork` | `() => () => Promise<ForkResult>` | Fork session |
| `useIsRunning` | `() => boolean` | Check if running |
| `useIsPaused` | `() => boolean` | Check if paused |

### HITL Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `usePendingInteraction` | `() => PendingInteraction \| null` | Current pending input |
| `usePendingInteractions` | `() => ReadonlyArray<PendingInteraction>` | All pending inputs |

### Types

```typescript
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

interface PendingInteraction {
  readonly interactionId: string
  readonly agentName: string
  readonly prompt: string
  readonly inputType: "approval" | "choice" | "freeform"
  readonly options?: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
}
```

---

## Convenience Functions

### `runSimple(workflow, input, runtime)`

Run without callbacks. Returns just the result.

```typescript
import { AnthropicProvider } from "@open-scaffold/server"

const result = await runSimple(myWorkflow, "Build an API", {
  providers: { "claude-sonnet-4-5": AnthropicProvider() }
})
```

### `runWithText(workflow, input, runtime)`

Run and collect all text output.

```typescript
import { AnthropicProvider } from "@open-scaffold/server"

const { text, result } = await runWithText(myWorkflow, "Generate code", {
  providers: { "claude-sonnet-4-5": AnthropicProvider() }
})
console.log("Generated:", text)
```

---

## Next Steps

- [Concepts](./concepts.md) -- Core mental models
- [Building Workflows](./building-workflows.md) -- Practical guide
- [React Integration](./react-integration.md) -- React hooks
- [Architecture](./architecture.md) -- System internals
