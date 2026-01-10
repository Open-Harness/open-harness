---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @signals/provider-openai

OpenAI Codex provider for Open Harness, bridging the `@openai/codex-sdk` to the signal-based architecture.

## Installation

```bash
bun add @signals/provider-openai
```

**Note:** Requires OpenAI API access with Codex SDK permissions.

## Quick Start

```typescript
import { CodexProvider } from "@signals/provider-openai";
import { createHarness } from "@open-harness/core";

const provider = new CodexProvider({
  model: "gpt-5-nano",
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
interface CodexProviderConfig {
  /** Custom Codex instance (for testing) */
  codex?: Codex;
  /** Default model (e.g., "gpt-5-nano", "gpt-5.2-codex", "o4-mini") */
  model?: string;
  /** Default working directory for shell operations */
  workingDirectory?: string;
}
```

### Examples

```typescript
// Default configuration
const provider = new CodexProvider();

// Custom model
const provider = new CodexProvider({
  model: "gpt-5.2-codex",
});

// With working directory
const provider = new CodexProvider({
  workingDirectory: "/path/to/project",
});
```

## Input Options

The provider accepts extended input beyond the base `ProviderInput`:

```typescript
interface CodexProviderInput extends ProviderInput {
  /** Model override for this run */
  model?: string;
  /** Working directory for Codex operations */
  workingDirectory?: string;
  /** Skip git repo check */
  skipGitRepoCheck?: boolean;
  /** JSON schema for structured output */
  outputSchema?: Record<string, unknown>;
}
```

### Structured Output

```typescript
const result = await runReactive({
  agents: {
    analyzer: agent({
      prompt: "Analyze the code quality",
      activateOn: ["harness:start"],
    }),
  },
  state: {},
  provider,
  providerInput: {
    outputSchema: {
      type: "object",
      properties: {
        quality: { type: "string", enum: ["good", "fair", "poor"] },
        issues: { type: "array", items: { type: "string" } },
      },
    },
  },
});
```

## Output

```typescript
interface CodexProviderOutput extends ProviderOutput {
  /** Text content from the response */
  content: string;
  /** Tool calls made during execution */
  toolCalls?: ToolCall[];
  /** Session ID for resume (same as threadId) */
  sessionId?: string;
  /** Thread ID for resume */
  threadId?: string;
  /** Token usage */
  usage?: TokenUsage;
  /** Stop reason */
  stopReason?: "end" | "max_tokens" | "tool_use" | "error";
  /** Structured output if schema was provided */
  structuredOutput?: unknown;
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
| `thinking:delta` | `{ content }` | Streaming reasoning chunk |
| `thinking:complete` | `{ content }` | Full reasoning content |
| `tool:call` | `{ id, name, input }` | Tool/command started |
| `tool:result` | `{ id, name, result, error? }` | Tool/command completed |

## Tool Types

Codex supports two types of tool operations:

### MCP Tool Calls
Standard MCP-style tool invocations:
```
tool:call { id: "...", name: "read_file", input: { path: "..." } }
tool:result { id: "...", name: "read_file", result: "..." }
```

### Shell Commands
Command execution maps to `shell` tool:
```
tool:call { id: "...", name: "shell", input: { command: "ls -la" } }
tool:result { id: "...", name: "shell", result: "..." }
```

## Thread Resume

The provider supports thread resume via `sessionId` or `threadId`:

```typescript
// First run
const result1 = await runReactive({
  agents: { myAgent },
  state: { input: "Hello" },
  provider,
});

const threadId = result1.state.threadId;

// Resume thread
const result2 = await runReactive({
  agents: { myAgent },
  state: { input: "Follow up" },
  provider,
  providerInput: { sessionId: threadId },
});
```

## Capabilities

```typescript
const provider = new CodexProvider();

console.log(provider.capabilities);
// {
//   streaming: true,
//   structuredOutput: true,
//   tools: true,
//   resume: true,
// }
```

## Cross-Provider Compatibility

Both ClaudeProvider and CodexProvider emit the same signal types, enabling provider-agnostic harnesses:

```typescript
import { ClaudeProvider } from "@signals/provider-claude";
import { CodexProvider } from "@signals/provider-openai";

// Same harness works with both providers
const result = await runReactive({
  agents: { myAgent },
  state: initialState,
  provider: process.env.USE_OPENAI
    ? new CodexProvider()
    : new ClaudeProvider(),
});

// Signal assertions work regardless of provider
expect(result.signals).toContainSignal("provider:start");
expect(result.signals).toContainSignal("provider:end");
```

## Error Handling

Errors are emitted as `provider:error` signals:

| Error Code | Description |
|------------|-------------|
| `TURN_FAILED` | Turn execution failed |
| `THREAD_ERROR` | Fatal thread error |
| `AbortError` | Execution was aborted |

## See Also

- [@open-harness/core](../../open-harness/core/README.md) - Core API
- [@signals/provider-claude](../claude/README.md) - Claude provider
- [Multi-provider example](../../../examples/multi-provider/) - Provider switching
