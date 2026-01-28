# @open-scaffold/server

HTTP/SSE server for Open Scaffold workflows with recording/playback support.

## Public API: OpenScaffold

The `OpenScaffold` class is the main entry point. It hides Effect internals and provides a Promise-based API.

```typescript
import { OpenScaffold } from "@open-scaffold/server"

const scaffold = OpenScaffold.create({
  database: "./data/app.db",  // SQLite path
  mode: "live"                // REQUIRED: "live" | "playback"
})

const server = scaffold.createServer({ workflow: myWorkflow })
await server.start()
// Server running on http://127.0.0.1:42069

await scaffold.dispose()  // Clean up when done
```

## Provider Modes

| Mode | API Calls | Recording |
|------|-----------|-----------|
| `live` | Yes - calls real APIs | Records all responses to DB |
| `playback` | No - never calls APIs | Replays from recorded responses |

**Workflow:**
1. Run in `live` mode during development to record API responses
2. Commit the database file with recordings
3. Run in `playback` mode in CI for deterministic, fast tests

## Request Flow

```
Client                     Server                    Core
  │                          │                         │
  │ POST /sessions           │                         │
  │─────────────────────────►│ createSession          │
  │                          │────────────────────────►│
  │◄─────────────────────────│ { sessionId }           │
  │                          │                         │
  │ GET /sessions/:id/events │                         │
  │─────────────────────────►│ observeEvents          │
  │                          │────────────────────────►│
  │◄─ SSE: event stream ─────│◄─ Stream<AnyEvent> ────│
  │                          │                         │
  │ POST /sessions/:id/input │                         │
  │─────────────────────────►│ recordEvent            │
  │                          │────────────────────────►│
  │◄─────────────────────────│ { ok }                  │
```

## HTTP Endpoints

### Session Management

| Method | Path | Purpose |
|--------|------|---------|
| POST | /sessions | Start new workflow |
| GET | /sessions | List all sessions |
| GET | /sessions/:id | Get session status |
| GET | /sessions/:id/events | SSE event stream |
| GET | /sessions/:id/state | Current state |
| GET | /sessions/:id/state?position=N | State at position N (time-travel) |
| POST | /sessions/:id/input | Send user input or HITL response |
| DELETE | /sessions/:id | End workflow |

### VCR Controls

| Method | Path | Purpose |
|--------|------|---------|
| POST | /sessions/:id/pause | Pause running session |
| POST | /sessions/:id/resume | Resume paused session |
| POST | /sessions/:id/fork | Fork session (copy events to new session) |

**Note:** "Stepping" through history is client-side via `GET /sessions/:id/state?position=N`.

### Recordings

| Method | Path | Purpose |
|--------|------|---------|
| GET | /recordings | List provider recordings |
| GET | /recordings/:id | Get recording by hash |
| DELETE | /recordings/:id | Delete recording |
| GET | /providers/status | Provider mode status |

## Installation

```bash
pnpm add @open-scaffold/server
```

## Configuration

```typescript
interface OpenScaffoldConfig {
  database: string      // SQLite path (e.g., "./data/app.db")
  mode: ProviderMode    // "live" | "playback" (REQUIRED)
}

interface ServerOptions {
  workflow: WorkflowDefinition  // Your workflow
  host?: string                 // Default: "127.0.0.1"
  port?: number                 // Default: 42069
}
```

## Lower-Level API

For advanced use cases requiring Effect knowledge:

```typescript
import { createServer, ProviderRecorderLive } from "@open-scaffold/server"

const server = createServer({
  workflow: myWorkflow,
  eventStore: EventStoreLive({ url: "file:./data/events.db" }),
  snapshotStore: StateSnapshotStoreLive({ url: "file:./data/events.db" }),
  providerMode: "live",
  providerRecorder: ProviderRecorderLive({ url: "file:./data/events.db" }),
  port: 42069
})
```

## Exports

```typescript
// Public API (no Effect knowledge required)
export { OpenScaffold, OpenScaffoldConfig, OpenScaffoldServer, ProviderMode }

// Constants
export { DEFAULT_HOST, DEFAULT_PORT }

// Lower-level API (requires Effect)
export { createServer, ServerConfig, ServerError }

// Storage implementations
export { EventStoreLive, StateSnapshotStoreLive, ProviderRecorderLive }

// Anthropic Provider
export { AnthropicProvider }
```

## Dependencies

- `@open-scaffold/core` - Domain types and services
- `effect` - Core runtime
- `@libsql/client` - SQLite storage
