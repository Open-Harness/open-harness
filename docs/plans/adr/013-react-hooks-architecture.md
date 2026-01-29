# ADR-013: React Hooks Architecture

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Client React Hooks
**Related Issues:** ARCH-008, API-010, DEAD-010, TEST-012, TEST-013, DOC-003

---

## Context

The current React hooks have several problems:

### Current State (19 Individual Hooks)

```typescript
// 19 thin wrappers around context
export const useEvents = () => useWorkflowContext().events
export const useStatus = () => useWorkflowContext().status
export const useSessionId = () => useWorkflowContext().sessionId
// ... 16 more identical patterns
```

### Problems Identified

1. **Redundancy** — 19 hooks that are just `useContext().property`
2. **Two access patterns** — Hooks AND direct context access (ARCH-008)
3. **Client-side state derivation** — Contradicts ADR-006 (server-side StateCache)
4. **No caching** — Same data fetched multiple times
5. **Manual SSE handling** — No integration with data fetching
6. **No loading/error states** — Manual state management
7. **Not tree-shakeable** — All or nothing

### What ADRs Require

| ADR | Requirement |
|-----|-------------|
| ADR-001 | Client connects via HTTP/SSE, server runs workflows |
| ADR-002 | HITL via `input:requested` / `input:received` events |
| ADR-004 | Events stream via SSE with `_tag` field |
| ADR-006 | **State derived server-side via StateCache** |

**Key insight:** ADR-006 says state derivation happens on the server with caching. The client should **fetch computed state**, not compute it locally.

---

## Decision

**Use React Query (TanStack Query) with a three-tier hook architecture.**

### Core Principles

1. **React Query for all HTTP** — Queries for reads, mutations for writes
2. **SSE updates React Query cache** — Real-time events update the query cache
3. **Server-side state derivation** — Client fetches state from `GET /sessions/{id}/state?position=N`
4. **Three-tier API** — Internal primitives, grouped hooks, unified hook

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC API (Tier 2)                      │
│                                                             │
│    useWorkflow(sessionId)  ← Most users use this           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  GROUPED HOOKS (Tier 1)                     │
│                                                             │
│  useWorkflowData    useWorkflowActions    useWorkflowVCR   │
│  useWorkflowHITL                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               PRIMITIVE HOOKS (Tier 0 - Internal)           │
│                                                             │
│  useSessionQuery     useEventsQuery      useStateAtQuery   │
│  useCreateMutation   useSendInputMutation                  │
│  usePauseMutation    useResumeMutation   useForkMutation   │
│  useEventSubscription                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    REACT QUERY CACHE                        │
│                                                             │
│  ['session', id]  ['events', id]  ['state', id, position]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      HTTP / SSE                             │
│                                                             │
│  GET /sessions/{id}          POST /sessions                 │
│  GET /sessions/{id}/events   POST /sessions/{id}/input      │
│  GET /sessions/{id}/state    POST /sessions/{id}/pause      │
│                              POST /sessions/{id}/resume     │
│                              POST /sessions/{id}/fork       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tier 0: Primitive Hooks (Internal)

These are not exported publicly. They're the building blocks.

### Queries

```typescript
// Session info
const useSessionQuery = (sessionId: string) =>
  useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => client.getSession(sessionId),
    enabled: !!sessionId,
  })

// Events (initially empty, populated by SSE)
const useEventsQuery = (sessionId: string) =>
  useQuery({
    queryKey: ['events', sessionId],
    queryFn: () => client.getEvents(sessionId),
    enabled: !!sessionId,
    staleTime: Infinity,  // SSE keeps it fresh
  })

// State at position (server-side derivation via StateCache)
const useStateAtQuery = <S>(sessionId: string, position: number) =>
  useQuery({
    queryKey: ['state', sessionId, position],
    queryFn: () => client.getStateAt<S>(sessionId, position),
    enabled: !!sessionId && position >= 0,
  })
```

### Mutations

```typescript
const useCreateSessionMutation = () =>
  useMutation({
    mutationFn: ({ workflowId, input }: CreateSessionInput) =>
      client.createSession(workflowId, input),
  })

const useSendInputMutation = () =>
  useMutation({
    mutationFn: ({ sessionId, payload }: SendInputInput) =>
      client.sendInput(sessionId, payload),
  })

const usePauseMutation = () =>
  useMutation({
    mutationFn: (sessionId: string) => client.pause(sessionId),
  })

const useResumeMutation = () =>
  useMutation({
    mutationFn: (sessionId: string) => client.resume(sessionId),
  })

const useForkMutation = () =>
  useMutation({
    mutationFn: ({ sessionId, at }: ForkInput) =>
      client.fork(sessionId, at),
  })
```

