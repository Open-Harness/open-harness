# Monologue Architecture Decision

> **Date**: 2025-12-26
> **Status**: APPROVED
> **Epic**: 002-sdk-validation
> **Decision**: Decorator Pattern for Monologue (`@AnthropicMonologue`)

---

## Executive Summary

After 3 failed implementation attempts and deep analysis, the **Decorator Pattern** has been selected for the monologue feature. This follows the working `@Record` decorator pattern already in the codebase.

**Key Insight**: Monologue is a cross-cutting concern, not an agent concern. The decorator pattern keeps agents thin while providing opt-in monologue capability.

**Naming Convention**: Since this implementation is coupled to Anthropic's API, it's called `@AnthropicMonologue`. Future providers (OpenAI, etc.) would have their own decorators.

---

## Context: Three Failed Approaches

### Attempt 1: Built Into BaseAnthropicAgent (REJECTED)

```typescript
// REJECTED: Couples UI concern to agent core
class BaseAnthropicAgent {
  private monologueBuffer: AgentEvent[] = [];

  async run(...) {
    // Monologue buffering logic pollutes base class
    // Every agent now has overhead even if not using monologue
  }
}
```

**Why it failed:**
- Couples UI concern (monologue) to agent core
- State pollution in base class
- Every new base class (e.g., `BaseOpenAIAgent`) must reimplement
- Agents should be thin orchestrators

### Attempt 2: Wrapper Function (REJECTED)

```typescript
// REJECTED: Loses type safety, method proxying nightmare
const agent = withMonologue(
  createAgent('coder'),
  { onMonologue: (text) => console.log(text) }
);

// Problem: agent.execute() loses TypeScript inference
// Problem: wrapper must proxy every method
```

**Why it failed:**
- Loses TypeScript inference for specialized methods
- Wrapper must know about every method to proxy
- No access to internal event stream easily
- Breaks when agents add new methods

### Attempt 3: Callback Extension (REJECTED for now)

```typescript
// Partially implemented but abandoned
await agent.execute(input, sessionId, {
  onMonologue: (text) => console.log(text),
  monologueConfig: { bufferSize: 3 },
});
```

**Why it failed (process, not technical):**
- Pivot documented only in `rescue/` folder, not in spec
- Tasks T051-T056 marked complete but code orphaned
- `BaseAnthropicAgent` never integrated the logic
- Two sources of truth created (spec.md vs rescue/)

---

## Chosen Approach: Decorator Pattern

### Why Decorators Work

The `@Record` decorator already proves this pattern works in the codebase:

```typescript
// src/core/decorators.ts - WORKING PATTERN
@Record("golden", (args) => args[1])
async capture(prompt, scenarioId, options, callbacks) {
  return this.runner.run({ prompt, options, callbacks });
}
```

**Properties that make decorators successful:**
1. **Factory Injection**: Gets dependencies from container at runtime
2. **Method Wrapping**: Intercepts execution without modifying internals
3. **Opt-in**: Only decorated methods get the behavior
4. **Composable**: Can stack multiple decorators
5. **DI-Friendly**: Testable via mock factories

---

## Monologue Configuration

### MonologueConfig Interface

```typescript
// src/monologue/types.ts

/**
 * Configuration for monologue generation.
 */
export interface MonologueConfig {
  /**
   * Minimum number of events to buffer before considering generation.
   * The system prompt may still decide to wait for more events.
   * @default 1
   */
  minBufferSize?: number;

  /**
   * Maximum number of events to buffer before forcing generation.
   * @default 10
   */
  maxBufferSize?: number;

  /**
   * Maximum number of previous monologues to include in history.
   * These get re-injected into the system prompt for context.
   * @default 5
   */
  historySize?: number;

  /**
   * Model to use for monologue generation.
   * @default "haiku"
   */
  model?: "haiku" | "sonnet" | "opus";

  /**
   * Custom system prompt for monologue generation.
   * If provided, overrides the default prompt.
   *
   * The prompt receives:
   * - {{events}} - Recent events to summarize
   * - {{history}} - Previous monologues for context
   * - {{agentName}} - Name of the agent
   *
   * The prompt can instruct the LLM to:
   * - Generate immediately, or
   * - Return empty string to wait for more events
   */
  systemPrompt?: string;
}
```

