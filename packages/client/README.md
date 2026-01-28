# @open-scaffold/client

Abstract client contract and HTTP implementation.

## Client Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     WorkflowClient                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. createSession(input) ──────► sessionId                  │
│              │                                              │
│              ▼                                              │
│  2. connect(sessionId)                                      │
│              │                                              │
│              ▼                                              │
│  3. events() ──────────────────► AsyncIterable<AnyEvent>    │
│     getState() ────────────────► S                          │
│     sendInput(event) ──────────► void                       │
│              │                                              │
│              ▼                                              │
│  4. disconnect()                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementations

| Implementation | Transport | Use Case |
|----------------|-----------|----------|
| HttpClient | HTTP + SSE | Browser, Node |

## Reconnection (Effect Schedule)

Uses Effect's `Schedule` primitive for SSE reconnection:

```typescript
import { sseReconnectSchedule } from "@open-scaffold/client"

// Exponential backoff + jitter, max 30s delay, max 20 attempts
```

## Contract (WorkflowClient)

```typescript
interface WorkflowClient {
  createSession(input: string): Promise<string>
  connect(sessionId: string): Promise<void>
  events(): AsyncIterable<AnyEvent>
  getState<S>(): Promise<S>
  sendInput(event: AnyEvent): Promise<void>
  disconnect(): Promise<void>
}
```

## Installation

```bash
pnpm add @open-scaffold/client
```

## Usage

```typescript
import { HttpClient } from "@open-scaffold/client"

const client = HttpClient({ url: "http://localhost:42069" })

const sessionId = await client.createSession("Build a todo app")
await client.connect(sessionId)

for await (const event of client.events()) {
  console.log(event)
}
```

## React Hooks

Wrap your app with `WorkflowProvider`:

```tsx
import { WorkflowProvider } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <YourWorkflowUI />
    </WorkflowProvider>
  )
}
```

### Core Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `useEvents()` | `AnyEvent[]` | All events in the session |
| `useWorkflowState<S>()` | `S` | Current workflow state |
| `useSendInput()` | `(text: string) => Promise<void>` | Send user input |
| `useStatus()` | `ConnectionStatus` | Connection status |
| `useCreateSession()` | `(input: string) => Promise<string>` | Create new session |
| `useConnectSession()` | `(id: string) => Promise<void>` | Connect to session |

### Session Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `useSessionId()` | `string \| null` | Current session ID |
| `useDisconnect()` | `() => Promise<void>` | Disconnect from session |
| `usePosition()` | `number` | Current event position (events.length) |
| `useIsConnected()` | `boolean` | Whether connected to session |

### VCR (Recording) Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `useStateAt(position)` | `{ state, loading, error }` | State at specific position |
| `usePause()` | `() => Promise<void>` | Pause running session |
| `useResume()` | `() => Promise<void>` | Resume paused session |
| `useFork()` | `() => Promise<string>` | Fork session, returns new ID |
| `useIsRunning()` | `boolean` | Whether session is running |
| `useIsPaused()` | `boolean` | Whether session is paused |

### HITL (Human-in-the-Loop) Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `usePendingInteraction()` | `InteractionRequest \| null` | Current pending interaction |
| `useFilteredEvents(names)` | `AnyEvent[]` | Events filtered by name(s) |

### Example: Time-Travel Debugging

```tsx
function TimeTravel() {
  const position = usePosition()
  const [viewPosition, setViewPosition] = useState(position)
  const { state, loading } = useStateAt(viewPosition)

  return (
    <div>
      <input
        type="range"
        min={0}
        max={position}
        value={viewPosition}
        onChange={(e) => setViewPosition(Number(e.target.value))}
      />
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  )
}
```

### Example: HITL Approval Flow

```tsx
function ApprovalUI() {
  const pending = usePendingInteraction()
  const sendInput = useSendInput()

  if (!pending) return null

  return (
    <div>
      <p>{pending.prompt}</p>
      <button onClick={() => sendInput(JSON.stringify({ approved: true }))}>
        Approve
      </button>
      <button onClick={() => sendInput(JSON.stringify({ approved: false }))}>
        Reject
      </button>
    </div>
  )
}
```
