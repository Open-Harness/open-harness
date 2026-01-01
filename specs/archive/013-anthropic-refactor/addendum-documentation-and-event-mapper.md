# Addendum: Documentation & Event Mapper Architecture

**Date**: 2025-12-29
**Status**: Planning
**Related**: specs/013-anthropic-refactor/spec.md, tasks.md

## Context

After completing the core refactor (Phases 1-8 from tasks.md), two areas require completion:

1. **Event Mapper Architecture Issue**: Event mapping functions live in `infra/runner/` but work with Anthropic-specific `SDKMessage` types, creating a layer violation
2. **Documentation Gaps**: Missing package README, API reference, provider creation guide, and migration documentation

This addendum addresses both issues and establishes patterns for future provider packages.

---

## Phase 1: Event Mapper Architectural Fix

### Problem Statement

**Current State**:
```
packages/anthropic/src/infra/runner/event-mapper.ts
├── mapSdkMessageToEvents(msg: SDKMessage) → AgentEvent[]
└── mapSdkMessageToUnifiedEvents(msg: SDKMessage) → BaseEvent[]
```

**Issues**:
1. Lives in `infra/` (suggests generic/reusable) but takes `SDKMessage` (Anthropic-specific)
2. Forces type cast in `internal-agent.ts`: `msg as unknown as SDKMessage`
3. Unclear pattern for future providers (should they also put event mappers in infra?)
4. `mapSdkMessageToEvents()` is unused (was for deleted `BaseAnthropicAgent`)

**Usage**:
- Only `mapSdkMessageToUnifiedEvents()` is used (in `internal-agent.ts:135`)
- Public export from `src/index.ts:73`
- No external consumers identified

### Solution: Move to Provider Layer

**New Structure**:
```
packages/anthropic/src/provider/anthropic-event-mapper.ts
└── AnthropicEventMapper.toUnifiedEvents(msg: SDKMessage) → BaseEvent[]
```

**Benefits**:
1. **Architectural honesty**: Provider-specific code in provider layer
2. **Clear pattern**: Each provider implements `<Provider>EventMapper` class
3. **Type safety**: Cast is justified in provider-specific context
4. **Extensibility**: OpenAI would create `OpenAIEventMapper`, Gemini creates `GeminiEventMapper`

### Implementation Steps

#### 1.1 Create Provider-Specific Event Mapper

**File**: `packages/anthropic/src/provider/anthropic-event-mapper.ts` (NEW)

```typescript
/**
 * AnthropicEventMapper - Provider-specific event mapping
 *
 * Converts Anthropic SDK messages to unified BaseEvent format.
 * Each provider package implements its own event mapper following this pattern.
 *
 * @example Future OpenAI provider
 * ```typescript
 * // @openharness/openai/src/provider/openai-event-mapper.ts
 * export class OpenAIEventMapper {
 *   static toUnifiedEvents(msg: ChatCompletionChunk, agentName: string): BaseEvent[]
 * }
 * ```
 */
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BaseEvent } from "@openharness/sdk";

export class AnthropicEventMapper {
  /**
   * Convert Anthropic SDKMessage to provider-agnostic BaseEvent[]
   *
   * Maps SDK message types to standardized event format:
   * - system.init → agent:start
   * - assistant text → agent:text
   * - assistant thinking → agent:thinking
   * - assistant tool_use → agent:tool:start
   * - user tool_result → agent:tool:complete
   * - result.success/failure → agent:complete
   *
   * @param msg - Anthropic SDK message
   * @param agentName - Agent identifier for event attribution
   * @returns Array of unified events (may be multiple per message)
   */
  static toUnifiedEvents(msg: SDKMessage, agentName: string): BaseEvent[] {
    const events: BaseEvent[] = [];

    switch (msg.type) {
      case "system":
        if (msg.subtype === "init") {
          events.push({
            type: "agent:start",
            agentName,
          });
        }
        break;

      case "assistant":
        if (Array.isArray(msg.message.content)) {
          for (const block of msg.message.content) {
            if (block.type === "text") {
              events.push({
                type: "agent:text",
                content: block.text,
              });
            } else if (block.type === "thinking") {
              events.push({
                type: "agent:thinking",
                content: block.thinking,
              });
            } else if (block.type === "tool_use") {
              events.push({
                type: "agent:tool:start",
                toolName: block.name,
                input: block.input as unknown,
              });
            }
          }
        }
        break;

      case "user":
        if (Array.isArray(msg.message.content)) {
          for (const block of msg.message.content) {
            if (block.type === "tool_result") {
              events.push({
                type: "agent:tool:complete",
                toolName: block.tool_use_id,
                result: block.content as unknown,
              });
            }
          }
        }
        break;

      case "result":
        events.push({
          type: "agent:complete",
        });
        break;
    }

    return events;
  }
}
```

