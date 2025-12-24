# Narrative Integration Specification

> Complete specification for integrating narrative capability into BaseAnthropicAgent.
> This document captures decisions made in the 2025-12-25 session.

## Overview

**Goal:** Make narrative generation a native capability of `BaseAnthropicAgent` via the callback extension pattern.

**Result:** Any agent extending `BaseAnthropicAgent` can enable narrative by passing `onNarrative` + `narrativeConfig` callbacks. No wrapper needed.

---

## Architecture Decision

### Option Chosen: Callback Extension (Option B)

We chose this over:
- ❌ Built-in mode (adds state to base class)
- ❌ Decorator pattern (type safety issues, complex)
- ❌ Wrapper pattern (loses specialized methods like `execute()`, `review()`)

**Why Callback Extension:**
1. Zero state added to the base class
2. Perfect backward compatibility
3. Follows existing callback pattern (`onText`, `onToolCall`, etc.)
4. Full TypeScript inference
5. Simple to implement (~30 lines)

---

## Files To Modify

### 1. `packages/sdk/src/callbacks/types.ts` ✅ DONE

Added `NarrativeConfig` interface and `onNarrative`/`narrativeConfig` to `IAgentCallbacks`:

```typescript
// Already added:
export interface NarrativeConfig {
  /** Number of events to buffer before generating narrative (default: 5) */
  bufferSize?: number;
  /** Event types to include in narrative (default: all) */
  eventTypes?: string[];
  /** Model to use for narrative generation (default: 'haiku') */
  model?: 'haiku' | 'sonnet' | 'opus';
}

export interface IAgentCallbacks<TOutput = unknown> {
  // ... existing callbacks ...
  
  onNarrative?: (text: string, metadata?: Record<string, unknown>) => void;
  narrativeConfig?: NarrativeConfig;
}
```

### 2. `packages/sdk/src/callbacks/index.ts` ✅ DONE

Added export for `NarrativeConfig`:

```typescript
export type {
  // ... existing exports ...
  NarrativeConfig,
} from "./types.js";
```

### 3. `packages/sdk/src/agents/base-anthropic-agent.ts` ❌ DELETED - NEEDS RECREATION

This file was accidentally deleted. It needs to be recreated with narrative integration.

**Original structure (before deletion):**
- Abstract class `BaseAnthropicAgent<TInput, TOutput>` implementing `IAgent<TInput, TOutput>`
- Abstract methods: `buildPrompt()`, `extractOutput()`, `getOptions()`
- Main method: `execute(input, sessionId, callbacks)`
- Used `IAgentCallbacks` for typed callbacks
- Used `mapSdkMessageToEvents()` for event mapping

**New additions needed:**
- Import `AgentMonologue` from `./monologue.js`
- Import `NarrativeConfig` from callbacks
- Add narrative buffering logic in `execute()`
- Add `shouldBufferEvent()` private method
- Add `generateNarrative()` private method

### 4. `packages/sdk/src/agents/coding-agent.ts` ❌ NEEDS UPDATE

Currently extends `BaseAgent` (deprecated). Needs to extend `BaseAnthropicAgent`.

**Current:**
```typescript
import { BaseAgent, type StreamCallbacks } from "../runner/base-agent.js";

@injectable()
export class CodingAgent extends BaseAgent {
  constructor(runner = inject(IAgentRunnerToken), ...) {
    super("Coder", runner, eventBus);
  }

  async execute(task: string, sessionId: string, callbacks?: StreamCallbacks): Promise<CodingResult> {
    // ...
  }
}
```

**Should become:**
```typescript
import { BaseAnthropicAgent } from "./base-anthropic-agent.js";
import type { IAgentCallbacks } from "../callbacks/index.js";

interface CodingInput {
  task: string;
}

@injectable()
export class CodingAgent extends BaseAnthropicAgent<CodingInput, CodingResult> {
  readonly name = "CodingAgent";

  protected buildPrompt(input: CodingInput): string {
    return PromptRegistry.formatCoding({ task: input.task });
  }

  protected extractOutput(result: AgentResult): CodingResult {
    return result.output as CodingResult;
  }

  protected getOptions(): RunnerOptions {
    return {
      model: "sonnet",
      outputSchema: CodingResultSchema,
    };
  }
}
```

