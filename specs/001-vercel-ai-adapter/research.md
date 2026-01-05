# Research: Vercel AI SDK Adapter

**Branch**: `001-vercel-ai-adapter` | **Date**: 2025-01-05

## Research Tasks

This document consolidates research findings for all technical decisions in the implementation plan.

---

## 1. AI SDK v6 ChatTransport Interface

**Task**: Research the ChatTransport interface pattern from Vercel AI SDK v6

### Decision

Implement `ChatTransport<UIMessage>` interface from `ai` package v6.0.9.

### Rationale

- AI SDK v6 introduced `ChatTransport` as the official abstraction for custom message delivery
- The interface has only two required methods: `sendMessages()` and `reconnectToStream()`
- Returns `ReadableStream<UIMessageChunk>` which is exactly what we need
- `DirectChatTransport` in the SDK proves this pattern works for in-process agents

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Custom hook wrapping `useChat` | More code, duplicates AI SDK state management |
| SSE endpoint emulating LLM provider | Requires HTTP server, more complex |
| Direct stream manipulation | Bypasses AI SDK accumulation logic |

### Key Findings

From `apps/ui/node_modules/ai/dist/index.d.ts`:

```typescript
interface ChatTransport<UI_MESSAGE extends UIMessage> {
  sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UI_MESSAGE[];
    abortSignal: AbortSignal;
    // ... other options
  }): Promise<ReadableStream<UIMessageChunk>>;

  reconnectToStream(options: { ... }): Promise<ReadableStream<UIMessageChunk> | null>;
}
```

---

## 2. UIMessageChunk Types

**Task**: Document all UIMessageChunk types needed for event transformation

### Decision

Map Open Harness events to these UIMessageChunk types:

| UIMessageChunk Type | Purpose | OH Event Source |
|---------------------|---------|-----------------|
| `text-start` | Begin text streaming | First `agent:text:delta` |
| `text-delta` | Incremental text | Each `agent:text:delta` |
| `text-end` | Complete text part | `agent:complete` or next part |
| `reasoning-start` | Begin thinking | First `agent:thinking:delta` |
| `reasoning-delta` | Incremental reasoning | Each `agent:thinking:delta` |
| `reasoning-end` | Complete reasoning | Thinking ends |
| `tool-input-available` | Tool call with input | `agent:tool` (start) |
| `tool-output-available` | Tool result | `agent:tool` (complete) |
| `step-start` | Multi-step boundary | `node:start` |
| `error` | Error message | `agent:error`, `node:error` |

### Rationale

- These types directly map to Open Harness event semantics
- `step-start` maps perfectly to `node:start` for multi-agent visibility
- AI SDK handles accumulation into `UIMessage.parts` automatically

### Key Findings

From AI SDK source, chunk structure:

```typescript
type UIMessageChunk = 
  | { type: 'text-start'; id: string; providerMetadata?: ProviderMetadata }
  | { type: 'text-delta'; delta: string; id: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'step-start' }
  | { type: 'error'; errorText: string }
  // ... and more
```

---

## 3. UIMessage Parts Architecture

**Task**: Understand how UIMessage accumulates parts from chunks

### Decision

Let AI SDK handle accumulation; transport only emits chunks.

### Rationale

- AI SDK v6 uses parts-based message architecture: `UIMessage.parts: UIMessagePart[]`
- The SDK's internal accumulator converts chunks to parts automatically
- We don't need to maintain message state client-side
- Parts include: `TextUIPart`, `ReasoningUIPart`, `ToolUIPart`, `StepStartUIPart`

### Key Findings

```typescript
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: UIMessagePart[];  // Accumulated from chunks
}

type UIMessagePart = 
  | TextUIPart           // { type: 'text', text, state: 'streaming' | 'done' }
  | ReasoningUIPart      // { type: 'reasoning', text, state }
  | ToolUIPart           // { type: 'tool-{name}', toolCallId, state, input, output }
  | StepStartUIPart      // { type: 'step-start' }
  // ...
```

---

## 4. Tool Invocation State Machine

**Task**: Research AI SDK tool state transitions for mapping

### Decision

Map Open Harness `agent:tool` event to two chunks: `tool-input-available` then `tool-output-available`.

### Rationale

- AI SDK has a full state machine: `input-streaming` → `input-available` → `output-available` | `error`
- Open Harness emits a single `agent:tool` event with both input and output
- We can emit both chunks from one event, or split if we add streaming tool input

