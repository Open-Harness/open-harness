# Migration Guide: Anthropic Provider v1.0

## Overview

The Anthropic provider has been refactored from class-based inheritance to a factory-based API. This guide helps you migrate existing code to the new architecture.

## Breaking Changes

### Removed (Deleted, Not Deprecated)

The following were **deleted** in v1.0 (no backward compatibility):

- `BaseAnthropicAgent` - Use `defineAnthropicAgent()` instead
- `CodingAgent` (class) - Use `CodingAgent` (preset) from `@openharness/anthropic/presets`
- `ReviewAgent` (class) - Use `ReviewAgent` (preset)
- `PlannerAgent` (class) - Use `PlannerAgent` (preset)
- `ParserAgent` - No replacement (internal implementation detail)
- `ValidationReviewAgent` - No replacement (internal implementation detail)
- `PromptRegistry` - Use `createPromptTemplate()` instead
- `mapSdkMessageToEvents()` - Use `AnthropicEventMapper.toUnifiedEvents()` if needed
- `mapSdkMessageToUnifiedEvents()` - Use `AnthropicEventMapper.toUnifiedEvents()`

**Philosophy**: Pre-1.0 clean break. No deprecation warnings, no backward compatibility layer.

---

## Migration Patterns

### Pattern 1: From BaseAnthropicAgent to defineAnthropicAgent

**Before** (v0.x - class-based):
```typescript
import { BaseAnthropicAgent } from "@openharness/anthropic";
import { z } from "zod";

class MyAgent extends BaseAnthropicAgent<MyInput, MyOutput> {
  constructor() {
    super({
      name: "MyAgent",
      inputSchema: z.object({ task: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
  }

  protected getPrompt(input: MyInput): string {
    return `Task: ${input.task}`;
  }
}

const agent = new MyAgent();
const result = await agent.run({ task: "Hello" });
```

**After** (v1.0 - factory-based):
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

**Key Changes**:
- ❌ No inheritance, use factory function
- ❌ No `new` keyword (agent is constant, not instance)
- ❌ `run()` → `execute()`
- ✅ Prompt is template with type-safe variables, not method
- ✅ Agent is reusable constant

---

### Pattern 2: From Preset Classes to Preset Constants

**Before** (v0.x):
```typescript
import { CodingAgent } from "@openharness/anthropic";

const agent = new CodingAgent();
const result = await agent.run({ task: "Write a function" });
console.log(result.code);
```

**After** (v1.0):
```typescript
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({ task: "Write a function" });
console.log(result.code);
```