### SSE Subscription

```typescript
const useEventSubscription = (sessionId: string | null) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionId) return

    const eventSource = new EventSource(
      `${client.baseUrl}/sessions/${sessionId}/events`
    )

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data) as SerializedEvent

      // Append to events cache
      queryClient.setQueryData<SerializedEvent[]>(
        ['events', sessionId],
        (old = []) => [...old, event]
      )

      // Invalidate state cache when state changes
      if (event.name === 'state:intent' || event.name === 'state:checkpoint') {
        queryClient.invalidateQueries({
          queryKey: ['state', sessionId],
          exact: false,
        })
      }

      // Invalidate session cache on completion
      if (event.name === 'workflow:completed') {
        queryClient.invalidateQueries({
          queryKey: ['session', sessionId],
        })
      }
    }

    eventSource.onerror = () => {
      // React Query will handle retry via refetch
      queryClient.invalidateQueries({ queryKey: ['events', sessionId] })
    }

    return () => eventSource.close()
  }, [sessionId, queryClient])
}
```

---

## Tier 1: Grouped Hooks (Public - Advanced)

Four hooks organized by concern. Exported for advanced users.

### useWorkflowData

```typescript
export interface WorkflowDataResult<S> {
  /** All events received so far */
  readonly events: ReadonlyArray<SerializedEvent>
  /** Current computed state (from server) */
  readonly state: S | undefined
  /** Current position in event stream */
  readonly position: number
  /** Connection status */
  readonly status: 'connecting' | 'connected' | 'disconnected' | 'error'
  /** Whether data is loading */
  readonly isLoading: boolean
  /** Error if any */
  readonly error: Error | null
}

export const useWorkflowData = <S>(sessionId: string | null): WorkflowDataResult<S> => {
  // Subscribe to SSE (updates query cache)
  useEventSubscription(sessionId)

  // Get events from cache
  const eventsQuery = useEventsQuery(sessionId ?? '')
  const events = eventsQuery.data ?? []
  const position = events.length

  // Get computed state from server
  const stateQuery = useStateAtQuery<S>(sessionId ?? '', position)

  // Derive connection status
  const status = useMemo(() => {
    if (!sessionId) return 'disconnected'
    if (eventsQuery.isLoading) return 'connecting'
    if (eventsQuery.isError) return 'error'
    return 'connected'
  }, [sessionId, eventsQuery.isLoading, eventsQuery.isError])

  return {
    events,
    state: stateQuery.data,
    position,
    status,
    isLoading: eventsQuery.isLoading || stateQuery.isLoading,
    error: eventsQuery.error ?? stateQuery.error ?? null,
  }
}
```

### useWorkflowActions

```typescript
export interface WorkflowActionsResult {
  /** Create a new session */
  readonly create: (workflowId: string, input: string) => Promise<string>
  /** Send human input */
  readonly send: (sessionId: string, payload: InputPayload) => Promise<void>
  /** Whether create is in progress */
  readonly isCreating: boolean
  /** Whether send is in progress */
  readonly isSending: boolean
}

export const useWorkflowActions = (): WorkflowActionsResult => {
  const createMutation = useCreateSessionMutation()
  const sendMutation = useSendInputMutation()

  return {
    create: (workflowId, input) =>
      createMutation.mutateAsync({ workflowId, input }),
    send: (sessionId, payload) =>
      sendMutation.mutateAsync({ sessionId, payload }),
    isCreating: createMutation.isPending,
    isSending: sendMutation.isPending,
  }
}
```

### useWorkflowVCR

```typescript
export interface WorkflowVCRResult {
  /** Pause the session */
  readonly pause: (sessionId: string) => Promise<PauseResult>
  /** Resume the session */
  readonly resume: (sessionId: string) => Promise<ResumeResult>
  /** Fork the session at a point */
  readonly fork: (sessionId: string, at: ForkAt) => Promise<ForkResult>
  /** Whether pause is in progress */
  readonly isPausing: boolean
  /** Whether resume is in progress */
  readonly isResuming: boolean
  /** Whether fork is in progress */
  readonly isForking: boolean
}

export const useWorkflowVCR = (): WorkflowVCRResult => {
  const pauseMutation = usePauseMutation()
  const resumeMutation = useResumeMutation()
  const forkMutation = useForkMutation()

  return {
    pause: (sessionId) => pauseMutation.mutateAsync(sessionId),
    resume: (sessionId) => resumeMutation.mutateAsync(sessionId),
    fork: (sessionId, at) => forkMutation.mutateAsync({ sessionId, at }),
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isForking: forkMutation.isPending,
  }
}
```

