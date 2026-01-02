# Quickstart: Unified Event System

**Feature**: 008-unified-event-system
**Date**: 2025-12-27

## Overview

The Unified Event System combines agent-level events (thinking, tool calls) with workflow-level events (phases, tasks) into a single stream with automatic context propagation.

**Key benefits**:
- Events automatically include task/phase context without explicit passing
- Single subscription API for all event types
- Type-safe renderer creation via `defineRenderer()`
- Parallel execution maintains correct context per branch

---

## Basic Usage

### 1. Subscribe to All Events

```typescript
import { UnifiedEventBus } from "@open-harness/sdk";

const bus = new UnifiedEventBus();

// Subscribe to all events
const unsubscribe = bus.subscribe((event) => {
  console.log(`[${event.context.task?.id ?? "harness"}] ${event.event.type}`);
});

// Later: cleanup
unsubscribe();
```

### 2. Subscribe with Filter

```typescript
// Only task events
bus.subscribe("task:*", (event) => {
  console.log(`Task: ${event.event.type}`);
});

// Only agent tool events
bus.subscribe("agent:tool:*", (event) => {
  console.log(`Tool: ${event.event.toolName}`);
});

// Multiple patterns
bus.subscribe(["task:*", "agent:*"], (event) => {
  console.log(event.event.type);
});
```

### 3. Emit Events with Context

```typescript
// Events automatically get context from scope
await bus.scoped({ task: { id: "T001" } }, async () => {
  // This event automatically has context.task.id = "T001"
  bus.emit({ type: "task:start", taskId: "T001" });

  // Agent events also get task context
  bus.emit({ type: "agent:thinking", content: "Planning approach..." });

  bus.emit({ type: "task:complete", taskId: "T001" });
});
```

---

## Scoped Context

### Phase and Task Scopes

```typescript
await bus.scoped({ phase: { name: "Implementation", number: 1 } }, async () => {
  // All events in this scope have phase context

  await bus.scoped({ task: { id: "T001", description: "Setup" } }, async () => {
    // Events here have both phase AND task context
    bus.emit({ type: "agent:tool:start", toolName: "read_file", input: {} });
    // event.context = { sessionId: "...", phase: {...}, task: {...} }
  });

  await bus.scoped({ task: { id: "T002", description: "Build" } }, async () => {
    // Different task, same phase
    bus.emit({ type: "agent:tool:start", toolName: "write_file", input: {} });
  });
});
```

### Parallel Execution

```typescript
// Each parallel branch maintains its own context
await Promise.all([
  bus.scoped({ task: { id: "T1" } }, async () => {
    // All events here have T1 context
    await doWork();
    bus.emit({ type: "task:complete", taskId: "T1" });
  }),
  bus.scoped({ task: { id: "T2" } }, async () => {
    // All events here have T2 context (no cross-contamination)
    await doWork();
    bus.emit({ type: "task:complete", taskId: "T2" });
  }),
  bus.scoped({ task: { id: "T3" } }, async () => {
    // All events here have T3 context
    await doWork();
    bus.emit({ type: "task:complete", taskId: "T3" });
  }),
]);
```

---

## Renderer API

### Create a Simple Renderer

```typescript
import { defineRenderer } from "@open-harness/sdk";

const consoleRenderer = defineRenderer({
  name: "console",

  // State factory - called fresh on each attach()
  state: () => ({
    taskCount: 0,
    currentTask: null as string | null,
  }),

  // Event handlers by type pattern
  on: {
    "task:start": ({ state, event, output }) => {
      state.currentTask = event.event.taskId;
      output.line(`Starting task: ${event.event.taskId}`);
    },

    "task:complete": ({ state, event, output }) => {
      state.taskCount++;
      output.line(`Completed: ${event.event.taskId} (${state.taskCount} total)`);
    },

    "agent:tool:*": ({ event, output }) => {
      const taskId = event.context.task?.id ?? "unknown";
      output.line(`[${taskId}] Tool: ${event.event.toolName}`);
    },
  },

  // Lifecycle hooks
  onStart: ({ output }) => {
    output.line("=== Harness Started ===");
  },

  onComplete: ({ state, output }) => {
    output.line(`=== Complete: ${state.taskCount} tasks ===`);
  },
});
```

### Attach Renderer to Bus

```typescript
const bus = new UnifiedEventBus();

// Attach renderer
consoleRenderer.attach(bus);

// Run harness...
await runHarness(bus);

// Detach when done
consoleRenderer.detach();
```

