# factory/ - Agent and Harness Factories

Entry points for creating agents and harnesses. These factories provide the fluent API that SDK users interact with.

## Files

| File | Purpose |
|------|---------|
| `agent-factory.ts` | `createAgent()` - resolves agents from DI container |
| `define-harness.ts` | `defineHarness()` - creates typed harness factories |
| `wrap-agent.ts` | `wrapAgent()` - single-agent wrapper for quick tasks |

## Usage Levels

The SDK provides three levels of abstraction:

### Level 1: `wrapAgent()` - Quick Single-Agent Tasks

Wrap any `IAgent` for immediate execution:

```typescript
import { wrapAgent } from "@openharness/sdk";
import { CodingAgent } from "@openharness/anthropic";

const result = await wrapAgent(CodingAgent)
  .run({ task: "Write a hello world function" });
```

Returns a `WrappedAgent` with:
- `.run(input)` - Execute with input
- `.attach(channel)` - Add event channels
- `.configure(options)` - Set runner options

### Level 2: `defineHarness()` - Multi-Agent Workflows

Create typed harness factories for complex orchestration:

```typescript
import { defineHarness } from "@openharness/sdk";

const MyHarness = defineHarness({
  // Declare agents with their constructor types
  agents: {
    analyzer: AnalyzerAgent,
    summarizer: SummarizerAgent,
  },

  // Orchestration logic
  run: async ({ agents, emit }) => {
    emit({ type: "phase:start", name: "analysis" });
    const analysis = await agents.analyzer.execute(input);

    emit({ type: "phase:start", name: "summary" });
    return agents.summarizer.execute(analysis);
  },
});

// Create instance and run
const result = await MyHarness.create()
  .attach(consoleChannel)
  .run();
```

### Level 3: `createAgent()` - DI-Based Resolution

Low-level agent resolution from DI container:

```typescript
import { createAgent, setGlobalContainer } from "@openharness/sdk";

// Set up container (optional - uses default if not set)
setGlobalContainer(myContainer);

// Resolve agent from container
const agent = createAgent(CodingAgent);
```

## Key Types

### `HarnessFactory<TAgents, TResult>`

Returned by `defineHarness()`:

```typescript
interface HarnessFactory<TAgents, TResult> {
  create(): HarnessInstance<TAgents, TResult>;
}
```

### `ExecuteContext<TAgents>`

Context passed to `run()` function:

```typescript
interface ExecuteContext<TAgents> {
  agents: ResolvedAgents<TAgents>;  // Instantiated agents
  emit: (event: FluentHarnessEvent) => void;  // Emit events
  session: SessionContextAPI;  // Interactive session support
}
```

### `WrappedAgent<TInput, TOutput>`

Returned by `wrapAgent()`:

```typescript
interface WrappedAgent<TInput, TOutput> {
  run(input: TInput): Promise<TOutput>;
  attach(attachment: Attachment): WrappedAgent<TInput, TOutput>;
  configure(options: RunnerOptions): WrappedAgent<TInput, TOutput>;
}
```

## How It Connects

```
┌─────────────────────────────────────────────────────────┐
│                  User Code                              │
│  defineHarness() / wrapAgent() / createAgent()         │
└───────────────┬─────────────────────────────────────────┘
                │ creates
                ▼
┌─────────────────────────────────────────────────────────┐
│              HarnessInstance                            │
│  Runtime orchestration, event emission                  │
└───────────────┬─────────────────────────────────────────┘
                │ resolves from
                ▼
┌─────────────────────────────────────────────────────────┐
│                 Container                               │
│  DI container with registered agents                    │
└─────────────────────────────────────────────────────────┘
```

## Agent Requirements

Agents must implement the `IAgent<TInput, TOutput>` interface from `@openharness/core`:

```typescript
interface IAgent<TInput, TOutput> {
  execute(input: TInput, callbacks?: IAgentCallbacks): Promise<TOutput>;
}
```

## Related

- `@openharness/core` - `IAgent` interface definition
- `@openharness/anthropic` - Anthropic/Claude agent implementations
- `harness/harness-instance.ts` - Runtime created by factories
- `core/container.ts` - DI container for agent resolution
