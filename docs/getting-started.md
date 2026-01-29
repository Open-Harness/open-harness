# Getting Started

**Get running in 5 minutes.**

---

## Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)

---

## Installation

```bash
pnpm add @open-scaffold/core @open-scaffold/server @open-scaffold/client
```

---

## Quick Start

### 1. Define an Agent

Agents are AI actors with a model, prompt, output schema, and state update function.

```typescript
// agents.ts
import { agent } from "@open-scaffold/core"
import { z } from "zod"

export const worker = agent({
  name: "worker",
  model: "claude-sonnet-4-5",
  output: z.object({
    result: z.string()
  }),
  prompt: (state) => `Complete this task: ${state.task}`,
  update: (output, draft) => {
    draft.result = output.result
  }
})
```

### 2. Define a Workflow

Workflows combine agents into phases with explicit transitions.

```typescript
// workflow.ts
import { workflow, phase } from "@open-scaffold/core"
import { worker } from "./agents"

export const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { task: "", result: "" },
  start: (input: string, draft) => {
    draft.task = input
  },
  phases: {
    work: { run: worker, next: "done" },
    done: phase.terminal()
  }
})
```

### 3. Run It

Execute the workflow with observer callbacks to monitor progress.

```typescript
// main.ts
import { run } from "@open-scaffold/core"
import { AnthropicProvider } from "@open-scaffold/server"
import { myWorkflow } from "./workflow"

const result = await run(myWorkflow, {
  input: "Write a haiku about coding",
  runtime: {
    providers: { "claude-sonnet-4-5": AnthropicProvider() },
    mode: "live"
  },
  observer: {
    onStateChanged: (state, patches) => {
      console.log("State updated:", patches)
    },
    onTextDelta: ({ agent, delta }) => {
      process.stdout.write(delta)
    },
    onAgentCompleted: ({ agent, output, durationMs }) => {
      console.log(`\n${agent} completed in ${durationMs}ms`)
    }
  }
})

console.log("Final result:", result.state.result)
```

### 4. Connect React (Optional)

Add real-time UI with the client package.

```tsx
// app.tsx
import { WorkflowProvider, useWorkflowState, useCreateSession } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <WorkflowUI />
    </WorkflowProvider>
  )
}

function WorkflowUI() {
  const state = useWorkflowState<{ task: string; result: string }>()
  const createSession = useCreateSession()

  return (
    <div>
      <button onClick={() => createSession("Hello!")}>Start</button>
      {state && <p>Result: {state.result}</p>}
    </div>
  )
}
```

---

## What Just Happened?

1. **Agent defined** -- The `worker` agent knows its model, how to prompt it, what output to expect (via Zod schema), and how to update workflow state with the result.

2. **Workflow composed** -- The workflow defines initial state, how to apply input, and phases that sequence agent execution. The `work` phase runs the agent, then transitions to `done`.

3. **Runtime executed** -- The `run()` function executes the workflow. The `runtime` config provides the AI provider and mode (`live` for real API calls, `playback` for recorded responses). Observer callbacks stream progress in real-time.

4. **React connected** -- The client package provides hooks that connect to a running server on port 42069, giving you reactive state updates in your UI.

---

## What's Next?

| Document | Description |
|----------|-------------|
| [Concepts](./concepts.md) | Core mental models |
| [Building Workflows](./building-workflows.md) | Agents, phases, workflows |
| [React Integration](./react-integration.md) | React hooks reference |
| [API Reference](./api-reference.md) | Complete type signatures |
| [Architecture](./architecture.md) | How it works internally |
