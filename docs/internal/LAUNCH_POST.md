# Open Harness: Build Agent Systems with Time-Travel Debugging

Open Harness is a TypeScript SDK for building AI agent systems. You define events, handlers, and state. The SDK records everything. You can replay any session and step through state changes like a debugger.

This post walks through building a real agent workflow from scratch.

---

## The Mental Model

```
Events → Handlers → State → UI
```

1. **Events**: Immutable facts about what happened
2. **Handlers**: Pure functions that update state in response to events
3. **State**: Your workflow's data, derived from replaying events
4. **UI**: React/Solid/Vue components that subscribe to the event bus

Because state is derived from events (not mutated directly), you can reconstruct state at any point by replaying the event log. That's time-travel debugging.

---

## Step 1: Define Your Events

Events are typed facts. Something happened. Here's what it was.

```typescript
import { defineEvent } from "@open-harness/core";
import { z } from "zod";

// User started a task
export const TaskStarted = defineEvent("task:started", z.object({
  taskId: z.string(),
  description: z.string(),
}));

// Agent finished working
export const TaskCompleted = defineEvent("task:completed", z.object({
  taskId: z.string(),
  result: z.string(),
  toolCalls: z.number(),
}));

// Something went wrong
export const TaskFailed = defineEvent("task:failed", z.object({
  taskId: z.string(),
  error: z.string(),
}));
```

Events are your vocabulary. Name them after what happened, not what you want to happen.

---

## Step 2: Define Your State

State is a plain TypeScript interface. Nothing special.

```typescript
export interface WorkflowState {
  tasks: Array<{
    id: string;
    description: string;
    status: "pending" | "running" | "complete" | "failed";
    result?: string;
  }>;
  totalToolCalls: number;
}

export const initialState: WorkflowState = {
  tasks: [],
  totalToolCalls: 0,
};
```

---

## Step 3: Define Your Handlers

Handlers are pure functions. They take an event and current state, return new state.

```typescript
import { defineHandler } from "@open-harness/core";

export const handleTaskStarted = defineHandler(TaskStarted, (event, state) => ({
  state: {
    ...state,
    tasks: [
      ...state.tasks,
      {
        id: event.payload.taskId,
        description: event.payload.description,
        status: "running",
      },
    ],
  },
  events: [], // Handlers can emit follow-up events
}));

export const handleTaskCompleted = defineHandler(TaskCompleted, (event, state) => ({
  state: {
    ...state,
    tasks: state.tasks.map(t =>
      t.id === event.payload.taskId
        ? { ...t, status: "complete", result: event.payload.result }
        : t
    ),
    totalToolCalls: state.totalToolCalls + event.payload.toolCalls,
  },
  events: [],
}));

export const handleTaskFailed = defineHandler(TaskFailed, (event, state) => ({
  state: {
    ...state,
    tasks: state.tasks.map(t =>
      t.id === event.payload.taskId
        ? { ...t, status: "failed" }
        : t
    ),
  },
  events: [],
}));
```

Handlers are pure. Same input → same output. This is what makes replay deterministic.

---

## Step 4: Define Your Agent

Agents are the AI part. They listen for events, call the LLM, and emit new events.

```typescript
import { defineAgent } from "@open-harness/core";

export const taskAgent = defineAgent({
  name: "task-executor",

  // When to activate
  activatesOn: [TaskStarted],

  // What events this agent can emit
  emits: [TaskCompleted, TaskFailed],

  // Structured output schema
  outputSchema: z.object({
    result: z.string(),
    success: z.boolean(),
  }),

  // Build the prompt from current state and triggering event
  prompt: (state, event) => `
    You are a task executor.

    Task: ${event.payload.description}

    Complete this task and return a result.
  `,

  // Map LLM output to events
  onOutput: (output, event) => {
    if (output.success) {
      return TaskCompleted.create({
        taskId: event.payload.taskId,
        result: output.result,
        toolCalls: 0, // SDK tracks this automatically
      });
    } else {
      return TaskFailed.create({
        taskId: event.payload.taskId,
        error: output.result,
      });
    }
  },
});
```

---

## Step 5: Create the Workflow

Wire events, handlers, and agents into a workflow.

