# Feature Specification: Effect Refactor

**Feature Branch**: `001-effect-refactor`
**Created**: 2026-01-21
**Status**: Draft
**Input**: User description: "effect refactor"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Debugs Agent with Time-Travel (Priority: P1)

A developer's AI agent workflow fails at 3am. They load the recorded session and step backwards through execution to find exactly which event caused the failure. They jump to any point in history, inspect state, and identify the bug without re-running anything.

**Why this priority**: Time-travel debugging is THE killer feature. The ability to rewind and step backwards through execution—not just forward—is what makes Open Harness fundamentally better than console.log debugging. This is non-negotiable.

**Independent Test**: Can be fully tested by recording a session, loading it as a Tape, stepping backward with `stepBack()`, and verifying state at any historical position.

**Acceptance Scenarios**:

1. **Given** a recorded workflow session, **When** a developer loads it and calls `tape.stepBack()` multiple times, **Then** state correctly reverts to previous positions
2. **Given** a Tape at position 15, **When** the developer calls `tape.stepTo(5)`, **Then** state is recomputed to exactly what it was after event 5
3. **Given** a buggy session, **When** the developer steps through events examining `tape.current` and `tape.state`, **Then** they can identify which event caused the state corruption
4. **Given** any Tape position, **When** the developer accesses `tape.position`, `tape.current`, `tape.events`, **Then** all values are consistent and accurate

---

### User Story 2 - Developer Defines Event-Driven Workflow (Priority: P2)

A developer creates an AI agent workflow by defining typed events, pure handlers, and agents. Events flow through the system: each event triggers handlers that update state and emit new events. The developer defines when the workflow terminates.

**Why this priority**: The event loop is the core architecture. Everything else depends on events flowing correctly through handlers and agents. Without this working, nothing else matters.

**Independent Test**: Can be tested by defining events, handlers, and agents, running a workflow, and verifying events flow correctly with state updates.

**Acceptance Scenarios**:

1. **Given** an event is emitted, **When** the event loop processes it, **Then** the matching handler receives it and returns new state plus new events
2. **Given** a handler returns new events, **When** those events are processed, **Then** they trigger their own handlers in sequence
3. **Given** an agent's `activatesOn` matches an event, **When** that event occurs, **Then** the agent's prompt runs and it emits its declared events
4. **Given** a workflow has an `until` condition, **When** that condition becomes true, **Then** the workflow terminates cleanly

---

### User Story 3 - Developer Records and Replays Sessions (Priority: P3)

A developer runs a workflow with recording enabled. The session is persisted to storage. Later, they replay it without making any LLM API calls—events come from the recording. Tests use recorded sessions for deterministic, cost-free validation.

**Why this priority**: Recording and replay is what enables testing without burning API credits. The Store persists events; the Tape provides playback. Same handlers, same state transitions, no external calls.

**Independent Test**: Can be tested by recording a live session, loading it, calling `tape.play()`, and verifying no network calls are made while state transitions match the original.

**Acceptance Scenarios**:

1. **Given** a workflow runs with `record: true`, **When** execution completes, **Then** all events are persisted to the Store with the session ID
2. **Given** a recorded session exists, **When** `workflow.load(sessionId)` is called, **Then** a Tape is returned with all recorded events
3. **Given** a Tape is played, **When** playback occurs, **Then** no LLM API calls are made (events come from the recording)
4. **Given** the same session is replayed 100 times, **When** playback reaches the same position each time, **Then** state is byte-for-byte identical

---

### User Story 4 - Developer Renders Events to Multiple Outputs (Priority: P4)

A developer creates custom renderers that transform events into output. Different renderers target different contexts: terminal, web UI, logs. Renderers observe events but cannot modify state or emit new events.

**Why this priority**: Renderers enable the same workflow to work in CLI, web, and headless modes. They're pure observers—this separation keeps the event stream clean.

**Independent Test**: Can be tested by creating renderers for different outputs and verifying they receive events without affecting the event stream or state.

**Acceptance Scenarios**:

1. **Given** a renderer is registered, **When** events flow through the system, **Then** the renderer receives each event for transformation
2. **Given** a renderer returns output, **When** that output is produced, **Then** no new events are emitted and state is unchanged
3. **Given** multiple renderers are registered, **When** an event occurs, **Then** all renderers receive it independently
4. **Given** a renderer uses pattern matching (e.g., `error:*`), **When** matching events occur, **Then** only those events trigger that renderer

---

