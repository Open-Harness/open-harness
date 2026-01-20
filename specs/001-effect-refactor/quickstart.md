# Quickstart: core-v2

**Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)

This guide demonstrates how to use `@core-v2` to build event-driven AI workflows with time-travel debugging.

---

## Installation

```bash
bun add @open-harness/core-v2
```

---

## Core Concept: Domain State

**State is your workflow's domain data, not chat history.**

- State tracks: workflow phase, agent outputs, business entities, retry counts
- State does NOT track: messages (those are projected from events for React)
- The event log is the source of truth; state is derived by replaying handlers

```typescript
// ✅ Good: Domain-focused state
interface TaskWorkflowState {
  goal: string;
  tasks: Array<{ id: string; title: string; status: "pending" | "complete" | "failed" }>;
  currentPhase: "planning" | "executing" | "reviewing" | "complete";
  currentTaskIndex: number;
  retryCount: number;  // Meaningful: how many times have we retried the current task?
  maxRetries: number;
}

// ❌ Bad: Chat-focused state (messages belong in events, not state)
interface BadState {
  messages: Array<{ role: string; content: string }>;
  turnCount: number;
}
```

---

## Basic Example: Task Executor Workflow

This example shows a two-agent workflow: a **Planner** breaks down a goal into tasks, an **Executor** completes them.

```typescript
import {
  createWorkflow,
  defineEvent,
  defineHandler,
  agent,
} from "@open-harness/core-v2";
import { z } from "zod";

// =============================================================================
// 1. Define Domain State
// =============================================================================

interface TaskWorkflowState {
  goal: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: "pending" | "complete" | "failed";
  }>;
  currentPhase: "planning" | "executing" | "complete";
  currentTaskIndex: number;
  executionResults: Array<{
    taskId: string;
    output: string;
    success: boolean;
  }>;
}

const initialState: TaskWorkflowState = {
  goal: "",
  tasks: [],
  currentPhase: "planning",
  currentTaskIndex: 0,
  executionResults: [],
};

// =============================================================================
// 2. Define Events
// =============================================================================

const PlanCreated = defineEvent("plan:created", {
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  })),
});

const TaskExecuted = defineEvent("task:executed", {
  taskId: z.string(),
  output: z.string(),
  success: z.boolean(),
});

const WorkflowComplete = defineEvent("workflow:complete", {
  summary: z.string(),
});

// =============================================================================
// 3. Define Handlers (pure functions that update domain state)
// =============================================================================

const handlePlanCreated = defineHandler(PlanCreated, (event, state: TaskWorkflowState) => {
  // Update domain state with the plan output
  const tasks = event.payload.tasks.map(t => ({
    ...t,
    status: "pending" as const,
  }));

  return {
    state: {
      ...state,
      tasks,
      currentPhase: "executing" as const,
      currentTaskIndex: 0,
    },
    // Emit event to start executing first task
    events: tasks.length > 0
      ? [{ name: "task:ready", payload: { taskId: tasks[0].id } }]
      : [{ name: "workflow:complete", payload: { summary: "No tasks to execute" } }],
  };
});

const handleTaskExecuted = defineHandler(TaskExecuted, (event, state: TaskWorkflowState) => {
  // Update task status based on execution result
  const updatedTasks = state.tasks.map(t =>
    t.id === event.payload.taskId
      ? { ...t, status: event.payload.success ? "complete" as const : "failed" as const }
      : t
  );

  // Track execution result
  const executionResults = [
    ...state.executionResults,
    {
      taskId: event.payload.taskId,
      output: event.payload.output,
      success: event.payload.success,
    },
  ];

  // Check if all tasks are done
  const nextIndex = state.currentTaskIndex + 1;
  const allDone = nextIndex >= state.tasks.length;

  if (allDone) {
    const successCount = executionResults.filter(r => r.success).length;
    return {
      state: {
        ...state,
        tasks: updatedTasks,
        executionResults,
        currentPhase: "complete" as const,
      },
      events: [{
        name: "workflow:complete",
        payload: { summary: `Completed ${successCount}/${state.tasks.length} tasks` },
      }],
    };
  }

  // Move to next task
  return {
    state: {
      ...state,
      tasks: updatedTasks,
      executionResults,
      currentTaskIndex: nextIndex,
    },
    events: [{
      name: "task:ready",
      payload: { taskId: state.tasks[nextIndex].id },
    }],
  };
});

// =============================================================================
// 4. Define Agents with REQUIRED Structured Output
// =============================================================================

// Planner agent - breaks down goal into tasks
const PlanOutput = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  })),
});

const planner = agent({
  name: "planner",
  activatesOn: ["workflow:start"],
  emits: ["agent:started", "text:delta", "plan:created", "agent:completed"],

  // REQUIRED: Structured output schema (using Zod)
  outputSchema: PlanOutput,

  // REQUIRED: Transform structured output to events
  onOutput: (output, event) => [{
    id: crypto.randomUUID(),
    name: "plan:created",
    payload: { tasks: output.tasks },
    timestamp: new Date(),
    causedBy: event.id,
  }],

  prompt: (state) => `
    You are a planning agent. Break down the following goal into 2-4 concrete tasks.

    Goal: ${state.goal}

    For each task, provide:
    - id: A unique identifier (TASK-001, TASK-002, etc.)
    - title: A concise title
    - description: What needs to be done

    Output as JSON matching the schema.
  `,
});

// Executor agent - completes individual tasks
const ExecutionOutput = z.object({
  output: z.string(),
  success: z.boolean(),
});

const executor = agent({
  name: "executor",
  activatesOn: ["task:ready"],
  emits: ["agent:started", "text:delta", "task:executed", "agent:completed"],

  outputSchema: ExecutionOutput,

  onOutput: (output, event) => [{
    id: crypto.randomUUID(),
    name: "task:executed",
    payload: {
      taskId: event.payload.taskId,
      output: output.output,
      success: output.success,
    },
    timestamp: new Date(),
    causedBy: event.id,
  }],

  prompt: (state, event) => {
    const task = state.tasks.find(t => t.id === event.payload.taskId);
    return `
      You are an execution agent. Complete the following task.

      Task: ${task?.title}
      Description: ${task?.description}

      Provide your output and whether you successfully completed the task.
    `;
  },

  // Guard: only execute if we're in executing phase
  when: (state) => state.currentPhase === "executing",
});

// =============================================================================
// 5. Create the Workflow
// =============================================================================

const workflow = createWorkflow({
  name: "task-executor",
  initialState,
  handlers: [handlePlanCreated, handleTaskExecuted],
  agents: [planner, executor],
  // Termination: when we reach the complete phase
  until: (state) => state.currentPhase === "complete",
});

// =============================================================================
// 6. Run It
// =============================================================================

const result = await workflow.run({
  input: "Build a simple todo app with add, remove, and list features",
  record: true, // Enable recording for time-travel
});

console.log("Final state:", result.state);
console.log("Tasks completed:", result.state.tasks.filter(t => t.status === "complete").length);
console.log("Session ID:", result.sessionId);

// Cleanup
await workflow.dispose();
```

