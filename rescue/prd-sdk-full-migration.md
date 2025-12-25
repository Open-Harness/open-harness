# PRD: SDK Full Migration - Eliminate All Deprecated Code

**Status:** Draft  
**Date:** 2025-12-25  
**Author:** BMAD Workflow  
**Priority:** High  

---

## Executive Summary

The SDK has accumulated significant technical debt through an incomplete migration. The architecture documents describe a three-layer system with `BaseAnthropicAgent` as the standard agent base class, but **this class was never implemented**. Meanwhile, all agents still use the deprecated `BaseAgent` and `StreamCallbacks` system.

This PRD defines the complete work needed to:
1. Implement the missing `BaseAnthropicAgent` class
2. Migrate all agents to the new system
3. Update all consumers (internal and external)
4. Remove all deprecated code
5. Update documentation

---

## Problem Statement

### Current State (Broken)

```
src/agents/index.ts exports:
  export { BaseAnthropicAgent } from "./base-anthropic-agent.js";  // FILE DOESN'T EXIST!

src/index.ts exports:
  export { BaseAnthropicAgent } from "./agents/base-anthropic-agent.js";  // BROKEN EXPORT!
  export { BaseAgent, type StreamCallbacks } from "./runner/base-agent.js";  // DEPRECATED
```

**This means:**
- Anyone importing `BaseAnthropicAgent` gets a runtime error
- All agents use deprecated code
- The SDK's public API is broken
- The architecture docs describe a system that doesn't exist

### Root Cause

The migration was planned (evident from architecture docs and deprecation warnings) but never executed. The cleanup we just did (extracting `event-mapper.ts`) was Phase 1 of a multi-phase effort that stalled.

---

## Scope

### In Scope

1. **Create BaseAnthropicAgent** - The missing abstract base class
2. **Migrate CodingAgent, ReviewAgent, PlannerAgent** - To use new base
3. **Migrate ConfigAgent** - Factory-created agents
4. **Update MonologueWrapper** - Uses callbacks heavily
5. **Update WorkflowBuilder** - Callback types
6. **Update Orchestrator** - Callback types
7. **Update Harness Layer** - AgentRunParams callbacks type
8. **Update External Consumers:**
   - `harnesses/coding-workflow/src/index.ts`
   - `examples/coding/index.ts`
   - `apps/cli/src/workflows/autonomous.ts`
9. **Update All Tests** - Mock agents, callback signatures
10. **Remove Deprecated Code:**
    - `StreamCallbacks` type
    - `BaseAgent` class
    - `IAgentRunnerToken` (use provider-specific tokens)
    - `LiveSDKRunner` alias
11. **Update Documentation** - README, CLAUDE.md, architecture docs

### Out of Scope

- Adding new agents
- Changing the runner layer (AnthropicRunner, ReplayRunner)
- Modifying the harness layer architecture
- Adding new providers (OpenAI, etc.)

---

## Requirements

### R1: BaseAnthropicAgent Implementation

The abstract class must:

```typescript
abstract class BaseAnthropicAgent<TInput, TOutput> implements IAgent<TInput, TOutput> {
  // Abstract methods subclasses must implement
  protected abstract buildPrompt(input: TInput): string;
  protected abstract extractOutput(result: AgentResult): TOutput;
  protected abstract getOptions(): RunnerOptions;
  
  // Provided implementation
  public async run(input: TInput, sessionId: string, callbacks?: IAgentCallbacks<TOutput>): Promise<TOutput>;
}
```

Must use:
- `IAgentCallbacks<TOutput>` (not StreamCallbacks)
- `mapSdkMessageToEvents()` for event mapping (shared utility)
- Provider-specific runner tokens (IAnthropicRunnerToken)

### R2: Callback Signature Migration

| Old (StreamCallbacks) | New (IAgentCallbacks) |
|-----------------------|----------------------|
| `onSessionStart(metadata, event)` | `onStart(metadata: AgentStartMetadata)` |
| `onText(content, event)` | `onText(text, delta: boolean)` |
| `onToolCall(toolName, input, event)` | `onToolCall(event: ToolCallEvent)` |
| `onToolResult(result, event)` | `onToolResult(event: ToolResultEvent)` |
| `onToolProgress(name, seconds, event)` | `onProgress(event: ProgressEvent)` |
| `onResult(result, event)` | `onComplete(result: AgentResult<TOutput>)` |
| `onSessionEnd(content, isError, event)` | `onError(error: AgentError)` |
| `onCompact(data, event)` | *removed* |
| `onStatus(data, event)` | *removed* |

