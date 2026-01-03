# Implementation Tasks: Event-Sourced Container Pause/Resume

**Feature Branch**: `017-event-sourced-containers`
**Date**: 2026-01-03
**Status**: Ready for Implementation

## Task Overview

| Phase | Tasks | Est. LOC | Dependencies |
|-------|-------|----------|--------------|
| 1. Types & Schemas | 3 tasks | ~150 | None |
| 2. Hub Extensions | 4 tasks | ~200 | Phase 1 |
| 3. Container Updates | 3 tasks | ~150 | Phase 2 |
| 4. Executor Integration | 2 tasks | ~50 | Phase 3 |
| 5. Tests | 4 tasks | ~400 | Phase 4 |
| **Total** | **16 tasks** | **~950** | |

---

## Phase 1: Types & Schemas

### T001: Create ExecutionEvent types
**File**: `packages/kernel/src/protocol/execution-events.ts` (NEW)
**Priority**: P1
**Depends on**: None

Create the ExecutionEvent union type and individual event interfaces:

```typescript
export type ExecutionEvent =
  | FlowStartedEvent
  | FlowCompletedEvent
  | FlowPausedEvent
  | FlowResumedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeErrorEvent
  | ContainerIterationStartedEvent
  | ContainerIterationCompletedEvent
  | ContainerChildStartedEvent
  | ContainerChildCompletedEvent
  | LoopIterateEvent;
```

**Acceptance**: Types compile, exported from package index.

---

### T002: Create ContainerFrame and extend SessionState
**File**: `packages/kernel/src/protocol/session.ts` (MODIFY)
**Priority**: P1
**Depends on**: None

Add:
- `CompletedIteration` interface
- `ContainerFrame` interface
- `containerStack: ContainerFrame[]` to `SessionState`

**Acceptance**: Types compile, backward compatible (containerStack defaults to []).

---

### T003: Create PauseError class
**File**: `packages/kernel/src/protocol/errors.ts` (MODIFY or NEW)
**Priority**: P1
**Depends on**: T002

Add `PauseError` class:
```typescript
export class PauseError extends Error {
  name = 'PauseError' as const;
  constructor(public state: SessionState, message = 'Flow paused') {
    super(message);
  }
}
```

**Acceptance**: Can throw and catch PauseError, state is accessible.

---

## Phase 2: Hub Extensions

### T004: Add _eventLog to Hub
**File**: `packages/kernel/src/engine/hub.ts` (MODIFY)
**Priority**: P1
**Depends on**: T001

Add private `_eventLog: ExecutionEvent[]` property.
Initialize to `[]` in constructor.
Add `clearEventLog()` method.

**Acceptance**: eventLog property exists, clearEventLog works.

---

### T005: Modify emit() to store ExecutionEvents
**File**: `packages/kernel/src/engine/hub.ts` (MODIFY)
**Priority**: P1
**Depends on**: T004

Modify `emit()`:
```typescript
emit(event: BaseEvent): void {
  // NEW: Store if ExecutionEvent
  if (this.isExecutionEvent(event)) {
    this._eventLog.push({ ...event, timestamp: new Date() } as ExecutionEvent);
  }
  // ... existing subscriber notification
}

private isExecutionEvent(event: BaseEvent): boolean {
  return [
    'flow:started', 'flow:completed', 'flow:paused', 'flow:resumed',
    'node:started', 'node:completed', 'node:error',
    'container:iterationStarted', 'container:iterationCompleted',
    'container:childStarted', 'container:childCompleted',
    'loop:iterate'
  ].includes(event.type);
}
```

**Acceptance**: Execution events appear in _eventLog after emit().

---

### T006: Implement deriveState()
**File**: `packages/kernel/src/engine/hub.ts` (MODIFY)
**Priority**: P1
**Depends on**: T005

Implement state derivation algorithm from data-model.md.
Must produce correct containerStack for:
- Empty (no containers)
- Single container
- Nested containers (2+ levels)

**Acceptance**: deriveState() produces correct SessionState for various event sequences.

---

### T007: Implement checkpoint()
**File**: `packages/kernel/src/engine/hub.ts` (MODIFY)
**Priority**: P1
**Depends on**: T006, T003

```typescript
checkpoint(): void {
  if (this._abortController.signal.aborted) {
    const state = this.deriveState();
    this._pausedSessions.set(this._sessionId, state);
    this._status = 'paused';
    this.emit({ type: 'flow:paused', sessionId: this._sessionId, position: state });
    throw new PauseError(state);
  }
}
```

**Acceptance**: checkpoint() throws PauseError when aborted, stores state.

---

## Phase 3: Container Updates

### T008: Update control.foreach with checkpoint() and events
**File**: `packages/kernel/src/flow/nodes/control.foreach.ts` (MODIFY)
**Priority**: P1
**Depends on**: T007

