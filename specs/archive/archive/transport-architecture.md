# Feature Design: Transport Architecture

**Status**: Ready
**Created**: 2025-12-27
**Supersedes**: unified-events.md, interactive-sessions.md
**Builds On**: 008-unified-event-system (core implementation)

## Summary

Unify event emission, subscription, and bidirectional communication under a single **Transport** abstraction. The HarnessInstance IS the Transport. Consumers attach via a single `Attachment` interface that receives full bidirectional access.

## Problem Statement

Current design has fragmented concepts:

1. **Unified Event Bus** (008) - internal event infrastructure with AsyncLocalStorage
2. **Interactive Sessions** (ready spec) - bidirectional messaging for HITL workflows
3. **Renderer attachment** - unclear how consumers connect without touching the bus

These are artificially separated. They're all aspects of the same thing: **communication between harness and external consumers**.

### Core Issues

- Consumers must understand multiple concepts (bus, session, renderer)
- No clean attachment API for renderers, metrics, API bridges
- Interactive sessions designed separately from event system
- Categorizing attachments as "renderer" vs "handler" is artificial

## Solution Overview

**One abstraction: Transport**

```
┌─────────────────────────────────────────────────────────────┐
│                    HarnessInstance                          │
│                    (IS the Transport)                       │
│                                                             │
│  Events (out):   subscribe(), [Symbol.asyncIterator]        │
│  Commands (in):  send(), reply(), abort()                   │
│  Lifecycle:      attach(), run(), startSession()            │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌────────────┐     ┌────────────┐     ┌────────────┐
    │ Attachment │     │ Attachment │     │ Attachment │
    └────────────┘     └────────────┘     └────────────┘
```

**One interface for consumers: Attachment**

```typescript
type Attachment = (transport: Transport) => Cleanup;
```

What an attachment does is its business. The framework doesn't categorize.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport location | Instance IS Transport | No extra `.transport()` call, cleaner API |
| Attachment interface | Function → Cleanup | Simplest possible, maximum flexibility |
| No categories | Renderer = Handler = Bridge | Artificial distinctions limit composition |
| Bidirectional by default | All attachments get full access | Enables interactive renderers, hybrid patterns |
| Commands gated | Only processed when session active | Non-interactive `run()` ignores commands safely |

## Architecture

### Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Attachments (Consumer-facing)                        │
│  • Renderers, metrics, loggers, API bridges, interactive UIs   │
│  • All same interface: (transport) => cleanup                  │
│  • Full bidirectional access                                   │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Transport (Public interface)                         │
│  • Events: subscribe(), asyncIterator                          │
│  • Commands: send(), reply(), abort()                          │
│  • Lifecycle: attach(), run(), startSession()                  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: UnifiedEventBus (Internal infrastructure)            │
│  • AsyncLocalStorage context propagation                       │
│  • Event emission with auto-context                            │
│  • Never exposed to consumers                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
EVENTS (harness → consumer):
  Workflow: phase(), task() ──▶ bus.emit() ──▶ transport.subscribe()
  Agent: agent.run() ──▶ bus.emit() ──▶ transport.subscribe()
  Session: waitForUser() ──▶ bus.emit() ──▶ transport.subscribe()

COMMANDS (consumer → harness):
  User input: transport.send() ──▶ messageQueue ──▶ agent receives
  Prompt reply: transport.reply() ──▶ resolver ──▶ waitForUser() returns
  Abort: transport.abort() ──▶ abortController ──▶ graceful shutdown
```

## API Design

### Transport Interface

```typescript
/**
 * Bidirectional communication channel between harness and consumers.
 */
interface Transport extends AsyncIterable<EnrichedEvent> {
  // ═══════════════════════════════════════════════════════════
  // EVENTS (OUT) - Harness → Consumer
  // ═══════════════════════════════════════════════════════════

  /** Subscribe to events with optional filter */
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;

  /** Async iteration over all events */
  [Symbol.asyncIterator](): AsyncIterator<EnrichedEvent>;

  // ═══════════════════════════════════════════════════════════
  // COMMANDS (IN) - Consumer → Harness
  // ═══════════════════════════════════════════════════════════