### 5. `packages/sdk/src/agents/review-agent.ts` ❌ NEEDS UPDATE

Same pattern as CodingAgent - migrate from `BaseAgent` to `BaseAnthropicAgent`.

### 6. `packages/sdk/src/agents/coder.prompt.md` ✅ DONE

Updated to include git commit workflow:
- Agent must commit code with descriptive message
- Include commit hash in handoff output

### 7. `packages/sdk/src/agents/reviewer.prompt.md` ✅ DONE  

Updated to read actual commits:
- Extract commit hash from implementation summary
- Use `git show <hash>` to inspect real code
- Review based on actual code, not descriptions

### 8. `harnesses/coding-workflow/src/index.ts` ❌ NEEDS UPDATE

Update to use narrative callbacks:

**Current:**
```typescript
const codeResult = await this.coder.execute(
  `${ticket.title}\n\n${ticket.description}`,
  `workflow-session-${ticket.id}`,
  {
    onText: () => process.stdout.write("."),
    onToolCall: (name) => p.log.info(`\n  🔧 ${name}`),
  },
);
```

**Should become:**
```typescript
const codeResult = await this.coder.execute(
  { task: `${ticket.title}\n\n${ticket.description}` },
  `workflow-session-${ticket.id}`,
  {
    onNarrative: (text) => p.log.info(`💭 ${text}`),
    narrativeConfig: { bufferSize: 3 },
    onToolCall: (event) => p.log.info(`🔧 ${event.toolName}`),
  },
);
```

---

## BaseAnthropicAgent Implementation

The recreated `base-anthropic-agent.ts` should look like this:

```typescript
/**
 * BaseAnthropicAgent - Base class for Anthropic/Claude agents
 * 
 * Implements IAgent<TInput, TOutput> with built-in narrative capability.
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject } from "@needle-di/core";
import type {
  AgentResult,
  IAgentCallbacks,
  AgentStartMetadata,
  ToolCallEvent,
  ToolResultEvent,
  ProgressEvent,
  AgentError,
  NarrativeConfig,
} from "../callbacks/index.js";
import { type IAgentRunner, IAnthropicRunnerToken, type IEventBus, IEventBusToken } from "../core/tokens.js";
import { mapSdkMessageToEvents } from "../runner/event-mapper.js";
import { type AgentEvent, EventTypeConst } from "../runner/models.js";
import type { IAgent, RunnerOptions } from "./types.js";
import { AgentMonologue } from "./monologue.js";

export abstract class BaseAnthropicAgent<TInput, TOutput> implements IAgent<TInput, TOutput> {
  abstract readonly name: string;

  constructor(
    protected runner: IAgentRunner = inject(IAnthropicRunnerToken),
    protected eventBus: IEventBus | null = inject(IEventBusToken, { optional: true }) ?? null,
  ) {}

  async execute(input: TInput, sessionId: string, callbacks?: IAgentCallbacks<TOutput>): Promise<TOutput> {
    const prompt = this.buildPrompt(input);
    const options = this.getOptions();

    // Initialize narrative if enabled
    const narrativeEnabled = !!(callbacks?.onNarrative && callbacks?.narrativeConfig);
    const narrativeBuffer: AgentEvent[] = [];
    const narrativeConfig = callbacks?.narrativeConfig || { bufferSize: 5 };
    let monologue: AgentMonologue | undefined;
    
    if (narrativeEnabled) {
      const { createContainer } = await import("../core/container.js");
      const container = createContainer({ mode: "live" });
      monologue = container.get(AgentMonologue);
    }

    // Fire onStart
    if (callbacks?.onStart) {
      const startMeta: AgentStartMetadata = {
        agentName: this.name,
        sessionId,
        model: options.model,
        tools: options.allowedTools,
      };
      callbacks.onStart(startMeta);
    }

    try {
      const result = await this.runner.run({
        prompt,
        options: this.mapOptionsToSdk(options),
        callbacks: {
          onMessage: (msg: SDKMessage) => {
            const events = mapSdkMessageToEvents(msg, this.name, sessionId);
            for (const event of events) {
              this.fireEventBus(event);
              
              // Buffer for narrative if enabled
              if (narrativeEnabled && monologue && this.shouldBufferEvent(event, narrativeConfig)) {
                narrativeBuffer.push(event);
                
                if (narrativeBuffer.length >= (narrativeConfig.bufferSize || 5)) {
                  this.generateNarrative(narrativeBuffer, monologue, sessionId, callbacks!.onNarrative!)
                    .catch(console.error);
                  narrativeBuffer.length = 0;
                }
              }
              
              if (callbacks) {
                this.dispatchCallback(callbacks, event);
              }
            }
          },
        },
      });

      // Final narrative flush
      if (narrativeEnabled && monologue && narrativeBuffer.length > 0) {
        await this.generateNarrative(narrativeBuffer, monologue, sessionId, callbacks!.onNarrative!);
      }

      const agentResult: AgentResult<TOutput> = this.buildAgentResult(result);

      if (callbacks?.onComplete) {
        callbacks.onComplete(agentResult);
      }

      return this.extractOutput(agentResult);
    } catch (error) {
      const agentError: AgentError = {
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      };

      if (callbacks?.onError) {
        callbacks.onError(agentError);
      }

      throw error;
    }
  }

  // =========================================================================
  // Abstract Methods
  // =========================================================================

  protected abstract buildPrompt(input: TInput): string;
  protected abstract extractOutput(result: AgentResult): TOutput;
  protected abstract getOptions(): RunnerOptions;

  // =========================================================================
  // Private Methods
  // =========================================================================

  private mapOptionsToSdk(options: RunnerOptions): Options {
    return {
      model: options.model ?? "haiku",
      allowedTools: options.allowedTools,
      maxTokens: options.maxTokens,
    } as Options;
  }

  private buildAgentResult(sdkMessage: SDKMessage | undefined): AgentResult<TOutput> {
    if (!sdkMessage) {
      return { success: false, errors: ["No response from LLM"] };
    }

    if (sdkMessage.type === "result") {
      return {
        success: sdkMessage.subtype === "success",
        output: sdkMessage.subtype === "success" ? (sdkMessage.structured_output as TOutput) : undefined,
        usage: {
          inputTokens: sdkMessage.usage.input_tokens,
          outputTokens: sdkMessage.usage.output_tokens,
          cacheReadInputTokens: sdkMessage.usage.cache_read_input_tokens,
          cacheCreationInputTokens: sdkMessage.usage.cache_creation_input_tokens,
        },
        durationMs: sdkMessage.duration_ms,
        errors: sdkMessage.subtype !== "success" ? sdkMessage.errors : undefined,
      };
    }

    return { success: true };
  }

  private fireEventBus(event: AgentEvent): void {
    if (this.eventBus) {
      this.eventBus.publish(event);
    }
  }

  private shouldBufferEvent(event: AgentEvent, config: NarrativeConfig): boolean {
    const { eventTypes } = config;
    
    if (!eventTypes || eventTypes.length === 0) {
      const interestingTypes: string[] = [
        EventTypeConst.TOOL_CALL,
        EventTypeConst.TOOL_RESULT,
        EventTypeConst.TEXT,
        EventTypeConst.THINKING,
      ];
      return interestingTypes.includes(event.event_type);
    }
    
    return eventTypes.includes(event.event_type);
  }

  private async generateNarrative(
    buffer: AgentEvent[],
    monologue: AgentMonologue,
    sessionId: string,
    onNarrative: (text: string, metadata?: Record<string, unknown>) => void
  ): Promise<void> {
    if (buffer.length === 0) return;

    try {
      for (const event of buffer) {
        monologue.ingest(event);
      }

      const narrativeEvent = await monologue.generate(`${sessionId}_narrative`);
      
      if (narrativeEvent?.content) {
        onNarrative(narrativeEvent.content, narrativeEvent.metadata);
      }
    } catch (error) {
      console.debug(`Narrative generation failed: ${error}`);
    }
  }

  private dispatchCallback(callbacks: IAgentCallbacks<TOutput>, event: AgentEvent): void {
    try {
      switch (event.event_type) {
        case EventTypeConst.TEXT:
          if (event.content && callbacks.onText) {
            callbacks.onText(event.content, true);
          }
          break;

        case EventTypeConst.THINKING:
          if (event.content && callbacks.onThinking) {
            callbacks.onThinking(event.content);
          }
          break;

        case EventTypeConst.TOOL_CALL:
          if (event.tool_name && event.tool_input && callbacks.onToolCall) {
            const toolEvent: ToolCallEvent = {
              toolName: event.tool_name,
              input: event.tool_input,
            };
            callbacks.onToolCall(toolEvent);
          }
          break;

        case EventTypeConst.TOOL_RESULT:
          if (event.tool_result && callbacks.onToolResult) {
            const resultEvent: ToolResultEvent = {
              content: event.tool_result,
              isError: event.is_error,
            };
            callbacks.onToolResult(resultEvent);
          }
          break;

        case EventTypeConst.TOOL_PROGRESS:
          if (event.tool_name && callbacks.onProgress) {
            const progressEvent: ProgressEvent = {
              toolName: event.tool_name,
              elapsedSeconds: (event.metadata?.elapsed_seconds as number) ?? 0,
            };
            callbacks.onProgress(progressEvent);
          }
          break;

        case EventTypeConst.ERROR:
          if (event.content && callbacks.onError) {
            callbacks.onError({ message: event.content });
          }
          break;
      }
    } catch (_error) {
      // Fire-and-forget: silently ignore callback errors
    }
  }
}
```

