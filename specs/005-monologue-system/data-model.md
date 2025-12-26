# Data Model: Monologue System

**Feature**: 005-monologue-system
**Date**: 2025-12-26

---

## Entity Relationship Diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│  MonologueConfig    │         │    AgentEvent       │
├─────────────────────┤         ├─────────────────────┤
│ minBufferSize: int  │         │ event_type: string  │
│ maxBufferSize: int  │         │ agent_name: string  │
│ historySize: int    │         │ session_id: string  │
│ model: ModelType    │         │ timestamp: number   │
│ systemPrompt?: str  │         │ payload: unknown    │
└─────────────────────┘         └─────────────────────┘
         │                               │
         │ configures                    │ buffered by
         ▼                               ▼
┌─────────────────────────────────────────────────────┐
│                  MonologueService                    │
├─────────────────────────────────────────────────────┤
│ - eventBuffer: AgentEvent[]      (per-scope)        │
│ - narrativeHistory: string[]     (per-scope)        │
│ - config: MonologueConfig                           │
├─────────────────────────────────────────────────────┤
│ + addEvent(event: AgentEvent): void                 │
│ + shouldFlush(): boolean                            │
│ + flush(): Promise<NarrativeEntry | null>           │
│ + getHistory(): string[]                            │
└─────────────────────────────────────────────────────┘
         │                               │
         │ uses                          │ emits
         ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│    IMonologueLLM    │         │   NarrativeEntry    │
├─────────────────────┤         ├─────────────────────┤
│ + generate(         │         │ timestamp: number   │
│     events,         │         │ agentName: string   │
│     history,        │         │ taskId?: string     │
│     config          │         │ text: string        │
│   ): Promise<str>   │         │ metadata?: object   │
└─────────────────────┘         └─────────────────────┘
```

---

## Entities

### MonologueConfig

Configuration for monologue generation behavior.

```typescript
interface MonologueConfig {
  /**
   * Minimum events to buffer before attempting generation.
   * LLM may still return "..." to wait for more context.
   * @default 2
   */
  minBufferSize: number;

  /**
   * Maximum events to buffer before forcing generation.
   * Prevents unbounded memory growth during rapid-fire events.
   * @default 10
   */
  maxBufferSize: number;

  /**
   * Number of previous narratives to include as context.
   * Enables continuity: "Now that I've found X, I'm doing Y"
   * @default 5
   */
  historySize: number;

  /**
   * Model to use for narrative generation.
   * @default "haiku"
   */
  model: "haiku" | "sonnet" | "opus";

  /**
   * Custom system prompt. If omitted, uses DEFAULT_MONOLOGUE_PROMPT.
   * Template variables: {{events}}, {{history}}, {{agentName}}
   */
  systemPrompt?: string;
}
```

**Validation Rules**:
- `minBufferSize >= 1` (must buffer at least one event)
- `maxBufferSize >= minBufferSize` (max can't be less than min)
- `historySize >= 0` (0 disables history context)

**Defaults**:
```typescript
const DEFAULT_CONFIG: MonologueConfig = {
  minBufferSize: 1,  // First event should trigger LLM ask
  maxBufferSize: 10,
  historySize: 5,
  model: "haiku",
};
```

---

### AgentEvent

An event from agent execution, buffered for narrative synthesis.

```typescript
interface AgentEvent {
  /**
   * Event type discriminator.
   * Maps to SDK event types from BaseAnthropicAgent.
   */
  event_type:
    | "tool_call"      // Agent invoked a tool
    | "tool_result"    // Tool returned a result
    | "text"           // Agent generated text
    | "thinking"       // Agent thinking/reasoning
    | "completion";    // Agent finished execution

  /**
   * Name of the agent that produced this event.
   * Used for EventBus filtering and narrative attribution.
   */
  agent_name: string;

  /**
   * Session identifier for isolation.
   * Each TaskHarness run has a unique sessionId.
   */
  session_id: string;

  /**
   * Unix timestamp (milliseconds) when event occurred.
   */
  timestamp: number;

  /**
   * Event-specific payload. Structure depends on event_type.
   */
  payload: AgentEventPayload;
}
```

**Payload Types** (discriminated union):

```typescript
type AgentEventPayload =
  | { type: "tool_call"; tool_name: string; tool_input: unknown }
  | { type: "tool_result"; tool_name: string; result: unknown; error?: string }
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "completion"; summary?: string };
```

---

### NarrativeEntry

Output from narrative generation, emitted via EventBus/callbacks.

```typescript
interface NarrativeEntry {
  /**
   * Unix timestamp (milliseconds) when narrative was generated.
   */
  timestamp: number;

  /**
   * Which agent produced this narrative.
   * Attribution for UI display.
   *
   * NOTE: "Harness" is NOT included. Harness emits progress events,
   * not narratives. Narratives are LLM-generated from agent work.
   */
  agentName: "Parser" | "Coder" | "Reviewer" | "Validator";

  /**
   * Associated task ID, if applicable.
   */
  taskId: string | null;

  /**
   * The human-readable narrative text.
   * First-person, natural language.
   * @example "I found 12 tasks across 3 phases"
   */
  text: string;

  /**
   * Optional metadata about generation.
   */
  metadata?: NarrativeMetadata;
}

