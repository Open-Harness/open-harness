# React Source

React bindings implementation.

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| context.ts | WorkflowContext definition |
| Provider.tsx | WorkflowProvider component |
| hooks.ts | React hooks for workflow interaction |

## Hooks

### Core Hooks
| Hook | Returns | Purpose |
|------|---------|---------|
| `useEvents()` | `AnyEvent[]` | All session events |
| `useWorkflowState<S>()` | `S` | Current workflow state |
| `useSendInput()` | `(text) => Promise` | Send user input |
| `useStatus()` | `ConnectionStatus` | Connection status |
| `useCreateSession()` | `(input) => Promise<string>` | Create session |
| `useConnectSession()` | `(id) => Promise` | Connect to session |

### Session Hooks
| Hook | Returns | Purpose |
|------|---------|---------|
| `useSessionId()` | `string \| null` | Current session ID |
| `useDisconnect()` | `() => Promise` | Disconnect |
| `usePosition()` | `number` | Current event position |
| `useIsConnected()` | `boolean` | Connection state |

### VCR Hooks
| Hook | Returns | Purpose |
|------|---------|---------|
| `useStateAt(n)` | `{ state, loading }` | State at position n |
| `usePause()` | `() => Promise` | Pause session |
| `useResume()` | `() => Promise` | Resume session |
| `useFork()` | `() => Promise<string>` | Fork session |
| `useIsRunning()` | `boolean` | Is session running |
| `useIsPaused()` | `boolean` | Is session paused |

### HITL Hooks
| Hook | Returns | Purpose |
|------|---------|---------|
| `usePendingInteraction()` | `Interaction \| null` | Pending human input |
| `useFilteredEvents(names)` | `AnyEvent[]` | Filtered events |

## Usage

```tsx
import { WorkflowProvider, useCreateSession, useEvents } from "@open-scaffold/client"

function SessionView() {
  const createSession = useCreateSession()
  const events = useEvents()

  return (
    <div>
      <button onClick={() => createSession("Build a dashboard")}>New Session</button>
      <div>{events.length} events</div>
    </div>
  )
}

export default function App() {
  return (
    <WorkflowProvider url="http://localhost:42069">
      <SessionView />
    </WorkflowProvider>
  )
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
     │context.ts │    │Provider   │    │ hooks.ts  │
     │(Context)  │◄───│ (.tsx)    │───►│(useXxx)   │
     └───────────┘    └───────────┘    └───────────┘
```
