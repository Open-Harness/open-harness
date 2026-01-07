# Codex Provider Implementation

## Task
Implement a provider trait for Codex that integrates their coding assistant SDK.

## SDK Documentation

**Primary References:**
- [Codex TypeScript SDK](https://github.com/openai/codex/blob/main/sdk/typescript/README.md) - Complete SDK docs
- [Streaming Responses](https://github.com/openai/codex/blob/main/sdk/typescript/README.md#streaming-responses) - `runStreamed()` API
- [Thread Management](https://github.com/openai/codex/blob/main/sdk/typescript/README.md#resuming-an-existing-thread) - Thread resume pattern

**Key SDK Capabilities:**
- Spawns CLI and exchanges JSONL events over stdin/stdout
- Thread-based interaction model with persistence
- Streaming via `runStreamed()` async generator
- Thread resumption via `resumeThread()`
- Structured output support via JSON schema
- Working directory controls

## SDK Installation

```bash
bun add @openai/codex-sdk
```

**Requirement:** Node.js 18+

## Provider Configuration

```typescript
{
  type: "codex.agent";
  displayName: "Codex";
  capabilities: {
    streaming: true,      // Supports runStreamed()
    structuredOutput: true // Supports outputSchema
  };
}
```

## Input Schema

```typescript
{
  prompt: string | Array<     // String or structured entries
    { type: "text"; text: string }
  | { type: "local_image"; path: string }
  >;
  threadId?: string;          // Resume existing thread (Codex thread ID)
  workingDirectory?: string;  // Optional working directory
  outputSchema?: any;         // Optional JSON schema for structured output
  skipGitRepoCheck?: boolean; // Skip git repo requirement
  // Additional Codex-specific params...
}
```

## Output Schema

```typescript
{
  text: string;                // Final response text
  threadId: string;           // Codex thread ID for resume
  finalResponse?: any;        // If using structured output
  items?: any[];              // Items from the turn
  // Additional fields from Turn...
}
```

## Implementation Strategy

### 1. Client Initialization

```typescript
import { Codex } from "@openai/codex-sdk";

// Create Codex client
const codex = new Codex({
  env: {
    // Optional: control CLI environment
    PATH: "/usr/local/bin",
  },
  // SDK automatically injects OPENAI_BASE_URL and CODEX_API_KEY
});
```

### 2. Thread Management

```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  let thread;

  // Resume or create thread
  if (input.threadId) {
    // Resume existing thread
    thread = codex.resumeThread(input.threadId);
  } else {
    // Create new thread
    thread = codex.startThread({
      workingDirectory: input.workingDirectory,
      skipGitRepoCheck: input.skipGitRepoCheck || false,
    });
  }

  const threadId = thread.id; // Get thread ID
}
```

**Note:** Threads are persisted in `~/.codex/sessions`. The provider should extract and return the thread ID.

### 3. Streaming Implementation

Codex has native streaming support via `runStreamed()`. This returns an async generator of structured events.

```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  // ... thread setup ...

  let finalText = "";
  let finalResponse = null;
  let items = [];

  // Run with streaming
  const { events } = await thread.runStreamed(
    input.prompt,
    {
      outputSchema: input.outputSchema, // Optional structured output
    }
  );

  // Listen to context abort
  ctx.signal.addEventListener("abort", () => {
    // Codex CLI handles abort automatically
    // No explicit cleanup needed
  });

  try {
    // Iterate through streaming events
    for await (const event of events) {
      if (ctx.signal.aborted) {
        throw new Error("Aborted");
      }

      // Map Codex events to StreamEvent
      switch (event.type) {
        case "item.completed":
          // Item completed (could be tool, file change, etc.)
          items.push(event.item);
          // Emit as appropriate event type
          if (event.item.type === "tool") {
            ctx.emit({
              type: "tool",
              name: event.item.name,
              phase: "complete",
              data: event.item.output
            });
          }
          break;

        case "turn.completed":
          // Turn completed - capture final results
          finalText = event.finalResponse;
          finalResponse = event.finalResponse;
          // Emit final text as non-delta
          ctx.emit({
            type: "text",
            content: finalText
          });
          break;

        case "text.delta":
          // Streaming text delta
          finalText += event.text;
          ctx.emit({
            type: "text",
            content: event.text,
            delta: true
          });
          break;

        case "tool.start":
          ctx.emit({
            type: "tool",
            name: event.toolName,
            phase: "start",
            data: event.input
          });
          break;

        case "tool.output":
          ctx.emit({
            type: "tool",
            name: event.toolName,
            phase: "complete",
            data: event.output
          });
          break;

        // Handle other event types...
        default:
          console.log("Unhandled event:", event.type);
      }
    }
  } catch (error) {
    if (ctx.signal.aborted) {
      throw new ProviderError("ABORT", "Operation was aborted");
    }
    throw error;
  }

  return {
    text: finalText,
    threadId: threadId,
    finalResponse: finalResponse,
    items: items
  };
}
```

### 4. Event Mapping

Based on Codex event types from SDK documentation:

```typescript
// Known Codex event types:
// - "text.delta" - Streaming text content
// - "item.completed" - An item was completed (tool, file, etc.)
// - "turn.completed" - The entire turn completed
// - "tool.start" - Tool execution started
// - "tool.output" - Tool produced output
// - "error" - Error occurred
// - "file.change" - File was modified

function mapCodexEvent(event: CodexEvent): StreamEvent | null {
  switch (event.type) {
    case "text.delta":
      return {
        type: "text",
        content: event.text,
        delta: true
      };

    case "tool.start":
      return {
        type: "tool",
        name: event.toolName,
        phase: "start",
        data: event.input
      };

    case "tool.output":
      return {
        type: "tool",
        name: event.toolName,
        phase: "complete",
        data: event.output
      };

    case "error":
      return {
        type: "error",
        code: "CODEX_ERROR",
        message: event.message || "Unknown error"
      };

    case "turn.completed":
      // Emit final text
      return {
        type: "text",
        content: event.finalResponse,
        delta: false
      };

    // Other events (file.change, etc.) may need custom handling
    default:
      return null;
  }
}
```

### 5. Structured Output Support

Codex supports structured output via JSON schema:

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";

// Using Zod schema
const schema = z.object({
  summary: z.string(),
  status: z.enum(["ok", "action_required"]),
});

// Run with structured output
const result = await thread.run("Summarize repository status", {
  outputSchema: zodToJsonSchema(schema, { target: "openAi" }),
});

// Or using plain JSON schema
const plainSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
} as const;

const result = await thread.run("Summarize", { outputSchema: plainSchema });
```

**Provider Integration:**

```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  // ... thread setup ...

  // Prepare output schema if provided
  let outputSchema = undefined;
  if (input.outputSchema) {
    // Convert Zod to JSON schema if needed
    outputSchema = zodToJsonSchema(input.outputSchema, { target: "openAi" });
  }

  const { events } = await thread.runStreamed(
    input.prompt,
    { outputSchema }
  );

  // ... event handling ...
}
```

### 6. Error Handling

```typescript
try {
  const { events } = await thread.runStreamed(input.prompt);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("authentication") || error.message.includes("API key")) {
      throw new ProviderError("AUTH_ERROR", "Codex authentication failed");
    }
    if (error.message.includes("permission") || error.message.includes("forbidden")) {
      throw new ProviderError("PERMISSION_DENIED", "Access denied");
    }
    if (error.message.includes("timeout")) {
      throw new ProviderError("TIMEOUT", "Request timed out");
    }
    if (error.message.includes("git")) {
      throw new ProviderError("VALIDATION_ERROR", "Working directory must be a git repository");
    }
  }
  throw new ProviderError("QUERY_FAILED", error instanceof Error ? error.message : "Unknown error");
}
```

### 7. Abort Handling

Codex CLI automatically handles aborts when the process receives signals. However, we should still respect the context abort signal:

```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  // ... thread setup ...

  // Set up abort listener
  const abortListener = () => {
    // Codex CLI will automatically exit when process terminates
    // No explicit abort needed - the generator will throw
  };

  ctx.signal.addEventListener("abort", abortListener);

  try {
    const { events } = await thread.runStreamed(input.prompt);

    for await (const event of events) {
      if (ctx.signal.aborted) {
        throw new Error("Aborted");
      }
      // Process event...
    }
  } finally {
    ctx.signal.removeEventListener("abort", abortListener);
  }
}
```

**Note:** The SDK spawns a CLI subprocess. When aborting, the subprocess will be terminated automatically when the Node process exits.

## Implementation Steps

1. **Create provider package:**
   ```bash
   mkdir -p packages/providers/codex/src
   cd packages/providers/codex
   bun init
   bun add @openai/codex-sdk zod zod-to-json-schema
   ```

2. **Implement provider trait** (`src/provider.ts`):
   - Import dependencies
   - Define input/output schemas with Zod
   - Create ProviderTrait implementation
   - Implement execute() async generator using `runStreamed()`

3. **Create entry point** (`src/index.ts`):
   ```typescript
   export { codexProvider } from "./provider";
   ```

4. **Add TypeScript config:**
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "outDir": "./dist"
     }
   }
   ```

