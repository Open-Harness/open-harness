# Open Harness Mental Model v2

> **The idea:** A workflow is a state machine driven by signals. AI agents are just another signal source.

---

## The Core Insight

Everything is a signal.

- User input? Signal.
- LLM response? Signal.
- Task complete? Signal.
- Error occurred? Signal.

Signals flow through the system. Handlers react. State changes. More signals flow. That's it.

---

## Five Concepts, No More

### 1. Signal

A typed message with a name and payload.

```typescript
type Signal<T> = {
  name: string;
  payload: T;
};
```

Signals are **data**. They carry meaning, not behavior. They don't know how to display themselves, how to be logged, or what should happen when they arrive.

**Naming convention:**
- Past tense for facts: `"task:completed"`, `"plan:created"`
- Imperative for requests: `"task:execute"`, `"review:start"`

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

State is the **single source of truth**. Everything else is derived.

---

### 3. Handler

A pure function: Signal + State → State + Signals

```typescript
type Handler<S, T> = (
  signal: Signal<T>,
  state: S
) => {
  state: S;
  signals: Signal[];
};
```

Handlers are where your logic lives:
- Update state based on the signal
- Decide what happens next (emit more signals)
- Keep it simple: one handler per signal type

**Handlers don't:**
- Call APIs
- Do I/O
- Know about other handlers
- Access anything outside their inputs

---

### 4. Agent

An AI actor. Agents activate on certain signals, call an LLM, and emit signals based on the result.

```typescript
type Agent = {
  name: string;
  activatesOn: string[];           // Signal names that wake this agent
  prompt: (state, signal) => string;  // What to send to the LLM
  emits: string[];                 // Signal types this agent produces
};
```

From the workflow's perspective, an agent is just another signal source. The LLM call is an implementation detail.

**The key insight:** Agents don't update state directly. They emit signals. Handlers update state.

---

### 5. Adapter

Transforms signal streams into output.

```typescript
type Adapter = {
  name: string;
  render: (signal: Signal) => Output | null;
};
```

Adapters are **pure observers**:
- See signals as they flow
- Transform them to output (terminal, logs, web)
- Cannot modify signals or state
- Cannot emit new signals

Each context defines its own rendering:

```typescript
// Terminal adapter
{ "task:completed": (s) => `✓ ${s.payload.title}` }

// Web adapter
{ "task:completed": (s) => <TaskComplete task={s.payload} /> }

// Log adapter
{ "task:completed": (s) => logger.info({ task: s.payload }) }
```

---

## The Loop

```
┌─────────────────────────────────────────────┐
│                                             │
│   Signal                                    │
│     │                                       │
│     ├──────────────────┐                    │
│     ▼                  ▼                    │
│   Handler           Adapters                │
│     │                  │                    │
│     ▼                  ▼                    │
│   State + Signals    Output                 │
│     │                                       │
│     └──────────────────────────────┐        │
│                                    ▼        │
│                              Next Signal    │
│                                             │
└─────────────────────────────────────────────┘
```

That's the entire runtime. Signals in, state changes, signals out, render to adapters.

---

## Recording & Replay

Since everything is signals, recording is trivial:

```
Record mode:  Signal stream → Store
Replay mode:  Store → Signal stream
```

Same handlers, same state transitions, same adapters. No LLM calls in replay - signals come from the recording instead.

---

## What This Enables

### Testability
Mock nothing. Record once, replay forever. Your tests use real signal streams.

### Debuggability
Every state change has a cause (a signal). Trace any bug back to its origin.

### Composability
Workflows are just handlers + agents. Combine them freely.

### Portability
Same workflow runs in CLI, web, or headless. Only adapters change.

---

## The Developer Experience

### Defining a Workflow

```typescript
const workflow = createWorkflow({
  // Your state shape
  state: { tasks: [], phase: "planning" },

  // Signal handlers
  handlers: {
    "plan:created": (signal, state) => ({
      state: { ...state, tasks: signal.payload.tasks, phase: "executing" },
      signals: [{ name: "task:next" }],
    }),
    // ...
  },

  // AI agents
  agents: {
    planner: {
      activatesOn: ["workflow:start"],
      prompt: (state) => `Create a plan for: ${state.goal}`,
      emits: ["plan:created"],
    },
  },

  // When to stop
  until: (state) => state.phase === "complete",
});
```

### Running It

```typescript
// Live mode - calls real LLM
const result = await workflow.run({
  adapters: [terminalAdapter({ renderers })],
});

// Record mode - saves signals
const result = await workflow.run({
  record: true,
  adapters: [terminalAdapter({ renderers })],
});

// Replay mode - no LLM calls
const result = await workflow.replay(recordingId, {
  adapters: [terminalAdapter({ renderers })],
});
```

### Custom Adapters

```typescript
const myAdapter = createAdapter({
  name: "my-dashboard",
  renderers: {
    "task:*": (signal) => sendToWebSocket(signal),
    "error:*": (signal) => alertOps(signal),
  },
});
```

---

## Non-Goals

Things Open Harness explicitly does NOT do:

- **Persistence** - Bring your own database
- **Scheduling** - Use cron, queues, whatever you have
- **Auth** - That's your app's concern
- **UI framework** - Adapters output data, you render it

Open Harness is the **workflow engine**. Everything else is your stack.

---

## Summary

| Concept | What it is | What it does |
|---------|------------|--------------|
| Signal | Typed message | Carries facts between components |
| State | Plain object | Single source of truth |
| Handler | Pure function | Reacts to signals, updates state |
| Agent | AI actor | Calls LLM, emits signals |
| Adapter | Observer | Renders signals to output |

Five concepts. One loop. That's the mental model.

---

*Version: 2.0*
*Status: Greenfield design for Effect rewrite*
