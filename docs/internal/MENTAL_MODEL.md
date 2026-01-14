# Open Harness Mental Model

> **One sentence:** Signals flow in, state updates, signals flow out.

---

## What is Open Harness?

Open Harness is a **reactive state machine for AI agent workflows**.

You define:
1. **State** - The shape of your workflow data
2. **Handlers** - What happens when signals arrive
3. **Agents** - AI actors that do work and emit signals

The framework handles:
- Immutability (via Immer)
- Signal routing
- Recording and replay
- The reactive loop

---

## The Core Loop

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│    Signal arrives                                    │
│         │                                            │
│         ▼                                            │
│    ┌─────────┐                                       │
│    │ Handler │──── Updates state (mutate directly)  │
│    └─────────┘                                       │
│         │                                            │
│         ▼                                            │
│    Returns new signals ─────────────────────┐       │
│                                              │       │
│                                              ▼       │
│                                         Back to top  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

That's it. Signals in, state updates, signals out. Repeat until done.

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

Signals are messages that flow through the system. They have:
- A **name** (string, like `"task:completed"`)
- A **payload** (any data)

```typescript
{ name: "task:completed", payload: { taskId: "T001", result: "success" } }
```

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
import { createWorkflow, ClaudeHarness, SqliteSignalStore } from "@open-harness/core";

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

// 4. Run it
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
  endWhen: (state) => state.summary !== null,
});

console.log(result.state.summary);
// "Completed 2 items"
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Signal** | A message with a name and payload that flows through the system |
| **State** | The current data of your workflow |
| **Handler** | A function that updates state and returns new signals |
| **Agent** | An AI actor that activates on signals and calls an LLM |
| **Harness** | The adapter that executes LLM calls (Claude, OpenAI, etc.) |
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

---

## Summary

1. **Signals** flow through the system
2. **Handlers** update state and return new signals
3. **Agents** call LLMs and emit signals
4. **State** is the truth, mutate it directly
5. **Recording** captures signals for replay

That's the mental model. Everything else is implementation details.

---

*Document Version: 2.0*
*Last Updated: 2026-01-19*
