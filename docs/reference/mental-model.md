# Open Scaffold Mental Model

**For developers building with Open Scaffold.**

This document explains how to think about building AI workflows. Before diving into APIs, understand these concepts.

---

## The Big Picture

Open Scaffold is a **workflow runtime** for AI agents. You define:
- **Agents** -- AI actors with a model, prompt, output schema, and state update function
- **Phases** -- Named stages that control workflow progression
- **Workflows** -- Compositions of agents and phases with initial state

The runtime manages execution, persistence, and streaming. You build the workflow, then execute it or connect a UI (client).

```
+-------------------------------------------------------------+
|  YOUR WORKFLOW                                                |
|                                                               |
|  Phases -> Agents -> State Updates -> Next Phase              |
|                                                               |
+-------------------------------------------------------------+
                         |
                    HTTP/SSE
                         |
                         v
+-------------------------------------------------------------+
|  YOUR UI (Client)                                             |
|                                                               |
|  React, Terminal, Mobile, whatever                            |
|                                                               |
+-------------------------------------------------------------+
```

---

## Mental Model 1: Events Are Facts

Everything that happens is an **event**. Events are immutable facts about what occurred.

```typescript
// Events use past tense - they're facts, not commands
"user:input"        // User typed something
"plan:created"      // A plan was created
"task:completed"    // A task finished
"agent:started"     // An agent began working

// NOT commands like:
"create:plan"       // This implies a command
"start:agent"       // This implies an action to take
```

**Why past tense?** Because events are recorded history. You can't change what happened. This enables:
- **Replay** -- Reconstruct any past state
- **Debugging** -- See exactly what happened
- **Audit** -- Complete history of the workflow

### Event Structure

```typescript
interface Event {
  id: EventId           // Unique identifier
  name: string          // "plan:created"
  payload: unknown      // Event-specific data
  timestamp: Date       // When it happened
  causedBy?: EventId    // What triggered this event
}
```

The `causedBy` field creates a **causality chain**. You can trace any event back to its origin.

```
user:input (root)
  +-- agent:started (causedBy: user:input)
        +-- text:delta (causedBy: agent:started)
        +-- text:delta (causedBy: agent:started)
        +-- plan:created (causedBy: agent:started)
              +-- task:started (causedBy: plan:created)
```

---

## Mental Model 2: The Tape

Think of your workflow as a **VCR tape**. Events are recorded as they happen. State is just "where we are on the tape."

```
TAPE (EventStore)
+----+----+----+----+----+----+----+----+
| E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 |  <- Events
+----+----+----+----+----+----+----+----+
                          ^
                     current position
                          |
                     STATE (derived)
```

**State is derived from events.** If you lose state, replay the tape to rebuild it. Use `computeStateAt(events, position)` to derive state at any point.

### VCR Controls

| Control | What It Does | When to Use |
|---------|--------------|-------------|
| **Play** | Run forward, processing events | Normal execution |
| **Pause** | Stop mid-execution | User wants to review |
| **Resume** | Continue from where we stopped | After pause |
| **Rewind** | View state at position N | Debugging, time-travel |
| **Fork** | Branch from current position | "What if" scenarios |

### VCR React Hooks

Use these hooks to build VCR controls in your UI:

```typescript
import {
  usePause,
  useResume,
  useFork,
  useIsRunning,
  useIsPaused,
  useStateAt,
  usePosition
} from "@open-scaffold/client"

function VCRControls() {
  const pause = usePause()
  const resume = useResume()
  const fork = useFork()
  const isRunning = useIsRunning()
  const isPaused = useIsPaused()
  const position = usePosition()

  return (
    <div>
      <span>Position: {position}</span>

      {isRunning && <button onClick={() => pause()}>Pause</button>}
      {isPaused && <button onClick={() => resume()}>Resume</button>}

      <button onClick={async () => {
        const { sessionId } = await fork()
        console.log("Forked to:", sessionId)
      }}>Fork</button>
    </div>
  )
}
```

**Time-Travel with `useStateAt`:**

