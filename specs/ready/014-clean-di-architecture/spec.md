# Feature Specification: Clean DI Architecture with Agent Builder Pattern

**Feature Branch**: `014-clean-di-architecture`
**Created**: 2025-12-29
**Status**: Draft
**Input**: Resolve factory-agent vs harness DI architecture mismatch by implementing pure configuration + builder pattern for 100% DI compliance

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standalone Agent Execution (Priority: P1)

A developer wants to execute a preset agent (PlannerAgent, CodingAgent, ReviewAgent) without a harness for quick experimentation or scripting.

**Why this priority**: Core functionality that enables rapid prototyping (<5 minutes from install to first agent execution) and simple use cases (<100 lines of code for single-agent workflows). If users can't execute agents standalone, the framework loses its approachability.

**Independent Test**: Developer imports a preset agent, calls `executeAgent()` helper with input, and receives typed output without touching containers or DI concepts.

**Acceptance Scenarios**:

1. **Given** developer has installed `@openharness/anthropic/presets`, **When** they import `PlannerAgent` and call `executeAgent(PlannerAgent, { prd: "Build TODO app" })`, **Then** they receive typed `PlannerOutput` with task list
2. **Given** developer wants progress updates, **When** they pass a `ConsoleChannel` instance to `executeAgent()` options, **Then** they receive real-time agent progress events during execution
3. **Given** developer executes agent with invalid input schema, **When** input validation fails, **Then** they receive a clear Zod validation error before agent execution starts

---

### User Story 2 - Multi-Agent Workflow with Harness (Priority: P1)

A developer wants to orchestrate multiple agents in a workflow using harness, passing agent definitions without seeing DI infrastructure.

**Why this priority**: Primary use case for complex applications. Harnesses enable sophisticated multi-step workflows with state management and phase coordination.

**Independent Test**: Developer defines a harness with multiple preset agents, runs workflow with input, observes agents executing in sequence with shared state.

**Acceptance Scenarios**:

1. **Given** developer defines harness with `PlannerAgent`, `CodingAgent`, and `ReviewAgent`, **When** they call `Harness.create({ task: "..." }).run()`, **Then** all three agents execute in order with typed inputs/outputs
2. **Given** harness is running, **When** a phase completes, **Then** phase metadata (name, duration, result) is emitted to attached channels
3. **Given** agent execution fails in a phase, **When** error occurs, **Then** harness stops execution and channels receive error event with context

---

### User Story 3 - Custom Agent Definition (Priority: P2)

A developer wants to create a custom agent using `defineAnthropicAgent()` with their own prompt template and schemas.

**Why this priority**: Extensibility is important but not blocking. Users can start with presets (P1) before needing custom agents.

**Independent Test**: Developer defines custom agent with typed prompt template, input/output schemas, then executes it standalone or in harness identically to preset agents.

**Acceptance Scenarios**:

1. **Given** developer creates custom prompt template with `{{variable}}` placeholders, **When** they define agent with input schema matching template variables, **Then** TypeScript enforces type safety between template and schema
2. **Given** developer defines custom agent, **When** they execute it via `executeAgent()`, **Then** it behaves identically to preset agents (same execution path, same event emission)
3. **Given** developer uses custom agent in harness, **When** harness resolves agents, **Then** custom agent is built using same builder pattern as presets

---

### User Story 4 - Testing with Dependency Injection (Priority: P2)

A developer wants to test agents or harnesses with mock infrastructure (runner, event bus) without relying on real LLM calls or global state.

**Why this priority**: Critical for quality but can be deferred initially. Early adopters can use integration tests while we perfect DI testability.

**Independent Test**: Developer creates test container with mock bindings, passes it to agent builder or harness, observes mock infrastructure used instead of real services.

**Acceptance Scenarios**:

1. **Given** developer creates test container with mock `IAgentRunner`, **When** they call `executeAgent(agent, input, { container: testContainer })`, **Then** mock runner is invoked instead of real AnthropicRunner
2. **Given** developer defines harness, **When** they pass test container with mock event bus, **Then** harness uses mock bus for all event emissions
3. **Given** developer runs test suite, **When** tests complete, **Then** no global state leaks between test cases (each test uses isolated container)

---

### Edge Cases