### useWorkflowHITL

```typescript
export interface PendingInteraction {
  readonly id: string
  readonly prompt: string
  readonly type: 'approval' | 'choice'
  readonly options?: ReadonlyArray<string>
  readonly timestamp: Date
}

export interface WorkflowHITLResult {
  /** Pending interactions awaiting response */
  readonly pending: ReadonlyArray<PendingInteraction>
  /** Respond to an interaction */
  readonly respond: (
    sessionId: string,
    interactionId: string,
    value: string,
    approved?: boolean
  ) => Promise<void>
  /** Whether a response is in progress */
  readonly isResponding: boolean
}

export const useWorkflowHITL = (sessionId: string | null): WorkflowHITLResult => {
  const eventsQuery = useEventsQuery(sessionId ?? '')
  const sendMutation = useSendInputMutation()

  const pending = useMemo(() => {
    const events = eventsQuery.data ?? []
    const requests = new Map<string, PendingInteraction>()
    const respondedIds = new Set<string>()

    for (const event of events) {
      if (event.name === 'input:requested') {
        const payload = event.payload as InputRequestedPayload
        requests.set(payload.id, {
          id: payload.id,
          prompt: payload.prompt,
          type: payload.type,
          options: payload.options,
          timestamp: event.timestamp,
        })
      } else if (event.name === 'input:received') {
        const payload = event.payload as InputReceivedPayload
        respondedIds.add(payload.id)
      }
    }

    return Array.from(requests.values())
      .filter((r) => !respondedIds.has(r.id))
  }, [eventsQuery.data])

  const respond = useCallback(
    async (
      sessionId: string,
      interactionId: string,
      value: string,
      approved?: boolean
    ) => {
      await sendMutation.mutateAsync({
        sessionId,
        payload: { id: interactionId, value, approved },
      })
    },
    [sendMutation]
  )

  return {
    pending,
    respond,
    isResponding: sendMutation.isPending,
  }
}
```

---

## Tier 2: Unified Hook (Public - Simple)

One hook for most users. Composes the grouped hooks.

```typescript
export interface UseWorkflowResult<S> {
  // ─────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────
  readonly status: 'connecting' | 'connected' | 'disconnected' | 'error'
  readonly isConnected: boolean

  // ─────────────────────────────────────────────────────────
  // Data
  // ─────────────────────────────────────────────────────────
  readonly events: ReadonlyArray<SerializedEvent>
  readonly state: S | undefined
  readonly position: number

  // ─────────────────────────────────────────────────────────
  // Derived Status
  // ─────────────────────────────────────────────────────────
  readonly isRunning: boolean
  readonly isPaused: boolean
  readonly isCompleted: boolean

  // ─────────────────────────────────────────────────────────
  // HITL
  // ─────────────────────────────────────────────────────────
  readonly pendingInteractions: ReadonlyArray<PendingInteraction>

  // ─────────────────────────────────────────────────────────
  // Actions (bound to sessionId)
  // ─────────────────────────────────────────────────────────
  readonly send: (payload: InputPayload) => Promise<void>
  readonly pause: () => Promise<PauseResult>
  readonly resume: () => Promise<ResumeResult>
  readonly fork: (at: ForkAt) => Promise<ForkResult>

  // ─────────────────────────────────────────────────────────
  // Loading States
  // ─────────────────────────────────────────────────────────
  readonly isLoading: boolean
  readonly isSending: boolean
  readonly isPausing: boolean
  readonly isResuming: boolean
  readonly isForking: boolean

  // ─────────────────────────────────────────────────────────
  // Error
  // ─────────────────────────────────────────────────────────
  readonly error: Error | null
}

export const useWorkflow = <S>(sessionId: string | null): UseWorkflowResult<S> => {
  const data = useWorkflowData<S>(sessionId)
  const actions = useWorkflowActions()
  const vcr = useWorkflowVCR()
  const hitl = useWorkflowHITL(sessionId)

  // Derive workflow status from events
  const { isRunning, isPaused, isCompleted } = useMemo(() => {
    const events = data.events
    const hasStarted = events.some((e) => e.name === 'workflow:started')
    const hasCompleted = events.some((e) => e.name === 'workflow:completed')
    const hasPaused = events.some((e) => e.name === 'workflow:paused')
    const hasResumed = events.filter((e) => e.name === 'workflow:resumed').length

    return {
      isRunning: hasStarted && !hasCompleted && !hasPaused,
      isPaused: hasPaused && hasResumed < events.filter((e) => e.name === 'workflow:paused').length,
      isCompleted: hasCompleted,
    }
  }, [data.events])

  return {
    // Connection
    status: data.status,
    isConnected: data.status === 'connected',

    // Data
    events: data.events,
    state: data.state,
    position: data.position,

    // Derived
    isRunning,
    isPaused,
    isCompleted,

    // HITL
    pendingInteractions: hitl.pending,

    // Actions (bound to sessionId)
    send: (payload) => {
      if (!sessionId) throw new Error('No session connected')
      return actions.send(sessionId, payload)
    },
    pause: () => {
      if (!sessionId) throw new Error('No session connected')
      return vcr.pause(sessionId)
    },
    resume: () => {
      if (!sessionId) throw new Error('No session connected')
      return vcr.resume(sessionId)
    },
    fork: (at) => {
      if (!sessionId) throw new Error('No session connected')
      return vcr.fork(sessionId, at)
    },

    // Loading
    isLoading: data.isLoading,
    isSending: actions.isSending,
    isPausing: vcr.isPausing,
    isResuming: vcr.isResuming,
    isForking: vcr.isForking,

    // Error
    error: data.error,
  }
}
```

