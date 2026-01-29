# React Integration

**Connect a React UI to your workflow.**

The `@open-scaffold/client` package provides 19 React hooks for building workflow UIs with full VCR controls and human-in-the-loop interactions.

---

## Quick Start

```tsx
import { WorkflowProvider, useWorkflowState, useCreateSession } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <WorkflowUI />
    </WorkflowProvider>
  )
}

function WorkflowUI() {
  const state = useWorkflowState<MyState>()
  const createSession = useCreateSession()

  return (
    <div>
      <button onClick={() => createSession("Hello!")}>Start</button>
      {state && <p>Result: {state.result}</p>}
    </div>
  )
}
```

---

## WorkflowProvider

Wrap your app with `WorkflowProvider` to enable hooks:

```tsx
import { WorkflowProvider } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      {/* Your app components */}
    </WorkflowProvider>
  )
}
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | Yes | Server URL (default port: 42069) |
| `sessionId` | `string` | No | Auto-connect to existing session |
| `children` | `ReactNode` | Yes | Child components |

**Important:** All hooks must be used inside a `WorkflowProvider`. Using hooks outside throws:
```
Error: WorkflowProvider is missing. Wrap your app in <WorkflowProvider />.
```

---

## Hooks Overview (19 Hooks)

### Core State & Session

| Hook | Returns | Purpose |
|------|---------|---------|
| `useEvents()` | `ReadonlyArray<AnyEvent>` | All events from current session |
| `useWorkflowState<S>()` | `S \| undefined` | Current computed state |
| `useSessionId()` | `string \| null` | Current session ID |
| `useStatus()` | `ConnectionStatus` | Connection status |
| `usePosition()` | `number` | Current event count (position in stream) |

### Session Management

| Hook | Returns | Purpose |
|------|---------|---------|
| `useCreateSession()` | `(input: string) => Promise<string>` | Create new session |
| `useConnectSession()` | `(sessionId: string) => Promise<void>` | Connect to existing session |
| `useDisconnect()` | `() => Promise<void>` | Disconnect from session |
| `useIsConnected()` | `boolean` | Is connected? |

### Event Filtering

| Hook | Returns | Purpose |
|------|---------|---------|
| `useFilteredEvents(options)` | `ReadonlyArray<AnyEvent>` | Events filtered by name(s) |

### Time-Travel

| Hook | Returns | Purpose |
|------|---------|---------|
| `useStateAt<S>(position)` | `UseStateAtResult<S>` | State at any past position |

### VCR Controls

| Hook | Returns | Purpose |
|------|---------|---------|
| `usePause()` | `() => Promise<PauseResult>` | Pause session |
| `useResume()` | `() => Promise<ResumeResult>` | Resume session |
| `useFork()` | `() => Promise<ForkResult>` | Fork session (branch) |
| `useIsRunning()` | `boolean` | Is workflow running? |
| `useIsPaused()` | `boolean` | Is workflow paused? |

### HITL Interactions

| Hook | Returns | Purpose |
|------|---------|---------|
| `useSendInput()` | `(event: AnyEvent) => Promise<void>` | Send user input event |
| `usePendingInteraction()` | `PendingInteraction \| null` | First pending interaction |
| `usePendingInteractions()` | `ReadonlyArray<PendingInteraction>` | All pending interactions |

---

## Core State & Session Hooks

### useEvents

Get all events from the current workflow session.

```tsx
function EventLog() {
  const events = useEvents()

  return (
    <ul>
      {events.map(event => (
        <li key={event.id}>
          <strong>{event.name}</strong>: {JSON.stringify(event.payload)}
        </li>
      ))}
    </ul>
  )
}
```

**Returns:** `ReadonlyArray<AnyEvent>` -- All events in chronological order.

---

### useWorkflowState

Get the current computed state from the workflow.

```tsx
interface MyState {
  goal: string
  tasks: { id: string; title: string; done: boolean }[]
  phase: "planning" | "executing" | "complete"
}

