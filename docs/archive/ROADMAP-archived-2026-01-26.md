# Open Scaffold Roadmap

**Date**: 2026-01-26
**Status**: VCR & HITL Complete
**Version**: 0.x (Pre-1.0)

---

## What We Have (Completed)

### Core Runtime (@open-scaffold/core)

| Feature | Status | Notes |
|---------|--------|-------|
| Event-sourced workflow runtime | ✅ Complete | Effect-based, fully typed |
| Domain types (Event, Handler, Agent, Workflow) | ✅ Complete | Public API with Zod schemas |
| Service contracts (Effect Tags) | ✅ Complete | 8 services defined |
| Programs (Effect compositions) | ✅ Complete | 12 programs |
| Two-mode provider system (live/playback) | ✅ Complete | Replaced three-mode system |
| Session context (FiberRef) | ✅ Complete | Ambient sessionId propagation |
| Stubs for architecture validation | ✅ Complete | Compile-time checking |

### Server (@open-scaffold/server)

| Feature | Status | Notes |
|---------|--------|-------|
| HTTP/SSE server | ✅ Complete | All core endpoints |
| AnthropicProvider | ✅ Complete | Real streaming with recording |
| LibSQL stores (Events, Snapshots, Recordings) | ✅ Complete | Production-ready |
| Migrations | ✅ Complete | Idempotent, backward-compatible |
| OpenScaffold facade | ✅ Complete | Hides Effect from users |

### Client (@open-scaffold/client)

| Feature | Status | Notes |
|---------|--------|-------|
| WorkflowClient interface | ✅ Complete | Abstract contract |
| HttpClient implementation | ✅ Complete | Full HTTP/SSE support |
| React hooks | ✅ Complete | 17 hooks (session, events, VCR, HITL) |
| VCR hooks | ✅ Complete | usePause, useResume, useFork, useStateAt |
| HITL hooks | ✅ Complete | usePendingInteraction, usePendingInteractions |
| WorkflowProvider | ✅ Complete | Context provider |
| SSE reconnection | ✅ Complete | Exponential backoff |

### Example App (apps/example)

| Feature | Status | Notes |
|---------|--------|-------|
| Development server | ✅ Complete | Full workflow demo |
| React client | ✅ Complete | Uses all hooks |
| Recording manager UI | ✅ Complete | List/delete recordings |

---

## What Should Be Done (Immediate)

### High Priority - Pre-Documentation

| Task | Effort | Rationale |
|------|--------|-----------|
| Delete `runAgent.ts` | 5 min | Deprecated, always throws |
| Rename `FixtureManager.tsx` → `RecordingManager.tsx` | 5 min | Terminology consistency |
| Rename `fixtures.tsx` → `recordings.tsx` | 5 min | Terminology consistency |
| Decide on `OpenScaffold.observe()` | 10 min | Implement or remove stub |

### Medium Priority - Feature Completion

| Task | Effort | Status |
|------|--------|--------|
| ~~Add `POST /sessions/:id/resume` endpoint~~ | 2 hr | ✅ Done |
| ~~Add `POST /sessions/:id/fork` endpoint~~ | 2 hr | ✅ Done |
| ~~Add `POST /sessions/:id/pause` endpoint~~ | 2 hr | ✅ Done |
| Implement `Workflow.dispose()` properly | 1 hr | Pending |
| Update `docs/README.md` | 30 min | Pending |
| ~~Delete `docs/core/` folder~~ | 5 min | ✅ Done (historical specs) |
| Update `docs/reference/architecture.md` | 1 hr | Pending |
| ~~Update `docs/reference/mental-model.md`~~ | 1 hr | ✅ Done |

### Lower Priority - Polish

| Task | Effort | Rationale |
|------|--------|-----------|
| Add `GET /sessions/:id/state/observe` endpoint | 2 hr | Real-time state stream |
| Add React hook tests | 4 hr | Coverage gap |
| Performance benchmarks | 4 hr | Baseline metrics |

---

## What's Up Next (Planned Features)

Based on the streaming rebuild plan and architecture documents:

### Phase: Integration Completion

| Feature | Description | Status |
|---------|-------------|--------|
| ~~Resume endpoint~~ | HTTP API to continue paused sessions | ✅ Complete |
| ~~Fork endpoint~~ | HTTP API to branch sessions | ✅ Complete |
| ~~Pause endpoint~~ | HTTP API to pause running sessions | ✅ Complete |
| State observation | SSE endpoint for state changes | Planned |

