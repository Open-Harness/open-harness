# Data Model: Effect Workflow System (core-v2)

**Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This document defines all entities, their fields, relationships, and validation rules.

> **Schema Strategy**: Internal types use @effect/schema (for Effect integration). Consumer-facing schemas (e.g., `outputSchema` in agents) use **Zod** for familiar DX. The runtime converts Zod → JSON Schema for SDK calls.

---

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Workflow                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Handlers │  │  Agents  │  │Renderers │  │  Store   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │                │
│       └─────────────┴─────────────┴─────────────┘                │
│                           │                                      │
│                     ┌─────▼─────┐                                │
│                     │  EventLog │                                │
│                     │  (Events) │                                │
│                     └─────┬─────┘                                │
│                           │                                      │
│                     ┌─────▼─────┐                                │
│                     │   Tape    │                                │
│                     │  (State)  │                                │
│                     └───────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Event

An immutable fact representing something that happened.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

// Base event structure
export const EventId = S.UUID.pipe(S.brand("EventId"));
export type EventId = S.Schema.Type<typeof EventId>;

export const Timestamp = S.DateFromString;

// Generic event factory
export const EventSchema = <Name extends string, P extends S.Schema.Any>(
  name: Name,
  payloadSchema: P
) =>
  S.Struct({
    id: EventId,
    name: S.Literal(name),
    payload: payloadSchema,
    timestamp: Timestamp,
    causedBy: S.optional(EventId),
  });

// Type helper
export type Event<Name extends string, Payload> = {
  readonly id: EventId;
  readonly name: Name;
  readonly payload: Payload;
  readonly timestamp: Date;
  readonly causedBy?: EventId;
};
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `EventId` (UUID) | Yes | Unique identifier, branded type |
| `name` | `string literal` | Yes | Event type (past tense: `task:completed`, present: `text:delta`) |
| `payload` | `P` | Yes | Event-specific data, schema-validated |
| `timestamp` | `Date` | Yes | When the event occurred |
| `causedBy` | `EventId` | No | ID of event that triggered this one |

### Naming Convention

- **Past tense** for facts: `task:completed`, `agent:started`, `tool:called`
- **Present tense** for streaming: `text:delta`, `state:patching`

### Built-in Events

```typescript
// User input event
export const UserInput = EventSchema(
  "user:input",
  S.Struct({
    text: S.String,
    sessionId: S.optional(S.String),
  })
);

// Text streaming delta
export const TextDelta = EventSchema(
  "text:delta",
  S.Struct({
    delta: S.String,
    agentName: S.optional(S.String),
  })
);

// Text stream complete
export const TextComplete = EventSchema(
  "text:complete",
  S.Struct({
    fullText: S.String,
    agentName: S.optional(S.String),
  })
);

// Agent lifecycle
export const AgentStarted = EventSchema(
  "agent:started",
  S.Struct({
    agentName: S.String,
    reason: S.optional(S.String),
  })
);

export const AgentCompleted = EventSchema(
  "agent:completed",
  S.Struct({
    agentName: S.String,
    outcome: S.Literal("success", "failure", "interrupted"),
  })
);

// Tool calls
export const ToolCalled = EventSchema(
  "tool:called",
  S.Struct({
    toolName: S.String,
    toolId: S.String,
    input: S.Unknown,
  })
);

export const ToolResult = EventSchema(
  "tool:result",
  S.Struct({
    toolId: S.String,
    output: S.Unknown,
    isError: S.Boolean,
  })
);

// Error events
export const ErrorOccurred = EventSchema(
  "error:occurred",
  S.Struct({
    code: S.String,
    message: S.String,
    recoverable: S.Boolean,
    context: S.optional(S.Unknown),
  })
);
```

### Invariants

- Events are **immutable** after creation (readonly types enforced by schema)
- `id` is globally unique (UUID v4)
- `timestamp` reflects creation time, not processing time
- `causedBy` forms a DAG (directed acyclic graph) of event causality

---

## 2. State

The workflow's data, computed by applying handlers to the event log.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

// State is a generic record - specific structure defined by workflow
export const State = S.Record({ key: S.String, value: S.Unknown });
export type State = S.Schema.Type<typeof State>;

