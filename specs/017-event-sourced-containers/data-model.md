# Data Model: Event-Sourced Container Pause/Resume

**Feature Branch**: `017-event-sourced-containers`
**Date**: 2026-01-03
**Status**: Design Draft

## Validation Notes

*To be validated against source code during implementation.*

| Entity | Validation | Target Location |
|--------|------------|-----------------|
| ExecutionEvent | ❌ To be added | `protocol/execution-events.ts` |
| ContainerFrame | ❌ To be added | `protocol/session.ts` |
| SessionState.containerStack | ❌ To be added | `protocol/session.ts` |
| Hub._eventLog | ❌ To be added | `engine/hub.ts` |
| Hub.checkpoint() | ❌ To be added | `engine/hub.ts` |
| Hub.deriveState() | ❌ To be added | `engine/hub.ts` |
| PauseError | ❌ To be added | `protocol/errors.ts` |

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                            Hub                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  _eventLog   │    │ checkpoint() │    │   deriveState()  │  │
│  │ ExecutionEvent[] │    │  → PauseError │    │ → SessionState  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ derives
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SessionState                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ currentNode  │    │   outputs    │    │  containerStack  │  │
│  │   Index      │    │ Record<>     │    │ ContainerFrame[] │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ contains
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ContainerFrame                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   nodeId     │    │ iterationIdx │    │completedIterations│ │
│  │   string     │    │   number     │    │     Array        │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### ExecutionEvent

**Purpose**: Union type representing all events that occur during flow execution. Events are append-only and form the source of truth for state derivation.

**Location**: `src/protocol/execution-events.ts`

```typescript
export type ExecutionEvent =
  // Flow lifecycle
  | FlowStartedEvent
  | FlowCompletedEvent
  | FlowPausedEvent
  | FlowResumedEvent
  // Node lifecycle
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeErrorEvent
  // Container lifecycle
  | ContainerIterationStartedEvent
  | ContainerIterationCompletedEvent
  | ContainerChildStartedEvent
  | ContainerChildCompletedEvent
  // Loop edge
  | LoopIterateEvent;
```

#### Event Types Detail

| Event Type | Fields | Description |
|------------|--------|-------------|
| `flow:started` | flowName, input, timestamp | Flow execution began |
| `flow:completed` | outputs, timestamp | Flow execution finished successfully |
| `flow:paused` | position, reason?, timestamp | Flow paused (resumable) |
| `flow:resumed` | message, timestamp | Flow resumed from pause |
| `node:started` | nodeId, nodeIndex, input, timestamp | Top-level node began |
| `node:completed` | nodeId, output, timestamp | Top-level node finished |
| `node:error` | nodeId, error, timestamp | Top-level node failed |
| `container:iterationStarted` | nodeId, index, item, timestamp | Container began iteration |
| `container:iterationCompleted` | nodeId, index, outputs, timestamp | Container finished iteration |
| `container:childStarted` | nodeId, childId, childIndex, timestamp | Container began child execution |
| `container:childCompleted` | nodeId, childId, output, timestamp | Container finished child execution |
| `loop:iterate` | edgeFrom, edgeTo, iteration, timestamp | Loop edge triggered |

---

### ContainerFrame

**Purpose**: Represents position and progress within a single container node. Multiple frames form a stack for nested containers.

**Location**: `src/protocol/session.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| nodeId | string | yes | ID of the container node (e.g., "task_loop") |
| iterationIndex | number | yes | Current iteration (0-indexed) |
| totalIterations | number | no | Total items in array (known after first event) |
| currentItem | unknown | no | The item being processed in current iteration |
| childIndex | number | yes | Current child within iteration (0-indexed) |
| completedIterations | CompletedIteration[] | yes | Iterations fully completed before pause |
| partialChildOutputs | Record<string, unknown> | no | Child outputs from current (incomplete) iteration |

#### CompletedIteration

| Field | Type | Description |
|-------|------|-------------|
| index | number | Iteration index |
| item | unknown | The item that was processed |
| outputs | Record<string, unknown> | Outputs from all children in this iteration |

---

### SessionState (Extended)

**Purpose**: Extended from 016-pause-resume to include container stack.

**Location**: `src/protocol/session.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | yes | Unique identifier for this session |
| flowName | string | yes | Name of the flow being executed |
| currentNodeId | string | yes | ID of the node at pause point |
| currentNodeIndex | number | yes | Position in topological order |
| outputs | Record<string, unknown> | yes | Completed top-level node outputs |
| pendingMessages | string[] | yes | Messages to deliver on resume |
| pausedAt | Date | yes | Timestamp when pause occurred |
| pauseReason | string? | no | Optional reason for pause |
| **containerStack** | ContainerFrame[] | yes | **NEW**: Stack of container positions |