---

## Time-Travel Debugging

The killer feature: step backward through execution history.

```typescript
// Load a recorded session
const tape = await workflow.load(sessionId);

// Inspect current position
console.log(`Position: ${tape.position} / ${tape.length}`);
console.log("Current event:", tape.current);
console.log("Current state:", tape.state);

// Step forward
const t1 = tape.step();
console.log("After step:", t1.position);

// THE KEY FEATURE: Step backward!
const t2 = t1.stepBack();
console.log("After stepBack:", t2.position);
console.log("Historical state:", t2.state);

// Jump to any position
const t3 = tape.stepTo(5);
console.log("State at position 5:", t3.state);

// Rewind to beginning
const t4 = tape.rewind();
console.log("Back to start:", t4.position); // 0

// Play through all events
const final = await tape.play();
console.log("Final position:", final.position);
```

---

## Recording and Replay

Record sessions for debugging and testing.

```typescript
import { createSqliteStore } from "@open-harness/core-v2";

// Create a persistent store
const store = createSqliteStore({ path: "./sessions.db" });

// Create workflow with store
const workflow = createWorkflow({
  name: "task-executor",
  initialState,
  handlers: [handlePlanCreated, handleTaskExecuted],
  agents: [planner, executor],
  until: (state) => state.currentPhase === "complete",
  store, // Attach the store
});

// Record a session
const result = await workflow.run({
  input: "Build a REST API",
  record: true,
});

console.log("Recorded session:", result.sessionId);

// Later: Replay without API calls
const tape = await workflow.load(result.sessionId);
await tape.play(); // Events come from recording, no LLM calls!

// List all sessions
const sessions = await store.sessions();
for (const session of sessions) {
  console.log(`${session.id}: ${session.eventCount} events`);
}
```

