# @open-harness/provider-anthropic

Claude/Anthropic provider implementation for Open Harness.

## Purpose

Implements a Claude agent node that integrates Anthropic's Claude API with Open Harness workflows. Provides:
- `createClaudeNode()` - Factory function to create Claude agent nodes
- `claudeNode` - Pre-configured Claude node instance
- Support for structured outputs, thinking events, tool use, and streaming

## Key Files

- **`src/claude.agent.ts`** - Main implementation (~680 lines)
  - `createClaudeNode(options?)` - Factory for Claude nodes
  - `ClaudeAgentInput` - Input schema (prompt, messages, options)
  - `ClaudeAgentOutput` - Output schema (text, usage, thinking, tools)
  - `ClaudeAgentExtendedOptions` - Extended options with `outputSchemaFile` support
  - Uses `@anthropic-ai/claude-agent-sdk` for API communication
  - Handles streaming responses, thinking events, tool use, structured outputs
  - Supports file-based JSON schemas via `outputSchemaFile` option

- **`src/testing/mock-query.ts`** - Testing utilities
  - `createMockQuery(fixtures, selectFixtureKey?)` - Creates mock query function
  - `FixtureFile`, `FixtureSet`, `FixtureCall` - Types for test fixtures
  - Replays captured SDK responses for deterministic testing

## Usage

```typescript
import { createClaudeNode } from "@open-harness/provider-anthropic";

const node = createClaudeNode({
  model: "claude-3-5-sonnet-20241022",
  maxTokens: 4096,
  // ... other options
});

// Register with node registry
registry.register(node);
```

## Features

- **Structured Outputs** - JSON Schema support (inline or file-based)
- **Thinking Events** - Captures and emits reasoning/thinking events
- **Tool Use** - Supports tool calling and tool results
- **Streaming** - Real-time response streaming
- **Testing** - Mock query utilities for fixture-based testing

## Dependencies

- `@anthropic-ai/claude-agent-sdk` - Anthropic SDK
- `@open-harness/sdk` - Core SDK interfaces
- `@open-harness/provider-testing` - Testing utilities (dev dependency)
- `zod` - Schema validation
