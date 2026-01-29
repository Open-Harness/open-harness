# Technical Debt Inventory

> **Living document** — Updated as issues are discovered and resolved.
>
> **Last updated:** 2026-01-29

## Summary

| Metric | Count |
|--------|-------|
| Total Issues | 96 |
| Resolved (via ADR) | 65 |
| Remaining | 31 |
| Bugs | 0 |
| Smells | 0 |
| Intentional | 0 |

## ADR Index

| ADR | Title | Status | Issues Resolved |
|-----|-------|--------|-----------------|
| [ADR-001](./001-execution-api.md) | Execution API Design | Accepted | API-001, API-003, API-004, API-005, API-011, ARCH-003, DEAD-001, DEAD-002 |
| [ADR-002](./002-hitl-architecture.md) | HITL Architecture | Accepted | HITL-001, HITL-002, HITL-003, TYPE-014, ARCH-012, DEAD-009, DEAD-011 |
| [ADR-003](./003-public-vs-internal-exports.md) | Public vs Internal Exports | Accepted | ARCH-004, ARCH-007, API-008, API-009, DEAD-003, DEAD-004, DEAD-005, DEAD-006 |
| [ADR-004](./004-event-observer-pattern.md) | Event/Observer Pattern | Accepted | ARCH-001, ARCH-005, ARCH-020, NAME-005, NAME-007, TYPE-005 |
| [ADR-005](./005-type-safety-strategy.md) | Type Safety Strategy | Accepted | TYPE-003, TYPE-004, TYPE-006, TYPE-009, TYPE-010, TYPE-011, TYPE-012, TYPE-013 |
| [ADR-006](./006-state-sourcing-model.md) | State Sourcing Model | Accepted | TYPE-015, ARCH-009, ARCH-010, ARCH-011, ARCH-018, ARCH-019, DOC-005 |
| [ADR-007](./007-error-hierarchy.md) | Error Hierarchy | Accepted | ERR-001, ERR-002, NAME-006 |
| [ADR-008](./008-naming-conventions.md) | Naming Conventions | Accepted | NAME-001, NAME-002, NAME-003, NAME-004, NAME-008, TYPE-001 |
| [ADR-009](./009-config-consolidation.md) | Config Consolidation | Accepted | API-002, API-006, API-007, ARCH-013 |
| [ADR-010](./010-provider-ownership-model.md) | Provider Ownership Model | Accepted | ARCH-006, ARCH-021 |
| [ADR-013](./013-react-hooks-architecture.md) | React Hooks Architecture | Accepted | ARCH-008, API-010, DEAD-010, TEST-012, TEST-013, DOC-003 |

## Decision Log