### R3: Zero Breaking Changes for Consumers

During migration, maintain backward compatibility:
- Export both old and new types (with deprecation warnings)
- Provide adapter functions if needed
- Clear migration guide in CHANGELOG

### R4: Test Coverage

- All new code must have unit tests
- Migration must not reduce test count
- All 117+ existing tests must pass

---

## Technical Design

### Phase 1: Implement BaseAnthropicAgent (Foundation)

**New file:** `src/agents/base-anthropic-agent.ts`

```typescript
import { inject, injectable } from "@needle-di/core";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { IAnthropicRunnerToken, type RunnerCallbacks } from "../core/tokens.js";
import { mapSdkMessageToEvents } from "../runner/event-mapper.js";
import type { IAgent, RunnerOptions } from "./types.js";
import type { AgentResult, IAgentCallbacks } from "../callbacks/types.js";

@injectable()
export abstract class BaseAnthropicAgent<TInput, TOutput> implements IAgent<TInput, TOutput> {
  constructor(
    public readonly name: string,
    protected runner = inject(IAnthropicRunnerToken),
  ) {}

  protected abstract buildPrompt(input: TInput): string;
  protected abstract extractOutput(result: AgentResult<TOutput>): TOutput;
  protected abstract getOptions(): RunnerOptions;

  async run(
    input: TInput, 
    sessionId: string, 
    callbacks?: IAgentCallbacks<TOutput>
  ): Promise<TOutput> {
    const prompt = this.buildPrompt(input);
    const options = this.buildSdkOptions(this.getOptions());
    
    let sessionStarted = false;
    let finalResult: AgentResult<TOutput> | null = null;

    const runnerCallbacks: RunnerCallbacks = {
      onMessage: (msg: SDKMessage) => {
        const events = mapSdkMessageToEvents(msg, this.name, sessionId);
        for (const event of events) {
          this.dispatchCallback(event, callbacks, sessionStarted);
          if (event.event_type === "session_start") sessionStarted = true;
        }
        
        if (msg.type === "result") {
          finalResult = this.buildAgentResult(msg);
        }
      },
    };

    await this.runner.run({ prompt, options, callbacks: runnerCallbacks });

    if (!finalResult) {
      const error = { code: "NO_RESULT", message: "Agent run completed without result" };
      callbacks?.onError?.(error);
      throw new Error(error.message);
    }

    if (finalResult.success) {
      callbacks?.onComplete?.(finalResult);
    } else {
      callbacks?.onError?.({ code: "AGENT_FAILED", message: "Agent execution failed" });
    }

    return this.extractOutput(finalResult);
  }

  // ... helper methods
}
```

### Phase 2: Migrate Agents

Each agent conversion follows this pattern:

**Before (CodingAgent):**
```typescript
export class CodingAgent extends BaseAgent {
  async execute(task: string, sessionId: string, callbacks?: StreamCallbacks): Promise<CodingResult> {
    // ...
  }
}
```

**After:**
```typescript
export class CodingAgent extends BaseAnthropicAgent<CodingInput, CodingResult> {
  protected buildPrompt(input: CodingInput): string {
    return PromptRegistry.formatCoding(input);
  }
  
  protected extractOutput(result: AgentResult<CodingResult>): CodingResult {
    return result.output as CodingResult;
  }
  
  protected getOptions(): RunnerOptions {
    return { outputFormat: CodingResultSdkSchema };
  }
  
  // Public API preserved
  async execute(task: string, sessionId: string, callbacks?: IAgentCallbacks<CodingResult>): Promise<CodingResult> {
    return this.run({ task }, sessionId, callbacks);
  }
}
```

### Phase 3: Update Consumers

**Callback migration example:**

```typescript
// Before
coder.execute(task, sessionId, {
  onText: (content, event) => console.log(content),
  onToolCall: (name, input, event) => console.log(`Tool: ${name}`),
});

// After
coder.execute(task, sessionId, {
  onText: (text, delta) => console.log(text),
  onToolCall: (event) => console.log(`Tool: ${event.toolName}`),
});
```

### Phase 4: Remove Deprecated Code

Delete:
- `src/runner/base-agent.ts` entirely
- `StreamCallbacks` from `src/callbacks/types.ts`
- `IAgentRunnerToken` from `src/core/tokens.ts`
- `LiveSDKRunner` alias from `src/runner/anthropic-runner.ts`

