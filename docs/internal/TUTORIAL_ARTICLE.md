# Build Agentic Loops You Can Actually Debug

> **Technical Tutorial** — Step-by-step implementation guide for Open Harness
>
> Looking for the "why" before the "how"? Read [I Spent 4 Hours Debugging a 15-Agent Workflow](./LAUNCH_POST.md) first.

---

## Why This Matters

Debugging multi-agent workflows gets exponentially harder as you add agents:

| Agents | Debugging Difficulty |
|--------|---------------------|
| 2 | Console.log works |
| 5 | Hours of investigation |
| 15+ | Impossible without proper tooling |

Open Harness gives you time-travel debugging: load any recorded session, jump to any event, see exact state. No re-running. No adding logs. This tutorial shows you how to build a workflow from scratch.

---

## The Pattern Everyone's Using

If you've built anything with AI agents recently, you've written this loop:

```typescript
while (!done) {
  const plan = await llm("What should I do next?");
  const result = await execute(plan);
  done = await verify(result);
}
```

It's elegant. It works. Claude Code uses it. Cursor uses it. Every coding agent uses some version of this.

**The pattern isn't the problem.** The problem is when something goes wrong at 3am and you have no idea what happened. Or when you want to test your agent without burning through API credits. Or when you need to show someone exactly what the agent did.

Open Harness gives you **the same pattern** with observability, recording, and replay built in.

---

## What We're Building

A simple two-agent system:

1. **Planner** - Takes a goal, creates a task list
2. **Executor** - Works through each task

This is the minimal compelling example. The same pattern scales to complex multi-agent systems, but let's start simple.

By the end, you'll have:
- A working agentic loop
- Full recording of every step
- Replay for testing (no API calls)
- Time-travel debugging (jump to any point)
- A React UI to watch it run

---

## The Traditional Way

Here's how you'd typically build this:

```typescript
// The classic approach
async function runAgent(goal: string) {
  console.log("Starting agent...");

  // Plan
  const plan = await claude.messages.create({
    messages: [{ role: "user", content: `Create a plan for: ${goal}` }],
  });
  console.log("Plan created:", plan.content);

  const tasks = JSON.parse(plan.content);

  // Execute each task
  for (const task of tasks) {
    console.log(`Executing: ${task.title}`);

    const result = await claude.messages.create({
      messages: [{ role: "user", content: `Execute: ${task.title}` }],
    });
    console.log("Result:", result.content);
  }

  console.log("Done!");
}
```

This works. But:
- **No replay** - Every test run costs money
- **No history** - Console logs disappear
- **No debugging** - When it fails, you start from scratch
- **No visibility** - Can't see intermediate state

---

## The Open Harness Way

Same pattern, different primitives:

### Step 1: Define Your Events

Instead of console.log, define **events** - typed facts about what happened:

```typescript
import { defineEvent } from "@open-harness/core";
import { z } from "zod";

// What the planner produces
const PlanCreated = defineEvent("plan:created", z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  })),
}));

// Task lifecycle
const TaskStarted = defineEvent("task:started", z.object({
  taskId: z.string(),
  title: z.string(),
}));

const TaskCompleted = defineEvent("task:completed", z.object({
  taskId: z.string(),
  outcome: z.enum(["success", "failure"]),
  summary: z.string(),
}));

// Workflow end
const WorkflowComplete = defineEvent("workflow:complete", z.object({
  totalTasks: z.number(),
  successful: z.number(),
}));
```

**Why events?** Because they're:
- **Typed** - Schema validation catches bugs early
- **Immutable** - Facts don't change
- **Replayable** - The event log is your single source of truth

### Step 2: Define Your State

Plain TypeScript. Nothing fancy:

```typescript
interface WorkflowState {
  goal: string | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: "pending" | "running" | "success" | "failure";
  }>;
  phase: "idle" | "planning" | "executing" | "complete";
}

const initialState: WorkflowState = {
  goal: null,
  tasks: [],
  phase: "idle",
};
```

### Step 3: Define Handlers

Handlers are pure functions: **Event + State → New State + New Events**

