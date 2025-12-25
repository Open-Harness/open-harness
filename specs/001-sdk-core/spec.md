# Feature Specification: Open Harness SDK Core

**Feature Branch**: `spec-kit/fix-1`
**Created**: 2025-12-25
**Status**: Draft
**Input**: Architectural audit + user requirements discussion

## Overview

Open Harness is an SDK for building LLM-powered agent workflows. It provides a three-layer architecture (Harness → Agents → Runners) with dependency injection, recording/replay for testing, and a monologue system for human-readable agent narration.

This spec defines the core SDK features that must work correctly before the project is usable.

---

## User Scenarios & Testing

### User Story 1 - Agent Execution (Priority: P1)

As a developer, I want to create an agent that executes tasks with an LLM and returns structured output, so that I can build AI-powered features.

**Why this priority**: This is the foundational capability. Nothing else works without basic agent execution.

**Independent Test**: Can create an agent, run it with a prompt, receive callbacks during execution, and get typed output.

**Acceptance Scenarios**:

1. **Given** an SDK installation, **When** I call `createAgent("coder")`, **Then** I receive a configured CodingAgent instance
2. **Given** a CodingAgent, **When** I call `agent.execute(task, sessionId, callbacks)`, **Then** I receive `onText`, `onToolCall`, `onToolResult` callbacks during execution
3. **Given** agent execution completes, **When** I check the return value, **Then** I receive typed `CodingResult` with structured output
4. **Given** agent execution fails, **When** error occurs, **Then** `onError` callback fires with error details

---

### User Story 2 - Recording/Replay for TDD (Priority: P1)

As a developer, I want to record real LLM interactions and replay them for fast deterministic tests, so that I can TDD against real fixtures without slow/expensive API calls.

**Why this priority**: This is required by Constitution Principle II (Verified by Reality). Cannot develop safely without it.

**Independent Test**: Can record a session to JSONL, then replay it with identical callback sequence.

**Acceptance Scenarios**:

1. **Given** `createContainer({ mode: "live" })`, **When** I execute an agent, **Then** the session is recorded to `recordings/{category}/{sessionId}.jsonl`
2. **Given** a recorded session exists, **When** I use `createContainer({ mode: "replay" })` and execute the same prompt, **Then** callbacks fire in identical sequence with identical data
3. **Given** replay mode with no matching recording, **When** I execute, **Then** an error is thrown indicating missing fixture
4. **Given** I want golden recordings, **When** I record to `recordings/golden/`, **Then** the recording is suitable for committing to repo

---

### User Story 3 - Monologue Subscription (Priority: P2)

As a developer, I want to subscribe to a first-person narrative of what my agent is doing, so that I can show users human-readable progress instead of raw tool calls.

**Why this priority**: Key DX feature that differentiates Open Harness. Not blocking for basic functionality.

**Independent Test**: Can wrap agent with monologue, receive narrative updates that describe agent actions in plain English.

**Acceptance Scenarios**:

1. **Given** an agent with monologue enabled, **When** the agent executes, **Then** I receive `onMonologue(narrative)` callbacks with first-person descriptions
2. **Given** monologue is processing events, **When** multiple tool calls happen quickly, **Then** events are buffered and monologue decides when to emit (not 1:1)
3. **Given** monologue has emitted responses, **When** next monologue runs, **Then** previous responses are included as context (append-only history)
4. **Given** I don't want monologue, **When** I create agent without monologue config, **Then** no monologue processing occurs (opt-in)

---

### User Story 4 - Multi-Agent Workflows (Priority: P2)

As a developer, I want to orchestrate multiple agents working together, so that I can build complex pipelines (e.g., code → review → iterate).

**Why this priority**: Enables real-world use cases. Builds on P1 agent execution.

**Independent Test**: Can create workflow with multiple agents, execute in sequence, pass outputs between agents.

**Acceptance Scenarios**:

1. **Given** a workflow config with multiple agents, **When** I call `workflow.run()`, **Then** agents execute in defined order
2. **Given** agent A produces output, **When** agent B runs, **Then** B can access A's output
3. **Given** an agent fails mid-workflow, **When** error occurs, **Then** workflow stops and reports which agent failed
4. **Given** workflow completes, **When** I check results, **Then** I can access each agent's individual output

---

### User Story 5 - Provider Abstraction (Priority: P3)

As a developer, I want to swap LLM providers without changing my agent code, so that I can use different models or providers in future.

**Why this priority**: Future-proofing. Current implementation only needs Anthropic, but architecture should support others.

**Independent Test**: Can implement a custom runner, inject it via DI, and agent works without modification.

**Acceptance Scenarios**:

1. **Given** I implement `IAgentRunner` interface, **When** I bind it in the container, **Then** agents use my custom runner
2. **Given** an agent using tokens (not concrete classes), **When** I swap `IAgentRunnerToken` binding, **Then** agent behavior changes accordingly
3. **Given** ReplayRunner (for testing), **When** I use it via DI, **Then** agent replays recorded sessions

---

### User Story 6 - Step-Aware Harness (Priority: P3)

As a developer, I want to run long-running agent tasks with bounded context and state management, so that I can process large workloads without unbounded memory growth.