- What happens when `defineAnthropicAgent()` is called with mismatched prompt template variables and input schema fields?
- How does system handle agent execution when no container is provided (standalone) vs explicit container (harness)?
- What happens if harness receives an agent definition without required `name` or `prompt` fields?
- How does system handle circular dependencies in custom agent compositions?
- What happens when agent execution is attempted without `registerAnthropicProvider()` being called?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `defineAnthropicAgent()` MUST return a plain configuration object (AnthropicAgentDefinition) containing name, prompt template, input schema, and output schema
- **FR-002**: System MUST provide `executeAgent()` helper function that accepts agent definition, input, and optional execution options (container, channel)
- **FR-003**: System MUST provide `streamAgent()` helper function that returns AgentHandle for streaming execution
- **FR-004**: Harness MUST accept agent definitions in `agents` config and resolve them using injectable `AgentBuilder` service
- **FR-005**: `AgentBuilder` MUST be an injectable service with dependencies on `IAgentRunnerToken` and `IUnifiedEventBusToken`
- **FR-007**: `executeAgent()` and `streamAgent()` MUST create temporary container if none provided in options
- **FR-008**: Harness MUST create its own container and use it to build all agents
- **FR-010**: System MUST validate input against agent's input schema before execution
- **FR-011**: System MUST render prompt template with input data using template variables
- **FR-012**: All preset agents (PlannerAgent, CodingAgent, ReviewAgent) MUST be refactored to return plain configuration objects
- **FR-013**: System MUST support channel attachment for both standalone execution and harness execution
- **FR-014**: `AgentBuilder.build()` MUST return an object with `execute()` and `stream()` methods
- **FR-015**: System MUST allow developers to pass custom container to `executeAgent()` for testing
- **FR-016**: Harness MUST NOT expose container, tokens, or DI concepts in its public API
- **FR-017**: System MUST maintain backward compatibility with existing harness tests (control-flow.test.ts)
- **FR-018**: Agent execution MUST emit events to `IUnifiedEventBus` for channel consumption
- **FR-019**: System MUST register `AnthropicRunner` as `IAgentRunnerToken` implementation when `registerAnthropicProvider()` is called
- **FR-020**: All DI violations (service locator, global state, ambient context) MUST be eliminated

### Key Entities

- **AnthropicAgentDefinition**: Plain object containing agent configuration (name, prompt, inputSchema, outputSchema)
- **PromptTemplate**: Template string with variable placeholders, validation schema, and render function
- **AgentBuilder**: Injectable service that constructs executable agents from definitions
- **ExecutableAgent**: Object returned by builder with execute() and stream() methods
- **Container**: Needle DI container managing infrastructure dependencies (runners, event bus, config)
- **ExecuteOptions**: Configuration for agent execution (container, channel, recording, monologue)
- **AgentHandle**: Streaming execution handle with chunk iteration and cancellation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can execute preset agents standalone with exactly 1 line of code (one statement/expression, method chaining allowed, excluding import) - custom agents require defineAnthropicAgent() call first, then 1 line for execution
- **SC-002**: Developers can create multi-agent harnesses without seeing any DI concepts (no container, no tokens, no @injectable)
- **SC-003**: All agents pass DI compliance audit with 95%+ score (no service locator, no global state, pure constructor injection)
- **SC-004**: Developers can test agents with mock infrastructure by passing custom container to executeAgent() options
- **SC-005**: Validation workflow (from examples/coding/src/validate-harness.ts) runs successfully end-to-end
- **SC-006**: Existing coding workflow (from examples/coding/src/harness.ts) runs successfully with new architecture
- **SC-007**: All existing harness tests pass without modification (17/17 passing in control-flow.test.ts)
- **SC-008**: Agent definitions are serializable (can JSON.stringify and parse without losing functionality)
- **SC-009**: Zero global state remains in factory.ts or provider layer (verified by grep for module-level containers)
- **SC-010**: Documentation clearly explains framework/user boundary (what users see vs what's internal)

### Quality Indicators

- All NeedleDI anti-patterns eliminated from codebase
- Single Composition Root pattern enforced (harness is the composition root)
- All dependencies injected via constructor (no property or method injection)
- Clear separation between agent definition (data) and agent execution (service)
- Test suite demonstrates mocking infrastructure without modifying production code

## Assumptions

- Developers using standalone execution are OK with one extra function call (`executeAgent()` vs direct `.execute()`)
- Serializable agent definitions are more valuable than convenience methods on agent objects
- Harness will always create its own container (never share containers between harnesses)
- Temporary containers created by `executeAgent()` are acceptable overhead for standalone usage
- Backward compatibility with existing harness API is mandatory (no breaking changes)
- All current preset agents can be migrated to config-only pattern without loss of functionality
- Channel system works identically in both standalone and harness execution modes

## Out of Scope

- Converting existing class-based agents to new pattern (only factory-based agents affected)
- Adding new agent types or providers (OpenAI, Gemini, etc.)
- Changing harness control flow or phase execution logic
- Modifying channel implementation or event bus architecture
- Performance optimization of container creation/resolution
- Adding multi-provider agent selection at runtime
- Implementing agent composition patterns (chaining, parallel execution)
- Migration tooling for users with existing factory-based agent code