**Key Changes**:
- ✅ Import from `/presets` sub-path
- ❌ No `new` keyword (it's a constant, not a class)
- ❌ `run()` → `execute()`
- ✅ Same input/output types

---

### Pattern 3: From PromptRegistry to createPromptTemplate

**Before** (v0.x):
```typescript
import { PromptRegistry } from "@openharness/anthropic";

const prompt = await PromptRegistry.formatCoding({ task: "Write code" });
```

**After** (v1.0):
```typescript
import { createPromptTemplate } from "@openharness/anthropic";

const template = createPromptTemplate("Task: {{task}}");
const prompt = template.render({ task: "Write code" });
```

**Key Changes**:
- ✅ Create reusable template with compile-time type checking
- ❌ Synchronous render (no async needed)
- ✅ Type-safe variable interpolation via `{{variable}}` syntax

---

### Pattern 4: From Method Override to Prompt Override

**Before** (v0.x - override via subclass):
```typescript
class CustomAgent extends BaseAnthropicAgent<Input, Output> {
  protected getPrompt(input: Input): string {
    return `[CUSTOM]\n${super.getPrompt(input)}`;
  }
}
```

**After** (v1.0 - override at runtime):
```typescript
const agent = defineAnthropicAgent({
  name: "Agent",
  prompt: createPromptTemplate("Default: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

// Override prompt for specific execution
const customPrompt = createPromptTemplate("[CUSTOM]\nTask: {{task}}");
const result = await agent.execute(
  { task: "test" },
  { prompt: customPrompt }
);
```

**Key Changes**:
- ❌ No subclassing for customization
- ✅ Runtime prompt override via `executeOptions.prompt`
- ✅ Agents remain reusable constants

---

### Pattern 5: From Constructor Options to Definition Options

**Before** (v0.x):
```typescript
class MyAgent extends BaseAnthropicAgent<Input, Output> {
  constructor() {
    super({
      name: "MyAgent",
      inputSchema,
      outputSchema,
      options: {
        model: "claude-sonnet-4-20250514",
        maxTokens: 4096,
      },
    });
  }
}
```

**After** (v1.0):
```typescript
const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema,
  outputSchema,
  options: {
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
  },
});
```

**Key Changes**:
- ❌ No constructor, pass options to factory
- ✅ Same options interface

---

## Advanced Migration

### Event Handling

**Before** (v0.x - method overrides):
```typescript
class MyAgent extends BaseAnthropicAgent<Input, Output> {
  protected onText(text: string): void {
    console.log("Text:", text);
  }

  protected onToolCall(name: string, input: unknown): void {
    console.log("Tool:", name);
  }
}
```

**After** (v1.0 - callbacks):
```typescript
import type { IAgentCallbacks } from "@openharness/sdk";

const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema,
  outputSchema,
});

const callbacks: IAgentCallbacks<Output> = {
  onText: (text) => console.log("Text:", text),
  onToolCall: (event) => console.log("Tool:", event.toolName),
};

await MyAgent.execute({ task: "test" }, { callbacks });
```

**Key Changes**:
- ❌ No method overrides
- ✅ Pass callbacks to `execute()` options
- ✅ Type-safe callback interface

---

### Custom Event Mappers

If you were using event mappers directly:

**Before** (v0.x):
```typescript
import { mapSdkMessageToUnifiedEvents } from "@openharness/anthropic";

const events = mapSdkMessageToUnifiedEvents(sdkMessage, "MyAgent");
```

**After** (v1.0):
```typescript
import { AnthropicEventMapper } from "@openharness/anthropic";

const events = AnthropicEventMapper.toUnifiedEvents(sdkMessage, "MyAgent");
```

**Key Changes**:
- ✅ Static class method instead of free function
- ✅ Same signature and behavior
- ✅ Located in provider layer (clearer architecture)

---

### Streaming Execution

**Before** (v0.x):
```typescript
const agent = new MyAgent();

for await (const message of agent.runStream({ task: "test" })) {
  console.log(message);
}
```

**After** (v1.0):
```typescript
const MyAgent = defineAnthropicAgent({ /* ... */ });

const handle = MyAgent.stream({ task: "test" });

// Can interrupt mid-execution
handle.interrupt();

// Wait for final result
const result = await handle.result;
```

**Key Changes**:
- ❌ No async generator
- ✅ Returns `AgentHandle` with `result` promise
- ✅ Supports interruption via `handle.interrupt()`

---

## Testing Changes

**Before** (v0.x - subclass for testing):
```typescript
import { BaseAnthropicAgent } from "@openharness/anthropic";

class TestAgent extends BaseAnthropicAgent<Input, Output> {
  // Override methods for testing
}
```

**After** (v1.0 - container injection):
```typescript
import { defineAnthropicAgent, setFactoryContainer } from "@openharness/anthropic";
import { createTestContainer } from "@openharness/sdk";

const testContainer = createTestContainer({ mode: "replay" });
setFactoryContainer(testContainer);

const TestAgent = defineAnthropicAgent({
  // Agent definition
});

// Container provides mock runner
await TestAgent.execute({ task: "test" });
```

**Key Changes**:
- ❌ No subclassing for tests
- ✅ Inject test container with mock runner
- ✅ `setFactoryContainer()` for dependency override
- ✅ `resetFactoryContainer()` for test cleanup

---

## Complete Migration Example

**Before** (v0.x - Full example):
```typescript
import { BaseAnthropicAgent, PromptRegistry } from "@openharness/anthropic";
import { z } from "zod";

interface SummaryInput {
  text: string;
  maxLength: number;
}

interface SummaryOutput {
  summary: string;
  wordCount: number;
}

class SummaryAgent extends BaseAnthropicAgent<SummaryInput, SummaryOutput> {
  constructor() {
    super({
      name: "SummaryAgent",
      inputSchema: z.object({
        text: z.string().min(1),
        maxLength: z.number().min(10),
      }),
      outputSchema: z.object({
        summary: z.string(),
        wordCount: z.number(),
      }),
      options: {
        model: "claude-sonnet-4-20250514",
      },
    });
  }

  protected getPrompt(input: SummaryInput): string {
    return `
      Summarize the following text in ${input.maxLength} words or less:

      ${input.text}

      Return JSON: { "summary": "...", "wordCount": 123 }
    `;
  }

  protected onText(text: string): void {
    process.stdout.write(text);
  }
}

// Usage
const agent = new SummaryAgent();
const result = await agent.run({
  text: "Long text here...",
  maxLength: 50,
});
```

**After** (v1.0 - Full example):
```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import type { IAgentCallbacks } from "@openharness/sdk";
import { z } from "zod";

interface SummaryInput {
  text: string;
  maxLength: number;
}

interface SummaryOutput {
  summary: string;
  wordCount: number;
}

const SummaryAgent = defineAnthropicAgent({
  name: "SummaryAgent",
  prompt: createPromptTemplate(`
    Summarize the following text in {{maxLength}} words or less:

    {{text}}

    Return JSON: { "summary": "...", "wordCount": 123 }
  `),
  inputSchema: z.object({
    text: z.string().min(1),
    maxLength: z.number().min(10),
  }),
  outputSchema: z.object({
    summary: z.string(),
    wordCount: z.number(),
  }),
  options: {
    model: "claude-sonnet-4-20250514",
  },
});

// Usage with callbacks
const callbacks: IAgentCallbacks<SummaryOutput> = {
  onText: (text) => process.stdout.write(text),
};

const result = await SummaryAgent.execute(
  {
    text: "Long text here...",
    maxLength: 50,
  },
  { callbacks }
);

console.log(result.summary);
console.log(`Words: ${result.wordCount}`);
```

**Summary of Changes**:
1. ❌ No class, no inheritance → ✅ Factory function
2. ❌ `getPrompt()` method → ✅ Template with `{{variables}}`
3. ❌ `run()` → ✅ `execute()`
4. ❌ Method overrides → ✅ Callbacks in options
5. ❌ `new Agent()` → ✅ Reusable constant

---

## Quick Reference Table

| Old (v0.x) | New (v1.0) | Notes |
|------------|------------|-------|
| `BaseAnthropicAgent` | `defineAnthropicAgent()` | Factory function |
| `agent.run()` | `agent.execute()` | Method renamed |
| `agent.runStream()` | `agent.stream()` | Returns AgentHandle |
| `new CodingAgent()` | `CodingAgent` (constant) | Import from `/presets` |
| `PromptRegistry.format*()` | `createPromptTemplate()` | Type-safe templates |
| `getPrompt()` override | Prompt template | Declarative prompts |
| `onText()` override | `callbacks.onText` | Passed to execute() |
| Constructor options | Factory options | Same interface |
| Subclass for tests | `setFactoryContainer()` | DI container injection |

---

## Timeline

- **v0.x**: Old class-based API (deleted)
- **v1.0**: New factory API (current)
- **No deprecation period**: Clean break at v1.0 (pre-release)

---

## Need Help?

- **API Reference**: [Anthropic API Documentation](./api/anthropic-api.md)
- **Architecture**: [How It Works](./how-it-works.md)
- **Examples**: See [packages/anthropic/tests/integration/](../../packages/anthropic/tests/integration/) for working examples

---

## Common Questions

### Q: Why the breaking change?

**A**: Factory-based API provides:
- ✅ Better type inference (no manual generics)
- ✅ Cleaner syntax (no classes/inheritance)
- ✅ Runtime prompt overrides (more flexible)
- ✅ Easier testing (DI container injection)
- ✅ Consistent with modern patterns

### Q: Can I use both old and new APIs?

**A**: No. v1.0 removed the old API entirely (pre-1.0 philosophy).

### Q: What if I have many agents?

**A**: Migration is mechanical:
1. Convert class → factory call
2. Convert `getPrompt()` → template
3. Convert `run()` → `execute()`
4. Convert method overrides → callbacks

Use find-replace for most changes.

### Q: Do I need to change my tests?

**A**: Yes. Replace agent subclasses with container injection:
```typescript
// Old
class MockAgent extends BaseAnthropicAgent {}

// New
setFactoryContainer(testContainer);
const agent = defineAnthropicAgent({ /* ... */ });
```

### Q: What about recordings/replay?

**A**: Same interface, works automatically:
```typescript
const agent = defineAnthropicAgent({
  // ...
  recording: {
    enabled: true,
    vaultPath: "./recordings",
  },
});
```

---

## Feedback

Found issues or have suggestions? Open an issue on GitHub.
