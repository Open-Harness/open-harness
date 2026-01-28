# HTTP

HTTP server and route handlers.

## Files

| File | Purpose |
|------|---------|
| Server.ts | HTTP server setup with Effect |
| Routes.ts | Route handlers for all endpoints |
| SSE.ts | Server-Sent Events streaming utilities |

## Endpoints

### Session Management

| Method | Path | Handler |
|--------|------|---------|
| POST | /sessions | createSessionRoute |
| GET | /sessions | listSessionsRoute |
| GET | /sessions/:id | getSessionRoute |
| GET | /sessions/:id/events | getSessionEventsRoute (SSE) |
| GET | /sessions/:id/state | getSessionStateRoute |
| POST | /sessions/:id/input | postSessionInputRoute |
| DELETE | /sessions/:id | deleteSessionRoute |

### VCR Controls

| Method | Path | Handler |
|--------|------|---------|
| POST | /sessions/:id/pause | pauseSessionRoute |
| POST | /sessions/:id/resume | resumeSessionRoute |
| POST | /sessions/:id/fork | forkSessionRoute |

### Recordings

| Method | Path | Handler |
|--------|------|---------|
| GET | /recordings | listRecordingsRoute |
| GET | /recordings/:id | getRecordingRoute |
| DELETE | /recordings/:id | deleteRecordingRoute |
| GET | /providers/status | getProviderStatusRoute |

## Architecture

```
Client Request
     │
     ▼
┌─────────────┐
│  Server.ts  │  HTTP listener, routing
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Routes.ts  │  Route handlers (Effect programs)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   SSE.ts    │  Event stream formatting
└─────────────┘
```