// State with metadata for tape operations
export const StateSnapshot = S.Struct({
  data: State,
  position: S.Number.pipe(S.int(), S.nonNegative()),
  lastEventId: S.optional(EventId),
});
export type StateSnapshot = S.Schema.Type<typeof StateSnapshot>;
```

### Characteristics

- **Derived**: State is computed, not stored (replay handlers from position 0)
- **Immutable**: Handlers return new state objects, never mutate
- **Typed**: Workflows define their own state schema
- **Snapshottable**: Can capture state at any event position

### Example State Schema

```typescript
// Workflow-specific state
const ChatState = S.Struct({
  messages: S.Array(S.Struct({
    role: S.Literal("user", "assistant"),
    content: S.String,
  })),
  activeAgent: S.optional(S.String),
  toolResults: S.Record({ key: S.String, value: S.Unknown }),
  metadata: S.Struct({
    turnCount: S.Number,
    startedAt: S.DateFromString,
  }),
});
```

---

## 3. Handler

A pure function that reacts to events and produces new state plus new events.

### Type Definition

```typescript
import { Schema as S } from "@effect/schema";

// Handler result type
export const HandlerResult = <S extends S.Schema.Any>(stateSchema: S) =>
  S.Struct({
    state: stateSchema,
    events: S.Array(S.Unknown), // Events to emit
  });

// Handler function signature (not a schema, just a type)
export type Handler<
  E extends Event<string, unknown>,
  S,
> = (event: E, state: S) => HandlerResult<S>;

// Handler definition with metadata
export interface HandlerDefinition<
  E extends Event<string, unknown>,
  S,
> {
  readonly name: string;
  readonly handles: E["name"]; // Event name this handler processes
  readonly handler: Handler<E, S>;
}
```

### Characteristics

- **Pure**: `(event, state) → { state, events[] }`
- **Deterministic**: Same inputs always produce same outputs
- **No I/O**: Cannot call APIs, access filesystem, or perform side effects
- **Single responsibility**: One handler per event type

### Example Handler

```typescript
const handleUserInput: HandlerDefinition<UserInputEvent, ChatState> = {
  name: "user-input-handler",
  handles: "user:input",
  handler: (event, state) => ({
    state: {
      ...state,
      messages: [
        ...state.messages,
        { role: "user", content: event.payload.text },
      ],
      metadata: {
        ...state.metadata,
        turnCount: state.metadata.turnCount + 1,
      },
    },
    events: [], // No new events from this handler
  }),
};
```

---

## 4. Agent

An AI actor that activates on specific events and produces outputs.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

export const AgentDefinition = <S, OutputSchema extends S.Schema.Any>(
  outputSchema?: OutputSchema
) =>
  S.Struct({
    name: S.String,
    activatesOn: S.Array(S.String), // Event names that trigger this agent
    emits: S.Array(S.String), // Event types this agent can produce
    model: S.optional(S.String), // LLM model override
  });

// Runtime agent interface (consumer-facing)
import { z } from "zod";

export interface Agent<S, O> {
  readonly name: string;
  readonly activatesOn: readonly string[];
  readonly emits: readonly string[];
  readonly model?: string;

  // Core methods
  prompt: (state: S, event: Event<string, unknown>) => string | PromptTemplate;
  when?: (state: S) => boolean; // Optional guard condition

  // REQUIRED: Structured output is mandatory for reliable workflow state
  outputSchema: z.ZodType<O>; // Zod schema for LLM output (converted to JSON Schema internally)
  onOutput: (output: O, event: Event<string, unknown>) => Event<string, unknown>[];
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique agent identifier |
| `activatesOn` | `string[]` | Yes | Event names that trigger this agent |
| `emits` | `string[]` | Yes | Event types the agent can produce |
| `model` | `string` | No | LLM model override (default: workflow default) |
| `prompt` | `function` | Yes | Generates LLM prompt from state and event |
| `when` | `function` | No | Guard condition (must return true for activation) |
| `outputSchema` | `z.ZodType` | **Yes** | REQUIRED: Zod schema for structured output - ensures reliable workflow state |
| `onOutput` | `function` | **Yes** | REQUIRED: Transforms LLM output into events |

> **CRITICAL**: Every agent MUST define `outputSchema` and `onOutput`. This is non-negotiable for reliable workflow state. The SDK uses `outputFormat: { type: "json_schema", schema }` to enforce structured responses from the LLM.

### Example Agent

```typescript
import { z } from "zod";

const ResearchOutput = z.object({
  findings: z.array(z.string()),
});

