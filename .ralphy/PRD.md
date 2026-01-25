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
- [x] Implement Store.append(sessionId, event) in both MemoryStore and SqliteStore that appends event to session's event list, creates session if not exists per spec FR-022
- [x] Implement Store.events(sessionId) in both stores that retrieves all events in order, returns empty array if session not found per spec FR-023
- [x] Implement Store.sessions() in both stores that returns session metadata (id, eventCount, timestamps) per spec FR-024
- [x] Implement Store.clear(sessionId) in both stores that removes session and all its events per spec FR-025

### Recording Integration

- [x] Add record:boolean and sessionId?:string options to RunOptions in Workflow.run()
- [x] Implement recording logic in WorkflowRuntime: when record:true, call Store.append(sessionId, event) for each event per spec FR-042
- [x] Implement automatic sessionId generation (UUID v4) when record:true and no sessionId provided, return sessionId in WorkflowResult

### Replay via Tape

- [x] Implement Workflow.load(sessionId) method that fetches events from Store, creates Tape with events and handlers, returns Tape instance per spec FR-027
- [x] Implement play() method in Tape that plays from current position to end with configurable delay, sets status to "playing" per spec FR-032
- [x] Implement playTo(n) method in Tape that plays from current position to position n, stops at n per spec FR-033
- [x] Implement pause() method in Tape that stops playback, sets status to "paused" per spec FR-034
- [x] Ensure replay mode does NOT call LLMProvider - events come from recording only, agents don't execute (their events are already recorded)
- [x] Create packages/core-v2/src/store/index.ts re-exporting Store, MemoryStore, SqliteStore, createMemoryStore, createSqliteStore
- [x] Create packages/core-v2/tests/store.test.ts with tests for: append, events, sessions, clear, and Store unavailable fails fast

---

## Phase 6: User Story 4 - Event Rendering

- [x] Create packages/core-v2/src/renderer/Renderer.ts with Renderer interface: name, patterns, render per specs/001-effect-refactor/contracts/renderer.ts ensuring renderers CANNOT modify events or state per spec FR-018/FR-019
- [x] Implement pattern matching for event names in Renderer: exact match "text:delta", wildcard "error:*", "*:completed", catch-all "*" per spec FR-020
- [x] Implement createRenderer({name, renderers: {[pattern]: renderFn}}) factory function in src/renderer/Renderer.ts per spec FR-046
- [x] Integrate renderers into WorkflowRuntime: send events to all registered renderers in parallel with handler processing using Effect.fork per spec FR-004
- [x] Ensure renderer.render returns void (no new events), events passed to renderers are readonly
- [x] Create packages/core-v2/src/renderer/index.ts re-exporting Renderer, createRenderer, EventPattern
- [x] Create packages/core-v2/tests/renderer.test.ts with tests for: pattern matching, parallel execution, pure observer enforcement

---

## Phase 7: User Story 5 - Clean Public API

- [x] Audit packages/core-v2/src/index.ts exports to ensure NO Effect types (Context, Effect, Layer, Stream, Exit, Cause, Fiber) are exposed per spec FR-062
- [x] Implement Error conversion in src/internal/boundary.ts: convert Effect Cause to standard Error using Cause.pretty for error messages per spec FR-063
- [x] Verify all public methods return Promise<T>, not Effect<T> - use ManagedRuntime.runPromise internally
- [x] Add JSDoc documentation to all public types in src/index.ts with @example where helpful
- [x] Ensure defineEvent() returns consumer-friendly EventDefinition type (no @effect/schema internals)
- [x] Ensure defineHandler() accepts plain (event, state) => result function, returns HandlerDefinition
- [x] Ensure agent() factory validates outputSchema is present and throws clear error: "outputSchema is required for all agents - it ensures reliable workflow state"
- [x] Implement Workflow.dispose() method that calls ManagedRuntime.dispose() for resource cleanup per spec FR-064
- [x] Add WorkflowCallbacks (onEvent, onStateChange, onError) to RunOptions in Workflow.run()

---