```typescript
import { defineHandler } from "@open-harness/core";

const handlers = {
  // When plan is created, store tasks and start execution
  [PlanCreated.name]: defineHandler(PlanCreated, (event, state) => {
    const tasks = event.payload.tasks.map(t => ({
      ...t,
      status: "pending" as const,
    }));

    // Find first task to start
    const firstTask = tasks[0];

    return {
      state: { ...state, tasks, phase: "executing" },
      events: firstTask
        ? [{ name: "task:started", payload: { taskId: firstTask.id, title: firstTask.title } }]
        : [{ name: "workflow:complete", payload: { totalTasks: 0, successful: 0 } }],
    };
  }),

  // When task completes, update status and start next
  [TaskCompleted.name]: defineHandler(TaskCompleted, (event, state) => {
    const tasks = state.tasks.map(t =>
      t.id === event.payload.taskId
        ? { ...t, status: event.payload.outcome }
        : t
    );

    // Find next pending task
    const nextTask = tasks.find(t => t.status === "pending");

    if (nextTask) {
      return {
        state: { ...state, tasks },
        events: [{ name: "task:started", payload: { taskId: nextTask.id, title: nextTask.title } }],
      };
    }

    // All done
    const successful = tasks.filter(t => t.status === "success").length;
    return {
      state: { ...state, tasks, phase: "complete" },
      events: [{ name: "workflow:complete", payload: { totalTasks: tasks.length, successful } }],
    };
  }),
};
```

**Key insight:** Handlers don't call the LLM. They just react to events and update state. The LLM calls happen in agents.

### Step 4: Define Agents

Agents are the AI part. They activate on specific events, call the LLM, and emit new events:

```typescript
import { agent } from "@open-harness/core";

const planner = agent({
  name: "planner",
  activatesOn: ["workflow:start"],
  emits: ["plan:created"],

  prompt: (state) => `
    You are a task planner. Create a plan for: ${state.goal}

    Output a JSON array of tasks:
    [{ "id": "1", "title": "...", "description": "..." }, ...]

    Keep it to 3-5 tasks maximum.
  `,

  outputSchema: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
    })),
  }),
});

const executor = agent({
  name: "executor",
  activatesOn: ["task:started"],
  emits: ["task:completed"],

  prompt: (state, event) => {
    const task = state.tasks.find(t => t.id === event.payload.taskId);
    return `
      Execute this task: ${task?.title}

      Description: ${task?.description}

      Respond with a brief summary of what you did.
    `;
  },

  // Transform LLM output to event
  onOutput: (output, event) => ({
    name: "task:completed",
    payload: {
      taskId: event.payload.taskId,
      outcome: "success",
      summary: output,
    },
  }),
});
```

### Step 5: Create the Workflow

Wire it all together:

```typescript
import { createWorkflow } from "@open-harness/core";
import { sqlite } from "@open-harness/store-sqlite";

const workflow = createWorkflow({
  state: initialState,
  handlers,
  agents: { planner, executor },
  until: (state) => state.phase === "complete",
  store: sqlite("./workflow.db"),  // SQLite by default
});
```

### Step 6: Run It

```typescript
// Live execution with recording
const result = await workflow.run({
  input: { goal: "Build a REST API for a todo app" },
  record: true,
  sessionId: "session-001",
});

console.log("Final state:", result.state);
console.log("Events:", result.events.length);
```

---

## What You Get For Free

### 1. Full Event History

Every event is recorded:

```typescript
const tape = await workflow.load("session-001");

console.log(tape.events);
// [
//   { name: "workflow:start", payload: { goal: "Build a REST API..." } },
//   { name: "plan:created", payload: { tasks: [...] } },
//   { name: "task:started", payload: { taskId: "1", title: "..." } },
//   { name: "task:completed", payload: { taskId: "1", outcome: "success" } },
//   ...
// ]
```

### 2. Replay Without API Calls

Test your workflow for free:

```typescript
// In your test file
test("workflow completes all tasks", async () => {
  const tape = await workflow.load("recordings/happy-path");
  await tape.play();

  expect(tape.state.phase).toBe("complete");
  expect(tape.state.tasks.every(t => t.status === "success")).toBe(true);
});
```

No mocks. No API calls. Real event data.

### 3. Time-Travel Debugging

Jump to any point in the execution:

```typescript
const tape = await workflow.load("session-001");

// Something went wrong at event 15
await tape.stepTo(14);

// What was the state just before?
console.log(tape.state);
// { tasks: [...], phase: "executing" }

// What event caused the problem?
console.log(tape.events[15]);
// { name: "task:completed", payload: { outcome: "failure", ... } }
```