const researchAgent: Agent<ChatState, z.infer<typeof ResearchOutput>> = {
  name: "researcher",
  activatesOn: ["task:research-requested"],
  emits: ["agent:started", "text:delta", "text:complete", "agent:completed"],
  model: "claude-sonnet-4-20250514",

  prompt: (state, event) => `
    You are a research assistant. Based on the conversation:
    ${state.messages.map(m => `${m.role}: ${m.content}`).join("\n")}

    Research the topic: ${event.payload.topic}
  `,

  when: (state) => state.activeAgent === undefined, // Only if no agent active

  // Consumer uses Zod - runtime converts to JSON Schema for SDK
  outputSchema: ResearchOutput,

  onOutput: (output, event) => [
    {
      id: generateEventId(),
      name: "research:completed",
      payload: { findings: output.findings },
      timestamp: new Date(),
      causedBy: event.id,
    },
  ],
};
```

---

## 5. Renderer

A pure observer that transforms events into output without affecting state.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

export const RendererDefinition = S.Struct({
  name: S.String,
  patterns: S.Array(S.String), // Event name patterns (supports wildcards)
});

// Runtime renderer interface
export interface Renderer<Output = void> {
  readonly name: string;
  readonly patterns: readonly string[];
  render: (event: Event<string, unknown>, state: State) => Output;
}

// Pattern matching helper
export type EventPattern = string; // e.g., "error:*", "text:delta", "*:completed"
```

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `"text:delta"` | Exact match |
| `"error:*"` | All error events (`error:occurred`, `error:recovered`, etc.) |
| `"*:completed"` | All completion events (`agent:completed`, `task:completed`, etc.) |
| `"*"` | All events |

### Characteristics

- **Pure observer**: Cannot modify events or state
- **Cannot emit**: Renderers never produce new events
- **Real-time**: Receive events as they flow through the system
- **Independent**: Multiple renderers process events in parallel

### Example Renderer

```typescript
const terminalRenderer: Renderer<void> = {
  name: "terminal",
  patterns: ["text:delta", "error:*", "agent:started"],

  render: (event, state) => {
    switch (event.name) {
      case "text:delta":
        process.stdout.write(event.payload.delta);
        break;
      case "agent:started":
        console.log(`\n[${event.payload.agentName}] Starting...`);
        break;
      default:
        if (event.name.startsWith("error:")) {
          console.error(`ERROR: ${event.payload.message}`);
        }
    }
  },
};
```

---

## 6. Store

Persistence interface for events and sessions.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

export const SessionId = S.String.pipe(S.brand("SessionId"));
export type SessionId = S.Schema.Type<typeof SessionId>;

export const SessionMetadata = S.Struct({
  id: SessionId,
  createdAt: S.DateFromString,
  lastEventAt: S.optional(S.DateFromString),
  eventCount: S.Number.pipe(S.int(), S.nonNegative()),
  workflowName: S.optional(S.String),
});
export type SessionMetadata = S.Schema.Type<typeof SessionMetadata>;
```

### Interface

```typescript
import { Effect, Stream } from "effect";

// Store Service definition (Effect Layer pattern)
export interface Store {
  // Core operations
  readonly append: (
    sessionId: SessionId,
    event: Event<string, unknown>
  ) => Effect.Effect<void, StoreError>;

  readonly events: (
    sessionId: SessionId
  ) => Effect.Effect<readonly Event<string, unknown>[], StoreError>;

  readonly sessions: () => Effect.Effect<readonly SessionMetadata[], StoreError>;

  readonly clear: (
    sessionId: SessionId
  ) => Effect.Effect<void, StoreError>;

  // Optional: State snapshot at position
  readonly snapshot?: (
    sessionId: SessionId,
    position: number
  ) => Effect.Effect<StateSnapshot, StoreError>;
}

// Store error types
export class StoreError {
  readonly _tag = "StoreError";
  constructor(
    readonly code: "NOT_FOUND" | "WRITE_FAILED" | "READ_FAILED" | "CORRUPTED",
    readonly message: string,
    readonly cause?: unknown
  ) {}
}
```

### Implementations

1. **MemoryStore** (default for tests)
   - In-memory Map-based storage
   - No persistence across restarts
   - Fast for unit tests

2. **SqliteStore** (default for production)
   - SQLite-backed persistence
   - JSONL event storage format
   - Session-based partitioning

---

## 7. Tape

A recorded session with VCR-style controls for time-travel debugging.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

export const TapeStatus = S.Literal("idle", "playing", "paused", "recording");
export type TapeStatus = S.Schema.Type<typeof TapeStatus>;

export const TapeMetadata = S.Struct({
  sessionId: SessionId,
  eventCount: S.Number.pipe(S.int(), S.nonNegative()),
  duration: S.optional(S.Number), // milliseconds from first to last event
  status: TapeStatus,
});
```

