# Quickstart: Monologue System

**Feature**: 005-monologue-system

---

## Overview

The monologue system generates human-readable, first-person narratives from agent work. Instead of seeing raw tool calls in the terminal, users see natural language updates like "I'm reading the config file..." or "Found the bug, fixing it now."

## Key Concepts

### Narrative vs Progress Events

| Concept | Example | Source |
|---------|---------|--------|
| **Narrative** | "I found 12 tasks across 3 phases" | LLM-generated via `@Monologue` |
| **Progress Event** | "Task 3 of 10 started" | Harness via `emitEvent()` |

Narratives are first-person agent introspection. Progress events are third-person orchestration status.

### The LLM is the Narrator

The monologue LLM (Haiku) decides:
- **When** to narrate (vs wait for more context)
- **What** to say (summarizing tool calls into human language)
- **How** to maintain continuity (using narrative history)

The system prompt guides these decisions. Buffer thresholds (min/max) are guardrails, not triggers.

---

## Basic Usage

### 1. Decorate Agent Methods

```typescript
import { Monologue } from "@dao-spec-kit/sdk/monologue";

class ParserAgent {
  @Monologue("Parser")
  async parse(input: ParserInput): Promise<ParserOutput> {
    // Agent does work (tool calls, etc.)
    // Monologue system intercepts events, buffers them, generates narratives
    return result;
  }
}
```

### 2. Subscribe to Narratives

```typescript
import { IEventBusToken } from "@dao-spec-kit/sdk/core/tokens";

const eventBus = container.get(IEventBusToken);

eventBus.subscribe(
  (event) => {
    if (event.event_type === "narrative") {
      console.log(`[${event.agent_name}] ${event.text}`);
    }
  },
  { eventTypes: ["narrative"] }
);
```

### 3. Configure (Optional)

```typescript
@Monologue("Parser", {
  minBufferSize: 2,   // Wait for at least 2 events before asking LLM
  maxBufferSize: 10,  // Force LLM response at 10 events
  historySize: 5,     // Include last 5 narratives for context
  model: "haiku",     // Fast, cheap model for inline generation
})
async parse(input: ParserInput): Promise<ParserOutput> {
  // ...
}
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Method                              │
│  @Monologue("Parser")                                           │
│  async parse() {                                                │
│    // Tool calls, LLM responses, etc.                           │
│  }                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EventBus Subscription                        │
│  Filters events by agent_name: "Parser"                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MonologueService (per-scope)                   │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ Event Buffer │  │ History       │  │ Config               │ │
│  │ [e1, e2, e3] │  │ ["I read..."] │  │ minBuffer: 1         │ │
│  └──────────────┘  └───────────────┘  └──────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │  Buffer >= minBufferSize?            │
         │  OR first event?                     │
         │  OR method completing?               │
         └──────────────────┬──────────────────┘
                            │ yes
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      IMonologueLLM (Haiku)                       │
│  System Prompt:                                                 │
│  "You're narrating agent work for a human watching a terminal.  │
│   On first event, introduce what you're doing.                  │
│   Group related actions. Skip trivial events.                   │
│   If you need more context, respond with '...'                  │
│   On final flush, summarize what was accomplished."             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │  LLM returns narrative?              │
         └──────────────────┬──────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │ "..."                     │ "I found the config..."
              ▼                           ▼
       Keep buffering              Emit NarrativeEntry
                                   Clear buffer
                                   Add to history
```

---

## Testing

### Mock the LLM

```typescript
import { IMonologueLLMToken } from "@dao-spec-kit/sdk/monologue/tokens";

class MockMonologueLLM implements IMonologueLLM {
  async generate(
    events: AgentEvent[],
    history: string[],
    config: MonologueConfig,
    isFirst: boolean,
    isFinal: boolean
  ): Promise<string> {
    if (isFinal) return "Mock: Task completed successfully";
    if (isFirst) return "Mock: Starting work";
    return "..."; // Wait for more context
  }
}

// Bind in test container
container.bind({
  provide: IMonologueLLMToken,
  useValue: new MockMonologueLLM(),
});
```

### Verify Narratives

```typescript
import { test, expect } from "bun:test";

test("parser emits narratives", async () => {
  const narratives: NarrativeEntry[] = [];

  eventBus.subscribe((event) => {
    if (event.event_type === "narrative") {
      narratives.push(event);
    }
  });

  await parser.parse(input);

  expect(narratives.length).toBeGreaterThan(0);
  expect(narratives[0].agentName).toBe("Parser");
  expect(narratives[0].text).toContain("Mock:");
});
```

---

## Common Patterns

### Custom System Prompt

```typescript
const VERBOSE_PROMPT = `You are {{agentName}}, explaining your work to a junior developer.
Explain what you're doing and WHY in 2-3 sentences.
Include reasoning and decisions you made.`;

@Monologue("Coder", { systemPrompt: VERBOSE_PROMPT })
async execute() { ... }
```

### Disable for Specific Methods

Don't use the decorator - the method won't emit narratives.

### Multiple Agents in Sequence

Each agent has isolated buffer state. Narratives don't cross-contaminate.

```typescript
await parser.parse(input);    // Parser narratives
await coder.execute(tasks);   // Coder narratives (separate buffer)
await reviewer.validate();    // Reviewer narratives (separate buffer)
```

---

## Integration with TaskHarness

TaskHarness is the orchestrator. It emits **progress events**, not narratives.

```typescript
// Harness emits progress (not narrative)
this.emitEvent({ type: "harness:status", message: "Phase 2 started" });

// Agents emit narratives (via decorator)
@Monologue("Parser")
async parse() { ... }
```

Renderers can display both, with visual distinction:
- **Progress**: `[Harness] Phase 2 started`
- **Narrative**: `[Parser] I found 12 tasks and detected a dependency cycle...`
