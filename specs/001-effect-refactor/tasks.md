# Tasks: Effect Workflow System (core-v2)

**Input**: Design documents from `/specs/001-effect-refactor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested - test tasks omitted.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md, this is a standalone package:
- **Source**: `packages/core-v2/src/`
- **Tests**: `packages/core-v2/tests/`
- **Contracts (reference)**: `specs/001-effect-refactor/contracts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and package structure

- [ ] T001 Create `packages/core-v2/` directory structure per plan.md
- [ ] T002 Initialize package.json with dependencies: effect, @effect/schema, @effect/platform, @anthropic-ai/claude-agent-sdk, zod, zod-to-json-schema
- [ ] T003 [P] Configure tsconfig.json with strict mode and Effect-compatible settings
- [ ] T004 [P] Configure vitest.config.ts with @effect/vitest for Effect-native testing
- [ ] T005 [P] Create src/index.ts with public API exports (Effect-free)
- [ ] T006 [P] Create src/react.ts subpath export stub for React integration
- [ ] T007 [P] Create src/internal/boundary.ts with Effect→Promise utilities (ManagedRuntime, Exit.match, Cause.pretty)
- [ ] T008 [P] Create src/internal/schema.ts with Zod→JSON Schema conversion utility using zod-to-json-schema

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Effect Services and Event primitives that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Effect Service Infrastructure

- [ ] T009 Create src/event/Event.ts with EventId branded type and EventSchema using @effect/schema
- [ ] T010 Create src/event/index.ts with public exports
- [ ] T011 [P] Create src/handler/Handler.ts with Handler type, HandlerResult, HandlerDefinition per contracts/handler.ts
- [ ] T012 [P] Create src/handler/index.ts with public exports
- [ ] T013 Create src/agent/Agent.ts with Agent interface, AgentOptions per contracts/agent.ts
- [ ] T014 Create src/agent/index.ts with public exports

### Effect Service Tags (Context.Tag definitions)

- [ ] T015 Create src/store/Store.ts with Store Service Tag (@core-v2/Store) and StoreService interface per contracts/store.ts
- [ ] T016 [P] Create src/provider/Provider.ts with LLMProvider Service Tag (@core-v2/LLMProvider) and ProviderService interface
- [ ] T017 Create src/event/EventBus.ts with EventBus Service Tag (@core-v2/EventBus) for event emission/subscription
- [ ] T018 [P] Create src/handler/HandlerRegistry.ts with HandlerRegistry Service Tag (@core-v2/HandlerRegistry)
- [ ] T019 [P] Create src/agent/AgentService.ts with AgentRegistry Service Tag (@core-v2/AgentRegistry)

### Built-in Events (from contracts/event.ts)

- [ ] T020 Add UserInputEvent, TextDeltaEvent, TextCompleteEvent schemas to src/event/Event.ts
- [ ] T021 Add AgentStartedEvent, AgentCompletedEvent schemas to src/event/Event.ts
- [ ] T022 [P] Add ToolCalledEvent, ToolResultEvent schemas to src/event/Event.ts
- [ ] T023 [P] Add ErrorOccurredEvent schema to src/event/Event.ts

### Event Log (append-only event storage)

- [ ] T024 Create src/event/EventLog.ts with append-only event log using Effect (internal use)

**Checkpoint**: Foundation ready - Effect Services defined, Event primitives complete. User story implementation can now begin.

---

## Phase 3: User Story 1 - Time-Travel Debugging (Priority: P1) 🎯 MVP

**Goal**: Developer can load a recorded session and step backward/forward through execution history to debug

**Independent Test**: Load a session as Tape, call `stepBack()` multiple times, verify state at any historical position

### Tape Implementation (THE key feature)

