# Open Scaffold

**Build AI workflows you can test like software.**

## The Problem

AI workflows are hard to test. Every run is different. Costs add up during development. CI pipelines can't rely on non-deterministic API calls. When something breaks in production, you can't reproduce it.

## The Solution

| Capability | What it does |
|------------|--------------|
| **Build** | Define agents with typed outputs, compose into phases, wire into workflows |
| **Debug** | VCR-style recording: run once with real APIs, replay infinitely in tests |
| **Evaluate** | Compare workflow variants, score outputs, A/B test prompts |

## Quick Example

```typescript
import { agent, workflow, phase, run } from "@open-scaffold/core"
import { AnthropicProvider } from "@open-scaffold/server"
import { z } from "zod"

// 1. Define an agent with typed output
const researcher = agent({
  name: "researcher",
  model: "claude-sonnet-4-5",
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

// 3. Run with observer callbacks
const result = await run(researchFlow, {
  input: "quantum computing",
  runtime: {
    providers: { "claude-sonnet-4-5": AnthropicProvider() },
    mode: "live"  // Switch to "playback" for tests
  },
  observer: {
    onStateChanged: (state) => console.log("State:", state),
    onTextDelta: ({ agent, delta }) => process.stdout.write(delta),
    onAgentCompleted: ({ agent, output, durationMs }) => {
      console.log(`${agent} finished in ${durationMs}ms`)
    }
  }
})
```

## How It Works

Every action in a workflow is recorded as an immutable event. In `live` mode, API calls are made and responses are saved. In `playback` mode, saved responses are replayed exactly -- no API calls, no costs, deterministic every time. This means you can develop against real APIs, then run tests in CI with perfect reproducibility.

## Packages

| Package | Description |
|---------|-------------|
| `@open-scaffold/core` | Agents, phases, workflows, and execution runtime |
| `@open-scaffold/server` | HTTP/SSE server, providers (Anthropic), port 42069 |
| `@open-scaffold/client` | HTTP client + React hooks (18 hooks) |
| `@open-scaffold/testing` | Shared recordings database for deterministic tests |

## Get Started

```bash
pnpm add @open-scaffold/core
```

See the [documentation](./docs/getting-started.md) for full guides.

## License

MIT
