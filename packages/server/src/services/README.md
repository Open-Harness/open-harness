# Services

Live service implementations for the server.

## Files

| File | Purpose |
|------|---------|
| EventBusLive.ts | In-memory pub/sub for real-time event broadcasting |

## EventBusLive

Implements the `EventBus` service contract from `@open-scaffold/core`.

Uses Effect's Queue and PubSub for:
- Broadcasting events to multiple SSE subscribers
- Non-blocking event publishing
- Automatic subscriber cleanup on disconnect

```typescript
import { EventBusLive } from "./services/EventBusLive"

// Provide to your Effect program
const program = myEffect.pipe(
  Effect.provide(EventBusLive)
)
```

## Architecture

```
Event Published
     │
     ▼
┌──────────────────┐
│   EventBusLive   │
│  (Effect PubSub) │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
 SSE #1    SSE #2    ...subscribers
```
