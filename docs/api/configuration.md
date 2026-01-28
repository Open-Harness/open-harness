# Configuration Reference

## Server Configuration

### `OpenScaffold.create(config)`

Create an OpenScaffold instance for running workflows.

```typescript
import { OpenScaffold } from "@open-scaffold/server"

const scaffold = OpenScaffold.create({
  database: "./data/app.db",
  mode: "live"
})
```

#### `OpenScaffoldConfig`

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `database` | `string` | Yes | - | Path to SQLite database file |
| `mode` | `"live" \| "playback"` | Yes | - | Provider caching mode |

**Mode Options**:

| Mode | Behavior |
|------|----------|
| `"live"` | Call AI APIs and cache responses (including errors) |
| `"playback"` | Use cached responses, never call APIs |

**Database Connection Strings**:

```typescript
// Local SQLite file
{ database: "./data/app.db" }
{ database: "file:./data/app.db" }

// In-memory (for testing)
{ database: ":memory:" }

// Turso (remote SQLite)
{ database: "libsql://your-db.turso.io?authToken=your-token" }
```

---

### `scaffold.createServer(options)`

Create an HTTP server for a workflow.

```typescript
const server = scaffold.createServer({
  workflow: myWorkflow,
  port: 3001
})
```

#### `ServerOptions`

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `workflow` | Workflow definition | Yes | - | The workflow to serve |
| `host` | `string` | No | `"127.0.0.1"` | Server bind address |
| `port` | `number` | No | `42069` | Server port |

---

### Server Methods

#### `server.start()`

Start the HTTP server.

```typescript
await server.start()
console.log("Server running")
```

**Returns**: `Promise<void>` - Resolves when server is listening.

---

#### `server.stop()`

Stop the server gracefully.

```typescript
await server.stop()
```

**Returns**: `Promise<void>` - Resolves when server has stopped.

---

#### `server.address()`

Get the server's bound address.

```typescript
const { host, port } = await server.address()
console.log(`http://${host}:${port}`)
```

**Returns**: `Promise<{ host: string; port: number }>`

---

### Instance Methods

#### `scaffold.mode`

Get the provider mode.

```typescript
const mode = scaffold.mode  // "live" | "playback"
```

---

#### `scaffold.database`

Get the database path.

```typescript
const db = scaffold.database  // "./data/app.db"
```

---

#### `scaffold.getProviderRecorder()`

Get the provider recorder service (advanced use).

```typescript
const recorder = await scaffold.getProviderRecorder()
```

**Returns**: `Promise<ProviderRecorderService>` - For inspecting/managing cached API responses.

---

#### `scaffold.dispose()`

Release all resources.

```typescript
await scaffold.dispose()
```

**Returns**: `Promise<void>` - Call when shutting down.

---

## Client Configuration

### `WorkflowProvider`

React provider component that connects to the server.

```tsx
import { WorkflowProvider } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider
      url="http://localhost:3001"
      sessionId="optional-session-id"
    >
      <YourApp />
    </WorkflowProvider>
  )
}
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | Yes | Server URL |
| `sessionId` | `string` | No | Initial session to connect to |
| `children` | `ReactNode` | Yes | Child components |

---

### `HttpClient`

Low-level client for non-React usage.

```typescript
import { HttpClient } from "@open-scaffold/client"

const client = HttpClient({ url: "http://localhost:3001" })
await client.createSession("Hello")
```

#### `ClientConfig`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | `string` | Yes | Server URL |
| `sessionId` | `string` | No | Initial session ID |
| `headers` | `Record<string, string>` | No | Custom HTTP headers |

---

## Workflow Configuration

### `workflow(config)`

Create a workflow definition with phases.

```typescript
import { agent, phase, workflow } from "@open-scaffold/core"
import { z } from "zod"

const assistant = agent({
  name: "assistant",
  model: "claude-haiku-4-5",
  output: z.object({ response: z.string() }),
  prompt: (state) => `Respond to: ${state.input}`,
  update: (output, draft) => { draft.response = output.response }
})

const chatWorkflow = workflow({
  name: "chat",
  initialState: { input: "", response: "" },
  start: (input, draft) => { draft.input = input },
  phases: {
    respond: { run: assistant, next: "done" },
    done: phase.terminal()
  }
})
```

