# Feature Specification: Harness Renderer Integration

**Feature Branch**: `003-harness-renderer`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "Integrate SDK monologue system with harness-renderer for task narrative visualization"

## Overview

This feature integrates the SDK's `@AnthropicMonologue` decorator system with the harness-renderer architecture. The monologue system generates human-readable first-person summaries of agent actions, while the harness-renderer provides pluggable terminal visualization. Together, they enable users to watch agent progress in real-time through narrative text instead of verbose tool call logs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-time Narrative Streaming (Priority: P1)

As a developer running task execution, I want to see human-readable narrative updates in my terminal so that I can understand what agents are doing without deciphering technical tool call logs.

**Why this priority**: This is the core value proposition - transforming opaque agent internals into readable progress updates. Without this, users have no visibility into agent behavior during execution.

**Independent Test**: Can be fully tested by running a single task with monologue enabled and verifying narrative text appears in the terminal renderer. Delivers immediate visibility into agent work.

**Acceptance Scenarios**:

1. **Given** a task is executing with the `@AnthropicMonologue` decorator, **When** the agent performs actions, **Then** human-readable narrative text streams to the terminal renderer in real-time.
2. **Given** the monologue system generates a narrative entry, **When** the entry is emitted, **Then** it appears in the renderer within the next screen refresh cycle.
3. **Given** an agent is working on a task, **When** narrative entries are generated, **Then** they are displayed with the originating agent name (Coder, Reviewer, Parser, or Harness).

---

### User Story 2 - Narrative History Context (Priority: P2)

As a developer reviewing execution, I want narratives to maintain context between updates so that the story flows naturally without repetition or lost information.

**Why this priority**: Narrative continuity improves comprehension. Disjointed or repetitive updates degrade the user experience, making it harder to follow agent progress.

**Independent Test**: Can be tested by executing a multi-step task and verifying that subsequent narratives reference or build upon previous ones without repeating the same information.

**Acceptance Scenarios**:

1. **Given** an agent has generated previous narratives, **When** a new narrative is generated, **Then** the new narrative references the prior context appropriately (e.g., "I found the issue I was looking for" not "I searched for files").
2. **Given** multiple narratives have been generated for a task, **When** reviewing the narrative history, **Then** the narratives form a coherent story of the agent's work.

---

### User Story 3 - Configurable Narrative Verbosity (Priority: P2)

As a developer, I want to control how frequently narratives are generated so that I can balance between detailed updates and reduced noise.

**Why this priority**: Different use cases require different verbosity levels. Debugging benefits from detailed updates while demos prefer concise summaries.

**Independent Test**: Can be tested by running the same task with different buffer configuration and observing different narrative frequencies.

**Acceptance Scenarios**:

1. **Given** a task is executing with default configuration (minBufferSize=2), **When** events buffer up, **Then** narratives are generated based on LLM judgment (the prompt may return empty to wait for more context).
2. **Given** a task is configured for high-frequency updates, **When** events occur, **Then** narratives are generated more frequently.
3. **Given** a task is configured for batched updates, **When** multiple events occur, **Then** narratives summarize batches of actions.

---

### User Story 4 - Multiple Renderer Support (Priority: P3)

As a developer, I want to switch between different renderers (simple console, rich listr2) so that I can choose the visualization style that fits my needs.

**Why this priority**: Flexibility in output format supports different environments (CI/CD, local development, demos) and user preferences.

**Independent Test**: Can be tested by running the same task execution with different renderer selections and observing appropriate output format.

**Acceptance Scenarios**:

1. **Given** a harness is configured with the simple console renderer, **When** narratives are emitted, **Then** they appear as plain text with ANSI colors.
2. **Given** a harness is configured with the listr2 renderer, **When** narratives are emitted, **Then** they appear within the rich terminal UI with spinners and nested task display.
3. **Given** a custom renderer is provided, **When** narratives are emitted, **Then** the custom renderer receives the narrative events.

---

### User Story 5 - Replay Mode Visualization (Priority: P3)

As a developer reviewing a recorded session, I want to see narratives play back with appropriate timing so that I can understand the execution flow.

