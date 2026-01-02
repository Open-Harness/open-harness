# Data Model: Flow Pause/Resume with Session Persistence

**Feature Branch**: `016-pause-resume`
**Date**: 2026-01-02
**Status**: Design Complete (Validated against codebase)

## Validation Notes

*Validated against actual source code 2026-01-02.*

| Entity | Validation | Source |
|--------|------------|--------|
| SessionContext | ✅ Exists with AbortController | `protocol/session.ts:10-19` |
| Hub._pausedSessions | ❌ To be added | `engine/hub.ts` |
| HubStatus.paused | ❌ To be added | `protocol/hub.ts` |
| flow:paused event | ❌ To be added | `protocol/events.ts` |
| flow:resumed event | ❌ To be added | `protocol/events.ts` |
| Executor abort checks | ❌ To be added | `flow/executor.ts:336` |

## Entity Overview

```
┌─────────────────┐     owns     ┌──────────────────┐
│      Hub        │─────────────▶│  SessionContext  │
│                 │              │  (per-execution) │
└────────┬────────┘              └──────────────────┘
         │
         │ stores
         ▼
┌─────────────────┐
│ PausedSession   │
│ Map<sessionId,  │
│   SessionState> │
└────────┬────────┘
         │
         │ contains
         ▼
┌─────────────────┐
│  SessionState   │
│ (pause snapshot)│
└─────────────────┘
```

---

## Core Entities

### SessionState

**Purpose**: Captures the complete execution state at pause point, enabling resume from exactly where execution stopped.

**Location**: `src/protocol/flow-runtime.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | yes | Unique identifier for this paused session |
| flowName | string | yes | Name of the flow being executed |
| currentNodeId | string | yes | ID of the node that was executing when pause triggered |
| currentNodeIndex | number | yes | Position in topologically sorted execution order |
| outputs | Record<string, unknown> | yes | Accumulated outputs from completed nodes |
| pendingMessages | string[] | yes | Messages injected while paused, delivered on resume |
| pausedAt | Date | yes | Timestamp when pause occurred |
| pauseReason | string? | no | Optional human-readable reason for pause |

**Validation Rules** (Zod schema):
- sessionId: Non-empty string, matches `session-{uuid8}` pattern
- currentNodeId: Non-empty string
- currentNodeIndex: Non-negative integer
- outputs: Object (no nested validation, values are opaque)
- pendingMessages: Array of strings
- pausedAt: Valid Date
- pauseReason: Optional string

**State Transitions**:
```
(none) ──pause()──▶ stored ──resume()──▶ restored ──complete──▶ (deleted)
                       │
                       └──abort()──▶ (deleted)
```

---

### PauseOptions

**Purpose**: Parameters for the pause operation, distinguishing resumable pause from terminal abort.

**Location**: `src/protocol/hub.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| resumable | boolean | no | If true, emit flow:paused; if false/omitted, emit session:abort |
| reason | string? | no | Human-readable reason for the pause/abort |

**Default Behavior**: If `resumable` is omitted or false, behaves as terminal abort (backward compatibility).

---

### ResumeRequest

**Purpose**: Request to resume a paused session with injected message.

