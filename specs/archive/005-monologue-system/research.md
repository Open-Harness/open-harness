# Research: Monologue System

**Feature**: 005-monologue-system
**Date**: 2025-12-26
**Status**: Complete

---

## UNKNOWN-1: Decorator Interception Pattern

**Question**: How should the `@Monologue` decorator intercept agent method events?

### Decision: Option (b) - Subscribe to IEventBus with agent-scoped filter

### Rationale

The EventBus is the optimal interception point because:

1. **Infrastructure already exists**: `BaseAnthropicAgent` already publishes all events (tool_call, tool_result, text, thinking) to `IEventBus`. The MonologueService can subscribe with filters for specific agent names and session IDs.

2. **Clean separation of concerns**: The decorator sets up a scoped subscription when the method starts and tears it down when it completes. The MonologueService receives events via the bus, buffers them, and generates narratives independently.

3. **No conflicts with @Record**: The `@Record` decorator wraps method execution at a different layer (recording SDK messages). The `@Monologue` decorator subscribes to EventBus, which receives mapped events from BaseAnthropicAgent. These operate independently.

4. **Testability**: Inject a mock EventBus or a real EventBus with mock MonologueService subscriber. No need to modify agent code or callbacks.

5. **Follows existing patterns**: The codebase already demonstrates EventBus filtering by `agentName` and `sessionId` (see `event-bus.ts` lines 155-183).

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **(a) Wrap callbacks** | More complex than needed. Requires wrapping each callback, preserving original behavior while adding buffering. EventBus approach achieves the same outcome because events are already published there. |
| **(c) Inject wrapper service** | Violates spec: "narrative generation occurs automatically without caller intervention." Requiring agents to call a service defeats the decorator's purpose. |

---

## UNKNOWN-2: Buffer Flush Timing

**Question**: When exactly should the monologue buffer flush?

### Decision: LLM-Driven with Guardrails

### Rationale (Updated after clarification)

The key insight is that **the LLM decides when to narrate**, not mechanical thresholds. The system prompt instructs the LLM on how to behave:

1. **First event**: Always respond (introduce what we're doing)
2. **Subsequent events**: LLM judges relevance - may wait for more context
3. **Final flush**: Always respond (summarize what was accomplished)

The buffer thresholds (min/max) are **guardrails**, not triggers:
- `minBufferSize`: Minimum events before even asking the LLM
- `maxBufferSize`: Force-ask the LLM (memory protection)

### The Flow

```
Event arrives → Add to buffer
                    │
                    ├── If buffer.length < minBufferSize → wait
                    │
                    ├── If buffer.length >= minBufferSize → ask LLM
                    │       │
                    │       ├── LLM responds with narrative → emit, clear buffer
                    │       │
                    │       └── LLM returns "" or "..." → keep buffering
                    │
                    ├── If buffer.length >= maxBufferSize → force LLM response
                    │
                    └── On method completion → final flush, LLM must respond
```

### LLM Decision Logic (via System Prompt)

The system prompt tells the LLM:
- "You're narrating agent work for a human watching a terminal"
- "On first event, always introduce what you're doing"
- "Group related actions - don't narrate every single tool call"
- "Skip trivial events, wait for meaningful work"
- "If you need more context, respond with just '...'"
- "On final flush, summarize what was accomplished"

This makes the LLM the intelligent narrator, not a mechanical summarizer.

### Why This Is Better

| Mechanical Thresholds | LLM-Driven |
|----------------------|------------|
| Narrates at N events regardless of content | Narrates when there's something meaningful to say |
| Same output for trivial vs important work | Skips trivial, elaborates on important |
| No context awareness | Uses history for continuity |
| Predictable but robotic | Natural storytelling flow |

---

## UNKNOWN-3: Concurrent Agent Isolation

**Question**: How to isolate buffer state for concurrent agent instances?

### Decision: Option (c) - Buffer state stored in decorator closure (per-decorated-method)

### Rationale

The decorator closure pattern provides the strongest isolation guarantees with the simplest implementation:

1. **Concurrent Safety**: Multiple agents calling decorated methods in parallel each have independent buffers. No race conditions possible.

2. **Nested Call Safety**: If decorated method A calls decorated method B, each maintains its own scope per spec: "Each decorated method maintains its own scope; nested calls don't interfere."

3. **Automatic Cleanup**: When method execution completes, the closure scope becomes eligible for garbage collection. No manual cleanup needed.

4. **Pattern Consistency**: Matches the existing `@Record` decorator in `core/decorators.ts` which already uses closure-based state.

5. **NeedleDI Compatibility**: Service remains a singleton (correct NeedleDI pattern), but state is scoped per decorator instance rather than per service instance.

### Implementation Structure

```typescript
export function Monologue(scope: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const original = descriptor.value;

    descriptor.value = async function(...args) {
      // Closure-scoped state (isolated per call)
      const eventBuffer: AgentEvent[] = [];
      const narrativeHistory: NarrativeEntry[] = [];

      // Get service from container for LLM calls
      const container = getContainer();
      const service = container.get(IMonologueServiceToken);

      // Subscribe to EventBus for this scope
      const unsubscribe = eventBus.subscribe(
        (event) => eventBuffer.push(event),
        { agentName: scope }
      );

      try {
        return await original.apply(this, args);
      } finally {
        // Final flush and cleanup
        await service.flush(eventBuffer, narrativeHistory);
        unsubscribe();
      }
    };
  };
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **(a) Session-scoped service with agent-keyed map** | Shared mutable state requiring synchronization. Memory leak risk. Violates "context jealousy" principle. |
| **(b) Agent-instance-scoped service** | Breaks NeedleDI singleton pattern. Requires complex factory or child container. Over-engineered. |

---

## UNKNOWN-4: LLM API Pattern

**Question**: Should IMonologueLLM use the existing @anthropic-ai/claude-agent-sdk or direct Anthropic API?

### Decision: Option (a) - Use @anthropic-ai/claude-agent-sdk query()

**Updated**: Implementation evolved during development to use `query()` from claude-agent-sdk.

### Rationale (Updated Post-Implementation)

The `query()` function from claude-agent-sdk proved simpler and more practical:

1. **Authentication**: `query()` automatically uses Claude Code subscription authentication. No API key required, no environment variable setup. This matches how the codebase already works.

2. **Simpler Integration**: The agent-sdk is already a dependency. Using `query()` with `maxTurns: 1` achieves simple completion without adding @anthropic-ai/sdk as a separate dependency.

3. **Consistent Error Handling**: The SDK's query function handles authentication errors, rate limits, and other edge cases consistently with the rest of the codebase.

4. **Practical Simplicity**: While `messages.create()` has a smaller API surface in theory, `query()` with `maxTurns: 1` is equally simple and avoids dual-SDK complexity.

### Implementation (Actual)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

export class AnthropicMonologueLLM implements IMonologueLLM {
  async generate(events: AgentEvent[], history: string[], config: MonologueConfig): Promise<string> {
    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
    let result = "";

    for await (const message of query({
      prompt: fullPrompt,
      options: {
        model: "claude-3-5-haiku-latest",
        maxTurns: 1, // Single turn for simple completion
      },
    })) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "text") {
            result += block.text;
          }
        }
      }
    }

    return result || "...";
  }
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **(a) Use claude-agent-sdk** | Designed for full agent loops with tools. Overhead risks missing <500ms target. More complex API (async generator pattern). |
| **(c) Abstract to allow either** | YAGNI violation. No anticipated need to swap providers. IMonologueLLM interface already provides testability. |

---

## UNKNOWN-5: TaskHarness Migration Strategy

**Question**: How to migrate 30+ `emitNarrative()` calls to decorator-driven generation?

### Decision: Separate Systems - Harness Events vs Agent Narratives

### Rationale (Updated after architectural clarification)

**Key insight: Harness is NOT an agent.** It's an orchestrator. Treating it as an agent that produces "narratives" is a category error.

The correct architecture separates two concepts:

| Concept | Source | Content | API |
|---------|--------|---------|-----|
| **Progress Events** | Harness (orchestrator) | Deterministic status | `emitEvent()` / existing HarnessEvent system |
| **Narratives** | Agents (Parser, Coder, Reviewer) | LLM-synthesized summaries | `@Monologue` decorator |

### Why Separation Matters

1. **Narratives are first-person agent introspection**: "I found the bug and fixed it"
2. **Progress events are third-person status**: "Task 3 of 10 started"
3. **Conflating them confuses users**: "Is the AI talking, or is this a status message?"

### Migration Plan

**Remove "Harness" from NarrativeAgentName**:
- `NarrativeAgentName = "Parser" | "Coder" | "Reviewer" | "Validator"` (no Harness)

**Convert Harness calls to progress events**:
- 10 `emitNarrative("Harness", ...)` → `emitEvent({ type: "harness:status", ... })`
- These are workflow progress, not narratives
- Renderer can display them differently (e.g., dimmed, prefixed with `[Harness]`)

**Delete agent narrative calls from TaskHarness**:
- 14 `emitNarrative("Parser"|"Coder"|"Reviewer", ...)` → deleted
- Agents produce narratives via `@Monologue` decorator instead

**Apply decorators to agents**:
- `@Monologue('parser')` on ParserAgent.parse()
- `@Monologue('coder')` on CodingAgent.execute()
- `@Monologue('reviewer')` on ReviewAgent.validate()

### Verification

After migration:
```bash
# Should return 0 results - no emitNarrative anywhere
grep -n "emitNarrative" task-harness.ts

# Should see harness progress via events
grep -n "emitEvent.*harness:" task-harness.ts
```

### Impact on Spec Requirements

- **FR-011**: ✅ "Replace all manual emitNarrative() calls" → All agent narratives are now decorator-driven
- **SC-007**: ✅ "Zero manual emitNarrative() calls remain" → Harness uses `emitEvent()`, agents use `@Monologue`

The spec's intent was to replace hardcoded agent messages with LLM-generated narratives. Harness status updates were never meant to be "narratives" in the spec's definition.

---

## Summary Table

| Unknown | Decision | Confidence |
|---------|----------|------------|
| UNKNOWN-1: Interception Pattern | Subscribe to IEventBus with agent-scoped filter | High |
| UNKNOWN-2: Buffer Flush Timing | LLM-driven with guardrails (min/max are limits, not triggers) | High |
| UNKNOWN-3: Concurrent Isolation | Buffer state in decorator closure | High |
| UNKNOWN-4: LLM API Pattern | Use @anthropic-ai/sdk directly | High |
| UNKNOWN-5: Migration Strategy | **Separate Systems** - Harness events vs Agent narratives | High |

---

## Dependencies Identified

**New Dependency**: `@anthropic-ai/sdk` (direct Anthropic API for simple completions)

**Existing Dependencies Used**:
- `@needle-di/core` (DI tokens)
- `IEventBus` infrastructure
- `@Record` decorator pattern (reference)