### Key Design Decisions

1. **History Re-injection**: Previous monologues are stored and fed back into the system prompt, giving the LLM context about what it already said.

2. **Min/Max Buffer**:
   - `minBufferSize`: Don't even try to generate until this many events
   - `maxBufferSize`: Force generation at this threshold
   - Between min and max, the system prompt decides

3. **System Prompt Control**: The system prompt can return empty string to say "not enough context yet, wait for more events."

---

## Decorator Implementation

### @AnthropicMonologue Decorator

```typescript
// src/core/decorators.ts

import type { MonologueConfig } from "../monologue/types.js";
import type { IAgentCallbacks } from "../callbacks/types.js";
import type { AgentEvent } from "../runner/models.js";
import { IMonologueGeneratorToken } from "./tokens.js";

/**
 * @AnthropicMonologue decorator - Adds monologue generation to Anthropic agent methods
 *
 * Buffers events during execution and synthesizes human-readable monologue
 * via a lightweight LLM call. Maintains history of previous monologues
 * that gets re-injected into the system prompt for context.
 *
 * @param config - Monologue configuration
 *
 * @example
 * ```typescript
 * @injectable()
 * class CodingAgent extends BaseAnthropicAgent {
 *   @AnthropicMonologue({
 *     minBufferSize: 2,
 *     maxBufferSize: 8,
 *     historySize: 5,
 *     model: "haiku"
 *   })
 *   async execute(input: CodingInput, sessionId: string, callbacks?: IAgentCallbacks) {
 *     return this.run(this.buildPrompt(input), sessionId, { callbacks });
 *   }
 * }
 * ```
 */
export function AnthropicMonologue(config: MonologueConfig = {}): MethodDecorator {
  return (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;

    descriptor.value = async function (
      this: { name: string },  // Agent with name property
      ...args: unknown[]
    ): Promise<unknown> {
      const callbacks = args[2] as IAgentCallbacks | undefined;

      // Skip if no onMonologue callback provided
      if (!callbacks?.onMonologue) {
        return original.apply(this, args);
      }

      // Get monologue generator from container
      const container = getContainer();
      const generator = container.get(IMonologueGeneratorToken);

      // Configuration with defaults
      const minBuffer = config.minBufferSize ?? 1;
      const maxBuffer = config.maxBufferSize ?? 10;
      const historySize = config.historySize ?? 5;

      // State for this execution
      const eventBuffer: AgentEvent[] = [];
      const monologueHistory: string[] = [];

      /**
       * Attempt to generate monologue from current buffer.
       * Returns true if monologue was generated, false if LLM said "wait".
       */
      const tryGenerate = async (): Promise<boolean> => {
        if (eventBuffer.length < minBuffer) {
          return false;
        }

        const result = await generator.generate({
          events: [...eventBuffer],
          history: monologueHistory.slice(-historySize),
          agentName: this.name,
          config,
        });

        // Empty result means "wait for more events"
        if (!result || result.trim() === "") {
          return false;
        }

        // Store in history for future context
        monologueHistory.push(result);

        // Emit to callback
        callbacks.onMonologue!(result, {
          eventCount: eventBuffer.length,
          historyLength: monologueHistory.length,
        });

        // Clear buffer
        eventBuffer.length = 0;

        return true;
      };

      // Enhanced callbacks that buffer events
      const enhancedCallbacks: IAgentCallbacks = {
        ...callbacks,

        onToolCall: (event) => {
          eventBuffer.push({
            event_type: "tool_call",
            tool_name: event.toolName,
            tool_input: event.input,
            agent_name: this.name,
            timestamp: Date.now(),
          } as AgentEvent);

          callbacks.onToolCall?.(event);

          // Try to generate if at max buffer
          if (eventBuffer.length >= maxBuffer) {
            tryGenerate().catch(console.error);
          }
        },

        onThinking: (thought) => {
          eventBuffer.push({
            event_type: "thinking",
            content: thought,
            agent_name: this.name,
            timestamp: Date.now(),
          } as AgentEvent);

          callbacks.onThinking?.(thought);
        },

        onToolResult: (event) => {
          eventBuffer.push({
            event_type: "tool_result",
            tool_result: event.content,
            is_error: event.isError,
            agent_name: this.name,
            timestamp: Date.now(),
          } as AgentEvent);

          callbacks.onToolResult?.(event);

          // Good point to try generating - we have a complete action
          if (eventBuffer.length >= minBuffer) {
            tryGenerate().catch(console.error);
          }
        },

        onText: (text, delta) => {
          // Text events are less important for monologue, just pass through
          callbacks.onText?.(text, delta);
        },
      };

      // Execute with enhanced callbacks
      const result = await original.apply(this, [args[0], args[1], enhancedCallbacks]);

      // Final flush - force generation if anything remains
      if (eventBuffer.length > 0) {
        await generator.generate({
          events: eventBuffer,
          history: monologueHistory.slice(-historySize),
          agentName: this.name,
          config,
          forceGenerate: true,  // Don't allow "wait" on final flush
        }).then((text) => {
          if (text && text.trim()) {
            callbacks.onMonologue!(text, {
              eventCount: eventBuffer.length,
              historyLength: monologueHistory.length + 1,
              isFinal: true,
            });
          }
        }).catch(console.error);
      }

      return result;
    };

    return descriptor;
  };
}
```

