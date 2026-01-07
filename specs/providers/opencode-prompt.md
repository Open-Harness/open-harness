# OpenCode Provider Implementation

## Task
Implement a provider trait for OpenCode that integrates their coding assistant SDK.

## SDK Documentation

**Primary References:**
- [OpenCode SDK Docs](https://opencode.ai/docs/sdk/) - Complete SDK documentation
- [Session Management](https://opencode.ai/docs/sdk/#sessions) - Session API methods
- [Event Streaming](https://opencode.ai/docs/sdk/#events) - Server-sent events
- [Client Configuration](https://opencode.ai/docs/sdk/#create-client) - Client setup

**Key SDK Capabilities:**
- Type-safe JS/TS client: `@opencode-ai/sdk`
- Session-based interaction model
- Server-sent events for real-time streaming
- Session management with ID tracking
- Abort support via `session.abort()`

## SDK Installation

```bash
bun add @opencode-ai/sdk
```

## Provider Configuration

```typescript
{
  type: "opencode.agent";
  displayName: "OpenCode";
  capabilities: {
    streaming: true,      // Supports SSE streaming
    structuredOutput: false
  };
}
```

## Input Schema

```typescript
{
  prompt: string;              // User prompt to send
  sessionId?: string;          // Resume existing session (OpenCode session ID)
  model?: {                    // Optional model configuration
    providerID: string;
    modelID: string;
  };
  parts?: Array<               // Optional structured parts
    { type: "text"; text: string }
  >;
  // Additional OpenCode-specific params...
}
```

## Output Schema

```typescript
{
  text: string;                // Final assistant response text
  sessionId: string;          // OpenCode session ID for resume
  // Additional fields from AssistantMessage parts...
}
```

## Implementation Strategy

### 1. Client Initialization

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk";

// Create client (connects to existing opencode server)
const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
});
```

**Note:** OpenCode requires a running server instance. The provider can either:
- Connect to an existing server (recommended)
- Spin up its own server instance via `createOpencode()`

### 2. Session Management

```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  let session;

  // Resume or create session
  if (input.sessionId) {
    // Get existing session
    session = await client.session.get({
      path: { id: input.sessionId }
    });
  } else {
    // Create new session
    session = await client.session.create({
      body: { title: "Open Harness Session" }
    });
  }

  const sessionId = session.id;
}
```

### 3. Streaming Implementation

OpenCode supports streaming via server-sent events. You have two options:

**Option A: Use Event Subscription (Recommended for real-time)**
```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  // ... session setup ...

  // Send prompt
  const promptResult = await client.session.prompt({
    path: { id: sessionId },
    body: {
      model: input.model || { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
      parts: input.parts || [{ type: "text", text: input.prompt }]
    }
  });

  // Subscribe to events for real-time updates
  const events = await client.event.subscribe();
  const stream = events.stream;

  try {
    for await (const event of stream) {
      if (ctx.signal.aborted) {
        await client.session.abort({ path: { id: sessionId } });
        throw new Error("Aborted");
      }

      // Map OpenCode events to StreamEvent
      if (event.type === "message") {
        ctx.emit({ type: "text", content: event.content, delta: true });
      }
      // Handle other event types...
    }
  } finally {
    // Clean up event subscription
  }

  return {
    text: finalText,
    sessionId: sessionId
  };
}
```

**Option B: Poll Session Messages (Simpler, less real-time)**
```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  // ... session setup ...

  // Send prompt
  await client.session.prompt({
    path: { id: sessionId },
    body: {
      model: input.model,
      parts: input.parts || [{ type: "text", text: input.prompt }]
    }
  });

  // Poll for messages
  let lastMessageId = null;
  while (!ctx.signal.aborted) {
    const messages = await client.session.messages({
      path: { id: sessionId }
    });

    // Emit new messages as deltas
    for (const msg of messages) {
      if (msg.info.id !== lastMessageId) {
        for (const part of msg.parts) {
          if (part.type === "text") {
            ctx.emit({ type: "text", content: part.text, delta: true });
          }
          // Handle other part types...
        }
        lastMessageId = msg.info.id;
      }
    }

    // Check if complete (implementation-specific)
    if (isComplete) break;

    await sleep(100);
  }

  return {
    text: finalText,
    sessionId: sessionId
  };
}
```

### 4. Event Mapping

```typescript
// Map OpenCode message parts to StreamEvents
function mapPartToEvent(part: Part): StreamEvent {
  switch (part.type) {
    case "text":
      return { type: "text", content: part.text, delta: true };

    case "thinking":
      return { type: "thinking", content: part.content, delta: true };

    case "tool_use":
      return {
        type: "tool",
        name: part.name,
        phase: "start",
        data: part.input
      };

    case "tool_result":
      return {
        type: "tool",
        name: part.tool_use_id,
        phase: "complete",
        data: part.output
      };

    default:
      return { type: "error", code: "UNKNOWN_PART", message: `Unknown part type: ${part.type}` };
  }
}
```

### 5. Error Handling

```typescript
try {
  await client.session.prompt({ /* ... */ });
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("auth")) {
      throw new ProviderError("AUTH_ERROR", "OpenCode authentication failed");
    }
    if (error.message.includes("permission")) {
      throw new ProviderError("PERMISSION_DENIED", "Access denied");
    }
    if (error.message.includes("timeout")) {
      throw new ProviderError("TIMEOUT", "Request timed out");
    }
  }
  throw new ProviderError("QUERY_FAILED", error instanceof Error ? error.message : "Unknown error");
}
```

### 6. Abort Handling

```typescript
async *execute(input: TInput, ctx: ExecutionContext) {
  // ... setup ...

  const abortController = new AbortController();

  // Listen to context abort
  ctx.signal.addEventListener("abort", async () => {
    // Abort OpenCode session
    await client.session.abort({
      path: { id: sessionId }
    });
    abortController.abort();
  });

  try {
    // ... execution ...
  } catch (error) {
    if (ctx.signal.aborted) {
      throw new ProviderError("ABORT", "Operation was aborted");
    }
    throw error;
  }
}
```

## Implementation Steps

1. **Create provider package:**
   ```bash
   mkdir -p packages/providers/opencode/src
   cd packages/providers/opencode
   bun init
   bun add @opencode-ai/sdk zod
   ```

2. **Implement provider trait** (`src/provider.ts`):
   - Import dependencies
   - Define input/output schemas with Zod
   - Create ProviderTrait implementation
   - Implement execute() async generator

3. **Create entry point** (`src/index.ts`):
   ```typescript
   export { opencodeProvider } from "./provider";
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
   import { opencodeProvider } from "@open-harness/providers/opencode";
   import { toNodeDefinition } from "@internal/core/providers";

   const node = toNodeDefinition(opencodeProvider);
   registry.register(node);
   ```

## Testing Requirements

### Integration Tests (Required)

**IMPORTANT:** Tests MUST use real OpenCode SDK calls, not mocks.

```typescript
// tests/integration/opencode.test.ts
import { opencodeProvider } from "../src/provider";

