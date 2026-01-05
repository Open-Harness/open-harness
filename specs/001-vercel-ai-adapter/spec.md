# Feature Specification: Vercel AI SDK Adapter

**Feature Branch**: `001-vercel-ai-adapter`  
**Created**: 2025-01-05  
**Status**: Draft  
**Input**: User description: "Create a ChatTransport adapter that transforms Open Harness runtime events into Vercel AI SDK UIMessageChunk stream format, enabling seamless integration with useChat hook and AI Elements components"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Chat Integration (Priority: P1)

As a React developer building an AI application, I want to use the standard `useChat()` hook from Vercel AI SDK with my Open Harness flows, so that I can leverage existing AI UI components without writing custom integration code.

**Why this priority**: This is the core value proposition - enabling developers to use familiar AI SDK patterns with Open Harness. Without this, the feature has no value.

**Independent Test**: Can be fully tested by creating a simple React component that uses `useChat()` with the Open Harness transport, sends a message, and receives streaming text responses. Delivers immediate value by proving the integration works.

**Acceptance Scenarios**:

1. **Given** a React app with Open Harness runtime and AI SDK installed, **When** developer uses `useChat({ transport: new OpenHarnessChatTransport(runtime) })`, **Then** the hook initializes without errors and provides standard `messages`, `input`, and `handleSubmit` functions
2. **Given** a connected chat interface, **When** user submits a message, **Then** the message appears in the messages array with role "user" and the runtime receives the message as a command
3. **Given** an Open Harness flow is processing, **When** the flow emits `agent:text:delta` events, **Then** the UI displays streaming text updates in real-time as part of an assistant message
4. **Given** a flow completes successfully, **When** the final `agent:complete` event is emitted, **Then** the assistant message is marked as complete and the UI stops showing loading indicators

---

### User Story 2 - Tool Call Visualization (Priority: P2)

As an end user interacting with an AI agent, I want to see when the agent is using tools and what results it gets, so that I understand what the agent is doing and can trust its responses.

**Why this priority**: Tool transparency is critical for user trust and debugging, but the basic chat must work first. This enhances the P1 experience.

**Independent Test**: Can be tested by creating a flow with tool-using agents, sending a request that triggers tool use, and verifying that tool invocation parts appear in the message with proper state transitions (input-available → output-available).

**Acceptance Scenarios**:

1. **Given** an agent flow with tools configured, **When** the agent decides to use a tool, **Then** a tool invocation part appears in the assistant message showing the tool name and input
2. **Given** a tool is executing, **When** the tool completes, **Then** the tool invocation part updates to show the output result
3. **Given** multiple tools are called sequentially, **When** each tool executes, **Then** each tool appears as a separate part in the message with correct ordering
4. **Given** a tool execution fails, **When** the error occurs, **Then** the tool invocation part shows an error state with a user-friendly error message

---

### User Story 3 - Multi-Step Flow Visibility (Priority: P2)

As an end user, I want to see when the AI system moves between different processing steps, so that I understand the workflow is progressing through multiple stages.

**Why this priority**: Open Harness's multi-node orchestration is a key differentiator. Surfacing this to users provides transparency into complex workflows. Depends on P1 working.

**Independent Test**: Can be tested by creating a multi-node flow (e.g., researcher → summarizer), sending a request, and verifying that step-start parts appear in the message at node boundaries.

**Acceptance Scenarios**:

1. **Given** a multi-node flow is executing, **When** each node starts processing, **Then** a step-start part is added to the assistant message
2. **Given** step boundaries are visible, **When** user views the message, **Then** UI components can render visual separators or labels between steps
3. **Given** a flow with 3+ nodes, **When** the flow executes, **Then** users can see progress through all stages in order

---

### User Story 4 - Extended Thinking Display (Priority: P3)

As an end user, I want to see the AI's reasoning process when it's thinking through complex problems, so that I can understand how it arrived at its conclusions.

**Why this priority**: Enhances transparency and trust but is not essential for basic functionality. Can be added after core chat and tool visualization work.

**Independent Test**: Can be tested by triggering an agent with extended thinking enabled, and verifying that reasoning parts appear in the message with streaming updates.

**Acceptance Scenarios**:

1. **Given** an agent with extended thinking enabled, **When** the agent emits `agent:thinking:delta` events, **Then** reasoning parts appear in the assistant message with streaming text
2. **Given** reasoning content is streaming, **When** the thinking completes, **Then** the reasoning part is marked as done and can be collapsed/expanded in the UI
3. **Given** both thinking and text content, **When** the message renders, **Then** reasoning appears before the final text response

---

### User Story 5 - Flow Metadata Exposure (Priority: P3)

As a developer building advanced UIs, I want access to Open Harness-specific metadata (flow status, node outputs, orchestration events), so that I can build custom visualizations beyond standard chat interfaces.

**Why this priority**: Advanced feature for power users. Not needed for basic chat functionality. Enables custom UI patterns for workflow visualization.

**Independent Test**: Can be tested by subscribing to custom data parts in messages and verifying that flow/node metadata is included when relevant events occur.

**Acceptance Scenarios**:

