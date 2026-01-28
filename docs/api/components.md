# Component Library Reference

`@open-scaffold/ui` provides styled React components for Open Scaffold workflows.

## Installation

```bash
pnpm add @open-scaffold/ui
```

## Setup

Components require the `WorkflowProvider` from `@open-scaffold/client`:

```tsx
import { WorkflowProvider } from "@open-scaffold/client"
import { EventStream, VCRToolbar, InteractionModal } from "@open-scaffold/ui"

function App() {
  return (
    <WorkflowProvider url="http://localhost:3001">
      <EventStream />
      <VCRToolbar />
      <InteractionModal />
    </WorkflowProvider>
  )
}
```

### Tailwind CSS

Components use Tailwind CSS classes. Ensure Tailwind is configured in your project and includes the UI package in the content paths:

```js
// tailwind.config.js
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@open-scaffold/ui/**/*.{js,mjs}"
  ],
  darkMode: "class"
}
```

### Storybook Development

The UI package includes Storybook for component development and testing:

```bash
cd packages/ui
pnpm storybook
```

This opens Storybook at `http://localhost:6006` where you can:
- Browse all components and their variants
- Test different props interactively
- View dark mode and responsive behavior
- Check accessibility

---

## Connection Components

### ConnectionStatus

Displays the current connection status with optional icon.

```tsx
import { ConnectionStatus } from "@open-scaffold/ui"

// Basic usage - automatically reads from WorkflowProvider
<ConnectionStatus />

// With icon
<ConnectionStatus showIcon />

// Custom labels
<ConnectionStatus labels={{ connected: "Online", disconnected: "Offline" }} />
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `labels` | `Partial<Record<ConnectionStatus, string>>` | Default labels | Custom status labels |
| `showIcon` | `boolean` | `false` | Show icon with text |

---

### ConnectionBadge

Compact colored dot indicator for connection status.

```tsx
import { ConnectionBadge } from "@open-scaffold/ui"

// Basic - uses context automatically
<ConnectionBadge />

// Large with pulse animation
<ConnectionBadge size="lg" pulse />
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Badge size |
| `pulse` | `boolean` | `true` | Pulse animation when connected |

---

## Event Components

### EventStream

Scrolling list of workflow events with auto-scroll.

```tsx
import { EventStream } from "@open-scaffold/ui"
import { useFilteredEvents } from "@open-scaffold/client"

// Basic - uses useEvents() internally
<EventStream />

// With custom max height
<EventStream maxHeight="400px" />

// With filtered events from hook
function FilteredStream() {
  const events = useFilteredEvents(["agent:", "text:"])
  return <EventStream events={events} />
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `events` | `ReadonlyArray<AnyEvent>` | - | Custom events (overrides hook) |
| `autoScroll` | `boolean` | `true` | Auto-scroll on new events |
| `maxHeight` | `string` | `"500px"` | Maximum height (CSS) |
| `emptyMessage` | `string` | `"No events yet"` | Empty state message |
| `renderEvent` | `(event, index) => ReactNode` | - | Custom event renderer |

---

### EventCard

Single event display with expandable payload.

```tsx
import { EventCard } from "@open-scaffold/ui"
import { useEvents } from "@open-scaffold/client"