5. **Add build script** to `package.json`:
   ```json
   {
     "scripts": {
       "build": "tsc",
       "test": "bun test"
     }
   }
   ```

6. **Register provider** in provider registry:
   ```typescript
   import { codexProvider } from "@open-harness/providers/codex";
   import { toNodeDefinition } from "@internal/core/providers";

   const node = toNodeDefinition(codexProvider);
   registry.register(node);
   ```

## Testing Requirements

### Integration Tests (Required)

**IMPORTANT:** Tests MUST use real Codex SDK calls, not mocks.

```typescript
// tests/integration/codex.test.ts
import { Codex } from "@openai/codex-sdk";
import { codexProvider } from "../src/provider";

describe("Codex Provider", () => {
  let codex: Codex;

  beforeEach(() => {
    codex = new Codex();
  });

  it("should send prompt and receive streaming response", async () => {
    const events = [];
    const execCtx = {
      signal: new AbortController().signal,
      emit: (event) => events.push(event)
    };

    const result = await codexProvider.execute(
      { prompt: "Say hello" },
      execCtx
    );

    expect(result.text).toBeDefined();
    expect(result.threadId).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === "text")).toBe(true);
  });

  it("should resume existing thread", async () => {
    // Create thread
    const thread = codex.startThread();
    await thread.run("First message");

    // Resume via provider
    const execCtx = {
      signal: new AbortController().signal,
      emit: () => {}
    };

    const result = await codexProvider.execute(
      {
        prompt: "Continue",
        threadId: thread.id
      },
      execCtx
    );

    expect(result.threadId).toBe(thread.id);
  });

  it("should support structured output", async () => {
    const schema = z.object({
      summary: z.string(),
      status: z.enum(["ok", "error"])
    });

    const execCtx = {
      signal: new AbortController().signal,
      emit: () => {}
    };

    const result = await codexProvider.execute(
      {
        prompt: "Summarize",
        outputSchema: schema
      },
      execCtx
    );

    expect(result.finalResponse).toBeDefined();
    expect(result.finalResponse.summary).toBeDefined();
    expect(result.finalResponse.status).toBeDefined();
  });

  it("should handle abort correctly", async () => {
    const abortController = new AbortController();
    const execCtx = {
      signal: abortController.signal,
      emit: () => {}
    };

    // Start execution
    const promise = codexProvider.execute(
      { prompt: "Long task" },
      execCtx
    ).next();

    // Abort after short delay
    setTimeout(() => abortController.abort(), 100);

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("should handle image attachments", async () => {
    const execCtx = {
      signal: new AbortController().signal,
      emit: () => {}
    };

    const result = await codexProvider.execute(
      {
        prompt: [
          { type: "text", text: "Describe this image" },
          { type: "local_image", path: "./test.png" }
        ]
      },
      execCtx
    );

    expect(result.text).toBeDefined();
  });
});
```

