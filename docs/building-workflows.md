# Building Workflows

**Practical guide to agents, phases, and workflows.**

This document shows you how to build workflows. For conceptual background, read [Concepts](./concepts.md) first.

---

## Table of Contents

1. [The Three Primitives](#the-three-primitives)
2. [Agent](#1-agent) - Basic, with Tools, with Context
3. [Phase](#2-phase) - Sequential, Conditional, Looping, Parallel, Human-in-the-Loop
4. [Workflow](#3-workflow) - Simple and Phase workflows
5. [Running Workflows](#running-workflows) - Observer and Iterator patterns
6. [Server Mode](#server-mode) - OpenScaffold for production
7. [Advanced Patterns](#advanced-patterns) - Error handling, retry, snapshots, forking, variants
8. [Complete Example](#complete-example-research-workflow)

---

## The Three Primitives

There are exactly three building blocks: **Agent**, **Phase**, and **Workflow**.

---

## 1. Agent

An agent is a single LLM call with typed input and output.

### Basic Agent

```typescript
import { agent } from "@open-scaffold/core"
import { z } from "zod"

const planner = agent({
  name: "planner",
  model: "claude-sonnet-4-5",

  // REQUIRED: Schema for structured output
  output: z.object({
    tasks: z.array(z.object({
      title: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    })),
    reasoning: z.string(),
  }),

  // Generate prompt from current state
  prompt: (state) => `
    You are a project planner.
    Goal: ${state.goal}
    Existing tasks: ${JSON.stringify(state.tasks)}
    Generate the next batch of tasks.
  `,

  // Update state with agent output (Immer draft - mutate directly)
  update: (output, draft) => {
    draft.tasks.push(...output.tasks)
    draft.planningReasoning = output.reasoning
  },
})
```

### Agent Contract

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Unique identifier |
| `model` | `string` | LLM model (e.g. `"claude-sonnet-4-5"`) |
| `output` | `z.ZodType<O>` | Zod schema for structured output |
| `prompt` | `(state: S, ctx?: Ctx) => string` | Generate prompt from state |
| `update` | `(output: O, draft: Draft<S>, ctx?: Ctx) => void` | Update state with output |
| `options?` | `Record<string, unknown>` | Provider-specific options |

### State Updates Use Immer

The `draft` parameter is a mutable proxy. Mutate it directly:

```typescript
update: (output, draft) => {
  draft.items.push(output.newItem)     // Direct mutation
  draft.count = draft.items.length     // More mutations
  // Don't return - just mutate the draft
}
```

### Model Selection

Different agents can use different models:

```typescript
const classifier = agent({ model: "claude-haiku-4-5", ... })  // Cheap, fast
const architect = agent({ model: "claude-sonnet-4-5", ... })  // Smart
const judge = agent({ model: "claude-opus-4-5", ... })        // Strongest
```

### Agent with Tools

Pass tools through the `options` field. These are passed directly to the provider SDK:

```typescript
const coder = agent({
  name: "coder",
  model: "claude-sonnet-4-5",

  // Provider-specific options including tools
  options: {
    tools: [
      { type: "preset", preset: "claude_code" },  // Anthropic Claude Code preset
    ],
    temperature: 0.7,
    maxTokens: 4096,
  },

  output: z.object({
    code: z.string(),
    explanation: z.string(),
  }),

  prompt: (state) => `Write code for: ${state.task}`,

  update: (output, draft) => {
    draft.code = output.code
    draft.explanation = output.explanation
  },
})
```

Common tool configurations:

```typescript
// Claude Code preset (file editing, bash, etc.)
options: {
  tools: [{ type: "preset", preset: "claude_code" }],
  permissionMode: "acceptEdits",  // Auto-accept file edits
}

// Custom tools (MCP or function-based)
options: {
  tools: [
    {
      type: "function",
      function: {
        name: "search_database",
        description: "Search the product database",
        parameters: { type: "object", properties: { query: { type: "string" } } },
      }
    }
  ],
}
```

### Agent with Context (forEach Pattern)

When an agent runs inside a phase with `forEach`, it receives context as a second parameter:

```typescript
interface TaskContext {
  task: Task
  index: number
}

const taskWorker = agent<State, WorkerOutput, TaskContext>({
  name: "task-worker",
  model: "claude-sonnet-4-5",

  output: z.object({
    result: z.string(),
    success: z.boolean(),
  }),

  // Second parameter is the context from forEach
  prompt: (state, ctx) => `
    Working on task ${ctx.index + 1} of ${state.tasks.length}:
    Task: ${ctx.task.description}
    Project goal: ${state.goal}
  `,

  // Third parameter in update is also the context
  update: (output, draft, ctx) => {
    const task = draft.tasks.find(t => t.id === ctx.task.id)
    if (task) {
      task.result = output.result
      task.completed = output.success
    }
  },
})

// Phase that uses this agent with forEach
const executionPhase = {
  run: taskWorker,
  forEach: (state) => state.tasks
    .filter(t => !t.completed)
    .map((task, index) => ({ task, index })),
  parallel: 3,  // Run up to 3 tasks concurrently
  until: (state) => state.tasks.every(t => t.completed),
  next: "review",
}
```

---

## 2. Phase

A phase is a named stage that runs an agent, collects human input, or both.

### Sequential Phases (A -> B -> C -> done)

The simplest pattern: linear progression through phases.

```typescript
import { phase } from "@open-scaffold/core"

const workflow = workflow({
  name: "linear-flow",
  initialState: { /* ... */ },
  start: (input, draft) => { /* ... */ },
  phases: {
    research: { run: researcher, next: "analyze" },
    analyze: { run: analyzer, next: "summarize" },
    summarize: { run: summarizer, next: "done" },
    done: phase.terminal(),
  }
})
```

### Conditional Transitions

Use a function for `next` to choose the destination based on state:

```typescript
const reviewPhase = {
  run: reviewer,
  next: (state) => {
    if (state.score >= 9) return "done"
    if (state.score >= 7) return "polish"
    return "rewrite"  // Score below 7, start over
  },
}
```

### Looping Phases

Use `until` to loop an agent until a condition is met:

```typescript
// Agent phase - runs until condition is satisfied
const planningPhase = {
  run: planner,
  until: (state) => state.tasks.length >= 10,  // Keep running until 10 tasks
  next: "execution",
}

// Loop with output check (until receives agent output as second param)
const refinementPhase = {
  run: refiner,
  until: (state, output) => output?.quality === "excellent",
  next: "done",
}
```

### Parallel Execution

Use `forEach` to run agents in parallel across multiple contexts:

```typescript
const executionPhase = {
  run: taskExecutor,
  forEach: (state) => state.tasks.filter(t => !t.done),  // Context per task
  parallel: 5,  // Max 5 concurrent agent calls
  until: (state) => state.tasks.every(t => t.done),
  next: "review",
}
```

### Human-in-the-Loop Phase

```typescript
// Human phase - requests input from a person
const reviewPhase = {
  human: {
    prompt: (state) => `Review the plan:\n${formatTasks(state.tasks)}`,
    type: "approval",
  },
  onResponse: (response, draft) => {
    draft.approved = response === "approve"
  },
  next: (state) => state.approved ? "execution" : "planning",
}

// Terminal phase - workflow ends here
const donePhase = phase.terminal()
```

### Phase Contract

| Field | Type | Purpose |
|-------|------|---------|
| `run?` | `AgentDef` | Agent to execute |
| `human?` | `HumanConfig` | Human input request |
| `onResponse?` | `(response: string, draft) => void` | Process human response |
| `until?` | `(state: S, output?: unknown) => boolean` | Loop until true |
| `next?` | `string \| (state: S) => string` | Next phase (static or dynamic) |
| `forEach?` | `(state: S) => ReadonlyArray<Ctx>` | Contexts for parallel execution |
| `parallel?` | `number` | Max concurrent executions |
| `terminal?` | `boolean` | Marks workflow end |

### Phase Execution Flow

```
Enter phase
  -> Run agent (or request human input)
  -> Update state
  -> Check `until` predicate
     -> false: loop (run agent again)
     -> true (or no until): evaluate `next`
        -> static string: go to that phase
        -> function: call with state, go to result
        -> terminal: workflow ends
```

---

## 3. Workflow

A workflow ties everything together. There are two forms.

### Simple Workflow (Single Agent)

For straightforward tasks where one agent loops until done:

```typescript
import { workflow } from "@open-scaffold/core"

const summarizer = workflow({
  name: "document-summarizer",
  initialState: { chunks: [] as string[], summary: "" },

  start: (input, draft) => {
    draft.chunks = splitIntoChunks(input)
  },

  agent: summaryAgent,
  until: (state) => state.chunks.length === 0,
})
```

### Phase Workflow (State Machine)

For complex, multi-stage processes:

```typescript
const projectBuilder = workflow({
  name: "project-builder",

  initialState: {
    goal: "",
    tasks: [] as Task[],
    completedTasks: [] as Task[],
    approved: false,
  },

  start: (input, draft) => {
    draft.goal = input
  },

  phases: {
    planning: {
      run: planner,
      until: (state) => state.tasks.length >= 5,
      next: "review",
    },
    review: {
      human: {
        prompt: (state) => `Review ${state.tasks.length} tasks`,
        type: "approval",
      },
      onResponse: (response, draft) => {
        draft.approved = response === "approve"
      },
      next: (state) => state.approved ? "execution" : "planning",
    },
    execution: {
      run: executor,
      forEach: (state) => state.tasks.filter(t => !t.done),
      parallel: 3,
      until: (state) => state.tasks.every(t => t.done),
      next: "done",
    },
    done: phase.terminal(),
  },
})
```

### Workflow Contract

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Unique identifier |
| `initialState` | `S` | Starting state object |
| `start` | `(input: Input, draft: Draft<S>) => void` | Initialize state from input |
| `agent?` | `AgentDef` | For simple workflows: the single agent |
| `until?` | `(state: S) => boolean` | For simple workflows: loop exit condition |
| `phases?` | `Record<string, PhaseDef>` | For phase workflows: named phases |
| `startPhase?` | `string` | Override starting phase (default: first key) |

---

## Running Workflows

### The Observer Pattern (Recommended)

Use `run()` with observer callbacks:

```typescript
import { run } from "@open-scaffold/core"
import { AnthropicProvider } from "@open-scaffold/server"

const result = await run(myWorkflow, {
  input: "Build a REST API",
  runtime: {
    providers: { "claude-sonnet-4-5": AnthropicProvider() },
    mode: "live"
  },
  observer: {
    // Lifecycle
    onStarted: (sessionId) => console.log("Session:", sessionId),
    onCompleted: ({ state, events }) => console.log("Done!", state),
    onErrored: (error) => console.error("Failed:", error),

    // State changes
    onStateChanged: (state, patches) => updateUI(state),
    onPhaseChanged: (phase, from) => console.log(`${from} → ${phase}`),

    // Agent lifecycle
    onAgentStarted: ({ agent, phase }) => showSpinner(agent),
    onAgentCompleted: ({ agent, output, durationMs }) => hideSpinner(agent),

    // Streaming
    onTextDelta: ({ agent, delta }) => appendToOutput(delta),
    onThinkingDelta: ({ agent, delta }) => appendToThinking(delta),

    // Tools
    onToolCall: ({ toolName, input }) => logToolCall(toolName, input),
    onToolResult: ({ output, isError }) => logToolResult(output),

    // Human-in-the-loop (async - return the response)
    onInputRequested: async (request) => {
      const response = await showApprovalDialog(request.prompt)
      return response  // "approve" or "reject" or custom string
    },

    // Raw catch-all (optional)
    onEvent: (event) => logEvent(event)
  }
})

console.log("Final state:", result.state)
```

### Observer Callbacks

All callbacks are optional. Implement only what you need:

| Callback | Signature | Purpose |
|----------|-----------|---------|
| `onStarted` | `(sessionId: string) => void` | Workflow began |
| `onCompleted` | `({ state, events }) => void` | Workflow finished |
| `onErrored` | `(error: unknown) => void` | Workflow failed |
| `onStateChanged` | `(state, patches?) => void` | State updated |
| `onPhaseChanged` | `(phase, from?) => void` | Phase transition |
| `onAgentStarted` | `({ agent, phase? }) => void` | Agent began |
| `onAgentCompleted` | `({ agent, output, durationMs }) => void` | Agent finished |
| `onTextDelta` | `({ agent, delta }) => void` | Text chunk streamed |
| `onThinkingDelta` | `({ agent, delta }) => void` | Thinking chunk streamed |
| `onToolCall` | `({ toolName, toolId, input }) => void` | Tool invoked |
| `onToolResult` | `({ toolId, output, isError }) => void` | Tool returned |
| `onInputRequested` | `(request) => Promise<string>` | HITL - return response |
| `onEvent` | `(event) => void` | Raw event catch-all |

---

## Parallel Execution

Phases support parallel agent execution via `forEach`:

```typescript
const executionPhase = {
  run: taskExecutor,

  // Generate one context per pending task
  forEach: (state) => state.tasks.filter(t => !t.done),

  // Max 5 concurrent agent calls
  parallel: 5,

  // Keep looping until all tasks done
  until: (state) => state.tasks.every(t => t.done),

  next: "review",
}
```

When `forEach` is present, the agent receives a context parameter:

```typescript
const taskExecutor = agent({
  name: "task-executor",
  model: "claude-sonnet-4-5",
  output: z.object({ result: z.string(), done: z.boolean() }),

  // Second param is the context item from forEach
  prompt: (state, task) => `
    Complete this task: ${task.title}
    Project goal: ${state.goal}
  `,

  // Third param is the context item
  update: (output, draft, task) => {
    const t = draft.tasks.find(t => t.title === task.title)
    if (t) {
      t.result = output.result
      t.done = output.done
    }
  },
})
```

---

## Human-in-the-Loop (HITL)

Human phases pause the workflow and wait for input. Handle them via `onInputRequested`:

### Input Types

```typescript
// Freeform text input
human: {
  prompt: (state) => "Describe what you want:",
  type: "freeform",
}

// Binary approval
human: {
  prompt: (state) => `Approve this plan?\n${state.plan}`,
  type: "approval",
}

// Multiple choice
human: {
  prompt: (state) => "Which approach?",
  type: "choice",
  options: ["conservative", "aggressive", "balanced"],
}
```

### Handling in Observer

```typescript
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: { providers, mode: "live" },
  observer: {
    onInputRequested: async (request) => {
      // request.prompt - the prompt text
      // request.type - "freeform" | "approval" | "choice"
      // request.options - for choice type

      if (request.type === "approval") {
        const approved = await showApprovalDialog(request.prompt)
        return approved ? "approve" : "reject"
      }

      if (request.type === "choice") {
        return await showChoiceDialog(request.prompt, request.options)
      }

      return await showInputDialog(request.prompt)
    }
  }
})
```

---

## State Design Patterns

### Accumulator Pattern

State grows as agents add to it:

```typescript
initialState: {
  goal: "",
  discoveries: [] as Discovery[],
  plan: null as Plan | null,
  artifacts: [] as Artifact[],
}
```

### Phase-Local State

Nested objects for phase-specific data:

```typescript
initialState: {
  input: "",
  research: {
    queries: [] as string[],
    findings: [] as Finding[],
    complete: false,
  },
  synthesis: {
    outline: null as Outline | null,
    draft: "",
  },
}
```

### Task Queue Pattern

For parallel execution with progress tracking:

```typescript
initialState: {
  pending: [] as Task[],
  inProgress: [] as Task[],
  completed: [] as Task[],
  failed: [] as Task[],
}
```

### Async Iterator Pattern

For fine-grained control, use `execute()` which returns an async iterator:

```typescript
import { execute } from "@open-scaffold/core"

const execution = execute(myWorkflow, {
  input: "Build a REST API",
  runtime: {
    providers: { "claude-sonnet-4-5": AnthropicProvider() },
    mode: "live"
  }
})

// Session ID is available immediately
console.log("Session:", execution.sessionId)

// Iterate over events as they occur
for await (const event of execution) {
  console.log(event.name, event.payload)

  // Handle HITL prompts (phase-level HITL uses promptText)
  if (event.name === "input:requested") {
    const payload = event.payload as { promptText: string }
    const response = await getUserInput(payload.promptText)
    execution.respond(response)
  }
}

// Get final result after iteration completes
const result = await execution.result
console.log("Final state:", result.state)
```

### Execution Control Methods

The `execute()` return value provides control methods:

```typescript
const execution = execute(myWorkflow, options)

// Respond to HITL prompts
execution.respond("approve")

// Pause/resume execution
await execution.pause()
console.log("Paused:", execution.isPaused)
await execution.resume()

// Abort execution entirely
execution.abort()
```

### Convenience Functions

For simpler use cases:

```typescript
import { runSimple, runWithText } from "@open-scaffold/core"

// Just get the result, no callbacks
const result = await runSimple(myWorkflow, "Build an API", {
  providers: { "claude-sonnet-4-5": AnthropicProvider() }
})

// Collect all streamed text output
const { text, result } = await runWithText(myWorkflow, "Generate code", {
  providers: { "claude-sonnet-4-5": AnthropicProvider() }
})
console.log("Generated text:", text)
```

---

## Server Mode

For production deployments, use `OpenScaffold` from the server package.

### Basic Server Setup

```typescript
import { OpenScaffold, AnthropicProvider } from "@open-scaffold/server"

// Create OpenScaffold instance with Anthropic provider
const scaffold = OpenScaffold.create({
  database: "./data/app.db",  // LibSQL database path
  mode: "live",               // "live" or "playback"
  providers: {
    "claude-sonnet-4-5": AnthropicProvider(),
  },
})

// Create and start HTTP server (default port: 42069)
const server = scaffold.createServer({
  workflow: myWorkflow,
})

await server.start()
console.log(`Server running on port ${server.port}`)
```

### Server API Endpoints

The server exposes these HTTP endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Start a new session |
| `GET` | `/sessions/:id` | Get session state and events |
| `GET` | `/sessions/:id/events` | SSE stream of events |
| `POST` | `/sessions/:id/respond` | Submit HITL response |
| `GET` | `/health` | Health check |

### Session Management

```typescript
// List all sessions
const sessions = await scaffold.listSessions()
for (const session of sessions) {
  console.log(`${session.id}: ${session.workflowName} (${session.eventCount} events)`)
}

// Get the provider recorder for advanced use
const recorder = await scaffold.getProviderRecorder()

// Clean up when done
await scaffold.dispose()
```

### Playback Mode

In playback mode, the server uses recorded API responses instead of calling the LLM:

```typescript
const scaffold = OpenScaffold.create({
  database: "./data/app.db",
  mode: "playback",  // Use cached responses
  providers: { "claude-sonnet-4-5": AnthropicProvider() },
})
```

This is useful for:
- Deterministic testing
- Cost-free development iteration
- Debugging past sessions

---

## Advanced Patterns

### Error Handling

Workflows emit typed errors that you can catch in the observer:

```typescript
import {
  WorkflowAgentError,
  WorkflowValidationError,
  WorkflowProviderError,
  WorkflowAbortedError,
} from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build API",
  runtime,
  observer: {
    onErrored: (error) => {
      if (error instanceof WorkflowAgentError) {
        console.error(`Agent ${error.agentName} failed:`, error.message)
      } else if (error instanceof WorkflowValidationError) {
        console.error(`Output validation failed for ${error.agentName}:`, error.message)
      } else if (error instanceof WorkflowProviderError) {
        console.error(`Provider error (${error.code}):`, error.message)
        if (error.retryable) {
          // Could implement retry logic here
        }
      } else if (error instanceof WorkflowAbortedError) {
        console.log("Workflow was aborted:", error.reason)
      }
    }
  }
})
```

### Provider Error Codes

The `WorkflowProviderError` includes a typed `code` field:

| Code | Description | Retryable |
|------|-------------|-----------|
| `RATE_LIMITED` | API rate limit exceeded | Yes |
| `CONTEXT_EXCEEDED` | Context window exceeded | No |
| `AUTH_FAILED` | Authentication failed | No |
| `NETWORK` | Network connectivity issue | Yes |
| `UNKNOWN` | Unknown provider error | Maybe |

### Retry Logic with Abort Signal

Use the abort signal for timeout-based retries:

```typescript
async function runWithRetry<S>(
  workflow: WorkflowDef<S>,
  input: string,
  maxRetries = 3
): Promise<WorkflowResult<S>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60_000)

    try {
      const result = await run(workflow, {
        input,
        runtime,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof WorkflowProviderError && error.retryable) {
        console.log(`Attempt ${attempt} failed, retrying...`)
        await new Promise(r => setTimeout(r, 1000 * attempt))
        continue
      }
      throw error
    }
  }
  throw new Error("Max retries exceeded")
}
```

### State Snapshots

State is automatically snapshotted at phase boundaries. Access snapshots via the server:

```typescript
// Snapshots are stored in the database alongside events
// Access via the StateSnapshotStore service

// In server context:
import { Effect } from "effect"
import { Services } from "@open-scaffold/core"

const getSnapshot = Effect.gen(function*() {
  const store = yield* Services.StateSnapshotStore
  const snapshot = yield* store.get(sessionId)
  return snapshot  // { sessionId, state, position, phase, createdAt }
})
```

### Forking Sessions

Fork an existing session to create a branch point (useful for A/B testing):

```typescript
import { forkSession } from "@open-scaffold/server"
import { Effect } from "effect"

// Fork creates a new session with copied events
const fork = Effect.gen(function*() {
  const result = yield* forkSession(originalSessionId)
  console.log(`Forked ${result.eventsCopied} events to ${result.newSessionId}`)
  return result.newSessionId
})
```

Note: Forking copies events up to the current position. You cannot time-travel and fork from an arbitrary past point (re-running agents would give different results).

### Workflow Variants (for Evaluations)

Create workflow variants to compare different configurations:

```typescript
// Base workflow
const myWorkflow = workflow({
  name: "api-builder",
  initialState: { goal: "", tasks: [], code: "" },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: planner, next: "coding" },
    coding: { run: coder, next: "done" },
    done: phase.terminal()
  }
})

// Create variant with different model
const opusVariant = {
  ...myWorkflow,
  phases: {
    ...myWorkflow.phases,
    planning: {
      ...myWorkflow.phases.planning,
      run: { ...planner, model: "claude-opus-4-5" }
    }
  }
}

// Create variant with different prompt
const promptV2Variant = {
  ...myWorkflow,
  phases: {
    ...myWorkflow.phases,
    planning: {
      ...myWorkflow.phases.planning,
      run: {
        ...planner,
        prompt: (s) => `You are an expert architect. ${s.goal}`
      }
    }
  }
}

// Run variants for comparison
const results = await Promise.all([
  run(myWorkflow, { input: "Build API", runtime }),
  run(opusVariant, { input: "Build API", runtime }),
  run(promptV2Variant, { input: "Build API", runtime }),
])
```

---

## Long-Horizon Workflow Patterns

### Plan-Execute-Verify

The most common pattern for complex tasks:

```typescript
phases: {
  planning: {
    run: plannerAgent,
    until: (state) => state.plan !== null,
    next: "review",
  },
  review: {
    human: { prompt: (s) => formatPlan(s.plan), type: "approval" },
    onResponse: (r, d) => { d.planApproved = r === "approve" },
    next: (s) => s.planApproved ? "execution" : "planning",
  },
  execution: {
    run: executorAgent,
    forEach: (s) => s.plan.steps.filter(step => !step.done),
    parallel: 3,
    until: (s) => s.plan.steps.every(step => step.done),
    next: "verification",
  },
  verification: {
    run: verifierAgent,
    next: (s) => s.allPassing ? "done" : "planning",
  },
  done: phase.terminal(),
}
```

### Iterative Refinement

Agent loops with quality gates:

```typescript
phases: {
  draft: { run: drafterAgent, next: "critique" },
  critique: {
    run: criticAgent,
    next: (state) => state.score >= 8 ? "done" : "revise",
  },
  revise: {
    run: reviserAgent,
    until: (state) => state.revisionCount >= 3,
    next: "critique",
  },
  done: phase.terminal(),
}
```

### Map-Reduce

Parallel processing with aggregation:

```typescript
phases: {
  decompose: {
    run: decomposerAgent,
    next: "solve",
  },
  solve: {
    run: solverAgent,
    forEach: (state) => state.subProblems,
    parallel: 5,
    until: (state) => state.subProblems.every(sp => sp.solved),
    next: "synthesize",
  },
  synthesize: {
    run: synthesizerAgent,
    next: "done",
  },
  done: phase.terminal(),
}
```

---

## Complete Example: Research Workflow

### Define Agents

```typescript
import { agent } from "@open-scaffold/core"
import { z } from "zod"

const researcher = agent({
  name: "researcher",
  model: "claude-sonnet-4-5",
  output: z.object({
    findings: z.array(z.string()),
    summary: z.string()
  }),
  prompt: (state) => `
    Research the topic: ${state.topic}
    Provide detailed findings and a summary.
  `,
  update: (output, draft) => {
    draft.findings = output.findings
    draft.summary = output.summary
  }
})

const reviewer = agent({
  name: "reviewer",
  model: "claude-sonnet-4-5",
  output: z.object({
    approved: z.boolean(),
    feedback: z.string()
  }),
  prompt: (state) => `
    Review these research findings for: ${state.topic}
    Findings: ${state.findings.join(", ")}
    Summary: ${state.summary}
  `,
  update: (output, draft) => {
    draft.approved = output.approved
    draft.feedback = output.feedback
  }
})
```

### Define Workflow

```typescript
import { workflow, phase } from "@open-scaffold/core"

interface ResearchState {
  topic: string
  findings: string[]
  summary: string
  approved: boolean
  feedback: string
}

const researchWorkflow = workflow({
  name: "research-flow",
  initialState: {
    topic: "",
    findings: [],
    summary: "",
    approved: false,
    feedback: ""
  } as ResearchState,
  start: (input, draft) => { draft.topic = input },
  phases: {
    research: { run: researcher, next: "review" },
    review: { run: reviewer, next: "done" },
    done: phase.terminal()
  }
})
```

### Execute with Observer

```typescript
import { run } from "@open-scaffold/core"

const result = await run(researchWorkflow, {
  input: "quantum computing advances",
  runtime: {
    providers: { "claude-sonnet-4-5": AnthropicProvider() },
    mode: "live"
  },
  observer: {
    onPhaseChanged: (phase, from) => console.log(`Phase: ${from} → ${phase}`),
    onStateChanged: (state) => console.log("Findings:", state.findings.length),
    onTextDelta: ({ delta }) => process.stdout.write(delta),
    onAgentCompleted: ({ agent, durationMs }) => {
      console.log(`\n${agent} completed in ${durationMs}ms`)
    }
  }
})

console.log("Final summary:", result.state.summary)
```

---

## Next Steps

- [React Integration](./react-integration.md) -- Connect a React UI
- [API Reference](./api-reference.md) -- Complete type signatures
- [Architecture](./architecture.md) -- How the system works internally