```typescript
function TimeSlider() {
  const position = usePosition()
  const [targetPos, setTargetPos] = useState(0)
  const { state, isLoading } = useStateAt<MyState>(targetPos)

  return (
    <div>
      <input
        type="range"
        min={0}
        max={position}
        value={targetPos}
        onChange={(e) => setTargetPos(Number(e.target.value))}
      />
      {isLoading ? "Loading..." : <StateView state={state} />}
    </div>
  )
}
```

### State Computation

Use `computeStateAt(events, position)` to derive state at any position. This is a pure function that replays events up to the given position.

---

## Mental Model 3: Agents Are AI Actors

**Agents** are AI actors that respond to state and produce structured output that updates the workflow state.

### Defining an Agent

```typescript
import { agent } from "@open-scaffold/core"
import { z } from "zod"

const plannerAgent = agent({
  name: "planner",
  model: "claude-sonnet-4-5",

  // REQUIRED: Schema for structured output
  output: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string()
    }))
  }),

  // Build the prompt from state
  prompt: (state) => `
    Create a development plan for: ${state.goal}
    Break it into concrete tasks with clear descriptions.
  `,

  // Update state with the agent's output
  update: (output, draft) => {
    draft.tasks = output.tasks
    draft.phase = "planning-complete"
  }
})
```

### Why Structured Output?

Agents **must** have an `output` schema. This ensures:
1. **Reliability** -- LLM output is validated
2. **Type Safety** -- `update` receives typed data
3. **Deterministic State** -- Output maps cleanly to state updates

### Agent Lifecycle

```
Phase activates agent
    |
    v
Build prompt from state
    |
    v
Call LLM (streaming)
    |
    v
Emit: agent:started
Emit: text:delta (many)
Emit: text:complete
    |
    v
Parse with output schema
    |
    v
Call update(output, draft) -> New state
    |
    v
Emit: agent:completed
    |
    v
Advance to next phase
```

---

## Mental Model 4: Phases Control Flow

**Phases** define the stages of a workflow. Each phase runs an agent and specifies the next phase to transition to.

```typescript
import { phase, workflow } from "@open-scaffold/core"

const myWorkflow = workflow({
  name: "task-planner",
  initialState: { goal: "", tasks: [], phase: "idle" },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: plannerAgent, next: "execution" },
    execution: { run: workerAgent, next: "review" },
    review: { run: judgeAgent, next: "done" },
    done: phase.terminal()
  }
})
```

### Phase Rules

1. **Sequential** -- Phases execute one at a time
2. **Named** -- Each phase has a unique name
3. **Connected** -- Each phase specifies `next` (or is terminal)
4. **Agent-driven** -- Each non-terminal phase runs an agent

---

## Mental Model 5: Execute and Run

The runtime provides two APIs to run workflows:

### Async Iterator API (`execute`)

```typescript
import { execute } from "@open-scaffold/core"

const execution = execute(myWorkflow, {
  input: "Build a todo app",
  providers: { "claude-sonnet-4-5": anthropicProvider }
})

for await (const event of execution) {
  console.log(event.name, event.payload)
}
```

### Promise API with Observer (`run`)

```typescript
import { run } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build a todo app",
  observer: {
    stateChanged: (state) => console.log("State:", state),
    phaseChanged: (phase) => console.log("Phase:", phase),
  }
})
```

The `WorkflowObserver<S>` protocol defines the observer interface:

```typescript
interface WorkflowObserver<S> {
  stateChanged?: (state: S) => void
  phaseChanged?: (phase: string) => void
  eventEmitted?: (event: AnyEvent) => void
}
```

---

## Mental Model 6: Server and Client

Open Scaffold uses a **server/client model**. The workflow runs as a server. UIs connect as clients.

### Why This Model?

1. **One way to do things** -- No "in-process vs remote" split
2. **Any client** -- React, terminal, mobile, Rust, whatever
3. **Scalable** -- Host workflows as a service
4. **Clean separation** -- Server code vs UI code

### Building the Client (Your UI)