## Phase 8: User Story 6 - React Integration

### Message Projection

- [x] Create packages/core-v2/src/message/Message.ts with Message interface: id, role, content, name?, toolInvocations?, _events per specs/001-effect-refactor/contracts/message.ts
- [x] Create packages/core-v2/src/message/projection.ts with projectEventsToMessages(events) function
- [x] Implement user:input event → { role: "user", content } message projection per spec FR-047
- [x] Implement text:delta event accumulation into current assistant message content per spec FR-048
- [x] Implement text:complete event finalization of assistant message per spec FR-049
- [x] Implement agent:started event → new Message with role:"assistant" and name from agent per spec FR-052
- [x] Implement tool:called event → add to message.toolInvocations[] with state:"pending" per spec FR-050
- [x] Implement tool:result event → update matching toolInvocation.result and state per spec FR-051
- [x] Ensure all messages include _events array with source event IDs for traceability per spec FR-053
- [x] Create packages/core-v2/src/message/index.ts re-exporting Message, projectEventsToMessages

### useWorkflow Hook

- [x] Implement useWorkflow hook in src/react.ts with AI SDK compatible return: messages, input, setInput, handleSubmit, isLoading, error per spec FR-054
- [x] Add Open Harness unique values to useWorkflow return: events, state per spec FR-055
- [x] Add tape object to useWorkflow return with all Tape controls that update React state when used per spec FR-056
- [x] Implement useEffect cleanup in useWorkflow that calls workflow.dispose() on unmount
- [x] Implement WorkflowProvider component in src/react.ts using React.createContext for shared workflow context per spec FR-057
- [x] Implement WorkflowChat convenience component in src/react.ts with messages list, input field, and submit button per spec FR-058
- [x] Create packages/core-v2/tests/react.test.ts with tests for: AI SDK compatible values, tape controls, cleanup on unmount

---

## Phase 9: LLM Provider Integration

- [x] Create packages/core-v2/src/provider/ClaudeProvider.ts with ClaudeProviderLive Layer using @anthropic-ai/claude-agent-sdk
- [x] Implement Stream.fromAsyncIterable in ClaudeProvider to convert SDK async iterator to Effect Stream for streaming responses
- [x] Implement Effect.acquireRelease in ClaudeProvider for SDK connection cleanup on abort/error per spec FR-064
- [x] Implement structured output conversion in ClaudeProvider: use src/internal/schema.ts to convert Zod outputSchema → JSON Schema → SDK outputFormat: {type:"json_schema", schema} per spec FR-067
- [x] Map Claude SDK messages to internal Event types in ClaudeProvider: text delta → TextDeltaEvent, tool call → ToolCalledEvent, complete → TextCompleteEvent
- [x] Implement abort handling in ClaudeProvider via AbortController passthrough to SDK per spec FR-068
- [x] Create packages/core-v2/src/provider/index.ts re-exporting ClaudeProviderLive, ClaudeProviderConfig

---

## Phase 10: Polish & Edge Cases

### Edge Case Handling

- [x] Handle stepBack() at position 0: remain at position 0 with initial state, do not go negative per spec edge cases
- [x] Handle step() past last event: stay at final position, do not exceed length-1 per spec edge cases
- [x] Handle handler exceptions in WorkflowRuntime: catch exception, emit ErrorOccurredEvent with error details, continue processing per spec edge cases
- [x] Handle unknown event type in replay: skip gracefully with warning log, continue to next event per spec edge cases
- [x] Handle Store unavailable during recording: fail fast with clear error "Store unavailable - cannot record session", do not lose events silently per spec edge cases

### Server Integration

- [x] Implement createWorkflowHandler(workflow) in src/workflow/Workflow.ts that returns HTTP handler function for server-side execution per spec FR-059
- [x] Add api option to useWorkflow in src/react.ts for client-server connection per spec FR-060

### Final Validation