- [ ] T025 [US1] Create src/tape/Tape.ts with Tape interface per contracts/tape.ts including position, length, current, state, events
- [ ] T026 [US1] Implement `rewind()` method in Tape - return to position 0 with initial state
- [ ] T027 [US1] Implement `step()` method in Tape - advance one event forward, clamp at end
- [ ] T028 [US1] Implement `stepBack()` method in Tape - THE KEY FEATURE - go backward one event, clamp at 0
- [ ] T029 [US1] Implement `stepTo(n)` method in Tape - jump to any position with clamping [0, length-1]
- [ ] T030 [US1] Implement `stateAt(n)` method in Tape - compute state at any position without changing current

### State Recomputation (core of time-travel)

- [ ] T031 [US1] Implement `computeState(events, handlers, initialState, toPosition)` utility in src/tape/Tape.ts - replay handlers to derive state
- [ ] T032 [US1] Add TapeStatus ("idle", "playing", "paused", "recording") to Tape implementation
- [ ] T033 [US1] Add isRecording/isReplaying flags to Tape based on status
- [ ] T034 [US1] Create src/tape/TapeControls.ts with TapeControls subset for React per contracts/tape.ts

### Tape Index

- [ ] T035 [US1] Create src/tape/index.ts with public exports (Tape, TapeControls, TapeStatus)

**Checkpoint**: User Story 1 complete - Time-travel debugging via Tape.stepBack() is functional

---

## Phase 4: User Story 2 - Event-Driven Workflow (Priority: P2)

**Goal**: Developer defines events, handlers, agents; events flow through system with state updates

**Independent Test**: Define events/handlers/agents, run workflow, verify events flow correctly with state updates

### Workflow Runtime (Event Loop)

- [ ] T036 [US2] Create src/workflow/WorkflowRuntime.ts with WorkflowRuntime Service Tag (@core-v2/WorkflowRuntime)
- [ ] T037 [US2] Implement event loop in WorkflowRuntime: Event → Handler → (State + Events) → Next Event
- [ ] T038 [US2] Implement event routing in WorkflowRuntime - match event.name to registered handler
- [ ] T039 [US2] Implement sequential event processing in WorkflowRuntime - one event fully processed before next
- [ ] T040 [US2] Implement agent activation in WorkflowRuntime - check activatesOn match and optional when() guard
- [ ] T041 [US2] Implement termination condition check in WorkflowRuntime - call until(state) after each event

### Workflow Definition & Factory

- [ ] T042 [US2] Create src/workflow/Workflow.ts with WorkflowDefinition interface per contracts/workflow.ts
- [ ] T043 [US2] Implement createWorkflow() factory function that creates Workflow from WorkflowDefinition
- [ ] T044 [US2] Implement Workflow.run() method that executes event loop via Effect internally, returns Promise<WorkflowResult>

### Layer Composition (Effect internals)

- [ ] T045 [US2] Create EventBusLive Layer implementation in src/event/EventBus.ts
- [ ] T046 [US2] Create HandlerRegistryLive Layer implementation in src/handler/HandlerRegistry.ts
- [ ] T047 [US2] Create AgentRegistryLive Layer implementation in src/agent/AgentService.ts
- [ ] T048 [US2] Implement WorkflowRuntimeLive Layer that depends on LLMProvider, Store, EventBus, HandlerRegistry, AgentRegistry
- [ ] T049 [US2] Implement ManagedRuntime composition in Workflow class to hide Effect from public API

### Developer Experience APIs (from spec FR-043 to FR-046)

- [ ] T050 [P] [US2] Implement defineEvent(name, zodSchema) factory in src/event/Event.ts
- [ ] T051 [P] [US2] Implement defineHandler(eventDef, handlerFn) factory in src/handler/Handler.ts
- [ ] T052 [P] [US2] Implement agent() factory in src/agent/Agent.ts with required outputSchema and onOutput

### Workflow Index

- [ ] T053 [US2] Create src/workflow/index.ts with public exports (Workflow, WorkflowDefinition, createWorkflow, etc.)

**Checkpoint**: User Story 2 complete - Event-driven workflow with handlers and agents is functional

---

## Phase 5: User Story 3 - Recording & Replay (Priority: P3)

