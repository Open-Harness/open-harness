# Open Scaffold Implementation PRD

> **Canonical ADRs:** [001](./docs/plans/adr/001-execution-api.md) | [002](./docs/plans/adr/002-hitl-architecture.md) | [003](./docs/plans/adr/003-public-vs-internal-exports.md) | [004](./docs/plans/adr/004-event-observer-pattern.md) | [005](./docs/plans/adr/005-type-safety-strategy.md) | [006](./docs/plans/adr/006-state-sourcing-model.md) | [007](./docs/plans/adr/007-error-hierarchy.md) | [008](./docs/plans/adr/008-naming-conventions.md) | [009](./docs/plans/adr/009-config-consolidation.md) | [010](./docs/plans/adr/010-provider-ownership-model.md) | [011](./docs/plans/adr/011-service-instantiation-pattern.md) | [012](./docs/plans/adr/012-phase-lifecycle-specification.md) | [013](./docs/plans/adr/013-react-hooks-architecture.md)

## Phase 1: Foundation (ADR-004, ADR-006, ADR-010)

### Parallel Group 1: Event System (ADR-004)
- [ ] Create `packages/core/src/Domain/Events.ts` with Data.TaggedClass event definitions
- [ ] Create `packages/core/src/Services/EventHub.ts` with PubSub implementation
- [ ] Create `packages/core/src/Engine/subscribers.ts` with Store/Bus/Observer subscribers
- [ ] Create `packages/core/src/Engine/dispatch.ts` with Match.exhaustive dispatch
- [ ] Update `packages/core/src/Engine/runtime.ts` to use EventHub instead of direct dispatch
- [ ] Update `packages/core/src/Engine/types.ts` to re-export new event types
- [ ] Delete `packages/core/src/Domain/Interaction.ts` (duplicate Event definition)

### Parallel Group 2: State Sourcing (ADR-006)
- [ ] Create `packages/core/src/Domain/Events.ts` additions: StateIntent, StateCheckpoint, SessionForked
- [ ] Create `packages/core/src/Services/StateProjection.ts` with SubscriptionRef fiber
- [ ] Update `packages/core/src/Engine/runtime.ts` to emit StateIntent instead of mutating Ref
- [ ] Update `packages/core/src/Services/StateCache.ts` to use deriveState with checkpoints
- [ ] Update `packages/core/src/Engine/utils.ts` to replace computeStateAt with deriveState
- [ ] Add `StateCheckpoint` emission at phase end, pause, and every N events

### Parallel Group 3: Provider Ownership (ADR-010)
- [ ] Update `packages/core/src/Domain/Provider.ts` AgentProvider interface (add model, config)
- [ ] Update `packages/core/src/Engine/agent.ts` AgentDef (replace model string with provider instance)
- [ ] Delete `packages/core/src/Engine/provider.ts` ProviderRegistry and makeInMemoryProviderRegistry
- [ ] Update `packages/core/src/Engine/runtime.ts` to use agent.provider directly
- [ ] Update `packages/core/src/Engine/run.ts` to remove providers from RuntimeConfig
- [ ] Update provider packages (anthropic, codex) to expose model/config properties

## Phase 2: Execution API (ADR-001, ADR-002, ADR-012)

### Sequential: Core Execution (ADR-001)
- [ ] Update `packages/core/src/Engine/run.ts` to return WorkflowExecution with control methods
- [ ] Remove `packages/core/src/Engine/execute.ts` from public exports (make internal)
- [ ] Remove `packages/core/src/Engine/runtime.ts` streamWorkflow and WorkflowHandle from public API
- [ ] Update `packages/core/src/index.ts` exports (only run() and related types)
- [ ] Update `packages/core/src/Engine/run.ts` to support AbortSignal

### Sequential: HITL Integration (ADR-002)
- [ ] Delete `packages/core/src/Domain/Interaction.ts`
- [ ] Update `packages/core/src/Engine/phase.ts` PhaseDef with inline human field
- [ ] Update `packages/core/src/Engine/runtime.ts` to await humanInput handler
- [ ] Create `packages/core/src/helpers/humanInput.ts` with cliPrompt() and autoApprove()
- [ ] Update `packages/core/src/Engine/run.ts` RunOptions with humanInput handler
- [ ] Update `packages/core/src/Engine/types.ts` with new InputRequested/InputReceived payloads

### Sequential: Phase Lifecycle (ADR-012)
- [ ] Update `packages/core/src/Domain/Phase.ts` with discriminated union types (AgentPhase, HumanPhase, TerminalPhase)
- [ ] Create factory functions: agentPhase(), humanPhase(), terminalPhase()
- [ ] Update `packages/core/src/Engine/phase.ts` to implement guard → before → run → after flow
- [ ] Update `packages/core/src/Engine/runtime.ts` with retry logic and error handling
- [ ] Add PhaseErrorConfig to PhaseDef with retry/pause strategies
- [ ] Emit phase:failed events with error details

