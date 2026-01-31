# Public vs Internal API

Open Scaffold separates its API into **public** and **internal** exports. This guide explains when to use each.

## Quick Reference

| Import Path | Stability | Who Should Use |
|-------------|-----------|----------------|
| `@open-scaffold/core` | Stable | Everyone |
| `@open-scaffold/server` | Stable | Everyone |
| `@open-scaffold/client` | Stable | Everyone |
| `@open-scaffold/core/internal` | Unstable | Library authors, advanced testing |
| `@open-scaffold/server/internal` | Unstable | Library authors, custom servers |
| `@open-scaffold/client/internal` | Unstable | Library authors, custom SSE handling |

## Public API

Use the public API for building workflows and applications. These exports are stable and documented.

### @open-scaffold/core

```typescript
import {
  // Workflow definition
  agent,
  workflow,
  phase,
  run,

  // Types
  type AgentDef,
  type WorkflowDef,
  type PhaseDef,
  type RunOptions,
  type WorkflowExecution,

  // Events
  type AnyEvent,
  type StateSnapshot,
  EVENTS,
  makeEvent,

  // IDs
  type SessionId,
  type WorkflowId,
  makeSessionId,

  // Errors
  WorkflowValidationError,
  WorkflowTimeoutError,

  // HITL helpers
  autoApprove,
  cliPrompt,
} from "@open-scaffold/core"
```

### @open-scaffold/server

```typescript
import {
  // Server creation
  OpenScaffold,
  type OpenScaffoldConfig,

  // Provider
  AnthropicProvider,
  type AnthropicModel,

  // Constants
  DEFAULT_PORT,
  DEFAULT_HOST,
} from "@open-scaffold/server"
```

### @open-scaffold/client

```typescript
import {
  // Client
  HttpClient,
  type WorkflowClient,
  type ClientConfig,
  ClientError,

  // React hooks
  WorkflowClientProvider,
  useWorkflow,
  useSession,
  useSessionState,
  useSubmitInput,
} from "@open-scaffold/client"
```

## Internal API

Use the internal API when you need low-level access. These exports may change between versions.

### When to Use Internal Exports

1. **Building custom layers** - Creating new storage backends or providers
2. **Advanced testing** - Recording/playback infrastructure, custom event stores
3. **Library authoring** - Building frameworks on top of Open Scaffold
4. **Custom server implementations** - Direct route handler access

### @open-scaffold/core/internal

```typescript
import {
  // Services (Effect Context.Tag)
  EventStore,
  EventBus,
  EventHub,
  StateSnapshotStore,
  ProviderRecorder,
  ProviderModeContext,
  StateProjection,

  // Layers (runtime implementations)
  EventStoreLive,
  InMemoryEventStore,
  InMemoryEventBus,
  InMemoryEventHub,
  InMemoryProviderRecorder,

  // Utilities
  computeStateAt,
  deriveState,
  deriveStateOptimized,

  // Low-level execution
  executeWorkflow,
  streamWorkflow,
  execute,

  // Provider infrastructure
  runAgentDef,
  mapStreamEventToInternal,

  // Session context
  SessionContextRef,
  withSessionContext,
  getSessionContext,
} from "@open-scaffold/core/internal"
```

### @open-scaffold/server/internal

```typescript
import {
  // Route handlers
  createSessionRoute,
  getSessionRoute,
  getSessionEventsRoute,
  postSessionInputRoute,
  // ... more routes

  // Server internals
  Server,
  ServerError,
  createServer,

  // SSE utilities
  formatSSEMessage,
  eventStreamToSSE,
  SSE_HEADERS,

  // Store implementations
  // ... store exports

  // Programs (business logic)
  // ... program exports
} from "@open-scaffold/server/internal"
```

### @open-scaffold/client/internal

```typescript
import {
  // SSE parsing
  parseSSEMessage,
  createSSEStream,
  type ParsedSSEMessage,

  // Reconnection
  sseReconnectSchedule,
} from "@open-scaffold/client/internal"
```

## Examples

### Standard Application (Public API Only)

```typescript
import { agent, workflow, phase, run, autoApprove } from "@open-scaffold/core"
import { OpenScaffold, AnthropicProvider } from "@open-scaffold/server"

const myAgent = agent({
  name: "assistant",
  provider: AnthropicProvider({ model: "claude-sonnet-4-5" }),
})

const myWorkflow = workflow({
  name: "my-workflow",
  phases: {
    main: phase({ agent: myAgent }),
  },
})

const result = await run(myWorkflow, {
  input: "Hello",
  humanInput: autoApprove(),
})
```

### Custom Storage Backend (Internal API)

```typescript
import { EventStore, type EventStoreService } from "@open-scaffold/core/internal"
import { Layer, Effect, Context } from "effect"

// Create a custom EventStore implementation
const MyCustomEventStore = Layer.succeed(
  EventStore,
  {
    append: (sessionId, events) => Effect.succeed(undefined),
    getEvents: (sessionId) => Effect.succeed([]),
    getSessionIds: () => Effect.succeed([]),
    deleteSession: (sessionId) => Effect.succeed(undefined),
  }
)
```

### Custom Test Infrastructure (Internal API)

```typescript
import {
  EventStoreLive,
  InMemoryEventBus,
  InMemoryProviderRecorder,
  ProviderModeContext,
} from "@open-scaffold/core/internal"
import { Layer } from "effect"

// Create a test layer with in-memory implementations
const TestLayer = Layer.mergeAll(
  EventStoreLive({ url: ":memory:" }),
  InMemoryEventBus,
  InMemoryProviderRecorder,
  Layer.succeed(ProviderModeContext, { mode: "playback" })
)
```

## Migration Notes

If you were importing from internal paths before ADR-003:

```typescript
// Before (may have worked but was undocumented)
import { EventStore } from "@open-scaffold/core"

// After (explicit opt-in)
import { EventStore } from "@open-scaffold/core/internal"
```

The public index still re-exports `Services` and `Layers` namespaces for backward compatibility, but direct service imports should come from `/internal`.

## See Also

- [ADR-003: Public vs Internal Exports](../plans/adr/003-public-vs-internal-exports.md)
- [API Reference](../api-reference.md)
- [Architecture](../architecture.md)
