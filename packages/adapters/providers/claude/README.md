---
lastUpdated: "2026-01-11T06:42:54.221Z"
lastCommit: "edcbf4c29d5c22eb600c6f75d5fcc6c1b8d24d58"
lastCommitDate: "2026-01-11T06:23:45Z"
---
# @open-harness/provider-claude

Claude provider for Open Harness, bridging the `@anthropic-ai/claude-agent-sdk` to the signal-based architecture.

## Installation

```bash
bun add @open-harness/provider-claude
```

**Note:** This package uses Claude Code subscription authentication. No API key configuration is needed.

## Quick Start

```typescript
import { ClaudeProvider } from "@open-harness/provider-claude";
import { createHarness } from "@open-harness/core";

const provider = new ClaudeProvider({
  model: "claude-sonnet-4-20250514",
});

const { agent, runReactive } = createHarness<{ input: string }>();

const myAgent = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["harness:start"],
});

const result = await runReactive({
  agents: { myAgent },
  state: { input: "Hello world" },
  provider,
});
```

## Configuration

```typescript
interface ClaudeProviderConfig {
  /** Default model to use (default: "claude-sonnet-4-20250514") */
  model?: string;
  /** Default max turns (default: 100) */
  maxTurns?: number;
  /** Custom query function (for testing) */
  queryFn?: typeof query;
}
```

### Examples

```typescript
// Default configuration
const provider = new ClaudeProvider();

// Custom model
const provider = new ClaudeProvider({
  model: "claude-opus-4-20250514",
});

// Limit turns
const provider = new ClaudeProvider({
  maxTurns: 10,
});
```

## Input Options

The provider accepts extended input beyond the base `ProviderInput`:

```typescript
interface ClaudeProviderInput extends ProviderInput {
  /** Model override for this run */
  model?: string;
  /** Max turns override */
  maxTurns?: number;
  /** JSON schema for structured output */
  outputSchema?: Record<string, unknown>;
}
```

### Structured Output

```typescript
const result = await runReactive({
  agents: {
    analyzer: agent({
      prompt: "Analyze the sentiment of: {{ state.text }}",
      activateOn: ["harness:start"],
    }),
  },
  state: { text: "I love this product!" },
  provider,
  // Per-run input options
  providerInput: {
    outputSchema: {
      type: "object",
      properties: {
        sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
        confidence: { type: "number" },
      },
      required: ["sentiment", "confidence"],
    },
  },
});
```

## Output

```typescript
interface ClaudeProviderOutput extends ProviderOutput {
  /** Text content from the response */
  content: string;
  /** Tool calls made during execution */
  toolCalls?: ToolCall[];
  /** Session ID for resume */
  sessionId?: string;
  /** Token usage */
  usage?: TokenUsage;
  /** Stop reason */
  stopReason?: "end" | "max_tokens" | "tool_use" | "error";
  /** Structured output if schema was provided */
  structuredOutput?: unknown;
  /** Number of turns in the conversation */
  numTurns?: number;
}
```

## Signals Emitted

The provider emits standard signals as defined in `PROVIDER_SIGNALS`:

| Signal | Payload | Description |
|--------|---------|-------------|
| `provider:start` | `{ input }` | Provider execution started |
| `provider:end` | `{ output, durationMs }` | Provider execution completed |
| `provider:error` | `{ code, message, recoverable }` | Error occurred |
| `text:delta` | `{ content }` | Streaming text chunk |
| `text:complete` | `{ content }` | Full text content |
| `thinking:delta` | `{ content }` | Streaming thinking chunk |
| `thinking:complete` | `{ content }` | Full thinking content |
| `tool:call` | `{ id, name, input }` | Tool invocation started |
| `tool:result` | `{ id, name, result, error? }` | Tool execution completed |

## Session Resume

The provider supports session resume via `sessionId`:

```typescript
// First run
const result1 = await runReactive({
  agents: { myAgent },
  state: { input: "Hello" },
  provider,
});

const sessionId = result1.state.sessionId; // or extract from signals

// Resume session
const result2 = await runReactive({
  agents: { myAgent },
  state: { input: "Follow up question" },
  provider,
  providerInput: { sessionId },
});
```

## Capabilities

```typescript
const provider = new ClaudeProvider();

console.log(provider.capabilities);
// {
//   streaming: true,
//   structuredOutput: true,
//   tools: true,
//   resume: true,
// }
```

## Error Handling

Errors are emitted as `provider:error` signals and thrown:

```typescript
try {
  const result = await runReactive({ ... });
} catch (error) {
  // Error was also emitted as provider:error signal
  const errorSignals = result.signals.filter(s => s.name === "provider:error");
}
```

## See Also

- [@open-harness/core](../../open-harness/core/README.md) - Core API
- [@open-harness/provider-openai](../openai/README.md) - OpenAI/Codex provider
- [Examples](../../../examples/) - Usage patterns