---

## Monologue Generator Service

```typescript
// src/monologue/generator.ts

import { inject, injectable } from "@needle-di/core";
import type { MonologueConfig } from "./types.js";
import type { AgentEvent } from "../runner/models.js";
import { IAnthropicRunnerToken, type IAgentRunner } from "../core/tokens.js";
import { DEFAULT_MONOLOGUE_PROMPT } from "./prompts.js";

export interface GenerateInput {
  events: AgentEvent[];
  history: string[];
  agentName: string;
  config: MonologueConfig;
  forceGenerate?: boolean;
}

/**
 * AnthropicMonologueGenerator - Synthesizes human-readable monologues from event buffers.
 *
 * Uses Anthropic's API to generate first-person summaries of agent actions,
 * with awareness of previous monologues for continuity.
 */
@injectable()
export class AnthropicMonologueGenerator {
  constructor(
    private runner: IAgentRunner = inject(IAnthropicRunnerToken),
  ) {}

  /**
   * Generate a monologue from buffered events.
   *
   * @param input - Events, history, and configuration
   * @returns Monologue text, or empty string if LLM decides to wait
   */
  async generate(input: GenerateInput): Promise<string> {
    const { events, history, agentName, config, forceGenerate } = input;

    if (events.length === 0) return "";

    const systemPrompt = this.buildSystemPrompt(config, agentName, forceGenerate);
    const userPrompt = this.buildUserPrompt(events, history);

    const result = await this.runner.run({
      prompt: userPrompt,
      options: {
        model: config.model ?? "haiku",
        maxTokens: 200,
        systemPrompt,
      },
    });

    return this.extractMonologue(result);
  }

  private buildSystemPrompt(
    config: MonologueConfig,
    agentName: string,
    forceGenerate?: boolean
  ): string {
    if (config.systemPrompt) {
      return config.systemPrompt
        .replace(/\{\{agentName\}\}/g, agentName);
    }

    let prompt = DEFAULT_MONOLOGUE_PROMPT.replace(/\{\{agentName\}\}/g, agentName);

    if (forceGenerate) {
      prompt += "\n\nIMPORTANT: This is the final flush. You MUST generate a summary now.";
    }

    return prompt;
  }

  private buildUserPrompt(events: AgentEvent[], history: string[]): string {
    // Format history
    const historySection = history.length > 0
      ? `## Previous Monologues (for context)\n${history.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n`
      : "";

    // Format events
    const eventsSection = this.formatEvents(events);

    return `${historySection}## Recent Actions\n${eventsSection}\n\nGenerate your monologue (or respond with just "..." if you need more context):`;
  }

  private formatEvents(events: AgentEvent[]): string {
    return events.map((e) => {
      const time = e.timestamp ? new Date(e.timestamp).toISOString().split("T")[1].split(".")[0] : "";

      switch (e.event_type) {
        case "tool_call":
          return `[${time}] Called tool: ${e.tool_name}`;
        case "tool_result":
          const result = this.truncate(String(e.tool_result), 100);
          return `[${time}] Tool returned: ${e.is_error ? "ERROR: " : ""}${result}`;
        case "thinking":
          return `[${time}] Thought: ${this.truncate(e.content ?? "", 80)}`;
        default:
          return `[${time}] Event: ${e.event_type}`;
      }
    }).join("\n");
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  }

  private extractMonologue(result: unknown): string {
    if (typeof result === "object" && result !== null) {
      const r = result as Record<string, unknown>;
      if (r.type === "result") {
        const content = String(r.content ?? r.structured_output ?? "");
        // Check for "wait" signal
        if (content.trim() === "..." || content.trim() === "") {
          return "";
        }
        return content.trim();
      }
    }
    return "";
  }
}
```

---

## System Prompts

```typescript
// src/monologue/prompts.ts

