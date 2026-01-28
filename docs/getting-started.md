# Getting Started with Open Scaffold

Build event-sourced AI workflows with full observability and control.

## Prerequisites

- Node.js 20+
- pnpm 10+ (or npm/yarn)
- Basic TypeScript knowledge

## Installation

```bash
# Core packages
pnpm add @open-scaffold/core @open-scaffold/server @open-scaffold/client

# Optional: Pre-built UI components
pnpm add @open-scaffold/ui
```

## Quick Start

### 1. Define Your Workflow

Create `workflow.ts`:

```typescript
import { agent, phase, workflow } from "@open-scaffold/core"
import { z } from "zod"

// Define an agent
const worker = agent({
  name: "worker",
  model: "claude-sonnet-4-5",
  output: z.object({
    task: z.string(),
    result: z.string()
  }),
  prompt: (state) => `Complete this task: ${state.currentTask}`,
  update: (output, draft) => {
    draft.completedTasks.push(output.task)
  }
})

// Create the workflow with phases
export const myWorkflow = workflow({
  name: "my-workflow",
  initialState: { currentTask: "", completedTasks: [] as string[] },
  start: (input, draft) => { draft.currentTask = input },
  phases: {
    working: { run: worker, next: "done" },
    done: phase.terminal()
  }
})
```

### 2. Execute the Workflow

Create `main.ts`:

```typescript
import { execute, run } from "@open-scaffold/core"
import { myWorkflow } from "./workflow"

// Option A: Async iterator API
const execution = execute(myWorkflow, {
  input: "Build a todo app",
  providers: { "claude-sonnet-4-5": anthropicProvider }
})

for await (const event of execution) {
  console.log(event.name, event.payload)
}

// Option B: Promise API with observer
const result = await run(myWorkflow, {
  input: "Build a todo app",
  observer: {
    stateChanged: (state) => console.log("State:", state),
    phaseChanged: (phase) => console.log("Phase:", phase),
  }
})
```

### 3. Connect from React

**Option A: With UI Components (Recommended)**

```tsx
import { WorkflowProvider } from "@open-scaffold/client"
import {
  ConnectionStatus,
  EventStream,
  StateViewer,
  InputArea,
  VCRToolbar,
  InteractionModal
} from "@open-scaffold/ui"

function App() {
  return (
    <WorkflowProvider url="http://localhost:3001">
      <div className="min-h-screen p-4">
        <header className="flex justify-between items-center mb-4">
          <h1>My Workflow</h1>
          <ConnectionStatus showIcon />
        </header>

        <div className="grid grid-cols-2 gap-4">
          <EventStream maxHeight="400px" />
          <StateViewer />
        </div>

        <footer className="mt-4 space-y-2">
          <InputArea placeholder="Send a message..." />
          <VCRToolbar />
        </footer>

        <InteractionModal />
      </div>
    </WorkflowProvider>
  )
}
```

**Option B: With Hooks Only (Custom UI)**

```tsx
import { WorkflowProvider, useEvents, useCreateSession, useSendInput } from "@open-scaffold/client"

function App() {
  return (
    <WorkflowProvider url="http://localhost:3001">
      <WorkflowUI />
    </WorkflowProvider>
  )
}

function WorkflowUI() {
  const events = useEvents()
  const createSession = useCreateSession()
  const sendInput = useSendInput()

  return (
    <div>
      <button onClick={() => createSession("Hello!")}>
        Start Session
      </button>
      <div>{events.length} events</div>
    </div>
  )
}
```

### 4. Configure Tailwind (for UI Components)

If using `@open-scaffold/ui`, add the package to your Tailwind content paths:

```js
// tailwind.config.js
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@open-scaffold/ui/**/*.{js,mjs}"
  ],
  darkMode: "class"
}
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Agents** | AI actors with model, prompt, output schema, and state update function |
| **Phases** | Named stages that define workflow progression |
| **Workflows** | Compositions of agents and phases with initial state |
| **execute()** | Async iterator API for streaming events |
| **run()** | Promise API with observer for state/phase changes |
| **WorkflowObserver** | Observer protocol for state and phase change callbacks |
| **VCR Controls** | Pause, resume, fork sessions like a VCR tape |
| **HITL** | Human-in-the-loop via event-based interactions |

## Development Tools

### Storybook (UI Components)

The UI package includes Storybook for component development:

```bash
cd packages/ui
pnpm storybook
```

This opens a component browser at `http://localhost:6006` where you can:
- View all components in isolation
- Test different props and states
- Verify dark mode and responsive behavior

### Provider Recording

For deterministic testing, record AI responses in `live` mode, then replay with `playback` mode. The `RuntimeConfig` with its `database` field handles storage configuration.

## What's Next

- [React Hooks API Reference](./api/react-hooks.md) - All 18 hooks documented
- [Component Library Reference](./api/components.md) - Pre-built UI components
- [Configuration Reference](./api/configuration.md) - Server and client options
- [Architecture Overview](./reference/architecture.md) - How the pieces fit together
- [Mental Model](./reference/mental-model.md) - Deep dive into concepts
