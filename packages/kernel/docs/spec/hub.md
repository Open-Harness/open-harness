# Hub Protocol

The Hub is the **unified, bidirectional bus** that ties everything together.

## Interface

```typescript
interface Hub extends AsyncIterable<EnrichedEvent> {
  // Events out
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
  emit(event: BaseEvent, override?: Partial<EventContext>): void;
  scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
  current(): EventContext;

  // Commands in (bidirectional)
  send(message: string): void;
  sendTo(agent: string, message: string): void;
  sendToRun(runId: string, message: string): void;
  reply(promptId: string, response: UserResponse): void;
  abort(reason?: string): void;

  // Status
  readonly status: HubStatus;
  readonly sessionActive: boolean;
}
```

## Events out

### `subscribe(listener)` / `subscribe(filter, listener)`

Subscribe to events. Returns an `Unsubscribe` function.

- `filter` can be `"*"`, a string pattern (e.g., `"agent:*"`), or an array of patterns
- `listener` receives `EnrichedEvent` objects

### Async iteration

The hub is async-iterable:

```typescript
for await (const event of hub) {
  // process event
}
```

### `emit(event, override?)`

Emit an event. The event is automatically enriched with context from the current `scoped` block.

- `override` allows overriding context fields for this specific emission

### `scoped(context, fn)`

Run a function with automatic context propagation (AsyncLocalStorage):

```typescript
await hub.scoped({ phase: { name: "Planning" } }, async () => {
  // Any hub.emit(...) here inherits phase context
});
```

### `current()`

Read the inherited context from the current `scoped` block.

## Commands in (bidirectional)

### `send(message)`

Send a general message into the session. Emits `session:message`.

### `sendTo(agentName, message)`

Convenience injection targeting an agent by name. **Only safe if exactly one run of that agent is active**. Emits `session:message` with `agentName`.

### `sendToRun(runId, message)`

**Correct** run-scoped injection when multiple agent runs may be active. The `runId` is provided by `agent:start` / `agent:complete` events. Emits `session:message` with `runId`.

### `reply(promptId, response)`

Answer a prompt. Used when the Flow runtime is in session mode and has emitted `session:prompt`.

### `abort(reason?)`

Abort the session/run.

## Status

- `status`: `"idle" | "running" | "complete" | "aborted"`
- `sessionActive`: `boolean` - true if `startSession()` was called

## Key invariants

1. **One canonical bus** - everything talks to the hub
2. **Commands are always available**, but may be no-ops unless session mode is enabled
3. **Context propagation is automatic** via AsyncLocalStorage
