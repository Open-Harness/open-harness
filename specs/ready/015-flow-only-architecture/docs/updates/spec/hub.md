# Hub Protocol (Draft)

Defines the bidirectional event bus used by the Flow runtime.

## Hub interface

```typescript
export interface Hub {
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
  emit(event: BaseEvent, override?: Partial<EventContext>): void;
  scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
  current(): EventContext;
  send(message: string): void;
  sendTo(agent: string, message: string): void;
  sendToRun(runId: string, message: string): void;
  reply(promptId: string, response: UserResponse): void;
  abort(reason?: string): void;
  readonly status: HubStatus;
  readonly sessionActive: boolean;
}
```

## Key invariants

1. Hub is the single event stream for runtime + agents.
2. Commands are bidirectional and flow-scoped.