**Source**: Copy logic from `src/infra/runner/event-mapper.ts:mapSdkMessageToUnifiedEvents()`

#### 1.2 Update Internal Agent

**File**: `packages/anthropic/src/provider/internal-agent.ts`

**Line 29**: Add import
```typescript
import { AnthropicEventMapper } from "./anthropic-event-mapper.js";
```

**Lines 127-143**: Update message handler
```typescript
/**
 * Handle a single message from the runner.
 *
 * Emits events to unified event bus and fires callbacks.
 * Unlike BaseAnthropicAgent, this ONLY uses IUnifiedEventBus.
 * The legacy IEventBus is not supported per research.md Q4 decision.
 */
private handleMessage<TOutput>(msg: GenericMessage, callbacks?: IAgentCallbacks<TOutput>): void {
  // Emit to unified bus if available
  if (this.unifiedBus) {
    // SAFETY: We're in provider-specific code. The GenericMessage we receive
    // is guaranteed to be SDKMessage because we bind AnthropicRunner to the container.
    // This cast is safe and documents the runtime contract that the type system
    // cannot express (IAgentRunner returns GenericMessage for SDK-agnostic interface,
    // but at runtime this is AnthropicRunner which produces SDKMessage).
    const sdkMsg = msg as unknown as SDKMessage;
    const unifiedEvents = AnthropicEventMapper.toUnifiedEvents(sdkMsg, this.name);

    for (const event of unifiedEvents) {
      try {
        this.unifiedBus.emit(event, { agent: { name: this.name } });
      } catch {
        // Silently ignore bus errors (per existing pattern)
      }
    }
  }

  // Fire callbacks based on message type
  this.fireCallbacksFromMessage(msg, callbacks);
}
```

**Key Changes**:
- Import `AnthropicEventMapper`
- Replace function call with `AnthropicEventMapper.toUnifiedEvents()`
- Expand SAFETY comment to explain runtime guarantee

#### 1.3 Delete Old Event Mapper

**File**: `packages/anthropic/src/infra/runner/event-mapper.ts`

**Action**: DELETE entirely

**Justification**:
- `mapSdkMessageToEvents()` unused (was for deleted `BaseAnthropicAgent`)
- `mapSdkMessageToUnifiedEvents()` moved to `AnthropicEventMapper`
- No backward compatibility needed (pre-1.0)

#### 1.4 Update Public Exports

**File**: `packages/anthropic/src/index.ts`

**Line 73**: DELETE
```typescript
export { mapSdkMessageToEvents, mapSdkMessageToUnifiedEvents } from "./infra/runner/event-mapper.js";
```

**After line 65**: ADD
```typescript
export { AnthropicEventMapper } from "./provider/anthropic-event-mapper.js";
```

#### 1.5 Update Infra Exports

**File**: `packages/anthropic/src/infra/runner/index.ts`

**Line 12**: DELETE
```typescript
export { mapSdkMessageToEvents } from "./event-mapper.js";
```

**After line 26** (after zodToSdkSchema export): End file (no more prompt export)

#### 1.6 Verification

**Grep Check**: No remaining references
```bash
grep -r "mapSdkMessageToUnifiedEvents\|mapSdkMessageToEvents" packages/anthropic/src/
# Expected: No matches
```

**Test**: All 74 tests pass
```bash
bun test tests/unit tests/integration tests/node-compat.test.ts
# Expected: 74 pass, 0 fail
```

**Lint**: No warnings
```bash
bun biome lint packages/anthropic/src
# Expected: Checked 25 files. No warnings.
```

**Types**: Clean
```bash
bun run typecheck
# Expected: Zero errors
```

---

## Phase 2: Create Package README

### Goal

Provide quick overview for npm package consumers and IDE quick info.

### Implementation

**File**: `packages/anthropic/README.md` (NEW)