```typescript
// app.tsx
import { WorkflowProvider, useEvents, useWorkflowState, useSendInput } from "@open-scaffold/client"

function WorkflowUI() {
  const events = useEvents()           // Live event stream
  const state = useWorkflowState<MyState>() // Current state
  const sendInput = useSendInput()     // Send user events

  return (
    <div>
      <h1>Phase: {state.phase}</h1>

      <EventLog events={events} />

      <button onClick={() => sendInput({
        type: "user:approval",
        payload: { approved: true }
      })}>
        Approve Plan
      </button>
    </div>
  )
}

function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <WorkflowUI />
    </WorkflowProvider>
  )
}
```

### The Protocol

| Direction | Method | What |
|-----------|--------|------|
| Client -> Server | `POST /sessions` | Create session |
| Server -> Client | `GET /sessions/:id/events` | SSE event stream |
| Client -> Server | `POST /sessions/:id/input` | Send user input |
| Client -> Server | `GET /sessions/:id/state` | Get current state |
| Client -> Server | `POST /sessions/:id/pause` | Pause session |
| Client -> Server | `POST /sessions/:id/resume` | Resume session |
| Client -> Server | `POST /sessions/:id/fork` | Fork session |

### React Hooks Reference

| Hook | Returns | Purpose |
|------|---------|---------|
| **Session** |||
| `useCreateSession()` | `(input: string) => Promise<string>` | Create new session |
| `useConnectSession()` | `(id: string) => Promise<void>` | Connect to existing session |
| `useSessionId()` | `string \| null` | Current session ID |
| `useDisconnect()` | `() => Promise<void>` | Disconnect from session |
| `useStatus()` | `ConnectionStatus` | Connection status |
| `useIsConnected()` | `boolean` | Is connected? |
| **Events & State** |||
| `useEvents()` | `ReadonlyArray<AnyEvent>` | All events |
| `useFilteredEvents(opts)` | `ReadonlyArray<AnyEvent>` | Events by name(s) |
| `useWorkflowState<S>()` | `S \| undefined` | Current state |
| `useSendInput()` | `(event: AnyEvent) => Promise<void>` | Send user input |
| **VCR Controls** |||
| `usePosition()` | `number` | Current position (event count) |
| `useStateAt<S>(position)` | `{ state, isLoading, error }` | State at any position |
| `usePause()` | `() => Promise<PauseResult>` | Pause session |
| `useResume()` | `() => Promise<ResumeResult>` | Resume session |
| `useFork()` | `() => Promise<ForkResult>` | Fork session |
| `useIsRunning()` | `boolean` | Is running? |
| `useIsPaused()` | `boolean` | Is paused? |
| **HITL** |||
| `usePendingInteraction()` | `PendingInteraction \| null` | First pending interaction |
| `usePendingInteractions()` | `ReadonlyArray<PendingInteraction>` | All pending interactions |

---

## Mental Model 7: Persistence and Testing

Events persist to an **EventStore**. This is the tape -- durable, replayable, the source of truth.

### Store Configuration

The workflow uses `RuntimeConfig` with a `database` field for persistence:

```typescript
import { run } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build a todo app",
  database: "file:./data/events.db"
})
```

The runtime uses `EventStoreLive`, `StateSnapshotStoreLive`, and `ProviderRecorderLive` service implementations internally.

LibSQL works for everything:
- **Development** -- Local SQLite file (`./data/events.db`)
- **Production** -- Turso cloud (`libsql://your-db.turso.io`)
- **Testing** -- Same LibSQL, real persistence, no mocks

### Recording Provider Responses

The system has **two modes**:

| Mode | What It Does |
|------|--------------|
| **live** | Call real Agent SDKs and automatically record responses |
| **playback** | Replay recorded responses (no SDK calls) |

Run your workflow once in **live** mode. Provider responses are automatically recorded.

### Replaying in Tests

Run the same workflow with **playback** mode. Recorded responses are replayed deterministically.

### Why Recordings?

1. **Deterministic tests** -- No flaky SDK calls
2. **Fast** -- No network latency
3. **Cheap** -- No API costs
4. **Real data** -- Captured from actual agent SDK runs (not fabricated)