## Phase 3: Type Safety & Naming (ADR-005, ADR-008)

### Parallel Group 4: Schema Validation (ADR-005)
- [ ] Add `@effect/schema` dependency to packages/core
- [ ] Create `packages/core/src/Domain/Ids.ts` schemas (SessionId, EventId, WorkflowId, AgentId)
- [ ] Create `packages/core/src/Engine/workflow.ts` WorkflowDefSchema
- [ ] Update `packages/core/src/Layers/LibSQL.ts` with row deserialization schemas
- [ ] Update `packages/server/src/store/StateSnapshotStoreLive.ts` with StateCheckpoint schema
- [ ] Update `packages/server/src/store/EventStoreLive.ts` with StoredEvent schema
- [ ] Update `packages/client/src/HttpClient.ts` with API response schemas

### Parallel Group 5: Naming Conventions (ADR-008)
- [ ] Rename payload fields: agentName → agent, workflowName → workflow, promptText → prompt, inputType → type
- [ ] Rename observer callbacks: onToolCall → onToolCalled, onErrored → onError
- [ ] Update `packages/client/src/react/hooks.ts` type names (UseFilteredEventsOptions → FilteredEventsOptions)
- [ ] Consolidate Event definition (remove from Domain/Interaction.ts, use Engine/types.ts)
- [ ] Update all affected files with new names

## Phase 4: Errors & Config (ADR-007, ADR-009)

### Parallel Group 6: Error Hierarchy (ADR-007)
- [ ] Consolidate errors in `packages/core/src/Domain/Errors.ts`
- [ ] Delete duplicate errors from `packages/core/src/Engine/types.ts`
- [ ] Rename: WorkflowPhaseError → PhaseError, WorkflowAbortedError → AbortedError, WorkflowTimeoutError → TimeoutError
- [ ] Add error codes to all error classes
- [ ] Update `packages/server/src/http/Server.ts` mapErrorToResponse with structured errors
- [ ] Update `packages/client/src/HttpClient.ts` to return ClientResult<T> discriminated union
- [ ] Update `packages/client/src/Contract.ts` with ApiError types

### Parallel Group 7: Config Consolidation (ADR-009)
- [ ] Create unified ServerAppConfig interface in server package
- [ ] Update `packages/server/src/http/Server.ts` createServer() to use new config
- [ ] Update `packages/core/src/Engine/types.ts` RuntimeConfig (remove providers, keep mode/database)
- [ ] Update `packages/server/src/OpenScaffold.ts` to use nested config
- [ ] Add `@effect/platform-node` dependency for HTTP server refactor
- [ ] Refactor server routing to use Effect HTTP platform (internal only)

## Phase 5: Service Architecture (ADR-011)

- [ ] Create `packages/core/src/Layers/AppLayer.ts` with makeAppLayer() factory
- [ ] Create `packages/core/src/Layers/TestLayer.ts` with makeTestLayer() preset
- [ ] Add InMemoryStateSnapshotStore to `packages/core/src/Layers/InMemory.ts`
- [ ] Update `packages/server/src/http/Server.ts` to use AppLayer factory
- [ ] Update `packages/core/src/Engine/runtime.ts` to use AppLayer factory
- [ ] Update test helpers to use TestLayer preset

## Phase 6: Public API Cleanup (ADR-003)

- [ ] Create `packages/core/src/internal.ts` entrypoint
- [ ] Move Services, Layers exports to `/internal`
- [ ] Mark internal exports with JSDoc `@internal`
- [ ] Update `packages/core/package.json` exports field
- [ ] Do same for server and client packages
- [ ] Ensure public index.ts only exports stable API

## Phase 7: React Hooks (ADR-013)

- [ ] Add `@tanstack/react-query` dependency to client package
- [ ] Create `packages/client/src/react/primitives/queries.ts`
- [ ] Create `packages/client/src/react/primitives/mutations.ts`
- [ ] Create `packages/client/src/react/primitives/subscription.ts` (SSE)
- [ ] Create grouped hooks: useWorkflowData, useWorkflowActions, useWorkflowVCR, useWorkflowHITL
- [ ] Create unified `useWorkflow()` hook
- [ ] Create `WorkflowClientProvider` component
- [ ] Update `packages/client/src/react/index.ts` exports
- [ ] Delete old individual hooks

## Acceptance Criteria

- [ ] All 13 ADRs are implemented per their specifications
- [ ] No mocks in tests (use real implementations with :memory:)
- [ ] All tests pass (pnpm test)
- [ ] TypeScript typechecks (pnpm typecheck)
- [ ] No build artifacts in src/ directories
- [ ] Public API matches ADR-003 (minimal, stable)
- [ ] Internal API available via /internal entrypoints