interface NarrativeMetadata {
  /** Number of events that were summarized */
  eventCount: number;
  /** Current length of narrative history */
  historyLength: number;
  /** True if this is the final flush at method completion */
  isFinal: boolean;
  /** Model used for generation */
  model: string;
  /** Generation latency in milliseconds */
  latencyMs: number;
}
```

---

### IMonologueLLM

Interface for the LLM client. Allows mock injection for testing.

```typescript
interface IMonologueLLM {
  /**
   * Generate narrative text from buffered events.
   *
   * @param events - Buffered agent events to summarize
   * @param history - Previous narratives for context continuity
   * @param config - Generation configuration
   * @returns Generated narrative text, or "" to continue buffering
   *
   * @example
   * // LLM returns narrative
   * "I read the config file and found the database settings."
   *
   * // LLM signals "wait for more context"
   * "..."
   */
  generate(
    events: AgentEvent[],
    history: string[],
    config: MonologueConfig
  ): Promise<string>;
}
```

**Contract**:
- Returns `""` or `"..."` → continue buffering, don't emit narrative
- Returns any other string → emit as narrative, clear buffer
- Throws on failure → log error, don't emit, but DON'T block agent execution

---

### MonologueService

Core service that buffers events, manages history, and coordinates generation.

```typescript
interface IMonologueService {
  /**
   * Add an event to the buffer.
   * May trigger flush if threshold reached.
   */
  addEvent(event: AgentEvent): Promise<void>;

  /**
   * Check if buffer should flush based on size thresholds.
   */
  shouldFlush(): boolean;

  /**
   * Force buffer flush and generate narrative.
   * Called at method completion.
   *
   * @returns Generated narrative entry, or null if buffer empty/LLM returned wait signal
   */
  flush(): Promise<NarrativeEntry | null>;

  /**
   * Get current narrative history for context.
   */
  getHistory(): string[];

  /**
   * Clear buffer and history. Used for cleanup/testing.
   */
  reset(): void;
}
```

**State Machine**:

```
                ┌──────────────────┐
                │   IDLE           │
                │ (buffer empty)   │
                └────────┬─────────┘
                         │ addEvent()
                         ▼
                ┌──────────────────┐
           ┌────│   BUFFERING      │────┐
           │    │ (buffer.length   │    │
           │    │  < minBufferSize)│    │ buffer.length >= maxBufferSize
           │    └────────┬─────────┘    │
           │             │              │
           │ addEvent()  │ buffer.length >= minBufferSize
           │             ▼              │
           │    ┌──────────────────┐    │
           │    │   READY_TO_FLUSH │◄───┘
           │    │ (can generate)   │
           │    └────────┬─────────┘
           │             │
           │             │ flush() or forced flush
           │             ▼
           │    ┌──────────────────┐
           │    │   GENERATING     │
           │    │ (LLM call)       │
           │    └────────┬─────────┘
           │             │
           │             ├── LLM returns "..." → back to BUFFERING
           │             │
           │             └── LLM returns text → emit NarrativeEntry
           │                                    clear buffer
           │                                    add to history
           └─────────────────────────────────────┘
```

---

## Relationships

| From | To | Relationship | Cardinality |
|------|----|--------------|-------------|
| MonologueService | AgentEvent | buffers | 1:N (0-maxBufferSize) |
| MonologueService | NarrativeEntry | emits | 1:N |
| MonologueService | IMonologueLLM | uses | 1:1 |
| MonologueService | MonologueConfig | configured by | 1:1 |
| MonologueService | IEventBus | subscribes to | 1:1 |
| @Monologue decorator | MonologueService | creates scoped instance | 1:1 per call |
| NarrativeEntry | NarrativeMetadata | contains | 1:0..1 |

---

## DI Token Registry

```typescript
// packages/sdk/src/monologue/tokens.ts

import { InjectionToken } from "@needle-di/core";

/** Token for IMonologueLLM implementation */
export const IMonologueLLMToken = new InjectionToken<IMonologueLLM>("IMonologueLLM");

/** Token for IMonologueService (if needed as singleton) */
export const IMonologueServiceToken = new InjectionToken<IMonologueService>("IMonologueService");

/** Token for default MonologueConfig */
export const IMonologueConfigToken = new InjectionToken<MonologueConfig>("IMonologueConfig");
```

---

## Zod Schemas (Runtime Validation)

```typescript
// packages/sdk/src/monologue/types.ts

import { z } from "zod";

export const MonologueConfigSchema = z.object({
  minBufferSize: z.number().int().min(1).default(2),
  maxBufferSize: z.number().int().min(1).default(10),
  historySize: z.number().int().min(0).default(5),
  model: z.enum(["haiku", "sonnet", "opus"]).default("haiku"),
  systemPrompt: z.string().optional(),
}).refine(
  (data) => data.maxBufferSize >= data.minBufferSize,
  { message: "maxBufferSize must be >= minBufferSize" }
);

export const AgentEventSchema = z.object({
  event_type: z.enum(["tool_call", "tool_result", "text", "thinking", "completion"]),
  agent_name: z.string().min(1),
  session_id: z.string().min(1),
  timestamp: z.number().int().positive(),
  payload: z.unknown(),
});

export const NarrativeEntrySchema = z.object({
  timestamp: z.number().int().positive(),
  agentName: z.enum(["Parser", "Coder", "Reviewer", "Validator"]),
  taskId: z.string().nullable(),
  text: z.string(),
  metadata: z.object({
    eventCount: z.number().int().min(0),
    historyLength: z.number().int().min(0),
    isFinal: z.boolean(),
    model: z.string(),
    latencyMs: z.number().min(0),
  }).optional(),
});
```
