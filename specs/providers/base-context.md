# Open Harness Provider Implementation Guide

## Context
You are building a provider for the Open Harness framework. This is a provider-agnostic streaming system that integrates AI coding assistants.

## Provider Trait Contract

All providers must implement the `ProviderTrait<TInput, TOutput>` interface:

```typescript
interface ProviderTrait<TInput, TOutput> {
  type: string;                    // Unique ID (e.g., "opencode.agent")
  displayName: string;             // Human-readable name
  capabilities: {
    streaming: boolean;           // Can provider stream events?
    structuredOutput: boolean;    // Can provider return structured JSON?
  };
  inputSchema: ZodSchema<TInput>;  // Input validation schema
  outputSchema: ZodSchema<TOutput>; // Output validation schema

  async *execute(
    input: TInput,
    ctx: ExecutionContext
  ): AsyncGenerator<StreamEvent, TOutput>;
}
```

## Execution Context

Providers receive minimal context to avoid runtime coupling:

```typescript
interface ExecutionContext {
  signal: AbortSignal;  // Check signal.aborted and exit if true
  emit: (event: StreamEvent) => void;  // Emit streaming events
}
```

## Stream Events

Providers emit provider-agnostic events:

```typescript
type StreamEvent =
  | { type: "text"; content: string; delta?: boolean; }
  | { type: "thinking"; content: string; delta?: boolean; }
  | { type: "tool"; name: string; phase: "start" | "complete"; data: unknown; error?: string; }
  | { type: "error"; code: string; message: string; };
```

## Input/Output Schema Requirements

Using Zod for validation:

```typescript
// Example input schema
inputSchema: z.object({
  prompt: z.string(),
  sessionId: z.string().optional(),  // For resume support
  // ... provider-specific fields
});

// Example output schema
outputSchema: z.object({
  text: z.string(),
  sessionId: z.string().optional(),  // For resume support
  // ... provider-specific fields
});
```

## Session Resume Pattern

Pause/resume is handled at workflow layer. Providers should:

1. Accept `sessionId` in input (optional)
2. Return `sessionId` in output (if supported)
3. SDK handles actual session management

No `inbox` or `resumeMessage` in provider context.

## Integration with Runtime

Use the adapter to convert trait to node definition:

```typescript
import { toNodeDefinition } from "@internal/core/providers";

const node = toNodeDefinition(myProvider);
registry.register(node);
```

The adapter:
- Validates input/output via Zod
- Maps StreamEvent to runtime events
- Handles aborts and wraps failures
- No additional provider logic needed

## Event Mapping Guide

### Text Events
- Stream text deltas: `{ type: "text", content: "partial", delta: true }`
- Complete text: `{ type: "text", content: "full text" }`

### Thinking Events
- If provider exposes reasoning: `{ type: "thinking", content: "reasoning", delta: true }`

### Tool Events
- Tool start: `{ type: "tool", name: "toolName", phase: "start", data: toolInput }`
- Tool complete: `{ type: "tool", name: "toolName", phase: "complete", data: toolOutput }`
- Tool error: `{ type: "tool", name: "toolName", phase: "complete", data: null, error: "error message" }`

### Error Events
- Emit before throwing: `{ type: "error", code: "ERROR_CODE", message: "description" }`

## Error Handling

```typescript
// Wrap SDK errors in ProviderError with appropriate codes
try {
  // SDK call
} catch (error) {
  if (error instanceof NetworkError) {
    throw new ProviderError("NETWORK_ERROR", error.message);
  }
  throw new ProviderError("QUERY_FAILED", error.message);
}
```

Common error codes:
- `AUTH_ERROR` - Authentication failure
- `PERMISSION_DENIED` - Access denied
- `TIMEOUT` - Request timed out
- `NETWORK_ERROR` - Network failure
- `QUERY_FAILED` - Generic failure
- `VALIDATION_ERROR` - Invalid input

## Abort Handling

Always respect the abort signal:

```typescript
async *execute(input: TInput, ctx: ExecutionContext): AsyncGenerator<StreamEvent, TOutput> {
  // Check signal before starting
  if (ctx.signal.aborted) {
    throw new Error("Aborted");
  }

  // During execution
  for await (const chunk of sdkStream) {
    if (ctx.signal.aborted) {
      // Clean up resources
      await cleanup();
      throw new Error("Aborted");
    }
    // Process chunk
  }
}
```

## Additional Resources

### Zod Schema Documentation
- [Zod Docs](https://zod.dev/) - For schema validation
- [AsyncGenerator Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)

### Testing Requirements
- Integration tests MUST use real SDK responses
- Never fabricate test fixtures
- Record fixtures from live SDK interactions
- Use `packages/sdk/scripts/record-fixtures.ts` pattern if available

### Provider Documentation References
- `packages/internal/core/src/providers/README.md` - Provider traits
- `packages/internal/core/src/providers/trait.ts` - Trait interface
- `packages/internal/core/src/providers/events.ts` - Event types
- `packages/internal/core/src/providers/adapter.ts` - Adapter integration
