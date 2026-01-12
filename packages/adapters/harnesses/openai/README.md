---
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
---
# @open-harness/openai

OpenAI Codex harness for Open Harness, bridging the `@openai/codex-sdk` to the signal-based architecture.

## Installation

```bash
bun add @open-harness/openai
```

**Note:** Requires OpenAI API access with Codex SDK permissions.

## Quick Start

```typescript
import { CodexHarness } from "@open-harness/openai";
import { createWorkflow } from "@open-harness/core";

const harness = new CodexHarness({
  model: "gpt-5-nano",
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
interface CodexHarnessConfig {
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
const harness = new CodexHarness();

// Custom model
const harness = new CodexHarness({
  model: "gpt-5.2-codex",
});

// With working directory
const harness = new CodexHarness({
  workingDirectory: "/path/to/project",
});
```

## Input Options

The harness accepts extended input beyond the base `HarnessInput`:

```typescript
interface CodexHarnessInput extends HarnessInput {
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
      activateOn: ["workflow:start"],
    }),
  },
  state: {},
  harness,
  harnessInput: {
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
interface CodexHarnessOutput extends HarnessOutput {
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

The harness emits standard signals as defined in `HARNESS_SIGNALS`:

| Signal | Payload | Description |
|--------|---------|-------------|
| `harness:start` | `{ input }` | Harness execution started |
| `harness:end` | `{ output, durationMs }` | Harness execution completed |
| `harness:error` | `{ code, message, recoverable }` | Error occurred |
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

The harness supports thread resume via `sessionId` or `threadId`:

```typescript
// First run
const result1 = await runReactive({
  agents: { myAgent },
  state: { input: "Hello" },
  harness,
});

const threadId = result1.state.threadId;

// Resume thread
const result2 = await runReactive({
  agents: { myAgent },
  state: { input: "Follow up" },
  harness,
  harnessInput: { sessionId: threadId },
});
```

## Capabilities

```typescript
const harness = new CodexHarness();

console.log(harness.capabilities);
// {
//   streaming: true,
//   structuredOutput: true,
//   tools: true,
//   resume: true,
// }
```

## Cross-Harness Compatibility

Both ClaudeHarness and CodexHarness emit the same signal types, enabling harness-agnostic workflows:

```typescript
import { ClaudeHarness } from "@open-harness/claude";
import { CodexHarness } from "@open-harness/openai";

// Same workflow works with both harnesses
const result = await runReactive({
  agents: { myAgent },
  state: initialState,
  harness: process.env.USE_OPENAI
    ? new CodexHarness()
    : new ClaudeHarness(),
});

// Signal assertions work regardless of harness
expect(result.signals).toContainSignal("harness:start");
expect(result.signals).toContainSignal("harness:end");
```

## Error Handling

Errors are emitted as `harness:error` signals:

| Error Code | Description |
|------------|-------------|
| `TURN_FAILED` | Turn execution failed |
| `THREAD_ERROR` | Fatal thread error |
| `AbortError` | Execution was aborted |

## See Also

- [@open-harness/core](../../open-harness/core/README.md) - Core API
- [@open-harness/claude](../claude/README.md) - Claude harness
- [Multi-harness example](../../../examples/multi-harness/) - Harness switching