---

## Provider Setup

Users must wrap their app with React Query provider:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkflowClientProvider } from '@open-scaffold/client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,      // 1 minute
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkflowClientProvider baseUrl="http://localhost:3000">
        <MyApp />
      </WorkflowClientProvider>
    </QueryClientProvider>
  )
}
```

---

## Usage Examples

### Simple (Most Users)

```tsx
function WorkflowUI({ sessionId }: { sessionId: string }) {
  const {
    state,
    events,
    isRunning,
    pendingInteractions,
    send,
    pause,
    resume,
  } = useWorkflow<MyState>(sessionId)

  return (
    <div>
      <h1>State: {JSON.stringify(state)}</h1>
      <p>{events.length} events, {isRunning ? 'running' : 'stopped'}</p>

      {pendingInteractions.map((interaction) => (
        <div key={interaction.id}>
          <p>{interaction.prompt}</p>
          {interaction.type === 'approval' && (
            <>
              <button onClick={() => send({ id: interaction.id, value: 'yes', approved: true })}>
                Approve
              </button>
              <button onClick={() => send({ id: interaction.id, value: 'no', approved: false })}>
                Reject
              </button>
            </>
          )}
        </div>
      ))}

      <button onClick={pause} disabled={!isRunning}>Pause</button>
      <button onClick={resume} disabled={isRunning}>Resume</button>
    </div>
  )
}
```

### Advanced (Grouped Hooks)

```tsx
function EventLog({ sessionId }: { sessionId: string }) {
  const { events } = useWorkflowData(sessionId)
  return (
    <ul>
      {events.map((e, i) => (
        <li key={i}>{e.name}: {JSON.stringify(e.payload)}</li>
      ))}
    </ul>
  )
}

