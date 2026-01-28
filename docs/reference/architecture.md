# Open Scaffold Architecture

**Date**: 2026-01-26
**Status**: Implementation Complete
**Principle**: Always server, always remote protocol. One way to do things.

---

## Overview

The system uses a **server/client model** with a clean separation:

- **Server** -- Workflow runtime (Effect-based, runs the business logic)
- **Client** -- UI that connects to server (any language/framework)

Even when running in the same process, communication uses the same protocol. This gives us:
- One way to do things (no "in-process vs remote" split)
- Clean imports (server imports vs client imports)
- Any client can connect (React, Rust, mobile, whatever)
- Business ready (hosted workflows, managed service)

```
+---------------------------------------------------------------------+
|  CLIENT SIDE                                                         |
|                                                                      |
|  @open-scaffold/client      HTTP client + React bindings             |
|                                                                      |
|  Import from here to BUILD UI                                        |
+---------------------------------------------------------------------+
                           |
                    HTTP/SSE Protocol
                           |
                           v
+---------------------------------------------------------------------+
|  SERVER SIDE                                                         |
|                                                                      |
|  @open-scaffold/core        Agents, phases, workflows, execute/run   |
|  @open-scaffold/server      HTTP/SSE server (Effect Platform)        |
|                                                                      |
|  Import from here to BUILD WORKFLOW                                  |
+---------------------------------------------------------------------+
```

---

## Two Layers

### Layer 1: SDK

The framework you import. Split into server and client packages.

**Server packages:**
- `@open-scaffold/core` -- Workflow runtime: `agent()`, `phase()`, `workflow()`, `execute()`, `run()`
- `@open-scaffold/server` -- HTTP/SSE server, storage implementations

**Client packages:**
- `@open-scaffold/client` -- WorkflowClient interface + HttpClient implementation + React bindings

**Note:** No separate testing package. Tests use real recordings and the HTTP client.

### Layer 2: Implementation (Your App)

What you build using the SDK.

**Server side (your workflow):**
```typescript
// workflow.ts
import { agent, phase, workflow } from "@open-scaffold/core"
import { z } from "zod"

const myAgent = agent({
  name: "my-agent",
  model: "claude-sonnet-4-5",
  output: z.object({ result: z.string() }),
  prompt: (state) => `Process: ${state.input}`,
  update: (output, draft) => { draft.result = output.result }
})

export const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { input: "", result: "" },
  start: (input, draft) => { draft.input = input },
  phases: {
    work: { run: myAgent, next: "done" },
    done: phase.terminal()
  }
})
```

**Execution:**
```typescript
// main.ts
import { execute, run } from "@open-scaffold/core"
import { myWorkflow } from "./workflow"

// Async iterator API
for await (const event of execute(myWorkflow, config)) {
  console.log(event.name, event.payload)
}

// Or Promise API with observer
const result = await run(myWorkflow, {
  input: "Hello",
  observer: {
    stateChanged: (state) => console.log("State:", state),
    phaseChanged: (phase) => console.log("Phase:", phase),
  }
})
```

**Client side (your UI):**
```typescript
// client/app.tsx
import { useEvents, useWorkflowState, useSendInput, WorkflowProvider } from "@open-scaffold/client"

function MyComponent() {
  const events = useEvents()
  const state = useWorkflowState<MyState>()
  const sendInput = useSendInput()

  return (
    <div>
      <StateView state={state} />
      <button onClick={() => sendInput({ type: "user:click" })}>
        Click
      </button>
    </div>
  )
}

function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <MyComponent />
    </WorkflowProvider>
  )
}
```

---

## Protocol

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sessions` | Create new session, returns sessionId |
| GET | `/sessions/:id/events` | SSE stream of events |
| GET | `/sessions/:id/state` | Current state snapshot |
| POST | `/sessions/:id/input` | Send user input event |
| DELETE | `/sessions/:id` | End session |

### Event Stream (SSE)

```
GET /sessions/abc123/events

event: workflow:started
data: {"sessionId":"abc123","workflowName":"my-workflow"}

event: agent:started
data: {"agentName":"planner","triggeredBy":"user:input"}

event: text:delta
data: {"delta":"Let me ","agentName":"planner"}

event: text:delta
data: {"delta":"think about this...","agentName":"planner"}

event: agent:completed
data: {"agentName":"planner","outcome":"success"}
```

### Input (POST)

```
POST /sessions/abc123/input
Content-Type: application/json

