# Feature Specification: Fluent Harness DX

**Feature Branch**: `006-fluent-harness-dx`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User feedback: "createContainer() exposes DI internals, event bus subscription is verbose, logging is mixed with business logic"

## Overview

The current harness development experience exposes infrastructure concerns to workflow authors. Users must manually call `createContainer()`, use `container.get()` for agents, subscribe to event buses, and mix logging calls with business logic.

This feature introduces a `defineHarness()` fluent builder API that:
1. Hides DI container creation entirely
2. Declares agents as typed configuration
3. Moves event handling to configuration (auto-cleanup)
4. Separates business logic (execute) from presentation (event subscribers)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero DI Exposure (Priority: P1)

As a workflow author, I want to define harnesses without knowing about dependency injection so that I can focus on business logic instead of infrastructure.

**Why this priority**: The current `createContainer()` + `container.get()` pattern is the primary DX complaint. Eliminating it is the core value of this feature.

**Independent Test**: Write a harness using `defineHarness()`. Verify compilation succeeds and runtime works without any imports from `@needle-di/core` or use of `createContainer`.

**Acceptance Scenarios**:

1. **Given** a developer creating a new harness, **When** they use `defineHarness()`, **Then** they never see `Container`, `createContainer`, or `container.get()` in their code.
2. **Given** a harness definition with agent classes, **When** `harness.create()` is called, **Then** agents are automatically resolved and injected.
3. **Given** the harness is running, **When** an agent is used, **Then** the agent has all its dependencies (runner, event bus) properly injected.

---

### User Story 2 - Typed Agent Access (Priority: P1)

As a workflow author, I want to declare agents in configuration and access them with full type inference so that I get autocomplete and compile-time safety.

**Why this priority**: Type safety prevents runtime errors and enables IDE support. If agents are loosely typed, the DX improvement is negated.

**Independent Test**: Define a harness with `agents: { planner: PlannerAgent, coder: CodingAgent }`. In the execute function, verify that `agents.planner.plan()` has correct return type inference.

**Acceptance Scenarios**:

1. **Given** agents declared as `{ planner: PlannerAgent }`, **When** I access `agents.planner` in execute(), **Then** TypeScript infers `PlannerAgent` type.
2. **Given** agents declared in config, **When** I call a method on an agent, **Then** IDE autocomplete shows all available methods with correct signatures.
3. **Given** I mistype an agent name like `agents.plannner`, **When** TypeScript compiles, **Then** a type error is raised at compile time.

---

### User Story 3 - Declarative Event Handling (Priority: P1)

As a workflow author, I want to configure event handlers at harness creation so that I don't manually subscribe/unsubscribe to event buses.

**Why this priority**: Manual event bus subscription leads to cleanup bugs and boilerplate. Declarative config ensures proper lifecycle management.

**Independent Test**: Create a harness with `events: { onNarrative: true }` and call `harness.on('narrative', callback)`. Run the harness and verify:
1. Callbacks are invoked during execution
2. No explicit `unsubscribe()` call is needed
3. After `run()` completes, callbacks are automatically cleaned up

**Acceptance Scenarios**:

1. **Given** event handlers registered via `harness.on()`, **When** agents emit events during execution, **Then** handlers are called with typed event data.
2. **Given** a harness that has completed execution, **When** run() returns, **Then** all event subscriptions are automatically cleaned up.
3. **Given** multiple event types (narrative, phase, step), **When** different handlers are registered, **Then** each receives only its event type.

---

### User Story 4 - Separation of Concerns (Priority: P1)

As a workflow author, I want my execute() function to contain only business logic so that rendering/logging is handled externally.

**Why this priority**: Mixing `console.log` with business logic violates single responsibility. Clean separation enables testing business logic independently from presentation.

**Independent Test**: Write a harness execute() function that uses only `emit()` calls (no console.log, no p.log). Register an external handler that logs. Verify output matches expected logs.

**Acceptance Scenarios**:

1. **Given** an execute function that emits structured events, **When** no handlers are registered, **Then** execution succeeds silently (no output, no errors).
2. **Given** an execute function that emits events, **When** a logging handler is registered, **Then** all output comes from the handler, not the harness.
3. **Given** a test environment, **When** I run a harness without event handlers, **Then** I can assert on state changes without parsing console output.

---

### User Story 5 - State Factory Pattern (Priority: P2)

As a workflow author, I want to define initial state as a function of input parameters so that I can create parameterized harnesses.