**Why this priority**: Advanced use case. Harness layer is mostly complete but needs validation.

**Independent Test**: Can create harness, execute multi-step workflow, state persists between steps, context is bounded.

**Acceptance Scenarios**:

1. **Given** a harness with `maxContextSteps: 10`, **When** 15 steps execute, **Then** only most recent 10 steps are in context
2. **Given** harness state, **When** I call `updateState(patch)`, **Then** state is immutably updated
3. **Given** `loadContext()` is called, **When** harness provides context to agent, **Then** context includes state + recent steps + relevant knowledge

---

### Edge Cases

- What happens when recording file is corrupted? → Error with clear message
- What happens when monologue model fails? → Agent continues, monologue emits error event
- What happens when DI container has missing bindings? → Fail fast with clear error listing missing tokens
- What happens when agent execution times out? → Configurable timeout, error callback fires
- What happens when replay doesn't match prompt? → Use first recording in file (warn) or strict mode (error)

---

## Requirements

### Functional Requirements

**Core Agent System**
- **FR-001**: SDK MUST export `createAgent(type, options)` factory that hides DI complexity
- **FR-002**: SDK MUST export `BaseAnthropicAgent` as the base class for custom agents
- **FR-003**: Agents MUST emit events via `IAgentCallbacks` interface (not deprecated StreamCallbacks)
- **FR-004**: Agents MUST support typed structured output via Zod schemas
- **FR-005**: Agents MUST integrate with EventBus for cross-cutting concerns

**Recording/Replay System**
- **FR-010**: SDK MUST support `mode: "live" | "replay"` in container options
- **FR-011**: Live mode MUST automatically record sessions to JSONL files
- **FR-012**: Replay mode MUST read JSONL and fire callbacks in recorded sequence
- **FR-013**: Recording MUST capture: prompt, options, all SDK messages in order
- **FR-014**: Recording decorator MUST be injectable (DI-native)
- **FR-015**: Golden recordings MUST be committable to repo (`recordings/golden/`)

**Monologue System**
- **FR-020**: Monologue MUST be opt-in via decorator pattern
- **FR-021**: Monologue MUST buffer events until cheap model decides to respond
- **FR-022**: Monologue MUST maintain append-only history re-injected as context
- **FR-023**: Monologue MUST use cheap model (Haiku) by default, configurable
- **FR-024**: Monologue decorator MUST be injectable (DI-native)
- **FR-025**: Monologue MUST emit via `onMonologue(narrative)` callback

**Dependency Injection**
- **FR-030**: All internal services MUST use `@injectable()` with `inject(Token)` pattern
- **FR-031**: Composition root (`container.ts`) MUST be the only place implementations are bound
- **FR-032**: Factory functions MUST hide DI complexity from users
- **FR-033**: Decorators (Recording, Monologue) MUST integrate with DI container
- **FR-034**: Circular dependencies MUST be prevented by architecture

**Event System**
- **FR-040**: EventBus MUST support publish/subscribe pattern
- **FR-041**: Events MUST be typed (AgentEvent discriminated union)
- **FR-042**: Subscribers MUST be able to filter by event type
- **FR-043**: EventBus MUST be injectable and optional

**Multi-Agent Workflows**
- **FR-050**: SDK MUST export `createWorkflow(config)` factory
- **FR-051**: Workflows MUST support sequential agent execution
- **FR-052**: Workflows MUST pass context/output between agents
- **FR-053**: Workflows MUST support failure handling (stop on error, continue, retry)

**Provider Abstraction**
- **FR-060**: `IAgentRunner` interface MUST abstract LLM execution
- **FR-061**: Agents MUST depend on tokens, not concrete runner classes
- **FR-062**: SDK MUST ship with `AnthropicRunner` and `ReplayRunner`

**Prompt System**
- **FR-070**: All agent prompts MUST be Markdown files with Handlebars templates
- **FR-071**: PromptRegistry MUST provide type-safe `format{AgentName}(params)` methods
- **FR-072**: Prompt parameters MUST be validated via Zod schemas
- **FR-073**: Users MUST be able to override prompts while following schema
- **FR-074**: Prompts MUST live in `prompts/` directory, discoverable by convention

**Context System**
- **FR-080**: Agents MUST define a static `contextSchema` (Zod) for accepted context
- **FR-081**: Agent context MUST be optional (agents work standalone)
- **FR-082**: Harness MUST transform its state to agent context shape
- **FR-083**: Context MUST be merged with task params before prompt formatting
- **FR-084**: State snapshots MUST be loadable for debugging/testing/replay

---

### Key Entities

