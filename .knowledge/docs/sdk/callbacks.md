# callbacks/ - Agent Callback Types

Type definitions for agent execution callbacks. These types define how agents report progress, tool usage, and results back to the harness.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Core callback types (re-exported from `@openharness/core`) |
| `index.ts` | Barrel export |

## Key Types

### `IAgentCallbacks`

The primary callback interface used by all agent implementations:

```typescript
interface IAgentCallbacks {
  onStart?: (metadata: AgentStartMetadata) => void;
  onText?: (text: string) => void;
  onThinking?: (thought: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onProgress?: (event: ProgressEvent) => void;
  onComplete?: (result: AgentResult) => void;
  onError?: (error: AgentError) => void;
}
```

### `ToolCallEvent`

```typescript
interface ToolCallEvent {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}
```

### `TokenUsage`

```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}
```

### `NarrativeConfig`

```typescript
interface NarrativeConfig {
  enabled: boolean;
  importance?: "low" | "medium" | "high";
}
```

## Usage

Callbacks are used internally by agent implementations. SDK users interact with events through channels:

```typescript
// Agent implementation (internal)
class MyAgent implements IAgent {
  async execute(input: string, callbacks?: IAgentCallbacks) {
    callbacks?.onStart?.({ agentName: "MyAgent" });
    callbacks?.onToolCall?.({ toolName: "search", toolId: "t1", input: { query: "..." } });
    callbacks?.onComplete?.({ result: "done", usage: { inputTokens: 100, outputTokens: 50 } });
  }
}

// SDK user (external) - uses channels instead
const channel = defineChannel({
  on: {
    "agent:tool:start": ({ event }) => console.log(`Tool: ${event.toolName}`),
    "agent:complete": ({ event }) => console.log(`Done: ${event.result}`),
  },
});
```
