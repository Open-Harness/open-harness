# PRD: Effect Workflow System (core-v2)

## Overview

Build a **greenfield package** (`packages/core-v2`) implementing an event-sourced workflow system with Effect-TS. This is a complete standalone package, NOT a refactor of existing code.

**Key Features:**
1. **Time-travel debugging** via Tape.stepBack() - THE killer feature
2. **Effect-TS internals** hidden behind clean Promise-based public API
3. **Event sourcing** - state derived by replaying pure handlers over event log
4. **Recording & replay** - sessions persist to Store, replay without API calls

**Reference Documents:**
- Spec: `specs/001-effect-refactor/spec.md`
- Plan: `specs/001-effect-refactor/plan.md`
- Contracts: `specs/001-effect-refactor/contracts/`
- Data Model: `specs/001-effect-refactor/data-model.md`

---

## Phase 1: Setup

- [x] Create packages/core-v2/ directory with subdirectories: src/event, src/handler, src/agent, src/workflow, src/tape, src/store, src/renderer, src/provider, src/message, src/internal, and tests/integration per specs/001-effect-refactor/plan.md
- [x] Create packages/core-v2/package.json with name "@open-harness/core-v2" and dependencies: effect, @effect/schema, @effect/platform, @anthropic-ai/claude-agent-sdk, zod, zod-to-json-schema, and devDependencies: @effect/vitest, typescript. Run bun install.
- [x] Create packages/core-v2/tsconfig.json with strict:true, target:ES2022, module:NodeNext for Effect-compatible TypeScript configuration
- [x] Create packages/core-v2/vitest.config.ts configured with @effect/vitest plugin for Effect-native testing
- [x] Create packages/core-v2/src/index.ts as public API entry point with comment "Public API - NO Effect types here" (placeholder exports for now)
- [x] Create packages/core-v2/src/react.ts as React subpath export stub with placeholder for useWorkflow hook and WorkflowProvider
- [x] Create packages/core-v2/src/internal/boundary.ts with Effect→Promise utilities: ManagedRuntime wrapper, Exit.match for results, Cause.pretty for error messages
- [x] Create packages/core-v2/src/internal/schema.ts with zodToJsonSchema utility function using zod-to-json-schema library for converting Zod schemas to JSON Schema

---

## Phase 2: Foundational (BLOCKS all user stories)

### Event Primitives

- [x] Create packages/core-v2/src/event/Event.ts with: EventId branded string type, Event interface (id, name, payload, timestamp, causedBy?), EventSchema using @effect/schema, createEvent factory function per specs/001-effect-refactor/contracts/event.ts
- [x] Create packages/core-v2/src/event/index.ts re-exporting Event, EventId, createEvent (NO @effect/schema internals)
- [x] Add UserInputEvent schema to src/event/Event.ts with content payload for user input events
- [x] Add TextDeltaEvent schema to src/event/Event.ts with delta payload for streaming text
- [x] Add TextCompleteEvent schema to src/event/Event.ts with text payload for finalized text
- [x] Add AgentStartedEvent schema to src/event/Event.ts with agentName payload
- [x] Add AgentCompletedEvent schema to src/event/Event.ts with agentName and output payload
- [x] Add ToolCalledEvent schema to src/event/Event.ts with toolName and args payload
- [x] Add ToolResultEvent schema to src/event/Event.ts with toolName and result payload
- [x] Add ErrorOccurredEvent schema to src/event/Event.ts with error and context payload
- [x] Create packages/core-v2/src/event/EventLog.ts with append-only event log using Effect Ref for internal use

### Handler System

- [x] Create packages/core-v2/src/handler/Handler.ts with Handler type: (event, state) => { state, events[] }, HandlerResult interface, HandlerDefinition interface per specs/001-effect-refactor/contracts/handler.ts
- [x] Create packages/core-v2/src/handler/index.ts re-exporting Handler, HandlerResult, HandlerDefinition

### Agent System

- [x] Create packages/core-v2/src/agent/Agent.ts with Agent interface: name, activatesOn, emits, prompt(state,event), outputSchema (REQUIRED), when?, onOutput? per specs/001-effect-refactor/contracts/agent.ts
- [x] Create packages/core-v2/src/agent/index.ts re-exporting Agent, AgentOptions

### Effect Service Tags

- [x] Create packages/core-v2/src/store/Store.ts with Store Context.Tag("@core-v2/Store") and StoreService interface: append, events, sessions, clear, snapshot? per specs/001-effect-refactor/contracts/store.ts
- [x] Create packages/core-v2/src/provider/Provider.ts with LLMProvider Context.Tag("@core-v2/LLMProvider") and LLMProviderService interface with query, stream methods
- [x] Create packages/core-v2/src/event/EventBus.ts with EventBus Context.Tag("@core-v2/EventBus") and EventBusService interface: emit, subscribe, unsubscribe
- [x] Create packages/core-v2/src/handler/HandlerRegistry.ts with HandlerRegistry Context.Tag("@core-v2/HandlerRegistry") and HandlerRegistryService interface: register, get, has
- [x] Create packages/core-v2/src/agent/AgentService.ts with AgentRegistry Context.Tag("@core-v2/AgentRegistry") and AgentRegistryService interface: register, get, findMatching