### 4. Step Through Execution

Debug like you debug code:

```typescript
const tape = await workflow.load("session-001");

while (tape.position < tape.events.length) {
  console.log(`\n--- Event ${tape.position} ---`);
  console.log("Event:", tape.current.name);
  console.log("State:", JSON.stringify(tape.state, null, 2));

  await tape.step();
}
```

---

## Add a React UI

The same events power your UI:

```typescript
import { useWorkflow } from "@open-harness/react";

function AgentDashboard() {
  const {
    messages,      // Chat-style view (AI SDK compatible)
    events,        // Raw events
    state,         // Current state
    isLoading,
    tape,          // Playback controls
  } = useWorkflow(workflow, {
    sessionId: "session-001",
    record: true,
  });

  return (
    <div className="dashboard">
      {/* Chat view */}
      <div className="chat">
        {messages.map(m => (
          <Message key={m.id} role={m.role} name={m.name}>
            {m.content}
          </Message>
        ))}
      </div>

      {/* Task progress */}
      <div className="tasks">
        {state.tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            status={task.status}
          />
        ))}
      </div>

      {/* Tape controls for debugging */}
      <div className="tape-controls">
        <button onClick={tape.rewind}>⏮</button>
        <button onClick={tape.stepBack}>⏪</button>
        <button onClick={tape.step}>⏩</button>
        <span>{tape.position} / {tape.events.length}</span>
      </div>
    </div>
  );
}
```

---

## Building Custom Components for Your Events

You've defined custom events (`plan:created`, `task:started`, `task:completed`). Now you need custom components to render them. Here's the full story.

### The Two Approaches

**Approach 1: State-Driven (Simpler)**

Use `state` from the hook. Your components render the current state, not individual events:

```typescript
function TaskList() {
  const { state } = useWorkflow(workflow);

  return (
    <div className="task-list">
      {state.tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const statusStyles = {
    pending: "bg-gray-100",
    running: "bg-blue-100 animate-pulse",
    success: "bg-green-100",
    failure: "bg-red-100",
  };

  return (
    <div className={`task-card ${statusStyles[task.status]}`}>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <span className="status">{task.status}</span>
    </div>
  );
}
```

**When to use:** When your UI is a reflection of current state (dashboards, progress views).

---

**Approach 2: Event-Driven (More Control)**

Use `events` from the hook. Your components render the event stream directly:

```typescript
function EventTimeline() {
  const { events } = useWorkflow(workflow);

  return (
    <div className="timeline">
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
```

**When to use:** When you want a log/timeline view, or need to show events that don't affect state.

---

### Building Event Components

For event-driven UIs, create a component for each event type:

```typescript
// components/events/PlanCreatedCard.tsx
import type { Event } from "@open-harness/core";
import type { PlanCreatedPayload } from "../events";

export function PlanCreatedCard({ event }: { event: Event<PlanCreatedPayload> }) {
  const { tasks } = event.payload;

  return (
    <div className="event-card plan-created">
      <div className="event-header">
        <span className="icon">📋</span>
        <span className="title">Plan Created</span>
        <span className="time">{formatTime(event.timestamp)}</span>
      </div>
      <div className="event-body">
        <p>{tasks.length} tasks planned:</p>
        <ul>
          {tasks.map(task => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

```typescript
// components/events/TaskStartedCard.tsx
export function TaskStartedCard({ event }: { event: Event<TaskStartedPayload> }) {
  return (
    <div className="event-card task-started">
      <div className="event-header">
        <span className="icon">▶️</span>
        <span className="title">Task Started</span>
      </div>
      <div className="event-body">
        <strong>{event.payload.title}</strong>
      </div>
    </div>
  );
}
```

```typescript
// components/events/TaskCompletedCard.tsx
export function TaskCompletedCard({ event }: { event: Event<TaskCompletedPayload> }) {
  const isSuccess = event.payload.outcome === "success";

  return (
    <div className={`event-card task-completed ${isSuccess ? "success" : "failure"}`}>
      <div className="event-header">
        <span className="icon">{isSuccess ? "✅" : "❌"}</span>
        <span className="title">Task {isSuccess ? "Completed" : "Failed"}</span>
      </div>
      <div className="event-body">
        <p>{event.payload.summary}</p>
      </div>
    </div>
  );
}
```

---

### The Event Router Pattern

Create a router component that maps event names to components:

```typescript
// components/EventCard.tsx
import { PlanCreatedCard } from "./events/PlanCreatedCard";
import { TaskStartedCard } from "./events/TaskStartedCard";
import { TaskCompletedCard } from "./events/TaskCompletedCard";
import { TextDeltaCard } from "./events/TextDeltaCard";
import { GenericEventCard } from "./events/GenericEventCard";

