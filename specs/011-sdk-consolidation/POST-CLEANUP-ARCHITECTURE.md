# Post-Cleanup SDK Architecture

**Date:** 2025-12-28
**Context:** This document answers the key architectural questions before executing the TaskHarness deletion.

---

## Question 1: Where Does defineRenderer Fit?

### Answer: It Creates Consumers of Transport, Not Transports Themselves

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  defineHarness()  ────────>  HarnessInstance                    │
│                                    │                            │
│                                    │  IS A TRANSPORT            │
│                                    │  (implements Transport)    │
│                                    │                            │
│                                    ▼                            │
│                         ┌─────────────────────┐                 │
│                         │     Transport       │                 │
│                         │                     │                 │
│                         │  Events OUT:        │                 │
│                         │   • subscribe()     │                 │
│                         │   • async iterator  │                 │
│                         │                     │                 │
│                         │  Commands IN:       │                 │
│                         │   • send()          │                 │
│                         │   • reply()         │                 │
│                         │   • abort()         │                 │
│                         └─────────────────────┘                 │
│                                    │                            │
│                                    │                            │
│              ┌─────────────────────┼─────────────────────┐      │
│              │                     │                     │      │
│              ▼                     ▼                     ▼      │
│     .attach(attachment1)  .attach(attachment2)  .attach(...)   │
│              │                     │                     │      │
│              ▼                     ▼                     ▼      │
│     ┌─────────────┐       ┌─────────────┐       ┌───────────┐  │
│     │ Attachment  │       │ Attachment  │       │Attachment │  │
│     │             │       │             │       │           │  │
│     │ (transport) │       │ (transport) │       │(transport)│  │
│     │   => {      │       │   => {      │       │  => {     │  │
│     │     ...     │       │     ...     │       │    ...    │  │
│     │   }         │       │   }         │       │  }        │  │
│     └─────────────┘       └─────────────┘       └───────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Relationship Chain

```
defineRenderer()  ──>  IUnifiedRenderer  ──>  toAttachment()  ──>  Attachment
       │                      │                      │                  │
       │                      │                      │                  │
   Factory that           Object with            Adapter that       Function that
   creates a              attach()/detach()     converts to         receives Transport
   renderer               methods               Attachment type     and does stuff
```

### Concrete Example

```typescript
// 1. Define a renderer (creates IUnifiedRenderer)
const myRenderer = defineRenderer({
  name: 'TaskLogger',
  state: () => ({ count: 0 }),
  on: {
    'task:start': ({ state, output }) => {
      state.count++;
      output.line(`▶ Starting task ${state.count}`);
    },
    'task:complete': ({ output }) => {
      output.line('✓ Complete');
    },
  },
});

// 2. Convert to Attachment
const attachment = toAttachment(myRenderer);

// 3. Attach to harness (which IS a Transport)
const result = await MyHarness
  .create()
  .attach(attachment)   // or: .attach(toAttachment(myRenderer))
  .run();
```

### What is RenderOutput?

`RenderOutput` is a **helper class** passed to renderer event handlers for terminal formatting:

```typescript
defineRenderer({
  on: {
    'task:start': ({ output }) => {
      output.line('Starting...');     // Print a line
      output.indent(2);               // Increase indent
      output.spinner('Working...');   // Show spinner
      output.success('Done!');        // Green checkmark
    },
  },
});
```

**RenderOutput is NOT a transport.** It's a utility for renderers to format terminal output.

---

## Question 2: What Events Exist and How Do They Connect?

### Two Event Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     @openharness/core                           │
│                                                                 │
│  BASE EVENTS (defined in core, used everywhere)                 │
│  ─────────────────────────────────────────────                  │
│                                                                 │
│  Agent Events:                                                  │
│    agent:start        - Agent begins execution                  │
│    agent:thinking     - Agent is processing                     │
│    agent:text         - Agent produces text output              │
│    agent:tool:start   - Agent calls a tool                      │
│    agent:tool:complete- Tool call finished                      │
│    agent:complete     - Agent finished                          │
│                                                                 │
│  Workflow Events:                                               │
│    harness:start      - Harness begins                          │
│    harness:complete   - Harness finished                        │
│    phase:start        - Phase begins                            │
│    phase:complete     - Phase finished                          │
│    task:start         - Task begins                             │
│    task:complete      - Task finished successfully              │
│    task:failed        - Task failed                             │
│                                                                 │
│  Other Events:                                                  │
│    narrative          - Human-readable summary from agent       │
│    session:prompt     - Waiting for user input                  │
│    session:reply      - User provided input                     │
│    session:abort      - Execution aborted                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SDK imports and extends
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @openharness/sdk                           │
│                                                                 │
│  FLUENT EVENTS (harness-specific, emitted by helpers)           │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Lifecycle Events (emitted by phase()/task() helpers):          │
│    phase              - { name, status: start|complete|failed } │
│    task               - { id, status: start|complete|failed }   │
│    step               - { step, input, output } (generator)     │
│    error              - { message, cause, stack }               │
│                                                                 │
│  Control Flow Events (emitted by retry()/parallel() helpers):   │
│    retry:start        - Retry loop begins                       │
│    retry:attempt      - Individual attempt starts               │
│    retry:backoff      - Waiting before next attempt             │
│    retry:success      - Attempt succeeded                       │
│    retry:failure      - All attempts exhausted                  │
│                                                                 │
│    parallel:start     - Parallel execution begins               │
│    parallel:item:complete - One item finished                   │
│    parallel:complete  - All items finished                      │
│                                                                 │
│  Session Events (same as core, used for interactive mode):      │
│    session:prompt     - waitForUser() called                    │
│    session:reply      - reply() received                        │
│    session:abort      - abort() called                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### How Events Are Emitted