function StateViewer() {
  const state = useWorkflowState<MyState>()

  if (!state) return <div>Loading...</div>

  return (
    <div>
      <h2>Goal: {state.goal}</h2>
      <p>Phase: {state.phase}</p>
      <ul>
        {state.tasks.map(t => (
          <li key={t.id} className={t.done ? "done" : ""}>
            {t.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Returns:** `S | undefined` -- The current state, or `undefined` before first state event.

---

### useSessionId

Get the current session ID.

```tsx
function SessionInfo() {
  const sessionId = useSessionId()

  return (
    <div>
      {sessionId
        ? <code>Session: {sessionId}</code>
        : <span>Not connected</span>
      }
    </div>
  )
}
```

**Returns:** `string | null` -- Session ID when connected, `null` when disconnected.

---

### useStatus

Get the current connection status.

```tsx
function StatusIndicator() {
  const status = useStatus()

  const statusColors = {
    disconnected: "gray",
    connecting: "yellow",
    connected: "green",
    reconnecting: "orange",
    error: "red"
  }

  return (
    <span style={{ color: statusColors[status] }}>
      {status}
    </span>
  )
}
```

**Returns:** `ConnectionStatus` -- One of: `"disconnected"`, `"connecting"`, `"connected"`, `"reconnecting"`, `"error"`.

---

### usePosition

Get the current position in the event stream (number of events received).

```tsx
function ProgressIndicator() {
  const position = usePosition()

  return <div>Events received: {position}</div>
}
```

**Returns:** `number` -- Count of events in the stream.

---

## Session Management Hooks

### useCreateSession

Get a stable function to create a new session.

```tsx
function StartButton() {
  const createSession = useCreateSession()
  const [input, setInput] = useState("")

  const handleStart = async () => {
    const sessionId = await createSession(input)
    console.log("Created session:", sessionId)
  }

  return (
    <div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Enter goal..."
      />
      <button onClick={handleStart}>Start Workflow</button>
    </div>
  )
}
```

**Returns:** `(input: string) => Promise<string>` -- Function that creates session and returns its ID.

---

### useConnectSession

Get a stable function to connect to an existing session.

```tsx
function ConnectForm() {
  const connectSession = useConnectSession()
  const [sessionId, setSessionId] = useState("")

  const handleConnect = async () => {
    await connectSession(sessionId)
    console.log("Connected to session")
  }

  return (
    <div>
      <input
        value={sessionId}
        onChange={e => setSessionId(e.target.value)}
        placeholder="Session ID..."
      />
      <button onClick={handleConnect}>Connect</button>
    </div>
  )
}
```

**Returns:** `(sessionId: string) => Promise<void>` -- Function that connects to existing session.

---

### useDisconnect

Get a stable function to disconnect from the current session.

```tsx
function DisconnectButton() {
  const disconnect = useDisconnect()
  const isConnected = useIsConnected()

  if (!isConnected) return null

  return (
    <button onClick={disconnect}>
      Disconnect
    </button>
  )
}
```

**Returns:** `() => Promise<void>` -- Function that disconnects from current session.

---

### useIsConnected

Check if the client is currently connected.

```tsx
function ConnectionGuard({ children }: { children: React.ReactNode }) {
  const isConnected = useIsConnected()

  if (!isConnected) {
    return <div>Please connect to a session first.</div>
  }

  return <>{children}</>
}
```

**Returns:** `boolean` -- `true` when status is `"connected"`.

---

## Event Filtering

### useFilteredEvents

Get events filtered by name. Supports single name or array of names.

```tsx
// Filter by single event name
function TextStream() {
  const textDeltas = useFilteredEvents({ name: "text:delta" })

  return (
    <div>
      {textDeltas.map(event => (
        <span key={event.id}>{(event.payload as { delta: string }).delta}</span>
      ))}
    </div>
  )
}

// Filter by multiple event names
function AgentEvents() {
  const agentEvents = useFilteredEvents({
    name: ["agent:started", "agent:completed", "agent:error"]
  })

  return (
    <div>
      <h3>Agent Activity ({agentEvents.length} events)</h3>
      {agentEvents.map(event => (
        <div key={event.id}>
          {event.name}: {event.payload.agentName}
        </div>
      ))}
    </div>
  )
}
```

**Options:**

```typescript
interface UseFilteredEventsOptions {
  /** Filter by event name(s) - matches the event's `name` property */
  readonly name?: string | ReadonlyArray<string>
}
```

**Returns:** `ReadonlyArray<AnyEvent>` -- Filtered events in chronological order.

---

## Time-Travel

### useStateAt

Get the state at a specific position in the event history. Enables time-travel debugging by replaying events up to the given position.

```tsx
function TimeSlider() {
  const position = usePosition()
  const [targetPos, setTargetPos] = useState(0)
  const { state, isLoading, error, refetch } = useStateAt<MyState>(targetPos)

  return (
    <div>
      <div className="slider">
        <input
          type="range"
          min={0}
          max={position}
          value={targetPos}
          onChange={(e) => setTargetPos(Number(e.target.value))}
        />
        <span>Position: {targetPos} / {position}</span>
      </div>

      {isLoading && <div className="loading">Computing state...</div>}
      {error && (
        <div className="error">
          Error: {error.message}
          <button onClick={refetch}>Retry</button>
        </div>
      )}
      {state && <StateViewer state={state} />}
    </div>
  )
}
```

**Returns:**

```typescript
interface UseStateAtResult<S> {
  /** The computed state (undefined while loading or on error) */
  readonly state: S | undefined
  /** Whether the state is currently being fetched */
  readonly isLoading: boolean
  /** Error if the fetch failed */
  readonly error: Error | undefined
  /** Refetch the state at the current position */
  readonly refetch: () => void
}
```

---

## VCR Controls

The VCR metaphor: your workflow is like a tape you can pause, resume, rewind, and fork.

### usePause

Get a stable function to pause the current session. Pausing interrupts the workflow event loop.

```tsx
function PauseButton() {
  const pause = usePause()
  const isRunning = useIsRunning()

  if (!isRunning) return null

  const handlePause = async () => {
    const result = await pause()
    console.log("Paused at position:", result.position)
  }

  return <button onClick={handlePause}>Pause</button>
}
```

**Returns:** `() => Promise<PauseResult>` -- Function that pauses and returns result with position.

---

### useResume

Get a stable function to resume the current session. Resuming restarts the workflow event loop from where it left off.

```tsx
function ResumeButton() {
  const resume = useResume()
  const isPaused = useIsPaused()

  if (!isPaused) return null

  const handleResume = async () => {
    const result = await resume()
    console.log("Resumed successfully")
  }

  return <button onClick={handleResume}>Resume</button>
}
```

**Returns:** `() => Promise<ResumeResult>` -- Function that resumes paused session.

---

### useFork

Get a stable function to fork the current session. Forking creates a new session with all events copied up to the current position.

```tsx
function ForkButton() {
  const fork = useFork()

  const handleFork = async () => {
    const { sessionId, eventsCopied } = await fork()
    console.log(`Forked to ${sessionId} with ${eventsCopied} events`)
  }

  return <button onClick={handleFork}>Fork Session</button>
}
```

**Returns:** `() => Promise<ForkResult>` -- Function that forks and returns new session info.

```typescript
interface ForkResult {
  sessionId: string
  eventsCopied: number
}
```

---

### useIsRunning

Check if the session is currently running.

```tsx
function RunningIndicator() {
  const isRunning = useIsRunning()

  return (
    <span className={isRunning ? "pulse" : ""}>
      {isRunning ? "Running..." : "Stopped"}
    </span>
  )
}
```

**Returns:** `boolean` -- `true` when workflow is actively executing.

---

### useIsPaused

Check if the session is currently paused. A session is paused when it has events but is not running.

```tsx
function PausedBanner() {
  const isPaused = useIsPaused()

  if (!isPaused) return null

  return (
    <div className="banner warning">
      Workflow is paused. Click Resume to continue.
    </div>
  )
}
```

**Returns:** `boolean` -- `true` when workflow is paused.

---

### Combined VCR Controls

```tsx
function VCRControls() {
  const pause = usePause()
  const resume = useResume()
  const fork = useFork()
  const isRunning = useIsRunning()
  const isPaused = useIsPaused()
  const position = usePosition()

  return (
    <div className="vcr-controls">
      <span>Position: {position}</span>

      {isRunning && (
        <button onClick={() => pause()} title="Pause workflow">
          Pause
        </button>
      )}

      {isPaused && (
        <>
          <button onClick={() => resume()} title="Resume workflow">
            Resume
          </button>
          <button onClick={() => fork()} title="Create branch from here">
            Fork
          </button>
        </>
      )}
    </div>
  )
}
```

---

## HITL Interactions

Human-in-the-Loop (HITL) hooks enable workflows to request human input and wait for responses.

> **Note:** These hooks work with `createInteraction()` from `@open-scaffold/core`, which emits `InteractionRequestPayload` events with `interactionId`, `agentName`, and `prompt` fields. Phase-level HITL (via `phase({ human: {...} })`) uses a different payload format (`promptText` instead of `prompt`) and won't work correctly with these hooks.

### PendingInteraction Type

```typescript
interface PendingInteraction {
  /** Unique ID for this interaction - use when responding */
  readonly interactionId: string
  /** Agent requesting input */
  readonly agentName: string
  /** Human-readable prompt */
  readonly prompt: string
  /** Type of input expected */
  readonly inputType: "freeform" | "approval" | "choice"
  /** For choice type: available options */
  readonly options?: ReadonlyArray<string>
  /** Optional metadata for UI rendering */
  readonly metadata?: Record<string, unknown>
}
```

---

### useSendInput

Get a stable function to send user input events.

```tsx
function InputForm() {
  const sendInput = useSendInput()
  const [text, setText] = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await sendInput({
      id: crypto.randomUUID(),
      name: "user:input",
      payload: { text },
      timestamp: new Date()
    })
    setText("")
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a message..."
      />
      <button type="submit">Send</button>
    </form>
  )
}
```

**Returns:** `(event: AnyEvent) => Promise<void>` -- Function that sends event to server.

---

### usePendingInteraction

Get the first pending interaction that needs human input. Returns the oldest unresponded interaction request, or `null` if none.

```tsx
function InteractionModal() {
  const pending = usePendingInteraction()
  const sendInput = useSendInput()

  if (!pending) return null

  const respond = (value: string, approved?: boolean) => {
    sendInput({
      id: crypto.randomUUID(),
      name: "input:response",
      payload: {
        interactionId: pending.interactionId,
        value,
        ...(approved !== undefined && { approved })
      },
      timestamp: new Date()
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{pending.agentName} needs input</h3>
        <p>{pending.prompt}</p>

        {pending.inputType === "approval" && (
          <div className="actions">
            <button
              className="approve"
              onClick={() => respond("approve", true)}
            >
              Approve
            </button>
            <button
              className="reject"
              onClick={() => respond("reject", false)}
            >
              Reject
            </button>
          </div>
        )}

        {pending.inputType === "choice" && pending.options && (
          <div className="choices">
            {pending.options.map(opt => (
              <button key={opt} onClick={() => respond(opt)}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {pending.inputType === "freeform" && (
          <FreeformInput onSubmit={respond} />
        )}
      </div>
    </div>
  )
}

function FreeformInput({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("")

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(value) }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={3}
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

**Returns:** `PendingInteraction | null` -- First pending interaction or `null`.

---

### usePendingInteractions

Get all pending interactions that need human input. Returns all unresponded interaction requests in chronological order.

```tsx
function InteractionQueue() {
  const interactions = usePendingInteractions()

  if (interactions.length === 0) return null

  return (
    <div className="interaction-queue">
      <h3>{interactions.length} pending interaction(s)</h3>
      <ul>
        {interactions.map(interaction => (
          <li key={interaction.interactionId}>
            <strong>{interaction.agentName}</strong>: {interaction.prompt}
            <span className="type">{interaction.inputType}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Returns:** `ReadonlyArray<PendingInteraction>` -- All pending interactions in order.

---

## Complete Example

A full workflow UI demonstrating all major hooks:

```tsx
import { useState, FormEvent } from "react"
import {
  WorkflowProvider,
  // Core State & Session
  useEvents,
  useWorkflowState,
  useSessionId,
  useStatus,
  usePosition,
  // Session Management
  useCreateSession,
  useConnectSession,
  useDisconnect,
  useIsConnected,
  // Event Filtering
  useFilteredEvents,
  // Time-Travel
  useStateAt,
  // VCR Controls
  usePause,
  useResume,
  useFork,
  useIsRunning,
  useIsPaused,
  // HITL
  useSendInput,
  usePendingInteraction,
  usePendingInteractions
} from "@open-scaffold/client"

// State shape for our workflow
interface AppState {
  goal: string
  tasks: { id: string; title: string; done: boolean }[]
  phase: "planning" | "executing" | "complete"
}

function WorkflowUI() {
  const [input, setInput] = useState("")
  const [targetPosition, setTargetPosition] = useState(0)

  // Core State & Session
  const events = useEvents()
  const state = useWorkflowState<AppState>()
  const sessionId = useSessionId()
  const status = useStatus()
  const position = usePosition()

  // Session Management
  const createSession = useCreateSession()
  const connectSession = useConnectSession()
  const disconnect = useDisconnect()
  const isConnected = useIsConnected()

  // Event Filtering
  const textEvents = useFilteredEvents({ name: "text:delta" })
  const agentEvents = useFilteredEvents({
    name: ["agent:started", "agent:completed"]
  })

  // Time-Travel
  const { state: historicalState, isLoading: timeLoading } =
    useStateAt<AppState>(targetPosition)

  // VCR Controls
  const pause = usePause()
  const resume = useResume()
  const fork = useFork()
  const isRunning = useIsRunning()
  const isPaused = useIsPaused()

  // HITL
  const sendInput = useSendInput()
  const pending = usePendingInteraction()
  const allPending = usePendingInteractions()

  // Handlers
  const handleStart = async (e: FormEvent) => {
    e.preventDefault()
    const newSessionId = await createSession(input)
    console.log("Started:", newSessionId)
    setInput("")
  }

  const handleFork = async () => {
    const result = await fork()
    console.log(`Forked to ${result.sessionId}`)
  }

  const respondToInteraction = (value: string, approved?: boolean) => {
    if (!pending) return
    sendInput({
      id: crypto.randomUUID(),
      name: "input:response",
      payload: {
        interactionId: pending.interactionId,
        value,
        ...(approved !== undefined && { approved })
      },
      timestamp: new Date()
    })
  }

  return (
    <div className="workflow-app">
      {/* Header with status */}
      <header>
        <h1>Open Scaffold Demo</h1>
        <div className="status-bar">
          <span className={`status ${status}`}>{status}</span>
          {sessionId && <code>{sessionId}</code>}
          {isConnected && (
            <button onClick={disconnect}>Disconnect</button>
          )}
        </div>
      </header>

      {/* Start/Connect form (when disconnected) */}
      {!isConnected && (
        <section className="connect-section">
          <form onSubmit={handleStart}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter your goal..."
            />
            <button type="submit">Start New</button>
          </form>
        </section>
      )}

      {/* Main content (when connected) */}
      {isConnected && (
        <>
          {/* Current State */}
          <section className="state-section">
            <h2>Current State</h2>
            {state ? (
              <div>
                <p><strong>Goal:</strong> {state.goal}</p>
                <p><strong>Phase:</strong> {state.phase}</p>
                <h4>Tasks ({state.tasks.length})</h4>
                <ul>
                  {state.tasks.map(t => (
                    <li key={t.id} className={t.done ? "done" : ""}>
                      {t.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Waiting for state...</p>
            )}
          </section>

          {/* VCR Controls */}
          <section className="vcr-section">
            <h2>VCR Controls</h2>
            <div className="vcr-buttons">
              {isRunning && (
                <button onClick={() => pause()}>Pause</button>
              )}
              {isPaused && (
                <>
                  <button onClick={() => resume()}>Resume</button>
                  <button onClick={handleFork}>Fork</button>
                </>
              )}
            </div>
            <p>
              Position: {position} |
              Running: {isRunning ? "Yes" : "No"} |
              Paused: {isPaused ? "Yes" : "No"}
            </p>
          </section>

          {/* Time-Travel Slider */}
          <section className="time-travel-section">
            <h2>Time Travel</h2>
            <input
              type="range"
              min={0}
              max={position}
              value={targetPosition}
              onChange={e => setTargetPosition(Number(e.target.value))}
            />
            <span>Viewing position: {targetPosition}</span>
            {timeLoading && <p>Loading historical state...</p>}
            {historicalState && (
              <pre>{JSON.stringify(historicalState, null, 2)}</pre>
            )}
          </section>

          {/* Event Log */}
          <section className="events-section">
            <h2>Events ({events.length})</h2>
            <p>Text events: {textEvents.length}</p>
            <p>Agent events: {agentEvents.length}</p>
            <ul className="event-log">
              {events.slice(-10).map(event => (
                <li key={event.id}>
                  <code>{event.name}</code>
                </li>
              ))}
            </ul>
          </section>

          {/* HITL Interactions */}
          {allPending.length > 0 && (
            <section className="hitl-section">
              <h2>Pending Interactions ({allPending.length})</h2>
            </section>
          )}

          {pending && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>{pending.agentName} needs input</h3>
                <p>{pending.prompt}</p>

                {pending.inputType === "approval" && (
                  <div className="actions">
                    <button
                      className="approve"
                      onClick={() => respondToInteraction("approve", true)}
                    >
                      Approve
                    </button>
                    <button
                      className="reject"
                      onClick={() => respondToInteraction("reject", false)}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {pending.inputType === "choice" && pending.options && (
                  <div className="choices">
                    {pending.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => respondToInteraction(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {pending.inputType === "freeform" && (
                  <FreeformModal onSubmit={respondToInteraction} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FreeformModal({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("")

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(value); setValue("") }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Enter your response..."
        rows={3}
      />
      <button type="submit">Submit</button>
    </form>
  )
}

export default function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <WorkflowUI />
    </WorkflowProvider>
  )
}
```

---

## TypeScript Types

Key types exported from `@open-scaffold/client`:

```typescript
// Connection status
type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"

// Event filtering options
interface UseFilteredEventsOptions {
  readonly name?: string | ReadonlyArray<string>
}

// Time-travel result
interface UseStateAtResult<S> {
  readonly state: S | undefined
  readonly isLoading: boolean
  readonly error: Error | undefined
  readonly refetch: () => void
}

// VCR results
interface PauseResult {
  position: number
}

interface ResumeResult {
  success: boolean
}

interface ForkResult {
  sessionId: string
  eventsCopied: number
}

// HITL interaction
interface PendingInteraction {
  readonly interactionId: string
  readonly agentName: string
  readonly prompt: string
  readonly inputType: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
}
```

---

## Next Steps

- [API Reference](./api-reference.md) -- Complete type signatures and server API
- [Building Workflows](./building-workflows.md) -- Server-side workflow design
- [Architecture](./architecture.md) -- How the system works
- [Concepts](./concepts.md) -- Core concepts: events, state, sessions
