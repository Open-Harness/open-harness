# Feature Design: Unified Event System

**Status**: Ready (pending 007-fluent-harness-dx completion)
**Created**: 2025-12-27
**Depends On**: 007-fluent-harness-dx (must complete first)
**Input**: User feedback: "Agent events and harness events are two separate systems. A renderer that wants to show 'agent is thinking while executing task X' can't correlate events."

## Summary

Unify `AgentEvent` (SDK-level: tool calls, thinking, text) and `HarnessEvent` (workflow-level: phases, tasks, narratives) into a single event stream with automatic context propagation. Enable building renderers that see the full picture.

## Problem Statement

Current state: **Two parallel event systems that don't communicate**

```
┌─────────────────┐          ┌─────────────────┐
│   AgentEvent    │          │  HarnessEvent   │
│   (SDK level)   │          │ (workflow level)│
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│    EventBus     │          │ IHarnessRenderer│
│  (pub/sub)      │          │  (direct call)  │
└─────────────────┘          └─────────────────┘
         │                            │
    ??? nowhere                  console.log
```

Problems:
- `AgentEvent` has no task context (doesn't know which task it's running in)
- `HarnessEvent` goes directly to renderer, bypassing EventBus
- Renderers must manually correlate events from two sources
- No unified subscription mechanism
- Testing requires mocking multiple systems

## Solution Overview

Single unified event bus with automatic context propagation:

```
┌─────────────────────────────────────────┐
│           UnifiedEventBus               │
│  (AsyncLocalStorage for context)        │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌───────┐   ┌───────────┐   ┌──────────┐
│Agent  │   │ Harness   │   │ Session  │
│Events │   │ Events    │   │ Events   │
└───────┘   └───────────┘   └──────────┘
                  │
                  ▼
          ┌─────────────┐
          │  Renderer   │
          │ (any impl)  │
          └─────────────┘
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Context propagation | AsyncLocalStorage (implicit) | Best DX, works across async boundaries, Node.js native |
| Event shape | Envelope pattern | Non-breaking wrapper around existing events |
| Override capability | Optional explicit context | Edge cases can override implicit context |
| Renderer API | Declarative `defineRenderer()` | Clean DX, easy to build custom renderers |

## Context Propagation Deep Dive

### The Problem: Async Boundaries

```typescript
// Naive stack-based context BREAKS with async:
await eventBus.scoped({ task: 'T003' }, async () => {
  const promise = agent.execute(prompt);
  // Context is popped when THIS function returns
  // NOT when the promise resolves!
});

// agent.execute() may emit events AFTER context is popped!
```

### The Solution: AsyncLocalStorage

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

class UnifiedEventBus {
  private als = new AsyncLocalStorage<EventContext>();

  scoped<T>(ctx: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T> {
    const merged = { ...this.current(), ...ctx };
    return this.als.run(merged, fn);  // Context survives async!
  }

  emit(event: BaseEvent, override?: Partial<EventContext>): void {
    const context = { ...this.current(), ...override };
    this.publish({ event, context, id: crypto.randomUUID(), timestamp: new Date() });
  }

  current(): EventContext {
    return this.als.getStore() ?? { sessionId: 'unknown' };
  }
}
```

### Context Flow Example

```typescript
// Context automatically flows through async boundaries
await eventBus.scoped({ sessionId: 'sess_1' }, async () => {
  // sessionId: 'sess_1'

  await eventBus.scoped({ phase: { name: 'planning', number: 1 } }, async () => {
    // sessionId: 'sess_1', phase: { name: 'planning', number: 1 }

    await eventBus.scoped({ task: { id: 'T003' } }, async () => {
      // Full context available to any event emitted here:
      // { sessionId: 'sess_1', phase: {...}, task: { id: 'T003' } }

      await agent.execute(prompt);
      // Agent events automatically get full context!
    });
  });
});
```

### Parallel Execution Safety

```typescript
// Each parallel branch maintains its own context
await Promise.all([
  eventBus.scoped({ task: { id: 'T001' } }, () => agent1.execute()),
  eventBus.scoped({ task: { id: 'T002' } }, () => agent2.execute()),
  eventBus.scoped({ task: { id: 'T003' } }, () => agent3.execute()),
]);
// Each agent's events have correct task context!
```