### Spinner and Progress

```typescript
const progressRenderer = defineRenderer({
  name: "progress",
  state: () => ({ spinner: null as Spinner | null }),

  on: {
    "task:start": ({ state, event, output }) => {
      state.spinner = output.spinner(`Running ${event.event.taskId}...`);
    },

    "agent:thinking": ({ state }) => {
      state.spinner?.update("Thinking...");
    },

    "task:complete": ({ state }) => {
      state.spinner?.succeed("Done!");
    },

    "task:failed": ({ state, event }) => {
      state.spinner?.fail(`Failed: ${event.event.error}`);
    },
  },
});
```

---

## Integration with Harness

### Using with defineHarness()

```typescript
import { defineHarness, UnifiedEventBus, defineRenderer } from "@open-harness/sdk";

const harness = defineHarness({
  name: "my-harness",
  agents: { coder: CodingAgent },

  async run({ agents, task, phase }) {
    await phase("Setup", async () => {
      await task("T001", async () => {
        // Agent events automatically get T001 context
        await agents.coder.run("Initialize project");
      });
    });
  },
});

// Create and run with renderer
const bus = new UnifiedEventBus();
const renderer = defineRenderer({ /* ... */ });
renderer.attach(bus);

const instance = harness.create({ input: "Build feature" });
// Internally uses bus for all events
await instance.run();

renderer.detach();
```

### Backward Compatibility

```typescript
// Existing .on() API still works
const instance = harness.create({});

// This is now equivalent to bus.subscribe("task:*", ...)
instance.on("task", (event) => {
  console.log(event.id, event.status);
});

await instance.run();
```

---

## Edge Cases

### Empty Context

```typescript
// Outside any scope, context only has sessionId
const ctx = bus.current();
// { sessionId: "abc-123" }

bus.emit({ type: "narrative", text: "Hello", importance: "important" });
// event.context = { sessionId: "abc-123" }
```

### Listener Throws

```typescript
// Listener errors don't crash emission
bus.subscribe((event) => {
  throw new Error("Oops!");
});

bus.subscribe((event) => {
  console.log("Still called!"); // This runs
});

bus.emit({ type: "task:start", taskId: "T1" });
// Console: [UnifiedEventBus] Listener error: Oops!
// Console: Still called!
```

### After Clear

```typescript
bus.clear();
bus.emit({ type: "task:start", taskId: "T1" });
// Succeeds but no listeners receive it
```

### Invalid Filter

```typescript
// Future-proof: non-existent types don't error
bus.subscribe("unknown:type", (event) => {
  // Never called for current events, but ready for future types
});
```

---

## Type Safety

### Typed Event Handlers

```typescript
import type { TaskStartEvent, AgentToolStartEvent } from "@open-harness/sdk";

bus.subscribe("task:start", (event) => {
  // TypeScript knows: event.event is TaskStartEvent
  const taskId: string = event.event.taskId; // OK
});

// With explicit typing
bus.subscribe<AgentToolStartEvent>("agent:tool:start", (event) => {
  const tool: string = event.event.toolName; // OK
});
```

### Renderer State Types

```typescript
interface MyState {
  count: number;
  items: string[];
}

const renderer = defineRenderer<MyState>({
  name: "typed-renderer",
  state: (): MyState => ({ count: 0, items: [] }),

  on: {
    "task:complete": ({ state }) => {
      state.count++; // TypeScript knows state.count is number
      state.items.push("done"); // OK
    },
  },
});
```

---

## Common Patterns

### Collect All Events

```typescript
const events: EnrichedEvent[] = [];
bus.subscribe((event) => events.push(event));

await runHarness();

console.log(`Collected ${events.length} events`);
```

### Filter by Task

```typescript
bus.subscribe("agent:*", (event) => {
  const taskId = event.context.task?.id;
  if (taskId === "T003") {
    console.log(`[T003] ${event.event.type}`);
  }
});
```

### Metrics Collection

```typescript
const metrics = { tools: 0, thinking: 0, narratives: 0 };

bus.subscribe("agent:tool:*", () => metrics.tools++);
bus.subscribe("agent:thinking", () => metrics.thinking++);
bus.subscribe("narrative", () => metrics.narratives++);

await runHarness();
console.log(metrics);
// { tools: 15, thinking: 23, narratives: 8 }
```