**Why this priority**: Static initial state limits reusability. Factory pattern enables creating multiple harness instances with different inputs.

**Independent Test**: Define a harness with `state: (input: { prd: string }) => ({ prd: input.prd, tickets: [] })`. Create two instances with different PRDs. Verify each has its own isolated state.

**Acceptance Scenarios**:

1. **Given** a state factory function, **When** I create a harness with `harness.create({ prd: "task A" })`, **Then** initial state contains "task A".
2. **Given** two harness instances created from the same definition, **When** one modifies state, **Then** the other's state is unaffected.
3. **Given** a state factory with complex initialization, **When** harness.create() is called, **Then** the factory runs once and result is cached for that instance.

---

### User Story 6 - Mode Configuration (Priority: P2)

As a developer writing tests, I want to specify mode (live/replay) in the harness definition so that tests can use replay mode with recordings.

**Why this priority**: Testability without real LLM calls is essential. Mode should be declarative, not imperative container manipulation.

**Independent Test**: Define a harness with `mode: 'replay'`. Create and run it. Verify agents use replay runners without any manual container configuration.

**Acceptance Scenarios**:

1. **Given** a harness definition with `mode: 'live'`, **When** agents execute, **Then** real API calls are made.
2. **Given** a harness definition with `mode: 'replay'`, **When** agents execute, **Then** replay runners are used.
3. **Given** a harness definition with `mode: 'replay'`, **When** no recording exists, **Then** a clear error message indicates the missing recording.

---

### User Story 7 - Backward Compatibility (Priority: P2)

As a developer with existing harnesses, I want `BaseHarness` to remain available so that I don't have to migrate all my code at once.

**Why this priority**: Breaking changes harm adoption. Existing code must continue working while new code uses the improved API.

**Independent Test**: Run the existing `CodingWorkflowHarness` class unchanged. Verify it still works with `createContainer()` and `container.get()`.

**Acceptance Scenarios**:

1. **Given** existing code using `BaseHarness` and `createContainer()`, **When** upgrading SDK version, **Then** code compiles and runs without changes.
2. **Given** both APIs (BaseHarness and defineHarness), **When** using them in the same codebase, **Then** no conflicts or type errors occur.
3. **Given** the SDK exports, **When** I check index.ts, **Then** both `BaseHarness` and `defineHarness` are exported.

---

### Edge Cases

- **Empty agents config**: When no agents are declared, harness still works (state-only workflow).
- **Agent constructor injection fails**: When an agent's dependencies can't be resolved, clear error message names the agent and missing dependency.
- **Event handler throws**: When an event handler throws an error, execution continues and error is logged (events are non-critical).
- **emit() called after run() completes**: After run() finishes, emit() is a no-op (no error thrown).
- **Async state factory**: State factory must be synchronous to ensure deterministic initialization order.
- **Recursive agent calls**: When agent A calls agent B, each maintains separate event scopes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `defineHarness<TAgents, TState, TInput>()` function that returns a typed harness factory.
- **FR-002**: System MUST accept agent class constructors in config and resolve them to instances internally.
- **FR-003**: System MUST create and manage DI container internally with no user exposure.
- **FR-004**: System MUST provide `.create(input)` method that instantiates harness with state factory.
- **FR-005**: System MUST provide `.on(eventType, handler)` method for typed event subscription.
- **FR-006**: System MUST automatically unsubscribe all event handlers when run() completes.
- **FR-007**: System MUST provide `emit(eventType, data)` function in execute context.
- **FR-008**: System MUST forward narrative events from EventBus to harness event handlers.
- **FR-009**: System MUST support `mode: 'live' | 'replay'` configuration.
- **FR-010**: System MUST preserve full backward compatibility with existing `BaseHarness` usage.
- **FR-011**: System MUST provide typed access to state within execute context with update helpers.
- **FR-012**: System MUST support async generator pattern for execute() to enable step yields.

### Key Entities

- **HarnessDefinition**: Configuration object with name, mode, agents, state factory, events, and execute function.
- **HarnessFactory**: Return type of `defineHarness()`, with `create(input)` method.
- **HarnessInstance**: Running harness with `on()`, `run()`, and state access.
- **ExecuteContext**: Object passed to execute() containing `agents`, `state`, `emit()`, and `yield()`.
- **HarnessEvent**: Union type of all emittable events (phase, step, narrative, error).

