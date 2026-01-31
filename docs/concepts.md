# Core Concepts

**How to think about Open Scaffold.**

Read this first. These mental models will help you understand why the SDK works the way it does.

---

## The Big Picture

Open Scaffold is a **state-first workflow runtime** for AI agents. You define:

- **Agents** -- AI actors with a model, prompt, output schema, and state update function
- **Phases** -- Named stages that control workflow progression
- **Workflows** -- Compositions of agents and phases with initial state

The runtime manages execution, persistence, and streaming. You build the workflow, then execute it or connect a UI.

```
┌─────────────────────────────────────────────────────────┐
│  YOUR WORKFLOW                                          │
│                                                         │
│  State -> Agent reads state -> Output -> Update state   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         │
                    HTTP/SSE
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  YOUR UI (Client)                                       │
│                                                         │
│  React, Terminal, Mobile, whatever                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Events Are the Truth

Everything that happens is recorded as an **event**. Events are immutable facts about what occurred.

```typescript
// Events use past tense - they're facts, not commands
"workflow:started"    // Workflow began
"agent:started"       // An agent began working
"agent:completed"     // An agent finished
"state:updated"       // State changed
"input:requested"     // Human input needed
```

**Why events?**

Think of your workflow as a **VCR tape**. Events are recorded as they happen. State is just "where we are on the tape."

```
TAPE (Events)
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ E1 │ E2 │ E3 │ E4 │ E5 │ E6 │ E7 │ E8 │  <- Events
└────┴────┴────┴────┴────┴────┴────┴────┘
                          ▲
                     current position
                          │
                     STATE (derived)
```

**State is derived from events.** This enables:

| Capability | How It Works |
|------------|--------------|
| **Replay** | Reconstruct any past state by replaying events |
| **Debug** | See exactly what happened, step by step |
| **Fork** | Branch from any point for "what if" scenarios |
| **Audit** | Complete, immutable history of the workflow |

If you lose state, replay the tape to rebuild it. Events are the source of truth.

---

## 2. Agents Are Functions

An **agent** is a single LLM call with typed input and output. Think of it as a pure function:

```
Input (state) → LLM → Structured Output → Side Effect (state update)
```

Agents have no memory between invocations. They're stateless.

```typescript
const planner = agent({
  name: "planner",
  model: "claude-sonnet-4-5",

  // Schema for structured output
  output: z.object({
    tasks: z.array(z.string()),
    reasoning: z.string()
  }),

  // Generate prompt from current state
  prompt: (state) => `Create a plan for: ${state.goal}`,

  // Update state with agent output (Immer draft - mutate directly)
  update: (output, draft) => {
    draft.tasks = output.tasks
  }
})
```

**The lifecycle:**

```
Phase activates agent
       ↓
Build prompt from state
       ↓
Call LLM (streaming)
       ↓
Parse with output schema
       ↓
Call update(output, draft)
       ↓
Advance to next phase
```

**Why structured output?** Agents must have an `output` schema. This ensures:

1. **Reliability** -- LLM output is validated
2. **Type Safety** -- `update` receives typed data
3. **Determinism** -- Output maps cleanly to state updates

No free-text parsing, no regex extraction. The LLM returns structured data or the call fails.

**Provider-agnostic:** Agents work with any AI provider. The SDK handles the provider-specific details.

---

## 3. Phases Are Stages

**Phases** are named stages in your workflow. Each phase runs an agent and specifies where to go next.

```typescript
const myWorkflow = workflow({
  name: "task-planner",
  initialState: { goal: "", tasks: [], result: null },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: plannerAgent, next: "execution" },
    execution: { run: workerAgent, next: "review" },
    review: { run: judgeAgent, next: "done" },
    done: phase.terminal()
  }
})
```

**Phase capabilities:**

| Pattern | Example | Use Case |
|---------|---------|----------|
| **Sequential** | `planning → execution → review` | Standard pipeline |
| **Loop** | `review → { next: needsRework ? "execution" : "done" }` | Retry until satisfied |
| **Branch** | `triage → { next: urgent ? "fast" : "normal" }` | Conditional paths |
| **Terminal** | `phase.terminal()` | Workflow complete |

**Phase rules:**

1. Each phase has a unique name
2. Each non-terminal phase runs exactly one agent
3. Each phase specifies `next` (or is terminal)
4. Terminal phase means workflow is complete

Phases give you explicit control over workflow progression. No hidden state machines.

---

## 4. Workflows Are Compositions

A **workflow** combines everything: initial state, a start function, and phases.

```typescript
const taskPlanner = workflow({
  // Workflow identity
  name: "task-planner",

  // Initial state shape
  initialState: {
    goal: "",
    tasks: [],
    currentTask: 0,
    result: null
  },

  // Start function: input → initial state mutation
  start: (input: string, draft) => {
    draft.goal = input
  },

  // Phases define the execution graph
  phases: {
    planning: { run: plannerAgent, next: "execution" },
    execution: { run: workerAgent, next: "review" },
    review: { run: judgeAgent, next: "done" },
    done: phase.terminal()
  }
})
```

**The workflow is the single source of truth:**

- `initialState` -- The shape and defaults of your state
- `start` -- How input becomes initial state
- `phases` -- The complete execution graph

Run the workflow:

```typescript
const result = await run(taskPlanner, {
  input: "Build a REST API",
  runtime: { providers, mode: "live" }
})

