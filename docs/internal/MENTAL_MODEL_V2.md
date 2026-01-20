# Open Harness Mental Model v2

> **The idea:** A workflow is an event log. AI agents emit events. Handlers react. You can rewind and replay like a tape.

---

## The Core Insight

Everything is an event.

- User input? Event.
- LLM response? Event.
- Task complete? Event.
- Error occurred? Event.

Events flow through the system. Handlers react. State changes. More events flow. The event log is your single source of truth—for execution, debugging, and replay.

---

## Six Concepts

### 1. Event

An immutable fact that something happened.

```typescript
type Event<T> = {
  id: string;           // Unique identifier
  name: string;         // What happened: "task:completed"
  payload: T;           // The data
  timestamp: string;    // When it happened
  causedBy?: string;    // Which event triggered this (debugging)
};
```

Events are **data**. They carry meaning, not behavior. They don't know how to display themselves or what should happen when they arrive.

**Naming convention:**
- Past tense for facts: `"task:completed"`, `"plan:created"`
- Present tense for streaming: `"text:delta"`, `"tool:calling"`

---

### 2. State

Your workflow's data. A plain object.

```typescript
type WorkflowState = {
  tasks: Task[];
  currentPhase: "planning" | "executing" | "reviewing";
  completed: boolean;
};
```

State is the **single source of truth**. Everything else is derived from the event log.

---

### 3. Handler

A pure function: Event + State → State + Events

```typescript
type Handler<S, T> = (
  event: Event<T>,
  state: S
) => {
  state: S;
  events: Event[];
};
```

Handlers are where your logic lives:
- Update state based on the event
- Decide what happens next (emit more events)
- Keep it simple: one handler per event type

**Handlers don't:**
- Call APIs
- Do I/O
- Know about other handlers
- Access anything outside their inputs

---

### 4. Agent

An AI actor. Agents activate on certain events, call an LLM, and emit events based on the result.

```typescript
type Agent = {
  name: string;
  activatesOn: string[];              // Event names that wake this agent
  prompt: (state, event) => string;   // What to send to the LLM
  emits: string[];                    // Event types this agent produces
};
```

From the workflow's perspective, an agent is just another event source. The LLM call is an implementation detail.

**The key insight:** Agents don't update state directly. They emit events. Handlers update state.

---

### 5. Renderer

Transforms events into output.

```typescript
type Renderer = {
  name: string;
  render: (event: Event) => Output | null;
};
```

Renderers are **pure observers**:
- See events as they flow
- Transform them to output (terminal, logs, web)
- Cannot modify events or state
- Cannot emit new events

Each context defines its own rendering:

```typescript
// Terminal renderer
{ "task:completed": (e) => `✓ ${e.payload.title}` }

// Web renderer
{ "task:completed": (e) => <TaskComplete task={e.payload} /> }

// Log renderer
{ "task:completed": (e) => logger.info({ task: e.payload }) }
```

---

### 6. Store

Where events live. SQLite by default.

```typescript
interface EventStore {
  append(event: Event): Promise<void>;
  events(sessionId: string): Promise<Event[]>;
  snapshot(sessionId: string, index: number): Promise<State>;
}
```

The store enables:
- **Recording:** Append events as they happen
- **Replay:** Read events back and re-execute handlers
- **Snapshotting:** Derive state at any point in history
- **Debugging:** Query what happened and why

**Default: SQLite.** Zero config, durable, single file, fast enough for any scale.

---

## The Loop

```
┌─────────────────────────────────────────────┐
│                                             │
│   Event                                     │
│     │                                       │
│     ├──────────────────┐                    │
│     ▼                  ▼                    │
│   Handler           Renderers               │
│     │                  │                    │
│     ▼                  ▼                    │
│   State + Events     Output                 │
│     │                                       │
│     └──────────────────────────────┐        │
│                                    ▼        │
│                              Next Event     │
│                                             │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│           Store (SQLite)                    │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│                                             │
└─────────────────────────────────────────────┘
```

That's the entire runtime. Events in, state changes, events out, render to output, persist to store.

---

## Recording & Replay: The Tape

Since everything is events, recording is trivial:

```
Record mode:  Event stream → Store
Replay mode:  Store → Event stream
```

Same handlers, same state transitions, same renderers. No LLM calls in replay—events come from the recording instead.

### The Tape API

A recorded session is a **tape**. You can control it like a VCR:

```typescript
// Record a session
const session = await workflow.run({
  record: true,
  sessionId: "my-session",
});

// Later: load the tape
const tape = await workflow.load("my-session");

// VCR controls
await tape.rewind();              // Go to start
await tape.stepTo(15);            // Jump to event 15
await tape.step();                // Forward one event
await tape.stepBack();            // Back one event
await tape.play();                // Play from current position
await tape.playTo(30);            // Play to event 30

// Inspect state at any point
const stateAt15 = tape.state;     // Current state
const eventAt15 = tape.current;   // Current event
const history = tape.events;      // All events
const position = tape.position;   // Current position (0-indexed)
```

### Snapshot Debugging

Jump to any point in history and inspect:

```typescript
const tape = await workflow.load("buggy-session");

// Find where things went wrong
const events = tape.events;
const errorEvent = events.findIndex(e => e.name === "error:occurred");

// Jump to just before the error
await tape.stepTo(errorEvent - 1);

// Inspect state
console.log(tape.state);  // What was state before error?
console.log(tape.current); // What event triggered it?
```

---

## The Developer Experience

### Defining Events

```typescript
import { defineEvent } from "@open-harness/core";
import { z } from "zod";

// Type-safe event definitions
const TaskCompleted = defineEvent("task:completed", z.object({
  taskId: z.string(),
  outcome: z.enum(["success", "failure", "partial"]),
  summary: z.string(),
}));

const PlanCreated = defineEvent("plan:created", z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })),
}));
```

### Defining Handlers

```typescript
import { defineHandler } from "@open-harness/core";

const handlers = {
  [TaskCompleted.name]: defineHandler(TaskCompleted, (event, state) => {
    const updatedTasks = state.tasks.map(t =>
      t.id === event.payload.taskId
        ? { ...t, status: event.payload.outcome }
        : t
    );

    const allDone = updatedTasks.every(t => t.status === "success");

    return {
      state: { ...state, tasks: updatedTasks },
      events: allDone
        ? [{ name: "workflow:complete", payload: {} }]
        : [{ name: "task:next", payload: {} }],
    };
  }),
};
```

### Defining Agents

```typescript
import { agent } from "@open-harness/core";

const planner = agent({
  name: "planner",
  activatesOn: ["workflow:start"],
  emits: ["plan:created"],

  prompt: (state) => `
    Create a plan for: ${state.goal}

    Output a list of tasks with IDs and titles.
  `,

  // Optional: guard condition
  when: (state) => state.goal !== null,

  // Optional: output schema for structured extraction
  outputSchema: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
    })),
  }),
});

const executor = agent({
  name: "executor",
  activatesOn: ["task:next"],
  emits: ["task:completed"],

  prompt: (state, event) => {
    const currentTask = state.tasks.find(t => t.status === "pending");
    return `Execute task: ${currentTask.title}`;
  },
});
```

### Creating a Workflow

```typescript
import { createWorkflow } from "@open-harness/core";
import { sqlite } from "@open-harness/store-sqlite";

const workflow = createWorkflow({
  // Initial state
  state: {
    goal: null,
    tasks: [],
    phase: "planning",
  },

  // Event handlers
  handlers,

  // AI agents
  agents: { planner, executor },

  // When to stop
  until: (state) => state.phase === "complete",

  // Storage (SQLite by default)
  store: sqlite("./workflow.db"),
});
```

### Running It

```typescript
// Live mode - calls real LLM
const result = await workflow.run({
  input: { goal: "Build a todo app" },
});

// Record mode - saves all events
const result = await workflow.run({
  input: { goal: "Build a todo app" },
  record: true,
  sessionId: "session-001",
});

// Replay mode - no LLM calls
const tape = await workflow.load("session-001");
await tape.play();
```

### Custom Renderers

```typescript
import { createRenderer } from "@open-harness/core";

const terminalRenderer = createRenderer({
  name: "terminal",

  renderers: {
    "task:completed": (event) => {
      const icon = event.payload.outcome === "success" ? "✓" : "✗";
      return `${icon} ${event.payload.summary}`;
    },

    "text:delta": (event) => {
      process.stdout.write(event.payload.text);
      return null; // Don't add newline
    },

    "error:*": (event) => {
      return `ERROR: ${event.payload.message}`;
    },
  },
});

// Use it
await workflow.run({
  renderers: [terminalRenderer],
});
```

---

## What This Enables

### Testability
Mock nothing. Record once, replay forever. Your tests use real event streams.

```typescript
test("workflow completes all tasks", async () => {
  const tape = await workflow.load("recordings/happy-path");
  await tape.play();

  expect(tape.state.tasks.every(t => t.status === "success")).toBe(true);
  expect(tape.events.some(e => e.name === "workflow:complete")).toBe(true);
});
```