function VCRControls({ sessionId }: { sessionId: string }) {
  const { pause, resume, fork, isPausing, isResuming } = useWorkflowVCR()
  return (
    <div>
      <button onClick={() => pause(sessionId)} disabled={isPausing}>Pause</button>
      <button onClick={() => resume(sessionId)} disabled={isResuming}>Resume</button>
      <button onClick={() => fork(sessionId, { phase: 'planning', occurrence: 'first' })}>
        Fork
      </button>
    </div>
  )
}
```

---

## What Gets Removed

| Export | Reason |
|--------|--------|
| `useEvents` | Replaced by `useWorkflowData().events` |
| `useWorkflowState` | Replaced by `useWorkflowData().state` |
| `useSendInput` | Replaced by `useWorkflowActions().send` |
| `useStatus` | Replaced by `useWorkflowData().status` |
| `useCreateSession` | Replaced by `useWorkflowActions().create` |
| `useConnectSession` | Not needed — use `useWorkflow(sessionId)` |
| `useSessionId` | Not needed — caller provides sessionId |
| `useDisconnect` | Not needed — unmount handles cleanup |
| `usePosition` | Replaced by `useWorkflowData().position` |
| `useIsConnected` | Replaced by `useWorkflowData().status === 'connected'` |
| `useFilteredEvents` | Users can filter `events` themselves |
| `useStateAt` | Replaced by `useWorkflowData().state` (current position) |
| `usePause` | Replaced by `useWorkflowVCR().pause` |
| `useResume` | Replaced by `useWorkflowVCR().resume` |
| `useFork` | Replaced by `useWorkflowVCR().fork` |
| `useIsRunning` | Replaced by `useWorkflow().isRunning` |
| `useIsPaused` | Replaced by `useWorkflow().isPaused` |
| `usePendingInteraction` | Replaced by `useWorkflowHITL().pending[0]` |
| `usePendingInteractions` | Replaced by `useWorkflowHITL().pending` |
| `WorkflowContext` (direct) | Internal only — use hooks |

---

## What Gets Added

| Export | Purpose |
|--------|---------|
| `useWorkflow<S>(sessionId)` | Unified hook for most users |
| `useWorkflowData<S>(sessionId)` | Data access (events, state, position) |
| `useWorkflowActions()` | Session creation and input sending |
| `useWorkflowVCR()` | Pause, resume, fork controls |
| `useWorkflowHITL(sessionId)` | Pending interactions and respond |
| `WorkflowClientProvider` | Provides client configuration |

---

## Dependencies

New dependency: `@tanstack/react-query` (v5+)

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

---

## Alternatives Considered

### Option A: Keep Current Hooks
- Add React Query internally but keep 19 individual hooks
- **Rejected:** Doesn't solve ARCH-008 (two access patterns), still verbose

### Option B: Single Mega-Hook Only
- Only export `useWorkflow`, no grouped hooks
- **Rejected:** Not tree-shakeable, less flexible for advanced users

### Option C: Context-Only (No Hooks)
- Remove hooks entirely, users access context directly
- **Rejected:** Less ergonomic, hooks are React-idiomatic

### Option D: SWR Instead of React Query
- Use Vercel's SWR library
- **Rejected:** React Query has better mutation support, devtools, more features

---

## Consequences

### Positive

1. **Single source of truth** — React Query cache, not multiple React states
2. **Server-side state derivation** — Aligns with ADR-006
3. **Automatic caching** — Same session data shared across components
4. **Loading/error states** — Built-in, consistent patterns
5. **SSE integration** — Events update cache, queries stay fresh
6. **Tree-shakeable** — Import only what you need
7. **DevTools** — React Query devtools for debugging
8. **Fewer exports** — 6 hooks instead of 19
9. **Clear tiers** — Simple for beginners, powerful for advanced users

### Negative

1. **New dependency** — `@tanstack/react-query` (~12KB gzipped)
2. **Breaking change** — All existing hook imports change
3. **Learning curve** — Users must understand React Query basics
4. **Provider required** — Must wrap app with `QueryClientProvider`

### Migration Path

1. Add `@tanstack/react-query` dependency
2. Create internal primitive hooks
3. Create grouped hooks (Tier 1)
4. Create unified hook (Tier 2)
5. Update exports in `packages/client/src/react/index.ts`
6. Add `WorkflowClientProvider` component
7. Update documentation with new patterns
8. Deprecate old hooks (keep for one version with warnings)
9. Remove old hooks in next major version

---

## Implementation Notes

### Files to Create

| File | Purpose |
|------|---------|
| `packages/client/src/react/primitives/queries.ts` | React Query query hooks |
| `packages/client/src/react/primitives/mutations.ts` | React Query mutation hooks |
| `packages/client/src/react/primitives/subscription.ts` | SSE subscription hook |
| `packages/client/src/react/hooks/useWorkflowData.ts` | Grouped data hook |
| `packages/client/src/react/hooks/useWorkflowActions.ts` | Grouped actions hook |
| `packages/client/src/react/hooks/useWorkflowVCR.ts` | Grouped VCR hook |
| `packages/client/src/react/hooks/useWorkflowHITL.ts` | Grouped HITL hook |
| `packages/client/src/react/hooks/useWorkflow.ts` | Unified hook |
| `packages/client/src/react/WorkflowClientProvider.tsx` | Client config provider |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/client/src/react/index.ts` | Update exports |
| `packages/client/package.json` | Add React Query dependency |

### Files to Delete

| File | Reason |
|------|--------|
| `packages/client/src/react/hooks.ts` | Replaced by new hooks directory |
| `packages/client/src/react/context.ts` | Internal to new implementation |
| `packages/client/src/react/Provider.tsx` | Replaced by WorkflowClientProvider |

---

## Related ADRs

- [ADR-001: Execution API Design](./001-execution-api.md) — Client connects via HTTP/SSE
- [ADR-002: HITL Architecture](./002-hitl-architecture.md) — Input types and event flow
- [ADR-004: Event/Observer Pattern](./004-event-observer-pattern.md) — Event structure
- [ADR-006: State Sourcing Model](./006-state-sourcing-model.md) — Server-side state derivation

---

## References

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query SSE Pattern](https://tanstack.com/query/latest/docs/react/guides/sse)