### Type Definitions (Draft)

```typescript
// Configuration for defineHarness()
interface HarnessConfig<
  TAgents extends Record<string, AgentConstructor>,
  TState,
  TInput = void
> {
  name: string;
  mode: 'live' | 'replay';
  agents: TAgents;
  state: (input: TInput) => TState;
  events?: {
    onNarrative?: boolean;
    onPhase?: boolean;
    onStep?: boolean;
  };
  execute: (context: ExecuteContext<TAgents, TState>) => AsyncGenerator<StepYield>;
}

// Context passed to execute()
interface ExecuteContext<TAgents, TState> {
  agents: ResolvedAgents<TAgents>;  // Instances, not constructors
  state: TState;
  updateState: (updater: (s: TState) => TState) => void;
  emit: <E extends HarnessEventType>(type: E, data: HarnessEventData<E>) => void;
}

// Harness factory returned by defineHarness()
interface HarnessFactory<TAgents, TState, TInput> {
  create: (input: TInput) => HarnessInstance<TState>;
}

// Running harness instance
interface HarnessInstance<TState> {
  on: <E extends HarnessEventType>(type: E, handler: HarnessEventHandler<E>) => this;
  run: () => Promise<HarnessResult<TState>>;
  getState: () => TState;
}

// Event types
type HarnessEventType = 'phase' | 'step' | 'narrative' | 'error';

interface PhaseEvent {
  name: string;
  status: 'start' | 'complete';
  data?: Record<string, unknown>;
}

interface StepEvent {
  step: string;
  input: unknown;
  output: unknown;
}

interface NarrativeEvent {
  agent: string;
  text: string;
  timestamp: Date;
}

interface ErrorEvent {
  message: string;
  cause?: unknown;
}
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `harnesses/coding` workflow is rewritten using `defineHarness()` with 50%+ reduction in lines of code.
- **SC-002**: Zero imports from `@needle-di/core` in the new harness code.
- **SC-003**: All agent method calls have full type inference (verified by IDE tooltip inspection).
- **SC-004**: The new harness passes all existing functionality tests (same behavior, better DX).
- **SC-005**: Unit tests for HarnessFactory and HarnessInstance achieve 90%+ coverage.
- **SC-006**: Event handlers are auto-cleaned up on run() completion (verified by spy in tests).
- **SC-007**: `BaseHarness` and `createContainer` continue to work unchanged (backward compat test passes).
- **SC-008**: **Ultimate Test** - The coding workflow runs with `bun harnesses/coding/src/index.ts`, produces visible narrative output, and completes all phases successfully using the new API.

## Internal Architecture

This section documents the current state (messy), target state (clean), and implementation patterns required to build `defineHarness()` correctly.

### Current Architecture (The Problem)

The codebase has **three parallel systems** for event handling that don't communicate:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE (MESSY)                         │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   AGENTS    │
                              │ Parser      │
                              │ Coder       │
                              │ Reviewer    │
                              └──────┬──────┘
                                     │
                         AgentEvent (SDK-level)
                         • tool_call, tool_result
                         • text, thinking
                         • session_start/end
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
   ┌──────────┐              ┌──────────────┐            ┌──────────────┐
   │ EventBus │              │  Callbacks   │            │  Recording   │
   │ (pub/sub)│              │  (direct)    │            │  (decorator) │
   └────┬─────┘              └──────┬───────┘            └──────┬───────┘
        │                           │                           │
        │ ❌ NOT CONNECTED          │                           │
        │    TO RENDERER            │                           │
        ▼                           ▼                           ▼
   [NOWHERE]                 [Script caller]              [JSONL files]


                              ┌─────────────┐
                              │ TaskHarness │
                              │ (orchestrator)│
                              └──────┬──────┘
                                     │
                    HarnessEvent (task-level)
                    • task:start, task:complete
                    • phase:start, phase:complete
                    • validation:start/complete
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
   ┌──────────┐              ┌──────────────┐            ┌──────────────┐
   │ Renderer │              │  Callbacks   │            │  Recorder    │
   │ (terminal)│             │  (direct)    │            │  (state.jsonl)│
   └──────────┘              └──────────────┘            └──────────────┘


                              ┌─────────────┐
                              │ TaskHarness │
                              │.emitNarrative()│
                              └──────┬──────┘
                                     │
                              NarrativeEntry
                              • "Starting task T001..."
                              • "Validation passed"
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
   ┌──────────┐              ┌──────────────┐            ┌──────────────┐
   │ Renderer │              │  Callbacks   │            │  Recorder    │
   │(task:narrative)│        │.onNarrative()│            │.recordNarrative()│
   └──────────┘              └──────────────┘            └──────────────┘
        │                           │                           │
        └───────────────────────────┴───────────────────────────┘
                                     │
                        ❌ THREE COPIES OF SAME DATA
```

