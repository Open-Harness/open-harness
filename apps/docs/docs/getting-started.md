# Getting Started

**Run your first AI workflow in 5 minutes.**

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** or **Bun 1.2+**
- **bun** package manager (recommended) or npm/yarn
- An **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com))

---

## Installation

Install the core packages:

```bash
bun add @open-harness/core @open-harness/server zod
```

!!! note "Why Zod?"
    Open Harness uses [Zod](https://zod.dev) for runtime schema validation. Every agent must define its output schema with Zod to ensure type-safe, validated responses from AI models.

---

## Your First Workflow

Let's build a simple workflow that takes a topic and generates a haiku about it. We'll go step by step.

### Step 1: Define an Agent

An **agent** is a single AI call with a specific job. Create a file called `haiku.ts`:

```typescript
// haiku.ts
import { agent, workflow, phase, run } from "@open-harness/core"
import { AnthropicProvider } from "@open-harness/server"
import { z } from "zod"

// Define the agent
const poet = agent({
  name: "poet",

  // The AI model to use
  provider: AnthropicProvider({ model: "claude-sonnet-4-5" }),

  // The expected output structure (validated by Zod)
  output: z.object({
    haiku: z.string().describe("A haiku poem (5-7-5 syllables)")
  }),

  // Generate the prompt from current state
  prompt: (state) => `Write a haiku about: ${state.topic}`,

  // Update state with the agent's output
  update: (output, draft) => {
    draft.haiku = output.haiku
  }
})
```

**What's happening here:**

- `name` — Unique identifier for debugging and logging
- `provider` — The AI provider configuration (Anthropic Claude in this case)
- `output` — Zod schema defining the expected structured output
- `prompt` — Function that reads state and returns the prompt string
- `update` — Function that writes the agent's output to state (uses [Immer](https://immerjs.github.io/immer/) drafts, so you can mutate directly)

### Step 2: Define the Workflow

Add a workflow that uses your agent:

```typescript
// Continue in haiku.ts

// Define the workflow
const haikuWorkflow = workflow({
  name: "haiku-generator",

  // Initial state shape and defaults
  initialState: {
    topic: "",
    haiku: ""
  },

  // How to apply input to initial state
  start: (input: string, draft) => {
    draft.topic = input
  },

  // The execution phases
  phases: {
    // "compose" phase runs the poet agent, then goes to "done"
    compose: { run: poet, next: "done" },

    // "done" is a terminal phase - workflow is complete
    done: phase.terminal()
  }
})
```

**What's happening here:**

- `initialState` — The starting shape of your workflow's state
- `start` — A function that takes input and mutates the initial state
- `phases` — An explicit state machine defining execution order

### Step 3: Run the Workflow

Add the execution code:

```typescript
// Continue in haiku.ts

// Set your API key
process.env.ANTHROPIC_API_KEY = "your-api-key-here"

// Run the workflow
const execution = await run(haikuWorkflow, {
  input: "morning coffee",
  mode: "live"
})

// Subscribe to events
execution.subscribe({
  // Called as tokens stream in
  onTextDelta: ({ delta }) => {
    process.stdout.write(delta)
  },

  // Called when the workflow completes
  onCompleted: ({ state }) => {
    console.log("\n\n✓ Haiku generated!")
    console.log(`Topic: ${state.topic}`)
    console.log(`Haiku: ${state.haiku}`)
  }
})
```

### Step 4: Run It

Execute your workflow:

```bash
bun run haiku.ts
```

You should see the AI thinking token-by-token, followed by the final haiku:

```
Steam rises slowly...
Dark brew awakens the soul...
First sip, day begins

✓ Haiku generated!
Topic: morning coffee
Haiku: Steam rises slowly / Dark brew awakens the soul / First sip, day begins
```

---

## Complete Example

Here's the full working code in one file:

```typescript
// haiku.ts
import { agent, workflow, phase, run } from "@open-harness/core"
import { AnthropicProvider } from "@open-harness/server"
import { z } from "zod"

// 1. Define the agent
const poet = agent({
  name: "poet",
  provider: AnthropicProvider({ model: "claude-sonnet-4-5" }),
  output: z.object({
    haiku: z.string().describe("A haiku poem (5-7-5 syllables)")
  }),
  prompt: (state) => `Write a haiku about: ${state.topic}`,
  update: (output, draft) => {
    draft.haiku = output.haiku
  }
})

// 2. Define the workflow
const haikuWorkflow = workflow({
  name: "haiku-generator",
  initialState: { topic: "", haiku: "" },
  start: (input: string, draft) => { draft.topic = input },
  phases: {
    compose: { run: poet, next: "done" },
    done: phase.terminal()
  }
})

// 3. Run it
const execution = await run(haikuWorkflow, {
  input: "morning coffee",
  mode: "live"
})

execution.subscribe({
  onTextDelta: ({ delta }) => process.stdout.write(delta),
  onCompleted: ({ state }) => {
    console.log("\n\n✓ Done!")
    console.log("Haiku:", state.haiku)
  }
})
```

---

## Add React (Optional)

Want to build a UI? Install the client package:

```bash
bun add @open-harness/client
```

Then create a React component:

```tsx
// App.tsx
import {
  WorkflowClientProvider,
  useWorkflow
} from "@open-harness/client"

function App() {
  return (
    <WorkflowClientProvider url="http://localhost:42069">
      <HaikuGenerator />
    </WorkflowClientProvider>
  )
}

function HaikuGenerator() {
  const {
    state,           // Current workflow state
    status,          // 'idle' | 'running' | 'completed' | 'error'
    textStream,      // Streaming text from the AI
    actions          // { start, pause, resume, fork }
  } = useWorkflow<{ topic: string; haiku: string }>()

  return (
    <div>
      <button
        onClick={() => actions.start("autumn leaves")}
        disabled={status === 'running'}
      >
        Generate Haiku
      </button>

      {/* Show streaming output */}
      {textStream && <pre>{textStream}</pre>}

      {/* Show final result */}
      {state?.haiku && (
        <blockquote>{state.haiku}</blockquote>
      )}
    </div>
  )
}
```

!!! info "Server Required"
    The React client connects to a running Open Harness server. You'll need to set up the server package to expose your workflow via HTTP/SSE. See the [React Integration Guide](guides/react-integration.md) for the full setup.

---

## What Just Happened?

Let's trace through the execution:

```
┌─────────────────────────────────────────────────────────────┐
│  1. INPUT RECEIVED                                           │
│     "morning coffee" → start() → state.topic = "morning..."  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  2. PHASE: compose                                           │
│     poet agent activated                                     │
│     prompt: "Write a haiku about: morning coffee"           │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  3. AI CALL (streaming)                                      │
│     Claude generates haiku token-by-token                    │
│     Output validated against Zod schema                     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  4. STATE UPDATE                                             │
│     update(output, draft) → draft.haiku = "Steam rises..."  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  5. PHASE TRANSITION                                         │
│     compose → done (terminal)                               │
│     Workflow complete!                                       │
└─────────────────────────────────────────────────────────────┘
```

**Key concepts demonstrated:**

| Concept | What You Saw |
|---------|--------------|
| **Agent** | `poet` — a single AI call with typed output |
| **Workflow** | `haikuWorkflow` — combines state, input handling, and phases |
| **Phase** | `compose` → `done` — explicit execution order |
| **Streaming** | `onTextDelta` — real-time token output |
| **State** | Immutable updates via Immer drafts |

---

## Modes: Live vs Playback

Open Harness has two execution modes:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **`live`** | Makes real API calls, records responses | Development, production |
| **`playback`** | Replays recorded responses, no API calls | Testing, CI |

```typescript
// Live mode (default) - calls the real API
await run(workflow, { input: "...", mode: "live" })

// Playback mode - uses recorded responses
await run(workflow, { input: "...", mode: "playback" })
```

This enables **deterministic testing** of AI workflows. Record once during development, replay forever in CI. No flaky tests, no API costs.

---

## Next Steps

Now that you've run your first workflow, explore further:

<div class="grid cards" markdown>

-   :material-lightbulb:{ .lg .middle } __Understand the Concepts__

    ---

    Learn about events, agents, phases, and workflows—the core building blocks.

    [:octicons-arrow-right-24: Core Concepts](concepts/index.md)

-   :material-code-braces:{ .lg .middle } __Build Complex Workflows__

    ---

    Multi-phase workflows, loops, branches, and human-in-the-loop patterns.

    [:octicons-arrow-right-24: Building Workflows](guides/building-workflows.md)

-   :fontawesome-brands-react:{ .lg .middle } __Add a React UI__

    ---

    18 hooks for streaming, state management, and real-time AI interfaces.

    [:octicons-arrow-right-24: React Integration](guides/react-integration.md)

-   :material-test-tube:{ .lg .middle } __Write Tests__

</div>

---

## Troubleshooting

### API Key Not Found

```
Error: ANTHROPIC_API_KEY environment variable is required
```

**Solution:** Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or in your code (not recommended for production):

```typescript
process.env.ANTHROPIC_API_KEY = "sk-ant-..."
```

### Schema Validation Failed

```
Error: Output validation failed: expected string, received undefined
```

**Solution:** The AI didn't return the expected structure. This usually means your output schema is too strict or your prompt isn't clear enough. Add `.describe()` hints to your Zod schema fields:

```typescript
output: z.object({
  haiku: z.string().describe("A haiku poem with 5-7-5 syllable structure")
})
```

### Module Not Found

```
Cannot find module '@open-harness/core'
```

**Solution:** Make sure you've installed all packages:

```bash
bun add @open-harness/core @open-harness/server zod
```

---

<div align="center" markdown>

**Ready to build something real?**

[:octicons-arrow-right-24: Core Concepts](concepts/index.md){ .md-button .md-button--primary }

</div>
