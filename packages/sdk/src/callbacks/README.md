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

Emitted when an agent invokes a tool:

```typescript
interface ToolCallEvent {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}
```

### `TokenUsage`

Token consumption tracking:

```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}
```

### `NarrativeConfig`

Configuration for narrative/monologue generation:

```typescript
interface NarrativeConfig {
  enabled: boolean;
  importance?: "low" | "medium" | "high";
}
```

## How It Connects

```
┌─────────────────────────────────────────────────────────┐
│                 HarnessInstance                         │
│  Orchestrates agents, converts callbacks to events      │
└───────────────┬─────────────────────────────────────────┘
                │ uses
                ▼
┌─────────────────────────────────────────────────────────┐
│              IAgentCallbacks                            │
│  Interface implemented by agent runners                 │
└───────────────┬─────────────────────────────────────────┘
                │ emits to
                ▼
┌─────────────────────────────────────────────────────────┐
│              UnifiedEventBus                            │
│  Converts callbacks to enriched events                  │
└─────────────────────────────────────────────────────────┘
```

## Usage

Callbacks are typically used internally by agent implementations. SDK users interact with events through channels:

```typescript
// Agent implementation (internal)
class MyAgent implements IAgent {
  async execute(input: string, callbacks?: IAgentCallbacks) {
    callbacks?.onStart?.({ agentName: "MyAgent" });
    // ... agent work ...
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

## Related

- `@openharness/core` - Source of `IAgentCallbacks` and related types
- `core/unified-events/types.ts` - Event types emitted from callbacks
- `harness/harness-instance.ts` - Converts callbacks to events