### Debuggability
Every state change has a cause (an event). Trace any bug back to its origin.

```typescript
// Step through execution
const tape = await workflow.load("buggy-session");
while (tape.position < tape.events.length) {
  console.log(`Event ${tape.position}:`, tape.current.name);
  console.log(`State:`, tape.state);
  await tape.step();
}
```

### Composability
Workflows are just handlers + agents. Combine them freely.

### Portability
Same workflow runs in CLI, web, or headless. Only renderers change.

---

## React Integration

Open Harness provides batteries-included React hooks and components. The API is designed to feel familiar to Vercel AI SDK users while exposing our unique capabilities.

### The Core Hook: `useWorkflow`

```typescript
import { useWorkflow } from "@open-harness/react";

function ChatApp() {
  const {
    // === AI SDK Compatible (the 80% case) ===
    messages,       // Message[] - projected from events
    input,          // string - current input value
    setInput,       // (value: string) => void
    handleSubmit,   // (e?: FormEvent) => void
    isLoading,      // boolean - is workflow running?
    error,          // Error | null

    // === Our Unique Value ===
    events,         // Event[] - raw event stream
    state,          // S - current workflow state

    // === Tape Controls ===
    tape: {
      isRecording,  // boolean
      isReplaying,  // boolean
      position,     // number - current event index
      length,       // number - total events
      rewind,       // () => void
      step,         // () => void
      stepBack,     // () => void
      stepTo,       // (index: number) => void
      play,         // () => void
      pause,        // () => void
    },
  } = useWorkflow(workflow, {
    sessionId: "user-123",
    record: true,
  });

  return (
    <div>
      {messages.map(m => (
        <MessageBubble key={m.id} message={m} />
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### Message Projection

Events are the source of truth. Messages are a **projection** optimized for chat UIs.

| Event Type | Message Mapping |
|------------|-----------------|
| `user:input` | `{ role: 'user', content: '...' }` |
| `text:delta` | Appends to current assistant message |
| `text:complete` | Finalizes assistant message |
| `tool:called` | Adds to `message.toolInvocations[]` |
| `tool:result` | Updates `toolInvocations[].result` |
| `agent:started` | New message with agent's `name` |
| `error:occurred` | `{ role: 'data', type: 'error' }` |

The `Message` type is AI SDK compatible:

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  name?: string;                    // Agent name for multi-agent
  toolInvocations?: ToolInvocation[];

  // Our extension: link back to source events
  _events?: Event[];
}

interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: 'pending' | 'result' | 'error';
}
```

### Multi-Agent UI

Each agent gets a `name` on its messages. Render them differently:

```typescript
function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return <UserBubble>{message.content}</UserBubble>;
  }

  if (message.role === 'assistant') {
    // Multi-agent: use name to differentiate
    return (
      <AgentBubble agent={message.name}>
        <AgentAvatar name={message.name} />
        <AgentContent>
          {message.content}
          {message.toolInvocations?.map(tool => (
            <ToolCallCard key={tool.id} tool={tool} />
          ))}
        </AgentContent>
      </AgentBubble>
    );
  }

  return null;
}
```

Example message stream from a multi-agent workflow:

```typescript
messages = [
  { id: '1', role: 'user', content: 'Build me a trading bot' },
  { id: '2', role: 'assistant', name: 'planner', content: 'Creating a plan...' },
  { id: '3', role: 'assistant', name: 'analyst', content: 'Analyzing market data...' },
  { id: '4', role: 'assistant', name: 'executor', content: 'Executing trades...' },
  { id: '5', role: 'assistant', name: 'reviewer', content: 'All tasks complete.' },
]
```

### Tape Controls in React

The killer feature: time-travel debugging in your UI.

```typescript
function TapeControls() {
  const { tape, messages } = useWorkflow(workflow);

  if (!tape.isRecording && !tape.isReplaying) {
    return null;
  }

  return (
    <div className="tape-controls">
      <button onClick={tape.rewind} title="Rewind">⏮</button>
      <button onClick={tape.stepBack} title="Step Back">⏪</button>
      <button onClick={tape.isReplaying ? tape.pause : tape.play}>
        {tape.isReplaying ? '⏸' : '▶'}
      </button>
      <button onClick={tape.step} title="Step Forward">⏩</button>

      <input
        type="range"
        min={0}
        max={tape.length - 1}
        value={tape.position}
        onChange={e => tape.stepTo(Number(e.target.value))}
      />

      <span>{tape.position} / {tape.length}</span>
    </div>
  );
}
```

