# API Reference

**Complete reference for Open Harness packages.**

---

## Packages Overview

| Package | Description |
|---------|-------------|
| [`@open-harness/core`](#open-harnesscore) | Core primitives: workflow, agent, phase, run |
| [`@open-harness/server`](#open-harnessserver) | Server runtime and providers |
| [`@open-harness/client`](#open-harnessclient) | React hooks for workflow integration |
| [`@open-harness/testing`](#open-harnesstesting) | Testing utilities and playback mode |

---

## @open-harness/core

Core primitives for defining and running AI workflows.

```typescript
import { agent, workflow, phase, run } from "@open-harness/core"
```

### agent

Create an agent definition with validation.

```typescript
function agent<S, O, Ctx = void>(def: AgentDef<S, O, Ctx>): AgentDef<S, O, Ctx>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `def.name` | `string` | Unique identifier for the agent |
| `def.provider` | `AgentProvider` | Provider instance (e.g., `AnthropicProvider()`) |
| `def.output` | `z.ZodType<O>` | Zod schema for structured output |
| `def.prompt` | `(state: S, ctx?: Ctx) => string` | Function to generate prompt from state |
| `def.update` | `(output: O, draft: Draft<S>, ctx?: Ctx) => void` | Immer-style state mutation |
| `def.options?` | `Record<string, unknown>` | Provider-specific overrides |

**Example:**

```typescript
import { agent } from "@open-harness/core"
import { AnthropicProvider } from "@open-harness/server"
import { z } from "zod"

const planner = agent({
  name: "planner",
  provider: AnthropicProvider({ model: "claude-sonnet-4-5" }),
  output: z.object({
    tasks: z.array(z.string()),
    priority: z.enum(["low", "medium", "high"])
  }),
  prompt: (state) => `Create tasks for: ${state.goal}`,
  update: (output, draft) => {
    draft.tasks = output.tasks
    draft.priority = output.priority
  }
})
```

---

### workflow

Create a workflow definition. Supports two shapes: simple (single agent) or phased (state machine).

```typescript
// Simple workflow (single agent)
function workflow<S, Input = string>(
  def: SimpleWorkflowDef<S, Input>
): SimpleWorkflowDef<S, Input>

// Phase workflow (state machine)
function workflow<S, Input = string, Phases extends string = string>(
  def: PhaseWorkflowDef<S, Input, Phases>
): PhaseWorkflowDef<S, Input, Phases>
```

#### SimpleWorkflowDef

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Unique workflow identifier |
| `initialState` | `S` | Initial state object |
| `start` | `(input: Input, draft: Draft<S>) => void` | Transform input into state |
| `agent` | `AgentDef<S, any, void>` | Agent to run repeatedly |
| `until?` | `(state: S) => boolean` | Exit condition (returns true to stop) |

#### PhaseWorkflowDef

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Unique workflow identifier |
| `initialState` | `S` | Initial state object |
| `start` | `(input: Input, draft: Draft<S>) => void` | Transform input into state |
| `phases` | `Record<Phases, PhaseDef<S, Phases>>` | Phase definitions |
| `startPhase?` | `Phases` | Override starting phase (default: first) |

**Example (Phase Workflow):**

```typescript
const researchWorkflow = workflow({
  name: "research",
  initialState: {
    topic: "",
    findings: [] as string[],
    summary: ""
  },
  start: (input, draft) => {
    draft.topic = input
  },
  phases: {
    research: { run: researcher, next: "summarize" },
    summarize: { run: summarizer, next: "done" },
    done: phase.terminal()
  }
})
```

---

### phase

Create a phase definition for state machine workflows.

```typescript
function phase<S, Phases extends string, Ctx = void>(
  def: PhaseDef<S, Phases, Ctx>
): PhaseDef<S, Phases, Ctx>

// Shorthand for terminal phases
phase.terminal<S, Phases>(): PhaseDef<S, Phases, void>
```

#### PhaseDef

| Name | Type | Description |
|------|------|-------------|
| `run?` | `AgentDef<S, any, Ctx>` | Agent to execute in this phase |
| `human?` | `HumanConfig<S>` | Human input configuration |
| `onResponse?` | `(response: string, draft: Draft<S>) => void` | Handle human response |
| `parallel?` | `number` | Max concurrent executions (requires `forEach`) |
| `forEach?` | `(state: S) => ReadonlyArray<Ctx>` | Generate contexts for parallel execution |
| `until?` | `(state: S, output?: unknown) => boolean` | Exit condition (true to exit) |
| `next?` | `Phases \| ((state: S) => Phases)` | Next phase transition |
| `terminal?` | `boolean` | Mark as terminal phase (workflow ends) |

**Example (Parallel Execution):**

```typescript
const working = phase<State, Phases, { task: Task }>({
  run: workerAgent,
  parallel: 5,
  forEach: (state) => state.tasks.map(task => ({ task })),
  until: (state) => state.tasks.every(t => t.done),
  next: "review"
})
```

---

### run

Execute a workflow and return a controllable execution handle.

```typescript
function run<S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: RunOptions<S, Input>
): WorkflowExecution<S>
```

#### RunOptions

| Name | Type | Description |
|------|------|-------------|
| `input` | `Input` | Input for the workflow's `start()` function |
| `runtime` | `RuntimeConfig` | Runtime configuration with providers and mode |
| `sessionId?` | `string` | Session ID (generates UUID if not provided) |
| `signal?` | `AbortSignal` | Abort signal for cancellation |
| `observer?` | `WorkflowObserver<S>` | Lifecycle event callbacks |
| `humanInput?` | `HumanInputHandler` | Handler for HITL interactions |

#### WorkflowExecution

The returned handle implements `PromiseLike<RunResult<S>>` and provides control methods:

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `sessionId` | `string` | Session identifier |
| `isPaused` | `boolean` | Whether execution is paused |
| `pause()` | `void` | Pause at next yield point |
| `resume()` | `void` | Resume paused execution |
| `abort()` | `void` | Cancel execution |
| `then()` | `PromiseLike` | Await the result |

#### RunResult

| Name | Type | Description |
|------|------|-------------|
| `state` | `S` | Final workflow state |
| `sessionId` | `string` | Session identifier |
| `durationMs` | `number` | Total execution time in milliseconds |

**Example:**

```typescript
import { run, cliPrompt } from "@open-harness/core"

// Simple await
const result = await run(myWorkflow, {
  input: "Build an API",
  runtime: { mode: "live" }
})
console.log("Final state:", result.state)

// With observer callbacks
const execution = run(myWorkflow, {
  input: "Hello",
  runtime: { mode: "live" },
  observer: {
    onTextDelta: ({ delta }) => process.stdout.write(delta),
    onStateChanged: (state) => console.log("State:", state),
    onPhaseChanged: (phase) => console.log("Phase:", phase)
  },
  humanInput: cliPrompt()
})

// Control execution
execution.pause()
execution.resume()
const result = await execution
```

---

### HITL Helpers

Built-in handlers for human-in-the-loop interactions.

```typescript
import { cliPrompt, autoApprove } from "@open-harness/core"
```

#### cliPrompt

Interactive terminal prompts for human input.

```typescript
function cliPrompt(): HumanInputHandler
```

#### autoApprove

Automatically approve all requests (for testing).

```typescript
function autoApprove(response?: string): HumanInputHandler
```

---

### Types

Key types exported from `@open-harness/core`:

```typescript
// State drafts (Immer)
type Draft<T> = /* Immer Draft type */
type ImmerDraft<T> = /* Immer Draft type */

// IDs
type SessionId = string & { readonly _brand: "SessionId" }
type WorkflowId = string & { readonly _brand: "WorkflowId" }
type AgentId = string & { readonly _brand: "AgentId" }
type EventId = string & { readonly _brand: "EventId" }

// Event types
type AnyEvent = WorkflowStartedEvent | WorkflowCompletedEvent | AgentStartedEvent | ...

// Observer callbacks
interface WorkflowObserver<S> {
  onWorkflowStarted?: (event: WorkflowStartedPayload) => void
  onWorkflowCompleted?: (event: WorkflowCompletedPayload<S>) => void
  onPhaseEntered?: (event: PhaseEnteredPayload) => void
  onPhaseExited?: (event: PhaseExitedPayload) => void
  onAgentStarted?: (event: AgentStartedPayload) => void
  onAgentCompleted?: (event: AgentCompletedPayload) => void
  onTextDelta?: (event: TextDeltaPayload) => void
  onThinkingDelta?: (event: ThinkingDeltaPayload) => void
  onToolCalled?: (event: ToolCalledPayload) => void
  onToolResult?: (event: ToolResultPayload) => void
  onInputRequested?: (event: InputRequestedPayload) => void
  onInputReceived?: (event: InputReceivedPayload) => void
  onStateChanged?: (state: S) => void
}
```

---

### Errors

Error classes for workflow failures:

```typescript
import {
  WorkflowAbortedError,
  WorkflowAgentError,
  WorkflowPhaseError,
  WorkflowProviderError,
  WorkflowStoreError,
  WorkflowTimeoutError,
  WorkflowValidationError,
  ProviderError,
  SessionNotFound,
  RecordingNotFound
} from "@open-harness/core"
```

---

## @open-harness/server

HTTP server runtime and AI providers.

```typescript
import { OpenScaffold, AnthropicProvider } from "@open-harness/server"
```

### OpenScaffold

Main server class for running workflows over HTTP.

```typescript
class OpenScaffold {
  static create(config: OpenScaffoldConfig): OpenScaffold

  readonly mode: ProviderMode
  readonly database: string

  createServer<S>(options: ServerOptions<S>): OpenScaffoldServer
  listSessions(): Promise<SessionInfo[]>
  getProviderRecorder(): Promise<ProviderRecorderService>
  dispose(): Promise<void>
}
```

#### OpenScaffoldConfig

| Name | Type | Description |
|------|------|-------------|
| `database` | `string` | Path to SQLite database file |
| `mode` | `"live" \| "playback"` | Provider mode (required) |

#### ServerOptions

| Name | Type | Description |
|------|------|-------------|
| `workflow` | `WorkflowDef<S, string, string>` | Workflow to serve |
| `host?` | `string` | Server host (default: `"0.0.0.0"`) |
| `port?` | `number` | Server port (default: `42069`) |

#### OpenScaffoldServer

| Method | Type | Description |
|--------|------|-------------|
| `port` | `number` | Server port |
| `start()` | `Promise<void>` | Start the server |
| `stop()` | `Promise<void>` | Stop gracefully |
| `address()` | `Promise<{ host: string; port: number }>` | Get address |

**Example:**

```typescript
import { OpenScaffold } from "@open-harness/server"
import { myWorkflow } from "./workflows"

const scaffold = OpenScaffold.create({
  database: "./data/app.db",
  mode: "live"
})

const server = scaffold.createServer({
  workflow: myWorkflow,
  port: 42069
})

await server.start()
console.log(`Server running on port ${server.port}`)

// Cleanup
await scaffold.dispose()
```

---

### AnthropicProvider

Create an Anthropic Claude provider for agents.

```typescript
function AnthropicProvider(config?: AnthropicProviderConfig): AgentProvider
```

#### AnthropicProviderConfig

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `model?` | `AnthropicModel` | `"claude-haiku-4-5"` | Model to use |
| `apiKey?` | `string` | `process.env.ANTHROPIC_API_KEY` | API key override |
| `extendedThinking?` | `boolean` | `false` | Enable extended thinking |
| `maxTokens?` | `number` | `4096` | Max response tokens |

#### AnthropicModel

```typescript
type AnthropicModel =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-5"
  | "claude-opus-4-5"
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-5-20251101"
  | (string & {})  // Custom models
```

**Example:**

```typescript
import { AnthropicProvider } from "@open-harness/server"
import { agent } from "@open-harness/core"

const provider = AnthropicProvider({
  model: "claude-sonnet-4-5",
  extendedThinking: true,
  maxTokens: 8192
})

const myAgent = agent({
  name: "analyst",
  provider,
  output: z.object({ analysis: z.string() }),
  prompt: (state) => `Analyze: ${state.data}`,
  update: (output, draft) => { draft.analysis = output.analysis }
})
```

---

### Constants

```typescript
import { DEFAULT_HOST, DEFAULT_PORT } from "@open-harness/server"

DEFAULT_HOST  // "0.0.0.0"
DEFAULT_PORT  // 42069
```

---

## @open-harness/client

React hooks for connecting to Open Harness workflows.

```typescript
import {
  WorkflowClientProvider,
  useWorkflow,
  useWorkflowData,
  useWorkflowActions,
  useWorkflowVCR,
  useWorkflowHITL,
  HttpClient
} from "@open-harness/client"
```

### WorkflowClientProvider

Context provider for workflow client connection.

```tsx
function WorkflowClientProvider(props: WorkflowClientProviderProps): JSX.Element
```

#### WorkflowClientProviderProps

| Name | Type | Description |
|------|------|-------------|
| `url` | `string` | Server URL |
| `children` | `ReactNode` | Child components |

**Example:**

```tsx
import { WorkflowClientProvider } from "@open-harness/client"

function App() {
  return (
    <WorkflowClientProvider url="http://localhost:42069">
      <MyWorkflowUI />
    </WorkflowClientProvider>
  )
}
```

---

### useWorkflow

Unified hook for all workflow operations (Tier 2 - recommended).

```typescript
function useWorkflow<S>(sessionId: string | null): WorkflowResult<S>
```

#### WorkflowResult

| Property | Type | Description |
|----------|------|-------------|
| `status` | `WorkflowDataStatus` | Connection status |
| `isConnected` | `boolean` | Whether connected to session |
| `events` | `ReadonlyArray<SerializedEvent>` | All session events |
| `state` | `S \| undefined` | Current derived state |
| `position` | `number` | Current event position |
| `isRunning` | `boolean` | Workflow is executing |
| `isPaused` | `boolean` | Workflow is paused |
| `isCompleted` | `boolean` | Workflow finished |
| `pendingInteractions` | `ReadonlyArray<PendingInteraction>` | HITL requests |
| `send` | `(event: SerializedEvent) => Promise<void>` | Send event |
| `pause` | `() => Promise<PauseResult>` | Pause execution |
| `resume` | `() => Promise<ResumeResult>` | Resume execution |
| `fork` | `() => Promise<ForkResult>` | Fork session |
| `respond` | `(id: string, response: string) => Promise<void>` | Respond to HITL |
| `isLoading` | `boolean` | Data loading |
| `isSending` | `boolean` | Sending in progress |
| `isPausing` | `boolean` | Pause in progress |
| `isResuming` | `boolean` | Resume in progress |
| `isForking` | `boolean` | Fork in progress |
| `isResponding` | `boolean` | HITL response in progress |
| `error` | `Error \| null` | Current error |

**Example:**

```tsx
function WorkflowView({ sessionId }: { sessionId: string }) {
  const {
    state,
    events,
    isRunning,
    isPaused,
    isCompleted,
    pendingInteractions,
    pause,
    resume,
    fork,
    respond,
    error
  } = useWorkflow<MyState>(sessionId)

  if (error) return <ErrorDisplay error={error} />

  return (
    <div>
      <StateView state={state} />
      <EventLog events={events} />

      {pendingInteractions.map(interaction => (
        <HITLPrompt
          key={interaction.id}
          interaction={interaction}
          onRespond={(value) => respond(interaction.id, value)}
        />
      ))}

      <VCRControls
        isPaused={isPaused}
        onPause={pause}
        onResume={resume}
        onFork={fork}
      />
    </div>
  )
}
```

---

### useWorkflowData

Read-only data access (Tier 1).

```typescript
function useWorkflowData<S>(sessionId: string | null): WorkflowDataResult<S>
```

#### WorkflowDataResult

| Property | Type | Description |
|----------|------|-------------|
| `status` | `"disconnected" \| "connecting" \| "connected" \| "error"` | Status |
| `events` | `ReadonlyArray<SerializedEvent>` | Events |
| `state` | `S \| undefined` | Derived state |
| `position` | `number` | Event position |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if any |

---

### useWorkflowActions

Workflow control actions (Tier 1).

```typescript
function useWorkflowActions(): WorkflowActionsResult
```

#### WorkflowActionsResult

| Property | Type | Description |
|----------|------|-------------|
| `send` | `(event: SerializedEvent) => Promise<void>` | Send event |
| `isSending` | `boolean` | Send in progress |

---

### useWorkflowVCR

VCR-style playback controls (Tier 1).

```typescript
function useWorkflowVCR(): WorkflowVCRResult
```

#### WorkflowVCRResult

| Property | Type | Description |
|----------|------|-------------|
| `pause` | `() => Promise<PauseResult>` | Pause execution |
| `resume` | `() => Promise<ResumeResult>` | Resume execution |
| `fork` | `() => Promise<ForkResult>` | Fork session |
| `isPausing` | `boolean` | Pause in progress |
| `isResuming` | `boolean` | Resume in progress |
| `isForking` | `boolean` | Fork in progress |

---

### useWorkflowHITL

Human-in-the-loop interactions (Tier 1).

```typescript
function useWorkflowHITL(sessionId: string | null): WorkflowHITLResult
```

#### WorkflowHITLResult

| Property | Type | Description |
|----------|------|-------------|
| `pending` | `ReadonlyArray<PendingInteraction>` | Pending requests |
| `respond` | `(id: EventId, response: string) => Promise<void>` | Send response |
| `isResponding` | `boolean` | Response in progress |

#### PendingInteraction

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Interaction ID |
| `prompt` | `string` | Display prompt |
| `type` | `"approval" \| "choice"` | Input type |
| `options?` | `ReadonlyArray<string>` | Choice options |

---

### HttpClient

Low-level HTTP client for server communication.

```typescript
class HttpClient implements WorkflowClient {
  constructor(config: ClientConfig)

  createSession(input: string): Promise<string>
  connect(sessionId: string): Promise<void>
  events(): AsyncIterable<SerializedEvent>
  getState<S>(): Promise<S>
  getStateAt<S>(position: number): Promise<StateAtResult<S>>
  sendInput(event: SerializedEvent): Promise<void>
  disconnect(): Promise<void>
  getSession(): Promise<SessionInfo>
  pause(): Promise<PauseResult>
  resume(): Promise<ResumeResult>
  fork(): Promise<ForkResult>
  readonly status: ConnectionStatus
}
```

#### ClientConfig

| Name | Type | Description |
|------|------|-------------|
| `url` | `string` | Server URL |
| `sessionId?` | `string` | Initial session ID |
| `headers?` | `Record<string, string>` | Custom headers |

---

### Types

```typescript
// Connection status
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

// Operation results
interface PauseResult { ok: boolean; wasPaused: boolean }
interface ResumeResult { ok: boolean; wasResumed: boolean }
interface ForkResult { sessionId: string; originalSessionId: string; eventsCopied: number }
interface StateAtResult<S> { state: S; position: number; eventsReplayed: number }

// Client error
class ClientError extends Error {
  readonly operation: "connect" | "disconnect" | "send" | "receive"
  readonly cause: unknown
}
```

---

## @open-harness/testing

Testing utilities for deterministic workflow testing.

```typescript
import { recordingsDbPath, recordingsDbUrl, getRandomPort } from "@open-harness/testing"
```

### recordingsDbPath

Absolute path to the shared recordings database for playback testing.

```typescript
const recordingsDbPath: string
```

### recordingsDbUrl

SQLite URL for the recordings database.

```typescript
const recordingsDbUrl: string  // "file:/path/to/recordings/test.db"
```

### getRandomPort

Get a random high port for test servers.

```typescript
function getRandomPort(): number  // 30000-40000 range
```

**Example:**

```typescript
import { OpenScaffold } from "@open-harness/server"
import { recordingsDbUrl, getRandomPort } from "@open-harness/testing"

// Use recordings for deterministic tests
const scaffold = OpenScaffold.create({
  database: recordingsDbUrl,
  mode: "playback"
})

const server = scaffold.createServer({
  workflow: myWorkflow,
  port: getRandomPort()
})

await server.start()
// Tests run with recorded responses - no API calls
```

---

## Quick Links

- [Getting Started](../getting-started.md) — Install and run your first workflow
- [Building Workflows](../guides/building-workflows.md) — Practical workflow patterns
- [React Integration](../guides/react-integration.md) — React hooks guide
- [Concepts](../concepts/index.md) — Core concepts explained