**Why this priority**: Session replay enables debugging, demos, and review of past executions. Timing context helps understand agent pacing.

**Independent Test**: Can be tested by recording a session and replaying it, verifying narratives appear with timing that reflects the original execution.

**Acceptance Scenarios**:

1. **Given** a recorded session with narratives, **When** replaying with real-time speed, **Then** narratives appear at the same relative timing as the original execution.
2. **Given** a recorded session, **When** replaying with instant mode, **Then** all narratives appear immediately without delays.
3. **Given** a recorded session, **When** replaying, **Then** the renderer displays a visual indicator that this is a replay.

---

### Edge Cases

- What happens when the monologue system returns an empty response (indicating "wait for more events")?
  - The renderer should not display anything; buffering continues until a non-empty narrative is generated.
- How does the system handle rapid-fire events that could overwhelm the renderer?
  - The monologue system's min/max buffer thresholds prevent excessive generation; the renderer receives a controlled stream.
- What happens when an agent task fails before generating any narratives?
  - The renderer displays the task failure without narrative; the failure record provides context.
- What happens when the monologue LLM call fails?
  - The error is logged but does not interrupt task execution; the task continues without that narrative entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST convert `onMonologue` callback invocations from the `@AnthropicMonologue` decorator into `task:narrative` events for the renderer.
- **FR-002**: System MUST include agent name, task ID, timestamp, and narrative text in each narrative event.
- **FR-003**: System MUST support both synchronous and asynchronous renderer implementations.
- **FR-004**: System MUST provide a default renderer that works out-of-the-box (simple console or listr2).
- **FR-005**: System MUST allow renderer selection at harness initialization time.
- **FR-006**: System MUST propagate monologue configuration (buffer sizes, history size) from agent decorators to the monologue generator.
- **FR-007**: System MUST maintain narrative history for context injection into subsequent monologue generations.
- **FR-008**: System MUST handle the "wait" signal (empty monologue response) by continuing to buffer events.
- **FR-009**: System MUST perform a final flush of buffered events when task execution completes.
- **FR-010**: System MUST support live mode (real-time) and replay mode visualization.
- **FR-011**: System MUST allow custom system prompts for monologue generation to support different narrative styles.

### Key Entities

> **Source of Truth**: See [`contracts/`](./contracts/) for TypeScript definitions and [`data-model.md`](./data-model.md) for complete schema documentation.

- **NarrativeEntry**: A single narrative update containing timestamp, agent name, task ID (optional for harness-level narratives), and human-readable text.
- **TaskHarness**: The orchestrator that executes tasks and emits events to the renderer, including converting monologue callbacks to narrative events.
- **IHarnessRenderer**: The interface that all renderers implement: `initialize()`, `handleEvent()`, `finalize()`.
- **MonologueConfig**: Configuration for narrative generation including buffer thresholds, history size, and optional custom system prompt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can observe agent progress through narrative text during task execution (100% of narratives visible within one screen refresh cycle).
- **SC-002**: Narrative updates provide meaningful context (users can understand what the agent accomplished without seeing tool calls).
- **SC-003**: System supports at least two renderer implementations (simple console and rich terminal).
- **SC-004**: Narrative history maintains coherence across multiple entries (subsequent narratives reference prior context, no redundant repetition).
- **SC-005**: System degrades gracefully when monologue generation fails (task execution continues, missing narrative is logged).
- **SC-006**: Configuration changes (buffer sizes, renderer selection) take effect immediately without code changes.
- **SC-007**: Replay mode accurately represents the original execution timing and narrative sequence.

## Assumptions

- The `@AnthropicMonologue` decorator implementation from MONOLOGUE-ARCHITECTURE.md is complete and functioning.
- The harness-renderer architecture (protocol, interface, base class, built-in renderers) is stable and ready for integration.
- Narrative generation uses a lightweight model (haiku by default) to minimize latency impact.
- The monologue system's "wait" signal (empty response) is the mechanism for deferring narrative generation until sufficient context exists.
- Renderers are responsible for their own output format and can interpret narrative entries as needed.