---

## Phase 3: User Story 1 - Time-Travel Debugging (THE killer feature)

- [x] Create packages/core-v2/src/tape/Tape.ts with Tape interface: position, length, current, state, events, and TapeStatus type ("idle"|"playing"|"paused"|"recording") per specs/001-effect-refactor/contracts/tape.ts
- [x] Implement rewind() method in src/tape/Tape.ts that returns to position 0 with initial state per spec FR-028
- [x] Implement step() method in src/tape/Tape.ts that advances one event forward, clamping at end per spec FR-029
- [x] Implement stepBack() method in src/tape/Tape.ts - THE KEY FEATURE - goes backward one event, clamps at 0, recomputes state to previous position per spec FR-030
- [x] Implement stepTo(n) method in src/tape/Tape.ts that jumps to any position with clamping [0, length-1] per spec FR-031
- [x] Implement stateAt(n) method in src/tape/Tape.ts that computes state at position n WITHOUT changing current position
- [x] Implement computeState(events, handlers, initialState, toPosition) utility in src/tape/Tape.ts that replays handlers from position 0 to derive state at any position per spec FR-038
- [x] Add isRecording and isReplaying computed flags to Tape based on status per spec FR-037
- [x] Create packages/core-v2/src/tape/TapeControls.ts with TapeControls subset interface for React (control methods only) per specs/001-effect-refactor/contracts/tape.ts
- [x] Create packages/core-v2/src/tape/index.ts re-exporting Tape, TapeControls, TapeStatus
- [x] Create packages/core-v2/tests/tape.test.ts with tests for: stepBack at position 0 stays at 0, step past end stays at end, stepTo clamps correctly, state recomputation is deterministic

---

## Phase 4: User Story 2 - Event-Driven Workflow

### WorkflowRuntime (Event Loop)

- [x] Create packages/core-v2/src/workflow/WorkflowRuntime.ts with WorkflowRuntime Context.Tag("@core-v2/WorkflowRuntime") and WorkflowRuntimeService interface
- [x] Implement event loop in WorkflowRuntime: dequeue event → find handler → execute handler(event, state) → get new state + emitted events → queue emitted events → repeat per spec FR-001
- [x] Implement event routing in WorkflowRuntime that matches event.name to registered handler via HandlerRegistry per spec FR-002
- [x] Implement sequential event processing in WorkflowRuntime - one event fully processed before next using Effect.forEach with concurrency:1 per spec FR-003
- [x] Implement agent activation in WorkflowRuntime: after handler, check AgentRegistry.findMatching(event.name), check agent.when(state) guard if present, execute agent via LLMProvider per spec FR-012/FR-015
- [x] Implement termination condition in WorkflowRuntime: after each event, call until(state), stop if true per spec FR-040

### Workflow Definition & Factory

- [x] Create packages/core-v2/src/workflow/Workflow.ts with WorkflowDefinition interface: state, handlers, agents, until, store per specs/001-effect-refactor/contracts/workflow.ts
- [x] Implement createWorkflow(definition) factory function in src/workflow/Workflow.ts that returns Workflow class instance per spec FR-039
- [x] Implement Workflow.run(options: RunOptions) method that executes event loop via Effect internally, returns Promise<WorkflowResult> per spec FR-041

### Layer Implementations

- [x] Implement EventBusLive Layer in src/event/EventBus.ts using Effect.Ref for subscriber storage with emit, subscribe, unsubscribe methods
- [x] Implement HandlerRegistryLive Layer in src/handler/HandlerRegistry.ts using Map for handler storage with register, get, has methods
- [x] Implement AgentRegistryLive Layer in src/agent/AgentService.ts using Map for agent storage with register, get, findMatching methods
- [x] Implement WorkflowRuntimeLive Layer in src/workflow/WorkflowRuntime.ts that depends on LLMProvider, Store, EventBus, HandlerRegistry, AgentRegistry via Effect.gen
- [x] Implement ManagedRuntime composition in Workflow class constructor: compose all Layers, create ManagedRuntime, use runtime.runPromise for public methods per specs/001-effect-refactor/plan.md

### Developer Experience APIs