### Interface

```typescript
// Tape interface (unified for live and replay)
export interface Tape<S = State> {
  // Position control
  readonly position: number; // Current event index (0-based)
  readonly length: number; // Total events

  // Current state
  readonly current: Event<string, unknown> | undefined; // Event at current position
  readonly state: S; // Computed state at current position
  readonly events: readonly Event<string, unknown>[]; // All events

  // Status flags
  readonly isRecording: boolean;
  readonly isReplaying: boolean;
  readonly status: TapeStatus;

  // VCR Controls (return new Tape, immutable)
  rewind: () => Tape<S>; // Go to position 0
  step: () => Tape<S>; // Move forward one event
  stepBack: () => Tape<S>; // Move backward one event (THE key feature)
  stepTo: (position: number) => Tape<S>; // Jump to specific position
  play: () => Promise<Tape<S>>; // Play from current to end
  playTo: (position: number) => Promise<Tape<S>>; // Play to specific position
  pause: () => Tape<S>; // Stop playback

  // Inspection
  stateAt: (position: number) => S; // Compute state at any position
  eventAt: (position: number) => Event<string, unknown> | undefined;
}
```

### State Recomputation

State at any position is computed by:

```typescript
function computeState<S>(
  events: readonly Event<string, unknown>[],
  handlers: Map<string, Handler<Event<string, unknown>, S>>,
  initialState: S,
  toPosition: number
): S {
  let state = initialState;

  for (let i = 0; i <= toPosition && i < events.length; i++) {
    const event = events[i];
    const handler = handlers.get(event.name);
    if (handler) {
      const result = handler(event, state);
      state = result.state;
    }
  }

  return state;
}
```

### Invariants

- `stepBack()` at position 0 stays at position 0
- `step()` at last position stays at last position
- `stepTo(n)` clamps to [0, length - 1]
- State recomputation is deterministic
- Same session replayed 100 times produces identical state at each position

---

## 8. Workflow

The top-level container combining all components.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

export const WorkflowConfig = <StateSchema extends S.Schema.Any>(
  stateSchema: StateSchema
) =>
  S.Struct({
    name: S.String,
    initialState: stateSchema,
    // handlers, agents, renderers are runtime constructs
  });
```

### Interface

```typescript
// Workflow definition (at construction time)
export interface WorkflowDefinition<S> {
  readonly name: string;
  readonly initialState: S;
  readonly handlers: readonly HandlerDefinition<Event<string, unknown>, S>[];
  readonly agents: readonly Agent<S, unknown>[];
  readonly until: (state: S) => boolean; // Termination condition
  readonly store?: Store; // Optional persistence
}

// Runtime workflow (created from definition)
export interface Workflow<S> {
  readonly name: string;

  // Execution
  run: (options: RunOptions) => Promise<WorkflowResult<S>>;

  // Session management
  load: (sessionId: SessionId) => Promise<Tape<S>>;

  // Cleanup
  dispose: () => Promise<void>;
}

// Run options
export interface RunOptions {
  input: string;
  record?: boolean; // Default: false
  sessionId?: SessionId; // Auto-generated if not provided
  renderers?: readonly Renderer[];
}

// Result type
export interface WorkflowResult<S> {
  readonly state: S;
  readonly events: readonly Event<string, unknown>[];
  readonly sessionId: SessionId;
  readonly tape: Tape<S>;
}
```

### Factory Function

```typescript
// Public API (Effect-free)
export function createWorkflow<S>(
  definition: WorkflowDefinition<S>
): Workflow<S>;

// Internal: uses ManagedRuntime for Effect internals
```

---

## 9. Message (React Integration)

AI SDK-compatible message format projected from events.

### Schema Definition

```typescript
import { Schema as S } from "@effect/schema";

export const MessageRole = S.Literal("user", "assistant", "system", "tool");
export type MessageRole = S.Schema.Type<typeof MessageRole>;

export const ToolInvocation = S.Struct({
  toolCallId: S.String,
  toolName: S.String,
  args: S.Unknown,
  result: S.optional(S.Unknown),
  state: S.Literal("pending", "result", "error"),
});
export type ToolInvocation = S.Schema.Type<typeof ToolInvocation>;