```typescript
import { createWorkflow } from "@open-harness/core";

export const workflow = createWorkflow({
  name: "task-workflow",
  initialState,
  handlers: [handleTaskStarted, handleTaskCompleted, handleTaskFailed],
  agents: [taskAgent],
});
```

---

## Step 6: Build Your UI

Subscribe to the event bus from React (or Solid, Vue, etc).

```tsx
import { useWorkflow, useEvents } from "@open-harness/react";

function TaskList() {
  const { state } = useWorkflow(workflow);

  return (
    <ul>
      {state.tasks.map(task => (
        <li key={task.id}>
          {task.description} - {task.status}
          {task.result && <span>: {task.result}</span>}
        </li>
      ))}
    </ul>
  );
}

function EventLog() {
  const events = useEvents(workflow);

  return (
    <div>
      {events.map((event, i) => (
        <div key={i}>
          <code>{event.name}</code>: {JSON.stringify(event.payload)}
        </div>
      ))}
    </div>
  );
}
```

State updates automatically as events flow through handlers. Your components re-render.

---

## Step 7: Run It

```typescript
// Start a session
const session = await workflow.run({
  sessionId: "session-001",
});

// Emit an event to kick things off
await session.emit(TaskStarted.create({
  taskId: "task-1",
  description: "Write a function that calculates fibonacci",
}));

// The agent activates, calls the LLM, emits TaskCompleted or TaskFailed
// Handlers update state
// UI re-renders
```

---

## Step 8: Time Travel

Every session is recorded. Load it back and step through.

```typescript
const tape = await workflow.load("session-001");

// See all events
console.log(tape.events);
// [
//   { name: "task:started", payload: { taskId: "task-1", ... } },
//   { name: "task:completed", payload: { taskId: "task-1", result: "...", toolCalls: 3 } },
// ]

// Jump to any position
await tape.stepTo(0);
console.log(tape.state);
// { tasks: [{ id: "task-1", status: "running", ... }], totalToolCalls: 0 }

await tape.stepTo(1);
console.log(tape.state);
// { tasks: [{ id: "task-1", status: "complete", result: "..." }], totalToolCalls: 3 }

// Step backward
await tape.stepBack();
console.log(tape.state);
// Back to position 0
```

You can inspect the exact state at any point in your workflow's execution.

---

## Step 9: Replay Without API Calls

Recorded sessions include LLM responses. Replay them without calling the API.

```typescript
// Replay the same session - no API calls, same state transitions
const tape = await workflow.load("session-001");
await tape.play();

// State at the end matches the original run
console.log(tape.state);
```

Use this for:
- **Tests**: Assert state at specific points without burning credits
- **CI**: Run regression tests on recorded sessions
- **Debugging**: Reproduce issues from production recordings

---

## What You Get

| Feature | What It Means |
|---------|---------------|
| **Event sourcing** | State derived from events, not mutated directly |
| **Type safety** | Events, handlers, state all typed end-to-end |
| **Time travel** | Jump to any event, see state at that moment |
| **Replay** | Re-run recorded sessions without API calls |
| **Framework agnostic** | React, Solid, Vue - subscribe to the event bus |
| **Recording by default** | Every session is persisted and replayable |

---

## Real Example: Debugging a Runaway Agent

Your agent made 47 tool calls when it should have made 5. What happened?

```typescript
const tape = await workflow.load("expensive-session");

// Find all tool call events
const toolCalls = tape.events.filter(e => e.name === "tool:called");
console.log(`Total: ${toolCalls.length}`);

// Step through and watch state evolve
for (let i = 0; i < toolCalls.length; i++) {
  const pos = tape.events.indexOf(toolCalls[i]);
  await tape.stepTo(pos);
  console.log(`Tool ${i}: ${toolCalls[i].payload.tool}`);
  console.log(`State:`, tape.state);
}

// You'll see exactly where things went wrong
```

No re-running. No adding logs. Load the recording, step through, find the bug.

---

## Install

```bash
bun add @open-harness/core @open-harness/react
```

---

## Links

- GitHub: [github.com/open-harness/open-harness](https://github.com/open-harness/open-harness)
- Docs: [open-harness.dev](https://open-harness.dev)

---

Build agent systems. Record everything. Debug by time-traveling.
