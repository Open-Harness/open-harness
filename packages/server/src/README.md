# Server Source

HTTP/SSE server implementation.

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| Server.ts | ServerService Context.Tag + ServerError |
| Routes.ts | Route handler stubs |
| SSE.ts | SSE utilities |

## Architecture

```
                    ┌─────────────────┐
                    │    index.ts     │
                    │ (public exports)│
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌───────────┐    ┌───────────┐    ┌───────────┐
     │ Server.ts │    │ Routes.ts │    │  SSE.ts   │
     │  (tag)    │    │ (handlers)│    │ (stream)  │
     └───────────┘    └───────────┘    └───────────┘
```
