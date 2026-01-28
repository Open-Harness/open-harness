# Client Source

Client implementation for Open Scaffold workflows.

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| Contract.ts | WorkflowClient interface + ClientError |
| HttpClient.ts | HTTP implementation (fetch + SSE) |
| SSE.ts | SSE parsing utilities |
| Reconnect.ts | sseReconnectSchedule (Effect Schedule) |

## Usage

```ts
import { HttpClient } from "@open-scaffold/client"

const client = HttpClient({ url: "http://localhost:42069" })
const sessionId = await client.createSession("Build a simple plan")
await client.connect(sessionId)

for await (const event of client.events()) {
  console.log(event.name, event.payload)
}
```

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
     │Contract.ts│    │HttpClient │    │Reconnect  │
     │(interface)│    │ (impl)    │    │(schedule) │
     └───────────┘    └─────┬─────┘    └───────────┘
                            │
                            ▼
                     ┌───────────┐
                     │  SSE.ts   │
                     │ (parser)  │
                     └───────────┘
```