/**
 * Default system prompt for monologue generation.
 *
 * The prompt instructs the LLM to:
 * 1. Generate first-person summaries of actions
 * 2. Consider previous monologues for continuity
 * 3. Return "..." if not enough context to generate meaningful monologue
 */
export const DEFAULT_MONOLOGUE_PROMPT = `You are the internal monologue of {{agentName}}, an AI coding agent.

Your job is to provide brief, first-person summaries of what you (the agent) are doing.
These summaries help humans follow your thought process.

## Guidelines

1. Write in first person ("I read...", "I'm creating...", "I found...")
2. Be concise - 1-2 sentences max
3. Focus on WHAT you accomplished, not HOW
4. Reference previous monologues for continuity (don't repeat yourself)
5. If the events don't have enough context for a meaningful summary, respond with just "..."

## Examples

Good: "I read the config file and found the database connection settings."
Good: "I'm implementing the user authentication endpoint now."
Good: "Found a bug in the validation logic - fixing it."

Bad: "I called the Read tool on package.json and got the contents back." (too mechanical)
Bad: "..." then later "I did many things." (lost context)

## When to Wait

Respond with just "..." if:
- Only a single tool call with no result yet
- Events don't form a coherent action
- You need more context to say something meaningful

When you DO generate, make it count - summarize the complete action.`;

/**
 * Example custom prompt for a more terse monologue style.
 */
export const TERSE_MONOLOGUE_PROMPT = `You are {{agentName}}. Summarize actions in 5 words or less.
Examples: "Reading config." | "Writing tests." | "Fixed the bug."
If unclear, respond "..."`;

/**
 * Example custom prompt for verbose/educational style.
 */
export const VERBOSE_MONOLOGUE_PROMPT = `You are {{agentName}}, explaining your actions to a junior developer.
Explain what you're doing and WHY in 2-3 sentences.
Include reasoning and any decisions you made.
If not enough context, respond "..."`;
```

---

## DI Token Registration

```typescript
// src/core/tokens.ts (additions)

import { createToken } from "@needle-di/core";
import type { AnthropicMonologueGenerator } from "../monologue/generator.js";

export const IMonologueGeneratorToken = createToken<AnthropicMonologueGenerator>(
  "IAnthropicMonologueGenerator"
);
```

```typescript
// src/core/container.ts (additions)

import { AnthropicMonologueGenerator } from "../monologue/generator.js";
import { IMonologueGeneratorToken } from "./tokens.js";

// In createContainer():
container.bind(IMonologueGeneratorToken).toClass(AnthropicMonologueGenerator);
```

---

## Callback Interface Update

```typescript
// src/callbacks/types.ts (updates)

export interface IAgentCallbacks<TOutput = unknown> {
  // ... existing callbacks ...

  /**
   * Fired when the agent generates a monologue summary of its actions.
   * Monologues are first-person summaries that help humans follow agent reasoning.
   *
   * NOTE: Only fires if monologue mode is enabled via @AnthropicMonologue decorator
   *
   * @param text - The monologue text in first person
   * @param metadata - Metadata about generation (eventCount, historyLength, isFinal)
   */
  onMonologue?: (text: string, metadata?: MonologueMetadata) => void;
}

