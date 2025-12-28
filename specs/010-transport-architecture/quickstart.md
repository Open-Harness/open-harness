# Quickstart: Transport Architecture

**Feature**: 010-transport-architecture
**Date**: 2025-12-27

## Overview

The Transport Architecture unifies event subscription, command injection, and bidirectional communication under a single interface. The `HarnessInstance` IS the Transport - no extra accessor methods needed.

## Basic Usage

### Fire-and-Forget with Attachments

```typescript
import { defineHarness } from '@openharness/sdk';

// Define a simple attachment
const consoleRenderer = (transport) => {
  const unsub = transport.subscribe((event) => {
    console.log(`[${event.event.type}]`, event.context.task?.id);
  });
  return unsub; // Cleanup function
};

// Create and run harness
const harness = defineHarness({
  name: 'my-workflow',
  run: async (ctx, input) => {
    await ctx.phase('process', async () => {
      await ctx.task('T001', async () => {
        // do work
      });
    });
    return { success: true };
  },
});

// Attach and run
const result = await harness
  .create({ data: '...' })
  .attach(consoleRenderer)
  .run();

console.log(result.result); // { success: true }
```

### Interactive Session with User Prompts

```typescript
// Interactive attachment
const promptHandler = (transport) => {
  return transport.subscribe('user:prompt', async (event) => {
    const { promptId, prompt, choices } = event.event;

    // Get user input (e.g., from readline, UI, etc.)
    const answer = await getUserInput(prompt, choices);

    // Reply through transport
    transport.reply(promptId, {
      content: answer,
      timestamp: new Date()
    });
  });
};

// Workflow with user interaction
const interactiveHarness = defineHarness({
  name: 'approval-workflow',
  run: async (ctx, input) => {
    const response = await ctx.session.waitForUser('Approve deployment?', {
      choices: ['Yes', 'No'],
    });

    if (response.choice === 'Yes') {
      await ctx.task('deploy', async () => {
        // deploy
      });
    }

    return { approved: response.choice === 'Yes' };
  },
});

// Start interactive session
const result = await interactiveHarness
  .create({ env: 'production' })
  .attach(consoleRenderer)
  .attach(promptHandler)
  .startSession()
  .complete();
```

### WebSocket Bridge

```typescript
function webSocketBridge(ws: WebSocket) {
  return (transport) => {
    // Events → WebSocket
    const unsubEvents = transport.subscribe((event) => {
      ws.send(JSON.stringify(event));
    });

    // WebSocket → Commands
    const handleMessage = (data: string) => {
      const { type, ...payload } = JSON.parse(data);
      switch (type) {
        case 'send':
          transport.send(payload.message);
          break;
        case 'reply':
          transport.reply(payload.promptId, payload.response);
          break;
        case 'abort':
          transport.abort(payload.reason);
          break;
      }
    };

    ws.addEventListener('message', (e) => handleMessage(e.data));

    return () => {
      unsubEvents();
      ws.removeEventListener('message', handleMessage);
    };
  };
}

// Usage in Bun server
Bun.serve({
  websocket: {
    open(ws) {
      harness
        .create(ws.data.input)
        .attach(webSocketBridge(ws))
        .startSession()
        .complete()
        .finally(() => ws.close());
    },
  },
});
```

## Common Patterns

### Conditional Attachments

```typescript
const instance = harness.create(input);

instance.attach(consoleRenderer);

if (process.env.METRICS) {
  instance.attach(metricsCollector);
}

if (process.env.DEBUG) {
  instance.attach(debugLogger);
}

await instance.run();
```

### Timeout Abort

```typescript
const abortAfter = (ms: number) => (transport) => {
  const timer = setTimeout(() => transport.abort('Timeout'), ms);
  return () => clearTimeout(timer);
};

await harness
  .create(input)
  .attach(abortAfter(30000)) // 30 second timeout
  .run();
```

### Event Collection for Testing

```typescript
const events: EnrichedEvent[] = [];
const collectTo = (arr: EnrichedEvent[]) => (transport) => {
  return transport.subscribe((e) => arr.push(e));
};

const result = await harness
  .create(input)
  .attach(collectTo(events))
  .run();

expect(events).toContainEqual(
  expect.objectContaining({ event: { type: 'task:complete', taskId: 'T001' } })
);
```

### Using defineRenderer Helper

```typescript
import { defineRenderer } from '@openharness/sdk';

const statusRenderer = defineRenderer({
  name: 'status',
  state: () => ({ taskCount: 0, failed: false }),

  on: {
    'task:start': ({ state }) => {
      state.taskCount++;
      console.log(`Task ${state.taskCount} started`);
    },
    'task:complete': ({ state, event }) => {
      console.log(`Task ${event.event.taskId} complete`);
    },
    'task:failed': ({ state }) => {
      state.failed = true;
      console.error('Task failed!');
    },
  },

  onComplete: ({ state }) => {
    console.log(`Done. Tasks: ${state.taskCount}, Failed: ${state.failed}`);
  },
});

await harness
  .create(input)
  .attach(statusRenderer)
  .run();
```

## API Reference Summary

### Transport Methods

| Method | Description |
|--------|-------------|
| `subscribe(listener)` | Subscribe to all events |
| `subscribe(filter, listener)` | Subscribe with filter |
| `send(message)` | Inject message (session mode only) |
| `sendTo(agent, message)` | Inject targeted message |
| `reply(promptId, response)` | Reply to prompt |
| `abort(reason?)` | Request graceful abort |

### HarnessInstance Methods

| Method | Description |
|--------|-------------|
| `attach(attachment)` | Register attachment (before run) |
| `run()` | Fire-and-forget execution |
| `startSession()` | Enable interactive mode |
| `complete()` | Complete interactive session |

### SessionContext (in workflows)

| Method | Description |
|--------|-------------|
| `waitForUser(prompt, options?)` | Block for user response |
| `hasMessages()` | Check for injected messages |
| `readMessages()` | Get and clear messages |
| `isAborted()` | Check abort status |

## Next Steps

1. See `data-model.md` for complete type definitions
2. See `contracts/transport.ts` for full interface specifications
3. Check `tasks.md` (after `/oharnes.tasks`) for implementation checklist
