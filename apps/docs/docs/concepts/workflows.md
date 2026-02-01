# Workflows

**The composition that brings everything together.**

---

A workflow is the top-level construct in Open Harness. It combines initial state, a start function, and phases into a single, runnable unit—the single source of truth for your AI application.

## Workflow Anatomy

```typescript
import { workflow, phase } from "@open-harness/core"

const taskPlanner = workflow({
  // Identity
  name: "task-planner",

  // Initial state shape and defaults
  initialState: {
    goal: "",
    tasks: [] as string[],
    currentTask: 0,
    result: null as string | null
  },

  // Transform input into initial state
  start: (input: string, draft) => {
    draft.goal = input
  },

  // The execution graph
  phases: {
    planning: { run: plannerAgent, next: "execution" },
    execution: { run: workerAgent, next: "review" },
    review: { run: reviewerAgent, next: "done" },
    done: phase.terminal()
  }
})
```

Every workflow has four parts:

| Part | Purpose |
|------|---------|
| `name` | Unique identifier for the workflow |
| `initialState` | Shape and default values of state |
| `start` | Function that transforms input into state |
| `phases` | The execution graph of agents and transitions |

## State: The Shape of Your Data

The `initialState` defines what data your workflow tracks:

```typescript
initialState: {
  // Input data
  topic: "",
  context: "",

  // Working data
  findings: [] as Finding[],
  drafts: [] as string[],

  // Output data
  summary: null as string | null,
  confidence: 0,

  // Metadata
  iterations: 0,
  startedAt: 0
}
```

**Best practices:**

- Type everything explicitly (use `as` for arrays and unions)
- Initialize with sensible defaults
- Include metadata for debugging (timestamps, iteration counts)
- Keep state flat when possible

## Start: Input → State

The `start` function transforms external input into workflow state:

```typescript
start: (input: { topic: string; depth: "shallow" | "deep" }, draft) => {
  draft.topic = input.topic
  draft.maxIterations = input.depth === "deep" ? 5 : 2
  draft.startedAt = Date.now()
}
```

This is where you:

- Validate and normalize input
- Set initial values based on input
- Configure workflow behavior

The `draft` uses Immer semantics—mutate it directly.

## Phases: The Execution Graph

Phases define how the workflow progresses:

```typescript
phases: {
  // First phase (determined by workflow execution)
  research: {
    run: researchAgent,
    next: "analyze"
  },

  // Middle phases
  analyze: {
    run: analysisAgent,
    next: (output) => output.needsMore ? "research" : "summarize"
  },

  // Conditional phase
  summarize: {
    run: summaryAgent,
    next: "done",
    when: (state) => state.findings.length > 0
  },

  // Terminal phase
  done: phase.terminal()
}
```

The first phase listed is where execution begins. Phases run their agent, then transition to `next`.

## Running a Workflow

Execute with the `run` function:

```typescript
import { run } from "@open-harness/core"
import { AnthropicProvider } from "@open-harness/server"

const execution = await run(taskPlanner, {
  // The input passed to start()
  input: "Build a REST API",

  // Execution mode
  mode: "live",  // or "playback" for recorded responses
})
```

### Observing Execution

Subscribe to events for real-time updates:

```typescript
execution.subscribe({
  // Lifecycle
  onStarted: (sessionId) => console.log("Started:", sessionId),
  onCompleted: ({ state }) => console.log("Done:", state),
  onErrored: (error) => console.error("Failed:", error),

  // State changes
  onStateChanged: (state, patches) => updateUI(state),
  onPhaseChanged: (phase, from) => console.log(`${from} → ${phase}`),

  // Agent events
  onAgentStarted: ({ agent }) => console.log("Agent:", agent),
  onAgentCompleted: ({ agent, output, durationMs }) => {
    console.log(`${agent} done in ${durationMs}ms`)
  },

  // Streaming
  onTextDelta: ({ delta }) => process.stdout.write(delta),

  // Human-in-the-loop
  onInputRequested: async (request) => {
    return await getUserInput(request.prompt)
  }
})
```