| Date | Phase | Decision | Rationale |
|------|-------|----------|-----------|
| 2026-01-29 | Pre-0 | Use shorter names (`agent`, `prompt`, `type`) | More idiomatic for APIs, matches observer callbacks |
| 2026-01-29 | 1 | Package structure is correct (core/server/client/testing/cli) | Clean separation, no circular deps, each has distinct purpose |
| 2026-01-29 | 7 | **ADR-001**: Single `run()` API returning awaitable handle | Consolidate 6 execution functions into one. Observer callbacks for events, control methods for pause/resume/abort. See [ADR-001](./001-execution-api.md) |
| 2026-01-29 | 7 | **ADR-002**: Inline human input on phase | One HITL system. Two types (approval, choice). Conditional via function. Delete Domain/Interaction.ts. See [ADR-002](./002-hitl-architecture.md) |
| 2026-01-29 | 7 | **ADR-004**: PubSub-based event architecture | Single EventHub with PubSub, Data.TaggedClass events with `_tag`, Match.exhaustive dispatch, fiber-based subscribers. See [ADR-004](./004-event-observer-pattern.md) |
| 2026-01-29 | 7 | **ADR-006**: True event sourcing | Events are source of truth. State derived via SubscriptionRef projection fiber. Enables fork/replay. StateCache with snapshots for optimization. See [ADR-006](./006-state-sourcing-model.md) |
| 2026-01-29 | 7 | **ADR-010**: Agent owns provider | Agents embed provider directly (not model string). No ProviderRegistry. Clean variant creation for evals. Prereq for ADR-009. See [ADR-010](./010-provider-ownership-model.md) |
| 2026-01-29 | 7 | **ADR-003**: Public vs internal exports | Separate `/internal` entrypoints + JSDoc `@internal` to keep public API minimal; routes/SSE/internal helpers move behind internal entrypoints. See [ADR-003](./003-public-vs-internal-exports.md) |
| 2026-01-29 | 7 | **ADR-007**: Error hierarchy | Consolidate on a single canonical error hierarchy and structured API errors for better consumer DX. See [ADR-007](./007-error-hierarchy.md) |
| 2026-01-29 | 7 | **ADR-008**: Naming conventions | Standardize payload field names and callback names for consistency across packages. See [ADR-008](./008-naming-conventions.md) |
| 2026-01-29 | 7 | **ADR-009**: Config consolidation | Nested runtime/server config, single-workflow server model, and one public server creation path. See [ADR-009](./009-config-consolidation.md) |
| 2026-01-29 | 7 | **ADR-013**: React Hooks Architecture | React Query + three-tier hooks (primitives, grouped, unified). Server-side state derivation per ADR-006. SSE updates React Query cache. See [ADR-013](./013-react-hooks-architecture.md) |

## Open Questions

1. ~~Should `run()` and `execute()` be consolidated into one API?~~ ✅ **Yes - ADR-001**
2. ~~Should `Domain/Interaction.ts` be removed entirely, or kept as advanced helper?~~ ✅ **Remove entirely - ADR-002**
3. ~~Is the core/server/client/testing package split correct?~~ ✅ Confirmed correct in Phase 1
4. Are there other deep dive areas we should add?
5. ~~Should route handlers and SSE utilities be exported publicly or moved to internal?~~ ✅ **Move to internal - ADR-003**
6. ~~Should there be a `@open-scaffold/core/internal` entry point for advanced users?~~ ✅ **Yes - ADR-003**

---

## Issues by Category

### Naming Inconsistencies

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| NAME-001 | `agentName` vs `agent` in 6 payload types | ✅ **Resolved** | ADR-008 | Domain events, HITL payloads | Prefer shorter `agent` |
| NAME-002 | `promptText` vs `prompt` in HITL | ✅ **Resolved** | ADR-008 | HITL payloads | Prefer shorter `prompt` |
| NAME-003 | `inputType` vs `type` in HITL | ✅ **Resolved** | ADR-008 | HITL payloads | Prefer shorter `type` |
| NAME-004 | `UseFilteredEventsOptions` should be `FilteredEventsOptions` | ✅ **Resolved** | ADR-008 | client/react/hooks.ts | `Use` prefix redundant for option types |
| NAME-005 | Event type naming inconsistent (`Event<N,P>` defined twice) | ✅ **Resolved** | ADR-004 | Domain/Interaction.ts, Engine/types.ts | Single Data.TaggedClass union |
| NAME-006 | Error class organization inconsistent | ✅ **Resolved** | ADR-007 | Engine/types.ts, Domain/Errors.ts | Consolidate and standardize error hierarchy |
| NAME-007 | Observer callback naming inconsistent | ✅ **Resolved** | ADR-004 | Engine/types.ts | Match.exhaustive dispatch standardizes naming |
| NAME-008 | Id vs ID capitalization mixed | ✅ **Resolved** | ADR-008 | Domain/Ids.ts | Keep `Id` convention (lowercase d) consistently |