---

## Complete Example: Research Workflow

Here's a complete workflow that researches a topic and produces findings.

### Define Agents

```typescript
// agents.ts
import { agent } from "@open-scaffold/core"
import { z } from "zod"

export const researcher = agent({
  name: "researcher",
  model: "claude-sonnet-4-5",
  output: z.object({
    findings: z.array(z.string()),
    summary: z.string()
  }),
  prompt: (state) => `
    Research the following topic thoroughly: ${state.topic}
    Provide detailed findings and a summary.
  `,
  update: (output, draft) => {
    draft.findings = output.findings
    draft.summary = output.summary
  }
})

export const reviewer = agent({
  name: "reviewer",
  model: "claude-sonnet-4-5",
  output: z.object({
    approved: z.boolean(),
    feedback: z.string()
  }),
  prompt: (state) => `
    Review these research findings for: ${state.topic}
    Findings: ${state.findings.join(", ")}
    Summary: ${state.summary}
    Determine if the research is thorough and accurate.
  `,
  update: (output, draft) => {
    draft.approved = output.approved
    draft.feedback = output.feedback
  }
})
```

### Define Workflow

```typescript
// workflow.ts
import { workflow, phase } from "@open-scaffold/core"
import { researcher, reviewer } from "./agents"

interface ResearchState {
  topic: string
  findings: string[]
  summary: string
  approved: boolean
  feedback: string
}

export const researchWorkflow = workflow({
  name: "research-flow",
  initialState: {
    topic: "",
    findings: [],
    summary: "",
    approved: false,
    feedback: ""
  } as ResearchState,
  start: (input, draft) => { draft.topic = input },
  phases: {
    research: { run: researcher, next: "review" },
    review: { run: reviewer, next: "done" },
    done: phase.terminal()
  }
})
```

### Execute

```typescript
// main.ts
import { execute } from "@open-scaffold/core"
import { researchWorkflow } from "./workflow"

const execution = execute(researchWorkflow, {
  input: "quantum computing advances in 2026",
  providers: { "claude-sonnet-4-5": anthropicProvider }
})

for await (const event of execution) {
  console.log(event.name, event.payload)
}
```

### Client (React)

```typescript
// app.tsx
import { useState } from "react"
import { WorkflowProvider, useEvents, useWorkflowState, useSendInput } from "@open-scaffold/client"

function ResearchUI() {
  const [input, setInput] = useState("")
  const events = useEvents()
  const state = useWorkflowState<ResearchState>()
  const sendInput = useSendInput()

  const submit = () => {
    sendInput({ type: "user:input", payload: { text: input } })
    setInput("")
  }

  return (
    <div>
      <h1>Research Assistant</h1>

      {!state?.topic && (
        <form onSubmit={submit}>
          <input value={input} onChange={e => setInput(e.target.value)} />
          <button type="submit">Research</button>
        </form>
      )}

      {state?.findings.length > 0 && (
        <ul>
          {state.findings.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}

      <div>{events.length} events processed</div>
    </div>
  )
}
```

---

## What the Library Provides vs What You Define

Understanding the boundary helps you know what to build.

### The Library Provides

| Component | What It Does |
|-----------|--------------|
| **Workflow Runtime** | Phase execution, event streaming, persistence |
| **`agent()` builder** | Creates agent definitions with model, prompt, output, update |
| **`phase()` builder** | Creates phase definitions (including terminal phases) |
| **`workflow()` builder** | Creates workflow definitions with phases and initial state |
| **`execute()` API** | Async iterator for streaming workflow events |
| **`run()` API** | Promise-based execution with observer |
| **`WorkflowObserver<S>`** | Observer protocol for state and phase callbacks |
| **`computeStateAt()`** | Pure function to derive state from events at a position |
| **`RuntimeConfig`** | Configuration with `database` field |
| **`EventStoreLive`** | Live event store implementation |
| **`StateSnapshotStoreLive`** | Live state snapshot store implementation |
| **`ProviderRecorderLive`** | Live provider recorder implementation |
| **HTTP/SSE Server** | REST endpoints, event streaming |
| **Client Libraries** | React hooks (VCR, HITL, state, events) |