### State Mapping

| AI SDK State | OH Event | When |
|--------------|----------|------|
| `input-streaming` | Not used | Future: if we add streaming tool input |
| `input-available` | `agent:tool` | When toolInput is present |
| `output-available` | `agent:tool` | When toolOutput is present |
| `error` | `agent:tool` (error field) | When error is present |

### Key Findings

Tool invocation from AI SDK:

```typescript
type UIToolInvocation<TOOL> = {
  toolCallId: string;
  title?: string;
} & (
  | { state: 'input-streaming'; input: unknown | undefined }
  | { state: 'input-available'; input: unknown }
  | { state: 'output-available'; input: unknown; output: unknown }
  | { state: 'error'; input: unknown; errorText: string }
);
```

---

## 5. Stream Lifecycle Management

**Task**: Research ReadableStream patterns for transport

### Decision

Use `ReadableStream` with async start controller pattern.

### Rationale

- AI SDK expects `Promise<ReadableStream<UIMessageChunk>>`
- Runtime events are async, need to enqueue as they arrive
- Must handle AbortSignal for cancellation
- Stream closes when flow completes or errors

### Implementation Pattern

```typescript
async sendMessages({ messages, abortSignal }): Promise<ReadableStream<UIMessageChunk>> {
  return new ReadableStream({
    start: async (controller) => {
      const unsubscribe = runtime.onEvent((event) => {
        const chunks = transformEvent(event);
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        if (isTerminalEvent(event)) {
          controller.close();
          unsubscribe();
        }
      });
      
      abortSignal?.addEventListener('abort', () => {
        controller.close();
        unsubscribe();
      });
      
      // Dispatch user message to runtime
      runtime.dispatch({ type: 'send', runId, message: lastMessage });
    }
  });
}
```

---

## 6. Custom Data Parts for Flow Metadata

**Task**: Research DataUIPart for exposing OH-specific data

### Decision

Define custom data part types: `data-flow-status`, `data-node-output`.

### Rationale

- AI SDK supports custom data parts via `DataUIPart<DATA_TYPES>`
- Allows advanced UIs to access flow/node metadata
- Optional feature (P3), doesn't affect core chat functionality

### Type Definition

```typescript
type OpenHarnessDataTypes = {
  'flow-status': { status: RuntimeStatus; flowName: string };
  'node-output': { nodeId: string; output: unknown };
};

// Results in parts like:
// { type: 'data-flow-status', data: { status: 'paused', flowName: 'my-flow' } }
// { type: 'data-node-output', data: { nodeId: 'summarizer', output: {...} } }
```

---

## 7. Package Structure Decision

**Task**: Determine where to put the adapter code

### Decision

New package `packages/ai-sdk/` with peer dependency on `@open-harness/sdk`.

### Rationale

- Keeps AI SDK dependency optional for SDK users
- Follows monorepo pattern (packages/*)
- Clean separation of concerns
- Can be published independently

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Add to `packages/sdk/` | Forces AI SDK dependency on all users |
| Add to `apps/ui/` | Not reusable, tied to specific app |
| Separate repo | Overkill for this scope, harder to coordinate |

---

## 8. Testing Strategy

**Task**: Define testing approach for transport

### Decision

Three-tier testing: unit transforms, integration with mock runtime, demo with real runtime.

### Rationale

- Transform functions are pure: `event → chunk[]` - perfect for unit tests
- Accumulator is state machine: can test state transitions
- Transport needs runtime: mock runtime for isolation, real runtime for validation
- Demo page proves full stack works with `useChat()`

### Test Structure

```text
packages/ai-sdk/tests/
├── unit/
│   ├── transforms.test.ts      # Pure function tests
│   └── accumulator.test.ts     # State machine tests
└── integration/
    └── transport.test.ts       # Mock runtime, verify chunks
```

---

## Summary

All technical decisions have been made with clear rationale. No NEEDS CLARIFICATION items remain. Ready for Phase 1 (Design & Contracts).

### Key Decisions

1. **Interface**: Implement `ChatTransport<UIMessage>` from AI SDK v6
2. **Chunks**: Map OH events to standard UIMessageChunk types
3. **Tools**: Emit `input-available` + `output-available` from single `agent:tool`
4. **Steps**: Map `node:start` to `step-start` for multi-agent visibility
5. **Package**: New `packages/ai-sdk/` with peer dependency
6. **Testing**: Unit for transforms, integration with mock runtime
