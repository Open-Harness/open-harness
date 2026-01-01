# Deprecation Schedule

This document tracks deprecated APIs, their replacements, and removal timelines.

**Last Updated**: 2025-12-27
**Current Version**: 0.1.0
**Next Major Version**: 1.0.0

---

## Currently Deprecated APIs

| API | Status | Replacement | Removal Target |
|-----|--------|-------------|----------------|
| `BaseAgent` | Deprecated | `BaseAnthropicAgent` | v1.0.0 |
| `StreamCallbacks` (type) | Deprecated | `IAgentCallbacks` | v1.0.0 |
| `IAgentRunnerToken` | Deprecated | `IAnthropicRunnerToken` | v1.0.0 |

---

## Migration Guides

### BaseAgent to BaseAnthropicAgent

**Before:**
```typescript
import { BaseAgent } from "@openharness/sdk";

class MyAgent extends BaseAgent {
  constructor() {
    super("MyAgent");
  }
}
```

**After:**
```typescript
import { BaseAnthropicAgent } from "@openharness/sdk";

class MyAgent extends BaseAnthropicAgent {
  constructor() {
    super("MyAgent");
  }
}
```

**Key differences:**
- `BaseAnthropicAgent` provides typed `IAgentCallbacks` instead of `StreamCallbacks`
- Better TypeScript inference for callback event types
- Explicit Anthropic/Claude provider binding

---

### StreamCallbacks to IAgentCallbacks

**Before:**
```typescript
import { StreamCallbacks } from "@openharness/sdk";

const callbacks: StreamCallbacks = {
  onText: (content, event) => console.log(content),
  onToolCall: (toolName, input, event) => console.log(toolName),
};
```

**After:**
```typescript
import { IAgentCallbacks } from "@openharness/sdk";

const callbacks: IAgentCallbacks = {
  onStart: (meta) => console.log(`Starting ${meta.agentName}`),
  onText: (content) => console.log(content),
  onToolCall: (event) => console.log(event.toolName),
  onComplete: (result) => console.log(`Done: ${result.success}`),
};
```

**Key differences:**
- Simplified callback signatures
- `onStart` and `onComplete` lifecycle events
- Result includes typed output via generics

---

### IAgentRunnerToken to IAnthropicRunnerToken

**Before:**
```typescript
import { inject, IAgentRunnerToken } from "@openharness/sdk";

class MyService {
  constructor(
    private runner = inject(IAgentRunnerToken)
  ) {}
}
```

**After:**
```typescript
import { inject, IAnthropicRunnerToken } from "@openharness/sdk";

class MyService {
  constructor(
    private runner = inject(IAnthropicRunnerToken)
  ) {}
}
```

**Key differences:**
- Provider-specific token enables future multi-provider support
- Same interface, different token for injection

---

## Removed APIs

| API | Removed In | Replacement |
|-----|------------|-------------|
| `LiveSDKRunner` | v0.1.0 (009-tech-debt-cleanup) | `AnthropicRunner` |

---

## Test Fixture Regeneration

When upgrading between versions, you may need to regenerate test fixtures if agent behavior changes.

### Steps to Regenerate Golden Recordings

1. **Run live tests to capture new recordings:**
   ```bash
   cd packages/sdk
   bun test:live
   ```

2. **Verify recordings were created:**
   ```bash
   ls -la recordings/golden/
   ```

3. **Run replay tests to verify:**
   ```bash
   bun test:replay
   ```

### When to Regenerate

- After upgrading the Anthropic SDK version
- After modifying agent prompts or tool definitions
- After changing structured output schemas

### Fixture Location

- Golden recordings: `recordings/golden/`
- Categories:
  - `coding-agent/` - CodingAgent session recordings
  - `review-agent/` - ReviewAgent session recordings
  - `parser-agent/` - ParserAgent session recordings

---

## Version History

### v0.1.0 (009-tech-debt-cleanup)

- **Removed**: `LiveSDKRunner` alias (use `AnthropicRunner`)
- **Removed**: `StreamCallbacks` re-export from index (type still available in callbacks/types)
- **Enhanced**: JSDoc deprecation notices with migration guides
- **Cleaned**: Console statements from production code

---

## Notes

- Deprecated APIs emit no runtime warnings (zero console policy)
- JSDoc `@deprecated` tags trigger IDE warnings
- TypeScript compiler can be configured to error on deprecated usage
