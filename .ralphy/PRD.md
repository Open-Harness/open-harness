# PRD: Open Harness Technical Debt Resolution

## Overview

Implement the architectural decisions documented in the ADRs to resolve the 31 remaining technical debt issues.

## Canonical Sources

All implementation decisions are documented in:
- **Technical Debt Inventory**: `docs/plans/adr/technical-debt-inventory.md`
- **ADR Directory**: `docs/plans/adr/`

### Accepted ADRs (Implementation Required)

| ADR | Title | Key Changes |
|-----|-------|-------------|
| [ADR-001](./docs/plans/adr/001-execution-api.md) | Execution API | Consolidate to single `run()` API |
| [ADR-002](./docs/plans/adr/002-hitl-architecture.md) | HITL Architecture | Inline human on phase, delete Interaction.ts |
| [ADR-003](./docs/plans/adr/003-public-vs-internal-exports.md) | Public vs Internal | Create `/internal` entrypoints |
| [ADR-004](./docs/plans/adr/004-event-observer-pattern.md) | Event/Observer | PubSub + Data.TaggedClass + Match.exhaustive |
| [ADR-005](./docs/plans/adr/005-type-safety-strategy.md) | Type Safety | Effect Schema at boundaries |
| [ADR-006](./docs/plans/adr/006-state-sourcing-model.md) | State Sourcing | Events → state derivation |
| [ADR-007](./docs/plans/adr/007-error-hierarchy.md) | Error Hierarchy | Unified error model |
| [ADR-008](./docs/plans/adr/008-naming-conventions.md) | Naming | Short field names |
| [ADR-009](./docs/plans/adr/009-config-consolidation.md) | Config | Nested config, single server path |
| [ADR-010](./docs/plans/adr/010-provider-ownership-model.md) | Provider Ownership | Agent embeds provider |
| [ADR-013](./docs/plans/adr/013-react-hooks-architecture.md) | React Hooks | Three-tier with React Query |

### Proposed ADRs (Need Acceptance)

| ADR | Title | Blocks |
|-----|-------|--------|
| [ADR-011](./docs/plans/adr/011-service-instantiation-pattern.md) | Service Instantiation | ARCH-002 |
| [ADR-012](./docs/plans/adr/012-phase-lifecycle-specification.md) | Phase Lifecycle | ARCH-017, DOC-006 |

## Remaining Issues (31 Total)

### Architecture Issues (6)

| ID | Issue | Blocked By |
|----|-------|------------|
| ARCH-002 | Service instantiation patterns inconsistent | ADR-011 (proposed) |
| ARCH-014 | Three store implementations scattered | — |
| ARCH-015 | Stream vs AsyncIterable (two async models) | — |
| ARCH-016 | ProviderModeContext is ambient | — |
| ARCH-017 | Phase lifecycle under-specified | ADR-012 (proposed) |
| ARCH-022 | `workflow.with()` not implemented | ADR-010 |

### Test Coverage Issues (14)

| ID | Issue | Priority |
|----|-------|----------|
| TEST-001 | SSE parsing has ZERO tests | CRITICAL |
| TEST-002 | CLI has ZERO tests | CRITICAL |
| TEST-003 | hashProviderRequest untested | HIGH |
| TEST-004 | OpenScaffold lifecycle untested | HIGH |
| TEST-005 | loadWorkflow() dynamic import untested | HIGH |
| TEST-006 | LibSQL layer only integration-tested | HIGH |
| TEST-007 | HttpClient SSE integration uses mocked fetch | — |
| TEST-008 | EventBusLive concurrency untested | — |
| TEST-009 | StateSnapshotStore corruption recovery untested | — |
| TEST-010 | Route error handling only happy paths | — |
| TEST-011 | Provider recording error recovery untested | — |
| TEST-014 | mapStreamEventToInternal untested | — |
| TEST-015 | No concurrent session tests anywhere | — |
| TEST-016 | No end-to-end recording/playback test | — |

### Documentation Issues (4)

| ID | Issue |
|----|-------|
| DOC-001 | No execution API decision matrix in docs |
| DOC-002 | No internal vs public API documentation |
| DOC-004 | HITL flow undocumented |
| DOC-006 | Phase semantics undocumented |

### Dead Code Issues (3)

| ID | Issue |
|----|-------|
| DEAD-007 | 8 Logger layers never used |
| DEAD-008 | `loadWorkflowTape` never imported |
| DEAD-012 | `InMemoryProviderRecorder` possibly redundant |

### Type Safety Issues (3)

| ID | Issue | Status |
|----|-------|--------|
| TYPE-002 | StateSnapshot exported from multiple places | Open |
| TYPE-007 | StateSnapshot state cast on retrieval | Verify with ADR-006 |
| TYPE-008 | Zod schema cast loses type info | Accepted (by design) |

### API Issues (1)

| ID | Issue |
|----|-------|
| API-012 | ID schemas incomplete (AgentIdSchema, EventIdSchema) |

## Implementation Phases

### Phase 1: Core Event System (ADR-004)
- Implement Data.TaggedClass events
- Create EventHub with PubSub
- Implement Match.exhaustive dispatch
- Wire fiber-based subscribers

### Phase 2: State Sourcing (ADR-006)
- Implement SubscriptionRef projection
- Create StateCache with snapshots
- Wire to EventHub for reactive updates
- Replace `computeStateAt` with `deriveState`

### Phase 3: Type Safety (ADR-005)
- Add Effect Schema for IDs
- Add store schemas (StoredEvent, StateCheckpoint)
- Add API response schemas in HttpClient
- Remove unsafe casts

### Phase 4: API Consolidation (ADR-001, ADR-003)
- Consolidate to single `run()` API
- Create `/internal` entrypoints
- Move route handlers to internal
- Update exports

### Phase 5: HITL & Provider (ADR-002, ADR-010)
- Implement inline human on phase
- Delete Domain/Interaction.ts
- Embed provider in agent
- Delete ProviderRegistry

### Phase 6: React Hooks (ADR-013)
- Implement React Query integration
- Create three-tier hook structure
- Wire SSE to cache updates
- Replace WorkflowProvider

### Phase 7: Test Coverage
- SSE parsing tests (TEST-001)
- CLI tests (TEST-002)
- hashProviderRequest tests (TEST-003)
- Recording/playback e2e test (TEST-016)

### Phase 8: Cleanup
- Delete unused Logger layers (DEAD-007)
- Export loadWorkflowTape (DEAD-008)
- Resolve InMemoryProviderRecorder (DEAD-012)
- Export missing ID schemas (API-012)

## Constraints

Per `CLAUDE.md`:

1. **No mocks**: Use real implementations with `:memory:` databases
2. **No API key checks**: Subscription handles auth
3. **Use ProviderRecorder**: For all provider testing
4. **No build artifacts in src/**: Use `pnpm build` → `dist/`

## Success Criteria

- [ ] All 65 resolved issues verified as implemented
- [ ] All 31 remaining issues addressed or documented as accepted
- [ ] TypeScript compiles with strict mode
- [ ] All tests pass with real implementations
- [ ] Constitution validation passes (no MUST violations)