### Phase: Developer Experience

| Feature | Description | Prerequisite |
|---------|-------------|--------------|
| CLI tool | `npx open-scaffold init` | Core stable |
| VS Code extension | Workflow visualization | Core stable |
| Playground | Interactive browser demo | Example app |

### Phase: Production Hardening

| Feature | Description | Prerequisite |
|---------|-------------|--------------|
| Connection pooling | LibSQL connection management | Load testing |
| Rate limiting | Protect against abuse | HTTP server |
| Authentication | API key / JWT support | HTTP server |
| Metrics endpoint | Prometheus-compatible | Observability |

---

## Suggestions (Not Yet Planned)

### High Value, Low Effort

| Suggestion | Value | Effort | Notes |
|------------|-------|--------|-------|
| **Recording export/import** | HIGH | LOW | Export recordings as JSON for CI fixtures |
| **Session replay UI** | HIGH | MEDIUM | Visual event timeline in example app |
| **Event filtering** | MEDIUM | LOW | Filter events by name pattern in SSE |
| **Batch event append** | MEDIUM | LOW | `appendMany()` for efficiency |

### High Value, Higher Effort

| Suggestion | Value | Effort | Notes |
|------------|-------|--------|-------|
| **Multiple provider support** | HIGH | HIGH | OpenAI, Ollama, etc. |
| **Workflow composition** | HIGH | HIGH | Sub-workflows, delegation |
| **Event versioning** | MEDIUM | MEDIUM | Schema evolution support |
| **Distributed mode** | MEDIUM | HIGH | Multiple server instances |

### Quality of Life

| Suggestion | Value | Effort | Notes |
|------------|-------|--------|-------|
| **Better error messages** | MEDIUM | LOW | Context-rich errors |
| **Debug mode** | MEDIUM | LOW | Verbose logging flag |
| **TypeScript examples** | MEDIUM | LOW | More code samples |
| **Video tutorials** | MEDIUM | MEDIUM | Getting started guides |

---

## Architecture Overview (Current State)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PUBLIC API                                      │
│                                                                          │
│  @open-scaffold/core                @open-scaffold/client                │
│  ├── agent()                        ├── HttpClient                       │
│  ├── phase()                        ├── WorkflowProvider                 │
│  ├── workflow()                     ├── useEvents()                      │
│  ├── execute()                      ├── useWorkflowState()               │
│  └── run()                          └── useSendInput()                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVER LAYER                                    │
│                                                                          │
│  @open-scaffold/server                                                   │
│  ├── OpenScaffold (public facade)                                        │
│  ├── createServer() (Effect-based)                                       │
│  ├── AnthropicProvider                                                   │
│  └── LibSQL stores (Events, Snapshots, Recordings)                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTERNAL (Effect)                               │
│                                                                          │
│  Services (Context.Tag)              Programs (Effect compositions)      │
│  ├── EventStoreLive                  ├── runWorkflow                     │
│  ├── StateSnapshotStoreLive          ├── executeWorkflow                 │
│  ├── EventBus                        ├── runPhase                        │
│  ├── ProviderRecorderLive            ├── runAgent                        │
│  ├── ProviderModeContext             ├── recordEvent                     │
│  └── AgentProvider                   └── observeEvents                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## HTTP API (Current)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| POST | `/sessions` | Create new session | ✅ |
| GET | `/sessions` | List all sessions | ✅ |
| GET | `/sessions/:id` | Get session metadata | ✅ |
| DELETE | `/sessions/:id` | Delete session | ✅ |
| GET | `/sessions/:id/events` | SSE event stream | ✅ |
| GET | `/sessions/:id/state` | Current state snapshot | ✅ |
| POST | `/sessions/:id/input` | Send user input | ✅ |
| POST | `/sessions/:id/pause` | Pause running session | ✅ |
| POST | `/sessions/:id/resume` | Resume paused session | ✅ |
| POST | `/sessions/:id/fork` | Fork session | ✅ |
| GET | `/recordings` | List recordings | ✅ |
| GET | `/recordings/:id` | Get recording details | ✅ |
| DELETE | `/recordings/:id` | Delete recording | ✅ |
| GET | `/provider/status` | Provider mode status | ✅ |

---

## React Hooks (Current)

