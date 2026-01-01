# Feature Specification: Transport Architecture

**Feature Branch**: `010-transport-architecture`
**Created**: 2025-12-27
**Status**: Draft
**Input**: Unified transport architecture for harness communication
**Supersedes**: unified-events.md, interactive-sessions.md
**Builds On**: 008-unified-event-system (core implementation)

## Summary

Unify event emission, subscription, and bidirectional communication under a single **Transport** abstraction. The HarnessInstance IS the Transport. Consumers attach via a single `Attachment` interface that receives full bidirectional access.

## Problem Statement

Current design has fragmented concepts:

1. **Unified Event Bus** (008) - internal event infrastructure with AsyncLocalStorage
2. **Interactive Sessions** (ready spec) - bidirectional messaging for HITL workflows
3. **Renderer attachment** - unclear how consumers connect without touching the bus

These are artificially separated. They're all aspects of the same thing: **communication between harness and external consumers**.

### Core Issues

- Consumers must understand multiple concepts (bus, session, renderer)
- No clean attachment API for renderers, metrics, API bridges
- Interactive sessions designed separately from event system
- Categorizing attachments as "renderer" vs "handler" is artificial

## User Scenarios & Testing

### User Story 1 - Fire-and-Forget Execution with Attachments (Priority: P1)

A developer wants to run a harness with multiple attachments (console renderer, metrics collector) without managing event subscriptions directly. They attach components fluently and run the harness to completion.

**Why this priority**: This is the most common use case - running harnesses with visual feedback and telemetry. It must work seamlessly before interactive features.

**Independent Test**: Can be fully tested by attaching a console renderer and metrics collector, running a simple workflow, and verifying all events were captured and displayed correctly.

**Acceptance Scenarios**:

1. **Given** a harness with a defined workflow, **When** I call `.attach(consoleRenderer).attach(metricsCollector).run()`, **Then** both attachments receive all events and cleanup functions are called after completion
2. **Given** an attachment that returns a cleanup function, **When** the harness run completes (success or failure), **Then** the cleanup function is invoked
3. **Given** multiple attachments, **When** running the harness, **Then** all attachments receive events in the same order they were emitted

---

### User Story 2 - Interactive Session with User Prompts (Priority: P2)

A developer wants to build an interactive workflow where the harness can pause and wait for user input. They enable session mode, attach a prompt handler, and the workflow blocks until the user responds.

**Why this priority**: Interactive sessions enable HITL (Human-In-The-Loop) workflows which are critical for approval flows, debugging, and supervised AI operations.

**Independent Test**: Can be tested by starting a session, triggering a `waitForUser()` call from the workflow, sending a reply via `transport.reply()`, and verifying the workflow resumes with the response.

**Acceptance Scenarios**:

1. **Given** a workflow that calls `ctx.session.waitForUser("Continue?")`, **When** I run with `.startSession().complete()`, **Then** execution blocks until `transport.reply()` is called
2. **Given** an attachment that handles `user:prompt` events, **When** a prompt event is emitted, **Then** the attachment receives promptId and can reply through the transport
3. **Given** session mode is NOT enabled (using `run()`), **When** commands are sent via `send()` or `reply()`, **Then** they are silently ignored (no errors thrown)

---

### User Story 3 - WebSocket/SSE Bridge Attachment (Priority: P2)

A developer wants to expose harness events over a WebSocket or Server-Sent Events connection, and receive commands from the remote client. They create a bidirectional bridge attachment.

**Why this priority**: API servers and web UIs need to communicate with harnesses remotely. This enables the full range of deployment scenarios.

**Independent Test**: Can be tested by attaching a mock WebSocket, running a workflow, verifying events are forwarded as JSON, and simulating incoming commands that affect execution.

**Acceptance Scenarios**:

1. **Given** a WebSocket bridge attachment, **When** events are emitted by the harness, **Then** they are serialized and sent through the WebSocket
2. **Given** a WebSocket bridge attachment, **When** the WebSocket receives a message with type "abort", **Then** `transport.abort()` is called
3. **Given** a WebSocket bridge attachment with message injection, **When** the WebSocket receives a "send" message, **Then** the message is injected into the harness via `transport.send()`

---

### User Story 4 - Graceful Abort Handling (Priority: P3)

A developer wants to implement timeout handling or allow users to cancel a running workflow. They call `transport.abort()` and the workflow shuts down gracefully.

**Why this priority**: Abort handling is important for robustness but builds on the core transport functionality.

**Independent Test**: Can be tested by attaching a timeout abort attachment, running a long workflow, verifying it aborts after the timeout, and confirming cleanup happens.

**Acceptance Scenarios**:

1. **Given** a running harness, **When** `transport.abort("Timeout")` is called, **Then** the harness status becomes 'aborted' and execution stops gracefully
2. **Given** a workflow checking `session.isAborted()`, **When** abort is called, **Then** the check returns true and the workflow can handle cleanup
3. **Given** an attachment's cleanup function, **When** abort is called, **Then** all cleanup functions are invoked before the promise resolves