**Stack Semantics**:
- Index 0 = outermost container
- Index N-1 = innermost (currently executing) container
- Empty array = paused at top-level node (not inside any container)

---

### PauseError

**Purpose**: Error thrown by `hub.checkpoint()` when abort signal is set. Contains derived state for storage.

**Location**: `src/protocol/errors.ts`

| Field | Type | Description |
|-------|------|-------------|
| name | "PauseError" | Error name for instanceof checks |
| message | string | Human-readable message |
| state | SessionState | Derived state at pause point |

**Usage Pattern**:
```typescript
try {
  hub.checkpoint();
  // Continue execution
} catch (e) {
  if (e instanceof PauseError) {
    // Pause was requested, state is in e.state
    return { __paused: true };
  }
  throw e;  // Re-throw other errors
}
```

---

## Hub Extensions

### New Properties

| Property | Type | Description |
|----------|------|-------------|
| _eventLog | ExecutionEvent[] | Append-only log of execution events |

### New Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| checkpoint | () => void | Check abort signal; if set, derive state and throw PauseError |
| deriveState | () => SessionState | Build current state from event log |
| getEventLog | () => readonly ExecutionEvent[] | Return event log for debugging/replay |
| clearEventLog | () => void | Clear event log (called on fresh start) |

### Modified emit()

```typescript
emit(event: BaseEvent): void {
  // NEW: If this is an ExecutionEvent, append to log
  if (this.isExecutionEvent(event)) {
    this._eventLog.push({ ...event, timestamp: new Date() });
  }

  // EXISTING: Notify subscribers
  const enriched = this.enrich(event);
  for (const handler of this.getMatchingHandlers(event.type)) {
    handler(enriched);
  }
}
```

---

## State Derivation Algorithm

**Invariants**:
- Events are appended in strict execution order (no reordering/batching)
- `deriveState()` throws descriptive error for malformed event sequences
- Same events always produce same state (deterministic)