  /** Inject a user message into the execution */
  send(message: string): void;

  /** Send message to specific agent */
  sendTo(agent: string, message: string): void;

  /** Reply to a user:prompt event */
  reply(promptId: string, response: UserResponse): void;

  /** Request graceful abort */
  abort(reason?: string): void;

  // ═══════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════

  readonly status: TransportStatus;
  readonly sessionActive: boolean;
}

type TransportStatus = 'idle' | 'running' | 'complete' | 'aborted';
type EventFilter = string | string[];  // '*', 'task:*', ['agent:*', 'task:*']
type Unsubscribe = () => void;
```

### Attachment Interface

```typescript
/**
 * Something that attaches to a transport and does stuff.
 *
 * Could be: renderer, metrics collector, API bridge, logger,
 * interactive prompt handler, abort controller, etc.
 *
 * The framework doesn't categorize. Attachments have full
 * bidirectional access and can use either direction, both, or neither.
 */
type Attachment = (transport: Transport) => Cleanup;

type Cleanup = void | (() => void) | (() => Promise<void>);
```

### HarnessInstance Extension

```typescript
interface HarnessInstance<TInput, TResult> extends Transport {
  // ═══════════════════════════════════════════════════════════
  // INHERITED FROM TRANSPORT
  // ═══════════════════════════════════════════════════════════
  // subscribe(), send(), sendTo(), reply(), abort(), status, etc.

  // ═══════════════════════════════════════════════════════════
  // INSTANCE-SPECIFIC
  // ═══════════════════════════════════════════════════════════

  /** Attach a consumer to this instance */
  attach(attachment: Attachment): this;

  /** Run in fire-and-forget mode (commands ignored) */
  run(): Promise<HarnessResult<TResult>>;

  /** Enable interactive mode (commands processed) */
  startSession(): this;

  /** Complete and get result (interactive mode) */
  complete(): Promise<HarnessResult<TResult>>;

  /** Access to state */
  readonly state: TState;
  readonly input: TInput;
}
```

### ExecuteContext Extension (for workflow authors)

```typescript
interface ExecuteContext<TAgents, TState> {
  // Existing (from 007-fluent-harness-dx)
  agents: ResolvedAgents<TAgents>;
  state: TState;
  phase<T>(name: string, fn: () => Promise<T>): Promise<T>;
  task<T>(id: string, fn: () => Promise<T>): Promise<T>;
  emit(type: string, data: Record<string, unknown>): void;
  retry<T>(name: string, fn: () => Promise<T>, opts?: RetryOptions): Promise<T>;
  parallel<T>(name: string, fns: Array<() => Promise<T>>): Promise<T[]>;

  // NEW: Session context (only available when startSession() used)
  session?: SessionContext;
}

interface SessionContext {
  /** Block until user responds (emits user:prompt event) */
  waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse>;

  /** Check for injected messages (non-blocking) */
  hasMessages(): boolean;
  readMessages(): InjectedMessage[];

  /** Check if abort was requested */
  isAborted(): boolean;
}

interface WaitOptions {
  timeout?: number;
  choices?: string[];
  validator?: (input: string) => boolean | string;
}

interface UserResponse {
  content: string;
  choice?: string;
  timestamp: Date;
}
```

## Usage Examples

### Simple Attachment (Console Renderer)

```typescript
const consoleRenderer: Attachment = (transport) => {
  const unsubscribe = transport.subscribe((event) => {
    switch (event.event.type) {
      case "task:start":
        console.log(`▶ ${event.event.taskId}`);
        break;
      case "task:complete":
        console.log(`✓ ${event.event.taskId}`);
        break;
      case "task:failed":
        console.error(`✗ ${event.event.taskId}: ${event.event.error}`);
        break;
    }
  });

  return unsubscribe;
};
```

### Interactive Attachment (Prompt Handler)

```typescript
const interactivePrompts: Attachment = (transport) => {
  return transport.subscribe("user:prompt", async (event) => {
    const { promptId, prompt, choices } = event.event;

    // Show prompt to user
    const answer = choices
      ? await select(prompt, choices)
      : await input(prompt);

    // Reply through transport
    transport.reply(promptId, { content: answer });
  });
};
```

### Bidirectional Attachment (WebSocket Bridge)

```typescript
function webSocketBridge(ws: WebSocket): Attachment {
  return (transport) => {
    // Events → WebSocket
    const unsubEvents = transport.subscribe((event) => {
      ws.send(JSON.stringify(event));
    });

    // WebSocket → Commands
    const handleMessage = (data: string) => {
      const { type, ...payload } = JSON.parse(data);
      switch (type) {
        case "send": transport.send(payload.message); break;
        case "reply": transport.reply(payload.promptId, payload.response); break;
        case "abort": transport.abort(payload.reason); break;
      }
    };

    ws.addEventListener("message", (e) => handleMessage(e.data));

    return () => {
      unsubEvents();
      ws.removeEventListener("message", handleMessage);
    };
  };
}
```

### Fluent Usage

```typescript
// Fire-and-forget with attachments
const result = await harness
  .create({ code: "..." })
  .attach(consoleRenderer)
  .attach(metricsCollector)
  .run();