export interface MonologueMetadata {
  /** Number of events that were summarized */
  eventCount: number;
  /** Current length of monologue history */
  historyLength: number;
  /** True if this is the final flush at end of execution */
  isFinal?: boolean;
}
```

---

## Usage Examples

### Example 1: Basic Monologue

```typescript
@injectable()
export class CodingAgent extends BaseAnthropicAgent {
  @AnthropicMonologue({ minBufferSize: 2, historySize: 5 })
  async execute(input: CodingInput, sessionId: string, callbacks?: IAgentCallbacks) {
    return this.run(this.buildPrompt(input), sessionId, { callbacks });
  }
}

// Usage
const result = await coder.execute(
  { task: "Build a REST API" },
  "session-001",
  {
    onMonologue: (text, meta) => {
      console.log(`💭 ${text}`);
      if (meta?.isFinal) console.log("(final summary)");
    },
  }
);
```

### Example 2: Custom System Prompt

```typescript
@injectable()
export class ReviewAgent extends BaseAnthropicAgent {
  @AnthropicMonologue({
    minBufferSize: 1,
    maxBufferSize: 5,
    systemPrompt: `You are a code reviewer.
Summarize what you found in the code.
Be critical but constructive.
If reviewing, mention specific issues.
If not enough context, respond "..."`,
  })
  async validate(input: ReviewInput, sessionId: string, callbacks?: IAgentCallbacks) {
    return this.run(this.buildPrompt(input), sessionId, { callbacks });
  }
}
```

### Example 3: Terse Monologue Style

```typescript
import { TERSE_MONOLOGUE_PROMPT } from "@openharnes/sdk";