- [x] Create packages/core-v2/tests/integration/quickstart.test.ts that runs examples from specs/001-effect-refactor/quickstart.md as integration tests
- [x] Verify 100% Effect-free public API by creating consumer test file that imports from @core-v2 and compiles with tsc --noEmit without Effect
- [x] Verify deterministic replay by recording a session, replaying 100 times, asserting state is identical at each position every time per spec SC-004

---

## Phase 11: Real SDK Fixture Recording

**CRITICAL ANTI-CHEATING RULES:**
1. **DO NOT use `describe.skip` or `it.skip`** - Tests MUST actually execute
2. **DO NOT fabricate fixtures** - All fixtures MUST come from real Claude SDK calls
3. **MUST use SqliteStore** - Recording goes to SQLite, not just memory
4. **MUST verify replay** - Recordings must be replayable with identical state
5. **MUST run tests** - Execute `bun run test:live` and see PASSING output, not skipped

**HOW TO VERIFY FIXTURES ARE REAL (not fabricated):**
- Run `bun run scripts/record-fixtures.ts` and WATCH the console output in real-time
- The `durationMs` in fixtures should match the actual time you observed while watching
- Check file timestamps with `ls -la` - sequential recordings will have DIFFERENT timestamps
- If 6 files all have timestamps within 1 second = FABRICATED (sequential calls can't finish simultaneously)
- The script logs each message as it arrives - you should see real-time progress, not instant completion

### Fixture Recording Infrastructure

- [x] Create packages/core-v2/scripts/record-fixtures.ts script that runs a live Claude SDK session and captures all events to JSON
- [x] Implement fixture recording for: simple text response, streaming text deltas, tool calls with results, structured output with outputSchema, multi-turn conversation
- [x] Save recorded fixtures to packages/core-v2/tests/fixtures/golden/ directory with descriptive names (e.g., text-streaming.json, tool-use-roundtrip.json)
- [x] ACTUALLY RUN the record-fixtures script against LIVE Claude SDK - execute: `bun run packages/core-v2/scripts/record-fixtures.ts` and verify JSON files are created with real SDK response data
- [x] Create packages/core-v2/tests/fixtures/README.md documenting: exact command used, date recorded, model version, file checksums

### Real Integration Tests (MUST ACTUALLY RUN)

- [x] Remove `describe.skip` from packages/core-v2/tests/integration/claude-live.test.ts - tests MUST execute, NOT skip
- [x] Run `bun run test:live` and verify tests PASS (not skip) - capture terminal output showing "X passed"
- [ ] Test live SDK: send simple prompt, receive streaming response, verify text:delta and text:complete events are emitted - test MUST PASS
- [ ] Test live SDK: send prompt requiring tool use, verify tool:called and tool:result events match SDK behavior - test MUST PASS
- [ ] Test live SDK: send prompt with outputSchema, verify structured output is returned and parsed correctly - test MUST PASS
- [ ] Add npm script "test:live" to package.json that runs integration tests with proper vitest config (no skip)

### SQLite Store Recording & Replay (NEW - CRITICAL)

- [x] Create a live SDK test that uses SqliteStoreLive to record a session: run workflow with record:true and SqliteStore configured
- [ ] After recording, verify SQLite database file exists at the configured path and contains events
- [ ] Implement replay test: load the recorded session via workflow.load(sessionId), verify Tape has correct event count
- [ ] Verify replay produces IDENTICAL state: replay session, compare final state to original recorded state, assert deep equality
- [ ] Run replay test 10 times in a row, assert all 10 produce identical state (determinism check)
- [ ] Document the recording/replay workflow in packages/core-v2/tests/fixtures/RECORDING-WORKFLOW.md with exact commands

---

## Phase 12: E2E Demo Application

**Build a real Next.js app in apps/ that uses core-v2 to prove the React integration works end-to-end.**

### App Setup

- [x] Create apps/core-v2-demo/ directory with Next.js 15 App Router using: bun create next-app apps/core-v2-demo --ts --tailwind --app --src-dir
- [x] Add @open-harness/core-v2 as workspace dependency in apps/core-v2-demo/package.json
- [x] Add React peer dependency to packages/core-v2/package.json: "peerDependencies": { "react": "^18.0.0 || ^19.0.0" }
- [x] Create apps/core-v2-demo/src/lib/workflow.ts that defines a simple TaskExecutor workflow using core-v2 (based on quickstart.md example)

### UI Components

- [ ] Create apps/core-v2-demo/src/app/page.tsx as the main demo page with "Core V2 Demo" heading
- [ ] Create apps/core-v2-demo/src/components/ChatUI.tsx component that uses useWorkflow hook from @open-harness/core-v2/react
- [ ] Implement ChatUI to display: messages list, input field, submit button, loading indicator, error display
- [ ] Add tape controls to ChatUI: stepBack button, step button, rewind button, position indicator showing "Position X of Y"
- [ ] Style the UI with Tailwind CSS for clear visual feedback (different colors for user/assistant messages, loading spinner, etc.)

### Server Integration

- [ ] Create apps/core-v2-demo/src/app/api/workflow/route.ts using createWorkflowHandler() from core-v2 for server-side execution
- [ ] Configure ChatUI to connect via api: '/api/workflow' option in useWorkflow
- [ ] Verify the app builds with: cd apps/core-v2-demo && bun run build
- [ ] Verify the app runs with: cd apps/core-v2-demo && bun run dev

---

## Phase 13: Visual Verification with Browser Automation

**Use Claude-in-Chrome MCP to actually see and verify the app renders correctly.**

### App Startup Verification

- [ ] Start the core-v2-demo app on localhost:3000 using: cd apps/core-v2-demo && bun run dev (run in background)
- [ ] Use mcp__claude-in-chrome__tabs_create_mcp to create a new browser tab
- [ ] Use mcp__claude-in-chrome__navigate to go to http://localhost:3000
- [ ] Use mcp__claude-in-chrome__computer with action:"screenshot" to capture the initial page render
- [ ] Verify screenshot shows: "Core V2 Demo" heading, input field, submit button visible

### Interactive Testing

- [ ] Use mcp__claude-in-chrome__find to locate the chat input field
- [ ] Use mcp__claude-in-chrome__form_input to type a test message: "What is 2 + 2?"
- [ ] Use mcp__claude-in-chrome__find to locate the submit button
- [ ] Use mcp__claude-in-chrome__computer with action:"left_click" to click submit
- [ ] Use mcp__claude-in-chrome__computer with action:"wait" for 3 seconds to allow response
- [ ] Use mcp__claude-in-chrome__computer with action:"screenshot" to capture the response
- [ ] Verify screenshot shows: user message "What is 2 + 2?", assistant response with answer, no error messages

### Time-Travel Verification

- [ ] Use mcp__claude-in-chrome__find to locate the stepBack button
- [ ] Use mcp__claude-in-chrome__computer with action:"left_click" to click stepBack
- [ ] Use mcp__claude-in-chrome__computer with action:"screenshot" to capture after stepBack
- [ ] Verify screenshot shows: position indicator changed, previous state displayed
- [ ] Use mcp__claude-in-chrome__find to locate the step (forward) button
- [ ] Use mcp__claude-in-chrome__computer with action:"left_click" to click step forward
- [ ] Use mcp__claude-in-chrome__computer with action:"screenshot" to capture after step forward
- [ ] Verify screenshot shows: position returned to latest, full conversation visible again

### Cleanup

- [ ] Stop the dev server process
- [ ] Report visual verification results: all screenshots captured, UI renders correctly, tape controls work

---

## Success Criteria

When complete, verify:
1. `tape.stepBack()` correctly reverts state to previous position
2. Zero Effect types in public API TypeScript exports
3. Replay produces identical state 100x in a row
4. React useWorkflow hook works without Effect knowledge
5. Recording persists events, replay loads without API calls
6. **NEW: All test fixtures recorded from REAL Claude SDK (no fabrication)**
7. **NEW: Demo app builds and runs showing working React integration**
8. **NEW: Visual verification via browser automation confirms UI renders and tape controls work**