- [x] Implement defineEvent(name, zodSchema) factory in src/event/Event.ts that returns EventDefinition with type-safe create() and is() methods per spec FR-043
- [x] Implement defineHandler(eventDef, handlerFn) factory in src/handler/Handler.ts that accepts EventDefinition and handler function, returns HandlerDefinition per spec FR-044
- [x] Implement agent({name, activatesOn, emits, prompt, outputSchema, when?, onOutput?}) factory in src/agent/Agent.ts with REQUIRED outputSchema (throw clear error if missing) per spec FR-045
- [x] Create packages/core-v2/src/workflow/index.ts re-exporting Workflow, WorkflowDefinition, createWorkflow, WorkflowResult, RunOptions
- [x] Create packages/core-v2/tests/workflow.test.ts with tests for: event routing, sequential processing, agent activation, termination condition

---

## Phase 5: User Story 3 - Recording & Replay

### Store Implementations

- [x] Create packages/core-v2/src/store/MemoryStore.ts with MemoryStoreLive Layer using Map<sessionId, Event[]> for in-memory storage
- [x] Create packages/core-v2/src/store/SqliteStore.ts with SqliteStoreLive Layer using better-sqlite3 or @effect/sql for persistent storage
- [ ] Implement Store.append(sessionId, event) in both MemoryStore and SqliteStore that appends event to session's event list, creates session if not exists per spec FR-022
- [ ] Implement Store.events(sessionId) in both stores that retrieves all events in order, returns empty array if session not found per spec FR-023
- [ ] Implement Store.sessions() in both stores that returns session metadata (id, eventCount, timestamps) per spec FR-024
- [ ] Implement Store.clear(sessionId) in both stores that removes session and all its events per spec FR-025

### Recording Integration

- [ ] Add record:boolean and sessionId?:string options to RunOptions in Workflow.run()
- [ ] Implement recording logic in WorkflowRuntime: when record:true, call Store.append(sessionId, event) for each event per spec FR-042
- [ ] Implement automatic sessionId generation (UUID v4) when record:true and no sessionId provided, return sessionId in WorkflowResult

### Replay via Tape

- [ ] Implement Workflow.load(sessionId) method that fetches events from Store, creates Tape with events and handlers, returns Tape instance per spec FR-027
- [ ] Implement play() method in Tape that plays from current position to end with configurable delay, sets status to "playing" per spec FR-032
- [ ] Implement playTo(n) method in Tape that plays from current position to position n, stops at n per spec FR-033
- [ ] Implement pause() method in Tape that stops playback, sets status to "paused" per spec FR-034
- [ ] Ensure replay mode does NOT call LLMProvider - events come from recording only, agents don't execute (their events are already recorded)
- [ ] Create packages/core-v2/src/store/index.ts re-exporting Store, MemoryStore, SqliteStore, createMemoryStore, createSqliteStore
- [ ] Create packages/core-v2/tests/store.test.ts with tests for: append, events, sessions, clear, and Store unavailable fails fast

---

## Phase 6: User Story 4 - Event Rendering

- [ ] Create packages/core-v2/src/renderer/Renderer.ts with Renderer interface: name, patterns, render per specs/001-effect-refactor/contracts/renderer.ts ensuring renderers CANNOT modify events or state per spec FR-018/FR-019
- [ ] Implement pattern matching for event names in Renderer: exact match "text:delta", wildcard "error:*", "*:completed", catch-all "*" per spec FR-020
- [ ] Implement createRenderer({name, renderers: {[pattern]: renderFn}}) factory function in src/renderer/Renderer.ts per spec FR-046
- [ ] Integrate renderers into WorkflowRuntime: send events to all registered renderers in parallel with handler processing using Effect.fork per spec FR-004
- [ ] Ensure renderer.render returns void (no new events), events passed to renderers are readonly
- [ ] Create packages/core-v2/src/renderer/index.ts re-exporting Renderer, createRenderer, EventPattern
- [ ] Create packages/core-v2/tests/renderer.test.ts with tests for: pattern matching, parallel execution, pure observer enforcement

---

## Phase 7: User Story 5 - Clean Public API

- [ ] Audit packages/core-v2/src/index.ts exports to ensure NO Effect types (Context, Effect, Layer, Stream, Exit, Cause, Fiber) are exposed per spec FR-062
- [ ] Implement Error conversion in src/internal/boundary.ts: convert Effect Cause to standard Error using Cause.pretty for error messages per spec FR-063
- [ ] Verify all public methods return Promise<T>, not Effect<T> - use ManagedRuntime.runPromise internally
- [ ] Add JSDoc documentation to all public types in src/index.ts with @example where helpful
- [ ] Ensure defineEvent() returns consumer-friendly EventDefinition type (no @effect/schema internals)
- [ ] Ensure defineHandler() accepts plain (event, state) => result function, returns HandlerDefinition
- [ ] Ensure agent() factory validates outputSchema is present and throws clear error: "outputSchema is required for all agents - it ensures reliable workflow state"
- [ ] Implement Workflow.dispose() method that calls ManagedRuntime.dispose() for resource cleanup per spec FR-064
- [ ] Add WorkflowCallbacks (onEvent, onStateChange, onError) to RunOptions in Workflow.run()