// Map event names to components
const eventComponents: Record<string, React.ComponentType<{ event: Event }>> = {
  "plan:created": PlanCreatedCard,
  "task:started": TaskStartedCard,
  "task:completed": TaskCompletedCard,
  "text:delta": TextDeltaCard,
  "workflow:complete": WorkflowCompleteCard,
};

export function EventCard({ event }: { event: Event }) {
  const Component = eventComponents[event.name] || GenericEventCard;
  return <Component event={event} />;
}
```

Now your timeline is clean:

```typescript
function EventTimeline() {
  const { events } = useWorkflow(workflow);

  return (
    <div className="timeline">
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
```

---

### Handling Streaming Text

LLM responses stream as `text:delta` events. Here's how to render them:

```typescript
// components/events/TextDeltaCard.tsx
export function TextDeltaCard({ event }: { event: Event<{ text: string }> }) {
  // Individual deltas are tiny - usually rendered inline
  return <span className="text-delta">{event.payload.text}</span>;
}
```

But usually you want to **accumulate** deltas into a single message. The `messages` projection does this automatically:

```typescript
function ChatView() {
  const { messages } = useWorkflow(workflow);

  return (
    <div className="chat">
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  // message.content already has accumulated text from all text:delta events
  return (
    <div className={`bubble ${message.role}`}>
      {message.name && <span className="agent-name">{message.name}</span>}
      <div className="content">{message.content}</div>
    </div>
  );
}
```

---

### Putting It All Together

Here's a complete dashboard with all the pieces:

```typescript
// app/dashboard/page.tsx
import { useWorkflow, WorkflowProvider } from "@open-harness/react";
import { workflow } from "@/lib/workflow";
import { EventCard } from "@/components/EventCard";
import { TaskCard } from "@/components/TaskCard";
import { TapeControls } from "@/components/TapeControls";
import { ChatInput } from "@/components/ChatInput";

export default function Dashboard() {
  return (
    <WorkflowProvider workflow={workflow}>
      <DashboardContent />
    </WorkflowProvider>
  );
}

function DashboardContent() {
  const {
    messages,
    events,
    state,
    input,
    setInput,
    handleSubmit,
    isLoading,
    tape,
  } = useWorkflow();

  return (
    <div className="dashboard grid grid-cols-3 gap-4 h-screen p-4">

      {/* Left: Chat View (messages projection) */}
      <div className="chat-panel flex flex-col">
        <h2>Chat</h2>
        <div className="messages flex-1 overflow-y-auto">
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />
      </div>

      {/* Center: Task Progress (state-driven) */}
      <div className="tasks-panel flex flex-col">
        <h2>Tasks ({state.tasks.filter(t => t.status === "success").length}/{state.tasks.length})</h2>
        <div className="tasks flex-1 overflow-y-auto">
          {state.tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        <div className="phase-indicator">
          Phase: <strong>{state.phase}</strong>
        </div>
      </div>

      {/* Right: Event Timeline (event-driven) */}
      <div className="events-panel flex flex-col">
        <h2>Events ({events.length})</h2>
        <div className="timeline flex-1 overflow-y-auto">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        <TapeControls tape={tape} />
      </div>

    </div>
  );
}
```

---

### The Component Hierarchy

```
WorkflowProvider (context)
└── useWorkflow() hook
    ├── messages → Chat components (AI SDK style)
    ├── state → State-driven components (TaskCard, ProgressBar)
    ├── events → Event-driven components (EventCard, Timeline)
    └── tape → Debugging controls (TapeControls)
```

**What the framework provides:**
- `WorkflowProvider` - React context
- `useWorkflow()` - All the data you need
- `messages` - Accumulated chat view
- `events` - Raw event stream
- `state` - Current workflow state
- `tape` - Playback controls

**What you build:**
- `EventCard` - Router to your event components
- `TaskCard` - Your domain-specific UI
- `MessageBubble` - Your chat styling
- Any custom visualization

---

## What's Built-In vs. What You Customize

### Built-In (Framework Provides)

| Feature | What It Does |
|---------|--------------|
| Event system | Typed events, validation, causality tracking |
| Handler dispatch | Routes events to handlers |
| Agent runtime | Activates agents, manages LLM calls |
| SQLite store | Persists events, enables replay |
| Tape API | Rewind, step, play, stepTo |
| React hooks | `useWorkflow` with messages projection |
| Message projection | Events → AI SDK compatible messages |

### You Customize

| Feature | What You Define |
|---------|-----------------|
| Events | Your domain-specific event types |
| State | Your workflow's data shape |
| Handlers | Your business logic |
| Agents | Your prompts and LLM interactions |
| Renderers | How events display in your UI |
| Components | Your React UI (or use our defaults) |

---

## The Payoff

Same agentic loop pattern you're already using. But now:

| Before | After |
|--------|-------|
| Console.log debugging | Event history with causality |
| Every test costs $$ | Replay recordings for free |
| Failures are mysteries | Step through to find the bug |
| Black box execution | Full observability |
| Rebuild from scratch | Resume from any checkpoint |

---

## Testing & Evals

Because state is derived from events, you can write tests that assert invariants at any point in execution—not just the final result.

### Basic Replay Test

```typescript
test("workflow completes all tasks successfully", async () => {
  const tape = await workflow.load("fixtures/happy-path");
  await tape.play();

  expect(tape.state.phase).toBe("complete");
  expect(tape.state.tasks.every(t => t.status === "success")).toBe(true);
});
```

### Assert State at Specific Points

```typescript
test("planner creates exactly 3 tasks", async () => {
  const tape = await workflow.load("fixtures/planning-scenario");

  // Find the plan:created event
  const planEvent = tape.events.findIndex(e => e.name === "plan:created");
  await tape.stepTo(planEvent);

  expect(tape.state.tasks).toHaveLength(3);
  expect(tape.state.phase).toBe("executing");
});
```

### Verify Event Ordering

```typescript
test("status check happens before file modification", async () => {
  const tape = await workflow.load("fixtures/file-workflow");

  const modifyEvents = tape.events
    .map((e, i) => ({ event: e, index: i }))
    .filter(({ event }) => event.name === "file:modified");

  for (const { event, index } of modifyEvents) {
    const precedingEvents = tape.events.slice(0, index);
    const hasStatusCheck = precedingEvents.some(
      e => e.name === "tool:called" && e.payload.tool === "git_status"
    );
    expect(hasStatusCheck).toBe(true);
  }
});
```

### Test Error Recovery

```typescript
test("retry preserves critical state", async () => {
  const tape = await workflow.load("fixtures/retry-scenario");

  // Capture initial critical state
  await tape.stepTo(0);
  const initialConfig = structuredClone(tape.state.config);

  // Find all retry events and verify state after each
  const retryEvents = tape.events
    .map((e, i) => ({ event: e, index: i }))
    .filter(({ event }) => event.name === "task:retry");

  for (const { index } of retryEvents) {
    await tape.stepTo(index);
    expect(tape.state.config).toEqual(initialConfig);
  }
});
```

### Deterministic Replay

```typescript
test("replay produces identical results", async () => {
  const tape = await workflow.load("fixtures/deterministic-test");

  // Run replay multiple times
  const results: WorkflowState[] = [];
  for (let i = 0; i < 10; i++) {
    await tape.rewind();
    await tape.play();
    results.push(structuredClone(tape.state));
  }

  // All results should be identical
  for (const result of results) {
    expect(result).toEqual(results[0]);
  }
});
```

This is the real power: not just "did it work?" but "was every step correct?"

---

## Try It

```bash
# Create a new project
bunx create-open-harness my-agent

# Or add to existing project
bun add @open-harness/core @open-harness/react @open-harness/store-sqlite
```

The pattern you love. The observability you need.

---

*Open Harness is open source. [Star us on GitHub](https://github.com/open-harness/open-harness).*
