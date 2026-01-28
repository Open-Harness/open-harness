# OpenScaffold SDK: Workflow Design Guide

**Audience:** An agent designing long-horizon agentic workflows. You will not have access to the SDK source code. This document gives you everything you need to design and write workflows.

---

## 1. Mental Model

OpenScaffold is a **state-first workflow runtime**. Think of it as a state machine where LLM agents are the transition functions.

The core loop is:

```
State -> Agent reads state -> Agent produces output -> Output updates state -> Repeat
```

Every workflow has a **state object** that is the single source of truth. Agents don't talk to each other directly. They read state, do work, and write back to state. This makes workflows deterministic, replayable, and debuggable.

### Key Principles

1. **State is prime.** The state object is the only shared context. Agents are pure functions from `(state) -> output`. There is no hidden context, no side channels.

2. **Agents are stateless.** An agent receives the current state, generates a prompt from it, calls an LLM, validates the output against a Zod schema, and updates state via an Immer draft. That's it. An agent has no memory between invocations.

3. **Phases are control flow.** For complex workflows, phases act as named stages in a state machine. Each phase runs an agent (or requests human input), then transitions to the next phase based on state.

4. **Events are exhaust.** Every action emits typed events (`workflow:started`, `agent:completed`, `state:updated`, etc.). These drive the UI, enable recording/playback, and provide a complete audit trail. You don't need to think about events when designing workflows.

5. **Structured output only.** Every agent must declare a Zod schema for its output. The LLM is constrained to produce valid JSON matching that schema. No free-text parsing, no regex extraction.

---

## 2. The Three Primitives

There are exactly three building blocks: **Agent**, **Phase**, and **Workflow**.

### 2.1 Agent

An agent is a single LLM call with typed input and output.

```typescript
import { agent } from "@open-scaffold/core"
import { z } from "zod"

const planner = agent({
  name: "planner",
  model: "claude-sonnet-4-5",
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

**The agent contract:**

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Unique identifier |
| `model` | `string` | LLM model to use (e.g. `"claude-sonnet-4-5"`) |
| `output` | `z.ZodType<O>` | Zod schema for structured output |
| `prompt` | `(state: S) => string` | Generate prompt from state |
| `update` | `(output: O, draft: Draft<S>) => void` | Update state with output |
| `options?` | `Record<string, unknown>` | Provider-specific options (temperature, tools, etc.) |

**State updates use Immer.** The `draft` parameter is a mutable proxy of the state. You mutate it directly (`draft.items.push(...)`) and Immer produces an immutable update. Never return from `update` - just mutate the draft.

### 2.2 Phase

A phase is a named stage in a workflow that runs an agent, collects human input, or both.

```typescript
import { phase } from "@open-scaffold/core"

// Agent phase - runs an LLM agent
const planningPhase = phase({
  run: planner,
  until: (state) => state.tasks.length >= 10,
  next: "execution",
})

// Human phase - requests input from a person
const reviewPhase = phase({
  human: {
    prompt: (state) => `Review the plan:\n${formatTasks(state.tasks)}`,
    type: "approval",
  },
  onResponse: (response, draft) => {
    draft.approved = response === "approve"
  },
  next: (state) => state.approved ? "execution" : "planning",
})