---

### User Story 5 - Conditional Attachment Based on Environment (Priority: P3)

A developer wants to conditionally attach debug logging or metrics collection based on environment variables. They use the fluent API to optionally add attachments.

**Why this priority**: Configuration flexibility is valuable but not critical for core functionality.

**Independent Test**: Can be tested by setting/unsetting environment flags, creating harness instances, and verifying only the expected attachments are active.

**Acceptance Scenarios**:

1. **Given** an instance created without attachments, **When** I call `.attach(renderer)` conditionally, **Then** only attached components receive events
2. **Given** options with `attachments: [...]` array, **When** creating a harness, **Then** those attachments are pre-registered
3. **Given** multiple conditional attachments, **When** none are attached, **Then** the harness runs successfully with no event consumers

---

### Edge Cases

- What happens when an attachment throws an error during event processing? (Assumption: other attachments still receive events - isolation principle)
- How does the system handle `waitForUser()` calls when no attachment replies? (Assumption: configurable timeout, default blocks indefinitely)
- What happens if `attach()` is called after `run()` has started? (Assumption: throws error - attachments must be registered before execution)
- How are commands handled when multiple attachments send conflicting replies? (Assumption: first reply wins, subsequent replies are ignored)
- What happens when `abort()` is called multiple times? (Assumption: idempotent - second call is a no-op)

## Requirements

### Functional Requirements

- **FR-001**: HarnessInstance MUST implement the Transport interface, providing both event subscription and command methods
- **FR-002**: System MUST provide a `subscribe()` method that accepts an optional filter and a listener function
- **FR-003**: System MUST support async iteration over events via `[Symbol.asyncIterator]()`
- **FR-004**: System MUST provide `send(message)` method to inject user messages into execution
- **FR-005**: System MUST provide `sendTo(agent, message)` method to target messages to specific agents
- **FR-006**: System MUST provide `reply(promptId, response)` method to respond to user prompts
- **FR-007**: System MUST provide `abort(reason?)` method to request graceful shutdown
- **FR-008**: System MUST expose `status` property showing current transport state ('idle' | 'running' | 'complete' | 'aborted')
- **FR-009**: System MUST expose `sessionActive` boolean property
- **FR-010**: System MUST provide `attach(attachment)` method accepting `(transport) => cleanup` functions
- **FR-011**: Attachment cleanup functions MUST be called when harness execution completes
- **FR-012**: Commands (`send`, `sendTo`, `reply`) MUST be ignored when session mode is not active
- **FR-013**: System MUST provide `startSession()` method to enable command processing
- **FR-014**: System MUST provide `run()` method for fire-and-forget execution (commands ignored)
- **FR-015**: System MUST provide `complete()` method for interactive session completion
- **FR-016**: ExecuteContext MUST provide optional `session` property when in session mode
- **FR-017**: SessionContext MUST provide `waitForUser(prompt, options?)` that blocks until reply received
- **FR-018**: SessionContext MUST provide `hasMessages()` to check for injected messages (non-blocking)
- **FR-019**: SessionContext MUST provide `readMessages()` to retrieve injected messages
- **FR-020**: SessionContext MUST provide `isAborted()` to check abort status
- **FR-021**: System MUST provide `defineRenderer()` helper that returns an Attachment

### Key Entities

- **Transport**: Bidirectional communication channel interface with event subscription (out) and command methods (in)
- **Attachment**: A function `(transport) => cleanup` that connects to a transport and optionally returns a cleanup function
- **HarnessInstance**: Extended to implement Transport interface directly, eliminating the need for separate transport access
- **SessionContext**: Runtime context available in workflows when session mode is active, providing user interaction methods
- **EnrichedEvent**: Event wrapper containing event data plus context (timestamp, task info, phase info)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Developers can attach a renderer and run a harness with 3 lines of code: `.attach(renderer).run()`
- **SC-002**: All existing tests pass without modification (backward compatible)
- **SC-003**: Interactive prompt round-trip completes in under 100ms latency (excluding user think time)
- **SC-004**: Attachments can process 1000 events per second without backpressure issues
- **SC-005**: 100% of cleanup functions are called on both successful completion and abort scenarios
- **SC-006**: Developers can build a WebSocket bridge attachment without accessing internal bus implementation

## Assumptions

- The 008-unified-event-system implementation provides the internal event bus with AsyncLocalStorage context propagation
- Attachment order does not affect event delivery (all attachments receive events simultaneously)
- If an attachment throws during event processing, other attachments still receive the event (isolation)
- `waitForUser()` has a configurable timeout (default: none, blocks indefinitely)
- Message replay for testing interactive workflows will be handled by recording/playback mechanisms in the test infrastructure
- `attach()` called after `run()` starts will throw an error
- Multiple replies to the same promptId: first wins, subsequent ignored
- `abort()` is idempotent