```typescript
deriveState(): SessionState {
  let currentNodeIndex = 0;
  const outputs: Record<string, unknown> = {};
  const containerStack: ContainerFrame[] = [];

  for (const event of this._eventLog) {
    switch (event.type) {
      case 'node:started':
        currentNodeIndex = event.nodeIndex;
        break;

      case 'node:completed':
        // NOTE: This is for TOP-LEVEL nodes only. Container children emit
        // 'container:childCompleted', not 'node:completed'. When a top-level
        // node completes, any container state is stale (container finished).
        outputs[event.nodeId] = event.output;
        currentNodeIndex++;
        containerStack.length = 0;  // Clear - container is done
        break;

      case 'container:iterationStarted': {
        // Use findLast to handle re-entrant/recursive containers correctly.
        // The most recent frame for a nodeId is the deepest nesting level.
        let frame = containerStack.findLast(f => f.nodeId === event.nodeId);
        if (!frame) {
          frame = {
            nodeId: event.nodeId,
            iterationIndex: event.index,
            currentItem: event.item,
            childIndex: 0,
            completedIterations: [],
            partialChildOutputs: {},
          };
          containerStack.push(frame);
        } else {
          // New iteration in existing container
          frame.iterationIndex = event.index;
          frame.currentItem = event.item;
          frame.childIndex = 0;
          frame.partialChildOutputs = {};
        }
        break;
      }

      case 'container:childStarted': {
        const frame = containerStack.findLast(f => f.nodeId === event.nodeId);
        if (frame) {
          frame.childIndex = event.childIndex;
        }
        break;
      }

      case 'container:childCompleted': {
        const frame = containerStack.findLast(f => f.nodeId === event.nodeId);
        if (frame) {
          frame.partialChildOutputs[event.childId] = event.output;
        }
        // If child was a nested container, remove its frame from stack.
        // NOTE: Intentional mutation - splice removes the nested frame so
        // subsequent events for the parent container work correctly.
        const nestedIdx = containerStack.findIndex(f => f.nodeId === event.childId);
        if (nestedIdx >= 0) {
          containerStack.splice(nestedIdx, 1);
        }
        break;
      }

      case 'container:iterationCompleted': {
        const frame = containerStack.findLast(f => f.nodeId === event.nodeId);
        if (frame) {
          frame.completedIterations.push({
            index: event.index,
            item: frame.currentItem,
            outputs: event.outputs,
          });
          frame.partialChildOutputs = {};
        }
        break;
      }

      case 'loop:iterate':
        // Loop edge events are for observability only. They don't affect
        // containerStack because loop edges operate at the DAG level, not
        // inside container iteration. The executor handles loop edges by
        // jumping back in the node order, which triggers new node:started events.
        break;
    }
  }

  // Determine currentNodeId: for container pause, this is the container's nodeId.
  // For top-level pause, it's the node that was about to execute.
  const lastNodeEvent = this._eventLog.filter(e =>
    e.type === 'node:started' || e.type === 'container:iterationStarted'
  ).pop();

  // currentNodeId reflects WHERE we paused:
  // - If containerStack is non-empty, we're inside a container (use container's nodeId)
  // - If containerStack is empty, we're between top-level nodes
  const currentNodeId = containerStack.length > 0
    ? containerStack[0].nodeId  // Outermost container
    : (lastNodeEvent?.nodeId ?? '');

  return {
    sessionId: this._sessionId,
    flowName: this._flowName,
    currentNodeId,
    currentNodeIndex,
    outputs,
    pendingMessages: [...this._pendingMessages],
    pausedAt: new Date(),
    containerStack,
  };
}
```

---

## Container Resume Logic

When a container receives a `containerResume` frame:

```typescript
// In control.foreach.ts
run: async (ctx, input) => {
  const myFrame = ctx.containerResume;

  // Skip to saved iteration
  const startIteration = myFrame?.iterationIndex ?? 0;

  // Bounds check: if resume frame references invalid position, clamp to valid range
  const safeStartIteration = Math.min(startIteration, input.items.length);

  // Restore completed iterations
  const iterations: CompletedIteration[] = [
    ...(myFrame?.completedIterations ?? [])
  ];

  for (let i = safeStartIteration; i < input.items.length; i++) {
    const item = input.items[i];

    // IMPORTANT: Emit event BEFORE checkpoint. If checkpoint throws PauseError,
    // the iteration started event is already in the log for accurate state derivation.
    ctx.hub.emit({ type: 'container:iterationStarted', nodeId: ctx.nodeId, index: i, item });
    ctx.hub.checkpoint();  // Throws PauseError if aborted

    // Determine child start position (with bounds check)
    const childStart = (i === safeStartIteration && myFrame)
      ? Math.min(myFrame.childIndex, input.body.length)
      : 0;

    // Restore partial outputs from resumed iteration
    const outputs: Record<string, unknown> = (i === safeStartIteration && myFrame)
      ? { ...myFrame.partialChildOutputs }
      : {};

    for (let j = childStart; j < input.body.length; j++) {
      const childId = input.body[j];

      // Emit event BEFORE checkpoint for audit completeness
      ctx.hub.emit({ type: 'container:childStarted', nodeId: ctx.nodeId, childId, childIndex: j });
      ctx.hub.checkpoint();

      // Pass remaining containerStack to nested containers
      const childStack = ctx.containerStack?.slice(1);
      const result = await ctx.executeChild(childId, { [input.as]: item }, childStack);

      ctx.hub.emit({ type: 'container:childCompleted', nodeId: ctx.nodeId, childId, output: result });
      outputs[childId] = result;
    }

    ctx.hub.emit({ type: 'container:iterationCompleted', nodeId: ctx.nodeId, index: i, outputs });
    iterations.push({ item, outputs });
  }

  return { iterations };
}
```

---

## Relationships