**Problems with current architecture:**

| Problem | Description |
|---------|-------------|
| **No bridge** | AgentEvents (what Claude is doing) never reach the Renderer |
| **Triple storage** | Narratives stored in 3 places with possible drift |
| **Two event types** | `AgentEvent` vs `HarnessEvent` don't connect |
| **emitNarrative confusion** | Used for both harness STATUS and agent NARRATIVES |
| **Manual cleanup** | Callbacks require explicit unsubscribe, often forgotten |

### Target Architecture (The Solution)

**Principle**: EventBus is the single source of truth. Everything else subscribes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TARGET ARCHITECTURE (CLEAN)                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   AGENTS    │
                              │ @Monologue  │◄── Decorator generates narratives
                              └──────┬──────┘
                                     │
                              AgentEvent
                                     │
                                     ▼
                              ┌─────────────┐
                              │  EventBus   │◄── SINGLE source of truth
                              │  (unified)  │
                              └──────┬──────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
   ┌──────────────┐          ┌──────────────┐            ┌──────────────┐
   │  Monologue   │          │  Recording   │            │  Harness     │
   │  Service     │          │  Subscriber  │            │  Subscriber  │
   └──────┬───────┘          └──────────────┘            └──────┬───────┘
          │                                                      │
          │ LLM generates                                        │
          │ narrative                                            │
          ▼                                                      │
   ┌──────────────┐                                              │
   │ NARRATIVE    │                                              │
   │ event emitted│◄─────────────────────────────────────────────┘
   └──────┬───────┘      Harness subscribes via .on()
          │
          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                      EVENT STREAM                           │
   │                                                             │
   │  agent:thinking ──► (buffered by Monologue, not shown)     │
   │  agent:tool_call ──► (buffered by Monologue, not shown)    │
   │  agent:narrative ──► "I'm reading the config file..."     │◄── SHOWN
   │  harness:status ──► "Task T001 starting"                  │◄── SHOWN
   │  task:complete ──► ✓ T001                                 │◄── SHOWN
   │                                                             │
   └─────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │   RENDERER   │
   │  (subscriber)│
   │              │
   │  harness.on()│◄── User-registered handlers
   │  filters by  │
   │  event type  │
   └──────────────┘
```

### Event Type Taxonomy

The system has two layers of events that must be unified:

**Layer 1: Agent Events (from Claude SDK)**
```typescript
type AgentEventType =
  | "session_start" | "session_end"    // Lifecycle
  | "thinking" | "text"                 // Agent output
  | "tool_call" | "tool_result"         // Tool usage
  | "tool_progress"                     // Streaming progress
  | "monologue";                        // LLM-generated narrative (from @Monologue)
```

**Layer 2: Harness Events (from TaskHarness)**
```typescript
type HarnessEventType =
  | "harness:start" | "harness:complete" | "harness:error"  // Harness lifecycle
  | "phase:start" | "phase:complete"                         // Phase grouping
  | "task:start" | "task:complete" | "task:failed"           // Task execution
  | "task:narrative"                                         // Narrative entry
  | "validation:start" | "validation:complete";              // Validation loop
