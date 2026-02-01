# React Integration

**Build real-time AI interfaces with React hooks.**

---

The `@open-harness/client` package provides React hooks for connecting your UI to Open Harness workflows. Stream AI responses, display workflow state, and build interactive AI applications.

## Installation

```bash
bun add @open-harness/client
```

**Peer dependencies:** React 18+

---

## Quick Start

Wrap your app with `WorkflowClientProvider` and use hooks to interact with workflows:

```tsx
import {
  WorkflowClientProvider,
  useWorkflow
} from "@open-harness/client"

function App() {
  return (
    <WorkflowClientProvider url="http://localhost:42069">
      <ChatInterface />
    </WorkflowClientProvider>
  )
}

function ChatInterface() {
  const { state, status, textStream, actions } = useWorkflow()

  return (
    <div>
      <button onClick={() => actions.start("Hello!")}>
        Start
      </button>
      {textStream && <p>{textStream}</p>}
    </div>
  )
}
```

---

## WorkflowClientProvider

The provider establishes a connection to your Open Harness server:

```tsx
import { WorkflowClientProvider } from "@open-harness/client"

function App() {
  return (
    <WorkflowClientProvider
      url="http://localhost:42069"
      options={{
        // Reconnect on disconnect
        reconnect: true,
        reconnectInterval: 1000,

        // Authentication
        headers: {
          Authorization: `Bearer ${token}`
        }
      }}
    >
      {children}
    </WorkflowClientProvider>
  )
}
```

### Provider Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | required | Server URL |
| `reconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `reconnectInterval` | `number` | `1000` | Milliseconds between reconnection attempts |
| `headers` | `Record<string, string>` | `{}` | Custom headers (auth, etc.) |

---

## Core Hooks

### useWorkflow

The primary hook for interacting with workflows:

```tsx
import { useWorkflow } from "@open-harness/client"

function MyComponent() {
  const {
    // Current workflow state (typed)
    state,

    // Execution status
    status,  // 'idle' | 'running' | 'completed' | 'error'

    // Streaming content
    textStream,     // Current streaming text
    thinkingStream, // Extended thinking content (if enabled)

    // Error information
    error,

    // Control actions
    actions: {
      start,   // Start workflow with input
      pause,   // Pause execution
      resume,  // Resume paused workflow
      cancel,  // Cancel execution
      fork     // Fork from current point
    },

    // Session info
    sessionId,
    currentPhase
  } = useWorkflow<MyStateType>()

  return (/* ... */)
}
```

### useWorkflowState

Read-only access to workflow state with optional selector:

```tsx
import { useWorkflowState } from "@open-harness/client"

function StatusDisplay() {
  // Get entire state
  const state = useWorkflowState<MyState>()

  // Or use a selector for specific values (optimized re-renders)
  const progress = useWorkflowState<MyState, number>(
    (state) => state.progress
  )

  return <div>Progress: {progress}%</div>
}
```

### useCreateSession

Create new workflow sessions:

```tsx
import { useCreateSession } from "@open-harness/client"

function NewSessionButton() {
  const { createSession, isCreating, error } = useCreateSession()

  const handleClick = async () => {
    const session = await createSession({
      workflow: "my-workflow",
      input: { topic: "AI" },
      mode: "live"
    })
    console.log("Created session:", session.id)
  }

  return (
    <button onClick={handleClick} disabled={isCreating}>
      {isCreating ? "Creating..." : "New Session"}
    </button>
  )
}
```

### useTextStream

Real-time text streaming from AI:

```tsx
import { useTextStream } from "@open-harness/client"

function StreamingOutput() {
  const {
    text,        // Accumulated text
    delta,       // Latest chunk
    isStreaming, // Currently receiving
    clear        // Reset accumulated text
  } = useTextStream()

  return (
    <div>
      {isStreaming && <span className="cursor" />}
      <p>{text}</p>
    </div>
  )
}
```

---

## Building a Chat Interface

Here's a complete example of a chat-style interface:

```tsx
import React, { useState } from "react"
import {
  WorkflowClientProvider,
  useWorkflow,
  useTextStream
} from "@open-harness/client"

// State type for our chat workflow
interface ChatState {
  messages: Array<{
    role: "user" | "assistant"
    content: string
  }>
  currentResponse: string
}

function App() {
  return (
    <WorkflowClientProvider url="http://localhost:42069">
      <ChatApp />
    </WorkflowClientProvider>
  )
}