```typescript
const MyHarness = defineHarness({
  agents: { coder: CodingAgent },
  run: async ({ agents, phase, task, retry, parallel, emit }) => {

    // phase() helper emits: phase (start), phase (complete/failed)
    await phase('setup', async () => {
      // ...
    });

    // task() helper emits: task (start), task (complete/failed)
    await task('T001', async () => {
      // ...
    });

    // retry() helper emits: retry:start, retry:attempt, retry:backoff, retry:success/failure
    await retry('api-call', async () => {
      return await fetch('/api');
    }, { retries: 3 });

    // parallel() helper emits: parallel:start, parallel:item:complete, parallel:complete
    await parallel('batch', [
      async () => task1(),
      async () => task2(),
    ], { concurrency: 2 });

    // emit() for custom events - any type string works
    emit('myapp:custom', { data: 'value' });
  }
});
```

### Subscribing to Events

```typescript
// Method 1: Fluent .on() API
const result = await MyHarness.create()
  .on('phase', (e) => console.log(`Phase: ${e.name} ${e.status}`))
  .on('task', (e) => console.log(`Task: ${e.id} ${e.status}`))
  .on('retry', (e) => console.log(`Retry event: ${e.type}`))
  .on('*', (e) => console.log(`Any event: ${e.type}`))
  .run();

// Method 2: Transport.subscribe()
const harness = MyHarness.create();
harness.subscribe((event) => console.log(event));
harness.subscribe('task:*', (event) => console.log('Task event:', event));
await harness.run();

// Method 3: Async iteration
const harness = MyHarness.create();
const runPromise = harness.run();
for await (const event of harness) {
  console.log(event);
}
await runPromise;

// Method 4: Attachment
const myAttachment: Attachment = (transport) => {
  return transport.subscribe((event) => {
    console.log(event);
  });
};
await MyHarness.create().attach(myAttachment).run();
```

### Extending with Custom Events

```typescript
// Emit any event type you want
emit('myapp:started', { version: '1.0' });
emit('myapp:user:action', { action: 'click', target: 'button' });
emit('myapp:metric', { name: 'request_count', value: 42 });

// Subscribe to your custom events
.on('*', (event) => {
  if (event.type.startsWith('myapp:')) {
    // Handle custom events
  }
})
```

---

## Question 3: What Does the Folder Structure Look Like After Cleanup?

### Current Monorepo Structure (Before Cleanup)

```
packages/
├── core/                    # @openharness/core (exists, clean)
│   └── src/
│       ├── di/
│       ├── events/
│       ├── interfaces/
│       └── index.ts
│
├── sdk/                     # @openharness/sdk (MESSY - needs cleanup)
│   └── src/
│       ├── core/
│       ├── factory/
│       ├── harness/         # ◄── 26 FILES, mixed old and new
│       ├── monologue/
│       ├── callbacks/
│       ├── workflow/
│       ├── providers/       # ◄── EMPTY (broken imports)
│       └── index.ts
│
├── anthropic/               # @openharness/anthropic (exists, clean)
│   └── src/
│       ├── agents/
│       ├── runner/
│       ├── recording/
│       ├── monologue/
│       └── index.ts
│
├── transports/              # @openharness/transports (exists, minimal)
│   └── src/
│       ├── console/
│       ├── utils/
│       └── index.ts
│
examples/
└── task-harness/            # ◄── DELETE (failed migration attempt)
    └── src/
        └── (14 duplicate files)
```

### After Cleanup: packages/sdk/src/harness/

