# Feature Specification: Fluent Harness DX

**Feature Branch**: `007-fluent-harness-dx`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User feedback: "createContainer() exposes DI internals, event bus subscription is verbose, logging is mixed with business logic"

## Overview

The current harness development experience exposes infrastructure concerns to workflow authors. Users must manually call `createContainer()`, use `container.get()` for agents, subscribe to event buses, and mix logging calls with business logic.

This feature introduces a fluent builder API that:
1. Hides DI container creation entirely
2. Declares agents as typed configuration
3. Moves event handling to configuration (auto-cleanup)
4. Separates business logic (execute) from presentation (event subscribers)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero DI Exposure (Priority: P1)

As a workflow author, I want to define harnesses without knowing about dependency injection so that I can focus on business logic instead of infrastructure.

**Why this priority**: The current `createContainer()` + `container.get()` pattern is the primary DX complaint. Eliminating it is the core value of this feature.

**Independent Test**: Write a harness using the new API. Verify compilation succeeds and runtime works without any imports from DI internals or use of `createContainer`.

**Acceptance Scenarios**:

1. **Given** a developer creating a new harness, **When** they use the fluent API, **Then** they never see Container, createContainer, or container.get() in their code.
2. **Given** a harness definition with agent classes, **When** the harness instance is created, **Then** agents are automatically resolved and injected.
3. **Given** the harness is running, **When** an agent is used, **Then** the agent has all its dependencies (runner, event bus) properly injected.

---

### User Story 2 - Typed Agent Access (Priority: P1)

As a workflow author, I want to declare agents in configuration and access them with full type inference so that I get autocomplete and compile-time safety.

**Why this priority**: Type safety prevents runtime errors and enables IDE support. If agents are loosely typed, the DX improvement is negated.

**Independent Test**: Define a harness with named agents (e.g., planner, coder). In the execute function, verify that agent methods have correct return type inference and IDE autocomplete works.

**Acceptance Scenarios**:

1. **Given** agents declared with names, **When** I access an agent in execute(), **Then** the type system infers the correct agent type.
2. **Given** agents declared in config, **When** I call a method on an agent, **Then** IDE autocomplete shows all available methods with correct signatures.
3. **Given** I mistype an agent name, **When** the code is compiled, **Then** a type error is raised at compile time.

---

### User Story 3 - Declarative Event Handling (Priority: P1)

As a workflow author, I want to configure event handlers at harness creation so that I don't manually subscribe/unsubscribe to event buses.

**Why this priority**: Manual event bus subscription leads to cleanup bugs and boilerplate. Declarative config ensures proper lifecycle management.

**Independent Test**: Create a harness with event handlers attached via fluent API. Run the harness and verify:
1. Callbacks are invoked during execution
2. No explicit unsubscribe() call is needed
3. After run() completes, callbacks are automatically cleaned up

**Acceptance Scenarios**:

1. **Given** event handlers registered via fluent API, **When** agents emit events during execution, **Then** handlers are called with typed event data.
2. **Given** a harness that has completed execution, **When** run() returns, **Then** all event subscriptions are automatically cleaned up.
3. **Given** multiple event types (narrative, phase, task), **When** different handlers are registered, **Then** each receives only its event type.

---

### User Story 4 - Separation of Concerns (Priority: P1)

As a workflow author, I want my execute() function to contain only business logic so that rendering/logging is handled externally.

**Why this priority**: Mixing console.log with business logic violates single responsibility. Clean separation enables testing business logic independently from presentation.

**Independent Test**: Write a harness execute() function that uses only structured event emission (no console.log). Register an external handler that logs. Verify output matches expected logs.

**Acceptance Scenarios**:

1. **Given** an execute function that emits structured events, **When** no handlers are registered, **Then** execution succeeds silently (no output, no errors).
2. **Given** an execute function that emits events, **When** a logging handler is registered, **Then** all output comes from the handler, not the harness.
3. **Given** a test environment, **When** I run a harness without event handlers, **Then** I can assert on state changes without parsing console output.

---

### User Story 5 - State Factory Pattern (Priority: P2)

As a workflow author, I want to define initial state as a function of input parameters so that I can create parameterized harnesses.

**Why this priority**: Static initial state limits reusability. Factory pattern enables creating multiple harness instances with different inputs.

**Independent Test**: Define a harness with a state factory that takes input parameters. Create two instances with different inputs. Verify each has its own isolated state.

**Acceptance Scenarios**:

1. **Given** a state factory function, **When** I create a harness instance with specific input, **Then** initial state contains the input values.
2. **Given** two harness instances created from the same definition, **When** one modifies state, **Then** the other's state is unaffected.
3. **Given** a state factory with complex initialization, **When** the harness is created, **Then** the factory runs once and result is cached for that instance.

---

### User Story 6 - Mode Configuration (Priority: P2)

As a developer writing tests, I want to specify mode (live/replay) in the harness definition so that tests can use replay mode with recordings.

**Why this priority**: Testability without real LLM calls is essential. Mode should be declarative, not imperative container manipulation.