### Session Management
| Hook | Purpose | Status |
|------|---------|--------|
| `useCreateSession()` | Create new session | ✅ |
| `useConnectSession()` | Connect to existing session | ✅ |
| `useSessionId()` | Get current session ID | ✅ |
| `useDisconnect()` | Disconnect from session | ✅ |
| `useStatus()` | Get connection status | ✅ |
| `useIsConnected()` | Check if connected | ✅ |

### Events & State
| Hook | Purpose | Status |
|------|---------|--------|
| `useEvents()` | Get all events from session | ✅ |
| `useFilteredEvents(opts)` | Get events by name(s) | ✅ |
| `useWorkflowState<S>()` | Get current typed state | ✅ |
| `useSendInput()` | Send user input event | ✅ |

### VCR Controls
| Hook | Purpose | Status |
|------|---------|--------|
| `usePosition()` | Get current position (event count) | ✅ |
| `useStateAt<S>(position)` | Get state at any position | ✅ |
| `usePause()` | Pause running session | ✅ |
| `useResume()` | Resume paused session | ✅ |
| `useFork()` | Fork session | ✅ |
| `useIsRunning()` | Check if session is running | ✅ |
| `useIsPaused()` | Check if session is paused | ✅ |

### Human-in-the-Loop (HITL)
| Hook | Purpose | Status |
|------|---------|--------|
| `usePendingInteraction()` | Get first pending interaction | ✅ |
| `usePendingInteractions()` | Get all pending interactions | ✅ |

---

## Testing Strategy

### Current Coverage

| Area | Test Type | Status |
|------|-----------|--------|
| Provider streaming | Integration | ✅ Real Anthropic SDK |
| Recording/playback | Integration | ✅ Full cycle |
| Session fork | Unit | ✅ |
| Event loop | Integration | ✅ |
| React hooks | Unit | ❌ Not tested |
| HTTP routes | Integration | ❌ Partial |

### Recommended Additions

1. **React hook tests** - Mock WorkflowProvider, test each hook
2. **E2E tests** - Full client → server → provider flow
3. **Load tests** - Concurrent sessions, large event volumes
4. **Error scenarios** - Network failures, provider errors

---

## Version Milestones

### v0.1.0 (Current Target)

- [x] Core runtime complete
- [x] Server with HTTP/SSE
- [x] React client with hooks (17 hooks including VCR/HITL)
- [x] Recording/playback working
- [x] VCR endpoints (pause/resume/fork)
- [x] HITL integration (createInteraction helper)
- [ ] Documentation accurate (in progress)
- [ ] Deprecated code removed

### v0.2.0

- [x] ~~Resume/fork endpoints~~ (moved to v0.1.0)
- [ ] Workflow.dispose() implemented
- [ ] React hook tests
- [ ] Recording export/import

### v1.0.0 (Stable)

- [ ] API stable (no breaking changes)
- [ ] Comprehensive documentation
- [ ] Production use cases validated
- [ ] Performance benchmarks published

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-26 | HITL via events, not SDK canUseTool | SDK's 60-second timeout unsuitable; event-based is non-blocking |
| 2026-01-26 | createInteraction helper pattern | Reduces boilerplate while keeping events as source of truth |
| 2026-01-26 | VCR pause uses Effect.forkDaemon | Daemon fibers survive parent scope close |
| 2026-01-25 | Two-mode system (live/playback) | Three-mode was confusing, record is implicit |
| 2026-01-25 | Recording at server level | Not per-provider wrapper |
| 2026-01-25 | LibSQL only (no Memory stores) | Same pattern everywhere, fewer implementations |
| 2026-01-25 | Effect hidden from public API | Users don't need to learn Effect |
| 2026-01-25 | Provider on Agent, not Workflow | Self-contained agents, different models per agent |

---

## How to Contribute

### Adding a New Provider

1. Implement `AgentProviderService` interface
2. Return Effect Stream for `stream()` method
3. Ensure `AgentStreamEvent` types are emitted correctly
4. Register in `packages/server/src/provider/`

### Adding a New Store

1. Implement service interface (e.g., `EventStoreService`)
2. Add Layer factory function
3. Add migrations if needed
4. Register in `packages/server/src/store/`

### Adding a New HTTP Endpoint

1. Add route handler in `packages/server/src/http/Routes.ts`
2. Register in `Server.ts`
3. Add to API documentation
4. Add integration test

---

*This roadmap will be updated as decisions are made and features are completed.*
