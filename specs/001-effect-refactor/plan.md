# Implementation Plan: Effect Workflow System (core-v2)

**Branch**: `001-effect-refactor` | **Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-effect-refactor/spec.md`

## Summary

Build a **greenfield package** (`packages/core-v2`) implementing an event-sourced workflow system with Effect-TS. This is NOT a refactor of existing code—it's a completely standalone package.

Key characteristics:
1. **Effect-first internals**: All async operations, error handling, and resource management via Effect
2. **Effect-free public API**: Consumers see Promises and plain objects, never Effect types
3. **Event sourcing**: State derived by replaying pure handlers over immutable event log
4. **Time-travel debugging**: Unified Tape interface for both live execution and replay
5. **Provider abstraction**: AI providers as Effect Services with Claude as default Layer

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)
**Primary Dependencies**: `effect`, `@effect/schema`, `@effect/platform`, `@anthropic-ai/claude-agent-sdk`, `zod`, `zod-to-json-schema`
**Storage**: Built-in via Effect Service/Layer pattern (memory default, SQLite adapter)
**Testing**: `@effect/vitest` for Effect-native testing
**Target Platform**: Node.js 18+ (server), React 18+/19 (client via subpath export), Bun runtime
**Project Type**: Standalone greenfield package at `packages/core-v2`
**Performance Goals**: Replay 10,000 events with <100ms state recomputation, streaming latency <50ms
**Constraints**: Zero Effect types in public API exports, deterministic replay, resource-safe cleanup
**Scale/Scope**: 1 new package, ~15 public types, ~8 Effect Services

**NOT using**: Pino, Vercel AI SDK, immer, neverthrow, any existing @internal/* packages

**Schema Strategy**: Zod for public API (consumer-facing schemas like `outputSchema`), @effect/schema for internal types. Runtime converts Zod → JSON Schema for SDK calls.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Event-Based Architecture | ✅ PASS | Core design - immutable events, typed facts |
| II. Pure Handlers | ✅ PASS | `(Event, State) → { state, events[] }` is the contract |
| III. Effect Under the Hood | ✅ PASS | Effect internally, clean public API |
| IV. Vercel AI SDK-Compatible DX | ✅ PASS | API shape inspiration only, not dependency |
| V. Recording & Replay First | ✅ PASS | Unified Tape interface from start |
| VI. Structured Output | ✅ PASS | Effect logging, no console.* |
| VII. Integration Testing | ✅ PASS | @effect/vitest, real SDK fixtures |
| VIII. Observability First | ✅ PASS | Effect tracing, causality via `causedBy` |

**Git Branching**: Feature branch `001-effect-refactor` from `dev` ✅

## Project Structure

### Documentation (this feature)

```text
specs/001-effect-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output - Effect patterns research
├── data-model.md        # Phase 1 output - Entity definitions
├── quickstart.md        # Phase 1 output - Usage examples
├── contracts/           # Phase 1 output - TypeScript interfaces
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (packages/core-v2)