describe("OpenCode Provider", () => {
  it("should send prompt and receive streaming response", async () => {
    const events = [];
    const execCtx = {
      signal: new AbortController().signal,
      emit: (event) => events.push(event)
    };

    const result = await opencodeProvider.execute(
      { prompt: "Say hello" },
      execCtx
    );

    expect(result.text).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
  });

  it("should resume existing session", async () => {
    // Create session
    const session = await client.session.create({ body: { title: "Test" } });

    // Resume via provider
    const execCtx = {
      signal: new AbortController().signal,
      emit: () => {}
    };

    const result = await opencodeProvider.execute(
      {
        prompt: "Continue",
        sessionId: session.id
      },
      execCtx
    );

    expect(result.sessionId).toBe(session.id);
  });

  it("should handle abort correctly", async () => {
    const abortController = new AbortController();
    const execCtx = {
      signal: abortController.signal,
      emit: () => {}
    };

    // Start execution
    const promise = opencodeProvider.execute(
      { prompt: "Long task" },
      execCtx
    ).next();

    // Abort after short delay
    setTimeout(() => abortController.abort(), 100);

    await expect(promise).rejects.toThrow("Aborted");
  });
});
```

### Fixture Recording (Required)

```typescript
// scripts/record-opencode-fixtures.ts
import { createOpencodeClient } from "@opencode-ai/sdk";
import { writeFileSync } from "fs";

const client = createOpencodeClient({ baseUrl: "http://localhost:4096" });

// Record various scenarios
const fixtures = {
  basicPrompt: await recordScenario({ prompt: "Hello" }),
  withSession: await recordScenario({ prompt: "Hello", sessionId: "xxx" }),
  toolUse: await recordScenario({ prompt: "Run tests" }),
  // ... more scenarios
};

writeFileSync("tests/fixtures/opencode.json", JSON.stringify(fixtures, null, 2));
```

## Deliverables

1. **Provider Implementation**
   - Complete `packages/providers/opencode/src/provider.ts`
   - Proper TypeScript types
   - Zod schemas for input/output
   - Error handling
   - Abort signal support

2. **Tests**
   - Integration tests with real SDK calls
   - Test coverage for:
     - Basic prompting
     - Session resume
     - Abort handling
     - Error cases
     - Streaming events

3. **Documentation**
   - Provider usage guide
   - Configuration options
   - Session management pattern
   - Error codes reference

4. **Integration**
   - Register provider in registry
   - Example flow definition using provider
   - Build script working

## Key Considerations

- **Server Dependency:** OpenCode requires a running server. Decide whether provider connects to existing instance or spawns its own.
- **Event Model:** OpenCode uses SSE events. Understand the event structure from docs before mapping.
- **Session IDs:** Critical for resume functionality. Always return session ID in output.
- **Abort Cleanup:** Always abort OpenCode session when context is aborted.
- **Error Mapping:** Map OpenCode errors to ProviderError codes appropriately.
- **Resource Management:** Clean up event subscriptions and connections properly.

## Questions to Answer Before Implementation

1. Should the provider connect to an existing OpenCode server or spawn its own instance?
2. How should we handle the case where no OpenCode server is running?
3. Should we support all session management operations (delete, share, summarize) or just prompt?
4. How should we handle multi-part messages beyond simple text?
5. Should we support OpenCode's file operations (find, read, write)?
