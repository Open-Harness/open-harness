# callbacks/ - Agent Callback Types

Type definitions for agent execution callbacks.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Core callback types (re-exported from `@openharness/core`) |

## Key Types

- **IAgentCallbacks**: Primary callback interface used by all agents.
  - `onStart`, `onText`, `onThinking`, `onToolCall`, `onToolResult`, `onProgress`, `onComplete`, `onError`
- **ToolCallEvent**: `{ toolName, toolId, input }`
- **TokenUsage**: `{ inputTokens, outputTokens, cacheReadTokens?, cacheWriteTokens? }`
- **NarrativeConfig**: `{ enabled, importance? }`

## Flow

Agents emit callbacks → HarnessInstance converts to events → UnifiedEventBus → Channels