### You Define

| Component | What You Build |
|-----------|----------------|
| **Agents** | YOUR prompts, YOUR output schemas, YOUR state update functions |
| **Phases** | YOUR workflow stages and transitions |
| **Workflows** | YOUR workflow composition with initial state |
| **State Shape** | YOUR workflow's state interface |
| **Providers** | Which AI SDK + model each agent uses |

### The Pattern

```typescript
// Library provides the builders
import { agent, phase, workflow, execute, run } from "@open-scaffold/core"

// You define the domain
const myAgent = agent({
  name: "my-agent",
  model: "claude-sonnet-4-5",
  output: z.object({ result: z.string() }),
  prompt: (state) => `Do something with: ${state.input}`,
  update: (output, draft) => { draft.result = output.result }
})

// You compose into a workflow
const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { input: "", result: "" },
  start: (input, draft) => { draft.input = input },
  phases: {
    work: { run: myAgent, next: "done" },
    done: phase.terminal()
  }
})

// You execute
for await (const event of execute(myWorkflow, config)) {
  console.log(event)
}
```

---

## Summary

| Concept | Mental Model |
|---------|--------------|
| **Events** | Immutable facts, past tense, form causality chains |
| **Tape** | VCR recording of events, state is just playhead position |
| **Agents** | AI actors: model + prompt + output schema + state update |
| **Phases** | Named stages that control workflow progression |
| **Workflows** | Compositions of agents and phases with initial state |
| **execute()** | Async iterator API for streaming events |
| **run()** | Promise API with WorkflowObserver callbacks |
| **computeStateAt()** | Pure function to derive state from events at any position |
| **Server/Client** | Workflow is server (HTTP/SSE), UI is client (any framework) |
| **Testing** | Record from real SDK calls in live mode, replay in playback mode |
| **Human-in-the-Loop** | Empty queue = paused, client sends response, no new primitive needed |

**Key insight:** Events are the source of truth. Everything else -- state, UI, history -- is derived from events.

---

## Mental Model 8: Human-in-the-Loop

HITL means the workflow pauses for human input. The good news: **the architecture already supports this.**

### How It Works

```
1. Agent output signals need for input
2. State updated: workflow pauses
3. Client receives events, shows approval UI
4. User clicks "Approve"
5. Client POSTs response event
6. Workflow continues with next phase
```

### Client Side with HITL Hooks

Use the built-in HITL hooks to handle pending interactions:

```typescript
import { usePendingInteraction, usePendingInteractions, useSendInput } from "@open-scaffold/client"

function WorkflowUI() {
  const pending = usePendingInteraction()  // First pending, or null
  const sendInput = useSendInput()

  if (!pending) {
    return <NormalUI />
  }

  return (
    <ApprovalDialog
      prompt={pending.prompt}
      inputType={pending.inputType}
      options={pending.options}
      onSelect={(choice) => sendInput({
        id: crypto.randomUUID(),
        name: "input:response",
        payload: {
          interactionId: pending.interactionId,
          value: choice
        },
        timestamp: new Date()
      })}
    />
  )
}
```

**Available HITL Hooks:**

| Hook | Returns | Use Case |
|------|---------|----------|
| `usePendingInteraction()` | First pending interaction or `null` | Single approval modal |
| `usePendingInteractions()` | Array of all pending interactions | Queue of approvals |

**PendingInteraction shape:**

```typescript
interface PendingInteraction {
  interactionId: string      // Unique ID for response
  agentName: string          // Which agent requested
  prompt: string             // Human-readable prompt
  inputType: "approval" | "choice" | "freeform"
  options?: string[]         // For choice type
  metadata?: Record<string, unknown>
}
```

### Interaction Types

| Type | Use Case | Response |
|------|----------|----------|
| `approval` | Yes/No decisions | `"approve"` or `"reject"` |
| `selection` | Pick from options | Selected option value |
| `text` | Free-form input | String |
| `form` | Structured data | Object matching schema |