@injectable()
export class ParserAgent extends BaseAnthropicAgent {
  @AnthropicMonologue({
    minBufferSize: 1,
    systemPrompt: TERSE_MONOLOGUE_PROMPT,  // "5 words or less"
  })
  async parse(input: ParserInput, sessionId: string, callbacks?: IAgentCallbacks) {
    // ...
  }
}
```

### Example 4: High-Frequency Monologue (Every Event)

```typescript
@AnthropicMonologue({
  minBufferSize: 1,   // Try after every event
  maxBufferSize: 1,   // Force after every event
  historySize: 10,    // Long history for context
})
```

### Example 5: Batched Monologue (Less Frequent)

```typescript
@AnthropicMonologue({
  minBufferSize: 5,   // Wait for 5 events minimum
  maxBufferSize: 15,  // Force at 15 events
  historySize: 3,     // Short history
})
```

---

## File Structure After Implementation

```
packages/sdk/src/
├── agents/
│   ├── base/
│   │   └── anthropic.ts           # BaseAnthropicAgent (unchanged)
│   ├── coder/
│   │   ├── agent.ts               # @AnthropicMonologue decorator applied
│   │   └── prompt.md
│   ├── reviewer/
│   │   ├── agent.ts               # @AnthropicMonologue decorator applied
│   │   └── prompt.md
│   ├── parser/
│   │   ├── agent.ts               # @AnthropicMonologue decorator applied
│   │   └── prompt.md
│   └── index.ts
├── monologue/                      # NEW (renamed from narrative/)
│   ├── index.ts                   # Public exports
│   ├── types.ts                   # MonologueConfig, MonologueMetadata
│   ├── generator.ts               # AnthropicMonologueGenerator
│   └── prompts.ts                 # DEFAULT_MONOLOGUE_PROMPT, presets
├── core/
│   ├── decorators.ts              # @Record + @AnthropicMonologue
│   ├── tokens.ts                  # + IMonologueGeneratorToken
│   └── container.ts               # + AnthropicMonologueGenerator binding
├── callbacks/
│   └── types.ts                   # + onMonologue, MonologueMetadata
└── index.ts                       # Public exports
```

---

## Comparison: Decorator vs. Alternatives

| Aspect | Decorator | Callback Extension | Wrapper |
|--------|-----------|-------------------|---------|
| Agent changes | None (thin) | Must add buffering logic | None |
| Type safety | Full | Full | Loses method types |
| Opt-in | Per-method | Per-call | Per-instantiation |
| History support | Built-in | Manual | Manual |
| Custom prompts | Config option | Would need param | Constructor arg |
| Composability | Stackable | N/A | Chainable but ugly |
| DI integration | Factory injection | Direct | Manual |
| Provider-specific | Named (`Anthropic*`) | Generic | Generic |

**Winner: Decorator Pattern** - follows existing working pattern, keeps agents thin, provides clean opt-in per-method, supports history and custom prompts naturally.

---

## Implementation Tasks

### Phase 1: Core Infrastructure
- [ ] Create `src/monologue/` module
- [ ] Implement `MonologueConfig` and `MonologueMetadata` types
- [ ] Implement `AnthropicMonologueGenerator` service
- [ ] Create `prompts.ts` with default + preset prompts
- [ ] Add `IMonologueGeneratorToken` to tokens
- [ ] Register in container
- [ ] Add `@AnthropicMonologue` decorator to `decorators.ts`

### Phase 2: Callback Updates
- [ ] Add `onMonologue` callback to `IAgentCallbacks`
- [ ] Update `IAgentCallbacks` JSDoc
- [ ] Export new types from `callbacks/index.ts`

### Phase 3: Agent Integration
- [ ] Apply `@AnthropicMonologue` to `CodingAgent.execute()`
- [ ] Apply `@AnthropicMonologue` to `ReviewAgent.validate()`
- [ ] Apply `@AnthropicMonologue` to `ParserAgent.parse()`
- [ ] Apply `@AnthropicMonologue` to `PlannerAgent.plan()`

### Phase 4: Cleanup
- [ ] Delete orphaned `src/agents/monologue.ts`
- [ ] Delete orphaned `src/monologue/wrapper.ts` (if exists)
- [ ] Fix broken exports in `src/index.ts`
- [ ] Fix broken exports in `src/agents/index.ts`
- [ ] Rename any remaining "narrative" references to "monologue"

### Phase 5: Testing
- [ ] Unit test for `AnthropicMonologueGenerator`
- [ ] Unit test for `@AnthropicMonologue` decorator
- [ ] Test history re-injection works correctly
- [ ] Test "wait" signal (empty response) works
- [ ] Test custom system prompts
- [ ] Integration test: agent with monologue callback
- [ ] Golden recording for monologue output

### Phase 6: Documentation
- [ ] Update `packages/sdk/README.md` with monologue examples
- [ ] Document preset prompts (TERSE, VERBOSE)
- [ ] Update this spec to mark decisions as IMPLEMENTED

---

## Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Naming | `@AnthropicMonologue` | Coupled to Anthropic API, explicit |
| History | Re-injected into system prompt | Continuity, no repetition |
| Buffer control | min/max thresholds | Flexibility for different use cases |
| System prompt | Configurable per-decorator | Different agents need different styles |
| Wait signal | Empty string from LLM | System prompt decides, not hard logic |
| Provider coupling | Explicit in name | Future `@OpenAIMonologue` possible |

---

## Process Learnings

### What Went Wrong (3 Times)

1. **Architectural pivots not reflected in spec** - Decisions made in `rescue/` folder never updated `spec.md`
2. **Tasks marked complete without validation** - Code existed but didn't work
3. **No integration tests** - Feature never proven end-to-end
4. **Two sources of truth** - spec.md vs rescue/ docs

### Process Gates for This Implementation

1. **Spec updated first** (this document)
2. **Tasks generated from spec**
3. **Integration test required** before marking complete
4. **Golden recording required** for monologue output
5. **No rescue/ folder** - all decisions in this document

---

## Sign-Off

- **Architect Decision**: Decorator Pattern with `@AnthropicMonologue`
- **Key Features**: History re-injection, configurable system prompts, min/max buffer
- **Rationale**: Follows existing `@Record` pattern, keeps agents thin, clean opt-in
- **Next Step**: Generate tasks from this spec and implement