```text
packages/core-v2/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Public API (Effect-free exports)
│   ├── react.ts                    # React subpath export (@core-v2/react)
│   │
│   ├── event/                      # Event primitives
│   │   ├── Event.ts                # Event type + schema
│   │   ├── EventLog.ts             # Append-only event log
│   │   └── index.ts
│   │
│   ├── handler/                    # Pure handler system
│   │   ├── Handler.ts              # Handler type + registry
│   │   └── index.ts
│   │
│   ├── agent/                      # AI agent abstraction
│   │   ├── Agent.ts                # Agent definition
│   │   ├── AgentService.ts         # Effect Service interface
│   │   └── index.ts
│   │
│   ├── workflow/                   # Workflow orchestration
│   │   ├── Workflow.ts             # Workflow definition
│   │   ├── WorkflowRuntime.ts      # Effect-based execution
│   │   └── index.ts
│   │
│   ├── tape/                       # Time-travel / VCR
│   │   ├── Tape.ts                 # Unified Tape interface
│   │   ├── TapeControls.ts         # VCR operations
│   │   └── index.ts
│   │
│   ├── store/                      # Persistence layer
│   │   ├── Store.ts                # Store Service interface
│   │   ├── MemoryStore.ts          # Default in-memory Layer
│   │   ├── SqliteStore.ts          # SQLite Layer
│   │   └── index.ts
│   │
│   ├── renderer/                   # Event rendering
│   │   ├── Renderer.ts             # Renderer interface
│   │   └── index.ts
│   │
│   ├── provider/                   # LLM provider abstraction
│   │   ├── Provider.ts             # Provider Service interface
│   │   ├── ClaudeProvider.ts       # Claude Layer (default)
│   │   └── index.ts
│   │
│   ├── message/                    # Message projection (for React)
│   │   ├── Message.ts              # AI SDK-compatible Message type
│   │   ├── projection.ts           # Event → Message projection
│   │   └── index.ts
│   │
│   └── internal/                   # Internal Effect utilities
│       ├── boundary.ts             # Effect → Promise boundary
│       └── schema.ts               # Zod → JSON Schema conversion
│
└── tests/
    ├── event.test.ts
    ├── handler.test.ts
    ├── workflow.test.ts
    ├── tape.test.ts
    ├── store.test.ts
    └── integration/
        └── claude.test.ts          # Real SDK integration tests
```

**Structure Decision**: Single standalone package with subpath exports for React. All Effect internals, clean public API boundary via `src/internal/boundary.ts`.

## Effect Layer Architecture

This section explicitly defines the Effect Services, their dependencies, and how they compose via Layers.

### Services (Context.Tag)

| Service | Tag | Purpose | Dependencies |
|---------|-----|---------|--------------|
| `LLMProvider` | `@core-v2/LLMProvider` | LLM interaction (query, stream) | None |
| `Store` | `@core-v2/Store` | Event persistence (append, events, sessions) | None |
| `EventBus` | `@core-v2/EventBus` | Event emission and subscription | None |
| `HandlerRegistry` | `@core-v2/HandlerRegistry` | Maps event names to handlers | None |
| `AgentRegistry` | `@core-v2/AgentRegistry` | Maps agent names to agent definitions | None |
| `WorkflowRuntime` | `@core-v2/WorkflowRuntime` | Orchestrates event loop, agents, handlers | LLMProvider, Store, EventBus, HandlerRegistry, AgentRegistry |

### Layer Dependency Graph

```
                    ┌─────────────────────────────────────────┐
                    │           WorkflowRuntimeLive           │
                    │   (orchestrates the event loop)         │
                    └───────────────┬─────────────────────────┘
                                    │ depends on
          ┌─────────────────────────┼─────────────────────────┐
          │              │          │          │              │
          ▼              ▼          ▼          ▼              ▼
   ┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │LLMProvider│  │  Store   │ │ EventBus │ │ Handler  │ │  Agent   │
   │  Live    │  │  Live    │ │  Live    │ │ Registry │ │ Registry │
   └────┬─────┘  └────┬─────┘ └──────────┘ └──────────┘ └──────────┘
        │             │
        │             ├── MemoryStoreLive (default)
        │             └── SqliteStoreLive (production)
        │
        └── ClaudeProviderLive (default, uses @anthropic-ai/claude-agent-sdk)
```

### Layer Implementations

