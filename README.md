# Open Scaffold

Event-sourced workflow runtime with deterministic replay for AI agent orchestration.

## Overview

Open Scaffold provides infrastructure for building, testing, and debugging AI agent workflows:

- **Event Sourcing** -- Every action is recorded as an immutable event
- **Deterministic Replay** -- Reproduce any workflow run exactly
- **Recording/Playback** -- Record API calls in `live` mode, replay in `playback` mode for CI
- **Streaming** -- Real-time event streams via SSE

## Packages

| Package | Description |
|---------|-------------|
| `@open-scaffold/core` | Domain types, agents, phases, workflows |
| `@open-scaffold/server` | HTTP/SSE server with OpenScaffold public API |
| `@open-scaffold/client` | HTTP client + React hooks (17 hooks) |

## Quick Start

This example shows a research workflow with a researcher agent that produces findings from a topic.

**1. Define your agent:**

```typescript
// researcher.ts
import { agent } from "@open-scaffold/core"
import { z } from "zod"

export const researcher = agent({
  name: "researcher",
  model: "claude-sonnet-4-5",
  output: z.object({ findings: z.array(z.string()) }),
  prompt: (state) => `Research the following topic: ${state.topic}`,
  update: (output, draft) => { draft.findings = output.findings }
})
```

**2. Define the workflow:**

```typescript
// workflow.ts
import { workflow, phase } from "@open-scaffold/core"
import { researcher } from "./researcher"

export const researchFlow = workflow({
  name: "research-flow",
  initialState: { topic: "", findings: [] as string[] },
  start: (input, draft) => { draft.topic = input },
  phases: {
    research: { run: researcher, next: "done" },
    done: phase.terminal()
  }
})
```

**3. Execute the workflow:**

```typescript
// main.ts
import { execute, run } from "@open-scaffold/core"
import { researchFlow } from "./workflow"

// Option A: Async iterator API
const execution = execute(researchFlow, {
  input: "quantum computing",
  providers: { "claude-sonnet-4-5": anthropicProvider }
})

for await (const event of execution) {
  console.log(event.name, event.payload)
}

// Option B: Promise API with observer
const result = await run(researchFlow, {
  input: "quantum computing",
  observer: {
    stateChanged: (state) => console.log("State:", state),
    phaseChanged: (phase) => console.log("Phase:", phase),
  }
})
```

## Provider Modes

| Mode | Behavior |
|------|----------|
| `live` | Call real APIs, record responses to database |
| `playback` | Replay recorded responses, never call APIs |

Use `live` during development to record, then `playback` in CI for deterministic tests.

## Documentation

| Doc | Description |
|-----|-------------|
| [Mental Model](./docs/reference/mental-model.md) | Core concepts: events, agents, phases, workflows |
| [Architecture](./docs/reference/architecture.md) | Server/client design, services, protocol |
| [Architecture Diagrams](./docs/reference/architecture-diagrams.md) | Visual diagrams (Mermaid) |
| [SDK Internals](./docs/reference/sdk-internals.md) | Effect patterns for library authors |
| [Reference Implementation](./docs/reference/reference-implementation.md) | Complete workflow example |

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Architecture

```
+-------------------------------------------------------------+
|                      OpenScaffold                            |
|           (Public API - Promise-based, no Effect)            |
+-------------------------------------------------------------+
                              |
         +--------------------+--------------------+
         v                    v                    v
   +----------+        +-----------+       +-----------+
   |  Server  |        |   Core    |       |  Client   |
   | HTTP/SSE |<------>|  Runtime  |<------|  HTTP/SSE |
   +----------+        +-----------+       +-----------+
         |                    |
         v                    v
   +----------+        +-----------+
   | Provider |        |  Storage  |
   |(Anthropic)|        | (LibSQL)  |
   +----------+        +-----------+
```

## License

MIT
