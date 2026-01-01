# infra/ - Infrastructure Layer

DI container, event bus, and injection tokens.

## Files

| File | Purpose |
|------|---------|
| `container.ts` | `createContainer()` - DI container factory using `@needle-di/core` |
| `event-bus.ts` | `EventBus` - Basic internal pub/sub |
| `unified-event-bus.ts` | `UnifiedEventBus` - Enriched event bus with context tracking |
| `tokens.ts` | DI injection tokens (`IAgentRunnerToken`, `IEventBusToken`, etc.) |
| `unified-events/` | Event type definitions, filters, Transport interface |

## Key Abstractions

- **Container**: Resolves services via DI tokens. Uses `@needle-di/core`.
- **EventBus**: Simple pub/sub for internal communication.
- **UnifiedEventBus**: Context-aware events with session/phase/task tracking, scoped execution.
- **Transport**: Bidirectional interface - events OUT (`subscribe`), commands IN (`send`, `reply`, `abort`).

## unified-events/ Subdirectory

| File | Purpose |
|------|---------|
| `types.ts` | Event type definitions (agent, task, session, parallel, retry events) |
| `filter.ts` | Pattern matching for event filtering (`task:*`, `agent:complete`) |
| `guards.ts` | Type guards (`isTaskEvent`, `isAgentEvent`) |

## Consumers

- `harness/harness-instance.ts` - Primary consumer
- `harness/define-channel.ts` - Channels subscribe via transport