**Content**:
```markdown
# @openharness/anthropic

Anthropic/Claude provider implementation for the Open Harness SDK.

## Installation

```bash
npm install @openharness/anthropic @openharness/sdk
```

## Quick Start

### Using Preset Agents

```typescript
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({
  task: "Write a function to calculate fibonacci numbers"
});

console.log(result.code);
console.log(result.explanation);
```

### Creating Custom Agents

```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

const result = await MyAgent.execute({ task: "Hello" });
```

## Documentation

- **Architecture Guide**: [How It Works](../../.knowledge/docs/how-it-works.md)
- **API Reference**: [API Documentation](../../.knowledge/docs/api/anthropic-api.md)
- **Provider Guide**: [Creating a New Provider](../../.knowledge/docs/provider-guide.md)
- **Migration Guide**: [Migrating from v0.x](../../.knowledge/docs/migration-anthropic.md)

## Package Exports

- `@openharness/anthropic` - Factory API (`defineAnthropicAgent`, `createPromptTemplate`)
- `@openharness/anthropic/presets` - Pre-configured agents (`CodingAgent`, `ReviewAgent`, `PlannerAgent`)
- `@openharness/anthropic/provider` - Provider internals (types, event mapper)
- `@openharness/anthropic/runner` - Runner infrastructure
- `@openharness/anthropic/recording` - Recording/replay system

## Features

- ✨ Type-safe prompt templates with compile-time variable extraction
- 🔒 Zod schema validation for inputs and outputs
- 📦 Pre-configured agents for common tasks
- 🎯 Factory-based API (no inheritance)
- 🔄 Recording/replay support for testing
- 🚀 Node.js compatible (no Bun-specific APIs)

## License

MIT
```

---

## Phase 3: Create API Reference Documentation

### Goal

Comprehensive API documentation for all exported types and functions.

### Implementation

**File**: `.knowledge/docs/api/anthropic-api.md` (NEW)

**Content**: [See full content in plan file - includes signatures, parameters, return types, examples for all exports]

**Sections**:
1. Factory API
   - `defineAnthropicAgent()`
   - `createPromptTemplate()`
   - `createStaticPrompt()`
2. Types
   - `AnthropicAgentDefinition<TInput, TOutput>`
   - `AnthropicAgent<TInput, TOutput>`
   - `ExecuteOptions<TOutput>`
   - `PromptTemplate<TData>`
3. Provider Internals
   - `AnthropicEventMapper`
4. Presets
   - `CodingAgent`
   - `ReviewAgent`
   - `PlannerAgent`

---

## Phase 4: Create Provider Creation Guide

### Goal

Step-by-step guide for building new provider packages (OpenAI, Gemini, etc.) with annotated code examples.

### Implementation

**File**: `.knowledge/docs/provider-guide.md` (NEW)

**Outline**:

1. **Overview**
   - Provider architecture (factory/infra/presets layers)
   - Required interfaces (`IAgentRunner`, `BaseEvent[]`)
   - Reference implementation (Anthropic)

2. **Step 1: Package Setup**
   ```json
   {
     "name": "@openharness/skeleton",
     "dependencies": {
       "@openharness/sdk": "workspace:*",
       "@needle-di/core": "^1.1.0",
       "zod": "^4.2.1"
     }
   }
   ```

3. **Step 2: Implement IAgentRunner**
   ```typescript
   // Code example with TODO comments
   @injectable()
   export class SkeletonRunner implements IAgentRunner {
     async run(args: {
       prompt: string;
       options: GenericRunnerOptions;
       callbacks?: RunnerCallbacks;
     }): Promise<GenericMessage | undefined> {
       // TODO: Call your provider's SDK
       // TODO: Convert provider messages to GenericMessage
       // TODO: Fire callbacks.onMessage() for each message
       // TODO: Return final message
     }
   }
   ```

4. **Step 3: Create Event Mapper**
   ```typescript
   export class SkeletonEventMapper {
     static toUnifiedEvents(
       msg: YourProviderMessage,
       agentName: string
     ): BaseEvent[] {
       const events: BaseEvent[] = [];

       // TODO: Map message types to BaseEvent types
       switch (msg.type) {
         case "start":
           events.push({ type: "agent:start", agentName });
           break;
         case "text":
           events.push({ type: "agent:text", content: msg.content });
           break;
         // TODO: Add all event types
       }

       return events;
     }
   }
   ```

5. **Step 4: Build Factory API**
   - `defineSkeletonAgent()` implementation
   - Type-safe prompt templates
   - Zod schema integration