### HITL Systems

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| HITL-001 | Two competing HITL systems exist | ✅ **Resolved** | ADR-002 | Domain/Interaction.ts, Phase/Runtime | Inline human on phase is canonical |
| HITL-002 | Different payload structures between systems | ✅ **Resolved** | ADR-002 | — | Unified payload structure |
| HITL-003 | React hooks only work with one HITL system | ✅ **Resolved** | ADR-002 | React integration | Hooks will use new unified payloads |

### Error Handling

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| ERR-001 | Duplicate error hierarchies (Domain vs Workflow) | ✅ **Resolved** | ADR-007 | Domain/Errors.ts, Engine/types.ts | Consolidate on one canonical hierarchy |
| ERR-002 | Two error classes in server (`OpenScaffoldError`, `ServerError`) | ✅ **Resolved** | ADR-007 | server/OpenScaffold.ts, server/http/Server.ts | Clarified error boundaries and mapping |

### API Surface

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| API-001 | Inconsistent execution APIs (`run` vs `execute` vs `executeWorkflow`) | ✅ **Resolved** | ADR-001 | Engine/*.ts | Consolidate to single `run()` API |
| API-002 | Inconsistent configuration options | ✅ **Resolved** | ADR-009 | — | Consolidate config shapes |
| API-003 | Unused/incomplete APIs (`streamWorkflow`, `WorkflowHandle`) | ✅ **Resolved** | ADR-001 | Engine/runtime.ts | Remove from public API |
| API-004 | `WorkflowHandle<S>` exported but incomplete | ✅ **Resolved** | ADR-001 | Engine/runtime.ts | Remove from public API |
| API-005 | `streamWorkflow()` returns at end, not true streaming | ✅ **Resolved** | ADR-001 | Engine/runtime.ts | Remove from public API |
| API-006 | Three overlapping config types in server | ✅ **Resolved** | ADR-009 | server/*.ts | Consolidate into one public config shape |
| API-007 | Two server creation paths without guidance | ✅ **Resolved** | ADR-009 | server/*.ts | One public server creation path |
| API-008 | 10 route handlers exported individually | ✅ **Resolved** | ADR-003 | server/index.ts | Route handlers are internal-only |
| API-009 | SSE utilities exported publicly | ✅ **Resolved** | ADR-003 | server/index.ts, client/index.ts | SSE utilities are internal-only |
| API-010 | Redundant `react/index.ts` barrel in client | ✅ **Resolved** | ADR-013 | client/react/index.ts | New three-tier hook architecture replaces all exports |
| API-011 | `runSimple()` and `runWithText()` feel incomplete | ✅ **Resolved** | ADR-001 | Engine/run.ts | Remove - use `run()` with observer |
| API-012 | ID schemas incomplete (only 2 of 4 exported) | Needs Investigation | — | Domain/Ids.ts | `SessionIdSchema`, `WorkflowIdSchema` but not `AgentIdSchema` |

### Type Safety

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| TYPE-001 | Duplicate type definitions | ✅ **Resolved** | ADR-008 | Engine/types.ts, Domain/Interaction.ts | Consolidate to single `Event` definition |
| TYPE-002 | `StateSnapshot` exported from multiple places | Open | — | Engine/types.ts, Domain/Interaction.ts | Consolidate exports (implementation detail) |
| TYPE-003 | **HIGH**: Double cast `as unknown as Record` in workflow.ts | ✅ **Resolved** | ADR-005 | Engine/workflow.ts:226 | Replace with `WorkflowDefSchema` Effect Schema validation |
| TYPE-004 | ID brand casts without runtime validation | ✅ **Resolved** | ADR-005 | Domain/Ids.ts, Engine/types.ts | Schema validation with `Schema.brand` |
| TYPE-005 | Event payload casts without validation | ✅ **Resolved** | ADR-004 | Engine/runtime.ts | `Data.TaggedClass` provides type-safe access |
| TYPE-006 | JSON.parse without validation in LibSQL | ✅ **Resolved** | ADR-005 | Layers/LibSQL.ts:71 | Schema decode for deserialized rows |
| TYPE-007 | StateSnapshot state cast on retrieval | Verify | ADR-006 | Services/StateCache.ts:112,121 | Verify with state-sourcing implementation |
| TYPE-008 | Zod schema cast loses type info | Accept | ADR-010 | Engine/provider.ts:242 | Zod kept for agent output by design |
| TYPE-009 | Array.from keys cast to SessionId | ✅ **Resolved** | ADR-005 | Layers/InMemory.ts:78 | ID validation with Schema |
| TYPE-010 | JSON.parse in StateSnapshotStoreLive | ✅ **Resolved** | ADR-005 | server/store/StateSnapshotStoreLive.ts:36 | `StateCheckpoint` schema validation |
| TYPE-011 | JSON.parse in EventStoreLive | ✅ **Resolved** | ADR-005 | server/store/EventStoreLive.ts:40 | `StoredEvent` schema validation |
| TYPE-012 | response.json() cast to generic T | ✅ **Resolved** | ADR-005 | client/HttpClient.ts:62 | API response schemas |
| TYPE-013 | JSON.parse SSE message cast to AnyEvent | ✅ **Resolved** | ADR-005 | client/HttpClient.ts:114 | SSE message schema validation |
| TYPE-014 | event.payload casts in usePendingInteractions | ✅ **Resolved** | ADR-002 | client/react/hooks.ts:448,466 | Hook rewritten with new HITL payloads |
| TYPE-015 | computeStateAt double cast | ✅ **Resolved** | ADR-006 | Engine/utils.ts:36 | `deriveState` replaces `computeStateAt` |

### Dead Code

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| DEAD-001 | `streamWorkflow` incomplete stub exported | ✅ **Resolved** | ADR-001 | Engine/runtime.ts:698-718 | Remove from public API |
| DEAD-002 | `WorkflowHandle` interface exported but not implemented | ✅ **Resolved** | ADR-001 | Engine/runtime.ts:728-741 | Remove from public API |
| DEAD-003 | `computeStateAt()` possibly internal-only | ✅ **Resolved** | ADR-003 | Engine/utils.ts | Internal-only export |
| DEAD-004 | `runAgentDef()` exposed publicly | ✅ **Resolved** | ADR-003 | Engine/provider.ts | Internal-only export |
| DEAD-005 | `makeInMemoryProviderRegistry()` in public API | ✅ **Resolved** | ADR-003 | Engine/provider.ts | Internal/testing-only export |
| DEAD-006 | `sseReconnectSchedule` in client exports | ✅ **Resolved** | ADR-003 | client/Reconnect.ts | Internal-only export |
| DEAD-007 | 8 Logger layers never used | Needs Investigation | — | Layers/Logger.ts:20-85 | ProdLoggerLayer, TestLoggerLayer, etc. |
| DEAD-008 | `loadWorkflowTape` never imported | Needs Investigation | — | server/programs/loadWorkflowTape.ts | Not re-exported from main index |
| DEAD-009 | Interaction utilities test-only | ✅ **Resolved** | ADR-002 | Domain/Interaction.ts | Delete — replaced by inline human on phase |
| DEAD-010 | 7 React hooks missing from react/index.ts | ✅ **Resolved** | ADR-013 | client/react/index.ts | New grouped hooks replace individual hooks |
| DEAD-011 | `usePendingInteraction(s)` completely untested | ✅ **Resolved** | ADR-002 | client/react/hooks.ts | Will be rewritten for new HITL payloads |
| DEAD-012 | `InMemoryProviderRecorder` possibly redundant | Needs Investigation | — | core test helpers | Alternative to makeInMemoryProviderRecorder |

### Test Coverage

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| TEST-001 | **CRITICAL**: SSE parsing has ZERO tests | Needs Investigation | — | client/src/SSE.ts | parseSSEMessage, createSSEStream completely untested |
| TEST-002 | **CRITICAL**: CLI has ZERO tests | Needs Investigation | — | apps/cli/src/**/* | 399 LoC, 15+ components, all untested |
| TEST-003 | **HIGH**: hashProviderRequest untested | Needs Investigation | — | core/Domain/Hash.ts | Recording hash determinism critical but not tested |
| TEST-004 | **HIGH**: OpenScaffold lifecycle untested | Needs Investigation | — | server/OpenScaffold.ts | initialize/dispose/resource cleanup not tested |
| TEST-005 | **HIGH**: loadWorkflow() dynamic import untested | Needs Investigation | — | cli/loader.ts | Executes arbitrary code with no safety tests |
| TEST-006 | **HIGH**: LibSQL layer only integration-tested | Needs Investigation | — | core/Layers/LibSQL.ts | Query building, migrations, edge cases untested |
| TEST-007 | HttpClient SSE integration uses mocked fetch | Needs Investigation | — | client/HttpClient.ts | Real streaming behavior not tested |
| TEST-008 | EventBusLive concurrency untested | Needs Investigation | — | server/services/EventBusLive.ts | Multiple subscribers, race conditions |
| TEST-009 | StateSnapshotStore corruption recovery untested | Needs Investigation | — | server/store/*.ts | No tests for corrupt state handling |
| TEST-010 | Route error handling only happy paths | Needs Investigation | — | server/http/Routes.ts | Database/provider failures not tested |
| TEST-011 | Provider recording error recovery untested | Needs Investigation | — | core/Engine/provider.ts | Only happy paths tested |
| TEST-012 | React hooks only test initial state | ✅ **Resolved** | ADR-013 | client/react/hooks.ts | React Query provides testing utilities; new hooks need fresh tests |
| TEST-013 | WorkflowProvider component untested | ✅ **Resolved** | ADR-013 | client/react/Provider.tsx | Replaced by WorkflowClientProvider; needs fresh tests |
| TEST-014 | mapStreamEventToInternal untested | Needs Investigation | — | core/Engine/provider.ts:132 | Event type mappings not directly tested |
| TEST-015 | No concurrent session tests anywhere | Needs Investigation | — | Multiple packages | Pause/resume/fork race conditions |
| TEST-016 | No end-to-end recording/playback test | Needs Investigation | — | core/server | Live → record → playback cycle not verified |

### Architecture

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| ARCH-001 | Three parallel observer patterns (fragmented) | ✅ **Resolved** | ADR-004 | WorkflowObserver, EventBus, EventStore | Single EventHub with PubSub, fiber subscribers |
| ARCH-002 | Service instantiation patterns inconsistent | Needs Investigation | — | — | MAJOR: different service setup |
| ARCH-003 | Inconsistent naming for execution functions | ✅ **Resolved** | ADR-001 | — | Single `run()` API |
| ARCH-004 | Too many internals exposed in core | ✅ **Resolved** | ADR-003 | core/index.ts | Move internals behind `/internal` entrypoint |
| ARCH-005 | 26 event types exported individually | ✅ **Resolved** | ADR-004 | Engine/types.ts | Single WorkflowEvent union with Data.TaggedClass |
| ARCH-006 | Provider infrastructure too public | ✅ **Resolved** | ADR-010 | Engine/provider.ts | ProviderRegistry deleted, runAgentDef internal |
| ARCH-021 | Provider ownership model misaligned with eval design | ✅ **Resolved** | ADR-010 | Engine/agent.ts, Engine/provider.ts | Agent owns provider directly. See [ADR-010](./010-provider-ownership-model.md) |
| ARCH-022 | `workflow.with()` not implemented | Needs Implementation | — | Engine/workflow.ts | Specified in eval-system-design.md. Required for variants. Depends on ADR-010. |
| ARCH-007 | RouteContext/RouteResponse types exported | ✅ **Resolved** | ADR-003 | server/http/Routes.ts | Internal-only exports |
| ARCH-008 | Convenience hooks vs context access redundancy | ✅ **Resolved** | ADR-013 | client/react/hooks.ts | Three-tier hook architecture eliminates redundancy |
| ARCH-009 | State exists in 4 places (divergence risk) | ✅ **Resolved** | ADR-006 | Multiple | Events are source of truth, state derived |
| ARCH-010 | ProviderRecorder has two competing APIs | ✅ **Resolved** | ADR-006 | Services/ProviderRecorder.ts | Incremental API is canonical |
| ARCH-011 | StateCache is orphaned (defined but never used) | ✅ **Resolved** | ADR-006 | Services/StateCache.ts | Wired to EventHub for reactive updates |
| ARCH-012 | HITL flow unclear (no visible continuation) | ✅ **Resolved** | ADR-002 | runtime.ts | Inline human on phase with clear flow |
| ARCH-013 | HTTP server reinvents routing (~300 LoC) | ✅ **Resolved** | ADR-009 | server/http/Server.ts | Migrate to `@effect/platform-node` HTTP server |
| ARCH-014 | Three store implementations scattered | Needs Investigation | — | Core/Layers, Server/store | Confusing which is official |
| ARCH-015 | Stream vs AsyncIterable (two async models) | Needs Investigation | — | core, client | Effect Stream + Web standard AsyncIterable |
| ARCH-016 | ProviderModeContext is ambient (spooky action) | Needs Investigation | — | FiberRef | Global state via FiberRef |
| ARCH-017 | Phase lifecycle under-specified | Needs Investigation | — | Engine/phase.ts | No guards, no recovery, no rollback |
| ARCH-018 | Event → State order inverted (not true sourcing) | ✅ **Resolved** | ADR-006 | runtime.ts | Events first, state derived |
| ARCH-019 | No event versioning strategy | ✅ **Resolved** | ADR-006 | — | Data.TaggedClass with _tag enables versioning |
| ARCH-020 | dispatchToObserver has 10+ switch cases | ✅ **Resolved** | ADR-004 | runtime.ts | Match.exhaustive replaces switch |

### Documentation

| ID | Issue | Status | Category | Files | Notes |
|----|-------|--------|----------|-------|-------|
| DOC-001 | No execution API decision matrix in docs | Needs Investigation | — | — | Users don't know which to use |
| DOC-002 | No internal vs public API documentation | Needs Investigation | — | — | Services/Layers need @internal markers |
| DOC-003 | Hook grouping/hierarchy undocumented | ✅ **Resolved** | ADR-013 | client/react/*.ts | Three-tier architecture documented in ADR-013 |
| DOC-004 | HITL flow undocumented | Needs Investigation | — | — | No diagram showing pause/resume/input |
| DOC-005 | State sourcing model undocumented | ✅ **Resolved** | ADR-006 | — | Fully documented in ADR-006 |
| DOC-006 | Phase semantics undocumented | Needs Investigation | — | — | When snapshots created, lifecycle unclear |

---

## Phase Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 0: Create Inventory | ✅ Complete | This document |
| 1: Public API Surface | ✅ Complete | 30 new issues found |
| 2: Type Safety Holes | ✅ Complete | 15 new issues found |
| 3: Dead Code | ✅ Complete | 6 new issues found |
| 4: Test Coverage | ✅ Complete | 16 new issues found |
| 5: Architectural Clarity | ✅ Complete | 15 new issues found |
| 6: Documentation vs Implementation | ⏭️ Skipped | Docs follow implementation; audit after decisions made |
| 7: Categorization & Canonical Definition | 🔄 In Progress | ADRs required for each decision area |
| 8: Implementation Planning | Not Started | — |
| 9: Execution | Not Started | — |

---

## Phase 1 Detailed Findings

### @open-scaffold/core (97 exports)
- **State-First API** (11 exports): ✅ Excellent - core builders are clean
- **Execution APIs** (13 exports): ⚠️ Confusing - 3 different APIs need guidance
- **Event Types** (26 exports): ⚠️ Too granular - consider discriminated unions
- **Provider Types** (5 exports): ✅ Good - necessary for custom providers
- **Provider Infrastructure** (7 exports): 🔴 Too public - should be internal
- **Interactions** (13 exports): ✅ Good - complete HITL support
- **IDs & Errors** (12 exports): ⚠️ Incomplete - missing some schemas
- **Internal/Advanced** (8 exports): 🔴 Unclear - needs @internal marking

### @open-scaffold/server
- **Core facade** (`OpenScaffold`): ✅ Clean Promise-based API
- **Route handlers**: 🔴 10 exported individually but should use `createServer()`
- **SSE utilities**: 🔴 Implementation details exposed
- **Config types**: ⚠️ 3 overlapping types need consolidation

### @open-scaffold/client
- **Contract & HTTP**: ✅ Clean abstraction
- **React hooks** (19): ✅ Comprehensive but some redundancy with context
- **react/index.ts barrel**: 🔴 Redundant - main index.ts exports all
- **SSE/Reconnect internals**: ⚠️ Exposed but advanced-only

### Package Structure
- ✅ **Confirmed correct**: core → server → cli, client ← core
- ✅ No circular dependencies
- ✅ Clear separation of concerns

---

## Phase 2 Detailed Findings: Type Safety

### @open-scaffold/core (24 violations)
- **HIGH** (1): Double cast in workflow.ts:226 (`as unknown as Record`)
- **MEDIUM** (23): ID brand casts, event payload casts, JSON parsing

### @open-scaffold/server (22 type assertions)
- **CRITICAL** (2): JSON.parse without validation (EventStoreLive, StateSnapshotStoreLive)
- **ACCEPTABLE** (20): Nominal type casts, intentional assertions

### @open-scaffold/client (3 violations)
- **MODERATE** (3): JSON.parse casts, event payload assumptions

### Root Cause Patterns
1. **Brand Type Boundary**: UUID strings need casting to branded types (SessionId, EventId)
2. **JSON Deserialization**: `JSON.parse()` returns unknown, needs runtime validation
3. **Generic Type Loss**: Generic `<S>` parameters lose type info at storage boundaries
4. **Event Payloads**: Discriminated unions accessed via unsafe casts vs type guards

### Recommendations
1. **CRITICAL**: Replace double cast in workflow.ts with proper type guards
2. **HIGH**: Add Effect Schema decoders at JSON deserialization points
3. **MEDIUM**: Use Zod or runtime validators for payload types

---

## Phase 3 Detailed Findings: Dead Code

### @open-scaffold/core
- **DEAD** (2): `streamWorkflow` stub, `WorkflowHandle` interface (both incomplete)
- **UNUSED** (8): All Logger layers (ProdLoggerLayer, TestLoggerLayer, etc.)
- **TEST-ONLY** (4): Interaction utilities (`createInteraction`, etc.)

### @open-scaffold/server
- **DEAD** (1): `loadWorkflowTape` program never imported
- **INTERNAL ONLY** (3): Pause/resume/fork routes (correctly not exported - healthy)

### @open-scaffold/client
- **INCOMPLETE** (1): `react/index.ts` missing 7 hooks + 1 type
- **UNTESTED** (3): `usePendingInteraction(s)` + `PendingInteraction` type

### Assessment
- **Code is generally clean** - minimal true dead code
- **Main issues are incomplete features** not broken code
- **Architectural gaps** in export consistency (client react barrel)

---

## Phase 4 Detailed Findings: Test Coverage

### Critical Gaps (HIGH RISK)

| Package | File | Issue | Risk |
|---------|------|-------|------|
| **client** | SSE.ts | Zero tests for SSE parsing - protocol errors silent | HIGH |
| **cli** | entire app | Zero tests for 399 LoC, 15+ components | HIGH |
| **core** | Hash.ts | hashProviderRequest determinism untested - breaks recording | HIGH |
| **server** | OpenScaffold.ts | Lifecycle/resource cleanup untested - memory leaks | HIGH |
| **cli** | loader.ts | Dynamic code execution with no error tests | HIGH |

### Medium Gaps (Error Paths)

| Package | File | Issue |
|---------|------|-------|
| **server** | Routes.ts | Only happy paths tested; DB/provider failures not tested |
| **client** | HttpClient.ts | Real SSE streaming not tested (mocked fetch) |
| **core** | provider.ts | Provider recording error recovery untested |
| **server** | EventBusLive.ts | Concurrent subscribers, race conditions untested |

### Integration Test Gaps

1. **No end-to-end recording/playback test**: Live → record → playback cycle never verified
2. **No concurrent session tests**: Multiple clients pause/resume/fork same session
3. **No HTTP server e2e tests**: Routes tested in isolation, no full stack
4. **No React component tree tests**: WorkflowProvider + hooks together

### Coverage by Package

| Package | Source LoC | Test LoC | Assessment |
|---------|------------|----------|------------|
| core | 10,675 | 7,705 | Good coverage, gaps in error paths |
| server | 650+ | 2,400+ | Good coverage, integration gaps |
| client | 400+ | 800+ | **Critical SSE gap** |
| cli | 399 | **0** | **Zero coverage** |

### Recommendations (Priority Order)

1. **IMMEDIATE**: Add tests for client/SSE.ts (parseSSEMessage, createSSEStream)
2. **IMMEDIATE**: Add e2e tests for CLI commands
3. **HIGH**: Test hashProviderRequest determinism
4. **HIGH**: Test OpenScaffold lifecycle (create → use → dispose)
5. **MEDIUM**: Add concurrent session tests
6. **MEDIUM**: Test error paths end-to-end

---

## Phase 5 Detailed Findings: Architecture

### Architectural Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CORE (@open-scaffold/core)               │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │ Domain Model │  │ Effect-Based Runtime               │   │
│  │ IDs, Errors  │  │ executeWorkflow → events + state   │   │
│  └──────────────┘  └────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Service Tags: EventStore, EventBus, ProviderRecorder│    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Public APIs: run(), execute(), streamWorkflow()     │    │
│  │ (Effect → Promise bridge)                           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ↓ imports                    ↓ imports
┌────────────────────┐        ┌───────────────────────────┐
│ SERVER             │        │ CLIENT                    │
│ HTTP + SSE         │ ←REST→ │ HttpClient + React hooks  │
│ Programs           │        │ AsyncIterable<Event>      │
│ Store (LibSQL)     │        │                           │
└────────────────────┘        └───────────────────────────┘
```

### Key Tensions Identified

| Tension | Description | Impact |
|---------|-------------|--------|
| **State in 4 places** | Ref, events, snapshots, client | Divergence risk |
| **Triple dispatch** | WorkflowObserver + EventBus + EventStore | Fragility, 3 places to update |
| **Stream vs AsyncIterable** | Effect Stream (core) + Web standard (client) | Two async models |
| **Event → State order** | Mutate THEN emit (not true sourcing) | Replay fragility |
| **HITL unclear** | onInputRequested not awaited | Deadlock risk |
| **HTTP reinvention** | ~300 LoC raw Node.js | Could use Hono |

### Positive Findings

- ✅ **Package layering correct**: core → server, client ← core
- ✅ **No circular dependencies**
- ✅ **Effect usage disciplined**: internal Effect, public Promise
- ✅ **Service isolation excellent**: Clean Layer composition
- ✅ **Event model solid**: Immer patches, causality tracking

### Quick Wins (Next 48 Hours)

1. Document HITL flow with diagram
2. Add test: `computeStateAt(all_events) === final_state`
3. Remove orphaned StateCache (or integrate it)
4. Deprecate ProviderRecorder.save()
5. Clarify phase semantics in architecture.md