---

## Phase 8: User Story 6 - React Integration

### Message Projection

- [ ] Create packages/core-v2/src/message/Message.ts with Message interface: id, role, content, name?, toolInvocations?, _events per specs/001-effect-refactor/contracts/message.ts
- [ ] Create packages/core-v2/src/message/projection.ts with projectEventsToMessages(events) function
- [ ] Implement user:input event → { role: "user", content } message projection per spec FR-047
- [ ] Implement text:delta event accumulation into current assistant message content per spec FR-048
- [ ] Implement text:complete event finalization of assistant message per spec FR-049
- [ ] Implement agent:started event → new Message with role:"assistant" and name from agent per spec FR-052
- [ ] Implement tool:called event → add to message.toolInvocations[] with state:"pending" per spec FR-050
- [ ] Implement tool:result event → update matching toolInvocation.result and state per spec FR-051
- [ ] Ensure all messages include _events array with source event IDs for traceability per spec FR-053
- [ ] Create packages/core-v2/src/message/index.ts re-exporting Message, projectEventsToMessages

### useWorkflow Hook

- [ ] Implement useWorkflow hook in src/react.ts with AI SDK compatible return: messages, input, setInput, handleSubmit, isLoading, error per spec FR-054
- [ ] Add Open Harness unique values to useWorkflow return: events, state per spec FR-055
- [ ] Add tape object to useWorkflow return with all Tape controls that update React state when used per spec FR-056
- [ ] Implement useEffect cleanup in useWorkflow that calls workflow.dispose() on unmount
- [ ] Implement WorkflowProvider component in src/react.ts using React.createContext for shared workflow context per spec FR-057
- [ ] Implement WorkflowChat convenience component in src/react.ts with messages list, input field, and submit button per spec FR-058
- [ ] Create packages/core-v2/tests/react.test.ts with tests for: AI SDK compatible values, tape controls, cleanup on unmount

---

## Phase 9: LLM Provider Integration

- [ ] Create packages/core-v2/src/provider/ClaudeProvider.ts with ClaudeProviderLive Layer using @anthropic-ai/claude-agent-sdk
- [ ] Implement Stream.fromAsyncIterable in ClaudeProvider to convert SDK async iterator to Effect Stream for streaming responses
- [ ] Implement Effect.acquireRelease in ClaudeProvider for SDK connection cleanup on abort/error per spec FR-064
- [ ] Implement structured output conversion in ClaudeProvider: use src/internal/schema.ts to convert Zod outputSchema → JSON Schema → SDK outputFormat: {type:"json_schema", schema} per spec FR-067
- [ ] Map Claude SDK messages to internal Event types in ClaudeProvider: text delta → TextDeltaEvent, tool call → ToolCalledEvent, complete → TextCompleteEvent
- [ ] Implement abort handling in ClaudeProvider via AbortController passthrough to SDK per spec FR-068
- [ ] Create packages/core-v2/src/provider/index.ts re-exporting ClaudeProviderLive, ClaudeProviderConfig

---

## Phase 10: Polish & Edge Cases

### Edge Case Handling

- [ ] Handle stepBack() at position 0: remain at position 0 with initial state, do not go negative per spec edge cases
- [ ] Handle step() past last event: stay at final position, do not exceed length-1 per spec edge cases
- [ ] Handle handler exceptions in WorkflowRuntime: catch exception, emit ErrorOccurredEvent with error details, continue processing per spec edge cases
- [ ] Handle unknown event type in replay: skip gracefully with warning log, continue to next event per spec edge cases
- [ ] Handle Store unavailable during recording: fail fast with clear error "Store unavailable - cannot record session", do not lose events silently per spec edge cases

### Server Integration

- [ ] Implement createWorkflowHandler(workflow) in src/workflow/Workflow.ts that returns HTTP handler function for server-side execution per spec FR-059
- [ ] Add api option to useWorkflow in src/react.ts for client-server connection per spec FR-060

### Final Validation

- [ ] Create packages/core-v2/tests/integration/quickstart.test.ts that runs examples from specs/001-effect-refactor/quickstart.md as integration tests
- [ ] Verify 100% Effect-free public API by creating consumer test file that imports from @core-v2 and compiles with tsc --noEmit without Effect
- [ ] Verify deterministic replay by recording a session, replaying 100 times, asserting state is identical at each position every time per spec SC-004

---

## Success Criteria

When complete, verify:
1. `tape.stepBack()` correctly reverts state to previous position
2. Zero Effect types in public API TypeScript exports
3. Replay produces identical state 100x in a row
4. React useWorkflow hook works without Effect knowledge
5. Recording persists events, replay loads without API calls