### Caveats

- **Node.js/Bun only**: AsyncLocalStorage is not available in browsers
- **Small overhead**: ~5-10% performance cost (acceptable for this use case)
- **Native bindings**: Some C++ addons may not propagate context correctly

## API Design

### Event Types

```typescript
// Context attached to every event
interface EventContext {
  sessionId: string;
  phase?: { name: string; number: number };
  task?: { id: string; description: string };
  agent?: { name: string; type: string };
}

// Enriched event wrapper
interface EnrichedEvent<T extends BaseEvent = BaseEvent> {
  id: string;
  timestamp: Date;
  context: EventContext;
  event: T;
}

// Base event types (unified)
type BaseEvent =
  // Workflow level
  | { type: 'harness:start'; name: string; taskCount: number }
  | { type: 'harness:complete'; summary: Summary }
  | { type: 'phase:start'; name: string }
  | { type: 'phase:complete'; name: string }
  | { type: 'task:start'; id: string; description: string }
  | { type: 'task:complete'; id: string; result: unknown }
  | { type: 'task:failed'; id: string; error: string }
  // Agent level
  | { type: 'agent:start'; agentName: string }
  | { type: 'agent:thinking'; content: string }
  | { type: 'agent:text'; content: string }
  | { type: 'agent:tool:start'; tool: string; input: unknown }
  | { type: 'agent:tool:complete'; tool: string; result: unknown; duration: number }
  | { type: 'agent:complete'; agentName: string }
  // Narrative
  | { type: 'narrative'; text: string; importance: 'critical' | 'important' | 'detailed' }
  // Session (from interactive-sessions feature)
  | { type: 'session:prompt'; promptId: string; prompt: string }
  | { type: 'session:reply'; promptId: string; response: string }
  | { type: 'session:abort'; reason?: string }
  // Extensible
  | { type: string; [key: string]: unknown };
```

### UnifiedEventBus

```typescript
class UnifiedEventBus {
  constructor(sessionId: string);

  // Scoped context (AsyncLocalStorage-backed)
  scoped<T>(ctx: Partial<EventContext>, fn: () => T): T;
  scoped<T>(ctx: Partial<EventContext>, fn: () => Promise<T>): Promise<T>;

  // Emit with automatic context
  emit(event: BaseEvent, override?: Partial<EventContext>): EnrichedEvent;

  // Get current context (for inspection)
  current(): EventContext;

  // Subscribe to events
  subscribe(listener: (event: EnrichedEvent) => void): () => void;
  subscribe(
    filter: { types?: string[]; phase?: string; task?: string },
    listener: (event: EnrichedEvent) => void
  ): () => void;

  // Clear all subscribers
  clear(): void;
}
```

### Declarative Renderer API

```typescript
interface RendererDefinition<TState> {
  name: string;
  state: () => TState;

  onStart?: (ctx: { state: TState; config: RendererConfig }) => void;
  onComplete?: (ctx: { state: TState; summary: Summary }) => void;

  on: {
    [eventType: string]: (ctx: RenderContext<TState>) => void;
  };
}

interface RenderContext<TState> {
  state: TState;
  event: EnrichedEvent;
  emit: RenderOutput;
  config: RendererConfig;
}

interface RenderOutput {
  line(text: string): void;
  update(text: string): void;
  spinner(text: string): Spinner;
  progress(current: number, total: number): ProgressBar;
  clear(): void;
  newline(): void;
}

function defineRenderer<TState>(def: RendererDefinition<TState>): IUnifiedRenderer;
```

## Example Renderers

### Console Renderer

