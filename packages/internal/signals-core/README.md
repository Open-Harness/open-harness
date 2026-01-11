---
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
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

Signals are immutable events that flow through the system. All state changes, agent activations, and harness responses are signals.

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
| `workflow:*` | `workflow:start`, `workflow:end` |
| `agent:*` | `agent:activated`, `agent:skipped` |
| `harness:*` | `harness:start`, `harness:end`, `harness:error` |
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
    harness: "claude",          // Which harness was used
    parent: "sig_parent123",    // Parent signal that caused this
  }
);
```

## Harnesses

Harnesses are async generators that bridge AI SDKs to the signal architecture.

### Harness Interface

```typescript
import type { Harness, HarnessInput, HarnessOutput, RunContext, Signal } from "@internal/signals-core";

interface Harness<TInput extends HarnessInput = HarnessInput, TOutput extends HarnessOutput = HarnessOutput> {
  readonly type: string;
  readonly displayName: string;
  readonly capabilities: HarnessCapabilities;

  run(input: TInput, ctx: RunContext): AsyncGenerator<Signal, TOutput>;
}
```

### Harness Capabilities

```typescript
interface HarnessCapabilities {
  streaming: boolean;        // Supports streaming responses
  structuredOutput: boolean; // Supports JSON schema output
  tools: boolean;            // Supports tool/function calling
  resume: boolean;           // Supports session resume
}
```

### Standard Input/Output

```typescript
// Input
interface HarnessInput {
  system?: string;                    // System prompt
  messages: readonly Message[];       // Conversation history
  tools?: readonly ToolDefinition[];  // Available tools
  toolResults?: readonly ToolResult[];// Results from tool calls
  sessionId?: string;                 // Resume session
  maxTokens?: number;                 // Token limit
  temperature?: number;               // Creativity (0-1)
}

// Output
interface HarnessOutput {
  content: string;                    // Generated text
  toolCalls?: ToolCall[];             // Tool invocations
  sessionId?: string;                 // Session for resume
  usage?: TokenUsage;                 // Token counts
  stopReason?: "end" | "max_tokens" | "tool_use" | "error";
}
```

## Harness Signals

All harnesses emit a standard set of signals defined in `HARNESS_SIGNALS`:

```typescript
import { HARNESS_SIGNALS } from "@internal/signals-core";

// Lifecycle
HARNESS_SIGNALS.START    // "harness:start"
HARNESS_SIGNALS.END      // "harness:end"
HARNESS_SIGNALS.ERROR    // "harness:error"

// Text streaming
HARNESS_SIGNALS.TEXT_DELTA     // "text:delta"
HARNESS_SIGNALS.TEXT_COMPLETE  // "text:complete"

// Thinking/reasoning
HARNESS_SIGNALS.THINKING_DELTA     // "thinking:delta"
HARNESS_SIGNALS.THINKING_COMPLETE  // "thinking:complete"

// Tool use
HARNESS_SIGNALS.TOOL_CALL    // "tool:call"
HARNESS_SIGNALS.TOOL_RESULT  // "tool:result"
```

### Signal Payloads

Each signal type has a defined payload structure:

```typescript
// harness:start
{ input: HarnessInput }

// harness:end
{ output: HarnessOutput, durationMs: number }

// harness:error
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
  HarnessInputSchema,
  HarnessOutputSchema,
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

- [@open-harness/core](../open-harness/core/README.md) - Full workflow API
- [@open-harness/claude](../../adapters/harnesses/claude/README.md) - Claude harness
- [@open-harness/openai](../../adapters/harnesses/openai/README.md) - OpenAI harness
- [packages/signals](../signals/README.md) - SignalBus, stores, and patterns