### Pre-Built Components

Three levels of abstraction:

#### Level 1: Zero Config (Just Works)

```typescript
import { WorkflowChat } from "@open-harness/react";

function App() {
  return <WorkflowChat workflow={workflow} />;
}
```

#### Level 2: Customizable Components

```typescript
import { WorkflowChat } from "@open-harness/react";

function App() {
  return (
    <WorkflowChat
      workflow={workflow}
      components={{
        UserMessage: MyUserBubble,
        AssistantMessage: MyAgentBubble,
        ToolCall: MyToolCard,
        TapeControls: MyTapeControls,
        Input: MyCustomInput,
      }}
      showTapeControls={true}
    />
  );
}
```

#### Level 3: Full Control (Headless)

```typescript
import {
  WorkflowProvider,
  useWorkflow,
  MessageList,
  ChatInput,
  TapeControls,
} from "@open-harness/react";

function App() {
  return (
    <WorkflowProvider workflow={workflow}>
      <div className="my-custom-layout">
        <Sidebar>
          <SessionList />
        </Sidebar>
        <Main>
          <MessageList renderMessage={MyMessage} />
          <TapeControls />
          <ChatInput />
        </Main>
        <Inspector>
          <EventStream />
          <StateViewer />
        </Inspector>
      </div>
    </WorkflowProvider>
  );
}
```

### Power User: Raw Events

For custom UIs that need more than chat, access raw events:

```typescript
function EventInspector() {
  const { events, state } = useWorkflow(workflow);

  return (
    <div className="inspector">
      <h3>Events ({events.length})</h3>
      {events.map(event => (
        <div key={event.id} className={`event event-${event.name.split(':')[0]}`}>
          <span className="name">{event.name}</span>
          <span className="time">{event.timestamp}</span>
          <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      ))}

      <h3>State</h3>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
```

### Server Integration

For Next.js and other frameworks, we provide server-side utilities:

```typescript
// app/api/workflow/route.ts
import { createWorkflowHandler } from "@open-harness/react/server";
import { workflow } from "@/lib/workflow";

export const POST = createWorkflowHandler(workflow);
```

```typescript
// Client connects to server
const { messages, ... } = useWorkflow(workflow, {
  api: "/api/workflow",
  sessionId: "user-123",
});
```

---

## Storage Options

### SQLite (Default)

```typescript
import { sqlite } from "@open-harness/store-sqlite";

const workflow = createWorkflow({
  store: sqlite("./workflow.db"),
  // ...
});
```

SQLite is the default because:
- Zero configuration
- Single file, portable
- Durable across restarts
- SQL queries for debugging
- Fast enough for almost any scale

### Memory (For Tests)

```typescript
import { memory } from "@open-harness/store-memory";

const workflow = createWorkflow({
  store: memory(),
  // ...
});
```

### Custom Store

Implement the `EventStore` interface:

```typescript
interface EventStore {
  append(sessionId: string, event: Event): Promise<void>;
  events(sessionId: string): Promise<Event[]>;
  sessions(): Promise<string[]>;
  clear(sessionId: string): Promise<void>;
}
```

---

## Non-Goals

Things Open Harness explicitly does NOT do:

- **Scheduling** - Use cron, queues, whatever you have
- **Auth** - That's your app's concern
- **UI framework** - Renderers output data, you render it
- **Distributed execution** - Single process, local store

Open Harness is the **workflow engine**. Everything else is your stack.

---

## Summary

### Core Concepts

| Concept | What it is | What it does |
|---------|------------|--------------|
| Event | Immutable fact | Carries what happened |
| State | Plain object | Single source of truth |
| Handler | Pure function | Reacts to events, updates state |
| Agent | AI actor | Calls LLM, emits events |
| Renderer | Observer | Transforms events to output |
| Store | Persistence | Holds the event log (SQLite default) |
| Tape | Recording | Enables rewind/step/replay |

### React Concepts

| Concept | What it is | What it does |
|---------|------------|--------------|
| `useWorkflow` | Core hook | Provides messages, events, state, tape |
| Message | Projection | Events collapsed into chat-friendly format |
| `WorkflowChat` | Component | Zero-config chat UI |
| `WorkflowProvider` | Context | Enables headless composition |
| Tape Controls | UI | Time-travel debugging in your app |

Six core concepts. One loop. Recording built in. AI SDK compatible React hooks. That's the mental model.

---

*Version: 2.2*
*Status: Greenfield design for Effect rewrite*
*Naming: Event-based (not Signal-based)*
*React: AI SDK compatible with Message projection*
