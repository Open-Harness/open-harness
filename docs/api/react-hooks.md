# React Hooks API Reference

All hooks require your component to be wrapped in `<WorkflowProvider>`.

```tsx
import { WorkflowProvider } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider url="http://localhost:3001">
      <YourComponent />
    </WorkflowProvider>
  )
}
```

---

## Session Hooks

### `useSessionId`

Get the current session ID.

```typescript
const sessionId: string | null = useSessionId()
```

**Returns**: Current session ID, or `null` if not connected.

**Example**:
```tsx
function SessionDisplay() {
  const sessionId = useSessionId()
  return <div>Session: {sessionId ?? "Not connected"}</div>
}
```

---

### `useCreateSession`

Get a function to create a new workflow session.

```typescript
const createSession: (input: string) => Promise<string> = useCreateSession()
```

**Returns**: Async function that takes initial input and returns the new session ID.

**Example**:
```tsx
function StartButton() {
  const createSession = useCreateSession()

  const handleStart = async () => {
    const sessionId = await createSession("Build a todo app")
    console.log("Created session:", sessionId)
  }

  return <button onClick={handleStart}>Start</button>
}
```

---

### `useConnectSession`

Get a function to connect to an existing session.

```typescript
const connectSession: (sessionId: string) => Promise<void> = useConnectSession()
```

**Returns**: Async function that connects to the specified session.

**Example**:
```tsx
function ConnectForm() {
  const connectSession = useConnectSession()
  const [id, setId] = useState("")

  return (
    <form onSubmit={() => connectSession(id)}>
      <input value={id} onChange={(e) => setId(e.target.value)} />
      <button type="submit">Connect</button>
    </form>
  )
}
```

---

### `useDisconnect`

Get a function to disconnect from the current session.

```typescript
const disconnect: () => Promise<void> = useDisconnect()
```

**Returns**: Async function that disconnects and clears local state.

**Example**:
```tsx
function DisconnectButton() {
  const disconnect = useDisconnect()
  return <button onClick={disconnect}>Disconnect</button>
}
```

---

## Event Hooks

### `useEvents`

Get all events from the current session.

```typescript
const events: ReadonlyArray<AnyEvent> = useEvents()
```

**Returns**: Array of all events, updated in real-time via SSE.

**Example**:
```tsx
function EventList() {
  const events = useEvents()
  return (
    <ul>
      {events.map((e) => (
        <li key={e.id}>{e.name}</li>
      ))}
    </ul>
  )
}
```

---

### `useFilteredEvents`

Get events filtered by name.

```typescript
interface UseFilteredEventsOptions {
  name?: string | ReadonlyArray<string>
}

const events: ReadonlyArray<AnyEvent> = useFilteredEvents(options)
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string \| string[]` | No | Event name(s) to filter by |

**Returns**: Filtered array of events.

**Example**:
```tsx
function TextEvents() {
  const textEvents = useFilteredEvents({ name: "text:delta" })
  const agentEvents = useFilteredEvents({
    name: ["agent:started", "agent:completed"]
  })

  return <div>{textEvents.length} text events</div>
}
```

---

## State Hooks

### `useWorkflowState`

Get the current computed state from the workflow.

```typescript
const state: S | undefined = useWorkflowState<S>()
```

**Type Parameter**: `S` - Your state type.

**Returns**: Current state (computed from events), or `undefined` before first event.

**Example**:
```tsx
interface MyState {
  tasks: string[]
  count: number
}

function StateDisplay() {
  const state = useWorkflowState<MyState>()
  return <div>{state?.count ?? 0} tasks</div>
}
```

---

### `useStateAt`

Get the state at a specific position in event history. Enables time-travel debugging.

```typescript
interface UseStateAtResult<S> {
  state: S | undefined
  isLoading: boolean
  error: Error | undefined
  refetch: () => void
}

const result: UseStateAtResult<S> = useStateAt<S>(position)
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `position` | `number` | Yes | Event index to compute state at (0-indexed) |

**Returns**: Object with `state`, `isLoading`, `error`, and `refetch`.

**Example**:
```tsx
function TimeTravelSlider() {
  const currentPosition = usePosition()
  const [target, setTarget] = useState(0)
  const { state, isLoading } = useStateAt<MyState>(target)

  return (
    <div>
      <input
        type="range"
        min={0}
        max={currentPosition}
        value={target}
        onChange={(e) => setTarget(Number(e.target.value))}
      />
      {isLoading ? "Loading..." : JSON.stringify(state)}
    </div>
  )
}
```

---

### `usePosition`

Get the current position in the event stream (number of events received).

```typescript
const position: number = usePosition()
```

**Returns**: Number of events in the current session.

**Example**:
```tsx
function PositionDisplay() {
  const position = usePosition()
  return <div>Position: {position}</div>
}
```

---

## Connection Hooks

### `useStatus`

Get the current connection status.

```typescript
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

const status: ConnectionStatus = useStatus()
```

**Returns**: One of the five connection states.

**Example**:
```tsx
function ConnectionIndicator() {
  const status = useStatus()

  const colors = {
    connected: "green",
    connecting: "yellow",
    reconnecting: "yellow",
    disconnected: "gray",
    error: "red"
  }

  return <span style={{ color: colors[status] }}>{status}</span>
}
```

---

### `useIsConnected`

Check if currently connected.

```typescript
const isConnected: boolean = useIsConnected()
```

**Returns**: `true` if status is "connected".

**Example**:
```tsx
function SendButton() {
  const isConnected = useIsConnected()
  return <button disabled={!isConnected}>Send</button>
}
```

---

## VCR Hooks

VCR (Video Cassette Recorder) controls let you pause, resume, and fork workflow sessions.

### `usePause`

Get a function to pause the current session.

```typescript
interface PauseResult {
  ok: boolean
  wasPaused: boolean  // false if already paused
}