function LatestEvent() {
  const events = useEvents()
  const latest = events[events.length - 1]

  if (!latest) return null
  return <EventCard event={latest} defaultExpanded />
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `event` | `AnyEvent` | Required | The event to display |
| `className` | `string` | - | Additional CSS classes |
| `defaultExpanded` | `boolean` | `false` | Initially expanded |
| `showTimestamp` | `boolean` | `true` | Show timestamp |
| `renderName` | `(name: string) => ReactNode` | - | Custom name renderer |

---

### EventFilter

Filter chips for event types.

```tsx
import { useState } from "react"
import { EventFilter, EventStream } from "@open-scaffold/ui"
import { useFilteredEvents } from "@open-scaffold/client"

function FilterableEventStream() {
  const [selectedTypes, setSelectedTypes] = useState(["agent:", "text:"])
  const events = useFilteredEvents(selectedTypes)

  return (
    <div>
      <EventFilter
        selectedTypes={selectedTypes}
        onFilterChange={setSelectedTypes}
        showCounts
      />
      <EventStream events={events} />
    </div>
  )
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `onFilterChange` | `(types: string[]) => void` | - | Filter change callback |
| `selectedTypes` | `string[]` | `[]` | Currently selected types |
| `showCounts` | `boolean` | `true` | Show event counts |
| `events` | `ReadonlyArray<AnyEvent>` | - | Events to count (uses hook if not provided) |

---

## Input Components

### InputArea

Text input for sending user events with Cmd/Ctrl+Enter support.

```tsx
import { InputArea } from "@open-scaffold/ui"

// Basic - uses useSendInput() internally
<InputArea />

// Custom placeholder and event name
<InputArea
  placeholder="Ask a question..."
  eventName="user:question"
/>

// With callback after send
function ChatInput() {
  const handleSend = (text: string) => {
    // Additional logic after message is sent
    analytics.track("message_sent", { length: text.length })
  }

  return <InputArea onSubmit={handleSend} />
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `placeholder` | `string` | `"Type a message..."` | Input placeholder |
| `eventName` | `string` | `"user:input"` | Event name for sent events |
| `disabled` | `boolean` | - | Disabled state (auto-disabled when disconnected) |
| `onSubmit` | `(value: string) => void` | - | Callback after send |
| `showButton` | `boolean` | `true` | Show send button |
| `buttonText` | `string` | `"Send"` | Button text |

---

## State Components

### StateViewer

JSON tree viewer for workflow state.

```tsx
import { StateViewer } from "@open-scaffold/ui"
import { useWorkflowState } from "@open-scaffold/client"

// Basic - uses useWorkflowState() internally
<StateViewer />

// Auto-expand nested objects
<StateViewer maxAutoExpandDepth={3} />

// With custom state (for debugging)
function DebugView() {
  const state = useWorkflowState()
  return <StateViewer state={state.tasks} /> // View subset
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `state` | `unknown` | - | Custom state (overrides hook) |
| `defaultExpanded` | `string[]` | `[]` | Initially expanded paths |
| `maxAutoExpandDepth` | `number` | `1` | Auto-expand depth |
| `showToggle` | `boolean` | `true` | Show expand/collapse buttons |

---

### StateTimeline

Slider for time-travel debugging through event history.

```tsx
import { StateTimeline } from "@open-scaffold/ui"

// Basic - uses usePosition() and useStateAt() internally
<StateTimeline />

// With state viewer inline
<StateTimeline showStateViewer />

// Track position changes
function DebugTimeline() {
  const handlePositionChange = (position: number) => {
    // Sync with other visualizations
    highlightEventAtPosition(position)
  }

  return <StateTimeline onPositionChange={handlePositionChange} />
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `showStateViewer` | `boolean` | `true` | Show inline state viewer |
| `onPositionChange` | `(position: number) => void` | - | Position change callback |

---

## VCR Components

### VCRControls

Pause/Resume/Fork buttons for workflow control.

```tsx
import { VCRControls } from "@open-scaffold/ui"
import { useConnectSession } from "@open-scaffold/client"

// Basic - uses pause/resume hooks internally
<VCRControls />

// With fork functionality
function WorkflowControls() {
  const connectSession = useConnectSession()

  const handleFork = (newSessionId: string) => {
    // Switch to the forked session
    connectSession(newSessionId)
  }

  return <VCRControls showFork onFork={handleFork} />
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `showFork` | `boolean` | `true` | Show fork button |
| `onFork` | `(sessionId: string) => void` | - | Fork callback |
| `confirmFork` | `boolean` | `true` | Show confirmation dialog |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |

---

### VCRToolbar

Full toolbar combining VCR controls with status indicators.

```tsx
import { VCRToolbar } from "@open-scaffold/ui"

// Basic
<VCRToolbar />

// Show session ID and event position
<VCRToolbar showSessionId showPosition />

// Custom session ID prop
<VCRToolbar sessionId="my-session-123" />
```

#### Props

Extends `VCRControlsProps` plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sessionId` | `string` | - | Session ID to display (uses hook if not provided) |
| `showSessionId` | `boolean` | `false` | Show session ID |
| `showPosition` | `boolean` | `true` | Show event count |
| `showConnection` | `boolean` | `true` | Show connection badge |

---

## HITL Components (Human-in-the-Loop)

### InteractionModal

Modal that automatically appears for pending HITL interactions.

```tsx
import { InteractionModal } from "@open-scaffold/ui"

// Basic - auto-shows when interaction pending
<InteractionModal />

// Track completions
function App() {
  const handleComplete = () => {
    // Log or track interaction completion
    analytics.track("interaction_completed")
  }

  return (
    <WorkflowProvider url="...">
      {/* ... other components */}
      <InteractionModal onComplete={handleComplete} />
    </WorkflowProvider>
  )
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Backdrop CSS classes |
| `contentClassName` | `string` | - | Content CSS classes |
| `autoShow` | `boolean` | `true` | Auto-show when pending |
| `onComplete` | `() => void` | - | Completion callback |

---

### ApprovalPrompt

Yes/No approval UI for HITL interactions.

```tsx
import { ApprovalPrompt } from "@open-scaffold/ui"
import { useSendInput } from "@open-scaffold/client"

function CustomApprovalUI({ requestId, prompt, agentName }) {
  const sendInput = useSendInput()

  const handleApprove = () => {
    sendInput({ type: "approval", requestId, approved: true })
  }

  const handleReject = () => {
    sendInput({ type: "approval", requestId, approved: false })
  }

  return (
    <ApprovalPrompt
      prompt={prompt}
      agentName={agentName}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  )
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt text |
| `agentName` | `string` | - | Requesting agent name |
| `onApprove` | `() => void` | Required | Approve callback |
| `onReject` | `() => void` | Required | Reject callback |
| `approveText` | `string` | `"Approve"` | Approve button text |
| `rejectText` | `string` | `"Reject"` | Reject button text |
| `loading` | `boolean` | `false` | Loading state |

---

### ChoicePrompt

Multiple choice selection for HITL interactions.

```tsx
import { ChoicePrompt } from "@open-scaffold/ui"
import { useSendInput } from "@open-scaffold/client"

function CustomChoiceUI({ requestId, prompt, options }) {
  const sendInput = useSendInput()

  const handleSelect = (choice: string) => {
    sendInput({ type: "choice", requestId, choice })
  }

  return (
    <ChoicePrompt
      prompt={prompt}
      options={options}
      onSelect={handleSelect}
    />
  )
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt text |
| `options` | `ReadonlyArray<string>` | Required | Available choices |
| `agentName` | `string` | - | Requesting agent name |
| `onSelect` | `(choice: string) => void` | Required | Selection callback |
| `loading` | `boolean` | `false` | Loading state |
| `multiple` | `boolean` | `false` | Allow multiple selections |

---

### FreeformPrompt

Text input for freeform HITL responses.

```tsx
import { FreeformPrompt } from "@open-scaffold/ui"
import { useSendInput } from "@open-scaffold/client"

function CustomFreeformUI({ requestId, prompt }) {
  const sendInput = useSendInput()

  const handleSubmit = (text: string) => {
    sendInput({ type: "freeform", requestId, text })
  }

  return (
    <FreeformPrompt
      prompt={prompt}
      onSubmit={handleSubmit}
      placeholder="Type your response..."
    />
  )
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt text |
| `agentName` | `string` | - | Requesting agent name |
| `onSubmit` | `(value: string) => void` | Required | Submit callback |
| `placeholder` | `string` | `"Type your response..."` | Input placeholder |
| `loading` | `boolean` | `false` | Loading state |
| `rows` | `number` | `3` | Textarea rows |
| `submitText` | `string` | `"Submit"` | Submit button text |

---

## Customization

### Tailwind Overrides

All components accept a `className` prop for Tailwind overrides:

```tsx
<ConnectionStatus className="text-lg font-bold" />
<EventStream className="bg-gray-100 rounded-xl p-4" />
```

### Dark Mode

Components automatically support dark mode via Tailwind's `dark:` classes. Ensure your app uses Tailwind's dark mode configuration:

```tsx
// Toggle dark mode by adding "dark" class to a parent element
<div className={isDark ? "dark" : ""}>
  <YourApp />
</div>
```

### Utility Function

The `cn` utility is exported for custom className merging:

```tsx
import { cn } from "@open-scaffold/ui"

function MyComponent({ className }) {
  return (
    <div className={cn("base-classes", className)}>
      ...
    </div>
  )
}
```

---

## Complete Example

Here's a full workflow UI combining multiple components:

```tsx
import { WorkflowProvider, useCreateSession } from "@open-scaffold/client"
import {
  ConnectionStatus,
  EventStream,
  StateViewer,
  VCRToolbar,
  InputArea,
  InteractionModal
} from "@open-scaffold/ui"

function WorkflowApp() {
  return (
    <WorkflowProvider url="http://localhost:3001">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="border-b p-4 flex justify-between items-center">
          <h1 className="font-bold">My Workflow</h1>
          <ConnectionStatus showIcon />
        </header>

        {/* Main content */}
        <main className="grid grid-cols-1 md:grid-cols-[60%_40%] gap-4 p-4">
          <EventStream maxHeight="500px" />
          <StateViewer maxAutoExpandDepth={2} />
        </main>

        {/* Footer */}
        <footer className="border-t p-4 space-y-4">
          <InputArea placeholder="Send a message..." />
          <VCRToolbar showSessionId />
        </footer>

        {/* Modal for HITL interactions */}
        <InteractionModal />
      </div>
    </WorkflowProvider>
  )
}
```
