# Feature Specification: Flow Pause/Resume with Session Persistence

**Feature Branch**: `016-pause-resume`
**Created**: 2026-01-02
**Status**: Draft
**Input**: Enable flow execution pause/resume with session persistence. When user calls hub.abort(), executor should stop, return session context. User can then send new message with session ID to resume agent from where it left off with accumulated context.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pause Running Flow (Priority: P1)

As an external system (TUI, API client), I want to pause a running flow so that I can inject additional context before the agent continues.

**Why this priority**: This is the core capability - without pause, there's no resume. Enables human-in-the-loop interaction patterns.

**Independent Test**: Can be fully tested by starting a flow with a long-running agent node, calling abort, and verifying the flow stops and returns session context.

**Acceptance Scenarios**:

1. **Given** a flow is executing with an agent node active, **When** external system calls `hub.abort()`, **Then** the executor stops execution and emits a `flow:paused` event with session context.
2. **Given** a flow is executing, **When** abort is called, **Then** any running agent node receives an abort signal and gracefully stops.
3. **Given** a flow is paused, **When** querying hub status, **Then** status is `paused` (not `aborted` - paused implies resumable).

---

### User Story 2 - Resume Paused Flow (Priority: P1)

As an external system, I want to resume a paused flow with the same session context so that the agent can continue from where it left off.

**Why this priority**: Equal priority with pause - they form an atomic capability pair. Resume without context accumulation is useless.

**Independent Test**: Can be tested by pausing a flow, then calling resume with the session ID. Verify the agent continues from its paused state.

**Acceptance Scenarios**:

1. **Given** a flow is paused with session ID "abc123", **When** external system calls `hub.resume("abc123")`, **Then** the flow resumes execution from the paused node.
2. **Given** a paused flow, **When** resuming, **Then** all accumulated context from before the pause is preserved.
3. **Given** a resumed flow, **When** the agent continues, **Then** the agent has access to all messages sent before the pause.

---

### User Story 3 - Inject Context on Resume (Priority: P1)

As an external system, I want to inject additional context when resuming a paused flow so that the agent receives my new input.

**Why this priority**: This is WHY pause/resume exists - to allow human input mid-execution. Core use case.

**Independent Test**: Pause flow, inject a message, resume, verify agent receives the injected message.

**Acceptance Scenarios**:

1. **Given** a paused flow, **When** external system calls `hub.resume(sessionId, "additional context")`, **Then** the agent receives "additional context" when it resumes.
2. **Given** a resumed agent, **When** agent accesses its message history, **Then** the injected message appears after pre-pause messages.

---

### User Story 4 - Session State Persistence (Priority: P2)

As a developer, I want the session state to be available for inspection so that I can debug paused flows.

**Why this priority**: Important for DX but not core functionality. Flows work without inspection capability.

**Independent Test**: Pause flow, query session state, verify it contains current node, accumulated messages, and execution position.

**Acceptance Scenarios**:

1. **Given** a paused flow, **When** querying session state, **Then** response includes current node ID, phase, and accumulated context.
2. **Given** a paused flow with 3 completed nodes, **When** querying session state, **Then** response includes outputs from those 3 nodes.

---

### Edge Cases

- What happens when resume is called with an invalid session ID? → Error returned, flow remains paused/terminated.
- What happens when resume is called twice? → Second call is no-op if flow is already running.
- What happens when abort is called on an already-paused flow? → Transitions to `aborted` (terminated, not resumable).
- What happens when the flow completes before abort is processed? → Abort is no-op, flow completes normally.
- What happens to pending messages if flow is aborted (not paused)? → Messages are discarded, session is terminated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST emit `flow:paused` event when `hub.abort()` is called with `resumable: true` option.
- **FR-002**: System MUST emit `session:abort` event when `hub.abort()` is called without resumable option (existing behavior).
- **FR-003**: The `flow:paused` event MUST include session ID, current node ID, and accumulated context.
- **FR-004**: System MUST provide `hub.resume(sessionId, message)` method to resume paused flows. Message is required (SDK requires user input to continue).
- **FR-005**: System MUST store session state when flow is paused (current node, outputs, message queue).
- **FR-006**: System MUST restore session state when flow is resumed.
- **FR-007**: Executor MUST check for abort/pause signals between node executions.
- **FR-008**: Executor MUST check for abort/pause signals during agent node execution.
- **FR-009**: Agent nodes MUST receive accumulated messages on resume via existing `session:message` pattern.
- **FR-010**: System MUST transition hub status to `paused` when flow is paused.
- **FR-011**: System MUST transition hub status to `running` when flow is resumed.
- **FR-012**: System MUST reject resume calls with invalid session IDs.
- **FR-013**: SessionContext MUST be used to track pause/resume state (connect existing orphaned code).

### Key Entities

- **SessionState**: Represents a paused flow's state - session ID, current node, outputs collected so far, pending message queue.
- **PauseSignal**: Internal signal to coordinate between hub and executor - carries resumable flag and optional reason.
- **ResumeRequest**: Request to resume a paused flow - session ID plus optional injected message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Flows can be paused and resumed within 100ms overhead (negligible latency impact).
- **SC-002**: External systems can inject messages and receive agent responses in a conversational pattern.
- **SC-003**: All existing tests pass (no regression in non-pause flows).
- **SC-004**: Paused flows can be resumed after arbitrary delay (session state survives in memory).
- **SC-005**: Developers can build TUI/CLI clients that pause for user input without workarounds.

## Assumptions

- Session state is stored in memory (not persisted to disk). Process restart loses paused sessions.
- Only one flow runs per hub instance at a time (no concurrent flow support needed).
- Pause only occurs at node boundaries or during agent execution (not mid-node for non-agent nodes).
- The existing `SessionContext` infrastructure will be connected and used (not reimplemented).