#### `WorkflowConfig<S>`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Workflow identifier |
| `initialState` | `S` | Yes | Initial state value |
| `start` | `(input, draft) => void` | Yes | Initialize state from input |
| `phases` | `Record<string, PhaseConfig>` | Yes | Phase definitions |

---

## Agent Configuration

### `agent(config)`

Create an AI agent.

```typescript
import { agent } from "@open-scaffold/core"
import { z } from "zod"

const myAgent = agent({
  name: "assistant",
  model: "claude-haiku-4-5",
  output: z.object({ result: z.string() }),
  prompt: (state) => `Process: ${state.input}`,
  update: (output, draft) => { draft.result = output.result }
})
```

#### `AgentConfig<S, O>`

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | `string` | Yes | - | Agent identifier |
| `model` | `string` | Yes | - | Model identifier |
| `output` | `z.ZodType<O>` | Yes | - | Output schema (Zod) |
| `prompt` | `(state: S) => string` | Yes | - | Prompt builder from state |
| `update` | `(output: O, draft: S) => void` | Yes | - | State update function |

**Model Options**:

| Model | Description |
|-------|-------------|
| `claude-haiku-4-5` | Fast, cost-effective (recommended for demos) |
| `claude-sonnet-4-5` | Balanced performance |
| `claude-opus-4-5` | Most capable |

---

## Phase Configuration

### `phase.terminal()`

Create a terminal phase that ends the workflow.

```typescript
import { phase } from "@open-scaffold/core"

const myWorkflow = workflow({
  // ...
  phases: {
    work: { run: myAgent, next: "done" },
    done: phase.terminal()
  }
})
```

---

## Execution APIs

### `execute(workflow, config)`

Async iterator API for streaming workflow events.

```typescript
import { execute } from "@open-scaffold/core"

const execution = execute(myWorkflow, {
  input: "Hello",
  providers: { "claude-haiku-4-5": anthropicProvider }
})

for await (const event of execution) {
  console.log(event.name, event.payload)
}
```

### `run(workflow, options)`

Promise API with observer.

```typescript
import { run } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Hello",
  observer: {
    stateChanged: (state) => console.log("State:", state),
    phaseChanged: (phase) => console.log("Phase:", phase),
  }
})
```

#### `WorkflowObserver<S>`

| Callback | Type | Description |
|----------|------|-------------|
| `stateChanged` | `(state: S) => void` | Called when state updates |
| `phaseChanged` | `(phase: string) => void` | Called when phase transitions |
| `eventEmitted` | `(event: AnyEvent) => void` | Called for each event |

---

## Environment Variables

Open Scaffold uses environment variables for sensitive configuration:

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes (for live mode) |

**Note**: If you have an Anthropic subscription, the SDK handles authentication automatically without needing `ANTHROPIC_API_KEY`.

---

## Complete Example

```typescript
// server.ts
import { OpenScaffold } from "@open-scaffold/server"
import { agent, phase, workflow } from "@open-scaffold/core"
import { z } from "zod"

// Define agent
const assistant = agent({
  name: "assistant",
  model: "claude-haiku-4-5",
  output: z.object({ message: z.string() }),
  prompt: (state) => `Respond to: ${state.input}`,
  update: (output, draft) => {
    draft.messages.push(output.message)
  }
})

// Define workflow
const chatWorkflow = workflow({
  name: "chat",
  initialState: { input: "", messages: [] as string[] },
  start: (input, draft) => { draft.input = input },
  phases: {
    respond: { run: assistant, next: "done" },
    done: phase.terminal()
  }
})

// Start server
const scaffold = OpenScaffold.create({
  database: process.env.DATABASE_URL ?? "./data/chat.db",
  mode: process.env.NODE_ENV === "test" ? "playback" : "live"
})

const server = scaffold.createServer({
  workflow: chatWorkflow,
  port: Number(process.env.PORT ?? 3001)
})

server.start().then(() => {
  console.log("Chat server running")
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  await server.stop()
  await scaffold.dispose()
})
```