6. **Step 5: Create Internal Agent**
   - Execute flow pattern
   - Error handling
   - Event emission

7. **Step 6: Build Presets**
   - Pre-configured agents
   - Naming conventions

8. **Step 7: Testing Strategy**
   - Unit tests
   - Integration tests
   - Node.js compatibility tests

9. **Step 8: Documentation**
   - README template
   - API reference

**Event Types to Support**:
```typescript
type BaseEvent =
  | { type: "agent:start"; agentName: string }
  | { type: "agent:text"; content: string }
  | { type: "agent:thinking"; content: string }
  | { type: "agent:tool:start"; toolName: string; input: unknown }
  | { type: "agent:tool:complete"; toolName: string; result: unknown }
  | { type: "agent:complete" }
  | { type: "agent:error"; error: string }
```

**Key Patterns**:
- DI tokens: Create `ISkeletonRunnerToken` in SDK, bind in provider
- Container setup: Lazy initialization with `setFactoryContainer()`
- Type casts: Document with SAFETY comments when unavoidable

---

## Phase 5: Create Migration Guide

### Goal

Help v0.x users migrate to v1.0 factory API.

### Implementation

**File**: `.knowledge/docs/migration-anthropic.md` (NEW)

**Content**:

```markdown
# Migration Guide: Anthropic Provider v1.0

## Overview

The Anthropic provider has been refactored from class-based inheritance to a factory-based API. This guide helps you migrate existing code.

## Breaking Changes

### Deleted in v1.0 (No Deprecation Period)

The following were **deleted** in v1.0. There is no backward compatibility:

- `BaseAnthropicAgent` → Use `defineAnthropicAgent()`
- `CodingAgent` (class) → Use `CodingAgent` (preset) from `/presets`
- `ReviewAgent` (class) → Use `ReviewAgent` (preset)
- `PlannerAgent` (class) → Use `PlannerAgent` (preset)
- `ParserAgent` → Removed (internal implementation)
- `ValidationReviewAgent` → Removed (internal implementation)
- `PromptRegistry` → Use `createPromptTemplate()`
- `mapSdkMessageToEvents()` → Use `AnthropicEventMapper.toUnifiedEvents()`
- `mapSdkMessageToUnifiedEvents()` → Use `AnthropicEventMapper.toUnifiedEvents()`

**Why No Deprecation?**
- Pre-1.0 codebase (v0.x)
- Clean architectural foundation for future growth
- Simpler API surface (less confusion)

## Migration Patterns

### Pattern 1: Custom Agent (Class → Factory)

**Before (v0.x)**:
```typescript
import { BaseAnthropicAgent } from "@openharness/anthropic";

