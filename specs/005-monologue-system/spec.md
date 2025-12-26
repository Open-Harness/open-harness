# Feature Specification: Monologue System

**Feature Branch**: `005-monologue-system`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "Implement decorator-based monologue system for agent narrative generation"

## Overview

The monologue system generates human-readable, first-person narrative summaries of agent work. Instead of verbose tool call logs, users see natural language updates like "I'm reading the config file..." or "Found the bug, fixing it now."

The system uses a decorator pattern for developer experience (`@Monologue('scope')`) with an injectable service for testability. This replaces all manual `emitNarrative()` calls in TaskHarness with automatic, LLM-generated narratives.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero-Config Narrative Generation (Priority: P1)

As a developer using the SDK, I want agents to automatically generate narrative updates without any configuration so that I get visibility into agent work out of the box.

**Why this priority**: This is the core value proposition. If developers must configure anything to see narratives, adoption suffers. The default experience must "just work."

**Independent Test**: Run TaskHarness with default settings. Verify narrative events are emitted for parser, coding, and review agent actions without any explicit monologue configuration.

**Acceptance Scenarios**:

1. **Given** a TaskHarness instance with default configuration, **When** the harness executes tasks, **Then** narrative events are emitted for each agent phase (parsing, coding, review).
2. **Given** an agent method decorated with `@Monologue`, **When** the method executes, **Then** narrative generation occurs automatically without caller intervention.
3. **Given** no explicit monologue configuration, **When** agents run, **Then** the system uses sensible defaults (haiku model, buffer size 2, history size 5).

---

### User Story 2 - Clean Developer Experience (Priority: P1)

As a developer building agents, I want to enable narratives with a single decorator so that I don't have to write boilerplate at every call site.

**Why this priority**: DX directly impacts adoption. The 003 failure showed that complex patterns get bypassed. One decorator per method is the maximum acceptable complexity.

**Independent Test**: Add `@Monologue('my-agent')` to an agent method. Verify narratives are generated without any changes to code that calls the method.

**Acceptance Scenarios**:

1. **Given** an agent class with a method, **When** I add `@Monologue('scope')` decorator, **Then** narrative generation is enabled with zero changes to callers.
2. **Given** an existing agent without monologue, **When** I want to add narratives, **Then** I add one decorator and one import - nothing else.
3. **Given** a decorated agent method, **When** it is called multiple times in a loop, **Then** each call generates appropriate narratives without duplicate setup.

---

### User Story 3 - Testable Without Real LLM (Priority: P1)

As a developer writing tests, I want to mock the narrative generation so that my tests run fast and don't require API keys.

**Why this priority**: Untestable code becomes unmaintainable. Every monologue component must be testable in isolation with mocks.

**Independent Test**: Write a unit test for MonologueService that injects a mock LLM. Verify the service buffers events and calls the mock at appropriate times.

**Acceptance Scenarios**:

1. **Given** a test environment, **When** I provide a mock LLM implementation, **Then** all monologue code uses the mock instead of real API calls.
2. **Given** a mock LLM that returns canned responses, **When** agents execute in tests, **Then** narrative events contain the canned responses.
3. **Given** the MonologueService, **When** I inject dependencies via constructor, **Then** I can fully test buffer logic, flush behavior, and event emission.

---

### User Story 4 - Narrative Context Continuity (Priority: P2)

As a user watching agent progress, I want narratives to build on previous context so that the story flows naturally without repetition.

**Why this priority**: Disconnected narratives are confusing. "I'm reading files" followed by "I'm reading files" is useless. Context creates comprehension.

**Independent Test**: Execute a multi-step task. Verify that later narratives reference earlier work (e.g., "Now that I've found the config, I'm updating it" rather than "I'm updating a file").

**Acceptance Scenarios**:

1. **Given** previous narratives exist for an agent, **When** generating a new narrative, **Then** the history is provided to the LLM for context.
2. **Given** an agent that performed multiple actions, **When** narratives are generated, **Then** they form a coherent story when read in sequence.
3. **Given** history size is configured to N, **When** more than N narratives exist, **Then** only the most recent N are provided as context.

---

### User Story 5 - Configurable Verbosity (Priority: P2)

As a developer, I want to control narrative frequency so that I can balance detail vs. noise for different use cases.

**Why this priority**: Demos want concise updates. Debugging wants verbose detail. One size doesn't fit all.

**Independent Test**: Configure monologue with `minBufferSize: 5` vs `minBufferSize: 1`. Verify the first generates fewer, batched narratives while the second generates more frequent updates.

