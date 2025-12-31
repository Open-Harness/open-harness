# SDK API Guide: Which Pattern to Use

**Last Updated**: 2025-12-28

This guide helps you choose the right API for your use case.

---

## Core Concepts

### The EventHub + Transport Model (Like Pino)

```
HarnessInstance implements EventHub (bidirectional hub)
  ↓
Transports[] (destinations - like Pino transports)
  ├── ConsoleTransport → stdout
  ├── WebSocketTransport → WebSocket (bidirectional)
  └── MetricsTransport → monitoring system
```

| Term | Definition |
|------|------------|
| **EventHub** | Interface the harness implements. Bidirectional: emits events, receives commands. |
| **Transport** | Function that attaches to an EventHub and does something (render, log, bridge, etc.) |
| **Renderer** | A specific type of transport that renders output |

---

## Harness Classes

| Use Case | Use This | Not This | Notes |
|----------|----------|----------|-------|
| **Custom workflow with agents** | `defineHarness()` + `HarnessInstance` | `BaseHarness` | Fluent API, transports, modern |
| **Task file execution** | `TaskHarness` | - | Domain-specific (tasks.md) |
| **Simple step tracking** | `BaseHarness` | - | Low-level, generator-based |
| **Single agent wrapper** | `wrapAgent()` | `Agent` class | Higher-level API |

### Example: Modern Harness with Transports

```typescript
// Define the harness
const harness = defineHarness({
  agents: { parser: ParserAgent },
  run: async ({ agents, emit }) => {
    const result = await agents.parser.execute(input);
    emit({ type: 'task:complete', result });
    return result;
  }
});

// Create instance, attach transports, run
await harness.create(input)
  .attach(consoleTransport)    // Renders to stdout
  .attach(metricsTransport)    // Collects metrics
  .attach(websocketBridge)     // Bridges to WebSocket
  .run();
```

---

## Transports

| Use Case | Use This | Not This | Notes |
|----------|----------|----------|-------|
| **Custom output rendering** | `defineRenderer()` → `toTransport()` | `IHarnessRenderer` | Modern, declarative |
| **Multiple outputs** | Multiple `.attach()` calls | `CompositeRenderer` | Cleaner |
| **External bridge** | Custom transport function | - | Full EventHub access |
| **Metrics collection** | Custom transport function | - | Subscribe to events |

### Creating a Transport

```typescript
// Option 1: Simple function
const loggerTransport: Transport = (hub) => {
  const unsub = hub.subscribe((event) => {
    console.log(JSON.stringify(event));
  });
  return unsub; // Cleanup function
};

// Option 2: Renderer (for visual output)
const myRenderer = defineRenderer({
  name: 'my-renderer',
  state: () => ({ count: 0 }),
  on: {
    'task:start': (ctx) => {
      ctx.updateState(s => ({ count: s.count + 1 }));
      ctx.output.log(`Task ${ctx.state.count} started`);
    }
  }
});

// Convert renderer to transport
const rendererTransport = toTransport(myRenderer);

// Use it
harness.create(input).attach(rendererTransport).run();
```

### Bidirectional Transport (WebSocket Bridge)

```typescript
const websocketBridge: Transport = (hub) => {
  const ws = new WebSocket('ws://localhost:8080');

  // Forward events to WebSocket
  const unsub = hub.subscribe((event) => {
    ws.send(JSON.stringify(event));
  });

  // Receive commands from WebSocket
  ws.onmessage = (msg) => {
    const cmd = JSON.parse(msg.data);
    if (cmd.type === 'reply') {
      hub.reply(cmd.promptId, cmd.response);
    } else if (cmd.type === 'abort') {
      hub.abort(cmd.reason);
    }
  };

  // Cleanup
  return () => {
    unsub();
    ws.close();
  };
};
```

---

## Event Systems

