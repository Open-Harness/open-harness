# Open Harness

**Build AI workflows you can test like software.**

---

Open Harness is a TypeScript framework for building, testing, and debugging agentic AI workflows. Define agents with typed outputs, compose them into phases, and run deterministic tests without making API calls.

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } __Get Started in 5 Minutes__

    ---

    Install Open Harness and run your first AI workflow with typed outputs and full observability.

    [:octicons-arrow-right-24: Getting Started](getting-started.md)

-   :material-book-open-variant:{ .lg .middle } __Core Concepts__

    ---

    Learn about events, agents, phases, and workflows—the building blocks of every Open Harness application.

    [:octicons-arrow-right-24: Concepts](concepts/index.md)

-   :material-code-braces:{ .lg .middle } __API Reference__

    ---

    Detailed documentation for all packages: core, server, client, and testing.

    [:octicons-arrow-right-24: API Reference](api/reference.md)

-   :fontawesome-brands-react:{ .lg .middle } __React Integration__

    ---

    18 hooks for building real-time AI interfaces with streaming, state management, and human-in-the-loop.

    [:octicons-arrow-right-24: React Guide](guides/react-integration.md)

</div>

## Why Open Harness?

AI workflows are notoriously hard to test. Every run is different. Costs add up during development. CI pipelines can't rely on non-deterministic API calls. When something breaks in production, you can't reproduce it.

Open Harness solves this with **VCR-style recording**:

| Mode | What Happens |
|------|--------------|
| **Live** | Real API calls are made and responses are recorded |
| **Playback** | Recorded responses are replayed exactly—no API calls, no costs |

This means you can develop against real APIs, then run tests in CI with **perfect reproducibility**.

## Quick Start

### Installation

```bash
bun add @open-harness/core @open-harness/server
```

### Define Your First Workflow

```typescript
import { agent, workflow, phase, run } from "@open-harness/core"
import { AnthropicProvider } from "@open-harness/server"
import { z } from "zod"

// 1. Define an agent with typed output
const researcher = agent({
  name: "researcher",
  provider: AnthropicProvider({ model: "claude-sonnet-4-5" }),
  output: z.object({ findings: z.array(z.string()) }),
  prompt: (state) => `Research: ${state.topic}`,
  update: (output, draft) => { draft.findings = output.findings }
})

// 2. Compose into a workflow
const researchFlow = workflow({
  name: "research-flow",
  initialState: { topic: "", findings: [] as string[] },
  start: (input: string, draft) => { draft.topic = input },
  phases: {
    research: { run: researcher, next: "done" },
    done: phase.terminal()
  }
})

// 3. Run with full observability
const execution = await run(researchFlow, {
  input: "quantum computing",
  mode: "live"
})

execution.subscribe({
  onStateChanged: (state) => console.log("State:", state),
  onTextDelta: ({ delta }) => process.stdout.write(delta),
  onAgentCompleted: ({ agent, durationMs }) => {
    console.log(`${agent} finished in ${durationMs}ms`)
  }
})
```

## Features

### :material-test-tube: Deterministic Testing

Record API responses once, replay them forever. Your tests run in milliseconds, cost nothing, and produce identical results every time.

```typescript
// In tests, switch to playback mode
const execution = await run(researchFlow, {
  input: "quantum computing",
  mode: "playback"  // No API calls, uses recorded responses
})
```

### :material-state-machine: Event-Sourced State

Every action is recorded as an immutable event. Time-travel through your workflow, fork sessions, and debug with complete history.

### :material-human: Human-in-the-Loop

Pause workflows for human approval, inject corrections, and resume execution—all with full type safety.

### :fontawesome-brands-react: React Ready

18 purpose-built hooks for streaming responses, state synchronization, and building real-time AI interfaces.

## Packages

| Package | Description |
|---------|-------------|
| [`@open-harness/core`](api/reference.md) | Agents, phases, workflows, and execution runtime |
| [`@open-harness/server`](api/reference.md) | HTTP/SSE server, AI providers (Anthropic, OpenAI) |
| [`@open-harness/client`](api/reference.md) | HTTP client + React hooks |
| [`@open-harness/testing`](api/reference.md) | Shared recordings database for deterministic tests |

## Next Steps

<div class="grid cards" markdown>

-   :material-play:{ .lg .middle } __Run Your First Workflow__

    ---

    Follow our step-by-step guide to build and run a complete AI workflow.

    [:octicons-arrow-right-24: Getting Started](getting-started.md)

-   :material-lightbulb:{ .lg .middle } __Understand the Architecture__

    ---

    Learn how events, agents, phases, and workflows work together.

    [:octicons-arrow-right-24: Concepts](concepts/index.md)

</div>

---

<div align="center" markdown>

**Open Harness is open source under the MIT License.**

[:fontawesome-brands-github: View on GitHub](https://github.com/Open-Harness/open-harness){ .md-button }

</div>