class MyAgent extends BaseAnthropicAgent<MyInput, MyOutput> {
  constructor() {
    super({
      name: "MyAgent",
      inputSchema: z.object({ task: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
  }

  protected getPrompt(input: MyInput): string {
    return `Task: ${input.task}`;
  }
}

const agent = new MyAgent();
const result = await agent.run({ task: "Hello" });
```

**After (v1.0)**:
```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";

const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

const result = await MyAgent.execute({ task: "Hello" });
```

**Changes**:
- ✂️ No inheritance (no `extends`, no `super()`)
- 📝 Prompt is template, not method override
- 🏭 Factory function, not class instantiation
- 🔄 `run()` → `execute()`
- 📌 Agent is constant, not instance

### Pattern 2: Preset Agents

**Before (v0.x)**:
```typescript
import { CodingAgent } from "@openharness/anthropic";

const agent = new CodingAgent();
const result = await agent.run({ task: "Write code" });
```

**After (v1.0)**:
```typescript
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({ task: "Write code" });
```

**Changes**:
- 📦 Import from `/presets` sub-path
- 🚫 No `new` keyword (preset is constant, not class)
- 🔄 `run()` → `execute()`

### Pattern 3: Prompt Templates

**Before (v0.x)**:
```typescript
import { PromptRegistry } from "@openharness/anthropic";

const prompt = await PromptRegistry.formatCoding({ task: "Write code" });
```

**After (v1.0)**:
```typescript
import { createPromptTemplate } from "@openharness/anthropic";

const template = createPromptTemplate("Task: {{task}}");
const prompt = template.render({ task: "Write code" });
```

**Changes**:
- 🎯 Create reusable template (one-time setup)
- ⚡ Synchronous render (no `await`)
- 🔒 Type-safe variables (compile-time checking)

### Pattern 4: Event Handling

**Before (v0.x)**:
```typescript
import { mapSdkMessageToUnifiedEvents } from "@openharness/anthropic";

const events = mapSdkMessageToUnifiedEvents(sdkMessage, "MyAgent");
```

**After (v1.0)**:
```typescript
import { AnthropicEventMapper } from "@openharness/anthropic";

const events = AnthropicEventMapper.toUnifiedEvents(sdkMessage, "MyAgent");
```

**Changes**:
- 🏢 Class method instead of function
- 📍 Clarifies this is provider-specific

## Testing Changes

**Before (v0.x)**:
```typescript
import { BaseAnthropicAgent } from "@openharness/anthropic";

class TestAgent extends BaseAnthropicAgent<Input, Output> {
  // Test implementation
}
```

**After (v1.0)**:
```typescript
import { defineAnthropicAgent, setFactoryContainer } from "@openharness/anthropic";
import { createMockContainer } from "./test-utils";

setFactoryContainer(createMockContainer());

const TestAgent = defineAnthropicAgent({ /* definition */ });
```

## Timeline

- **v0.x**: Old API (deleted in v1.0)
- **v1.0**: Current (factory API)
- **No deprecation period**: Clean break

## Questions?

- [API Reference](./api/anthropic-api.md)
- [How It Works](./how-it-works.md)
- [Provider Guide](./provider-guide.md)
```

---

## Phase 6: Update how-it-works.md

### Goal

Add event mapper pattern explanation to architecture guide.

### Implementation

**File**: `.knowledge/docs/how-it-works.md`

**Change 1**: After line 82 (end of Request Flow), add:

```markdown
## Event Mapper Pattern

Each provider package implements its own event mapper to convert provider-specific messages to the unified `BaseEvent` format.

### Why Provider-Specific?

Different providers have different message structures:
- Anthropic: `SDKMessage` from `@anthropic-ai/claude-agent-sdk`
- OpenAI: `ChatCompletionChunk` from `openai`
- Gemini: `GenerateContentResponse` from `@google/generative-ai`

Event mappers live in the **provider layer** (not infrastructure) to:
1. Ensure type safety - no casting at infrastructure level
2. Make provider-specific code obvious
3. Establish clear pattern for new providers

### Pattern

```typescript
// In @openharness/anthropic
export class AnthropicEventMapper {
  static toUnifiedEvents(msg: SDKMessage, agentName: string): BaseEvent[] {
    // Convert Anthropic-specific SDKMessage → standard BaseEvent[]
  }
}

// In @openharness/openai (future)
export class OpenAIEventMapper {
  static toUnifiedEvents(msg: ChatCompletionChunk, agentName: string): BaseEvent[] {
    // Convert OpenAI-specific message → standard BaseEvent[]
  }
}
```

### Integration in Internal Agent

```typescript
// packages/anthropic/src/provider/internal-agent.ts
import { AnthropicEventMapper } from "./anthropic-event-mapper.js";

private handleMessage(msg: GenericMessage) {
  if (this.unifiedBus) {
    // SAFETY: We're in provider-specific code, so casting to provider type is safe
    const sdkMsg = msg as unknown as SDKMessage;
    const events = AnthropicEventMapper.toUnifiedEvents(sdkMsg, this.name);

    for (const event of events) {
      this.unifiedBus.emit(event, { agent: { name: this.name } });
    }
  }
}
```

**Why the cast?** `IAgentRunner` returns `GenericMessage` (SDK-agnostic interface), but at runtime we KNOW it's `AnthropicRunner` producing `SDKMessage`. The type system can't express this runtime guarantee, so we document it with a SAFETY comment.
```

**Change 2**: Update "File Structure" section (around line 191):

```markdown
packages/anthropic/src/
├── index.ts              # Main exports
├── provider/             # Factory API
│   ├── factory.ts        # defineAnthropicAgent()
│   ├── types.ts          # Type definitions
│   ├── prompt-template.ts # Template system
│   ├── internal-agent.ts # Execution engine
│   └── anthropic-event-mapper.ts # Event conversion ← ADDED
├── presets/              # Pre-built agents
│   ├── coding-agent.ts
│   ├── review-agent.ts
│   ├── planner-agent.ts
│   └── prompts/          # TypeScript templates
└── infra/                # Runtime services
    ├── runner/           # SDK wrapper
    │   ├── anthropic-runner.ts  # IAgentRunner impl
    │   └── models.ts     # Type definitions
    └── recording/        # Record/replay
```

---

## Verification & Acceptance Criteria

### Phase 1: Event Mapper (Must Pass All)

- [ ] `AnthropicEventMapper` created in `src/provider/`
- [ ] `internal-agent.ts` uses `AnthropicEventMapper`
- [ ] Old `event-mapper.ts` deleted from `src/infra/runner/`
- [ ] Public exports updated (`src/index.ts`, `src/infra/runner/index.ts`)
- [ ] No references to old functions remain: `grep -r "mapSdkMessageToUnifiedEvents" src/` returns nothing
- [ ] All 74 tests pass
- [ ] TypeScript type checking clean (0 errors)
- [ ] Biome linter clean (0 warnings)

### Phase 2-6: Documentation (Must Complete All)

- [ ] `packages/anthropic/README.md` created
- [ ] `.knowledge/docs/api/anthropic-api.md` created
- [ ] `.knowledge/docs/provider-guide.md` created
- [ ] `.knowledge/docs/migration-anthropic.md` created
- [ ] `.knowledge/docs/how-it-works.md` updated with event mapper section
- [ ] All links between docs verified working
- [ ] Code examples in docs are accurate (match actual API)

### Final Verification

- [ ] Run `bun biome lint packages/anthropic/src` → 0 warnings
- [ ] Run `bun run typecheck` → 0 errors
- [ ] Run `bun test tests/unit tests/integration tests/node-compat.test.ts` → 74 pass
- [ ] Verify no `as any` casts in codebase (only documented `as unknown as` where necessary)
- [ ] Documentation completeness check:
  - [ ] README exists and renders properly
  - [ ] API reference covers all exports
  - [ ] Provider guide has working code examples
  - [ ] Migration guide covers all breaking changes
  - [ ] how-it-works.md explains event mapper pattern

---

## Files Changed Summary

### Created (6 files)
1. `packages/anthropic/src/provider/anthropic-event-mapper.ts` - Event conversion
2. `packages/anthropic/README.md` - Package overview
3. `.knowledge/docs/api/anthropic-api.md` - API reference
4. `.knowledge/docs/provider-guide.md` - Provider creation guide
5. `.knowledge/docs/migration-anthropic.md` - Migration guide from v0.x
6. `specs/013-anthropic-refactor/addendum-documentation-and-event-mapper.md` - This document

### Modified (4 files)
1. `packages/anthropic/src/provider/internal-agent.ts` - Use AnthropicEventMapper
2. `packages/anthropic/src/index.ts` - Update exports
3. `packages/anthropic/src/infra/runner/index.ts` - Remove event mapper export
4. `.knowledge/docs/how-it-works.md` - Add event mapper pattern section

### Deleted (1 file)
1. `packages/anthropic/src/infra/runner/event-mapper.ts` - Moved to provider layer

**Total**: 11 file operations (6 create, 4 modify, 1 delete)

---

## Execution Order

**Sequential Dependencies**:

1. **Phase 1 (Event Mapper)** - MUST complete first
   - Creates architectural foundation
   - Affects code that docs will reference

2. **Verification** - After Phase 1
   - Ensures architecture works before documenting it

3. **Phases 2-6 (Documentation)** - Can be done in parallel
   - Independent documentation files
   - No cross-dependencies

4. **Final Verification** - After all phases
   - Comprehensive quality check

**Recommended Sequence**:
```
Phase 1 → Verify → Phases 2-6 (parallel) → Final Verification
```

---

## Related Documents

- **Original Spec**: `specs/013-anthropic-refactor/spec.md`
- **Implementation Tasks**: `specs/013-anthropic-refactor/tasks.md`
- **Research Decisions**: `specs/013-anthropic-refactor/research.md`
- **Architecture Guide**: `.knowledge/docs/how-it-works.md`

---

## Notes

**Pre-1.0 Status**: This addendum maintains the "clean break" approach - no deprecated code, no backward compatibility. All old APIs are deleted, not marked deprecated.

**Provider Pattern**: The event mapper refactor establishes a clear pattern that future provider packages (OpenAI, Gemini, etc.) can follow consistently.

**Type Safety**: The `as unknown as SDKMessage` cast is documented with SAFETY comments explaining the runtime contract that the type system cannot express. This is preferable to `as any` which disables all type checking.