1. **Given** a flow is executing, **When** nodes complete, **Then** custom data parts with type `data-node-output` contain node ID and output data
2. **Given** flow-level events occur, **When** events like `flow:paused` are emitted, **Then** custom data parts with type `data-flow-status` appear in the message stream
3. **Given** a developer wants to build a flow diagram UI, **When** they access message parts, **Then** they can extract node execution order and status from data parts

---

### Edge Cases

- What happens when a flow is aborted mid-execution? (Transport should emit an error chunk and close the stream gracefully)
- How does the system handle concurrent messages to the same runtime? (Each message should get a unique runId; concurrent execution behavior depends on runtime configuration)
- What happens when the runtime is not started before sending messages? (Transport should return an error chunk indicating the runtime is not ready)
- How are very long streaming responses handled? (Chunks should be emitted incrementally without buffering entire response in memory)
- What happens when a tool call times out? (Tool invocation part should transition to error state with timeout message)
- How does reconnection work if the client disconnects mid-stream? (Initial implementation returns null for reconnection; future enhancement could use RunStore for resume)
- What happens when multiple nodes emit events simultaneously? (Events should be serialized in the order received; message parts maintain temporal ordering)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement the `ChatTransport<UIMessage>` interface from Vercel AI SDK v6
- **FR-002**: System MUST transform `agent:text:delta` events into `text-delta` UIMessageChunk with correct message ID
- **FR-003**: System MUST transform `agent:thinking:delta` events into `reasoning-delta` UIMessageChunk
- **FR-004**: System MUST transform `agent:tool` events into tool invocation parts with states: `input-available` and `output-available`
- **FR-005**: System MUST transform `node:start` events into `step-start` UIMessageChunk to mark multi-step boundaries
- **FR-006**: System MUST maintain message state across multiple event chunks, accumulating parts into a single assistant message
- **FR-007**: System MUST extract the last user message from the messages array and dispatch it to the runtime as a command
- **FR-008**: System MUST return a ReadableStream of UIMessageChunk that can be consumed by AI SDK hooks
- **FR-009**: System MUST handle stream abortion via AbortSignal passed to sendMessages()
- **FR-010**: System MUST generate unique message IDs for assistant responses
- **FR-011**: System MUST emit `text-start` chunk before first `text-delta` and `text-end` chunk after final text
- **FR-012**: System MUST emit `reasoning-start` chunk before first `reasoning-delta` and `reasoning-end` chunk after final reasoning
- **FR-013**: System MUST handle `agent:error` events by emitting error chunks with user-friendly messages
- **FR-014**: System MUST complete the stream when `agent:complete` or `agent:paused` events are received
- **FR-015**: System MUST support optional custom data parts for flow and node metadata (data-flow-status, data-node-output)
- **FR-016**: System MUST work with both new flow execution and message dispatch to running flows
- **FR-017**: System MUST be compatible with React's `useChat()` hook without requiring custom client-side code
- **FR-018**: System MUST preserve event ordering when transforming to chunks
- **FR-019**: System MUST handle tool calls with no output (e.g., tool errors) by setting error state on tool invocation part
- **FR-020**: System MUST support configuration options for enabling/disabling reasoning parts, step markers, and custom data parts

### Key Entities

- **ChatTransport**: The adapter implementation that bridges Open Harness runtime events to AI SDK stream protocol. Responsible for subscribing to runtime events, transforming them to UIMessageChunk, and managing stream lifecycle.

- **UIMessage**: The AI SDK message structure with id, role, and parts array. Represents a complete message in the conversation history.

- **UIMessageChunk**: Streaming delta events that build up UIMessage parts. Includes types like text-delta, reasoning-delta, tool-input-available, step-start, etc.

- **RuntimeEvent**: Open Harness event structure with type, timestamp, nodeId, runId, and event-specific payload. Source of truth for what's happening in the flow.

- **MessageAccumulator**: Internal state machine that tracks current message being built, manages part states (streaming vs done), and handles transitions between event types.

- **ToolInvocationState**: Tracks tool call lifecycle from input-streaming → input-available → output-available or error. Maps Open Harness tool events to AI SDK tool invocation parts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can integrate Open Harness with AI SDK `useChat()` hook in under 10 lines of code
- **SC-002**: Streaming text updates appear in the UI within 100ms of Open Harness emitting `agent:text:delta` events
- **SC-003**: Tool calls are visible in the UI with input and output displayed correctly for 100% of tool executions
- **SC-004**: Multi-step flows show clear visual boundaries between nodes for flows with 2+ nodes
- **SC-005**: The adapter handles flows with 10+ tool calls without memory leaks or performance degradation
- **SC-006**: Error scenarios (aborted flows, tool failures) display user-friendly messages instead of raw errors
- **SC-007**: The adapter works with all standard AI Elements components (Message, Conversation, PromptInput) without customization
- **SC-008**: Developers can build a functional chat UI in under 30 minutes using the adapter and AI Elements
- **SC-009**: Extended thinking content streams in real-time with the same latency as regular text (within 100ms)
- **SC-010**: The adapter correctly handles 100 concurrent message streams without cross-contamination or race conditions
