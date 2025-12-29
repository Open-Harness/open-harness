# Quickstart: Anthropic Package Refactor

**Branch**: `013-anthropic-refactor` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)

---

## User Story 1: Custom Agent Creation (P1)

**Goal**: Create a custom agent in less than 20 lines.

```typescript
// custom-agent.ts - 16 lines total
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

const SummaryInputSchema = z.object({ text: z.string() });
const SummaryOutputSchema = z.object({ summary: z.string(), wordCount: z.number() });

const summaryPrompt = createPromptTemplate(
  "Summarize the following text in 2-3 sentences:\n\n{{text}}",
  SummaryInputSchema
);

export const SummaryAgent = defineAnthropicAgent({
  name: "Summarizer",
  prompt: summaryPrompt,
  inputSchema: SummaryInputSchema,
  outputSchema: SummaryOutputSchema,
});

// Usage
const result = await SummaryAgent.execute({ text: "Long article..." });
console.log(result.summary, result.wordCount);
```

**Verification**: Line count = 16 (under 20). TypeScript infers `result` as `{ summary: string; wordCount: number }`.

---

## User Story 2: Quick Start with Presets (P1)

**Goal**: Use a pre-built agent with zero configuration.

```typescript
// use-preset.ts - 5 lines total
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({ task: "Write a hello world function" });
console.log(result.code);
```

**Verification**: Setup code = 0 lines before `.execute()`. Just import + call.

---

## User Story 3: Override Preset Prompts (P2)

**Goal**: Customize preset agent prompts while keeping type safety.

```typescript
// override-prompt.ts
import { CodingAgent, CodingInputSchema } from "@openharness/anthropic/presets";
import { createPromptTemplate } from "@openharness/anthropic";

const customPrompt = createPromptTemplate(
  "You are a Python expert. Write clean, PEP8-compliant code.\n\nTask: {{task}}",
  CodingInputSchema
);

const result = await CodingAgent.execute(
  { task: "Write a quicksort function" },
  { prompt: customPrompt }
);
```

**Verification**: TypeScript enforces that customPrompt matches CodingInputSchema.

```typescript
// This would cause a TypeScript error:
const badPrompt = createPromptTemplate(
  "Task: {{taskName}}", // ❌ 'taskName' not in CodingInputSchema
  CodingInputSchema
);
```

---

## User Story 4: Portable Runtime (P2)

**Goal**: Run in Node.js without Bun.

```typescript
// Works in both Node.js and Bun
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";

// No Bun.file() - templates are TypeScript exports
const prompt = createPromptTemplate("Hello {{name}}", z.object({ name: z.string() }));

const agent = defineAnthropicAgent({
  name: "Greeter",
  prompt,
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
});

// Run with: node --experimental-vm-modules index.js
// Or: bun run index.ts
```

**Verification**: `node --test` passes. No `Bun` global references in prompts.

---

## User Story 5: Documentation Navigation (P3)

**Navigation Path**:

1. Open `CLAUDE.md` (root)
2. Find link: "See [How It Works](/.knowledge/docs/how-it-works.md)"
3. Read architecture guide

**Expected in how-it-works.md**:
- Layer diagram (infra → provider → presets)
- Request flow explanation
- Code examples for each layer

---

## Edge Cases

### Prompt Template Missing Variable

```typescript
const badTemplate = createPromptTemplate(
  "Hello {{name}}!",
  z.object({ greeting: z.string() }) // ❌ Missing 'name' property
);
// TypeScript Error: Property 'name' is missing in type '{ greeting: string }'
```

### Custom Prompt Wrong Output Type

```typescript
import { CodingAgent } from "@openharness/anthropic/presets";
import { createPromptTemplate } from "@openharness/anthropic";

const customPrompt = createPromptTemplate(
  "Write: {{task}}",
  z.object({ task: z.string() })
);

// This compiles - input matches
await CodingAgent.execute({ task: "..." }, { prompt: customPrompt });
// Output type is still CodingOutput (validated by agent's outputSchema)
```

### Import from Old Path

```typescript
// Console warning (if any deprecated path usage detected at runtime)
import { CodingAgent } from "@openharness/anthropic";
// ⚠️ CodingAgent is not exported from main. Use @openharness/anthropic/presets
```

### Invalid Zod Schema

```typescript
const agent = defineAnthropicAgent({
  name: "Bad",
  prompt: "...",
  inputSchema: null as any, // ❌ Throws at agent creation time
  outputSchema: z.object({}),
});
// Error: inputSchema must be a valid Zod schema
```

### Execution Timeout

```typescript
const result = await agent.execute(
  { task: "..." },
  { timeoutMs: 5000 }
);
// Throws: Error: Agent execution timed out after 5000ms
```

---

## Migration from BaseAnthropicAgent

### Before (Class-based)

```typescript
@injectable()
class MyCodingAgent extends BaseAnthropicAgent {
  constructor(
    runner = inject(IAnthropicRunnerToken),
    eventBus = inject(IEventBusToken, { optional: true }) ?? null,
  ) {
    super("MyCoder", runner, eventBus);
  }

  async execute(task: string, sessionId: string): Promise<CodingResult> {
    return this.run(await PromptRegistry.formatCoding({ task }), sessionId, {
      outputFormat: CodingResultSdkSchema,
    });
  }
}
```

### After (Factory-based)

```typescript
const MyCodingAgent = defineAnthropicAgent({
  name: "MyCoder",
  prompt: createPromptTemplate("Task: {{task}}", z.object({ task: z.string() })),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: CodingResultSchema,
});
```

**Diff**: 20+ lines → 6 lines. No DI knowledge required.

---

**Last Updated**: 2025-12-28