// Terminal phase - workflow ends here
const donePhase = phase.terminal()
```

**The phase contract:**

| Field | Type | Purpose |
|-------|------|---------|
| `run?` | `AgentDef` | Agent to execute |
| `human?` | `HumanConfig` | Human input request |
| `onResponse?` | `(response: string, draft) => void` | Process human response |
| `until?` | `(state: S) => boolean` | Loop condition: keep running until true |
| `next?` | `string \| (state: S) => string` | Next phase (static or dynamic) |
| `forEach?` | `(state: S) => ReadonlyArray<Ctx>` | Generate contexts for parallel execution |
| `parallel?` | `number` | Max concurrent executions |
| `terminal?` | `boolean` | Marks workflow end |

**Phase execution flow:**

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

### 2.3 Workflow

A workflow ties everything together. There are two forms:

#### Simple Workflow (single agent, no phases)

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

#### Phase Workflow (state machine)

For complex, multi-stage processes:

```typescript
const projectBuilder = workflow({
  name: "project-builder",

  initialState: {
    goal: "",
    tasks: [] as Task[],
    completedTasks: [] as Task[],
    approved: false,
    artifacts: {} as Record<string, string>,
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
        prompt: (state) => `Review ${state.tasks.length} tasks for: ${state.goal}`,
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

**The workflow contract:**

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Unique identifier |
| `initialState` | `S` | Starting state object |
| `start` | `(input: Input, draft: Draft<S>) => void` | Initialize state from input |
| `agent?` | `AgentDef` | For simple workflows: the single agent |
| `until?` | `(state: S) => boolean` | For simple workflows: loop exit condition |
| `phases?` | `Record<string, PhaseDef>` | For phase workflows: named phases |
| `startPhase?` | `string` | Override which phase starts first (default: first key) |

---

## 3. Running Workflows

### 3.1 Simple execution (Promise-based)

```typescript
import { run } from "@open-scaffold/core"

const result = await run(myWorkflow, {
  input: "Build a REST API for a todo app",
  runtime: {
    providers: {
      "claude-sonnet-4-5": mySonnetProvider,
      "claude-haiku-4-5": myHaikuProvider,
    },
    mode: "live",
  },
})

console.log(result.state)       // Final state
console.log(result.exitPhase)   // Which phase ended the workflow
console.log(result.durationMs)  // Total execution time
```

### 3.2 Streaming execution (Async Iterator)

For real-time event processing and HITL:

```typescript
import { execute } from "@open-scaffold/core"

const execution = execute(myWorkflow, {
  input: "Build a REST API",
  runtime: { providers, mode: "live" },
})

for await (const event of execution) {
  switch (event.name) {
    case "phase:entered":
      console.log(`Entering: ${event.payload.phase}`)
      break
    case "agent:completed":
      console.log(`${event.payload.agentName} done`)
      break
    case "input:requested":
      const answer = await askUser(event.payload.promptText)
      execution.respond(answer)
      break
    case "state:updated":
      renderState(event.payload.state)
      break
  }
}

const result = await execution.result
```

### 3.3 Observer pattern

For structured callbacks without manual event matching:

```typescript
const result = await run(myWorkflow, {
  input: "Build API",
  runtime: { providers, mode: "live" },
  observer: {
    started: (sessionId) => console.log(`Session: ${sessionId}`),
    phaseChanged: (phase, from) => console.log(`${from} -> ${phase}`),
    streamed: (chunk) => process.stdout.write(chunk.delta),
    agentStarted: ({ agent }) => console.log(`Running: ${agent}`),
    agentCompleted: ({ agent, durationMs }) => console.log(`${agent}: ${durationMs}ms`),
    stateChanged: (state) => updateUI(state),
    completed: ({ state }) => console.log("Done:", state),
    errored: (err) => console.error("Failed:", err),
  },
})
```

---

## 4. Parallel Execution

Phases support parallel agent execution via `forEach`:

```typescript
const executionPhase = phase({
  run: taskExecutor,  // Agent with Ctx type parameter

  // Generate one context per pending task
  forEach: (state) => state.tasks.filter(t => !t.done),

  // Max 5 concurrent agent calls
  parallel: 5,

  // Keep looping until all tasks done
  until: (state) => state.tasks.every(t => t.done),

  next: "review",
})
```

When `forEach` is present, the agent's `prompt` and `update` receive a context parameter:

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

## 5. Human-in-the-Loop (HITL)

HITL is a first-class concept. Human phases pause the workflow and wait for input.

### Three input types:

```typescript
// Freeform text input
human: {
  prompt: (state) => "Describe what you want to change:",
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

### HITL with dynamic routing:

```typescript
phases: {
  propose: {
    run: proposalAgent,
    next: "review",
  },
  review: {
    human: {
      prompt: (state) => `Review proposal:\n${state.proposal}`,
      type: "choice",
      options: ["approve", "revise", "abandon"],
    },
    onResponse: (response, draft) => {
      draft.decision = response
    },
    next: (state) => {
      switch (state.decision) {
        case "approve": return "execute"
        case "revise": return "propose"
        case "abandon": return "done"
      }
    },
  },
  execute: { run: executor, next: "done" },
  done: phase.terminal(),
}
```

---

## 6. State Design Patterns

### 6.1 Accumulator pattern

State grows as agents add to it:

```typescript
initialState: {
  goal: "",
  discoveries: [] as Discovery[],
  plan: null as Plan | null,
  artifacts: [] as Artifact[],
}
```

### 6.2 Phase-local state

Use nested objects for phase-specific data:

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
    revisions: 0,
  },
}
```

### 6.3 Task queue pattern

For parallel execution with progress tracking:

```typescript
initialState: {
  pending: [] as Task[],
  inProgress: [] as Task[],
  completed: [] as Task[],
  failed: [] as Task[],
}
```

### 6.4 Decision log pattern

Track reasoning for auditability:

```typescript
initialState: {
  decisions: [] as {
    phase: string,
    agent: string,
    reasoning: string,
    decision: string,
    timestamp: number,
  }[],
}
```

---

## 7. Design Patterns for Long-Horizon Workflows

### 7.1 Plan-Execute-Verify

The most common pattern for complex tasks:

```
planning -> review -> execution -> verification -> done
    ^                                    |
    +-------- (if verification fails) ---+
```

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

### 7.2 Iterative Refinement

Agent loops with quality gates:

```typescript
phases: {
  draft: {
    run: drafterAgent,
    next: "critique",
  },
  critique: {
    run: criticAgent,
    next: (state) => state.score >= 8 ? "done" : "revise",
  },
  revise: {
    run: reviserAgent,
    until: (state) => state.revisionCount >= 3,  // Max 3 revisions
    next: "critique",
  },
  done: phase.terminal(),
}
```

### 7.3 Map-Reduce

Parallel processing with aggregation:

```typescript
phases: {
  decompose: {
    run: decomposerAgent,  // Splits problem into sub-problems
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
    run: synthesizerAgent,  // Combines sub-solutions
    next: "done",
  },
  done: phase.terminal(),
}
```

### 7.4 Multi-Agent Debate

Different agents argue positions, a judge decides:

```typescript
phases: {
  propose: {
    run: proposerAgent,
    next: "critique",
  },
  critique: {
    run: criticAgent,
    next: "defend",
  },
  defend: {
    run: defenderAgent,
    next: "judge",
  },
  judge: {
    run: judgeAgent,
    next: (state) => state.resolved ? "done" : "propose",
  },
  done: phase.terminal(),
}
```

### 7.5 Hierarchical Decomposition

Top-level workflow delegates to focused sub-workflows:

```typescript
// High-level orchestrator
phases: {
  analyze: {
    run: analyzerAgent,  // Produces sub-task list
    next: "delegate",
  },
  delegate: {
    run: delegatorAgent,  // Executes each sub-task in sequence
    forEach: (state) => state.subTasks,
    parallel: 1,  // Sequential - each builds on previous
    until: (state) => state.subTasks.every(t => t.complete),
    next: "integrate",
  },
  integrate: {
    run: integratorAgent,  // Combines all results
    next: "done",
  },
  done: phase.terminal(),
}
```

---

## 8. Agent Design Guidelines

### Prompt engineering within the framework

Since agents receive state and produce structured output, prompt design is about:

1. **State to context:** Extract relevant state into the prompt. Don't dump entire state - select what the agent needs.

```typescript
prompt: (state) => `
  You are working on: ${state.goal}

  Current phase: ${state.currentPhase}
  Completed so far: ${state.completed.map(t => t.title).join(", ")}

  Your task: ${state.currentTask.description}
  Constraints: ${state.constraints.join(", ")}
`,
```

2. **Output schema as specification:** The Zod schema constrains what the agent can produce. Design schemas that make it impossible for the agent to produce invalid output.

```typescript
output: z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(100),
    priority: z.enum(["critical", "high", "medium", "low"]),
    estimatedComplexity: z.enum(["trivial", "simple", "moderate", "complex"]),
    dependencies: z.array(z.string()),  // References to other task titles
  })).min(1).max(20),
  reasoning: z.string().describe("Explain your prioritization"),
})
```

3. **Update as reducer:** Think of `update` as a Redux reducer. It receives the validated output and applies it to state. Keep it simple.

```typescript
update: (output, draft) => {
  draft.tasks.push(...output.tasks)
  draft.taskCount = draft.tasks.length
  draft.lastAgentReasoning = output.reasoning
}
```

### Model selection per agent

Different agents in the same workflow can use different models:

```typescript
// Cheap model for simple classification
const classifier = agent({ model: "claude-haiku-4-5", ... })

// Smart model for complex reasoning
const architect = agent({ model: "claude-sonnet-4-5", ... })

// Strongest model for critical decisions
const judge = agent({ model: "claude-opus-4-5", ... })
```

---

## 9. Error Handling

The runtime handles errors via typed error classes:

| Error | When |
|-------|------|
| `ProviderNotFoundError` | Model string doesn't match any registered provider |
| `WorkflowAgentError` | Agent execution fails |
| `WorkflowValidationError` | Agent output doesn't match Zod schema |
| `WorkflowPhaseError` | Phase transition to unknown phase |
| `WorkflowProviderError` | LLM API error (rate limit, auth, context exceeded) |
| `WorkflowAbortedError` | Workflow manually aborted |
| `WorkflowTimeoutError` | Execution exceeded timeout |

You don't need to handle these in workflow definitions. They propagate to the caller. Design your workflows assuming agents succeed - the runtime handles retries and error propagation.

---

## 10. Quick Reference

### Minimal workflow (single agent)

```typescript
const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { input: "", result: "" },
  start: (input, draft) => { draft.input = input },
  agent: myAgent,
})
```

### Minimal phase workflow

```typescript
const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { input: "", result: "" },
  start: (input, draft) => { draft.input = input },
  phases: {
    work: { run: workerAgent, next: "done" },
    done: phase.terminal(),
  },
})
```

### Running it

```typescript
const result = await run(myWorkflow, {
  input: "do the thing",
  runtime: {
    providers: { "claude-sonnet-4-5": myProvider },
    mode: "live",
  },
})
```

---

## Appendix: Complete Type Signatures

### AgentDef<S, O, Ctx>

```typescript
interface AgentDef<S, O, Ctx = void> {
  name: string
  model: string
  output: z.ZodType<O>
  prompt: (state: S, ctx?: Ctx) => string
  update: (output: O, draft: Draft<S>, ctx?: Ctx) => void
  options?: Record<string, unknown>
}
```

### PhaseDef<S, Phases, Ctx>

```typescript
interface PhaseDef<S, Phases extends string, Ctx = void> {
  run?: AgentDef<S, any, Ctx>
  human?: { prompt: (state: S) => string; type: "freeform" | "approval" | "choice"; options?: string[] }
  onResponse?: (response: string, draft: Draft<S>) => void
  until?: (state: S, output?: unknown) => boolean
  next?: Phases | ((state: S) => Phases)
  forEach?: (state: S) => ReadonlyArray<Ctx>
  parallel?: number
  terminal?: boolean
}
```

### WorkflowDef<S, Input, Phases>

```typescript
// Simple form
interface SimpleWorkflowDef<S, Input> {
  name: string
  initialState: S
  start: (input: Input, draft: Draft<S>) => void
  agent: AgentDef<S, any, void>
  until?: (state: S) => boolean
}

// Phase form
interface PhaseWorkflowDef<S, Input, Phases extends string> {
  name: string
  initialState: S
  start: (input: Input, draft: Draft<S>) => void
  phases: { [P in Phases]: PhaseDef<S, Phases, any> }
  startPhase?: Phases
}
```

### RuntimeConfig

```typescript
interface RuntimeConfig {
  providers: Record<string, AgentProvider>
  mode?: "live" | "playback"
  database?: string  // LibSQL connection string
  recorder?: ProviderRecorderService
  eventStore?: EventStoreService
  eventBus?: EventBusService
}
```

### WorkflowResult<S>

```typescript
interface WorkflowResult<S> {
  state: S
  sessionId: string
  events: ReadonlyArray<AnyEvent>
  completed: boolean
  exitPhase?: string
}
```

### WorkflowObserver<S>

```typescript
interface WorkflowObserver<S> {
  started?(sessionId: string): void
  completed?(result: { state: S; events: AnyEvent[] }): void
  errored?(error: unknown): void
  stateChanged?(state: S, patches?: unknown[]): void
  phaseChanged?(phase: string, from?: string): void
  streamed?(chunk: { type: "text" | "thinking"; delta: string; agent: string }): void
  agentStarted?(info: { agent: string; phase?: string }): void
  agentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void
  inputRequested?(request: { prompt: string; type: string; options?: string[] }): Promise<string>
  event?(event: AnyEvent): void
}
```
