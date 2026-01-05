# Data Model: Vercel AI SDK Adapter

**Branch**: `001-vercel-ai-adapter` | **Date**: 2025-01-05

## Overview

This document defines the data structures and state transitions for the Vercel AI SDK adapter. The adapter transforms Open Harness runtime events into AI SDK UIMessageChunks for streaming to React clients.

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
- Creates `MessageAccumulator` per stream
- Emits `UIMessageChunk` to stream

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

### 3. MessageAccumulator

Internal state machine tracking current message construction.

**Attributes**:

| Attribute | Type | Description |
|-----------|------|-------------|
| `messageId` | `string` | Current assistant message ID |
| `textState` | `'idle' \| 'streaming' \| 'done'` | Text part state |
| `reasoningState` | `'idle' \| 'streaming' \| 'done'` | Reasoning part state |
| `toolStates` | `Map<string, ToolState>` | Tool invocation states by toolCallId |
| `hasEmittedStart` | `boolean` | Whether message has started |

**State Transitions**:

```
Initial → textStreaming → textDone
        → reasoningStreaming → reasoningDone
        → toolStarted → toolComplete
```

---

### 4. ToolState

Tracks individual tool invocation lifecycle.

**Attributes**:

| Attribute | Type | Description |
|-----------|------|-------------|
| `toolCallId` | `string` | Unique tool call identifier |
| `toolName` | `string` | Name of the tool |
| `state` | `'input-available' \| 'output-available' \| 'error'` | Current state |
| `input` | `unknown` | Tool input data |
| `output` | `unknown \| undefined` | Tool output (when complete) |
| `errorText` | `string \| undefined` | Error message (when failed) |

---

## Event to Chunk Mapping

### Input Events (from Open Harness Runtime)

| Event Type | Key Fields | Maps To |
|------------|------------|---------|
| `agent:text:delta` | `content`, `runId` | `text-start`, `text-delta` |
| `agent:text` | `content`, `runId` | `text-end` |
| `agent:thinking:delta` | `content`, `runId` | `reasoning-start`, `reasoning-delta` |
| `agent:thinking` | `content`, `runId` | `reasoning-end` |
| `agent:tool` | `toolName`, `toolInput`, `toolOutput` | `tool-input-available`, `tool-output-available` |
| `agent:error` | `message`, `errorType` | `error` |
| `agent:complete` | `result`, `usage` | Stream close |
| `agent:paused` | `sessionId` | Stream close |
| `agent:aborted` | `reason` | `error`, stream close |
| `node:start` | `nodeId`, `runId` | `step-start` |
| `node:complete` | `nodeId`, `output` | `data-node-output` (optional) |
| `flow:paused` | - | `data-flow-status` (optional) |
| `flow:complete` | `status` | `data-flow-status` (optional), stream close |

### Output Chunks (to AI SDK)

| Chunk Type | Fields | When Emitted |
|------------|--------|--------------|
| `text-start` | `id` | First `agent:text:delta` |
| `text-delta` | `id`, `delta` | Each `agent:text:delta` |
| `text-end` | `id` | After final text or new part type |
| `reasoning-start` | `id` | First `agent:thinking:delta` |
| `reasoning-delta` | `id`, `delta` | Each `agent:thinking:delta` |
| `reasoning-end` | `id` | After final thinking or new part type |
| `tool-input-available` | `toolCallId`, `toolName`, `input` | `agent:tool` with input |
| `tool-output-available` | `toolCallId`, `output` | `agent:tool` with output |
| `step-start` | - | `node:start` |
| `error` | `errorText` | `agent:error`, `agent:aborted` |

---

## State Transitions

### MessageAccumulator State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                        MessageAccumulator                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   agent:text:delta   ┌───────────────┐            │
│  │  idle    │ ─────────────────────▶│ textStreaming │            │
│  └──────────┘                       └───────┬───────┘            │
│       │                                     │                    │
│       │ agent:thinking:delta                │ agent:text/        │
│       │                                     │ new part type      │
│       ▼                                     ▼                    │
│  ┌──────────────────┐              ┌───────────────┐            │
│  │ reasoningStreaming│              │   textDone    │            │
│  └────────┬─────────┘              └───────────────┘            │
│           │                                                      │
│           │ agent:thinking/new part                              │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  reasoningDone   │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│  Tools: Independent state per toolCallId                        │
│  ┌────────────────┐   agent:tool    ┌─────────────────┐         │
│  │ (not started)  │ ───────────────▶│ input-available │         │
│  └────────────────┘                 └────────┬────────┘         │
│                                              │                   │
│                               agent:tool     │                   │
│                               (with output)  │                   │
│                                              ▼                   │
│                                     ┌─────────────────┐         │
│                                     │ output-available│         │
│                                     └─────────────────┘         │
│                                              │                   │
│                               agent:tool     │                   │
│                               (with error)   │                   │
│                                              ▼                   │
│                                     ┌─────────────────┐         │
│                                     │     error       │         │
│                                     └─────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Stream Lifecycle

```
sendMessages() called
        │
        ▼
┌───────────────────┐
│  Create stream    │
│  Subscribe to     │
│  runtime events   │
└────────┬──────────┘
         │
         │ runtime.dispatch({ type: 'send', message })
         ▼
┌───────────────────┐
│  Emit chunks as   │◀──── Runtime events arrive
│  events arrive    │
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

### Stream Validation

1. Stream MUST emit at least one chunk before closing
2. `text-start` MUST precede any `text-delta` for a text part
3. `text-end` MUST follow the final `text-delta` for a text part
4. Same rules apply to reasoning parts

### Message ID Validation

1. Message ID MUST be unique per stream
2. All chunks in a stream MUST use the same message ID (where applicable)
3. Tool call IDs MUST be unique within a message

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