```typescript
const consoleRenderer = defineRenderer({
  name: 'console',

  state: () => ({
    currentTask: null as string | null,
    spinners: new Map<string, Spinner>(),
  }),

  onStart: ({ config }) => {
    console.log(`\n🚀 ${config.name || 'Harness'} starting...`);
  },

  on: {
    'phase:start': ({ event, emit }) => {
      emit.newline();
      emit.line(`📦 Phase: ${event.event.name}`);
    },

    'task:start': ({ event, emit, state }) => {
      state.currentTask = event.event.id;
      state.spinners.set(event.event.id, emit.spinner(event.event.description));
    },

    'task:complete': ({ event, state }) => {
      state.spinners.get(event.event.id)?.succeed();
      state.currentTask = null;
    },

    'agent:tool:start': ({ event, emit }) => {
      emit.line(`  └─ ${event.event.tool}...`);
    },

    'narrative': ({ event, emit, config }) => {
      if (shouldShow(event.event.importance, config.verbosity)) {
        emit.line(`  💬 ${event.event.text}`);
      }
    },
  },

  onComplete: ({ summary }) => {
    console.log(`\n✓ Complete: ${summary.tasksCompleted} tasks`);
  },
});
```

### Minimal Renderer

```typescript
const minimalRenderer = defineRenderer({
  name: 'minimal',
  state: () => ({}),

  on: {
    'task:start': ({ event }) => console.log(`▶ ${event.event.id}`),
    'task:complete': ({ event }) => console.log(`✓ ${event.event.id}`),
    'task:failed': ({ event }) => console.error(`✗ ${event.event.id}`),
  },
});
```

### Silent/Test Renderer

```typescript
const silentRenderer = defineRenderer({
  name: 'silent',
  state: () => ({ events: [] as EnrichedEvent[] }),
  on: {
    '*': ({ event, state }) => state.events.push(event),
  },
});

// In tests:
const renderer = createRenderer(silentRenderer);
await harness.withRenderer(renderer).run();
expect(renderer.state.events).toContainEqual(
  expect.objectContaining({ event: { type: 'task:complete', id: 'T001' } })
);
```

## Registration Points

```typescript
// Option 1: At harness definition
const workflow = defineHarness({
  renderer: consoleRenderer,  // Default renderer
  // ...
});

// Option 2: At instance creation (override)
await workflow
  .create(input)
  .withRenderer(listr2Renderer)
  .run();

// Option 3: Event subscription (most flexible)
const harness = workflow.create(input);
harness.on('*', (event) => customHandler(event));
await harness.run();
```

## Integration with Existing Code

### Phase 1: Add UnifiedEventBus alongside existing EventBus
- New code uses UnifiedEventBus
- Existing code continues using EventBus
- Bridge adapter forwards events between them

### Phase 2: Migrate agents to emit through UnifiedEventBus
- Agents receive eventBus via DI
- Emit events with automatic context

### Phase 3: Migrate harness to use UnifiedEventBus
- Remove direct renderer.handleEvent() calls
- Renderers subscribe to bus instead

### Phase 4: Deprecate old EventBus
- Mark as deprecated
- Provide migration guide

## Relationship to Other Features

- **007-fluent-harness-dx**: Provides the `phase()`, `task()` helpers that create scoped contexts
- **interactive-sessions**: Adds `session:*` events to unified stream
- **Existing renderers**: Can be wrapped to consume unified events

## Success Criteria

- [ ] Single event bus for all event types
- [ ] Context automatically propagates across async boundaries
- [ ] Renderers can subscribe to unified stream
- [ ] Existing harness patterns continue working (backward compat)
- [ ] `defineRenderer()` API works with full type inference
- [ ] Agent tool events include task context automatically
- [ ] Parallel agent execution maintains correct context per branch

## Open Questions

1. **Event ordering**: Should events be guaranteed in-order or best-effort?
2. **Backpressure**: What happens if renderer is slow and events queue up?
3. **Replay**: How does unified event stream affect recording/replay?
4. **Filtering**: Should bus support server-side filtering or client-side only?

## Complexity Estimate

| Component | Lines | Complexity |
|-----------|-------|------------|
| UnifiedEventBus | ~150 | Medium |
| Event types | ~100 | Low |
| defineRenderer() | ~200 | Medium |
| AsyncLocalStorage integration | ~50 | Low |
| Migration adapters | ~100 | Low |
| Tests | ~400 | Medium |
| **Total** | ~1000 | Medium |