| Use Case | Use This | Not This | Notes |
|----------|----------|----------|-------|
| **New development** | `BaseEvent` (event-context.ts) | - | Canonical, broadest |
| **UnifiedEventBus** | `BaseEvent` wrapped in `EnrichedEvent` | - | Has context, metadata |
| **TaskHarness callbacks** | `HarnessEvent` (event-protocol.ts) | - | Legacy, domain-specific |
| **Fluent harness events** | `FluentHarnessEvent` | - | For HarnessInstance |

### Event Type Locations

```typescript
// Canonical (new code)
import type { BaseEvent, EnrichedEvent } from './core/unified-events';

// TaskHarness domain (legacy)
import type { HarnessEvent } from './harness/event-protocol';

// Fluent API
import type { FluentHarnessEvent } from './harness/event-types';
```

---

## Interactive Sessions

| Use Case | Use This | Not This | Notes |
|----------|----------|----------|-------|
| **Wait for user input** | `session.waitForUser(prompt)` | - | Returns Promise |
| **Reply to prompt** | `hub.reply(promptId, response)` | - | From EventHub |
| **Check abort status** | `session.isAborted()` | - | Boolean check |
| **Read injected messages** | `session.readMessages()` | - | Drains queue |

### Example: Interactive Session

```typescript
const harness = defineHarness({
  run: async ({ session, emit }) => {
    emit({ type: 'session:prompt', prompt: 'Continue?' });
    const response = await session.waitForUser('Continue?');

    if (session.isAborted()) {
      return { aborted: true };
    }

    return { answer: response.content };
  }
});

// Start interactive session
const instance = harness.create(input);
instance.startSession();

// Attach bridge that handles prompts
instance.attach((hub) => {
  hub.subscribe({ type: 'session:prompt' }, (event) => {
    // Show UI, get user input, then:
    hub.reply(event.promptId, { content: userInput, timestamp: new Date() });
  });
});

await instance.complete();
```

---

## State Management

| Use Case | Use This | Not This | Notes |
|-----------|----------|----------|-------|
| **Generic step history** | `PersistentState` | - | Bounded context |
| **Task execution state** | `TaskHarnessState` functions | - | Immutable updates |
| **Session runtime** | `SessionContext` | - | HITL workflows |
| **Renderer state** | `defineRenderer` with `state` | Manual tracking | Built-in |

---

## Retry & Backoff

| Use Case | Use This | Not This | Notes |
|----------|----------|----------|-------|
| **Retry with events** | `retry()` helper | `withBackoff()` | Emits retry events |
| **Parallel with events** | `parallel()` helper | `Promise.all` | Emits parallel events |
| **Calculate delay** | `calculateDelay()` | - | Low-level utility |
| **Check rate limit** | `isRateLimitError()` | - | Error detection |

### Example

```typescript
// Modern: retry helper with events
const result = await retry(
  async () => await agent.execute(input),
  { maxAttempts: 3, baseDelayMs: 1000 },
  emit
);
```

---

## Quick Reference: Import Paths

```typescript
// Fluent API (recommended)
import { defineHarness, wrapAgent, HarnessInstance } from 'open-harness-sdk';
import { defineRenderer, toTransport, RenderOutput } from 'open-harness-sdk';
import { retry, parallel } from 'open-harness-sdk';

// Event types
import type { BaseEvent, EnrichedEvent } from 'open-harness-sdk'; // Unified
import type { FluentHarnessEvent } from 'open-harness-sdk';       // Fluent

// Hub and Transport
import type { EventHub, Transport } from 'open-harness-sdk';

// Legacy (still works, but deprecated)
import { TaskHarness, createTaskHarness } from 'open-harness-sdk';
import type { Attachment } from 'open-harness-sdk'; // → Use Transport instead
```

---

## Migration Checklist

If you're updating from older patterns:

- [ ] Replace `Attachment` → `Transport`
- [ ] Replace `toAttachment()` → `toTransport()`
- [ ] Replace `IHarnessRenderer` implementations with `defineRenderer()` + `toTransport()`
- [ ] Replace `CompositeRenderer` with multiple `.attach()` calls
- [ ] Update event listeners from `HarnessEvent` to `BaseEvent` where possible
- [ ] Use `retry()` helper instead of manual `withBackoff()` loops
