# Open Harness SDK - Source Overview

Provider-agnostic workflow orchestration SDK for AI agent systems.

## Architecture

The SDK is organized into **three layers**, from high-level orchestration down to foundational infrastructure:

```
┌─────────────────────────────────────────────────────────┐
│                   LAYER 1: HARNESS                      │
│  Fluent orchestration, channels, control flow           │
│  [harness/]                                             │
├─────────────────────────────────────────────────────────┤
│                   LAYER 2: AGENTS                       │
│  Provider-agnostic agent interfaces and factories       │
│  [factory/, callbacks/]                                 │
├─────────────────────────────────────────────────────────┤
│                   LAYER 3: CORE                         │
│  DI container, event bus, tokens                        │
│  [core/, workflow/, monologue/]                         │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

| Directory | Purpose | Key Exports |
|-----------|---------|-------------|
| `callbacks/` | Agent callback type definitions | `IAgentCallbacks`, `ToolCallEvent`, `TokenUsage` |
| `core/` | DI container, event bus, tokens | `Container`, `EventBus`, `UnifiedEventBus` |
| `factory/` | Agent and harness factories | `createAgent()`, `defineHarness()`, `wrapAgent()` |
| `harness/` | Runtime orchestration, channels | `HarnessInstance`, `defineChannel()`, `parallel()`, `retry()` |
| `monologue/` | Narrative generation system | `Monologue`, `MonologueConfig` |
| `workflow/` | Task management | `TaskList`, `Task`, `TaskStatus` |

## Quick Start

### Level 1: Single Agent Wrapper

```typescript
import { wrapAgent } from "@openharness/sdk";

// Wrap any IAgent for quick execution
const result = await wrapAgent(MyAgent)
  .run({ task: "analyze this" });
```

### Level 2: Multi-Agent Harness

```typescript
import { defineHarness } from "@openharness/sdk";

const MyHarness = defineHarness({
  agents: {
    analyzer: AnalyzerAgent,
    summarizer: SummarizerAgent,
  },
  run: async ({ agents }) => {
    const analysis = await agents.analyzer.execute(input);
    return agents.summarizer.execute(analysis);
  },
});

await MyHarness.create()
  .attach(consoleChannel)
  .run();
```

### Level 3: Channels for Event Streaming

```typescript
import { defineChannel } from "@openharness/sdk";

const dbChannel = defineChannel({
  name: "DatabaseWriter",
  state: () => ({ count: 0 }),
  on: {
    "task:complete": async ({ state, event }) => {
      state.count++;
      await db.insert("logs", event);
    },
  },
});
```

## Key Concepts

### Transport

Bidirectional event interface for harness ↔ consumer communication:
- **Events OUT**: Harness emits events (task:start, agent:complete, etc.)
- **Commands IN**: Consumers send commands (reply, abort, inject message)

### Channel

Event consumer implemented via `defineChannel()`. Channels:
- Subscribe to events via pattern matching (`task:*`, `agent:complete`)
- Maintain state across events
- Optionally send commands back to harness

### Attachment

Function signature `(transport: Transport) => Cleanup`. Channels are attachments:
```typescript
const channel = defineChannel({ ... }); // Returns Attachment
harness.attach(channel);
```

## Related Packages

| Package | Description |
|---------|-------------|
| `@openharness/core` | Core `IAgent` interface |
| `@openharness/anthropic` | Anthropic/Claude provider implementation |

## Further Reading

See README.md in each subdirectory for detailed documentation:
- [callbacks/README.md](./callbacks/README.md) - Callback types
- [core/README.md](./core/README.md) - DI and event infrastructure
- [factory/README.md](./factory/README.md) - Agent and harness factories
- [harness/README.md](./harness/README.md) - Runtime and channels
- [monologue/README.md](./monologue/README.md) - Narrative system
- [workflow/README.md](./workflow/README.md) - Task management