**Location**: `src/protocol/flow-runtime.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | yes | ID of the session to resume |
| message | string | yes | Message to inject before resuming (SDK requires user input to continue) |

**Validation Rules**:
- sessionId: Must match an existing paused session
- message: Required, must be non-empty string

---

## Extended Entities (Modifications)

### Hub (extended)

**Location**: `src/protocol/hub.ts`, `src/engine/hub.ts`

**New Properties**:

| Property | Type | Description |
|----------|------|-------------|
| _pausedSessions | Map<string, SessionState> | Internal storage for paused session states |
| _sessionContext | SessionContext | Current execution's session context (owns AbortController) |

**New Methods**:

| Method | Signature | Description |
|--------|-----------|-------------|
| abort | (options?: PauseOptions) => void | Stop execution; if resumable, store state and emit flow:paused |
| resume | (sessionId: string, message?: string) => void | Resume paused session, optionally injecting message first |
| getAbortSignal | () => AbortSignal | Returns the current session's abort signal for cooperative cancellation |

**Status Extension**:
```typescript
type HubStatus = "idle" | "running" | "paused" | "complete" | "aborted";
//                                     ^^^^^^^^ NEW
```

---

### SessionContext (extended)

**Location**: `src/protocol/session.ts`

**Unchanged Fields**: sessionId, parentSessionId, createdAt, abortController

**New Usage**: Hub creates and owns SessionContext. Executor and agent nodes access abort signal via `hub.getAbortSignal()`.

---

## Event Types (New)

### flow:paused

**Purpose**: Emitted when a resumable pause is requested. Contains session state for external systems.

| Field | Type | Description |
|-------|------|-------------|
| type | "flow:paused" | Event discriminator |
| sessionId | string | Session that was paused |
| nodeId | string | Node that was executing when paused |
| reason | string? | Optional pause reason |

### flow:resumed

**Purpose**: Emitted when a paused session resumes execution.

| Field | Type | Description |
|-------|------|-------------|
| type | "flow:resumed" | Event discriminator |
| sessionId | string | Session that resumed |
| nodeId | string | Node resuming execution |
| injectedMessages | number | Count of messages injected during pause |

---

## Relationships

| From | To | Cardinality | Relationship |
|------|----|-------------|--------------|
| Hub | SessionContext | 1:0..1 | Hub optionally owns one active SessionContext during execution |
| Hub | SessionState | 1:0..N | Hub stores zero or more paused session states |
| SessionState | outputs | 1:1 | SessionState contains outputs from completed nodes |
| SessionState | pendingMessages | 1:N | SessionState queues messages for resume delivery |

---

## Lifecycle

### Pause Flow

```
1. External system calls hub.abort({ resumable: true })
2. Hub triggers SessionContext.abortController.abort()
3. Hub sets status to "paused"
4. Hub emits flow:paused event
5. Executor checks hub.status between nodes/during agent
6. Executor captures current state into SessionState
7. Hub stores SessionState in _pausedSessions Map
8. Executor returns early with partial outputs
```

### Resume Flow

```
1. External system calls hub.resume(sessionId, message?)
2. Hub validates sessionId exists in _pausedSessions
3. If message provided, Hub appends to SessionState.pendingMessages
4. Hub retrieves SessionState from Map
5. Hub creates new SessionContext for resumed execution
6. Hub sets status to "running"
7. Hub emits flow:resumed event
8. Executor restores state from SessionState
9. Executor delivers pendingMessages via session:message pattern
10. Executor resumes from currentNodeIndex
11. On completion, Hub removes SessionState from Map
```

### Abort Flow (terminal)

```
1. External system calls hub.abort() or hub.abort({ resumable: false })
2. Hub triggers SessionContext.abortController.abort()
3. Hub sets status to "aborted"
4. Hub emits session:abort event (existing behavior)
5. If sessionId exists in _pausedSessions, remove it
6. Executor stops, no state preserved
```

---

## Zod Schemas

```typescript
// SessionState schema
const SessionStateSchema = z.object({
  sessionId: z.string().min(1),
  flowName: z.string().min(1),
  currentNodeId: z.string().min(1),
  currentNodeIndex: z.number().int().nonnegative(),
  outputs: z.record(z.unknown()),
  pendingMessages: z.array(z.string()),
  pausedAt: z.date(),
  pauseReason: z.string().optional(),
});

// PauseOptions schema
const PauseOptionsSchema = z.object({
  resumable: z.boolean().optional(),
  reason: z.string().optional(),
});

// ResumeRequest schema
const ResumeRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),  // Required - SDK needs user input to continue
});

// Event schemas
const FlowPausedEventSchema = z.object({
  type: z.literal("flow:paused"),
  sessionId: z.string(),
  nodeId: z.string(),
  reason: z.string().optional(),
});

const FlowResumedEventSchema = z.object({
  type: z.literal("flow:resumed"),
  sessionId: z.string(),
  nodeId: z.string(),
  injectedMessages: z.number().int().nonnegative(),
});
```