---

## Custom Renderers

Transform events into custom output.

```typescript
import { createRenderer } from "@open-harness/core-v2";

// Terminal renderer for CLI output
const terminalRenderer = createRenderer({
  name: "terminal",
  renderers: {
    "text:delta": (event, state) => {
      process.stdout.write(event.payload.delta);
    },
    "agent:started": (event, state) => {
      console.log(`\n[${event.payload.agentName}] Starting...`);
    },
    "plan:created": (event, state) => {
      console.log(`\nPlan created with ${event.payload.tasks.length} tasks:`);
      for (const task of event.payload.tasks) {
        console.log(`  - ${task.title}`);
      }
    },
    "task:executed": (event, state) => {
      const icon = event.payload.success ? "✓" : "✗";
      console.log(`\n${icon} Task ${event.payload.taskId}: ${event.payload.output}`);
    },
    "error:*": (event, state) => {
      console.error(`ERROR: ${event.payload.message}`);
    },
  },
});

// Use the renderer
await workflow.run({
  input: "Build a CLI tool",
  renderers: [terminalRenderer],
});
```

---

## React Integration

Use the `useWorkflow` hook for React apps. Note that `messages` is a **projection from events** for chat UIs—it's not stored in state.

```tsx
import { useWorkflow, WorkflowProvider } from "@open-harness/core-v2/react";

function TaskExecutorUI() {
  const {
    // AI SDK compatible (messages projected from events)
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,

    // Open Harness unique - the real power
    events,      // Raw event stream
    state,       // Domain state (tasks, phase, etc.)
    tape,        // Time-travel controls
  } = useWorkflow(workflow);

  return (
    <div>
      {/* Domain state display */}
      <div className="status">
        Phase: {state.currentPhase} |
        Tasks: {state.tasks.filter(t => t.status === "complete").length}/{state.tasks.length}
      </div>

      {/* Task list from domain state */}
      <ul className="tasks">
        {state.tasks.map((task) => (
          <li key={task.id} className={task.status}>
            {task.status === "complete" ? "✓" : "○"} {task.title}
          </li>
        ))}
      </ul>

      {/* Messages (projected from events for chat display) */}
      {messages.map((m) => (
        <div key={m.id} className={m.role}>
          {m.name && <span className="agent">[{m.name}]</span>}
          {m.content}
        </div>
      ))}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a goal..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Working..." : "Start"}
        </button>
      </form>

      {/* Error display */}
      {error && <div className="error">{error.message}</div>}

      {/* Time-travel controls */}
      <div className="tape-controls">
        <button onClick={tape.rewind}>⏮ Rewind</button>
        <button onClick={tape.stepBack}>◀ Back</button>
        <span>{tape.position} / {tape.length}</span>
        <button onClick={tape.step}>▶ Forward</button>
        <button onClick={() => tape.play()}>⏵ Play</button>
      </div>
    </div>
  );
}

// Wrap your app
function App() {
  return (
    <WorkflowProvider workflow={workflow}>
      <TaskExecutorUI />
    </WorkflowProvider>
  );
}
```

---

## Structured Output (Critical)

**Every agent MUST define `outputSchema` and `onOutput`**. This is non-negotiable for reliable workflow state.

The SDK enforces structured responses via `outputFormat: { type: "json_schema", schema }`.

```typescript
import { agent } from "@open-harness/core-v2";
import { z } from "zod";

// Define structured output schema using Zod
const AnalysisOutput = z.object({
  findings: z.array(z.string()),
  confidence: z.number().min(0).max(100),
  recommendation: z.enum(["proceed", "hold", "abort"]),
});

// Agent with required structured output
const analyst = agent({
  name: "analyst",
  activatesOn: ["analysis:requested"],
  emits: ["agent:started", "text:delta", "analysis:complete", "agent:completed"],

  prompt: (state, event) => `
    Analyze the data and provide structured findings.
    Topic: ${event.payload.topic}
  `,

  // REQUIRED: Define what the LLM must output
  outputSchema: AnalysisOutput,

  // REQUIRED: Transform structured output to events
  onOutput: (output, event) => [{
    id: crypto.randomUUID(),
    name: "analysis:complete",
    payload: output,
    timestamp: new Date(),
    causedBy: event.id,
  }],

  // Optional guard condition
  when: (state) => state.currentPhase === "analyzing",
});
```

