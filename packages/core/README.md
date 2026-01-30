# @open-scaffold/core

Event-sourced workflow runtime with Effect-TS.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Public API (index.ts)                     │
│  Plain TS + Zod - Promise returns - No Effect exposed        │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌──────────┐        ┌───────────┐       ┌───────────┐
   │  Domain  │        │ Services  │       │ Programs  │
   │  Types   │◄──────►│   Tags    │◄──────│  Effects  │
   └──────────┘        └───────────┘       └───────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                       ┌───────────┐
                       │  Layers   │
                       │(Stubs/Live)│
                       └───────────┘
```

## Package Structure

| Folder | Purpose |
|--------|---------|
| Domain/ | Types, errors, IDs - the vocabulary |
| Services/ | Context.Tag definitions - service contracts |
| Programs/ | Effect compositions - business logic |
| Layers/ | Layer implementations (Stubs for validation) |

## Services

| Service | Purpose |
|---------|---------|
| EventStore | Persist and query events |
| StateSnapshotStore | Cache computed state |
| EventBus | Pub/sub for real-time events |
| ProviderRecorder | Record/replay API responses |
| AgentProvider | AI provider interface (Stream-based) |

## Installation

```bash
bun add @open-scaffold/core
```

## Usage

```typescript
import { workflow, defineHandler, defineEvent, agent } from "@open-scaffold/core"
import { z } from "zod"

// Define events
const TaskCreated = defineEvent("task:created", z.object({
  taskId: z.string(),
  title: z.string(),
}))

// Define handlers
const onTaskCreated = defineHandler({
  name: "task-created-handler",
  events: ["task:created"],
  handle: (state, event) => ({
    state: { ...state, tasks: [...state.tasks, event.payload] },
    emit: [],
  }),
})

// Define agents (AI-powered)
const plannerAgent = agent({
  name: "planner",
  description: "Creates task plans",
  trigger: (state, event) => event.name === "user:input",
  provider: myProvider,
  outputSchema: z.object({ plan: z.array(z.string()) }),
  prompt: (state, event) => `Create a plan for: ${event.payload.text}`,
})

// Compose workflow
const myWorkflow = workflow({
  name: "task-manager",
  initialState: { tasks: [] },
  handlers: [onTaskCreated],
  agents: [plannerAgent],
  until: (state) => state.tasks.length >= 10,
})
```

## Human-in-the-Loop (HITL)

Request human input during workflow execution using `createInteraction`:

```typescript
import { createInteraction, defineEvent } from "@open-scaffold/core"

interface MyState {
  items: string[]
  phase: "pending" | "approved" | "rejected"
}

// Define a custom event for when approval completes
const ApprovalComplete = defineEvent<"approval:complete", { approved: boolean }>(
  "approval:complete"
)

// Create an interaction
const itemApproval = createInteraction<MyState>({
  name: "item-approval",
  type: "approval",  // "approval" | "choice" | "freeform"
  prompt: (state) => `Approve ${state.items.length} items?`,
  metadata: (state) => ({ itemCount: state.items.length }),
  onResponse: (response, state, trigger) => {
    const approved = response === true
    return {
      state: { ...state, phase: approved ? "approved" : "rejected" },
      events: [ApprovalComplete.create({ approved }, trigger.id)]
    }
  }
})

// Use in a handler - emit the request event
const startHandler = defineHandler(WorkflowStart, {
  name: "handleStart",
  handler: (event, state) => ({
    state: { ...state, phase: "pending" },
    events: [itemApproval.request(state, "my-agent", event.id)]
  })
})

// The interaction's response handler processes input:response events
const myWorkflow = workflow({
  name: "approval-workflow",
  initialState: { items: [], phase: "pending" },
  handlers: [startHandler, itemApproval.responseHandler],
  agents: [],
  until: (state) => state.phase !== "pending"
})
```

### Interaction Types

| Type | Response | Use Case |
|------|----------|----------|
| `approval` | `boolean` | Yes/No decisions |
| `choice` | `string` | Select from options |
| `freeform` | `string` | Free text input |

### HITL Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `input:requested` | Agent → Human | Request input (contains prompt, type, options) |
| `input:response` | Human → Agent | Provide response (contains value) |

### Helper Functions

```typescript
import {
  isInteractionRequest,
  isInteractionResponse,
  findPendingInteractions
} from "@open-scaffold/core"

// Check event types
if (isInteractionRequest(event)) {
  console.log(event.payload.prompt)
}

// Find all pending interactions in event stream
const pending = findPendingInteractions(events)
```

## Provider Modes

The runtime supports two modes via `ProviderModeContext`:

| Mode | Behavior |
|------|----------|
| `live` | Call real APIs, record responses |
| `playback` | Replay recorded responses |

## Exports

```typescript
// Domain types
export { AnyEvent, Event, defineEvent }
export { Handler, defineHandler }
export { Agent, agent, AgentProvider, ProviderMode }
export { WorkflowDefinition, workflow }

// HITL (Human-in-the-Loop)
export { createInteraction }
export { isInteractionRequest, isInteractionResponse, findPendingInteractions }
export { InputRequested, InputResponse }  // Built-in events

// Services (for custom layers)
export * as Services from "./Services"

// Programs (for composition)
export * as Programs from "./Programs"

// Layers (for testing)
export * as Stubs from "./Layers/Stubs"

// Errors
export { ValidationError, SessionNotFound, AgentError, ... }
```

## Dependencies

- `effect` - Core runtime
- `@effect/schema` - Validation
- `zod` - Public API schemas
