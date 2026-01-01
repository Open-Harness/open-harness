# harness/ - Runtime Orchestration Layer

The harness layer provides runtime orchestration, event channels, and control flow helpers for agent workflows.

## Files

| File | Purpose |
|------|---------|
| `harness-instance.ts` | `HarnessInstance` - runtime execution context |
| `define-channel.ts` | `defineChannel()` / `createChannel()` - event consumers |
| `session-context.ts` | `SessionContext` - interactive session support |
| `control-flow.ts` | `parallel()` / `retry()` - orchestration helpers |
| `event-types.ts` | Event type definitions and type guards |
| `event-context.ts` | Context types (session, phase, task, agent) |
| `render-output.ts` | `RenderOutput` - terminal output helpers |
| `index.ts` | Barrel export |

## Key Abstractions

### HarnessInstance

Runtime execution context created by `defineHarness().create()`:

```typescript
const instance = MyHarness.create();

instance.attach(consoleChannel);
instance.attach(dbChannel);
instance.startSession();

const result = await instance.run();
```

Methods:
- `.attach(channel)` - Add event consumer
- `.startSession()` - Enable interactive mode
- `.run()` / `.complete()` - Execute workflow
- `.subscribe(listener)` - Direct event subscription
- `.reply(promptId, response)` - Reply to user prompts

### Channel System

Channels are event consumers created via `defineChannel()`:

```typescript
const consoleChannel = defineChannel({
  name: "Console",
  state: () => ({ taskCount: 0 }),
  on: {
    "task:start": ({ event, output }) => {
      output.line(`Starting: ${event.event.taskId}`);
    },
    "task:complete": ({ state, output }) => {
      state.taskCount++;
      output.success(`Completed (${state.taskCount} total)`);
    },
    "*": ({ event }) => {
      // Catch-all handler
    },
  },
  onStart: ({ output }) => output.line("Channel started"),
  onComplete: ({ state }) => console.log(`Processed ${state.taskCount} tasks`),
});
```

### ChannelContext

Context passed to channel handlers:

```typescript
interface ChannelContext<TState> {
  state: TState;
  event: EnrichedEvent;
  emit: (type, data) => void;
  config: ChannelConfig;
  output: RenderOutput;
  transport?: Transport;
}
```

### Control Flow Helpers

#### `parallel()` - Concurrent Execution

```typescript
const results = await parallel(
  [task1, task2, task3],
  async (task, { emit }) => {
    emit({ type: "task:start", taskId: task.id });
    return await processTask(task);
  },
  { concurrency: 2, emit }
);
```

#### `retry()` - Resilient Execution

```typescript
const result = await retry(
  async () => await flakeyOperation(),
  {
    maxAttempts: 3,
    backoff: { initialDelay: 1000, maxDelay: 10000 },
    emit,
  }
);
```

### SessionContext

Interactive session support for user prompts:

```typescript
const Harness = defineHarness({
  agents: { ... },
  run: async ({ session }) => {
    const response = await session.waitForUser("Continue?", {
      choices: ["Yes", "No"],
    });

    if (session.hasMessages()) {
      const messages = session.readMessages();
    }

    if (session.isAborted()) {
      return "Aborted by user";
    }
  },
});
```

### RenderOutput

Terminal output helpers for channels:

```typescript
const output = new RenderOutput({ colors: true, unicode: true });

output.line("Regular line");
output.success("Success message");  // Green with checkmark
output.error("Error message");      // Red with X
output.warning("Warning");          // Yellow with warning sign
output.info("Information");         // Blue with info sign
output.dim("Dimmed text");
```

### Event Types

Events are organized by category:

| Category | Events |
|----------|--------|
| Task | `task:start`, `task:complete`, `task:failed` |
| Phase | `phase:start`, `phase:complete` |
| Agent | `agent:start`, `agent:complete`, `agent:text`, `agent:thinking` |
| Session | `session:prompt`, `session:reply`, `session:abort` |
| Parallel | `parallel:start`, `parallel:item:complete`, `parallel:complete` |
| Retry | `retry:start`, `retry:attempt`, `retry:backoff`, `retry:success`, `retry:failure` |

Type guards are available:

```typescript
import { isTaskEvent, isAgentEvent } from "@openharness/sdk";

if (isTaskEvent(event)) {
  console.log(event.event.taskId);
}
```