---

## Server Integration

Run workflows on the server with HTTP endpoints.

```typescript
// server.ts
import { createWorkflowHandler } from "@open-harness/core-v2";

const handler = createWorkflowHandler({
  workflow,
  cors: { origin: "http://localhost:3000" },
});

// With Hono
import { Hono } from "hono";

const app = new Hono();
app.post("/api/workflow", (c) => handler.handle(c.req.raw));

export default app;
```

```tsx
// client.tsx
import { useWorkflow } from "@open-harness/core-v2/react";

function TaskExecutorUI() {
  const { messages, input, setInput, handleSubmit, state } = useWorkflow(workflow, {
    api: "/api/workflow", // Connect to server
  });

  // ... same UI code as before
}
```

---

## Testing with Fixtures

Use recorded sessions for deterministic tests.

```typescript
import { describe, it, expect } from "@effect/vitest";
import { createMemoryStore } from "@open-harness/core-v2";

describe("Task Executor Workflow", () => {
  it("should create a plan and execute tasks", async () => {
    const store = createMemoryStore();

    const workflow = createWorkflow({
      name: "test-task-executor",
      initialState,
      handlers: [handlePlanCreated, handleTaskExecuted],
      agents: [planner, executor],
      until: (state) => state.currentPhase === "complete",
      store,
    });

    const result = await workflow.run({
      input: "Build a simple calculator",
      record: true,
    });

    // Verify domain state
    expect(result.state.currentPhase).toBe("complete");
    expect(result.state.tasks.length).toBeGreaterThan(0);
    expect(result.state.tasks.every(t => t.status !== "pending")).toBe(true);

    await workflow.dispose();
  });

  it("should replay deterministically", async () => {
    // Load a recorded fixture
    const tape = await workflow.load("fixture-session-123");

    // Replay and verify state at each position
    for (let i = 0; i < tape.length; i++) {
      const t = tape.stepTo(i);
      expect(t.state).toMatchSnapshot(`state-at-${i}`);
    }
  });

  it("should step backward correctly", async () => {
    const tape = await workflow.load("fixture-session-123");

    // Go to position 5
    const t1 = tape.stepTo(5);
    const stateAt5 = t1.state;

    // Step forward then back
    const t2 = t1.step(); // position 6
    const t3 = t2.stepBack(); // back to 5

    // State should be identical
    expect(t3.state).toEqual(stateAt5);
  });
});
```

---

## Event Causality Tracking

Track which events caused which.

```typescript
// Events include `causedBy` field
const event = {
  id: "evt-123",
  name: "task:executed",
  payload: { taskId: "TASK-001", output: "Done", success: true },
  timestamp: new Date(),
  causedBy: "evt-100", // This event was caused by task:ready (evt-100)
};

// Build a causality graph
function buildCausalityGraph(events: AnyEvent[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const event of events) {
    if (event.causedBy) {
      const children = graph.get(event.causedBy) ?? [];
      children.push(event.id);
      graph.set(event.causedBy, children);
    }
  }

  return graph;
}

// Trace an event's lineage
function getEventLineage(events: AnyEvent[], eventId: string): AnyEvent[] {
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const lineage: AnyEvent[] = [];

  let current = eventMap.get(eventId);
  while (current) {
    lineage.unshift(current);
    current = current.causedBy ? eventMap.get(current.causedBy) : undefined;
  }

  return lineage;
}
```

---

## Next Steps

- Read the [Data Model](./data-model.md) for entity details
- Check the [API Contracts](./contracts/) for TypeScript interfaces
- See [Research](./research.md) for Effect patterns used internally
- Review the [Feature Spec](./spec.md) for complete requirements

---

## Key Points

1. **State is domain data**: Tasks, phases, agent outputs—NOT messages
2. **Messages are projected**: From events for React UIs, not stored in state
3. **Structured output is MANDATORY**: Every agent MUST have `outputSchema` and `onOutput`
4. **Handlers are pure**: `(event, state) → { state, events[] }` - no side effects
5. **Events are immutable**: Once created, never modified
6. **Time-travel is built-in**: `tape.stepBack()` is the killer feature
7. **Effect is hidden**: You work with Promises, not Effect types