| From | To | Cardinality | Relationship |
|------|----|-------------|--------------|
| Hub | ExecutionEvent | 1:N | Hub stores execution events |
| SessionState | ContainerFrame | 1:N | State contains container stack |
| ContainerFrame | CompletedIteration | 1:N | Frame contains completed iterations |
| Hub | SessionState | 1:0..1 | Hub derives state on demand |

---

## Lifecycle

### Event-Sourced Pause Flow

```
1. Container calls hub.checkpoint() before iteration/child
2. Hub checks _abortController.signal.aborted
3. If aborted:
   a. Hub calls deriveState() → SessionState with containerStack
   b. Hub stores state in _pausedSessions
   c. Hub throws PauseError containing state
4. Container catches PauseError, returns early
5. Executor catches return, marks flow as paused
```

### Event-Sourced Resume Flow

```
1. External system calls hub.resume(sessionId, message)
2. Hub retrieves SessionState from _pausedSessions
3. Hub creates new AbortController
4. Hub sets status to "running"
5. Hub emits flow:resumed event
6. Executor reads SessionState.containerStack
7. Executor starts at currentNodeIndex
8. Container receives frame via ctx.containerResume
9. Container skips to iterationIndex, childIndex
10. Execution continues normally
11. On completion, Hub clears _pausedSessions entry
```

---

## Zod Schemas

```typescript
// ContainerFrame schema
const CompletedIterationSchema = z.object({
  index: z.number().int().nonnegative(),
  item: z.unknown(),
  outputs: z.record(z.unknown()),
});

const ContainerFrameSchema = z.object({
  nodeId: z.string().min(1),
  iterationIndex: z.number().int().nonnegative(),
  totalIterations: z.number().int().nonnegative().optional(),
  currentItem: z.unknown().optional(),
  childIndex: z.number().int().nonnegative(),
  completedIterations: z.array(CompletedIterationSchema),
  partialChildOutputs: z.record(z.unknown()).optional(),
});

// Extended SessionState schema
const SessionStateSchema = z.object({
  sessionId: z.string().min(1),
  flowName: z.string().min(1),
  currentNodeId: z.string().min(1),
  currentNodeIndex: z.number().int().nonnegative(),
  outputs: z.record(z.unknown()),
  pendingMessages: z.array(z.string()),
  pausedAt: z.date(),
  pauseReason: z.string().optional(),
  containerStack: z.array(ContainerFrameSchema),  // NEW
});

// Execution event schemas
const ContainerIterationStartedSchema = z.object({
  type: z.literal('container:iterationStarted'),
  nodeId: z.string(),
  index: z.number().int().nonnegative(),
  item: z.unknown(),
  timestamp: z.date(),
});

const ContainerIterationCompletedSchema = z.object({
  type: z.literal('container:iterationCompleted'),
  nodeId: z.string(),
  index: z.number().int().nonnegative(),
  outputs: z.record(z.unknown()),
  timestamp: z.date(),
});

const ContainerChildStartedSchema = z.object({
  type: z.literal('container:childStarted'),
  nodeId: z.string(),
  childId: z.string(),
  childIndex: z.number().int().nonnegative(),
  timestamp: z.date(),
});

const ContainerChildCompletedSchema = z.object({
  type: z.literal('container:childCompleted'),
  nodeId: z.string(),
  childId: z.string(),
  output: z.unknown(),
  timestamp: z.date(),
});

// PauseError schema (for serialization)
const PauseErrorSchema = z.object({
  name: z.literal('PauseError'),
  message: z.string(),
  state: SessionStateSchema,
});
```

---

## Migration from 016-pause-resume

| 016 Entity | 017 Change |
|------------|------------|
| SessionState | Add `containerStack: ContainerFrame[]` field |
| Hub | Add `_eventLog`, `checkpoint()`, `deriveState()`, `getEventLog()` |
| Hub.emit() | Also append ExecutionEvents to _eventLog |
| Executor | No change (already calls hub methods) |
| control.foreach | Add `checkpoint()` calls and resume logic |
| control.loop | Add `checkpoint()` calls and resume logic |

**Backward Compatibility**: Flows without containers work identically. containerStack is empty array for top-level pauses.