```

**Unified Event Stream (Target)**
```typescript
// All events flow through EventBus with consistent structure
interface UnifiedEvent {
  type: string;           // e.g., "agent:narrative", "harness:status", "task:complete"
  source: string;         // e.g., "Parser", "Harness", "Monologue"
  timestamp: Date;
  payload: unknown;       // Type-specific data
  metadata?: {
    taskId?: string;
    sessionId?: string;
    importance?: "critical" | "important" | "detailed";
  };
}
```

### Key Distinction: Status vs Narrative

The current `emitNarrative()` conflates two different concepts:

| Type | Source | Voice | Example | Should Be |
|------|--------|-------|---------|-----------|
| **Harness Status** | TaskHarness | Third-person | "Task T001 starting" | `harness:status` event |
| **Agent Narrative** | @Monologue | First-person | "I'm reading the config..." | `agent:narrative` event |

**Current (Wrong)**:
```typescript
// Both use the same method - confusing!
this.emitNarrative("Harness", "Starting task T001", taskId);     // Status
this.emitNarrative("Parser", "I found 5 dependencies", taskId);  // Narrative
```

**Target (Correct)**:
```typescript
// Distinct event types
this.eventBus.publish({ type: "harness:status", message: "Starting task T001" });
// Narratives come automatically from @Monologue decorator via EventBus
```

### Implementation Patterns

#### Pattern 1: Callbacks as EventBus Adapter

Callbacks don't go away - they become a thin wrapper over EventBus subscription:

```typescript
// OLD: TaskHarness manually calls both (WRONG)
class TaskHarness {
  async executeTask(task, callbacks) {
    callbacks?.onTaskStart?.(task);           // Manual call #1
    this.eventBus.publish({ ... });           // Manual call #2
    this.renderer.handleEvent({ ... });       // Manual call #3
  }
}

// NEW: TaskHarness only publishes to EventBus (CORRECT)
class TaskHarness {
  async executeTask(task) {
    this.eventBus.publish({ type: "task:start", task });  // ONLY this
  }
}

// Callbacks become a subscriber helper for convenience
function createCallbackAdapter(
  eventBus: IEventBus,
  callbacks: ITaskHarnessCallbacks
): () => void {
  return eventBus.subscribe((event) => {
    switch (event.type) {
      case "task:start":
        callbacks.onTaskStart?.(event.task);
        break;
      case "task:complete":
        callbacks.onTaskComplete?.(event.task, event.result);
        break;
      case "task:narrative":
        callbacks.onNarrative?.(event.entry);
        break;
    }
  });
}
```

#### Pattern 2: Renderer as EventBus Subscriber

The Renderer stops receiving direct calls and subscribes to EventBus:

```typescript
// OLD: Direct calls from TaskHarness (WRONG)
class TaskHarness {
  private renderer: IHarnessRenderer;

  emitEvent(event: HarnessEvent) {
    this.renderer?.handleEvent(event);  // Direct coupling
  }
}

// NEW: Renderer subscribes to EventBus (CORRECT)
class RendererSubscriber {
  constructor(eventBus: IEventBus, renderer: IHarnessRenderer) {
    eventBus.subscribe((event) => {
      if (this.isDisplayable(event)) {
        renderer.handleEvent(this.toHarnessEvent(event));
      }
    });
  }

  private isDisplayable(event: UnifiedEvent): boolean {
    return ["agent:narrative", "harness:status", "task:start",
            "task:complete", "phase:start", "phase:complete"].includes(event.type);
  }
}
```

#### Pattern 3: defineHarness() Orchestrates Subscriptions

The `defineHarness()` factory manages all subscriptions internally:

```typescript
function defineHarness<TAgents, TState, TInput>(config: HarnessConfig) {
  return {
    create(input: TInput) {
      // Internal: create container, resolve agents
      const container = createContainer({ mode: config.mode });
      const eventBus = container.get(IEventBusToken);
      const agents = resolveAgents(container, config.agents);

      // Internal: subscription management
      const subscriptions: (() => void)[] = [];

      return {
        on(eventType, handler) {
          // Subscribe to EventBus with filter
          const unsub = eventBus.subscribe(
            (event) => handler(event.payload),
            { eventTypes: [eventType] }
          );
          subscriptions.push(unsub);
          return this;
        },

        async run() {
          try {
            // Run execute generator
            for await (const step of config.execute({ agents, state, emit })) {
              // Process yields
            }
          } finally {
            // Auto-cleanup ALL subscriptions
            subscriptions.forEach(unsub => unsub());
          }
        }
      };
    }
  };
}
```

### Implementation Prerequisites

Before implementing `defineHarness()`, these internal changes must happen:

| Step | Change | Why |
|------|--------|-----|
| 1 | Unify event types | Single `UnifiedEvent` interface for both layers |
| 2 | TaskHarness → EventBus only | Remove direct renderer/callback calls |
| 3 | Create RendererSubscriber | Renderer subscribes to EventBus |
| 4 | Create CallbackAdapter | Callbacks wrap EventBus subscription |
| 5 | Deprecate emitNarrative() | Replace with typed event emission |
| 6 | Add event type filters | EventBus supports filtering by type prefix |

### Relationship to @Monologue System (005)

The monologue system (feature 005) is already built correctly:
- `@Monologue` decorator subscribes to EventBus for agent events
- Buffers events, calls LLM to generate narrative
- Emits `agent:narrative` event back to EventBus

The missing piece is the **bridge to rendering**:
- Currently: Monologue emits to EventBus, but Renderer doesn't subscribe
- Target: Renderer subscribes to EventBus, receives narrative events automatically

```
@Monologue ──► EventBus ──► [MISSING BRIDGE] ──► Renderer

