# OpenHarness

**Build production-ready AI agent workflows with type safety and clean architecture.**

OpenHarness is a TypeScript SDK for orchestrating multi-agent workflows with Claude. It provides:

- **Type-safe workflows** with Zod schema validation
- **Clean separation** between control flow (harness), execution (agents), and presentation (channels)
- **Event-driven architecture** with customizable output channels
- **Dependency injection** with automatic agent lifecycle management
- **Fluent API** that reduces boilerplate by 50%+

## Quick Start

```bash
# Install dependencies
bun install

# Run the coding workflow example
cd examples/coding
bun src/index.ts

# Run the validation workflow example
bun src/validate.ts
```

## Examples

### 1. Coding Workflow (`examples/coding/src/index.ts`)

A full software development workflow that demonstrates:

- **Planning Phase**: Break down PRDs into implementation tasks
- **Execution Phase**: Generate code for each task
- **Review Phase**: Automated code review with feedback

```typescript
import { CodingWorkflow } from "./harness.js";
import { ConsoleChannel } from "./console-channel.js";

const result = await CodingWorkflow
  .create({ prd: "Build a TODO app" })
  .attach(ConsoleChannel)
  .run();
```

**What it shows:**
- Multi-phase workflows with nested tasks
- Agent composition (PlannerAgent, CodingAgent, ReviewAgent)
- Beautiful console output with progress tracking
- Event-driven architecture

### 2. Validation Workflow (`examples/coding/src/validate.ts`)

An end-to-end code validation workflow:

- **Planning Phase**: Analyze the task
- **Coding Phase**: Generate code and write to temp file
- **Validation Phase**: Execute code and verify output

```typescript
import { ValidationWorkflow } from "./validate-harness.js";
import { ConsoleChannel } from "./console-channel.js";
import { ValidationResultsChannel } from "./validation-channel.js";

const result = await ValidationWorkflow
  .create({ task: "Generate a Fibonacci script" })
  .attach(ConsoleChannel)
  .attach(ValidationResultsChannel)
  .run();

process.exit(result.result.passed ? 0 : 1);
```

**What it shows:**
- Custom agents with specialized prompts
- File-based agent handoffs
- Channel composition (ConsoleChannel + ValidationResultsChannel)
- Clean separation: harness = control flow, agents = heavy lifting
- CI-friendly exit codes

## Architecture

OpenHarness follows a three-layer architecture:

### 1. Harness (Control Flow)
Orchestrates workflow phases and passes data between agents. Pure control flow - no bash commands or file I/O.

```typescript
const MyWorkflow = defineHarness({
  name: "my-workflow",
  agents: { planner: PlannerAgent, coder: CodingAgent },
  state: (input) => ({ ... }),
  run: async ({ agents, state, phase, emit }) => {
    await phase("Planning", async () => { ... });
    await phase("Coding", async () => { ... });
  },
});
```

### 2. Agents (Execution)
Execute LLM-powered tasks with tool access (bash, file I/O, web search).

```typescript
const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: MyPromptTemplate,
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});
```

### 3. Channels (Presentation)
Event-driven output renderers that consume workflow events.

```typescript
const MyChannel = defineChannel({
  name: "MyChannel",
  state: () => ({ count: 0 }),
  on: {
    "phase:start": ({ event, output }) => {
      output.line(`Starting: ${event.event.name}`);
    },
  },
});
```

## Project Structure

```
openharness/
├── examples/
│   └── coding/          # Coding and validation workflow examples
├── packages/
│   ├── sdk/             # Core SDK (harness, channels, events)
│   ├── anthropic/       # Claude/Anthropic integration
│   ├── core/            # Shared utilities
│   ├── transports/      # Transport implementations
│   └── config/          # Configuration
└── .knowledge/          # Documentation and design docs
```

## Documentation

The `.knowledge/` directory contains comprehensive documentation:

- **[Why OpenHarness?](.knowledge/docs/why.md)** - Design philosophy and principles
- **[How It Works](.knowledge/docs/how-it-works.md)** - Architecture deep-dive with examples
- **[Provider Guide](.knowledge/docs/provider-guide.md)** - Building custom LLM provider integrations
- **[Migration Guide](.knowledge/docs/migration-anthropic.md)** - Migrating from old class-based patterns

## Key Concepts

### Harness = Control Flow Only
The harness orchestrates workflow phases. It should NEVER execute bash commands or manipulate files - that's what agents do.

✅ **Good:** Pass data between agents, emit events
❌ **Bad:** Execute commands, write files directly

### Agent-to-Agent Handoff
Agents communicate via structured data (file paths, IDs, results).

```typescript
// Phase 1: Agent writes file, returns path
const { filePath } = await agents.coder.execute({ task });

// Phase 2: Agent uses file path
const result = await agents.validator.execute({ filePath });
```

### Channel Composition
Compose multiple channels for separation of concerns:

```typescript
await MyWorkflow
  .create(input)
  .attach(ConsoleChannel)        // Standard events
  .attach(ValidationChannel)     // Custom events
  .run();
```

## Development

```bash
# Install dependencies
bun install

# Run tests (safe - no network)
bun run test

# Run integration tests (requires auth)
bun run test:live

# Type check
bun run typecheck

# Lint
bun run lint
```

### Authentication

This project uses Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`. The SDK handles auth automatically - no API keys needed.

**Important:** Do NOT set `ANTHROPIC_API_KEY`. The SDK uses Claude Code's built-in authentication.

## Contributing

OpenHarness follows strict architectural principles:

1. **Harness = Control Flow**: Orchestration only, no execution
2. **Agents = Heavy Lifting**: LLM tasks with tool access
3. **Channels = Presentation**: Event-driven output rendering
4. **Type Safety**: Zod schemas for all inputs/outputs
5. **Simplicity**: Code should be obvious, not clever

See [.knowledge/docs/why.md](.knowledge/docs/why.md) for our design philosophy.

## License

MIT