```
packages/sdk/src/harness/
│
├── KEEP (Canonical defineHarness API)
│   ├── harness-instance.ts     (826 lines) - Runtime instance, IS a Transport
│   ├── event-types.ts          (385 lines) - FluentHarnessEvent types
│   ├── control-flow.ts         (329 lines) - retry(), parallel() helpers
│   ├── define-renderer.ts      (400 lines) - defineRenderer() + toAttachment()
│   ├── render-output.ts        (185 lines) - Terminal output helpers
│   ├── async-queue.ts          (204 lines) - Session mode queue
│   ├── session-context.ts      (191 lines) - Session context
│   ├── event-context.ts         (52 lines) - Event context helpers
│   ├── backoff.ts              (189 lines) - Backoff utilities
│   ├── dependency-resolver.ts  (221 lines) - Topological sort
│   └── index.ts                            - Barrel exports (will be updated)
│
└── DELETE (Old TaskHarness API)
    ├── task-harness.ts         (935 lines) - OLD class, broken imports
    ├── task-harness-types.ts   (605 lines) - OLD types
    ├── task-state.ts           (216 lines) - OLD state management
    ├── base-renderer.ts        (596 lines) - OLD renderer class
    ├── console-renderer.ts     (229 lines) - OLD console renderer
    ├── composite-renderer.ts   (119 lines) - OLD composite
    ├── renderer-interface.ts   (196 lines) - OLD interface
    ├── event-protocol.ts       (240 lines) - OLD events
    ├── harness-recorder.ts     (310 lines) - OLD recording
    ├── replay-controller.ts    (428 lines) - OLD replay
    ├── base-harness.ts         (128 lines) - OLD base class
    ├── state.ts                (135 lines) - OLD PersistentState
    ├── types.ts                (132 lines) - OLD types
    └── agent.ts                 (57 lines) - OLD agent wrapper
```

### After Cleanup: packages/sdk/src/factory/

```
packages/sdk/src/factory/
│
├── KEEP
│   ├── define-harness.ts       (282 lines) - THE entry point
│   ├── wrap-agent.ts           (200 lines) - Single agent wrapper
│   └── agent-factory.ts         (95 lines) - createAgent()
│
└── DELETE
    └── harness-factory.ts      (110 lines) - OLD TaskHarness factory, broken
```

### After Cleanup: Complete SDK Structure

```
packages/sdk/src/
├── core/                        # DI and event infrastructure
│   ├── container.ts             # createContainer()
│   ├── tokens.ts                # DI tokens
│   ├── event-bus.ts             # Legacy (may remove later)
│   ├── unified-event-bus.ts     # UnifiedEventBus
│   └── unified-events/
│       ├── types.ts             # Transport, Attachment, IUnifiedEventBus
│       ├── filter.ts            # matchesFilter()
│       └── index.ts
│
├── factory/                     # Harness creation
│   ├── define-harness.ts        # defineHarness()
│   ├── wrap-agent.ts            # wrapAgent()
│   └── agent-factory.ts         # createAgent()
│
├── harness/                     # Runtime components (CLEANED)
│   ├── harness-instance.ts      # HarnessInstance
│   ├── event-types.ts           # FluentHarnessEvent
│   ├── control-flow.ts          # retry(), parallel()
│   ├── define-renderer.ts       # defineRenderer(), toAttachment()
│   ├── render-output.ts         # RenderOutput
│   ├── async-queue.ts           # AsyncQueue
│   ├── session-context.ts       # SessionContext
│   ├── event-context.ts         # Event context
│   ├── backoff.ts               # Backoff utilities
│   ├── dependency-resolver.ts   # Topological sort
│   └── index.ts                 # Barrel exports
│
├── monologue/                   # Narrative generation
│   └── ...
│
├── callbacks/                   # Callback types
│   └── ...
│
├── workflow/                    # TaskList
│   └── ...
│
└── index.ts                     # Main barrel (WILL BE UPDATED)
```

### After Cleanup: examples/

```
examples/
├── task-harness/                # DELETE entirely
│
└── (future: simple defineHarness examples, ~50 lines each)
```

---

## Summary: What Changes

| Before | After |
|--------|-------|
| 26 files in harness/ | 11 files in harness/ |
| 4 files in factory/ | 3 files in factory/ |
| 14 files in examples/task-harness/ | 0 files (deleted) |
| ~7,500 lines | ~2,400 lines |
| TWO APIs (TaskHarness + defineHarness) | ONE API (defineHarness) |
| Broken imports (providers/anthropic/) | Clean imports |

---

## Key Takeaways

1. **HarnessInstance IS a Transport** - it's the bidirectional channel
2. **defineRenderer() creates CONSUMERS** of Transport, not Transports themselves
3. **toAttachment() is the adapter** - converts IUnifiedRenderer to Attachment
4. **RenderOutput is a utility** - terminal formatting for renderers
5. **Events flow from helpers** - phase(), task(), retry(), parallel() emit events
6. **Custom events via emit()** - any string type works
7. **Subscribe via .on(), .subscribe(), or Attachment** - multiple ways to consume
8. **After cleanup: ONE way to build harnesses** - defineHarness() only