function ChatApp() {
  const [input, setInput] = useState("")
  const { state, status, actions } = useWorkflow<ChatState>()
  const { text: streamingText, isStreaming } = useTextStream()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && status !== "running") {
      actions.start(input)
      setInput("")
    }
  }

  return (
    <div className="chat-container">
      {/* Message history */}
      <div className="messages">
        {state?.messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && (
          <div className="message assistant streaming">
            {streamingText}
            <span className="cursor">|</span>
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={status === "running"}
        />
        <button type="submit" disabled={status === "running"}>
          Send
        </button>
      </form>

      {/* Status indicator */}
      {status === "running" && (
        <div className="status">AI is thinking...</div>
      )}
    </div>
  )
}
```

---

## Real-Time Updates

### Phase Tracking

Monitor workflow phase transitions:

```tsx
import { usePhase } from "@open-harness/client"

function PhaseIndicator() {
  const { currentPhase, previousPhase, phaseHistory } = usePhase()

  return (
    <div className="phase-indicator">
      <span className="current">Current: {currentPhase}</span>
      {previousPhase && (
        <span className="previous">Previous: {previousPhase}</span>
      )}

      {/* Show phase progression */}
      <div className="history">
        {phaseHistory.map((phase, i) => (
          <span key={i} className="phase-chip">{phase}</span>
        ))}
      </div>
    </div>
  )
}
```

### Event Subscription

Listen to all workflow events:

```tsx
import { useWorkflowEvents } from "@open-harness/client"

function EventLogger() {
  const [events, setEvents] = useState<WorkflowEvent[]>([])

  useWorkflowEvents({
    onEvent: (event) => {
      setEvents(prev => [...prev, event])
    },
    onPhaseChanged: (phase, from) => {
      console.log(`Phase: ${from} → ${phase}`)
    },
    onAgentStarted: ({ agent }) => {
      console.log(`Agent started: ${agent}`)
    },
    onAgentCompleted: ({ agent, durationMs }) => {
      console.log(`Agent ${agent} done in ${durationMs}ms`)
    }
  })

  return (
    <div className="event-log">
      {events.map((e, i) => (
        <div key={i} className="event">
          [{e.type}] {JSON.stringify(e.payload)}
        </div>
      ))}
    </div>
  )
}
```

---

## Human-in-the-Loop UI

Handle input requests from the workflow:

```tsx
import { useInputRequest } from "@open-harness/client"

function ApprovalDialog() {
  const {
    inputRequest,    // Current request (null if none)
    respond,         // Send response
    isWaiting        // Workflow is waiting for input
  } = useInputRequest()

  if (!inputRequest) return null

  return (
    <div className="modal">
      <h3>Input Required</h3>
      <p>{inputRequest.prompt}</p>

      {/* For choice-based input */}
      {inputRequest.options && (
        <div className="options">
          {inputRequest.options.map(option => (
            <button
              key={option.id}
              onClick={() => respond(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* For text input */}
      {inputRequest.type === "text" && (
        <form onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.elements.namedItem("input")
          respond((input as HTMLInputElement).value)
        }}>
          <input name="input" autoFocus />
          <button type="submit">Submit</button>
        </form>
      )}
    </div>
  )
}
```

---

## Session Management

### Multiple Sessions

Manage multiple concurrent workflow sessions:

```tsx
import {
  useSession,
  useSessionList,
  useCreateSession
} from "@open-harness/client"

function SessionManager() {
  const { sessions, activeSessionId, setActiveSession } = useSessionList()
  const { createSession } = useCreateSession()

  return (
    <div className="session-manager">
      <button onClick={() => createSession({ workflow: "chat" })}>
        New Chat
      </button>

      <div className="session-list">
        {sessions.map(session => (
          <div
            key={session.id}
            className={session.id === activeSessionId ? "active" : ""}
            onClick={() => setActiveSession(session.id)}
          >
            {session.name || session.id.slice(0, 8)}
            <span className="status">{session.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Session Persistence

Resume sessions across page reloads:

```tsx
import { useResumeSession } from "@open-harness/client"

function SessionRestorer() {
  const { resumeSession, isResuming } = useResumeSession()

  useEffect(() => {
    const savedSessionId = localStorage.getItem("sessionId")
    if (savedSessionId) {
      resumeSession(savedSessionId)
    }
  }, [])

  if (isResuming) {
    return <div>Restoring session...</div>
  }

  return null
}
```

---

## Advanced Patterns

### Optimistic Updates

Show immediate feedback while waiting for AI:

```tsx
function OptimisticChat() {
  const { state, actions } = useWorkflow<ChatState>()
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null)

  const sendMessage = async (text: string) => {
    // Show message immediately
    setOptimisticMessage(text)

    // Start workflow
    await actions.start(text)

    // Clear optimistic state (real state will have it)
    setOptimisticMessage(null)
  }

  return (
    <div>
      {state?.messages.map((m, i) => (
        <Message key={i} {...m} />
      ))}
      {optimisticMessage && (
        <Message role="user" content={optimisticMessage} pending />
      )}
    </div>
  )
}
```

### Forking Workflows

Create branches for "what if" scenarios:

```tsx
function ForkableChat() {
  const { state, actions, sessionId } = useWorkflow<ChatState>()
  const { createSession } = useCreateSession()

  const forkFromHere = async () => {
    // Create a new session forked from current point
    const forked = await createSession({
      workflow: "chat",
      forkFrom: sessionId,
      forkAtEvent: state.events.length - 1
    })

    // Navigate to forked session
    window.open(`/chat/${forked.id}`, "_blank")
  }

  return (
    <div>
      <button onClick={forkFromHere}>
        Fork conversation
      </button>
      {/* ... rest of UI */}
    </div>
  )
}
```

### Error Boundaries

Handle workflow errors gracefully:

```tsx
import { useWorkflowError } from "@open-harness/client"

function ErrorHandler() {
  const { error, clearError, retry } = useWorkflowError()

  if (!error) return null

  return (
    <div className="error-banner">
      <p>Something went wrong: {error.message}</p>
      <button onClick={retry}>Retry</button>
      <button onClick={clearError}>Dismiss</button>
    </div>
  )
}

// Wrap your app
function App() {
  return (
    <WorkflowClientProvider url="...">
      <ErrorHandler />
      <MainContent />
    </WorkflowClientProvider>
  )
}
```

---

## Server Setup

The React client needs a running Open Harness server. Here's a minimal setup:

```typescript
// server.ts
import { createServer } from "@open-harness/server"
import { myWorkflow } from "./workflows"

const server = createServer({
  port: 42069,
  workflows: {
    "my-workflow": myWorkflow
  }
})

server.start()
console.log("Server running at http://localhost:42069")
```

Run your server:

```bash
bun run server.ts
```

The server exposes:

- **HTTP endpoints** for session management
- **SSE streams** for real-time updates
- **WebSocket** (optional) for bidirectional communication

---

## TypeScript Support

All hooks are fully typed. Define your state types for autocomplete:

```tsx
// types.ts
export interface MyWorkflowState {
  topic: string
  findings: Array<{
    fact: string
    source: string
  }>
  summary: string | null
  status: "researching" | "summarizing" | "complete"
}

// Component.tsx
import { useWorkflow } from "@open-harness/client"
import { MyWorkflowState } from "./types"

function ResearchPanel() {
  const { state } = useWorkflow<MyWorkflowState>()

  // state is fully typed!
  return (
    <div>
      <h2>Researching: {state?.topic}</h2>
      <ul>
        {state?.findings.map((f, i) => (
          <li key={i}>{f.fact}</li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Hook Reference

| Hook | Purpose |
|------|---------|
| `useWorkflow` | Primary hook - state, status, actions, streaming |
| `useWorkflowState` | Read-only state access with selectors |
| `useCreateSession` | Create new workflow sessions |
| `useTextStream` | Real-time text streaming |
| `useThinkingStream` | Extended thinking content (Claude models) |
| `usePhase` | Current phase and transitions |
| `useWorkflowEvents` | Subscribe to all events |
| `useInputRequest` | Human-in-the-loop input handling |
| `useSession` | Current session info |
| `useSessionList` | Multiple session management |
| `useResumeSession` | Resume existing sessions |
| `useWorkflowError` | Error handling |
| `useFork` | Fork workflow sessions |

---

## Summary

1. **Wrap with Provider** — `WorkflowClientProvider` connects to your server
2. **Use Hooks** — `useWorkflow` for full control, specialized hooks for specific needs
3. **Stream in Real-Time** — `useTextStream` shows AI responses as they generate
4. **Handle Input** — `useInputRequest` for human-in-the-loop flows
5. **Manage Sessions** — Create, list, resume, and fork sessions

!!! success "Next Steps"
    - [Building Workflows](building-workflows.md) — Server-side workflow patterns
    - [API Reference](../api/reference.md) — Complete hook documentation

---

## Related

- [Getting Started](../getting-started.md) — Install and run your first workflow
- [Concepts: Events](../concepts/events.md) — Understand the event system
- [Building Workflows](building-workflows.md) — Create the workflows your UI consumes