**Independent Test**: Define a harness with replay mode. Create and run it. Verify agents use replay runners without any manual container configuration.

**Acceptance Scenarios**:

1. **Given** a harness definition with live mode, **When** agents execute, **Then** real API calls are made.
2. **Given** a harness definition with replay mode, **When** agents execute, **Then** replay runners are used.
3. **Given** a harness definition with replay mode, **When** no recording exists, **Then** a clear error message indicates the missing recording.

---

### User Story 7 - Backward Compatibility (Priority: P2)

As a developer with existing harnesses, I want existing harness classes to remain available so that I don't have to migrate all my code at once.

**Why this priority**: Breaking changes harm adoption. Existing code must continue working while new code uses the improved API.

**Independent Test**: Run existing harness classes unchanged. Verify they still work with createContainer() and container.get().

**Acceptance Scenarios**:

1. **Given** existing code using legacy harness patterns and createContainer(), **When** upgrading SDK version, **Then** code compiles and runs without changes.
2. **Given** both APIs (legacy and fluent), **When** using them in the same codebase, **Then** no conflicts or type errors occur.
3. **Given** the SDK exports, **When** I check exports, **Then** both legacy and new APIs are exported.

---

### Edge Cases

- **Empty agents config**: When no agents are declared, harness still works (state-only workflow).
- **Agent constructor injection fails**: When an agent's dependencies can't be resolved, clear error message names the agent and missing dependency.
- **Event handler throws**: When an event handler throws an error, execution continues and error is logged (events are non-critical).
- **Emit called after run() completes**: After run() finishes, emit() is a no-op (no error thrown).
- **Async state factory**: State factory must be synchronous to ensure deterministic initialization order.
- **Recursive agent calls**: When agent A calls agent B, each maintains separate event scopes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a fluent factory function that returns a typed harness factory.
- **FR-002**: System MUST accept agent class constructors in config and resolve them to instances internally.
- **FR-003**: System MUST create and manage DI container internally with no user exposure.
- **FR-004**: System MUST provide a create method that instantiates harness with state factory.
- **FR-005**: System MUST provide an event subscription method for typed event handling.
- **FR-006**: System MUST automatically unsubscribe all event handlers when run() completes.
- **FR-007**: System MUST provide an emit function in execute context for custom events.
- **FR-008**: System MUST forward narrative events from internal event bus to harness event handlers.
- **FR-009**: System MUST support live and replay mode configuration.
- **FR-010**: System MUST preserve full backward compatibility with existing harness usage.
- **FR-011**: System MUST provide typed access to state within execute context with update helpers.
- **FR-012**: System MUST support both simple async functions and async generators for execute logic.
- **FR-013**: System MUST provide phase() helper that auto-emits start/complete events.
- **FR-014**: System MUST provide task() helper that auto-emits start/complete/failed events.
- **FR-015**: System MUST support progressive API levels from single-agent wrapper to full harness.

### Key Entities

- **HarnessDefinition**: Configuration object with name, mode, agents, state factory, and execute function.
- **HarnessFactory**: Return type of fluent API, with create(input) method.
- **HarnessInstance**: Running harness with event subscription, run(), and state access.
- **ExecuteContext**: Object passed to execute() containing agents, state, phase(), task(), and emit().
- **HarnessEvent**: Union type of all emittable events (phase, task, step, narrative, error).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The coding workflow harness is rewritten using the new API with 50%+ reduction in lines of code.
- **SC-002**: Zero imports from DI internals in the new harness code.
- **SC-003**: All agent method calls have full type inference (verified by IDE tooltip inspection).
- **SC-004**: The new harness passes all existing functionality tests (same behavior, better DX).
- **SC-005**: Unit tests for HarnessFactory and HarnessInstance achieve 90%+ coverage.
- **SC-006**: Event handlers are auto-cleaned up on run() completion (verified by spy in tests).
- **SC-007**: Legacy harness and createContainer continue to work unchanged (backward compat test passes).
- **SC-008**: **Ultimate Test** - The coding workflow runs, produces visible narrative output, and completes all phases successfully using the new API.

## Assumptions

- The existing createContainer() infrastructure is stable and can be wrapped without modification.
- Agent classes use @injectable() decorator and can be resolved via container.get(AgentClass).
- The IEventBus interface supports the filtering needed for event routing.
- Generators (async *execute()) are the right abstraction for step-yielding workflows.
- Mutable state objects are sufficient for harness use cases (users can add immutability libraries if needed).

## Non-Goals

- This feature does NOT add new agent capabilities or modify existing agents.
- This feature does NOT change the underlying DI system.
- This feature does NOT add new event types (uses existing EventBus infrastructure).
- This feature does NOT modify the recording/replay system.

## Migration Path

1. **Phase 1**: Implement new API alongside existing harness classes.
2. **Phase 2**: Migrate coding harness to use new API as proof-of-concept.
3. **Phase 3**: Update documentation with new recommended patterns.
4. **Phase 4** (future): Deprecate direct createContainer() usage in favor of factory patterns.