**Goal**: Record sessions to storage, replay without LLM calls, deterministic test fixtures

**Independent Test**: Record live session, load it, call tape.play(), verify no network calls while state matches original

### Store Implementations

- [ ] T054 [US3] Create src/store/MemoryStore.ts with MemoryStoreLive Layer - in-memory Map storage
- [ ] T055 [US3] Create src/store/SqliteStore.ts with SqliteStoreLive Layer - SQLite persistence via better-sqlite3 or Effect SQL
- [ ] T056 [US3] Implement Store.append(sessionId, event) in both stores
- [ ] T057 [US3] Implement Store.events(sessionId) in both stores - retrieve all events in order
- [ ] T058 [US3] Implement Store.sessions() in both stores - list all recorded sessions with metadata
- [ ] T059 [US3] Implement Store.clear(sessionId) in both stores - delete session

### Recording Integration

- [ ] T060 [US3] Add record:boolean option to RunOptions in Workflow.run()
- [ ] T061 [US3] Implement recording logic in WorkflowRuntime - append events to Store when record:true
- [ ] T062 [US3] Generate sessionId automatically if not provided (UUID v4)

### Replay via Tape

- [ ] T063 [US3] Implement Workflow.load(sessionId) method that returns Tape from stored events
- [ ] T064 [US3] Implement `play()` method in Tape - async playback from current to end
- [ ] T065 [US3] Implement `playTo(n)` method in Tape - async playback to specific position
- [ ] T066 [US3] Implement `pause()` method in Tape - stop playback, set status to "paused"
- [ ] T067 [US3] Ensure replay mode does NOT make LLM calls - events come from recording only

### Store Index

- [ ] T068 [US3] Create src/store/index.ts with exports (Store, MemoryStore, SqliteStore, createMemoryStore, createSqliteStore)

**Checkpoint**: User Story 3 complete - Recording and deterministic replay is functional

---

## Phase 6: User Story 4 - Event Rendering (Priority: P4)

**Goal**: Custom renderers transform events to different outputs (terminal, web, logs)

**Independent Test**: Create renderers for different outputs, verify they receive events without affecting event stream

### Renderer Implementation

- [ ] T069 [US4] Create src/renderer/Renderer.ts with Renderer interface per contracts/renderer.ts
- [ ] T070 [US4] Implement pattern matching for event names (exact: "text:delta", wildcard: "error:*", "*:completed", "*")
- [ ] T071 [US4] Implement createRenderer() factory function with pattern-specific render functions
- [ ] T072 [US4] Integrate renderers into WorkflowRuntime - send events to renderers in parallel with handler processing
- [ ] T073 [US4] Ensure renderers are pure observers - cannot modify events, state, or emit new events

### Renderer Index

- [ ] T074 [US4] Create src/renderer/index.ts with exports (Renderer, createRenderer, EventPattern)

**Checkpoint**: User Story 4 complete - Multiple renderers can observe events independently

---

## Phase 7: User Story 5 - Clean Public API (Priority: P5)

**Goal**: Consumers use familiar async/await without Effect knowledge

**Independent Test**: Create complete workflow using only public API types, verify zero Effect types leak

### Effect Boundary Enforcement

- [ ] T075 [US5] Audit src/index.ts exports - ensure NO Effect types exposed (Context, Effect, Layer, Stream, etc.)
- [ ] T076 [US5] Implement Error conversion in boundary.ts - Effect Cause → standard Error via Cause.pretty
- [ ] T077 [US5] Ensure all public methods return Promise, not Effect
- [ ] T078 [US5] Add JSDoc documentation to all public types in src/index.ts

### Factory Function DX

- [ ] T079 [P] [US5] Ensure defineEvent() returns consumer-friendly type (not @effect/schema internal)
- [ ] T080 [P] [US5] Ensure defineHandler() accepts plain function, returns HandlerDefinition
- [ ] T081 [P] [US5] Ensure agent() validates outputSchema is present and throws clear error if missing

### Workflow DX