After this feature:
@Monologue ──► EventBus ──► RendererSubscriber ──► Renderer
                   │
                   └──► harness.on('narrative', ...) ──► User handlers
```

## Assumptions

- The existing `createContainer()` infrastructure is stable and can be wrapped without modification.
- Agent classes use `@injectable()` decorator and can be resolved via `container.get(AgentClass)`.
- The `IEventBus` interface supports the filtering needed for event routing.
- Generators (`async *execute()`) are the right abstraction for step-yielding workflows.
- State management via `updateState()` is sufficient (no need for more complex state patterns).

## Non-Goals

- This feature does NOT add new agent capabilities or modify existing agents.
- This feature does NOT change the underlying DI system (needle-di).
- This feature does NOT add new event types (uses existing EventBus infrastructure).
- This feature does NOT modify the recording/replay system.

## Migration Path

1. **Phase 1**: Implement `defineHarness()` alongside existing `BaseHarness`.
2. **Phase 2**: Migrate `harnesses/coding` to use new API as proof-of-concept.
3. **Phase 3**: Update documentation with new recommended patterns.
4. **Phase 4** (future): Deprecate direct `createContainer()` usage in favor of factory patterns.

## API Examples

### Before (Current API)

```typescript
// 96 lines of boilerplate
import { BaseHarness, createContainer, IEventBusToken, PlannerAgent, CodingAgent } from '@openharness/sdk';

class CodingWorkflowHarness extends BaseHarness<CodingState, WorkflowInput, WorkflowOutput> {
  private planner: PlannerAgent;
  private coder: CodingAgent;
  private unsubscribeNarrative: (() => void) | null = null;

  constructor(prd: string) {
    super({ initialState: { phase: 'planning', prd, tickets: [] } });

    // DI exposure
    const container = createContainer({ mode: 'live' });
    this.planner = container.get(PlannerAgent);
    this.coder = container.get(CodingAgent);

    // Manual event subscription
    const eventBus = container.get(IEventBusToken);
    this.unsubscribeNarrative = eventBus.subscribe(
      (event) => console.log(`[${event.agent_name}] ${event.content}`),
      { eventTypes: ['monologue'] }
    );
  }

  protected async *execute() {
    // Mixed logging and business logic
    console.log('=== Phase 1: Planning ===');
    const result = await this.planner.plan(this.state.prd);
    console.log(`Generated ${result.tickets.length} tickets`);
    yield { input: {...}, output: result };
    // ... more phases
  }

  cleanup() {
    if (this.unsubscribeNarrative) {
      this.unsubscribeNarrative();
    }
  }
}

// Usage
const harness = new CodingWorkflowHarness(prd);
try {
  await harness.run();
} finally {
  harness.cleanup();
}
```

### After (New API)

```typescript
// 40 lines, focused on business logic
import { defineHarness, PlannerAgent, CodingAgent } from '@openharness/sdk';

const CodingWorkflow = defineHarness({
  name: 'coding-workflow',
  mode: 'live',

  agents: {
    planner: PlannerAgent,
    coder: CodingAgent,
  },

  state: (input: { prd: string }) => ({
    phase: 'planning' as const,
    prd: input.prd,
    tickets: [] as Ticket[],
  }),

  async *execute({ agents, state, updateState, emit }) {
    emit('phase', { name: 'planning', status: 'start' });

    const result = await agents.planner.plan(state.prd);
    updateState(s => ({ ...s, tickets: result.tickets, phase: 'execution' }));

    emit('phase', { name: 'planning', status: 'complete', data: { count: result.tickets.length } });
    yield { step: 'plan', input: state.prd, output: result };

    // ... more phases
  },
});

// Usage - rendering is external
const harness = CodingWorkflow.create({ prd });
harness.on('phase', (e) => console.log(`=== ${e.name}: ${e.status} ===`));
harness.on('narrative', (e) => console.log(`[${e.agent}] ${e.text}`));
await harness.run();  // Auto-cleanup on completion
```