Update exports in:
- `src/runner/index.ts`
- `src/index.ts`

---

## Files Requiring Changes

### Core SDK (packages/sdk/src/)

| File | Change Type | Complexity |
|------|-------------|------------|
| `agents/base-anthropic-agent.ts` | **CREATE** | High |
| `agents/coding-agent.ts` | Modify | Medium |
| `agents/review-agent.ts` | Modify | Medium |
| `agents/planner-agent.ts` | Modify | Medium |
| `factory/agent-factory.ts` | Modify | Medium |
| `factory/workflow-builder.ts` | Modify | Low |
| `workflow/orchestrator.ts` | Modify | Low |
| `monologue/wrapper.ts` | Modify | High |
| `harness/types.ts` | Modify | Low |
| `runner/base-agent.ts` | **DELETE** | N/A |
| `callbacks/types.ts` | Modify | Low |
| `core/tokens.ts` | Modify | Low |
| `runner/index.ts` | Modify | Low |
| `index.ts` | Modify | Low |

### External Consumers

| File | Change Type | Complexity |
|------|-------------|------------|
| `harnesses/coding-workflow/src/index.ts` | Modify | Medium |
| `examples/coding/index.ts` | Modify | Medium |
| `apps/cli/src/workflows/autonomous.ts` | Modify | Medium |

### Tests

| File | Change Type | Complexity |
|------|-------------|------------|
| `tests/unit/agent-factory.test.ts` | Modify | Medium |
| `tests/unit/monologue-wrapper.test.ts` | Modify | Medium |
| `tests/unit/workflow-builder.test.ts` | Modify | Low |
| `tests/unit/base-anthropic-agent.test.ts` | **CREATE** | High |

### Documentation

| File | Change Type |
|------|-------------|
| `packages/sdk/README.md` | Update |
| `packages/sdk/CLAUDE.md` | Update |
| `packages/sdk/PROJECT_STRUCTURE.md` | Update |
| `docs/architecture-sdk.md` | Update |

---

## Estimated Effort

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: BaseAnthropicAgent | Create class, tests | 6-8 |
| Phase 2: Migrate Agents | 4 agents + factory | 6-8 |
| Phase 3: Update Consumers | Internal + external | 4-6 |
| Phase 4: Remove Deprecated | Delete + cleanup | 2-3 |
| Phase 5: Documentation | All docs | 2-3 |
| Phase 6: Testing | Integration, validation | 2-3 |
| **Total** | | **22-31 hours** |

---

## Success Criteria

1. **Zero deprecated code remains** - No `@deprecated` annotations in final codebase
2. **All exports work** - `import { BaseAnthropicAgent } from "@openharnes/sdk"` succeeds
3. **All tests pass** - 117+ unit tests green
4. **All consumers updated** - harnesses, examples, apps all work
5. **Documentation current** - No stale references
6. **TypeScript clean** - No type errors
7. **Smoke test passes** - Real SDK integration works

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking external consumers | High | High | Provide adapter/migration period |
| Missing edge cases in BaseAnthropicAgent | Medium | High | Comprehensive testing |
| Callback signature changes break apps | High | Medium | Clear migration guide |
| Test coverage gaps | Low | Medium | Adversarial review after implementation |

---

## Next Steps

1. **Approve this PRD** - Confirm scope and approach
2. **Create Tech Spec** - Detailed implementation plan with code samples
3. **Implementation Sprint** - Execute phases 1-4
4. **Adversarial Review** - Validate no gaps
5. **Documentation Sprint** - Update all docs
6. **Final Validation** - Full test suite, smoke test

---

## Appendix: Current Deprecation Warnings

```typescript
// src/runner/base-agent.ts:7-8
/**
 * @deprecated Use BaseAnthropicAgent from '../agents/base-anthropic-agent.js' instead.
 */

// src/runner/base-agent.ts:21
/**
 * @deprecated Use IAgentCallbacks from '../callbacks/types.js' instead.
 */
export type StreamCallbacks = { ... }

// src/core/tokens.ts:49
/**
 * @deprecated Use provider-specific tokens: IAnthropicRunnerToken, IReplayRunnerToken
 */
export const IAgentRunnerToken = ...

// src/runner/anthropic-runner.ts:46
/**
 * @deprecated Use AnthropicRunner instead
 */
export const LiveSDKRunner = AnthropicRunner;
```
