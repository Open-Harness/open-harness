---
lastUpdated: "2026-01-11T06:42:54.221Z"
lastCommit: "edcbf4c29d5c22eb600c6f75d5fcc6c1b8d24d58"
lastCommitDate: "2026-01-11T06:23:45Z"
---
# @internal/signals-core

Core primitives for the Open Harness signal-based architecture.

This package provides the foundational types and utilities that all other Open Harness packages build upon.

## Installation

```bash
bun add @internal/signals-core
```

## Core Concepts

### Signals

Signals are immutable events that flow through the system. All state changes, agent activations, and provider responses are signals.

```typescript
import { createSignal, type Signal } from "@internal/signals-core";

// Create a signal
const signal = createSignal("analysis:complete", {
  sentiment: "bullish",
  confidence: 0.85,
});

// Signal structure
// {
//   id: "sig_abc123def456",
//   name: "analysis:complete",
//   payload: { sentiment: "bullish", confidence: 0.85 },
//   timestamp: "2025-01-10T12:00:00.000Z",
//   source: undefined
// }
```

### Signal Names

Signal names use colon-separated namespacing:

| Pattern | Examples |
|---------|----------|
| `harness:*` | `harness:start`, `harness:end` |
| `agent:*` | `agent:activated`, `agent:skipped` |
| `provider:*` | `provider:start`, `provider:end`, `provider:error` |
| `text:*` | `text:delta`, `text:complete` |
| `tool:*` | `tool:call`, `tool:result` |
| `state:*:changed` | `state:confidence:changed` |
| Custom | `analysis:complete`, `trade:proposed` |

### Signal Source

Signals can track their origin for debugging and causality chains:

```typescript
const signal = createSignal(
  "analysis:complete",
  { result: "bullish" },
  {
    agent: "analyst",           // Which agent emitted this
    provider: "claude",         // Which provider was used
    parent: "sig_parent123",    // Parent signal that caused this
  }
);
```

## Providers

Providers are async generators that bridge AI SDKs to the signal architecture.

### Provider Interface

```typescript
import type { Provider, ProviderInput, ProviderOutput, RunContext, Signal } from "@internal/signals-core";

interface Provider<TInput extends ProviderInput = ProviderInput, TOutput extends ProviderOutput = ProviderOutput> {
  readonly type: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;

  run(input: TInput, ctx: RunContext): AsyncGenerator<Signal, TOutput>;
}
```

### Provider Capabilities

```typescript
interface ProviderCapabilities {
  streaming: boolean;        // Supports streaming responses
  structuredOutput: boolean; // Supports JSON schema output
  tools: boolean;            // Supports tool/function calling
  resume: boolean;           // Supports session resume
}
```

### Standard Input/Output

```typescript
// Input
interface ProviderInput {
  system?: string;                    // System prompt
  messages: readonly Message[];       // Conversation history
  tools?: readonly ToolDefinition[];  // Available tools
  toolResults?: readonly ToolResult[];// Results from tool calls
  sessionId?: string;                 // Resume session
  maxTokens?: number;                 // Token limit
  temperature?: number;               // Creativity (0-1)
}

// Output
interface ProviderOutput {
  content: string;                    // Generated text
  toolCalls?: ToolCall[];             // Tool invocations
  sessionId?: string;                 // Session for resume
  usage?: TokenUsage;                 // Token counts
  stopReason?: "end" | "max_tokens" | "tool_use" | "error";
}
```

## Provider Signals

All providers emit a standard set of signals defined in `PROVIDER_SIGNALS`:

```typescript
import { PROVIDER_SIGNALS } from "@internal/signals-core";

// Lifecycle
PROVIDER_SIGNALS.START    // "provider:start"
PROVIDER_SIGNALS.END      // "provider:end"
PROVIDER_SIGNALS.ERROR    // "provider:error"

// Text streaming
PROVIDER_SIGNALS.TEXT_DELTA     // "text:delta"
PROVIDER_SIGNALS.TEXT_COMPLETE  // "text:complete"

// Thinking/reasoning
PROVIDER_SIGNALS.THINKING_DELTA     // "thinking:delta"
PROVIDER_SIGNALS.THINKING_COMPLETE  // "thinking:complete"

// Tool use
PROVIDER_SIGNALS.TOOL_CALL    // "tool:call"
PROVIDER_SIGNALS.TOOL_RESULT  // "tool:result"
```

### Signal Payloads

Each signal type has a defined payload structure:

```typescript
// provider:start
{ input: ProviderInput }

// provider:end
{ output: ProviderOutput, durationMs: number }

// provider:error
{ code: string, message: string, recoverable: boolean }

// text:delta / text:complete
{ content: string }

// thinking:delta / thinking:complete
{ content: string }

// tool:call
{ id: string, name: string, input: unknown }

// tool:result
{ id: string, name: string, result: unknown, error?: string }
```

## Zod Schemas

All types have corresponding Zod schemas for runtime validation:

```typescript
import {
  SignalSchema,
  ProviderInputSchema,
  ProviderOutputSchema,
  MessageSchema,
  ToolCallSchema,
  TokenUsageSchema,
} from "@internal/signals-core";

// Validate a signal
const result = SignalSchema.safeParse(unknownData);
if (result.success) {
  console.log("Valid signal:", result.data);
}
```

## Type Guards

```typescript
import { isSignal } from "@internal/signals-core";

if (isSignal(value)) {
  console.log(value.name, value.payload);
}
```

## Utilities

### createSignal

```typescript
import { createSignal } from "@internal/signals-core";

// Basic usage
const signal = createSignal("my:signal", { data: "value" });

// With source tracking
const signal = createSignal(
  "my:signal",
  { data: "value" },
  { agent: "myAgent", parent: "parentSignalId" }
);
```

## See Also

- [@open-harness/core](../open-harness/core/README.md) - Full harness API
- [@open-harness/provider-claude](../providers/claude/README.md) - Claude provider
- [@open-harness/provider-openai](../providers/openai/README.md) - OpenAI provider
- [packages/signals](../signals/README.md) - SignalBus, stores, and patterns
