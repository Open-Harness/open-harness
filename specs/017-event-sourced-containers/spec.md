# Feature Specification: Event-Sourced Container Pause/Resume

**Feature Branch**: `017-event-sourced-containers`
**Created**: 2026-01-03
**Status**: Draft
**Depends On**: 016-pause-resume (completed)
**Input**: Extend pause/resume to work inside container nodes (foreach, loop). Currently pause only works between top-level nodes. A foreach with 200 iterations cannot be paused mid-iteration and resumed from that point.

## Problem Statement

The 016-pause-resume feature enables pausing flows between top-level nodes. However, container nodes (foreach, loop) execute their iterations atomically - the abort signal is not checked during iteration, and there's no state captured for mid-container resumption.

**Current behavior**:
- Foreach with 200 tickets, pause at ticket 47 → All 200 tickets complete, then pause takes effect
- No granular events during container execution
- State only captures top-level node position, not container iteration position

**Desired behavior**:
- Foreach with 200 tickets, pause at ticket 47 → Stops at ticket 47
- Resume continues from ticket 48 (or retry 47 if mid-child)
- Events emitted for each iteration and child execution
- Full observability and audit trail

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pause Inside Foreach (Priority: P1)

As an external system, I want to pause a flow that is executing inside a foreach loop so that execution stops at the current iteration, not after all iterations complete.

**Why this priority**: Core capability gap. Without this, foreach with many iterations cannot be interrupted.

**Independent Test**: Start flow with foreach over 10 items, pause after item 3 starts, verify execution stops at item 3 boundary (not item 10).

**Acceptance Scenarios**:

1. **Given** a flow executing foreach over 100 items, currently on item 47, **When** external system calls `hub.abort({ resumable: true })`, **Then** execution stops before item 48 starts.
2. **Given** a paused foreach at item 47, **When** querying hub state, **Then** state shows `containerStack: [{ nodeId: 'foreach', iterationIndex: 47, ... }]`.
3. **Given** foreach paused mid-iteration (child 1 of 3 complete), **When** resumed, **Then** execution continues from child 2, not from iteration start.

---

### User Story 2 - Resume Inside Foreach (Priority: P1)

As an external system, I want to resume a flow that was paused inside a foreach loop so that execution continues from exactly where it stopped.

**Why this priority**: Without resume capability, pause is useless. They form an atomic pair.

**Independent Test**: Pause foreach at item 47, resume, verify items 48-100 execute (not 1-100).

**Acceptance Scenarios**:

1. **Given** a foreach paused at iteration 47 with 46 completed iterations, **When** resumed, **Then** execution starts at iteration 47, skipping 0-46.
2. **Given** a resumed foreach, **When** checking outputs, **Then** completed iterations from before pause are preserved.
3. **Given** a foreach paused with partial child outputs (child 1 complete), **When** resumed, **Then** child 1 output is preserved and child 2 executes next.

---

### User Story 3 - Nested Container Pause/Resume (Priority: P1)

As an external system, I want to pause/resume flows with nested containers (foreach inside foreach) so that complex multi-level iterations can be interrupted and continued.

**Why this priority**: Real workflows have nested iteration (projects → tasks → subtasks). Essential for production use.

**Independent Test**: Outer foreach over 3 projects, inner foreach over 5 tasks each. Pause at project 2, task 3. Resume and verify execution continues from project 2, task 4.

**Acceptance Scenarios**:

1. **Given** nested foreach (outer=3, inner=5 per outer), paused at outer=1, inner=2, **When** querying state, **Then** containerStack has 2 frames: `[{ nodeId: 'outer', iteration: 1 }, { nodeId: 'inner', iteration: 2 }]`.
2. **Given** nested foreach resumed from above state, **When** execution continues, **Then** completes inner iterations 3-4, then outer iterations 2.
3. **Given** deeply nested containers (3 levels), **When** paused at deepest level, **Then** containerStack correctly represents all 3 levels.

---

### User Story 4 - Event Log for Observability (Priority: P2)

As a developer, I want all container operations to emit events so that I can observe execution progress and debug issues.

**Why this priority**: Important for DX but pause/resume works without it. Can ship P1 features first.

**Independent Test**: Execute foreach over 5 items, collect events, verify events for each iteration start/complete and each child start/complete.

