# Open Harness Mental Model

> **One sentence:** Signals flow in, state updates, signals flow out, adapters render.

---

## What is Open Harness?

Open Harness is a **reactive state machine for AI agent workflows**.

You define:
1. **State** - The shape of your workflow data
2. **Handlers** - What happens when signals arrive
3. **Agents** - AI actors that do work and emit signals
4. **Adapters** - How signals render to outputs (terminal, logs, web)

The framework handles:
- Immutability (via Immer)
- Signal routing
- Recording and replay
- The reactive loop

---

## The Core Loop

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│    Signal emitted                                              │
│         │                                                      │
│         ├───────────────────────┐                              │
│         ▼                       ▼                              │
│    ┌─────────┐            ┌──────────┐                         │
│    │ Handler │            │ Adapters │──→ Terminal / Logs / Web│
│    └─────────┘            └──────────┘                         │
│         │                                                      │
│         ▼                                                      │
│    Updates state (mutate directly)                             │
│         │                                                      │
│         ▼                                                      │
│    Returns new signals ────────────────────────┐              │
│                                                 │              │
│                                                 ▼              │
│                                            Back to top         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Signals flow through handlers (which update state) AND adapters (which render output) in parallel.

---

## Concept 1: State

State is just a TypeScript object. Define it however makes sense for your workflow.

```typescript
type MyWorkflowState = {
  tasks: Task[];
  currentTaskIndex: number;
  completed: boolean;
};
```

State is **immutable** under the hood, but you **write to it directly**. The framework uses Immer to handle the immutability for you.

---

## Concept 2: Signals

Signals are **pure data** that flow through the system. They have:
- A **name** (string, like `"task:completed"`)
- A **payload** (any data)

```typescript
{ name: "task:completed", payload: { taskId: "T001", result: "success" } }
```

Signals carry meaning, not presentation. How a signal looks to a user is determined by adapters, not by the signal itself.

### Signal Naming Convention

Use past tense for things that happened:
```typescript
"plan:created"      // A plan was created
"task:completed"    // A task finished
"review:passed"     // A review passed
```

Use imperative for requests:
```typescript
"task:start"        // Please start a task
"review:request"    // Please review this
```

---

## Concept 3: Handlers

A handler is a function that:
1. Receives a signal and the current state
2. Updates state (mutate directly - Immer handles immutability)
3. Returns new signals to emit (or nothing)

```typescript
const handlers = {
  "task:completed": (signal, state) => {
    const { taskId } = signal.payload;

    // Update state - just mutate it
    state.tasks[taskId].status = "complete";
    state.currentTaskIndex++;

    // Return signals to emit next
    if (state.currentTaskIndex >= state.tasks.length) {
      return [{ name: "workflow:complete" }];
    } else {
      return [{ name: "task:start", payload: { taskId: state.tasks[state.currentTaskIndex].id } }];
    }
  },

  "task:start": (signal, state) => {
    const { taskId } = signal.payload;
    state.tasks[taskId].status = "in_progress";
    // No signals to emit - the agent will handle this
  },
};
```

### Handler Rules

1. **Mutate state directly** - No spread operators, no `{ ...state }`. Just `state.foo = bar`.
2. **Return signals or nothing** - Return an array of signals to emit, or return nothing.
3. **Keep it simple** - One handler per signal. Do one thing well.

---

## Concept 4: Agents

Agents are AI actors. They:
1. Activate on certain signals
2. Call an LLM (via a harness)
3. Emit signals based on the result

```typescript
const coder = agent({
  name: "coder",
  activateOn: ["task:start"],

  prompt: (state, signal) => `
    Complete this task: ${state.tasks[signal.payload.taskId].description}
  `,

  emits: ["task:completed"],
});
```

When `task:start` fires:
1. The coder agent activates
2. It calls the LLM with the prompt
3. When done, it emits `task:completed`

Agents don't update state directly. They emit signals, and handlers update state.

---

## Concept 5: The Workflow

Tie it all together:

