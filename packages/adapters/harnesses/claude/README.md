---
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
---
# @open-harness/claude

Claude harness for Open Harness, bridging the `@anthropic-ai/claude-agent-sdk` to the signal-based architecture.

## Installation

```bash
bun add @open-harness/claude
```

**Note:** This package uses Claude Code subscription authentication. No API key configuration is needed.

## Quick Start

```typescript
import { ClaudeHarness } from "@open-harness/claude";
import { createWorkflow } from "@open-harness/core";

const harness = new ClaudeHarness({
  model: "claude-sonnet-4-20250514",
});

const { agent, runReactive } = createWorkflow<{ input: string }>();

const myAgent = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["workflow:start"],
});

const result = await runReactive({
  agents: { myAgent },
  state: { input: "Hello world" },
  harness,
});
```

## Configuration

```typescript
interface ClaudeHarnessConfig {
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
const harness = new ClaudeHarness();

// Custom model
const harness = new ClaudeHarness({
  model: "claude-opus-4-20250514",
});

// Limit turns
const harness = new ClaudeHarness({
  maxTurns: 10,
});
```

## Input Options

The harness accepts extended input beyond the base `HarnessInput`:

```typescript
interface ClaudeHarnessInput extends HarnessInput {
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
      activateOn: ["workflow:start"],
    }),
  },
  state: { text: "I love this product!" },
  harness,
  // Per-run input options
  harnessInput: {
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
interface ClaudeHarnessOutput extends HarnessOutput {
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

The harness emits standard signals as defined in `HARNESS_SIGNALS`:

| Signal | Payload | Description |
|--------|---------|-------------|
| `harness:start` | `{ input }` | Harness execution started |
| `harness:end` | `{ output, durationMs }` | Harness execution completed |
| `harness:error` | `{ code, message, recoverable }` | Error occurred |
| `text:delta` | `{ content }` | Streaming text chunk |
| `text:complete` | `{ content }` | Full text content |
| `thinking:delta` | `{ content }` | Streaming thinking chunk |
| `thinking:complete` | `{ content }` | Full thinking content |
| `tool:call` | `{ id, name, input }` | Tool invocation started |
| `tool:result` | `{ id, name, result, error? }` | Tool execution completed |

## Session Resume

The harness supports session resume via `sessionId`:

```typescript
// First run
const result1 = await runReactive({
  agents: { myAgent },
  state: { input: "Hello" },
  harness,
});

const sessionId = result1.state.sessionId; // or extract from signals

// Resume session
const result2 = await runReactive({
  agents: { myAgent },
  state: { input: "Follow up question" },
  harness,
  harnessInput: { sessionId },
});
```

## Capabilities

```typescript
const harness = new ClaudeHarness();

console.log(harness.capabilities);
// {
//   streaming: true,
//   structuredOutput: true,
//   tools: true,
//   resume: true,
// }
```

## Error Handling

Errors are emitted as `harness:error` signals and thrown:

```typescript
try {
  const result = await runReactive({ ... });
} catch (error) {
  // Error was also emitted as harness:error signal
  const errorSignals = result.signals.filter(s => s.name === "harness:error");
}
```

## See Also

- [@open-harness/core](../../open-harness/core/README.md) - Core API
- [@open-harness/openai](../openai/README.md) - OpenAI/Codex harness
- [Examples](../../../examples/) - Usage patterns
