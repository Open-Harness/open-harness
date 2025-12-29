# @openharness/anthropic

Anthropic/Claude provider implementation for the Open Harness SDK.

## Installation

```bash
npm install @openharness/anthropic @openharness/sdk
```

## Quick Start

### Using Preset Agents

```typescript
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({
  task: "Write a function to calculate fibonacci numbers"
});

console.log(result.code);
console.log(result.explanation);
```

### Creating Custom Agents

```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

const result = await MyAgent.execute({ task: "Hello" });
```

## Documentation

- **Architecture Guide**: [How It Works](../../.knowledge/docs/how-it-works.md)
- **API Reference**: [API Documentation](../../.knowledge/docs/api/anthropic-api.md)
- **Migration Guide**: [Migrating from Old API](../../.knowledge/docs/migration-anthropic.md)

## Package Exports

- `@openharness/anthropic` - Factory API (defineAnthropicAgent, createPromptTemplate)
- `@openharness/anthropic/presets` - Pre-configured agents (CodingAgent, ReviewAgent, PlannerAgent)
- `@openharness/anthropic/provider` - Provider internals (types, event mapper)
- `@openharness/anthropic/runner` - Runner infrastructure
- `@openharness/anthropic/recording` - Recording/replay system

## License

MIT