```typescript
// Service Tags
export class LLMProvider extends Context.Tag("@core-v2/LLMProvider")<LLMProvider, LLMProviderService>() {}
export class Store extends Context.Tag("@core-v2/Store")<Store, StoreService>() {}
export class EventBus extends Context.Tag("@core-v2/EventBus")<EventBus, EventBusService>() {}
export class HandlerRegistry extends Context.Tag("@core-v2/HandlerRegistry")<HandlerRegistry, HandlerRegistryService>() {}
export class AgentRegistry extends Context.Tag("@core-v2/AgentRegistry")<AgentRegistry, AgentRegistryService>() {}
export class WorkflowRuntime extends Context.Tag("@core-v2/WorkflowRuntime")<WorkflowRuntime, WorkflowRuntimeService>() {}

// Layer composition
export const ClaudeProviderLive: Layer.Layer<LLMProvider> = Layer.effect(LLMProvider, /* ... */);
export const MemoryStoreLive: Layer.Layer<Store> = Layer.effect(Store, /* ... */);
export const SqliteStoreLive: Layer.Layer<Store> = Layer.effect(Store, /* ... */);
export const EventBusLive: Layer.Layer<EventBus> = Layer.effect(EventBus, /* ... */);
export const HandlerRegistryLive: Layer.Layer<HandlerRegistry> = Layer.effect(HandlerRegistry, /* ... */);
export const AgentRegistryLive: Layer.Layer<AgentRegistry> = Layer.effect(AgentRegistry, /* ... */);

// WorkflowRuntime depends on all other services
export const WorkflowRuntimeLive: Layer.Layer<WorkflowRuntime, never, LLMProvider | Store | EventBus | HandlerRegistry | AgentRegistry> =
  Layer.effect(WorkflowRuntime, Effect.gen(function* () {
    const provider = yield* LLMProvider;
    const store = yield* Store;
    const eventBus = yield* EventBus;
    const handlers = yield* HandlerRegistry;
    const agents = yield* AgentRegistry;
    // ... implementation
  }));
```

### ManagedRuntime Composition

The public `Workflow` class hides all Effect types behind `ManagedRuntime`:

```typescript
// Internal: Full layer composition
const AppLayer = Layer.mergeAll(
  ClaudeProviderLive,
  MemoryStoreLive, // or SqliteStoreLive
  EventBusLive,
  HandlerRegistryLive,
  AgentRegistryLive,
).pipe(
  Layer.provideMerge(WorkflowRuntimeLive)
);

// Public API: Workflow class wraps ManagedRuntime
export class Workflow<S> {
  private runtime: ManagedRuntime.ManagedRuntime<WorkflowRuntime>;

  constructor(definition: WorkflowDefinition<S>) {
    // Create runtime with all layers composed
    this.runtime = ManagedRuntime.make(AppLayer);
  }

  // Public Promise-returning methods
  async run(options: RunOptions): Promise<WorkflowResult<S>> {
    return this.runtime.runPromise(/* Effect program */);
  }

  async load(sessionId: string): Promise<Tape<S>> {
    return this.runtime.runPromise(/* Effect program */);
  }

  async dispose(): Promise<void> {
    return this.runtime.dispose();
  }
}
```

### Key Principles

1. **Services have no dependencies in their interface** - `R = never` in service methods
2. **Dependencies provided via Layer** - Runtime wiring, not constructor injection
3. **ManagedRuntime at boundary** - Single runtime created once, reused for all operations
4. **Swappable Layers** - Replace `MemoryStoreLive` with `SqliteStoreLive` without changing code
5. **Cleanup via dispose** - `ManagedRuntime.dispose()` cleans up all acquired resources

## Complexity Tracking

> No violations - greenfield design follows all constitution principles.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Single package vs split | Single `core-v2` | Simpler dependency management, subpaths for React |
| Effect everywhere | Internal only | Public API must be Effect-free per spec |
| Provider pattern | Effect Service | Allows swapping LLM providers via Layer |

## Research Questions (Phase 0)

1. **Effect Service pattern for Provider**: How to define an Effect Service for LLM providers that wraps `@anthropic-ai/claude-agent-sdk`?
2. **Schema boundary**: How to convert Zod schemas to JSON Schema for SDK `outputFormat`? (Answer: use `zod-to-json-schema`)
3. **Effect Fiber for streaming**: How to handle streaming text deltas from Claude SDK within Effect?
4. **Resource management**: How to ensure cleanup of SDK connections on workflow abort?
5. **React integration**: How to expose Effect-internal state to React hooks without leaking Effect types?