```typescript
const { runWorkflow } = createWorkflow<MyWorkflowState>();

const result = await runWorkflow({
  state: {
    tasks: [{ id: "T001", description: "Write hello world", status: "pending" }],
    currentTaskIndex: 0,
    completed: false,
  },
  handlers,
  agents: { coder },
  harness: new ClaudeHarness({ model: "haiku" }),

  // Stop when workflow is complete
  endWhen: (state) => state.completed,
});
```

---

## Concept 6: Adapters

Adapters transform signals into visible output. They're the bridge between the signal stream and the user.

### Signals are data, adapters are presentation

The same signal can render differently depending on context:
- **Terminal**: `✓ Plan created with 5 tasks` (colored text)
- **Logs**: `{"level":"info","signalName":"plan:created","payload":{...}}` (structured JSON)
- **Web**: A React component with a green checkmark

### Renderer maps

Each adapter takes a **renderer map** - you specify exactly which signals to render and how:

```typescript
const renderers = {
  "plan:created": (signal) => `✓ Plan with ${signal.payload.tasks.length} tasks`,
  "task:ready": (signal) => `▶ ${signal.payload.title}`,
  "workflow:complete": () => `🎉 Done`,
};

const adapter = terminalAdapter({ renderers });
```

Signals without a renderer are **silently skipped**. This is intentional - not every signal needs user-visible output. Internal signals, debug signals, and housekeeping signals flow through the system without cluttering the UI.

### Adapters are optional

You can run a workflow with:
- **No adapters** - Headless mode, no output
- **One adapter** - CLI tool with terminal output
- **Multiple adapters** - CLI + logs + web dashboard simultaneously

```typescript
await runWorkflow({
  // ...
  adapters: [
    terminalAdapter({ renderers: terminalRenderers }),
    logsAdapter({ logger }),
  ],
});
```

### Adapters don't affect flow

Adapters are pure observers. They:
- ✅ See signals as they flow
- ✅ Render output to their target
- ❌ Cannot modify signals
- ❌ Cannot affect state
- ❌ Cannot emit new signals

This separation keeps the workflow logic clean and the output layer flexible.

---

## Recording and Replay

Every signal that flows through the system can be recorded.

### Record Mode

```typescript
const result = await runWorkflow({
  // ... config ...
  recording: {
    mode: "record",
    store: new SqliteSignalStore("./recordings.db"),
    name: "my-workflow-run",
  },
});

console.log(`Recording ID: ${result.recordingId}`);
```

### Replay Mode

```typescript
const result = await runWorkflow({
  // ... config ...
  recording: {
    mode: "replay",
    store: new SqliteSignalStore("./recordings.db"),
    recordingId: "rec_xxxxx",
  },
});
```

In replay mode:
- No LLM calls are made
- Signals are injected from the recording
- State transitions identically
- Adapters still render (great for demos)
- Useful for testing, debugging, demos

---

## Type Safety

Signals are typed end-to-end. Define your signal types:

```typescript
type MySignals =
  | { name: "task:start"; payload: { taskId: string } }
  | { name: "task:completed"; payload: { taskId: string; result: string } }
  | { name: "workflow:complete"; payload?: undefined };
```

Handlers receive typed signals:

```typescript
const handlers: Handlers<MyWorkflowState, MySignals> = {
  "task:completed": (signal, state) => {
    // signal.payload is typed as { taskId: string; result: string }
    const { taskId, result } = signal.payload;
    // ...
  },
};
```

No type casts. The types flow through.

---

## Full Example