### Getting Results

Wait for completion:

```typescript
const result = await execution.result()

console.log(result.state)       // Final state
console.log(result.events)      // All events
console.log(result.sessionId)   // Session identifier
```

## Execution Modes

Workflows run in two modes:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `live` | Real API calls, responses recorded | Development, production |
| `playback` | Recorded responses replayed | Testing, CI |

```typescript
// Development: real API calls
const result = await run(workflow, {
  input: "...",
  mode: "live"
})

// Testing: recorded responses
const result = await run(workflow, {
  input: "...",
  mode: "playback"
})
```

This enables deterministic testing without mocks.

## Workflow Composition

Workflows are composable. One workflow can invoke another:

```typescript
const outerWorkflow = workflow({
  name: "outer",
  initialState: { result: null },
  start: (input, draft) => { /* ... */ },
  phases: {
    prepare: { run: prepareAgent, next: "inner" },
    inner: {
      run: async (state) => {
        // Run another workflow
        const innerResult = await run(innerWorkflow, {
          input: state.preparedData,
          mode: "live"
        })
        return innerResult.result().state
      },
      next: "finalize"
    },
    finalize: { run: finalizeAgent, next: "done" },
    done: phase.terminal()
  }
})
```

## Type Safety

Workflows are fully typed. TypeScript infers:

- State shape from `initialState`
- Input type from `start` function signature
- Output type from state

```typescript
// Type is inferred from initialState
type MyState = {
  goal: string
  tasks: string[]
  result: string | null
}

// Input type is explicit in start()
start: (input: { goal: string; priority: number }, draft) => {
  // draft is typed as MyState
  draft.goal = input.goal
}

// Result is typed
const result = await execution.result()
result.state.tasks  // string[] - fully typed
```

## Example: Research Workflow

A complete example with all concepts:

```typescript
import { workflow, phase, agent } from "@open-harness/core"
import { z } from "zod"

// Agents
const researcher = agent({
  name: "researcher",
  model: "claude-sonnet-4-5",
  output: z.object({
    findings: z.array(z.string()),
    confidence: z.number()
  }),
  prompt: (state) => `Research: ${state.topic}`,
  update: (output, draft) => {
    draft.findings.push(...output.findings)
    draft.confidence = output.confidence
  }
})

const summarizer = agent({
  name: "summarizer",
  model: "claude-sonnet-4-5",
  output: z.object({ summary: z.string() }),
  prompt: (state) => `Summarize: ${state.findings.join("\n")}`,
  update: (output, draft) => {
    draft.summary = output.summary
  }
})

// Workflow
const researchWorkflow = workflow({
  name: "research",

  initialState: {
    topic: "",
    findings: [] as string[],
    confidence: 0,
    summary: null as string | null,
    iterations: 0
  },

  start: (input: string, draft) => {
    draft.topic = input
  },

  phases: {
    research: {
      run: researcher,
      next: (output, state) => {
        if (output.confidence > 0.8) return "summarize"
        if (state.iterations >= 3) return "summarize"
        return "research"  // Loop for more findings
      }
    },
    summarize: {
      run: summarizer,
      next: "done"
    },
    done: phase.terminal()
  }
})

// Execute
const execution = await run(researchWorkflow, {
  input: "quantum computing applications",
  mode: "live"
})

const result = await execution.result()
console.log(result.state.summary)
```

## Summary

| Component | Role |
|-----------|------|
| `name` | Identifies the workflow |
| `initialState` | Defines state shape and defaults |
| `start` | Transforms input to initial state |
| `phases` | Defines execution graph |
| `run()` | Executes the workflow |

!!! success "Key Insight"
    The workflow is the single source of truth. Everything about your AI application—state shape, agents, transitions—is defined in one place.

---

## Next Steps

- [Building Workflows](../guides/building-workflows.md) — Practical guide to creating workflows
- [React Integration](../guides/react-integration.md) — Connect workflows to React UIs
- [API Reference](../api/reference.md) — Complete API documentation