**Acceptance Scenarios**:

1. **Given** a foreach executing, **When** each iteration starts, **Then** `container:iterationStarted` event is emitted with nodeId, index, and item.
2. **Given** a foreach executing, **When** each child completes, **Then** `container:childCompleted` event is emitted with nodeId, childId, and output.
3. **Given** events from a full foreach execution, **When** replayed through `deriveState()`, **Then** result matches actual final state.

---

### Edge Cases

- **Pause during child execution**: If pause fires while a child node is running, what happens?
  → Child completes (atomic), then pause takes effect at next checkpoint.

- **Nested container with loop edge inside**: Foreach contains coder→reviewer loop.
  → Loop iterations are tracked separately; pause can occur between loop iterations.

- **Empty array in foreach**: Foreach over empty array, pause called.
  → Foreach completes immediately (no iterations), pause takes effect after.

- **Resume with modified input**: Can input be changed on resume?
  → No. Original input is preserved. Resume continues with original flow.input.

- **Container inside control.if**: Foreach inside a conditional branch.
  → Works normally. containerStack only includes containers actually entered.

## Requirements *(mandatory)*

### Functional Requirements

**Event Logging**:
- **FR-001**: Hub MUST store execution events in an internal event log, not just emit them.
- **FR-002**: Hub MUST provide `getEventLog()` method returning all stored events.
- **FR-003**: System MUST emit `container:iterationStarted` event when foreach/loop begins an iteration.
- **FR-004**: System MUST emit `container:iterationCompleted` event when foreach/loop completes an iteration.
- **FR-005**: System MUST emit `container:childStarted` event when container begins executing a child node.
- **FR-006**: System MUST emit `container:childCompleted` event when container finishes executing a child node.

**Checkpoint Mechanism**:
- **FR-007**: Hub MUST provide `checkpoint()` method that throws `PauseError` if abort signal is set.
- **FR-008**: Containers MUST call `hub.checkpoint()` before each iteration.
- **FR-009**: Containers MUST call `hub.checkpoint()` before each child execution.
- **FR-010**: When `checkpoint()` throws, current state MUST be derived from event log and stored.

**State Derivation**:
- **FR-011**: Hub MUST provide `deriveState()` method that builds `SessionState` from event log.
- **FR-012**: `deriveState()` MUST produce a `containerStack` array representing nested container positions.
- **FR-013**: `containerStack` MUST include `completedIterations` for each container frame.
- **FR-014**: State derivation MUST be deterministic (same events → same state).

**Resume Logic**:
- **FR-015**: On resume, containers MUST receive their frame from `containerStack`.
- **FR-016**: Containers MUST skip already-completed iterations on resume.
- **FR-017**: Containers MUST restore partial child outputs when resuming mid-iteration.
- **FR-018**: Nested containers MUST receive remaining stack (their frame + descendants).

### Key Entities

- **ExecutionEvent**: Union type of all events emitted during flow execution.
- **ContainerFrame**: Position within a single container (iterationIndex, childIndex, completedIterations).
- **containerStack**: Array of ContainerFrames representing nested container positions.
- **PauseError**: Error thrown by `checkpoint()` to signal pause, contains derived state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Foreach with 100 iterations can be paused within 1 iteration of abort signal (not after all 100).
- **SC-002**: Resumed foreach skips completed iterations (no duplicate work).
- **SC-003**: Nested containers (3 levels deep) pause and resume correctly.
- **SC-004**: Event log enables complete state reconstruction via `deriveState()`.
- **SC-005**: All existing pause/resume tests from 016 continue to pass (no regression).
- **SC-006**: horizon-agent app can pause/resume mid-foreach during multi-ticket processing.

## Assumptions

- Event log is stored in memory (not persisted to disk). Process restart loses event history.
- Containers are responsible for calling `checkpoint()` at appropriate boundaries.
- Events are append-only during execution (no mutation or deletion).
- `deriveState()` is called on demand, not continuously (performance consideration).
- Single Hub instance per flow (no distributed execution).

## Non-Goals

- Disk persistence of event log (future feature).
- Parallel container execution (future feature).
- Mid-child-node pause (children are atomic).
- Event log compaction or pruning.