{
  "type": "user:approval",
  "payload": { "approved": true }
}
```

---

## Services (Server Side)

All services follow the **abstract -> implementation** pattern.

| Service | Purpose | Pattern | Implementations |
|---------|---------|---------|-----------------|
| `EventStoreLive` | Persist events (source of truth) | `Context.Tag` | LibSQL |
| `StateSnapshotStoreLive` | Persist state snapshots (speed up recovery) | `Context.Tag` | LibSQL |
| `StateCache<S>` | Derived typed state cache + subscriptions | Factory (not a Tag) | In-memory only |
| `EventBus` | Internal broadcast to SSE | `Context.Tag` | Memory (always) |
| `ProviderRecorderLive` | Record/replay provider responses | `Context.Tag` | LibSQL |
| `ProviderModeContext` | Track live vs playback mode | `Context.Tag` | FiberRef |
| `AgentProvider` | LLM execution (SDK wrapper) | `Context.Tag` | Anthropic |
| `AgentService` | Run an agent and emit AgentEvents | `Context.Tag` | Core implementation |
| `WorkflowRuntime` | Orchestrate agents + phases | `Context.Tag` | Core implementation |

**Notes:**
- **StateCache<S>** is always in-memory because state is derived from events. If lost, replay events (+ optional snapshots) to rebuild.
- **StateSnapshotStoreLive** persists periodic snapshots to avoid O(n) replay for large sessions.
- **EventBus** is always in-memory because it's ephemeral (live broadcast only).
- **EventStoreLive** uses LibSQL for persistence. Same pattern everywhere.
- **AgentProvider** runs in two modes: `live` (calls API, auto-records) or `playback` (replays recordings).

---

## Client Contract

The abstract interface any client must implement:

```typescript
interface WorkflowClient {
  // Connect to a session
  connect(sessionId: string): Promise<void>

  // Create new session
  createSession(input: string): Promise<string>  // returns sessionId

  // Event stream
  events(): AsyncIterable<AnyEvent>

  // Current state
  getState<S>(): Promise<S>

  // Send input
  sendInput(event: AnyEvent): Promise<void>

  // Disconnect
  disconnect(): Promise<void>
}
```

The SDK provides:
- `HttpClient` -- connects via HTTP/SSE
- `TestClient` -- utilities for test assertions

React bindings in `@open-scaffold/client` use the client contract internally.

**Note:** The client does NOT record. Recording happens server-side in the EventStore. The client is intentionally "dumb" -- it connects, consumes events, and renders. The server is the single source of truth.

---

## Built-in Events

Emitted automatically by the server:

```typescript
// Workflow lifecycle
"workflow:started"    // { workflowName, sessionId, input }
"workflow:completed"  // { sessionId, finalState }
"workflow:error"      // { sessionId, error }

// Session
"session:created"     // { sessionId }
"session:resumed"     // { sessionId, fromPosition }

// Agent execution
"agent:started"       // { agentName, triggeredBy }
"agent:completed"     // { agentName, outcome }

// Streaming
"text:delta"          // { delta, agentName }
"text:complete"       // { fullText, agentName }
"thinking:delta"      // { delta, agentName }
"thinking:complete"   // { thinking, agentName }

// Tools
"tool:called"         // { toolName, toolId, input }
"tool:result"         // { toolId, output, isError }

// User (sent from client)
"user:input"          // { text }
```

---

## Recording & Playback

Recording is **server-side only**. Two modes, one database.

### Two-Mode System

| Mode | Behavior |
|------|----------|
| `live` | Calls real Agent SDK, automatically records responses |
| `playback` | Replays recorded responses, no SDK calls |

### Event Recording

All events are automatically persisted to the EventStore (via `EventStoreLive`). No special "recording mode" needed -- every session is recorded by default.

### Recording Storage

All recordings live in the same LibSQL database as events:
- Events in `events` table
- Provider recordings in `provider_cache` table
- State snapshots in `state_snapshots` table

No separate fixture database. One database, multiple tables.

---

## File Structure

```
packages/
+-- core/                    # @open-scaffold/core
|   +-- src/
|       +-- Domain/          # Types, branded IDs, errors, context
|       +-- Services/        # Service Tags (EventStoreLive, StateSnapshotStoreLive, etc.)
|       +-- Programs/        # Effect programs (workflow execution, agent streaming, etc.)
|       +-- Layers/          # Logger configs
|
+-- server/                  # @open-scaffold/server
|   +-- src/
|       +-- OpenScaffold.ts  # Public facade
|       +-- http/
|       |   +-- Server.ts    # HTTP server
|       |   +-- Routes.ts    # HTTP endpoints
|       +-- provider/        # AnthropicProvider
|       +-- store/           # LibSQL stores + migrations
|
+-- client/                  # @open-scaffold/client
    +-- src/
        +-- Contract.ts      # WorkflowClient interface
        +-- http/
        |   +-- HttpClient.ts
        +-- react/           # WorkflowProvider + 17 hooks
        +-- index.ts
```

---

## Implementation Status

All core features are complete:
- Server with HTTP/SSE endpoints
- Client with HTTP client and React hooks
- Two-mode recording system (live/playback)
- VCR controls (pause/resume/fork)
- Human-in-the-Loop integration