### User Story 5 - Library Consumer Uses Clean API (Priority: P5)

A developer building an AI agent application imports Open Harness and uses the workflow API without any knowledge of Effect. They create workflows, define handlers, and run agents using familiar async/await patterns and simple function signatures.

**Why this priority**: Clean DX is essential for adoption. Effect powers the internals; consumers see Promises and plain types. This abstraction must be airtight.

**Independent Test**: Can be tested by creating a complete workflow using only public API types and verifying zero Effect types leak to consumer code.

**Acceptance Scenarios**:

1. **Given** a developer imports from `@open-harness/core`, **When** they inspect available types, **Then** no Effect types are exposed
2. **Given** a developer calls `workflow.run()`, **When** execution completes, **Then** they receive a standard Promise with plain result objects
3. **Given** an error occurs, **When** it propagates to the caller, **Then** it's a standard Error object, not an Effect failure type

---

### User Story 6 - React Developer Uses useWorkflow Hook (Priority: P6)

A frontend developer builds a chat UI using the `useWorkflow` React hook. The API feels familiar—like Vercel AI SDK—with messages, input state, and loading indicators. Tape controls enable time-travel debugging in the UI.

**Why this priority**: React integration extends the clean DX to the frontend. The hook provides both AI SDK compatibility (messages) and our unique value (events, state, tape).

**Independent Test**: Can be tested by building a React component with useWorkflow and verifying all values work without Effect knowledge.

**Acceptance Scenarios**:

1. **Given** a React component uses `useWorkflow()`, **When** the hook returns, **Then** it provides `messages`, `input`, `setInput`, `handleSubmit`, `isLoading`, `error`
2. **Given** the workflow emits `text:delta` events, **When** the component renders, **Then** `messages` contains accumulated text (message projection)
3. **Given** tape controls are accessed, **When** `tape.stepBack()` is called, **Then** state and messages update to reflect the previous position
4. **Given** a `WorkflowProvider` wraps the app, **When** nested components call `useWorkflow()`, **Then** they share the same workflow context

---

### Edge Cases

- What happens when `tape.stepBack()` is called at position 0? The system MUST remain at position 0 with initial state.
- What happens when stepping forward past the last event? The system MUST stay at the final position.
- What happens when a handler throws an exception? The system MUST emit an `error:occurred` event and continue (not crash).
- What happens when replay mode encounters an unknown event type? The system MUST skip it gracefully with a warning.
- What happens when the Store is unavailable during recording? The system MUST fail fast with a clear error (not lose events silently).
- How does the system handle streaming text that arrives after an error? Events already emitted MUST be preserved in the log.

## Requirements *(mandatory)*

### Functional Requirements

**Core Event Loop**

- **FR-001**: System MUST implement the event loop: Event → Handler → (State + Events) → Next Event
- **FR-002**: System MUST route each event to its registered handler based on event name
- **FR-003**: System MUST process emitted events sequentially (one event fully processed before the next)
- **FR-004**: System MUST send events to all registered renderers in parallel with handler processing

**Events**

- **FR-005**: Events MUST be immutable after creation
- **FR-006**: Events MUST contain: `id` (unique), `name`, `payload`, `timestamp`
- **FR-007**: Events SHOULD contain `causedBy` to track which event triggered this one
- **FR-008**: Event names MUST follow convention: past tense for facts (`task:completed`), present tense for streaming (`text:delta`)

**Handlers**

- **FR-009**: Handlers MUST be pure functions: `(event, state) → { state, events[] }`
- **FR-010**: Handlers MUST NOT perform I/O, call APIs, or access anything outside their inputs
- **FR-011**: Handlers MUST be deterministic—same inputs always produce same outputs

**Agents**

- **FR-012**: Agents MUST declare `activatesOn` (event names that trigger the agent)
- **FR-013**: Agents MUST declare `emits` (event types the agent can produce)
- **FR-014**: Agents MUST provide a `prompt(state, event)` function that returns the LLM prompt
- **FR-015**: Agents MAY provide a `when(state)` guard condition that must be true for activation
- **FR-016**: Agents MUST provide an `outputSchema` for structured output extraction (mandatory for workflow state reliability)
- **FR-017**: Agents MAY provide an `onOutput(output, event)` function to transform LLM output into events

**Structured Output (Critical)**

Structured output is MANDATORY for all agent executions. This ensures:
1. Workflow state updates are predictable and type-safe
2. Handler logic can rely on known output shapes
3. Replay produces identical results