const pause: () => Promise<PauseResult> = usePause()
```

**Returns**: Async function that pauses the workflow event loop.

**Example**:
```tsx
function PauseButton() {
  const pause = usePause()

  const handlePause = async () => {
    const result = await pause()
    if (result.wasPaused) {
      console.log("Session paused")
    }
  }

  return <button onClick={handlePause}>Pause</button>
}
```

---

### `useResume`

Get a function to resume the current session.

```typescript
interface ResumeResult {
  ok: boolean
  wasResumed: boolean  // false if already running
}

const resume: () => Promise<ResumeResult> = useResume()
```

**Returns**: Async function that resumes from where it left off.

**Example**:
```tsx
function ResumeButton() {
  const resume = useResume()

  const handleResume = async () => {
    const result = await resume()
    if (result.wasResumed) {
      console.log("Session resumed")
    }
  }

  return <button onClick={handleResume}>Resume</button>
}
```

---

### `useFork`

Get a function to fork the current session.

```typescript
interface ForkResult {
  sessionId: string         // New session ID
  originalSessionId: string // Original session ID
  eventsCopied: number      // Number of events copied
}

const fork: () => Promise<ForkResult> = useFork()
```

**Returns**: Async function that creates a new session with all events copied.

**Example**:
```tsx
function ForkButton() {
  const fork = useFork()

  const handleFork = async () => {
    const result = await fork()
    console.log("Forked to:", result.sessionId)
    console.log("Copied", result.eventsCopied, "events")
  }

  return <button onClick={handleFork}>Fork</button>
}
```

**Gotcha**: After forking, you're still connected to the original session. Use `useConnectSession` to switch to the new one.

---

### `useIsRunning`

Check if the session is currently running.

```typescript
const isRunning: boolean = useIsRunning()
```

**Returns**: `true` if the workflow event loop is active.

**Example**:
```tsx
function RunningIndicator() {
  const isRunning = useIsRunning()
  return <span>{isRunning ? "Running" : "Stopped"}</span>
}
```

---

### `useIsPaused`

Check if the session is paused.

```typescript
const isPaused: boolean = useIsPaused()
```

**Returns**: `true` if session has events but is not running.

**Example**:
```tsx
function VCRControls() {
  const isPaused = useIsPaused()
  const pause = usePause()
  const resume = useResume()

  return isPaused
    ? <button onClick={resume}>Resume</button>
    : <button onClick={pause}>Pause</button>
}
```

---

## HITL Hooks (Human-in-the-Loop)

### `usePendingInteraction`

Get the first pending interaction that needs human input.

```typescript
interface PendingInteraction {
  interactionId: string
  agentName: string
  prompt: string
  inputType: "freeform" | "approval" | "choice"
  options?: ReadonlyArray<string>  // For "choice" type
  metadata?: Record<string, unknown>
}

const pending: PendingInteraction | null = usePendingInteraction()
```

**Returns**: Oldest unresponded interaction, or `null` if none.

**Example**:
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
        approved
      },
      timestamp: new Date()
    })
  }

  return (
    <div className="modal">
      <p>{pending.prompt}</p>
      {pending.inputType === "approval" && (
        <>
          <button onClick={() => respond("approve", true)}>Approve</button>
          <button onClick={() => respond("reject", false)}>Reject</button>
        </>
      )}
      {pending.inputType === "choice" && pending.options?.map((opt) => (
        <button key={opt} onClick={() => respond(opt)}>{opt}</button>
      ))}
    </div>
  )
}
```

---

### `usePendingInteractions`

Get all pending interactions.

```typescript
const pending: ReadonlyArray<PendingInteraction> = usePendingInteractions()
```

**Returns**: All unresponded interactions in chronological order.

**Example**:
```tsx
function PendingCount() {
  const pending = usePendingInteractions()
  return <badge>{pending.length} pending</badge>
}
```

---

### `useSendInput`

Get a function to send user input events.

```typescript
const sendInput: (event: AnyEvent) => Promise<void> = useSendInput()
```

**Returns**: Async function that sends any event to the server.

**Example**:
```tsx
function CustomEventSender() {
  const sendInput = useSendInput()

  const sendCustomEvent = () => {
    sendInput({
      id: crypto.randomUUID(),
      name: "user:custom",
      payload: { data: "hello" },
      timestamp: new Date()
    })
  }

  return <button onClick={sendCustomEvent}>Send</button>
}
```

**Gotcha**: This is a low-level primitive. For HITL responses, use the exact format shown in `usePendingInteraction` example.

---

## Hook Categories Summary

| Category | Hooks | Purpose |
|----------|-------|---------|
| **Session** | `useSessionId`, `useCreateSession`, `useConnectSession`, `useDisconnect` | Manage session lifecycle |
| **Events** | `useEvents`, `useFilteredEvents` | Access event stream |
| **State** | `useWorkflowState`, `useStateAt`, `usePosition` | Access computed state |
| **Connection** | `useStatus`, `useIsConnected` | Monitor connection |
| **VCR** | `usePause`, `useResume`, `useFork`, `useIsRunning`, `useIsPaused` | Control playback |
| **HITL** | `usePendingInteraction`, `usePendingInteractions`, `useSendInput` | Human input |