---

## What Happens to `withMonologue` Wrapper?

The existing `withMonologue` wrapper in `packages/sdk/src/monologue/wrapper.ts` becomes **redundant** once narrative is integrated into `BaseAnthropicAgent`.

**Options:**
1. **Delete it** - narrative is now native to base class
2. **Keep it** - for wrapping legacy `BaseAgent` instances during migration
3. **Deprecate it** - mark as deprecated, remove in next major version

**Recommendation:** Keep it during migration, deprecate after all agents use `BaseAnthropicAgent`.

---

## Usage Example

After implementation, using narrative is simple:

```typescript
import { CodingAgent, createContainer } from "@openharnes/sdk";

const container = createContainer({ mode: "live" });
const coder = container.get(CodingAgent);

const result = await coder.execute(
  { task: "Build a TODO app with add/complete/delete" },
  "session-123",
  {
    // Enable narrative
    onNarrative: (text) => console.log(`💭 ${text}`),
    narrativeConfig: { 
      bufferSize: 3,
      eventTypes: ["tool_call", "tool_result"] 
    },
    
    // Other callbacks still work
    onToolCall: (event) => console.log(`🔧 ${event.toolName}`),
    onComplete: (result) => console.log(`✅ Done: ${result.success}`),
  }
);
```

---

## Migration Checklist

1. [ ] Recreate `packages/sdk/src/agents/base-anthropic-agent.ts` with narrative integration
2. [ ] Migrate `CodingAgent` to extend `BaseAnthropicAgent`
3. [ ] Migrate `ReviewAgent` to extend `BaseAnthropicAgent`
4. [ ] Update harness to use new callback pattern
5. [ ] Run SDK tests: `cd packages/sdk && bun test`
6. [ ] Run harness: `cd harnesses/coding-workflow && bun run start`
7. [ ] Verify narrative output works
8. [ ] Deprecate `withMonologue` wrapper

---

## Session Damage Report

**Files correctly modified:**
- `packages/sdk/src/callbacks/types.ts` - Added NarrativeConfig ✅
- `packages/sdk/src/callbacks/index.ts` - Added export ✅
- `packages/sdk/src/agents/coder.prompt.md` - Git commit workflow ✅
- `packages/sdk/src/agents/reviewer.prompt.md` - Git review workflow ✅

**Files incorrectly deleted:**
- `packages/sdk/src/agents/base-anthropic-agent.ts` - DELETED ❌

**Root cause:** Multiple edits created duplicate methods, file got corrupted, then deleted instead of fixed.

---

## References

- MANIFEST.md: `harnesses/coding-workflow/MANIFEST.md`
- SDK cleanup spec: `_bmad-output/implementation-artifacts/tech-spec-sdk-cleanup.md`
- Architecture: `docs/architecture-sdk.md`