How it works:
- Agent defines `outputSchema` using Zod (e.g., `z.object({ tasks: z.array(z.string()) })`)
- When agent runs, the runtime converts to JSON Schema and passes to the Claude SDK as `outputFormat: { type: "json_schema", schema }`
- The SDK guarantees the LLM response matches the schema
- The parsed, validated output is passed to `onOutput(output, event)` to produce events
- If no `onOutput` is provided, the output is wrapped in a default event type

Example:
```typescript
import { z } from "zod";

const planner = agent({
  name: "planner",
  activatesOn: ["workflow:start"],
  emits: ["plan:created"],

  // REQUIRED: Define what the LLM must output (using Zod)
  outputSchema: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
    })),
  }),

  prompt: (state) => `Create a plan for: ${state.goal}`,

  // Transform structured output to events (returns array)
  onOutput: (output, event) => [{
    name: "plan:created",
    payload: { tasks: output.tasks },
    causedBy: event.id,
  }],
});
```

**Renderers**

- **FR-018**: Renderers MUST be pure observers—they cannot modify events or state
- **FR-019**: Renderers MUST NOT emit new events
- **FR-020**: Renderers MUST support pattern matching for event names (e.g., `error:*` matches all error events)
- **FR-021**: Renderers MUST receive events as they flow, enabling real-time output

**Store**

- **FR-022**: Store MUST provide `append(sessionId, event)` to persist events
- **FR-023**: Store MUST provide `events(sessionId)` to retrieve all events for a session
- **FR-024**: Store MUST provide `sessions()` to list all recorded sessions
- **FR-025**: Store MUST provide `clear(sessionId)` to delete a session's events
- **FR-026**: Store SHOULD provide `snapshot(sessionId, index)` to derive state at any position

**Tape (Time-Travel)**

- **FR-027**: System MUST provide `workflow.load(sessionId)` that returns a Tape
- **FR-028**: Tape MUST provide `rewind()` to return to position 0 (initial state)
- **FR-029**: Tape MUST provide `step()` to advance one event forward
- **FR-030**: Tape MUST provide `stepBack()` to go one event backward (THE key feature)
- **FR-031**: Tape MUST provide `stepTo(n)` to jump to any position
- **FR-032**: Tape MUST provide `play()` to play from current position to end
- **FR-033**: Tape MUST provide `playTo(n)` to play from current position to position n
- **FR-034**: Tape MUST provide `pause()` to stop playback
- **FR-035**: Tape MUST expose `position` (current index), `current` (current event), `events` (all events)
- **FR-036**: Tape MUST expose `state` (computed state at current position)
- **FR-037**: Tape MUST expose `isRecording` and `isReplaying` status flags
- **FR-038**: Tape MUST recompute state by replaying handlers from position 0 to current position

**Workflow**

- **FR-039**: System MUST provide `createWorkflow({ state, handlers, agents, until, store })` factory
- **FR-040**: Workflow MUST accept an `until(state)` function that returns true when workflow should terminate
- **FR-041**: Workflow MUST provide `workflow.run({ input, record?, sessionId?, renderers? })`
- **FR-042**: When `record: true`, workflow MUST persist all events to the Store

**Developer Experience APIs**

- **FR-043**: System MUST provide `defineEvent(name, zodSchema)` for type-safe event definitions using Zod
- **FR-044**: System MUST provide `defineHandler(eventDef, handlerFn)` for type-safe handlers
- **FR-045**: System MUST provide `agent({ name, activatesOn, emits, prompt, outputSchema, when?, onOutput? })` where `outputSchema` is required
- **FR-046**: System MUST provide `createRenderer({ name, renderers: { [pattern]: renderFn } })`

**Claude Agent SDK Integration**

- **FR-065**: Provider MUST pass through actual SDK options: `resume`, `model`, `maxTurns`, `persistSession`, `includePartialMessages`, `outputFormat`
- **FR-066**: Provider MUST NOT expose invalid SDK options (e.g., `temperature`, `maxTokens`, `system` do not exist in Claude Agent SDK)
- **FR-067**: Provider MUST always use `outputFormat: { type: "json_schema", schema }` with the agent's `outputSchema`
- **FR-068**: Provider MUST support abort via `abortController` for cancellation

**Message Projection (React Integration)**