```typescript
import { createWorkflow, ClaudeHarness, SqliteSignalStore, terminalAdapter } from "@open-harness/core";

// 1. Define state
type TodoState = {
  items: Array<{ id: string; text: string; done: boolean }>;
  summary: string | null;
};

// 2. Define handlers
const handlers = {
  "item:completed": (signal, state) => {
    const { itemId } = signal.payload;
    state.items.find(i => i.id === itemId)!.done = true;

    // Check if all done
    if (state.items.every(i => i.done)) {
      return [{ name: "all:completed" }];
    }
  },

  "all:completed": (signal, state) => {
    state.summary = `Completed ${state.items.length} items`;
  },
};

// 3. Define agents
const { agent, runWorkflow } = createWorkflow<TodoState>();

const worker = agent({
  name: "worker",
  activateOn: ["workflow:start"],
  prompt: (state) => `Process these items: ${JSON.stringify(state.items)}`,
  emits: ["item:completed"],
});

// 4. Define renderers for terminal output
const renderers = {
  "item:completed": (s) => `✓ Completed: ${s.payload.itemId}`,
  "all:completed": () => `🎉 All items done!`,
};

// 5. Run it
const result = await runWorkflow({
  state: {
    items: [
      { id: "1", text: "Buy milk", done: false },
      { id: "2", text: "Write code", done: false },
    ],
    summary: null,
  },
  handlers,
  agents: { worker },
  harness: new ClaudeHarness({ model: "haiku" }),
  adapters: [terminalAdapter({ renderers })],
  endWhen: (state) => state.summary !== null,
});

console.log(result.state.summary);
// "Completed 2 items"
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Signal** | Pure data: a name and payload that flows through the system |
| **State** | The current data of your workflow |
| **Handler** | A function that updates state and returns new signals |
| **Agent** | An AI actor that activates on signals and calls an LLM |
| **Harness** | The adapter that executes LLM calls (Claude, OpenAI, etc.) |
| **Adapter** | Transforms signals into output (terminal, logs, web) via a renderer map |
| **Renderer Map** | Signal name → render function. Defines what to show and how. |
| **Recording** | A captured sequence of signals for replay |

---

## Design Principles

### 1. Signals are the only way things communicate

Agents don't call each other. Handlers don't call agents. Everything communicates through signals.

### 2. State is the single source of truth

Don't store derived data. Compute it from state when needed.

### 3. Handlers are simple

One handler per signal. Update state, return signals. That's it.

### 4. Agents are autonomous

An agent doesn't know about other agents. It just does its job and emits signals.

### 5. Everything is replayable

If you can record it, you can replay it. This enables testing, debugging, and demos.

### 6. Signals are data, not presentation

Signals carry meaning. How they're displayed is a separate concern handled by adapters. The same signal can render differently in terminal vs web vs logs.

---

## Anti-Patterns

### ❌ Don't emit signals from inside handlers manually

```typescript
// Wrong - don't do this
"task:completed": (signal, state, ctx) => {
  state.tasks[id].done = true;
  ctx.emit({ name: "next:task" });  // NO!
};
```

```typescript
// Right - return signals
"task:completed": (signal, state) => {
  state.tasks[id].done = true;
  return [{ name: "next:task" }];  // YES!
};
```

### ❌ Don't use spread operators for state updates

```typescript
// Wrong - unnecessary complexity
return {
  ...state,
  tasks: {
    ...state.tasks,
    [id]: { ...state.tasks[id], done: true }
  }
};
```

```typescript
// Right - just mutate
state.tasks[id].done = true;
```

### ❌ Don't put business logic in agents

```typescript
// Wrong - agent deciding flow
const agent = agent({
  // ...
  onComplete: (result, state) => {
    if (someCondition) {
      emit("path:a");
    } else {
      emit("path:b");
    }
  }
});
```

```typescript
// Right - handler decides flow
"task:completed": (signal, state) => {
  if (someCondition) {
    return [{ name: "path:a" }];
  } else {
    return [{ name: "path:b" }];
  }
};
```

### ❌ Don't put display logic in signals

```typescript
// Wrong - signal knows how to display itself
const signal = {
  name: "plan:created",
  payload: { tasks },
  display: { icon: "✓", title: "Plan created" }  // NO!
};
```

```typescript
// Right - adapter defines display
const renderers = {
  "plan:created": (s) => `✓ Plan with ${s.payload.tasks.length} tasks`
};
```

---

## Summary

1. **Signals** flow through the system (pure data)
2. **Handlers** update state and return new signals
3. **Agents** call LLMs and emit signals
4. **State** is the truth, mutate it directly
5. **Adapters** render signals to outputs (terminal, logs, web)
6. **Recording** captures signals for replay

That's the mental model. Everything else is implementation details.

---

*Document Version: 3.0*
*Last Updated: 2026-01-20*
