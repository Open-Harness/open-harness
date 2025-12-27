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

### Type Definitions (Resolved)

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Level 1: wrapAgent (one-liner)
// ─────────────────────────────────────────────────────────────────────────────

function wrapAgent<TAgent extends AgentConstructor>(
  agentClass: TAgent
): WrappedAgent<InstanceType<TAgent>>;

interface WrappedAgent<TAgent> {
  on: <E extends HarnessEventType>(type: E, handler: HarnessEventHandler<E>) => this;
  run: (...args: Parameters<TAgent['execute']>) => Promise<ReturnType<TAgent['execute']>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Level 2 & 3: defineHarness
// ─────────────────────────────────────────────────────────────────────────────

// Configuration for defineHarness() - supports both run: and execute: (mutually exclusive)
interface HarnessConfig<
  TAgents extends Record<string, AgentConstructor>,
  TState = {},
  TInput = void,
  TResult = void
> {
  // Optional with defaults
  name?: string;                        // Default: 'anonymous-harness'
  mode?: 'live' | 'replay';             // Default: 'live'

  // Required
  agents: TAgents;

  // Optional state factory (defaults to empty object)
  state?: (input: TInput) => TState;

  // EITHER run: OR execute: (mutually exclusive)
  run?: (
    context: ExecuteContext<TAgents, TState>,
    input: TInput
  ) => Promise<TResult>;

  execute?: (
    context: ExecuteContext<TAgents, TState>
  ) => AsyncGenerator<StepYield, TResult>;
}

// Context passed to both run() and execute()
interface ExecuteContext<TAgents, TState> {
  agents: ResolvedAgents<TAgents>;      // Instances, not constructors
  state: TState;                         // Mutable state object

  // Event helpers (auto start/complete)
  phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;