console.log(result.state) // Final state after all phases
```

---

## 5. Observer Pattern

The primary way to interact with a running workflow is through **observers** -- callbacks that fire as things happen.

```typescript
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: { providers, mode: "live" },
  observer: {
    // === Lifecycle ===
    onStarted: (sessionId) => console.log("Started:", sessionId),
    onCompleted: ({ state }) => console.log("Done:", state),
    onErrored: (error) => console.error("Failed:", error),

    // === State ===
    onStateChanged: (state) => updateUI(state),
    onPhaseChanged: (phase, from) => console.log(`${from} → ${phase}`),

    // === Agent Lifecycle ===
    onAgentStarted: ({ agent }) => console.log("Agent starting:", agent),
    onAgentCompleted: ({ agent, output, durationMs }) => {
      console.log(`${agent} completed in ${durationMs}ms`)
    },

    // === Streaming ===
    onTextDelta: ({ delta }) => appendToOutput(delta),
    onThinkingDelta: ({ delta }) => appendToThinking(delta),

    // === Tools ===
    onToolCall: ({ name, args }) => console.log("Calling tool:", name),
    onToolResult: ({ name, result }) => console.log("Tool result:", result),

    // === Human-in-the-Loop ===
    onInputRequested: async (request) => {
      // Return the user's response (async)
      return await showApprovalDialog(request.prompt)
    },

    // === Raw Events ===
    onEvent: (event) => logToAnalytics(event)
  }
})
```

**Observer categories:**

| Category | Callbacks | Purpose |
|----------|-----------|---------|
| **Lifecycle** | `onStarted`, `onCompleted`, `onErrored` | Workflow start/end |
| **State** | `onStateChanged`, `onPhaseChanged` | State updates |
| **Agent** | `onAgentStarted`, `onAgentCompleted` | Agent lifecycle |
| **Streaming** | `onTextDelta`, `onThinkingDelta` | Real-time output |
| **Tools** | `onToolCall`, `onToolResult` | Tool execution |
| **HITL** | `onInputRequested` | Human input (async) |
| **Raw** | `onEvent` | All events (catch-all) |

**Why observers?**

- Clean separation between workflow logic and UI
- No manual event filtering
- Typed callbacks for each event type
- Human-in-the-loop is just another callback that returns a Promise

---

## 6. Recording and Replay

The system has **two modes** for AI providers:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **live** | Call real APIs, automatically record responses | Development, production |
| **playback** | Replay recorded responses, no API calls | Testing, CI |

```typescript
// Live mode - calls API, records responses
const result = await run(workflow, {
  input: "...",
  runtime: { providers, mode: "live" }
})

// Playback mode - replays recordings, no API calls
const result = await run(workflow, {
  input: "...",
  runtime: { providers, mode: "playback" }
})
```

**Why recording?**

Testing AI workflows is hard. API calls are:
- **Non-deterministic** -- Same input can produce different output
- **Slow** -- Network latency adds up
- **Expensive** -- API calls cost money

Recording solves this:

1. **Record once** in live mode during development
2. **Replay forever** in playback mode for tests
3. **Deterministic tests** without mocks or stubs
4. **Fast CI** -- no network calls
5. **Free tests** -- no API charges

The recorder captures the exact stream events from the provider, so playback is indistinguishable from live execution.

---

## Summary

| Concept | Mental Model |
|---------|--------------|
| **Events** | Immutable facts; state is derived from replaying them |
| **Agents** | Pure functions: state → LLM → structured output → state update |
| **Phases** | Named stages with explicit next (can loop, branch, terminate) |
| **Workflows** | Composition of initial state + start + phases |
| **Observers** | Callbacks for lifecycle, streaming, tools, and HITL |
| **Recording** | Live mode records, playback mode replays for deterministic tests |

**Key insight:** Events are the source of truth. Everything else -- state, UI, history -- is derived from events.

---

## Next Steps

- [Building Workflows](./building-workflows.md) -- Practical guide to agents, phases, workflows
- [React Integration](./react-integration.md) -- Connect a React UI with hooks
- [API Reference](./api-reference.md) -- Complete type signatures and functions
