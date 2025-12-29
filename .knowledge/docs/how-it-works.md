# How @openharness/anthropic Works

> Architecture guide for the Anthropic agent package

## Overview

The `@openharness/anthropic` package provides a factory-based API for creating LLM agents using the Claude Agent SDK. It follows a three-layer architecture that separates concerns and enables both quick-start usage and deep customization.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Code                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PRESETS LAYER (src/presets/)                               │
│  Pre-configured agents for common use cases                 │
│  • CodingAgent, ReviewAgent, PlannerAgent                   │
│  • TypeScript prompt templates                              │
│  • Zod input/output schemas                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PROVIDER LAYER (src/provider/)                             │
│  Factory API for creating custom agents                     │
│  • defineAnthropicAgent()                                   │
│  • createPromptTemplate()                                   │
│  • Type-safe prompt interpolation                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  INFRA LAYER (src/infra/)                                   │
│  Runtime services and SDK integration                       │
│  • DI container (needle-di)                                 │
│  • Agent runner (Claude Agent SDK wrapper)                  │
│  • Recording/replay system                                  │
│  • Event bus                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  @anthropic-ai/claude-agent-sdk                             │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow

When you execute an agent, here's what happens:

```
1. Application calls agent.execute({ task: "..." })
           │
           ▼
2. Provider layer validates input with Zod schema
           │
           ▼
3. Prompt template renders with input data
   "Task: {{task}}" → "Task: Write a function"
           │
           ▼
4. InternalAnthropicAgent sends to IAgentRunner
           │
           ▼
5. Infra layer wraps with recording/monologue (if enabled)
           │
           ▼
6. Claude Agent SDK executes the LLM request
           │
           ▼
7. Response flows back through layers
           │
           ▼
8. Output validated against Zod schema
           │
           ▼
9. Typed result returned to application
```

## Usage Examples

### Quick Start with Presets

```typescript
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({
  task: "Write a function to calculate fibonacci numbers"
});

console.log(result.code);
console.log(result.explanation);
```

### Custom Agent with Factory

```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

// Define schemas
const InputSchema = z.object({
  topic: z.string().min(1),
  audience: z.string().optional(),
});

const OutputSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
});

// Create type-safe prompt template
const BlogTemplate = createPromptTemplate(`
# Blog Writer Agent

Write a blog post about {{topic}}.
${audience ? `Target audience: {{audience}}` : ""}

Return structured output with title, content, and tags.
`);

// Define the agent
const BlogAgent = defineAnthropicAgent({
  name: "BlogAgent",
  prompt: BlogTemplate,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 3,
  },
});

// Use it
const blog = await BlogAgent.execute({
  topic: "TypeScript best practices",
  audience: "intermediate developers",
});
```

### Override Preset Prompts

```typescript
import { CodingAgent, CodingInputSchema } from "@openharness/anthropic/presets";
import { createPromptTemplate } from "@openharness/anthropic";

// Create a custom prompt with the same input type
const CustomCodingPrompt = createPromptTemplate(
  `[CUSTOM MODE] Please complete: {{task}}`,
  CodingInputSchema
);

// Use preset with custom prompt
const result = await CodingAgent.execute(
  { task: "Build a REST API" },
  { prompt: CustomCodingPrompt }
);
```

## Key Concepts

### Type-Safe Prompt Templates

Templates use `{{variable}}` syntax and extract variable names at compile time:

```typescript
// TypeScript knows 'name' and 'task' are required
const template = createPromptTemplate("Hello {{name}}, do {{task}}");
template.render({ name: "Claude", task: "coding" }); // OK
template.render({ name: "Claude" }); // Type error: missing 'task'
```

### Lazy Container Initialization

Agents defer container access until first execution. This allows:
- Defining agents at module level
- Configuring DI container at runtime
- Testing with mock containers

### Unified Event Bus

All agents emit events to `IUnifiedEventBus` for observability:
- `agent.start` / `agent.complete`
- `agent.text` / `agent.thinking`
- `agent.tool.call` / `agent.tool.result`

## File Structure

```
packages/anthropic/src/
├── index.ts              # Main exports
├── provider/             # Factory API (defineAnthropicAgent)
│   ├── factory.ts        # Agent factory
│   ├── types.ts          # Type definitions
│   ├── prompt-template.ts # Template system
│   └── internal-agent.ts # Execution engine
├── presets/              # Pre-built agents
│   ├── coding-agent.ts
│   ├── review-agent.ts
│   ├── planner-agent.ts
│   └── prompts/          # TypeScript templates
└── infra/                # Runtime services
    ├── runner/           # SDK wrapper
    ├── recording/        # Record/replay
    └── tokens.ts         # DI tokens
```

## See Also

- [Spec: 013-anthropic-refactor](/specs/013-anthropic-refactor/spec.md)
- [SDK Documentation](./sdk/)
- [Why Open Harness?](./why.md)