### Fixture Recording (Required)

```typescript
// scripts/record-codex-fixtures.ts
import { Codex } from "@openai/codex-sdk";
import { writeFileSync } from "fs";

const codex = new Codex();

async function recordScenario(prompt: any) {
  const thread = codex.startThread();
  const events = [];

  const { events: streamEvents } = await thread.runStreamed(prompt);

  for await (const event of streamEvents) {
    events.push(event);
  }

  return {
    threadId: thread.id,
    events: events
  };
}

// Record various scenarios
const fixtures = {
  basicPrompt: await recordScenario("Hello"),
  structuredOutput: await recordScenario("Summarize repo", {
    outputSchema: {
      type: "object",
      properties: { summary: { type: "string" } }
    }
  }),
  withImage: await recordScenario([
    { type: "text", text: "Describe" },
    { type: "local_image", path: "./test.png" }
  ]),
  // ... more scenarios
};

writeFileSync("tests/fixtures/codex.json", JSON.stringify(fixtures, null, 2));
```

## Deliverables

1. **Provider Implementation**
   - Complete `packages/providers/codex/src/provider.ts`
   - Proper TypeScript types
   - Zod schemas for input/output
   - Full `runStreamed()` integration
   - Structured output support
   - Error handling
   - Abort signal support

2. **Tests**
   - Integration tests with real SDK calls
   - Test coverage for:
     - Basic prompting
     - Thread resume
     - Structured output
     - Image attachments
     - Abort handling
     - Error cases
     - Streaming events

3. **Documentation**
   - Provider usage guide
   - Configuration options
   - Thread management pattern
   - Structured output examples
   - Error codes reference

4. **Integration**
   - Register provider in registry
   - Example flow definition using provider
   - Build script working

## Key Considerations

- **CLI Dependency:** Codex SDK spawns a CLI subprocess. Ensure proper process handling.
- **Thread Persistence:** Threads are stored in `~/.codex/sessions`. Extract and return thread IDs correctly.
- **Event Types:** Understand all Codex event types from SDK documentation before mapping.
- **Structured Output:** Codex has native structured output support via JSON schema. Leverage this capability.
- **Working Directory:** Codex requires git repo by default. Handle `skipGitRepoCheck` option appropriately.
- **Image Support:** Codex supports image attachments via structured input entries. Implement this.
- **Abort Behavior:** Codex CLI handles aborts automatically. Just respect the context signal.
- **Resource Management:** CLI subprocess will be terminated when Node process exits. No explicit cleanup needed.

## Questions to Answer Before Implementation

1. Should we require a git repository or always pass `skipGitRepoCheck`?
2. Should we support all input entry types (text, local_image) or just string?
3. How should we handle file change events from Codex?
4. Should we support structured output as a first-class feature in our provider?
5. How should we handle thread cleanup? Let Codex manage persistence or provide delete option?

## Additional Resources

- [Codex GitHub Repository](https://github.com/openai/codex) - Source code
- [Codex TypeScript SDK](https://github.com/openai/codex/tree/main/sdk/typescript) - SDK implementation
- [Zod to JSON Schema](https://www.npmjs.com/package/zod-to-json-schema) - For structured output