- **Agent**: Executes tasks with LLM. Has name, runner, callbacks. Emits events.
- **Runner**: Wraps LLM provider. Implements `IAgentRunner`. Converts SDK messages to callbacks.
- **Harness**: Step-aware orchestration. Has state, step history, bounded context.
- **Monologue**: Decorator that generates narrative from agent events. Has buffer, history, cheap model.
- **Recorder**: Captures/replays LLM interactions. Writes JSONL. Injectable decorator.
- **EventBus**: Pub/sub for agent events. Enables cross-cutting concerns.
- **Container**: DI composition root. Binds tokens to implementations.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `bun run build` succeeds with zero errors
- **SC-002**: `bun run check-types` passes with strict mode
- **SC-003**: All exports in `index.ts` resolve to existing implementations
- **SC-004**: At least 3 golden recordings committed to `recordings/golden/`
- **SC-005**: Live integration test proves agent execution with real Anthropic API
- **SC-006**: Replay test proves deterministic playback of recorded session
- **SC-007**: Monologue test proves narrative generation from agent events
- **SC-008**: No `any` types in public API surface
- **SC-009**: All agents use `IAgentCallbacks` (not deprecated StreamCallbacks)
- **SC-010**: DX test: new user can create and run agent in <10 lines of code

---

## Architectural Decisions

### AD-001: Monologue as DI-Aware Decorator

**Decision**: Implement monologue as an injectable decorator, not built into BaseAnthropicAgent.

**Rationale**:
- Separation of concerns (agent doesn't know about monologue)
- Opt-in per agent
- Can wrap ANY agent (existing or new)
- Testable independently
- Follows composition over inheritance

**Implementation Pattern**:
```typescript
@injectable()
class MonologueDecorator implements IMonologueDecorator {
  constructor(
    private monologueRunner = inject(IMonologueRunnerToken),
  ) {}

  wrap<T extends BaseAnthropicAgent>(agent: T): T & IMonologueProvider {
    // Subscribe to agent events, buffer, emit narrative
  }
}

// Factory integrates cleanly
const agent = createAgent("coder", { monologue: { enabled: true } });
agent.onMonologue((text) => console.log(text));
```

### AD-002: Recording as DI-Aware Decorator

**Decision**: Implement recording as an injectable decorator that wraps runners.

**Rationale**:
- Same benefits as monologue decorator
- Can record ANY runner
- Clean integration with replay mode
- Testable independently

**Implementation Pattern**:
```typescript
@injectable()
class RecordingDecorator implements IRecordingDecorator {
  constructor(
    private config = inject(IConfigToken),
  ) {}

  wrap(runner: IAgentRunner, sessionId: string): IAgentRunner {
    // In live mode: capture messages, write JSONL
    // In replay mode: read JSONL, fire callbacks
  }
}
```

### AD-003: Single Callback Interface (IAgentCallbacks)

**Decision**: Migrate all agents to `IAgentCallbacks`, remove deprecated `StreamCallbacks`.

**Rationale**:
- Single source of truth for callback types
- Reduces API surface confusion
- Enables type-safe callback composition

**Migration Path**:
1. Ensure IAgentCallbacks covers all use cases
2. Update BaseAnthropicAgent to use IAgentCallbacks
3. Update concrete agents
4. Remove StreamCallbacks from exports
5. Update docs

### AD-004: BaseAnthropicAgent as Thin Orchestrator

**Decision**: BaseAnthropicAgent should be a thin orchestrator, not a feature-rich base class.

**Contents**:
- Event emission (fires callbacks + EventBus)
- Session management (sessionId tracking)
- Runner invocation (delegates to injected runner)
- Decorator integration points (hooks for monologue, recording)

**NOT in BaseAnthropicAgent**:
- Monologue logic (decorator)
- Recording logic (decorator)
- Prompt formatting (concrete agents)
- Output parsing (concrete agents)

---

## Resolved Questions

### RQ-001: Monologue System Prompt
**Decision**: Follow same pattern as other agents - markdown file with Handlebars templates.

- Prompt lives in `prompts/monologue.md` with `{{parameters}}`
- Agent implements type-safe handling via `PromptRegistry.formatMonologue(params)`
- Users can provide custom prompt but must follow same schema
- Default prompt describes: what agent sees, what it's doing, what it's planning

### RQ-002: Recording Granularity
**Decision**: Record at agent level (not runner level).

**Rationale**:
- Can export recording package for others building agents
- Standardizes fixtures and TDD process across ecosystem
- Enables sharing system prompts, commands, custom agents
- Makes it easier for others to adopt Open Harness patterns

### RQ-003: Multi-Agent Context Sharing
**Decision**: Harness defines state shape, agents read from `loadContext()`.

The harness is the orchestration layer that owns state. Options for how this looks are explored in the plan phase (see plan.md AD-005).

### RQ-004: Timeout Handling
**Decision**: Both per-agent and per-workflow timeouts.

- **Per-agent timeout**: Default timeout per agent (e.g., 60s), overridable per-call
- **Per-workflow timeout**: Overall cap for entire workflow execution
- Agent timeout fires first if hit, workflow timeout is safety net
- Timeouts emit error callbacks, don't throw (let caller decide)

---

## Dependencies

- `@anthropic-ai/claude-agent-sdk` ^0.1.76 - Claude SDK
- `@needle-di/core` ^1.1.0 - Dependency injection
- `zod` ^4.2.1 - Schema validation
- `bun` - Runtime and test framework

---

## Out of Scope

- Non-Anthropic providers (future, architecture supports it)
- Persistent storage for harness state (future)
- Web UI for monitoring (separate project)
- Authentication/authorization (user concern)