Changes:
1. Call `hub.checkpoint()` before each iteration
2. Call `hub.checkpoint()` before each child
3. Emit `container:iterationStarted`, `container:childStarted`, etc.
4. Catch PauseError and return early

**Acceptance**: Foreach pauses at checkpoint(), events emitted correctly.

---

### T009: Update control.foreach with resume logic
**File**: `packages/kernel/src/flow/nodes/control.foreach.ts` (MODIFY)
**Priority**: P1
**Depends on**: T008

Changes:
1. Accept `containerResume?: ContainerFrame` in context
2. Skip to `iterationIndex` on resume
3. Restore `completedIterations` on resume
4. Start at `childIndex` within resumed iteration
5. Restore `partialChildOutputs` on resume

**Acceptance**: Foreach resumes from correct position, no duplicate iterations.

---

### T010: Update control.loop with checkpoint() and resume
**File**: `packages/kernel/src/flow/nodes/control.loop.ts` (MODIFY)
**Priority**: P2
**Depends on**: T007

Same pattern as T008 + T009 for loop node.

**Acceptance**: Loop pauses and resumes correctly.

---

## Phase 4: Executor Integration

### T011: Pass containerStack to containers
**File**: `packages/kernel/src/flow/executor.ts` (MODIFY)
**Priority**: P1
**Depends on**: T009

When running a container node:
1. Get resumption state from hub
2. Find frame for this container
3. Pass remaining stack to children via executeChild

**Acceptance**: Containers receive correct containerResume frame.

---

### T012: Handle PauseError in executor
**File**: `packages/kernel/src/flow/executor.ts` (MODIFY)
**Priority**: P1
**Depends on**: T011

In node execution loop:
1. Catch PauseError from runNode
2. Return early with paused status
3. (State already stored by checkpoint())

**Acceptance**: Executor exits cleanly on PauseError.

---

## Phase 5: Tests

### T013: Unit tests for deriveState()
**File**: `packages/kernel/tests/unit/derive-state.test.ts` (NEW)
**Priority**: P1
**Depends on**: T006

Test cases:
- Empty event log → empty containerStack
- Events for 1 container → 1-frame stack
- Events for nested containers → multi-frame stack
- Events with completed iterations → correct completedIterations
- Determinism: same events → same state

**Acceptance**: All test cases pass.

---

### T014: Unit tests for checkpoint()
**File**: `packages/kernel/tests/unit/checkpoint.test.ts` (NEW)
**Priority**: P1
**Depends on**: T007

Test cases:
- checkpoint() with no abort → returns normally
- checkpoint() with abort → throws PauseError
- PauseError contains correct state
- State is stored in _pausedSessions

**Acceptance**: All test cases pass.

---

### T015: Integration tests for foreach pause/resume
**File**: `packages/kernel/tests/unit/foreach-pause-resume.test.ts` (NEW)
**Priority**: P1
**Depends on**: T009

Test cases:
- Pause at iteration 0 → state shows iteration 0
- Pause at iteration 5 of 10 → resume skips 0-4
- Pause mid-iteration (child 1 of 3) → resume at child 2
- Nested foreach pause/resume
- Empty array foreach + pause

**Acceptance**: All test cases pass.

---

### T016: E2E test with horizon-agent
**File**: `apps/horizon-agent/tests/pause-resume-foreach.test.ts` (NEW)
**Priority**: P2
**Depends on**: T015

Test:
- Start flow with foreach over 5 items
- Pause after item 2
- Resume with message
- Verify items 3-5 execute
- Verify events in log

**Acceptance**: E2E test passes with real foreach execution.

---

## Verification Gates

### After Phase 2 (T007 complete)
Run existing pause/resume tests:
```bash
bun test tests/unit/pause-resume.test.ts
bun test tests/replay/pause-resume.test.ts
```
**Gate**: All existing tests pass (no regression).

### After Phase 4 (T012 complete)
Run full test suite:
```bash
bun test
```
**Gate**: All tests pass.

### After Phase 5 (All tests)
Run with coverage:
```bash
bun test --coverage
```
**Gate**: New code has >80% coverage.

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `protocol/execution-events.ts` | NEW | 1 |
| `protocol/session.ts` | MODIFY | 1 |
| `protocol/errors.ts` | MODIFY | 1 |
| `engine/hub.ts` | MODIFY | 2 |
| `flow/nodes/control.foreach.ts` | MODIFY | 3 |
| `flow/nodes/control.loop.ts` | MODIFY | 3 |
| `flow/executor.ts` | MODIFY | 4 |
| `tests/unit/derive-state.test.ts` | NEW | 5 |
| `tests/unit/checkpoint.test.ts` | NEW | 5 |
| `tests/unit/foreach-pause-resume.test.ts` | NEW | 5 |
| `apps/horizon-agent/tests/pause-resume-foreach.test.ts` | NEW | 5 |
