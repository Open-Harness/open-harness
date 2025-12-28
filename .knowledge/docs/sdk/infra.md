# infra/ - Infrastructure Layer

Foundation layer providing dependency injection, event routing, and DI tokens.

## Files

| File | Purpose |
|------|---------|
| `container.ts` | DI container factory using `@needle-di/core` |
| `event-bus.ts` | Basic event bus for internal pub/sub |
| `unified-event-bus.ts` | Enriched event bus with context and filtering |
| `tokens.ts` | DI injection tokens and interface definitions |
| `unified-events/` | Event type definitions, filters, and type guards |

## Key Abstractions

### Container (`container.ts`)

Factory for creating configured DI containers:

```typescript
import { createContainer } from "@openharness/sdk";

const container = createContainer({
  apiKey: "...",  // or uses subscription auth
});

const runner = container.get(IAgentRunnerToken);
```

### EventBus (`event-bus.ts`)

Simple pub/sub for internal communication:

```typescript
const bus = new EventBus<{ type: string }>();
const unsub = bus.subscribe((event) => console.log(event));
bus.emit({ type: "test" });
unsub();
```

### UnifiedEventBus (`unified-event-bus.ts`)

Enhanced event bus with:
- **Context tracking**: Each event includes session/phase/task context
- **Event enrichment**: Raw events wrapped with ID, timestamp, context
- **Scoped execution**: `bus.scoped()` for hierarchical context

```typescript
const bus = new UnifiedEventBus();

bus.subscribe("task:*", (event) => {
  console.log(event.context.sessionId);
  console.log(event.timestamp);
});

await bus.scoped({ sessionId: "s1" }, async () => {
  bus.emit({ type: "task:start", taskId: "T001" });
});
```

### DI Tokens (`tokens.ts`)

| Token | Service | Description |
|-------|---------|-------------|
| `IAgentRunnerToken` | `IAgentRunner` | Agent execution service |
| `IEventBusToken` | `IEventBus` | Basic event bus |
| `IUnifiedEventBusToken` | `IUnifiedEventBus` | Enriched event bus |
| `IConfigToken` | `IConfig` | Configuration holder |
| `IVaultToken` | `IVault` | Secure storage |

## unified-events/ Subdirectory

### Transport Interface

Bidirectional communication:

```typescript
interface Transport {
  // Events OUT
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;

  // Commands IN
  send(message: string): void;
  sendTo(agent: string, message: string): void;
  reply(promptId: string, response: UserResponse): void;
  abort(reason?: string): void;

  readonly status: "idle" | "running" | "complete" | "aborted";
  readonly sessionActive: boolean;
}
```

### Filter (`filter.ts`)

Pattern matching for event filtering:

```typescript
import { matchesFilter } from "@openharness/sdk";

matchesFilter("task:start", "task:*");     // true
matchesFilter("agent:complete", "*");       // true
matchesFilter("task:start", "agent:*");     // false
```