- **FR-047**: System MUST project `user:input` events to `{ role: 'user', content }` messages
- **FR-048**: System MUST accumulate `text:delta` events into the current assistant message
- **FR-049**: System MUST finalize assistant messages on `text:complete` events
- **FR-050**: System MUST map `tool:called` events to `message.toolInvocations[]`
- **FR-051**: System MUST update `toolInvocations[].result` on `tool:result` events
- **FR-052**: System MUST start new assistant messages with agent `name` on `agent:started` events
- **FR-053**: Messages MUST include `_events` array linking back to source events

**React Hook**

- **FR-054**: `useWorkflow` MUST return AI SDK compatible values: `messages`, `input`, `setInput`, `handleSubmit`, `isLoading`, `error`
- **FR-055**: `useWorkflow` MUST return our unique values: `events`, `state`
- **FR-056**: `useWorkflow` MUST return `tape` object with all Tape controls
- **FR-057**: System MUST provide `WorkflowProvider` for React context
- **FR-058**: System MUST provide `WorkflowChat` component for zero-config chat UI

**Server Integration**

- **FR-059**: System MUST provide `createWorkflowHandler(workflow)` for server-side execution
- **FR-060**: Client MUST be able to connect via `useWorkflow(workflow, { api: '/api/workflow' })`

**Effect Internal Architecture**

- **FR-061**: System MUST use Effect for all internal async operations
- **FR-062**: System MUST expose zero Effect types in the public API
- **FR-063**: System MUST convert Effect failures to standard Error objects at public boundaries
- **FR-064**: System MUST provide resource safety—acquired resources released on success, failure, or interruption

### Key Entities

- **Event**: An immutable fact containing `id`, `name`, `payload`, `timestamp`, and optional `causedBy`
- **State**: The workflow's data as a plain object, computed by applying handlers to the event log
- **Handler**: A pure function `(event, state) → { state, events[] }` that reacts to events
- **Agent**: An AI actor with `name`, `activatesOn`, `emits`, `prompt`, `outputSchema` (required), and optional `when`, `onOutput`
- **Renderer**: A pure observer with pattern-matched render functions that transform events to output
- **Store**: Persistence interface with `append`, `events`, `sessions`, `clear`, and optional `snapshot`
- **Tape**: A recorded session with VCR controls (`rewind`, `step`, `stepBack`, `stepTo`, `play`, `playTo`, `pause`) and inspection (`position`, `current`, `events`, `state`, `isRecording`, `isReplaying`)
- **Workflow**: The top-level container combining `state`, `handlers`, `agents`, `until`, and `store`
- **Message**: AI SDK-compatible chat message projected from events, with `id`, `role`, `content`, `name`, `toolInvocations`, `_events`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can step backward through any recorded session using `tape.stepBack()` and see correct historical state
- **SC-002**: Zero Effect types appear in public API TypeScript exports (verified by API documentation audit)
- **SC-003**: 100% of internal async operations use Effect (no raw Promises in internal code)
- **SC-004**: Workflow replay produces identical state at each position across 100 consecutive runs
- **SC-005**: All 7 key entities (Event, State, Handler, Agent, Renderer, Store, Tape) have corresponding public types
- **SC-006**: React developers can build a complete chat UI using only public types (verified by example app)
- **SC-007**: Recorded sessions can be loaded and debugged days after original execution
- **SC-008**: Message projection correctly accumulates streaming text from `text:delta` events

## Assumptions

- Effect TypeScript library (latest stable version) is suitable for the concurrency and error handling requirements
- SQLite is acceptable as the default storage backend for events
- The existing codebase's "signals" will be renamed to "events" as part of this refactor
- Claude Code subscription authentication continues to be the auth mechanism (no changes to auth)
- The React integration follows similar patterns to Vercel AI SDK
- State can be derived by replaying all handlers from position 0 (no separate state snapshots required initially)
- Sessions are identified by string IDs provided by the caller

## Clarifications

### Session 2026-01-21

- Q: Should provider contracts include `temperature`, `maxTokens`, `system` parameters? → A: No, remove invalid params; use actual SDK options only (`resume`, `model`, `maxTurns`, `persistSession`, `includePartialMessages`, `outputFormat`)
- Q: Is `outputSchema` optional or mandatory for agents? → A: MANDATORY - every agent must have structured output to ensure reliable workflow state
- Q: Should we use Zod or @effect/schema for event/output schemas? → A: Zod for public API (familiar DX), Effect stays internal only
- Q: Should Effect Layer architecture be explicitly documented? → A: Yes, add explicit section to plan.md with Services, Layer dependency graph, and ManagedRuntime composition
