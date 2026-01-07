# Data Model: Vercel AI SDK Adapter

**Branch**: `001-vercel-ai-adapter` | **Date**: 2025-01-05

## Overview

This document defines the data structures for the Vercel AI SDK adapter. The adapter is a **thin translation layer** that transforms Open Harness runtime events into AI SDK UIMessageChunks. The AI SDK handles all message accumulation internally—we just emit chunks.

---

## Core Entities

### 1. OpenHarnessChatTransport

The main adapter class implementing AI SDK's `ChatTransport` interface.

**Attributes**:

| Attribute | Type | Description |
|-----------|------|-------------|
| `runtime` | `Runtime` | Open Harness runtime instance |
| `options` | `TransportOptions` | Configuration options |

**Relationships**:
- References one `Runtime` instance
- Creates `PartTracker` per stream (minimal state)
- Emits `UIMessageChunk` to stream
- **Does NOT accumulate messages** (AI SDK does this)

---

### 2. TransportOptions

Configuration for transport behavior.

**Attributes**:

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sendReasoning` | `boolean` | No | `true` | Include thinking/reasoning parts |
| `sendStepMarkers` | `boolean` | No | `true` | Include step-start parts for nodes |
| `sendFlowMetadata` | `boolean` | No | `false` | Include custom data parts for flow status |
| `sendNodeOutputs` | `boolean` | No | `false` | Include custom data parts for node outputs |
| `generateMessageId` | `() => string` | No | `crypto.randomUUID` | Custom ID generator |

---

### 3. PartTracker

Minimal state for detecting "first delta" to emit `*-start` chunks.

**Attributes**:

| Attribute | Type | Description |
|-----------|------|-------------|
| `textStarted` | `boolean` | Whether `text-start` has been emitted |
| `reasoningStarted` | `boolean` | Whether `reasoning-start` has been emitted |

**Why this exists**: AI SDK expects `text-start` before any `text-delta`. We only get `agent:text:delta` events (no explicit start). So we track whether we've seen the first delta to emit `text-start` + `text-delta` together.

**This is NOT an accumulator**. The AI SDK accumulates chunks into messages. We just need to know "have I emitted start yet?"

---

## Event to Chunk Mapping

### How Open Harness Events Map to AI SDK Chunks

| Open Harness Event | Meaning | AI SDK Chunk(s) |
|--------------------|---------|-----------------|
| `agent:start` | Agent begins | (no chunk needed) |
| `agent:text:delta` | Streaming text chunk | `text-start` (first only) + `text-delta` |
| `agent:text` | Text complete | `text-end` |
| `agent:thinking:delta` | Streaming thinking | `reasoning-start` (first only) + `reasoning-delta` |
| `agent:thinking` | Thinking complete | `reasoning-end` |
| `agent:tool` | Tool executed (has input+output) | `tool-input-available` + `tool-output-available` |
| `agent:error` | Error occurred | `error` |
| `agent:complete` | Agent finished | Stream closes |
| `agent:paused` | Agent paused | Stream closes |
| `agent:aborted` | Agent aborted | `error` + stream closes |
| `node:start` | Node begins | `step-start` |
| `node:complete` | Node finished | `data-node-output` (optional) |
| `flow:complete` | Flow finished | `data-flow-status` (optional) + stream closes |

### Key Insight: Our Events Already Have Start/End Semantics

We don't need to invent start/end—we already have them:

```
agent:start         → START of agent execution
agent:text:delta    → streaming text (detect "first" for text-start)  
agent:text          → END of text (complete event with final content)
agent:thinking:delta→ streaming thinking (detect "first" for reasoning-start)
agent:thinking      → END of thinking (complete event with final content)
agent:tool          → single event with BOTH input AND output
agent:complete      → END of agent execution
```

---

## Transform Logic

### Text Transform

```
First agent:text:delta  →  [{ type: 'text-start', id }, { type: 'text-delta', id, delta }]
                            (set textStarted = true)
                            
Subsequent agent:text:delta  →  [{ type: 'text-delta', id, delta }]

agent:text (complete)  →  [{ type: 'text-end', id }]
```

### Reasoning Transform

```
First agent:thinking:delta  →  [{ type: 'reasoning-start', id }, { type: 'reasoning-delta', id, delta }]
                               (set reasoningStarted = true)
                               
Subsequent agent:thinking:delta  →  [{ type: 'reasoning-delta', id, delta }]

agent:thinking (complete)  →  [{ type: 'reasoning-end', id }]
```

### Tool Transform

```
agent:tool  →  [
  { type: 'tool-input-available', toolCallId, toolName, input },
  { type: 'tool-output-available', toolCallId, output }
]
```

Note: Open Harness emits a single `agent:tool` event with both input and output (tool has already executed). We emit both chunks together.

---

## Stream Lifecycle

```
sendMessages() called
        │
        ▼
┌───────────────────┐
│  Create stream    │
│  Create PartTracker│
│  Subscribe to     │
│  runtime events   │
└────────┬──────────┘
         │
         │ runtime.dispatch({ type: 'send', message })
         ▼
┌───────────────────┐
│  Transform events │◀──── Runtime events arrive
│  to chunks, emit  │      (pure functions + PartTracker)
└────────┬──────────┘
         │
         │ agent:complete / agent:paused / agent:aborted
         ▼
┌───────────────────┐
│  Close stream     │
│  Unsubscribe      │
└───────────────────┘
```

---

## Validation Rules

### Event Validation

1. Events MUST have a `type` field
2. Agent events MUST have `runId` and `nodeId`
3. Tool events MUST have `toolName`
4. Events without required fields are logged and skipped

### Chunk Ordering

1. `text-start` MUST precede any `text-delta` (handled by PartTracker)
2. `text-end` follows after `agent:text` complete event
3. Same rules apply to reasoning parts

### Message ID

1. Message ID generated once per stream
2. All chunks use the same message ID (where applicable)
3. Tool call IDs derived from `toolName` (unique within message)

---

## Custom Data Types (Optional)

When `sendFlowMetadata` or `sendNodeOutputs` are enabled:

```typescript
type OpenHarnessDataTypes = {
  'flow-status': {
    status: 'running' | 'paused' | 'complete' | 'aborted';
    flowName: string;
  };
  'node-output': {
    nodeId: string;
    runId: string;
    output: unknown;
  };
};
```

These appear as `DataUIPart` in the message:
- `{ type: 'data-flow-status', data: { status: 'paused', flowName: 'my-flow' } }`
- `{ type: 'data-node-output', data: { nodeId: 'summarizer', output: {...} } }`