// Interactive session
const result = await harness
  .create({ code: "..." })
  .attach(consoleRenderer)
  .attach(interactivePrompts)
  .startSession()
  .complete();

// API server
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

### Conditional Attachment

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

### Declarative Attachment (via create options)

```typescript
// For simple cases, can also pass in options
const result = await harness
  .create(input, {
    attachments: [consoleRenderer, metricsCollector],
  })
  .run();
```

## Helper Functions

### defineRenderer (Convenience)

```typescript
/**
 * Helper for building attachments focused on rendering.
 * Returns an Attachment like everything else.
 */
function defineRenderer<TState>(config: {
  name: string;
  state: () => TState;
  on: Record<string, (ctx: RenderContext<TState>) => void>;
  onStart?: (ctx: { state: TState }) => void;
  onComplete?: (ctx: { state: TState }) => void;
}): Attachment {
  return (transport) => {
    const state = config.state();

    config.onStart?.({ state });

    const unsubscribe = transport.subscribe((event) => {
      const handler = config.on[event.event.type] ?? config.on["*"];
      if (handler) {
        handler({
          state,
          event,
          transport,  // Full access for interactive renderers
          output: createRenderOutput(),
        });
      }
    });

    // Cleanup on complete
    const unsubComplete = transport.subscribe("harness:complete", () => {
      config.onComplete?.({ state });
    });

    return () => {
      unsubscribe();
      unsubComplete();
    };
  };
}

interface RenderContext<TState> {
  state: TState;
  event: EnrichedEvent;
  transport: Transport;
  output: RenderOutput;
}

interface RenderOutput {
  line(text: string): void;
  update(id: string, text: string): void;
  spinner(text: string): Spinner;
  progress(current: number, total: number): ProgressBar;
  clear(): void;
  newline(): void;
}
```

### Common Attachments

```typescript
// Collect events for testing
function collectTo(events: EnrichedEvent[]): Attachment {
  return (transport) => transport.subscribe((e) => events.push(e));
}

// Abort after timeout
function abortAfter(ms: number): Attachment {
  return (transport) => {
    const timer = setTimeout(() => transport.abort("Timeout"), ms);
    return () => clearTimeout(timer);
  };
}

// Log all events
function logEvents(logger = console.log): Attachment {
  return (transport) => transport.subscribe((e) =>
    logger(`[${e.event.type}]`, e.context.task?.id ?? "-")
  );
}

// Forward to SSE stream
function sseStream(writer: WritableStreamDefaultWriter): Attachment {
  return (transport) => transport.subscribe((e) => {
    writer.write(`data: ${JSON.stringify(e)}\n\n`);
  });
}
```

## Implementation Notes

### Building on 008-unified-event-system

The current implementation (008) provides:
- UnifiedEventBus with AsyncLocalStorage context propagation
- Event types and EnrichedEvent wrapper
- Filter matching for subscriptions
- Integration with phase()/task() helpers

This spec adds:
- Transport interface on HarnessInstance
- Attachment system
- Command handling (send, reply, abort)
- Session mode toggle

### Command Processing

Commands are only processed when `startSession()` is called:

```typescript
class HarnessInstanceImpl implements HarnessInstance {
  private sessionActive = false;
  private messageQueue = new AsyncQueue<InjectedMessage>();
  private promptResolvers = new Map<string, (r: UserResponse) => void>();

  send(message: string): void {
    if (!this.sessionActive) return;  // Ignored in run() mode
    this.messageQueue.push({ content: message, timestamp: new Date() });
  }

  reply(promptId: string, response: UserResponse): void {
    if (!this.sessionActive) return;
    this.promptResolvers.get(promptId)?.(response);
  }

  abort(reason?: string): void {
    this.abortController.abort(reason);
  }

  startSession(): this {
    this.sessionActive = true;
    return this;
  }

  async run(): Promise<HarnessResult> {
    // Commands ignored, runs to completion
    return this.execute();
  }

  async complete(): Promise<HarnessResult> {
    // Commands processed, interactive mode
    return this.execute();
  }
}
```

### Attachment Lifecycle

```typescript
class HarnessInstanceImpl {
  private attachments: Array<{ attachment: Attachment; cleanup?: Cleanup }> = [];

  attach(attachment: Attachment): this {
    const cleanup = attachment(this);  // this IS the transport
    this.attachments.push({ attachment, cleanup });
    return this;
  }

  private async cleanup(): Promise<void> {
    for (const { cleanup } of this.attachments) {
      if (typeof cleanup === "function") {
        await cleanup();
      }
    }
    this.attachments = [];
  }

  async run(): Promise<HarnessResult> {
    try {
      return await this.execute();
    } finally {
      await this.cleanup();
    }
  }
}
```

## Relationship to Existing Features

### 007-fluent-harness-dx
- Provides `defineHarness()`, `phase()`, `task()` helpers
- This spec extends HarnessInstance with Transport interface
- ExecuteContext gains optional `session` property

### 008-unified-event-system
- Provides internal event bus with context propagation
- This spec wraps it with Transport public interface
- Consumers never touch the bus directly

### interactive-sessions.md (superseded)
- Merged into this spec
- `startSession()` enables command processing
- `session.waitForUser()` available in ExecuteContext

## Success Criteria

- [ ] HarnessInstance implements Transport interface
- [ ] `attach()` accepts any Attachment function
- [ ] Attachments receive full bidirectional access
- [ ] Commands only processed when `startSession()` called
- [ ] `run()` works unchanged (fire-and-forget)
- [ ] Interactive sessions work with `startSession().complete()`
- [ ] `waitForUser()` blocks until `reply()` called
- [ ] All existing tests pass (backward compatible)
- [ ] `defineRenderer()` returns an Attachment
- [ ] WebSocket/SSE bridging works via attachments

## Complexity Estimate

| Component | Lines | Complexity |
|-----------|-------|------------|
| Transport interface on HarnessInstance | ~150 | Medium |
| Attachment registration & cleanup | ~50 | Low |
| Command handling (send, reply, abort) | ~100 | Medium |
| SessionContext (waitForUser, etc.) | ~100 | Medium |
| AsyncQueue for message injection | ~50 | Low |
| defineRenderer helper | ~80 | Low |
| Common attachments | ~100 | Low |
| Tests | ~400 | Medium |
| **Total** | ~1030 | Medium |

## Migration Path

### Phase 1: Transport Interface (non-breaking)
- Add Transport methods to HarnessInstance
- Commands are no-ops when not in session mode
- All existing code works unchanged

### Phase 2: Attachment System (non-breaking)
- Add `attach()` method
- `defineRenderer()` returns Attachment
- Existing direct subscriptions still work

### Phase 3: Interactive Sessions
- Add `startSession()`, `complete()`
- Add `session.waitForUser()` to ExecuteContext
- Enable command processing in session mode

### Phase 4: Deprecate Direct Bus Access
- Mark any remaining bus exposure as deprecated
- Provide migration guide
- Remove in next major version

## Open Questions

1. **Attachment ordering**: Should attachments be called in registration order? Does it matter?
2. **Error handling**: If an attachment throws, should others still receive events?
3. **Replay mode**: How does command replay work for testing interactive workflows?
4. **Timeout default**: Should `waitForUser()` have a default timeout?
