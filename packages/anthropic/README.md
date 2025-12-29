# @openharness/anthropic

Anthropic/Claude provider implementation for the Open Harness SDK.

## Installation

```bash
npm install @openharness/anthropic @openharness/sdk
```

## Quick Start

### Using Preset Agents (Standalone Execution)

```typescript
import { CodingAgent, executeAgent } from "@openharness/anthropic";

const result = await executeAgent(CodingAgent, {
  task: "Write a function to calculate fibonacci numbers"
});

console.log(result.code);
console.log(result.explanation);
```

### Creating Custom Agents

```typescript
import { defineAnthropicAgent, executeAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

// Define agent (returns config object)
const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

// Execute using helper
const result = await executeAgent(MyAgent, { task: "Hello" });
```

### Using Agents in Harnesses (Recommended)

```typescript
import { defineHarness } from "@openharness/sdk";
import { CodingAgent } from "@openharness/anthropic/presets";

const MyHarness = defineHarness({
  agents: { coder: CodingAgent },
  run: async ({ agents }) => {
    return agents.coder.execute({ task: "Write hello world" });
  },
});

const result = await MyHarness.create().run();
```

## Documentation

- **Architecture Guide**: [How It Works](../../.knowledge/docs/how-it-works.md)
- **API Reference**: [API Documentation](../../.knowledge/docs/api/anthropic-api.md)
- **Migration Guide**: [Migrating from Old API](../../.knowledge/docs/migration-anthropic.md)

## Package Exports

- `@openharness/anthropic` - Factory API
  - `defineAnthropicAgent()` - Define agent configuration
  - `executeAgent()` - Execute agent standalone
  - `streamAgent()` - Stream agent execution
  - `createPromptTemplate()` - Create typed prompt templates
- `@openharness/anthropic/presets` - Pre-configured agents (CodingAgent, ReviewAgent, PlannerAgent)
- `@openharness/anthropic/provider` - Provider internals (types, event mapper, AgentBuilder)
- `@openharness/anthropic/runner` - Runner infrastructure
- `@openharness/anthropic/recording` - Recording/replay system

## Architecture

This package follows a clean dependency injection architecture:

1. **Agent Definitions**: Plain configuration objects (serializable, testable)
2. **AgentBuilder**: Injectable service that constructs executable agents from definitions
3. **Execution Helpers**: `executeAgent()` and `streamAgent()` for standalone execution
4. **Harness Integration**: Automatic detection and building of agent definitions in harnesses

See [Architecture Guide](../../.knowledge/docs/how-it-works.md) for details.

## License

MIT