**Acceptance Scenarios**:

1. **Given** configuration with large buffer size, **When** agents execute, **Then** narratives summarize batches of actions.
2. **Given** configuration with small buffer size, **When** agents execute, **Then** narratives are generated more frequently.
3. **Given** a custom system prompt, **When** narratives are generated, **Then** the custom prompt style is reflected in output.

---

### User Story 6 - Graceful Degradation (Priority: P3)

As a user, I want task execution to continue even if narrative generation fails so that LLM errors don't break my workflow.

**Why this priority**: Narratives are observability, not core functionality. A narrative failure should never stop task execution.

**Independent Test**: Configure a mock LLM that throws errors. Run TaskHarness and verify tasks complete successfully with error logged but no narrative events.

**Acceptance Scenarios**:

1. **Given** the narrative LLM call fails, **When** an agent is executing, **Then** task execution continues without interruption.
2. **Given** narrative generation times out, **When** the timeout occurs, **Then** the event buffer is cleared and execution proceeds.
3. **Given** repeated narrative failures, **When** errors accumulate, **Then** the system logs warnings but does not retry indefinitely.

---

### Edge Cases

- **Empty buffer at flush**: When task completes with no buffered events, no narrative is generated (not an error).
- **LLM returns "wait" signal**: When LLM returns empty string or "...", the system continues buffering without emitting a narrative.
- **Rapid-fire events**: When events arrive faster than LLM can process, buffer grows until `maxBufferSize` triggers forced generation.
- **Multiple decorated methods in call stack**: Each decorated method maintains its own scope; nested calls don't interfere.
- **Concurrent agent execution**: Each agent instance has isolated buffer state; parallel execution doesn't cross-contaminate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `@Monologue(scope)` decorator that enables narrative generation for agent methods.
- **FR-002**: System MUST provide an injectable `MonologueService` that handles event buffering and LLM calls.
- **FR-003**: System MUST define an `IMonologueLLM` interface with injectable token for testability.
- **FR-004**: System MUST buffer agent events (tool calls, tool results, completions) until generation threshold is met.
- **FR-005**: System MUST emit narrative events via the existing `IEventBus` infrastructure.
- **FR-006**: System MUST maintain narrative history for context injection into subsequent generations.
- **FR-007**: System MUST flush remaining buffer on method completion (final narrative).
- **FR-008**: System MUST continue task execution if narrative generation fails.
- **FR-009**: System MUST support configuration of buffer sizes, history size, and model selection.
- **FR-010**: System MUST provide preset prompt templates (DEFAULT, TERSE, VERBOSE).
- **FR-011**: System MUST replace all existing manual `emitNarrative()` calls in TaskHarness with decorator-driven generation.

### Key Entities

- **MonologueService**: Injectable service that buffers events, calls LLM, maintains history, and emits narratives.
- **IMonologueLLM**: Interface for the LLM client. Production implementation uses Anthropic Haiku. Test implementation returns mocks.
- **MonologueConfig**: Configuration including `minBufferSize`, `maxBufferSize`, `historySize`, `model`, and optional `systemPrompt`.
- **AgentEvent**: A buffered event containing type (tool_call, tool_result, completion), payload, and timestamp.
- **NarrativeEntry**: The output containing text, agentName, taskId (optional), and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding narrative generation to an agent requires exactly one decorator and one import.
- **SC-002**: All MonologueService methods are covered by unit tests using mock LLM (no real API calls in test suite).
- **SC-003**: TaskHarness emits narrative events for all agent phases (parser, coder, reviewer) in default configuration.
- **SC-004**: Narrative generation failures do not cause task execution failures (100% isolation).
- **SC-005**: The complete monologue module is implemented (types, service, decorator, prompts, LLM interface) - no empty directories.
- **SC-006**: End-to-end test demonstrates full task execution with narrative output visible in test assertions.
- **SC-007**: Zero manual `emitNarrative()` calls remain in TaskHarness after migration.

## Assumptions

- The existing `@Record` decorator pattern in `core/decorators.ts` provides a proven template for the `@Monologue` decorator.
- The existing `IEventBus` infrastructure can handle narrative events without modification.
- Haiku model is fast enough for inline narrative generation without noticeably impacting task execution latency.
- The existing `MonologueConfig` type in `specs/003-harness-renderer/contracts/monologue-config.ts` is a valid starting point for the configuration interface.
- Agent callbacks follow a consistent pattern (`onToolCall`, `onToolResult`, `onComplete`) that can be intercepted.