export const Message = S.Struct({
  id: S.String,
  role: MessageRole,
  content: S.String,
  name: S.optional(S.String), // Agent name for assistant messages
  toolInvocations: S.optional(S.Array(ToolInvocation)),
  _events: S.Array(EventId), // Source events (internal)
});
export type Message = S.Schema.Type<typeof Message>;
```

### Projection Rules

| Event | Message Action |
|-------|----------------|
| `user:input` | Create `{ role: "user", content: payload.text }` |
| `text:delta` | Append to current assistant message content |
| `text:complete` | Finalize current assistant message |
| `agent:started` | Start new assistant message with `name: payload.agentName` |
| `tool:called` | Add to `toolInvocations[]` with state: "pending" |
| `tool:result` | Update matching tool invocation with result |

### Projection Implementation

```typescript
function projectEventsToMessages(
  events: readonly Event<string, unknown>[]
): Message[] {
  const messages: Message[] = [];
  let currentAssistant: Message | null = null;

  for (const event of events) {
    switch (event.name) {
      case "user:input":
        if (currentAssistant) currentAssistant = null;
        messages.push({
          id: event.id,
          role: "user",
          content: event.payload.text,
          _events: [event.id],
        });
        break;

      case "agent:started":
        currentAssistant = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          name: event.payload.agentName,
          _events: [event.id],
        };
        messages.push(currentAssistant);
        break;

      case "text:delta":
        if (!currentAssistant) {
          currentAssistant = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            _events: [],
          };
          messages.push(currentAssistant);
        }
        currentAssistant.content += event.payload.delta;
        currentAssistant._events.push(event.id);
        break;

      case "text:complete":
        currentAssistant = null;
        break;

      case "tool:called":
        if (currentAssistant) {
          currentAssistant.toolInvocations ??= [];
          currentAssistant.toolInvocations.push({
            toolCallId: event.payload.toolId,
            toolName: event.payload.toolName,
            args: event.payload.input,
            state: "pending",
          });
          currentAssistant._events.push(event.id);
        }
        break;

      case "tool:result":
        if (currentAssistant?.toolInvocations) {
          const invocation = currentAssistant.toolInvocations.find(
            (t) => t.toolCallId === event.payload.toolId
          );
          if (invocation) {
            invocation.result = event.payload.output;
            invocation.state = event.payload.isError ? "error" : "result";
          }
          currentAssistant._events.push(event.id);
        }
        break;
    }
  }

  return messages;
}
```

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Workflow                                    │
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   Store     │◄───│  EventLog   │───►│    Tape     │                  │
│  │ (persist)   │    │  (Events)   │    │ (controls)  │                  │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘                  │
│                            │                   │                         │
│         ┌──────────────────┼───────────────────┤                         │
│         │                  │                   │                         │
│         ▼                  ▼                   ▼                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │  Handlers   │    │   Agents    │    │  Renderers  │                  │
│  │(pure fns)   │    │ (AI actors) │    │ (observers) │                  │
│  └─────────────┘    └──────┬──────┘    └─────────────┘                  │
│         │                  │                                             │
│         │                  ▼                                             │
│         │           ┌─────────────┐                                      │
│         │           │  Provider   │                                      │
│         │           │ (LLM calls) │                                      │
│         │           └─────────────┘                                      │
│         │                                                                │
│         └─────────────────┬──────────────────────────────────────────────┤
│                           ▼                                              │
│                    ┌─────────────┐                                       │
│                    │    State    │◄──── Derived from Events              │
│                    └─────────────┘                                       │
│                           │                                              │
│                           ▼                                              │
│                    ┌─────────────┐                                       │
│                    │  Messages   │◄──── Projected for React              │
│                    └─────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules Summary

| Entity | Key Validations |
|--------|-----------------|
| Event | UUID id, literal name, schema-validated payload, Date timestamp |
| State | Workflow-specific schema, derived not stored |
| Handler | Pure function signature, deterministic |
| Agent | Non-empty activatesOn, prompt + outputSchema + onOutput required |
| Renderer | Non-empty patterns, pure observer |
| Store | Session isolation, append-only events |
| Tape | Position bounds [0, length-1], state consistency |
| Workflow | At least one handler or agent, until function required |
| Message | Valid role, _events traceability |

---

## Sources

- Feature Specification: [spec.md](./spec.md)
- Effect Research: [research.md](./research.md)
- @effect/schema Documentation: https://effect.website/docs/schema/introduction/