  // Escape hatch for custom events
  emit: (type: string, data: Record<string, unknown>) => void;
}

// Type helper: converts agent constructors to instances
type ResolvedAgents<T extends Record<string, AgentConstructor>> = {
  [K in keyof T]: InstanceType<T[K]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Harness Factory and Instance
// ─────────────────────────────────────────────────────────────────────────────

// Factory returned by defineHarness()
interface HarnessFactory<TState, TInput, TResult> {
  create: (input: TInput) => HarnessInstance<TState, TResult>;
}

// Running harness instance
interface HarnessInstance<TState, TResult> {
  // Chainable event subscription
  on: <E extends HarnessEventType>(type: E, handler: HarnessEventHandler<E>) => this;

  // Execute the harness
  run: () => Promise<HarnessResult<TState, TResult>>;

  // Access current state
  readonly state: TState;
}

// Result of harness.run()
interface HarnessResult<TState, TResult> {
  result: TResult;
  state: TState;
  events: HarnessEvent[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

type HarnessEventType = 'phase' | 'task' | 'step' | 'narrative' | 'error' | '*';

interface PhaseEvent {
  type: 'phase';
  name: string;
  status: 'start' | 'complete';
  data?: Record<string, unknown>;
}

interface TaskEvent {
  type: 'task';
  id: string;
  status: 'start' | 'complete' | 'failed';
  data?: Record<string, unknown>;
}

interface StepEvent {
  type: 'step';
  step: string;
  input: unknown;
  output: unknown;
}

interface NarrativeEvent {
  type: 'narrative';
  agent: string;
  text: string;
  timestamp: Date;
}

interface ErrorEvent {
  type: 'error';
  message: string;
  cause?: unknown;
}

type HarnessEvent = PhaseEvent | TaskEvent | StepEvent | NarrativeEvent | ErrorEvent;

// Step yield (for execute: generator)
interface StepYield {
  step: string;
  input?: unknown;
  output?: unknown;
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

### After (New API - using run:)

```typescript
// 35 lines, focused on business logic
import { defineHarness, PlannerAgent, CodingAgent } from '@openharness/sdk';

const CodingWorkflow = defineHarness({
  name: 'coding-workflow',

  agents: {
    planner: PlannerAgent,
    coder: CodingAgent,
  },

  state: (input: { prd: string }) => ({
    prd: input.prd,
    tickets: [] as Ticket[],
  }),

  // Using run: for simple async function (no generator)
  run: async ({ agents, state, phase, task }) => {
    await phase('Planning', async () => {
      const result = await agents.planner.plan(state.prd);
      state.tickets = result.tickets;
      return { count: result.tickets.length };
    });

    await phase('Execution', async () => {
      for (const ticket of state.tickets) {
        await task(ticket.id, async () => {
          const result = await agents.coder.execute(ticket.description);
          return { success: result.success };
        });
      }
    });

    return state.tickets;
  },
});

// Usage - rendering is external, auto-cleanup on completion
const harness = CodingWorkflow.create({ prd });
harness
  .on('phase', (e) => console.log(`=== ${e.name}: ${e.status} ===`))
  .on('narrative', (e) => console.log(`[${e.agent}] ${e.text}`));
await harness.run();
```

### After (New API - using execute: with yields)

```typescript
// Same workflow, but with step recording via yields
import { defineHarness, PlannerAgent, CodingAgent } from '@openharness/sdk';

const CodingWorkflow = defineHarness({
  name: 'coding-workflow',

  agents: {
    planner: PlannerAgent,
    coder: CodingAgent,
  },

  state: (input: { prd: string }) => ({
    prd: input.prd,
    tickets: [] as Ticket[],
  }),

  // Using execute: for generator with yields (step recording)
  async *execute({ agents, state, phase, task }) {
    const planResult = await phase('Planning', async () => {
      const result = await agents.planner.plan(state.prd);
      state.tickets = result.tickets;
      return result;
    });

    yield { step: 'plan', input: state.prd, output: planResult };

    await phase('Execution', async () => {
      for (const ticket of state.tickets) {
        const codeResult = await task(ticket.id, async () => {
          return agents.coder.execute(ticket.description);
        });

        yield { step: `code-${ticket.id}`, input: ticket, output: codeResult };
      }
    });
  },
});

// Usage - identical to run: version
const harness = CodingWorkflow.create({ prd });
harness
  .on('phase', (e) => console.log(`=== ${e.name}: ${e.status} ===`))
  .on('narrative', (e) => console.log(`[${e.agent}] ${e.text}`));
await harness.run();
```

---

## Ultimate Test: Full Coding Workflow

This is the north star - what the complete DX looks like with all features implemented. This example serves as the regression test for the entire feature.

### Complete Implementation (~50 lines of business logic)

```typescript
// harnesses/coding/src/index.ts
//
// A complete coding workflow. No DI exposure, no manual subscriptions, no mixed concerns.

import { defineHarness, ParserAgent, CodingAgent, ReviewAgent } from '@openharness/sdk';

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Define the harness (pure configuration)
// ─────────────────────────────────────────────────────────────────────────────

const CodingWorkflow = defineHarness({
  name: 'coding-workflow',

  // Agents are declared, not manually resolved
  agents: {
    parser: ParserAgent,
    coder: CodingAgent,
    reviewer: ReviewAgent,
  },

  // State factory - creates fresh state per run
  state: (input: { tasksPath: string }) => ({
    tasksPath: input.tasksPath,
    tasks: [] as ParsedTask[],
    results: [] as TaskResult[],
  }),

  // Pure business logic using run: (async function)
  run: async ({ agents, state, phase, task, emit }) => {

    // ───── Phase 1: Parse Tasks ─────
    await phase('Parsing', async () => {
      const parsed = await agents.parser.parseFile(state.tasksPath);
      state.tasks = parsed.tasks;  // Mutable state - simple!
      return { count: parsed.tasks.length };
    });

    // ───── Phase 2: Execute Each Task ─────
    await phase('Execution', async () => {
      for (const t of state.tasks) {
        if (t.status === 'complete') continue;

        // task() helper auto-emits task:start and task:complete
        await task(t.id, async () => {
          // Coder works on the task (narratives flow automatically via @Monologue)
          const result = await agents.coder.execute(t.description, `task-${t.id}`);

          // Reviewer validates (narratives flow automatically)
          const review = await agents.reviewer.review(
            t.description,
            result.summary,
            `review-${t.id}`
          );

          state.results.push({ task: t, result, review, passed: review.passed });
          return { passed: review.passed };
        });
      }
    });

    // ───── Summary ─────
    const passed = state.results.filter(r => r.passed).length;
    const failed = state.results.filter(r => !r.passed).length;
    emit('summary', { total: state.tasks.length, passed, failed });

    return state.results;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVE: Using execute: with yields for step recording
// ─────────────────────────────────────────────────────────────────────────────

const CodingWorkflowWithYields = defineHarness({
  name: 'coding-workflow',
  agents: { parser: ParserAgent, coder: CodingAgent, reviewer: ReviewAgent },
  state: (input: { tasksPath: string }) => ({
    tasksPath: input.tasksPath,
    tasks: [] as ParsedTask[],
    results: [] as TaskResult[],
  }),

  async *execute({ agents, state, phase, task, emit }) {
    // Phase 1: Parse
    const parsed = await phase('Parsing', async () => {
      const result = await agents.parser.parseFile(state.tasksPath);
      state.tasks = result.tasks;
      return result;
    });
    yield { step: 'parse', input: state.tasksPath, output: parsed };

    // Phase 2: Execute
    await phase('Execution', async () => {
      for (const t of state.tasks) {
        if (t.status === 'complete') continue;

        await task(t.id, async () => {
          const result = await agents.coder.execute(t.description, `task-${t.id}`);
          yield { step: `code-${t.id}`, input: t, output: result };

          const review = await agents.reviewer.review(t.description, result.summary, `review-${t.id}`);
          yield { step: `review-${t.id}`, input: result, output: review };

          state.results.push({ task: t, result, review, passed: review.passed });
          return { passed: review.passed };
        });
      }
    });

    // Summary
    const passed = state.results.filter(r => r.passed).length;
    const failed = state.results.filter(r => !r.passed).length;
    emit('summary', { total: state.tasks.length, passed, failed });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Create instance and attach rendering (completely separate)
// ─────────────────────────────────────────────────────────────────────────────

const harness = CodingWorkflow.create({
  tasksPath: './specs/my-feature/tasks.md'
});

// Rendering is external - attach whatever UI you want
harness
  .on('phase', (e) => {
    if (e.status === 'start') console.log(`\n${'═'.repeat(50)}`);
    console.log(`  ${e.status === 'start' ? '▶' : '✓'} ${e.name}`);
    if (e.status === 'complete' && e.data) console.log(`    ${JSON.stringify(e.data)}`);
  })
  .on('task', (e) => {
    const icon = e.status === 'start' ? '○' : e.status === 'complete' ? '●' : '✗';
    console.log(`  ${icon} [${e.id}] ${e.description?.slice(0, 50) ?? e.status}`);
  })
  .on('narrative', (e) => {
    // These come from @Monologue on agents - first-person LLM summaries
    console.log(`    💭 [${e.agent}] ${e.text}`);
  })
  .on('summary', (e) => {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Summary: ${e.passed}/${e.total} passed, ${e.failed} failed`);
  });

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Run (auto-cleanup on completion)
// ─────────────────────────────────────────────────────────────────────────────

await harness.run();

// No cleanup needed - subscriptions auto-removed
// No try/finally - harness handles errors gracefully
```

### Expected Terminal Output

```
══════════════════════════════════════════════════
  ▶ Parsing
    💭 [Parser] I'm reading the tasks file to understand the work ahead...
    💭 [Parser] Found 5 tasks across 2 phases, with clear dependencies.
  ✓ Parsing
    {"count":5}

══════════════════════════════════════════════════
  ▶ Execution
  ○ [T001] Create user authentication module
    💭 [Coder] Starting with the auth module. I'll set up JWT tokens first...
    💭 [Coder] Writing the login endpoint with password hashing...
    💭 [Coder] Added refresh token logic for session management.
    💭 [Reviewer] Checking the implementation against requirements...
    💭 [Reviewer] Auth flow looks solid. Token expiry is correctly handled.
  ● [T001] Create user authentication module

  ○ [T002] Add password reset flow
    💭 [Coder] Now implementing password reset with email verification...
    💭 [Coder] Created secure token generation with 1-hour expiry.
    💭 [Reviewer] Validating the reset flow...
    💭 [Reviewer] Implementation matches spec. Security considerations addressed.
  ● [T002] Add password reset flow
  ✓ Execution

══════════════════════════════════════════════════
  Summary: 5/5 passed, 0 failed
```

### Testing Version (Same Harness, Different Mode)

```typescript
// Same workflow definition, replay mode for deterministic tests
const testHarness = CodingWorkflow.create({
  tasksPath: './fixtures/sample-tasks.md'
});

// Collect events instead of logging
const events: HarnessEvent[] = [];
testHarness.on('*', (e) => events.push(e));  // Wildcard subscription

await testHarness.run();

// Assert on structured events, not console output
expect(events.filter(e => e.type === 'task')).toHaveLength(5);
expect(events.find(e => e.type === 'summary')?.data.passed).toBe(5);
```

### DX Comparison Table

| Aspect | Before (Current) | After (Target) |
|--------|------------------|----------------|
| **Lines of code** | ~150 | ~50 |
| **DI exposure** | `createContainer()`, `container.get()` | None (hidden inside `defineHarness`) |
| **Event handling** | Manual `subscribe()`/`unsubscribe()` | `.on()` with auto-cleanup |
| **Phase/task events** | Manual `emit('phase', {start})` + `emit('phase', {complete})` | `phase()` / `task()` helpers |
| **State updates** | `updateState(s => ({...s, x}))` | Direct mutation: `state.x = y` |
| **Logging location** | Mixed in execute() | Separate handlers via `.on()` |
| **Narrative source** | Manual `emitNarrative()` | Automatic via `@Monologue` |
| **Error handling** | `try/finally { cleanup() }` | Built into `run()` |
| **Type safety** | Loose | Full inference on agents |
| **Testability** | Mock container setup | `mode: 'replay'` option |
| **API levels** | One size fits all | 3 levels: `wrapAgent` → simple → full |

---

## DX Exploration: Resolutions

All 5 DX questions have been explored and resolved. Below are the decisions with rationale.

### Decision Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Q1: Generator** | Dual API (`run:` + `execute:`) | Simple cases stay simple; complex cases have full power |
| **Q2: Events** | Hybrid (`phase()`/`task()` + `emit()`) | Helpers for common patterns; escape hatch for custom |
| **Q3: State** | Mutable state object | Simplest mental model; users can add immer if needed |
| **Q4: Minimal** | 3 progressive levels | `wrapAgent` → simple `defineHarness` → full `defineHarness` |
| **Q5: Control flow** | BYOL (bring your own library) | No SDK opinion; users pick their preferred tools |

---

### Resolution 1: Dual API for Execute Pattern

**Decision**: Support both `run:` (simple async function) and `execute:` (generator with yields).

```typescript
// SIMPLE: Just run logic, return result (no generator)
const SimpleWorkflow = defineHarness({
  agents: { coder: CodingAgent },
  run: async ({ agents, state, phase, emit }, input: string) => {
    return agents.coder.execute(input);
  }
});

// COMPLEX: Generator for yields/streaming/step recording
const ComplexWorkflow = defineHarness({
  agents: { parser: ParserAgent, coder: CodingAgent },
  async *execute({ agents, state, phase, task, emit }) {
    await phase('Parse', async () => {
      const result = await agents.parser.parseFile(state.path);
      state.tasks = result.tasks;
      return { count: result.tasks.length };
    });

    // yield for step recording (generator-only feature)
    yield { step: 'parse', input: state.path, output: state.tasks };

    for (const t of state.tasks) {
      const result = await agents.coder.execute(t.description);
      yield { step: `code-${t.id}`, input: t, output: result };
    }
  }
});
```

**Rationale**: Generators add value for pause points and streaming, but most harnesses just run through phases sequentially. Offer both paths.

---

### Resolution 2: Hybrid Event Pattern

**Decision**: Provide `phase()` and `task()` helpers for common patterns, plus raw `emit()` as escape hatch.

```typescript
async *execute({ agents, state, phase, task, emit }) {
  // phase() helper: auto-emits phase:start and phase:complete
  await phase('Parsing', async () => {
    const result = await agents.parser.parseFile(state.path);
    state.tasks = result.tasks;
    return { count: result.tasks.length };  // Becomes phase complete data
  });

  await phase('Execution', async () => {
    for (const t of state.tasks) {
      // task() helper: auto-emits task:start and task:complete
      await task(t.id, async () => {
        const codeResult = await agents.coder.execute(t.description);
        const review = await agents.reviewer.review(t.description, codeResult.summary);
        state.results.push({ task: t, codeResult, review });
        return { passed: review.passed };
      });
    }
  });

  // emit() escape hatch: custom events not covered by helpers
  emit('summary', { total: state.tasks.length, passed: state.results.filter(r => r.review.passed).length });
}
```

**Events emitted by helpers**:
- `phase('X', fn)` → `phase:start { name: 'X' }` → runs fn → `phase:complete { name: 'X', data: returnValue }`
- `task(id, fn)` → `task:start { id }` → runs fn → `task:complete { id, data: returnValue }`

**Rationale**: Eliminates the "forgot to emit complete" bug. Single call site for common patterns. Escape hatch preserves flexibility.

---

### Resolution 3: Mutable State

**Decision**: State is a plain mutable object. No `updateState()` needed.

```typescript
const Workflow = defineHarness({
  state: (input: { path: string }) => ({
    path: input.path,
    tasks: [] as Task[],
    results: [] as TaskResult[],
  }),

  async *execute({ agents, state }) {
    const parsed = await agents.parser.parseFile(state.path);

    // Direct mutation - simple!
    state.tasks = parsed.tasks;

    for (const task of state.tasks) {
      const result = await agents.coder.execute(task);
      state.results.push(result);  // Push directly
    }
  }
});

// Access state after run
const harness = Workflow.create({ path: './tasks.md' });
await harness.run();
console.log(harness.state.tasks);  // Current state
```

**Rationale**: Immutable updates add complexity without clear benefit for harness use cases. Users who need immutability can use immer themselves.

---

### Resolution 4: Three Progressive API Levels

**Decision**: Support three levels of API complexity with sensible defaults.

#### Level 1: Single-Agent Wrapper (One-liner)

```typescript
import { wrapAgent, CodingAgent } from '@openharness/sdk';

// Absolute minimum - wrap any agent
const result = await wrapAgent(CodingAgent).run('Write a hello world function');
console.log(result.summary);

// With event handling
await wrapAgent(CodingAgent)
  .on('narrative', (e) => console.log(`💭 ${e.text}`))
  .run('Write a hello world function');
```

#### Level 2: Simple defineHarness (Minimal Config)

```typescript
const SimpleWorkflow = defineHarness({
  agents: { coder: CodingAgent },
  run: async ({ agents }, input: string) => agents.coder.execute(input),
});

const result = await SimpleWorkflow.create().run('Build a todo app');

// Defaults applied:
// - name: 'anonymous-harness'
// - mode: 'live'
// - state: () => ({})
```

#### Level 3: Full defineHarness (Complete API)

```typescript
const CodingWorkflow = defineHarness({
  name: 'coding-workflow',
  mode: 'live',

  agents: {
    parser: ParserAgent,
    coder: CodingAgent,
    reviewer: ReviewAgent,
  },

  state: (input: { path: string }) => ({
    path: input.path,
    tasks: [] as Task[],
    results: [] as TaskResult[],
  }),

  // Using run: (async function)
  run: async ({ agents, state, phase, task, emit }) => {
    await phase('Parse', async () => {
      const parsed = await agents.parser.parseFile(state.path);
      state.tasks = parsed.tasks;
      return { count: parsed.tasks.length };
    });

    await phase('Execute', async () => {
      for (const t of state.tasks) {
        await task(t.id, async () => {
          const codeResult = await agents.coder.execute(t.description);
          const review = await agents.reviewer.review(t.description, codeResult.summary);
          state.results.push({ task: t, codeResult, review });
          return { passed: review.passed };
        });
      }
    });

    emit('summary', {
      total: state.tasks.length,
      passed: state.results.filter(r => r.review.passed).length
    });

    return state.results;
  }
});

// OR using execute: (generator for step recording)
const CodingWorkflowWithYields = defineHarness({
  name: 'coding-workflow',
  mode: 'live',
  agents: { parser: ParserAgent, coder: CodingAgent, reviewer: ReviewAgent },
  state: (input: { path: string }) => ({
    path: input.path,
    tasks: [] as Task[],
    results: [] as TaskResult[],
  }),

  async *execute({ agents, state, phase, task, emit }) {
    const parsed = await phase('Parse', async () => {
      const result = await agents.parser.parseFile(state.path);
      state.tasks = result.tasks;
      return result;
    });

    yield { step: 'parse', input: state.path, output: parsed };

    await phase('Execute', async () => {
      for (const t of state.tasks) {
        const result = await task(t.id, async () => {
          const codeResult = await agents.coder.execute(t.description);
          yield { step: `code-${t.id}`, input: t, output: codeResult };

          const review = await agents.reviewer.review(t.description, codeResult.summary);
          yield { step: `review-${t.id}`, input: codeResult, output: review };

          state.results.push({ task: t, codeResult, review });
          return { passed: review.passed };
        });
      }
    });

    emit('summary', {
      total: state.tasks.length,
      passed: state.results.filter(r => r.review.passed).length
    });
  }
});
```

**Rationale**: Progressive disclosure - users start simple and add complexity only when needed.

---

### Resolution 5: BYOL for Control Flow

**Decision**: No SDK opinion on retry/parallel/timeout. Users bring their own libraries.

```typescript
import pRetry from 'p-retry';
import pLimit from 'p-limit';

async *execute({ agents, state, phase }) {
  await phase('Execute', async () => {
    // Use any retry library
    const result = await pRetry(
      () => agents.coder.execute(state.task),
      { retries: 3 }
    );

    // Use any concurrency library
    const limit = pLimit(3);
    const reviews = await Promise.all(
      state.tasks.map(t => limit(() => agents.reviewer.review(t)))
    );

    // Use standard Promise.race for timeout
    const parsed = await Promise.race([
      agents.parser.parseFile(state.path),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
    ]);
  });
}
```

**Rationale**:
- Keeps SDK surface area small
- Users can use battle-tested libraries they already know
- No need to learn SDK-specific APIs for common patterns
- Libraries like `p-retry`, `p-limit`, `p-timeout` are well-maintained

---

### Context API Summary

| Helper | Available In | Purpose |
|--------|--------------|---------|
| `agents` | Both `run:` and `execute:` | Resolved agent instances |
| `state` | Both | Mutable state object |
| `phase(name, fn)` | Both | Wraps work with auto start/complete events |
| `task(id, fn)` | Both | Wraps task with auto start/complete events |
| `emit(type, data)` | Both | Raw event emission (escape hatch) |
| `yield { step, ... }` | `execute:` only | Step recording for replay/debugging |

---

## Status: DX Exploration Complete

All 5 DX questions have been resolved:

- ✅ Q1: Dual API (`run:` + `execute:`)
- ✅ Q2: Hybrid events (`phase()`/`task()` + `emit()`)
- ✅ Q3: Mutable state
- ✅ Q4: Three progressive levels (`wrapAgent` → simple → full)
- ✅ Q5: BYOL for control flow

### Next Steps

1. **Update Type Definitions** - Reflect the resolved API patterns
2. **Update Ultimate Test** - Use the new API surface
3. **Create proper feature spec** - Move from backlog to active feature
4. **Implement** - Build the `defineHarness()` function and helpers