- [ ] T082 [US5] Implement Workflow.dispose() for resource cleanup via ManagedRuntime.dispose()
- [ ] T083 [US5] Add WorkflowCallbacks (onEvent, onStateChange, onError) to Workflow.run() options

**Checkpoint**: User Story 5 complete - Public API is Effect-free with familiar patterns

---

## Phase 8: User Story 6 - React Integration (Priority: P6)

**Goal**: useWorkflow hook with AI SDK compatible API plus tape controls

**Independent Test**: Build React component with useWorkflow, verify all values work without Effect knowledge

### Message Projection (Events → Messages)

- [ ] T084 [US6] Create src/message/Message.ts with Message type per contracts/message.ts
- [ ] T085 [US6] Create src/message/projection.ts with projectEventsToMessages() function
- [ ] T086 [US6] Implement user:input → { role: "user", content } projection rule
- [ ] T087 [US6] Implement text:delta accumulation into current assistant message
- [ ] T088 [US6] Implement text:complete finalization of assistant message
- [ ] T089 [US6] Implement agent:started → new assistant message with name
- [ ] T090 [US6] Implement tool:called → add to toolInvocations[] with state: "pending"
- [ ] T091 [US6] Implement tool:result → update toolInvocation.result and state
- [ ] T092 [US6] Ensure messages include _events array for traceability

### useWorkflow Hook

- [ ] T093 [US6] Create src/react.ts with useWorkflow hook signature per contracts/message.ts UseWorkflowReturn
- [ ] T094 [US6] Implement AI SDK compatible values: messages, input, setInput, handleSubmit, isLoading, error
- [ ] T095 [US6] Implement Open Harness unique values: events, state, tape
- [ ] T096 [US6] Implement tape controls integration - stepBack(), step(), rewind() update React state
- [ ] T097 [US6] Implement useEffect cleanup for workflow.dispose() on unmount

### React Context

- [ ] T098 [US6] Implement WorkflowProvider component for React context
- [ ] T099 [US6] Implement WorkflowChat component for zero-config chat UI (optional convenience)

### Message Index

- [ ] T100 [US6] Create src/message/index.ts with exports (Message, projectEventsToMessages, etc.)

**Checkpoint**: User Story 6 complete - React developers have AI SDK compatible hook with time-travel

---

## Phase 9: LLM Provider Integration

**Goal**: Claude Agent SDK integration as the default LLM provider

**Note**: This phase is a cross-cutting concern needed for live execution (not replay)

### Claude Provider Layer

- [ ] T101 Create src/provider/ClaudeProvider.ts with ClaudeProviderLive Layer
- [ ] T102 Implement Stream.fromAsyncIterable to convert SDK stream to Effect Stream
- [ ] T103 Implement Effect.acquireRelease for SDK connection cleanup on abort/error
- [ ] T104 Implement structured output: convert Zod outputSchema → JSON Schema → SDK outputFormat
- [ ] T105 Map SDK messages to internal Event types (text:delta, tool:called, etc.)
- [ ] T106 Implement abort handling via AbortController passthrough to SDK

### Provider Index

- [ ] T107 Create src/provider/index.ts with exports (ClaudeProviderLive, ClaudeProviderConfig, etc.)

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, edge cases, and documentation

### Edge Case Handling (from spec.md)

- [ ] T108 [P] Handle stepBack() at position 0 - remain at position 0 with initial state
- [ ] T109 [P] Handle step() past last event - stay at final position
- [ ] T110 [P] Handle handler exceptions - emit error:occurred event and continue
- [ ] T111 [P] Handle unknown event type in replay - skip gracefully with warning
- [ ] T112 [P] Handle Store unavailable during recording - fail fast with clear error

### Server Integration (FR-059, FR-060)

- [ ] T113 [P] Implement createWorkflowHandler() for server-side HTTP endpoints
- [ ] T114 [P] Add api option to useWorkflow for client-server connection

### Final Validation

