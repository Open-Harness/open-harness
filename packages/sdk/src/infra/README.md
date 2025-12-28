# core/ - Infrastructure Layer

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

// Resolve services
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

// Subscribe with filter
bus.subscribe("task:*", (event) => {
  console.log(event.context.sessionId);  // Context available
  console.log(event.timestamp);          // Auto-added
});

// Scoped context
await bus.scoped({ sessionId: "s1" }, async () => {
  bus.emit({ type: "task:start", taskId: "T001" });
  // Event automatically includes { sessionId: "s1" }
});
```

### DI Tokens (`tokens.ts`)

Injection tokens for service resolution:

| Token | Service | Description |
|-------|---------|-------------|
| `IAgentRunnerToken` | `IAgentRunner` | Agent execution service |
| `IEventBusToken` | `IEventBus` | Basic event bus |
| `IUnifiedEventBusToken` | `IUnifiedEventBus` | Enriched event bus |
| `IConfigToken` | `IConfig` | Configuration holder |
| `IVaultToken` | `IVault` | Secure storage (if available) |

## unified-events/ Subdirectory

### Types (`types.ts`)

Event type definitions organized by category:

```typescript
// Agent events
type AgentStartEvent = { type: "agent:start"; agentName: string; ... };
type AgentCompleteEvent = { type: "agent:complete"; result: unknown; ... };

// Task events
type TaskStartEvent = { type: "task:start"; taskId: string; ... };
type TaskCompleteEvent = { type: "task:complete"; taskId: string; ... };

// Session events
type SessionPromptEvent = { type: "session:prompt"; promptId: string; ... };
type SessionReplyEvent = { type: "session:reply"; promptId: string; ... };
```

### Transport Interface

The `Transport` interface defines bidirectional communication:

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

  // Status
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

## How It Connects

```
┌─────────────────────────────────────────────────────────┐
│                    Container                            │
│  Creates and wires all services                         │
└───────────────┬─────────────────────────────────────────┘
                │ provides
                ▼
┌─────────────────────────────────────────────────────────┐
│              UnifiedEventBus                            │
│  Central event hub for all harness events               │
└───────────────┬─────────────────────────────────────────┘
                │ exposes via
                ▼
┌─────────────────────────────────────────────────────────┐
│                 Transport                               │
│  Bidirectional interface for channels                   │
└─────────────────────────────────────────────────────────┘
```

## Related

- `@needle-di/core` - DI framework used for container
- `harness/harness-instance.ts` - Primary consumer of event bus
- `harness/define-channel.ts` - Channels subscribe via transport
