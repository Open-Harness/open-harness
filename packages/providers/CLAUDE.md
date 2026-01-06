# Provider Packages

AI provider implementations that integrate external AI services with Open Harness.

## Packages

### `anthropic/`
**@open-harness/provider-anthropic**

Claude/Anthropic provider implementation. Provides:
- `createClaudeNode()` - Factory for Claude agent nodes
- `claudeNode` - Pre-configured Claude node instance
- Testing utilities (`createMockQuery`, fixture types)

**Key Files:**
- `src/claude.agent.ts` - Main Claude agent implementation using `@anthropic-ai/claude-agent-sdk`
- `src/testing/mock-query.ts` - Mock query function for testing with fixtures

**Features:**
- Supports structured outputs via JSON schemas
- Handles thinking/reasoning events
- Tool use support
- Streaming responses

**Usage:**
```typescript
import { createClaudeNode } from "@open-harness/provider-anthropic";

const node = createClaudeNode({
  model: "claude-3-5-sonnet-20241022",
  // ... options
});
```

### `testing/`
**@open-harness/provider-testing**

Shared testing utilities for provider implementations. Provides contract tests and helpers for validating provider nodes.

**Key Files:**
- `src/index.ts` - Testing utilities and contracts

## Interface

All provider implementations must implement the `NodeTypeDefinition` interface from `@open-harness/sdk`:
- `type` - Unique node type identifier
- `run(ctx, input)` - Execute the node with given input
- Input/output schemas for validation