- [ ] T115 Run quickstart.md examples as integration tests to validate all user stories work together
- [ ] T116 Verify 100% Effect-free public API (run tsc --noEmit on consumer code importing @core-v2)
- [ ] T117 Verify deterministic replay - same session replayed 100x produces identical state at each position

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 - Tape is core primitive
- **User Story 2 (Phase 4)**: Depends on Phase 2 - WorkflowRuntime uses Services
- **User Story 3 (Phase 5)**: Depends on Phase 3 (Tape) + Phase 4 (Workflow) - Recording extends both
- **User Story 4 (Phase 6)**: Depends on Phase 4 - Renderers integrate with WorkflowRuntime
- **User Story 5 (Phase 7)**: Depends on Phases 3-6 - Validates all public APIs
- **User Story 6 (Phase 8)**: Depends on Phase 3 (Tape) + Phase 4 (Workflow) - React wraps both
- **Provider (Phase 9)**: Can proceed in parallel after Phase 2 - Independent of other stories
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Independence

| Story | Can Start After | Can Be Tested Independently |
|-------|-----------------|---------------------------|
| US1 (Time-Travel) | Phase 2 | ✅ Yes - Tape with fixture events |
| US2 (Event-Driven) | Phase 2 | ✅ Yes - Mock provider or fixtures |
| US3 (Record/Replay) | US1 + US2 | ✅ Yes - Record then replay |
| US4 (Renderers) | US2 | ✅ Yes - Emit events, verify render |
| US5 (Clean API) | US1-US4 | ✅ Yes - Type-level verification |
| US6 (React) | US1 + US2 | ✅ Yes - Mock events, verify hook |

### Parallel Opportunities

```
Phase 1: T003 || T004 || T005 || T006 || T007 || T008

Phase 2: T011 || T012 || T016 || T018 || T019 || T022 || T023

US2 + US1 can proceed in parallel after Phase 2

US3 + US4 + US6 can proceed in parallel after US1 + US2

Phase 9 (Provider) can proceed in parallel with US3-US6
```

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch Effect Service Tags in parallel:
Task: "Create Store Service Tag in src/store/Store.ts"
Task: "Create LLMProvider Service Tag in src/provider/Provider.ts"
Task: "Create HandlerRegistry Service Tag in src/handler/HandlerRegistry.ts"
Task: "Create AgentRegistry Service Tag in src/agent/AgentService.ts"

# Launch Built-in Events in parallel:
Task: "Add ToolCalledEvent, ToolResultEvent schemas to src/event/Event.ts"
Task: "Add ErrorOccurredEvent schema to src/event/Event.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Time-Travel) - THE killer feature
4. Complete Phase 4: User Story 2 (Event-Driven Workflow)
5. **STOP and VALIDATE**: Verify time-travel debugging works with real workflows
6. Demo: Developer can define workflow, run it, load session, stepBack() to debug

### Incremental Delivery

1. Setup + Foundational → Effect Services ready
2. Add US1 (Tape) → Time-travel debugging works → Demo
3. Add US2 (Workflow) → Full event loop works → Demo
4. Add US3 (Recording) → Persistence works → Demo
5. Add US4 (Renderers) → Multi-output works → Demo
6. Add US5 (Clean API) → DX validated → Demo
7. Add US6 (React) → Frontend ready → Full Demo

### Total Task Count

- **Phase 1 (Setup)**: 8 tasks
- **Phase 2 (Foundational)**: 16 tasks
- **Phase 3 (US1 Time-Travel)**: 11 tasks
- **Phase 4 (US2 Event-Driven)**: 18 tasks
- **Phase 5 (US3 Recording)**: 15 tasks
- **Phase 6 (US4 Renderers)**: 6 tasks
- **Phase 7 (US5 Clean API)**: 9 tasks
- **Phase 8 (US6 React)**: 17 tasks
- **Phase 9 (Provider)**: 7 tasks
- **Phase 10 (Polish)**: 10 tasks

**Total: 117 tasks**

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Effect types MUST stay internal - verify via TypeScript at boundaries
