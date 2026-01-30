# Comprehensive Codebase Audit

**Date:** 2026-01-30
**Purpose:** Full audit of all issues, inconsistencies, dead code, and violations prior to cleanup

> **CRITICAL CONTEXT:** This project has **ZERO external users**. All "backwards compatibility" and "legacy" code is unnecessary and should be removed.

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Dead Code (functions/files) | 7 | MEDIUM |
| Duplicated Logic | 12 | HIGH |
| Legacy/Backwards Compat Code | 17 | HIGH |
| Naming Inconsistencies | 35+ | HIGH |
| Constitution Violations | 8 | CRITICAL |
| ADR Violations | 7 | HIGH |
| Documentation Drift | 10+ | MEDIUM |

---

## 1. DEAD CODE

### 1.1 Unused Exported Functions

| Function | File | Evidence |
|----------|------|----------|
| `deriveStateOptimized` | `packages/core/src/Engine/utils.ts:138` | Exported but never called anywhere |
| `makeStoreSubscriber` | `packages/core/src/Engine/subscribers.ts:87` | Comment says "NOT used here" |
| `makeBusSubscriber` | `packages/core/src/Engine/subscribers.ts:130` | Comment says "NOT used here" |
| `makeObserverSubscriber` | `packages/core/src/Engine/subscribers.ts:164` | Commented-out import at `runtime.ts:40` |

### 1.2 Orphaned Files

| File | Issue |
|------|-------|
| `packages/core/src/Domain/index.ts` | Never imported - main index imports directly from submodules |

### 1.3 Duplicate Definitions

| Item | Location 1 | Location 2 | Location 3 |
|------|-----------|-----------|-----------|
| `EventIdSchema` | `Engine/types.ts:46` | `Domain/Ids.ts:69` | - |
| `makeEventId` | `Engine/types.ts:56` | `Domain/Ids.ts:84` | `Domain/Events.ts:267` (named `generateEventId`) |
| `UUID_PATTERN` | `Engine/types.ts:43` | `Domain/Ids.ts:20` | - |
| `EventId` type | `Engine/types.ts` (Schema) | `Domain/Ids.ts` (Schema) | `Domain/Events.ts:261` (branded string) |

### 1.4 Commented-Out Code

| Location | Code |
|----------|------|
| `packages/core/src/Engine/runtime.ts:39-40` | `// import { makeBusSubscriber, makeObserverSubscriber, makeStoreSubscriber } from "./subscribers.js"` |

---

## 2. DUPLICATED LOGIC

### 2.1 Multiple `toSerializedEvent` Functions (3 copies)

| Location | Differences |
|----------|-------------|
| `packages/core/src/Engine/dispatch.ts:258-307` | Has legacy payload transformation |
| `packages/core/src/Engine/subscribers.ts:56-64` | Minimal, passes payload as-is |
| `packages/core/src/Domain/Events.ts:335-348` | Canonical, exported, supports causedBy |

**Root cause:** No single serialization path. Each file created its own.

### 2.2 Multiple Event Name Mappings (4 copies)

| Location | Key Differences |
|----------|-----------------|
| `dispatch.ts:260-276` | Uses `"state:updated"` for both StateIntent/StateCheckpoint |
| `runtime.ts:161-177` | Uses `EVENTS.*` constants |
| `subscribers.ts:34-50` | Uses `"state:updated"` for both |
| `Domain/Events.ts:295-311` | **CANONICAL** - uses `"state:intent"`, `"state:checkpoint"`, `"session:forked"` |

**CRITICAL:** Domain/Events.ts has correct names per ADR-004, but other files use wrong names.

### 2.3 Payload Transformation Logic (2 copies)

| Location | Same code |
|----------|-----------|
| `dispatch.ts:279-299` | StateIntent, InputRequested, InputReceived transformations |
| `runtime.ts:181-202` | Identical transformations |

### 2.4 Direct `crypto.randomUUID()` Calls (8 locations)

Should use `makeEventId()` or `generateEventId()` helpers:
- `dispatch.ts:302`
- `runtime.ts:205, 301, 560, 866`
- `execute.ts:218`
- `run.ts:215`
- `Subscribers.ts:59`

---

## 3. LEGACY/BACKWARDS COMPATIBILITY CODE (ALL UNNECESSARY)

### 3.1 Legacy Event Serialization

| Item | Location | Purpose | Needed? |
|------|----------|---------|---------|
| `workflowEventToLegacy()` | `runtime.ts:159-210` | Convert new events to old format | **NO** |
| `toSerializedEvent()` | `dispatch.ts:258-307` | Same as above | **NO** |
| `legacyEventToWorkflowEvent()` | `runtime.ts:399-450` | Convert old to new | **NO** |

### 3.2 Legacy Field Names in Serialization

| Old Name | New Name | Locations |
|----------|----------|-----------|
| `promptText` | `prompt` | `runtime.ts:192`, `dispatch.ts:290` |
| `inputType` | `type` | `runtime.ts:193`, `dispatch.ts:291` |
| `response` | `value` | `dispatch.ts:297` |

### 3.3 Dual-Format Event Support

| File | Issue |
|------|-------|
| `utils.ts:53-180` | `deriveState` accepts both `WorkflowEvent` and `AnyEvent` formats |
| Comment says | "backward compatibility during the migration period" |

### 3.4 Legacy Provider Map

| Location | Code |
|----------|------|
| `OpenScaffold.ts:49-52` | `readonly providers?: Record<string, AgentProvider>` |
| `Server.ts:240-248` | Same - "kept for backward compatibility" |

### 3.5 Legacy React Provider

| Location | Code |
|----------|------|
| `client/src/react/index.ts:18-22` | Exports old `WorkflowProvider` for "backwards compatibility" |

### 3.6 Database Migration Code

| Location | Code |
|----------|------|
| `Migrations.ts:125-180` | `ALTER TABLE agent_fixtures RENAME TO provider_recordings` |

### 3.7 Deprecated API

| Location | Code |
|----------|------|
| `ProviderRecorder.ts:61-63` | `@deprecated save()` method |

### 3.8 State Field for Observer Compatibility

| Location | Issue |
|----------|-------|
| `Domain/Events.ts:98` | StateIntent includes full `state` field "for backward compatibility with observer.onStateChanged" |

---

## 4. NAMING INCONSISTENCIES

### 4.1 Field Names Using Old Convention

| Old Name | Correct Name | Locations (count) |
|----------|--------------|-------------------|
| `workflowName` | `workflow` | 19 locations across types.ts, tests, CLI |
| `promptText` | `prompt` | 6 locations |
| `inputType` | `type` | 6 locations |
| `response` | `value` | 2 locations |
| `agentName` | `agent` | 5 test locations |

### 4.2 Event Name Conflicts

| Issue | Locations |
|-------|-----------|
| `InputReceived` → `"input:response"` (wrong) | `dispatch.ts`, `runtime.ts`, `subscribers.ts` |
| `InputReceived` → `"input:received"` (correct) | `Domain/Events.ts` |
| `StateIntent` → `"state:updated"` (wrong) | `dispatch.ts`, `runtime.ts`, `subscribers.ts` |
| `StateIntent` → `"state:intent"` (correct) | `Domain/Events.ts` |
| `StateCheckpoint` → `"state:updated"` (wrong) | Same files |
| `StateCheckpoint` → `"state:checkpoint"` (correct) | `Domain/Events.ts` |
| `SessionForked` → `"workflow:started"` (wrong) | Same files |
| `SessionForked` → `"session:forked"` (correct) | `Domain/Events.ts` |

### 4.3 Type Names with `Use` Prefix (ADR-008 violation)

| Wrong | Correct | Location |
|-------|---------|----------|
| `UseFilteredEventsOptions` | `FilteredEventsOptions` | `client/hooks.ts:174` |
| `UseStateAtResult<S>` | `StateAtResult<S>` | `client/hooks.ts:205` |

---

## 5. CONSTITUTION VIOLATIONS

### MUST-002: No Mocks or Stubs

| Location | Violation |
|----------|-----------|
| `packages/core/src/Layers/InMemory.ts` | Entire file is Map-based fake implementations |
| `InMemoryEventStore` | Uses `Map<string, AnyEvent[]>` instead of LibSQL `:memory:` |
| `InMemoryEventBus` | Noop implementation: `publish: () => Effect.void` |
| `InMemoryProviderRecorder` | Uses `Map` instead of LibSQL `:memory:` |

### MUST-006: Effect Schema at Boundaries

| Location | Violation |
|----------|-----------|
| `Layers/LibSQL.ts:71` | `JSON.parse(row.payload) as unknown` - no schema |
| `ProviderRecorderLive.ts:64` | `JSON.parse(row.response) as AgentRunResult` |
| `ProviderRecorderLive.ts:66` | `JSON.parse(row.stream_transcript) as ReadonlyArray<AgentStreamEvent>` |
| `ProviderRecorderLive.ts:144` | `JSON.parse(row.event_data) as AgentStreamEvent` |
| `ProviderRecorderLive.ts:145` | `JSON.parse(session.response) as AgentRunResult` |
| `subscription.ts:74` | `JSON.parse(e.data) as SSEEvent` |

### SHOULD-006: Consistent Naming

See Section 4 above - 35+ violations of ADR-008 naming conventions.

---

## 6. ADR VIOLATIONS

### ADR-002: HITL Architecture

| Violation | Location |
|-----------|----------|
| `"freeform"` type still exists | `hitl-integration.test.ts:142`, `core/README.md:115,152` |
| ADR says only `"approval" \| "choice"` | Multiple documentation files still mention freeform |

### ADR-003: Public vs Internal Exports

| Violation | Location |
|-----------|----------|
| `Services` exported from main `index.ts` | `packages/core/src/index.ts:147` |
| `Layers` exported from main `index.ts` | `packages/core/src/index.ts:153` |

### ADR-007: Error Hierarchy

| Violation | Location |
|-----------|----------|
| Old `Workflow*` errors still exported | `index.ts:91-97` - `WorkflowAbortedError`, `WorkflowAgentError`, etc. |
| Should be renamed | `WorkflowPhaseError` → `PhaseError`, etc. |

### ADR-008: Naming Conventions

See Section 4 - widespread violations of naming conventions.

---

## 7. DOCUMENTATION DRIFT

### Files Mentioning Deleted/Changed Concepts

| File | Issue |
|------|-------|
| `docs/architecture.md:102,472-477` | Still documents `ProviderRegistry` |
| `packages/core/README.md:115,152` | Documents `"freeform"` type |
| `docs/building-workflows.md:557` | Mentions freeform |
| `docs/api/hitl.md:50` | Mentions freeform |
| Multiple test files | Comments reference `ProviderRegistry` |

### Comment Noise

Many files have comments like:
- "Per ADR-010, ProviderRegistry is no longer needed"
- "Note: Per ADR-010..."

These comments can be removed once the code is clean.

---

## 8. SPECIFIC FILE ISSUES

### `packages/core/src/Engine/types.ts`

| Line | Issue |
|------|-------|
| 162 | `workflowName` should be `workflow` |
| 247 | `response` should be `value` in `InputResponsePayload` |

### `packages/core/src/Engine/runtime.ts`

| Line | Issue |
|------|-------|
| 39-40 | Commented-out import |
| 138-210 | Entire `workflowEventToLegacy` function is unnecessary |
| 181-202 | Legacy payload transformation |
| 396-450 | Entire `legacyEventToWorkflowEvent` function is unnecessary |
| 594, 822 | Comments about "execute.ts compatibility" |

### `packages/core/src/Engine/dispatch.ts`

| Line | Issue |
|------|-------|
| 258-307 | Entire `toSerializedEvent` function duplicates Domain/Events.ts |
| 267-268 | Wrong event names for StateIntent/StateCheckpoint |
| 279-299 | Legacy payload transformation (duplicate of runtime.ts) |

### `packages/core/src/Engine/subscribers.ts`

| Line | Issue |
|------|-------|
| 34-50 | Duplicate event name mapping |
| 56-64 | Duplicate `toSerializedEvent` |
| 87-164 | Three unused subscriber functions |

### `packages/core/src/Layers/InMemory.ts`

| Line | Issue |
|------|-------|
| ALL | Entire file violates MUST-002 (no mocks/stubs) |

---

## 9. REMEDIATION PLAN

### Phase 1: Remove All Legacy Code

1. Delete `workflowEventToLegacy()` from `runtime.ts`
2. Delete `legacyEventToWorkflowEvent()` from `runtime.ts`
3. Delete `toSerializedEvent()` from `dispatch.ts` and `subscribers.ts`
4. Delete duplicate event name mappings (keep only `Domain/Events.ts`)
5. Delete `InMemory.ts` entirely - use LibSQL `:memory:` everywhere
6. Delete legacy `providers` map from `OpenScaffold.ts` and `Server.ts`
7. Delete database migration code for `agent_fixtures`
8. Delete deprecated `save()` method from `ProviderRecorder`

### Phase 2: Fix Naming Everywhere

1. Replace `workflowName` → `workflow` (19 locations)
2. Replace `promptText` → `prompt` (6 locations)
3. Replace `inputType` → `type` (6 locations)
4. Replace `response` → `value` (2 locations)
5. Replace `agentName` → `agent` (5 locations)
6. Fix event names: `input:response` → `input:received`, etc.
7. Fix type names: `UseFilteredEventsOptions` → `FilteredEventsOptions`

### Phase 3: Fix Constitution Violations

1. Add Effect Schema validation at all JSON.parse boundaries
2. Remove `InMemory.ts` (use real implementations with `:memory:`)

### Phase 4: Fix ADR Violations

1. Move `Services` and `Layers` to `/internal` only (ADR-003)
2. Rename error classes per ADR-007
3. Remove `"freeform"` from all documentation and tests

### Phase 5: Consolidate Duplicates

1. Use single `toSerializedEvent` from `Domain/Events.ts`
2. Use single `tagToEventName` from `Domain/Events.ts`
3. Use single `EventId` definition
4. Consolidate all `makeEventId`/`generateEventId` to one function

### Phase 6: Cleanup

1. Remove commented-out code
2. Remove explanatory comments about removed ProviderRegistry
3. Update documentation to remove freeform references
4. Delete `Domain/index.ts` (orphaned file)
5. Delete dead subscriber functions

---

## 10. FILES REQUIRING CHANGES

| File | Changes Needed |
|------|----------------|
| `packages/core/src/Engine/runtime.ts` | Delete legacy functions, fix naming |
| `packages/core/src/Engine/dispatch.ts` | Delete duplicate functions, use Events.ts |
| `packages/core/src/Engine/subscribers.ts` | Delete dead code, fix mappings |
| `packages/core/src/Engine/types.ts` | Fix `workflowName`, `response` |
| `packages/core/src/Engine/utils.ts` | Remove dual-format support |
| `packages/core/src/Layers/InMemory.ts` | DELETE entire file |
| `packages/core/src/Layers/LibSQL.ts` | Add schema validation |
| `packages/core/src/Domain/Events.ts` | This is canonical - keep |
| `packages/core/src/Domain/Ids.ts` | Consolidate or delete duplicates |
| `packages/core/src/Domain/index.ts` | DELETE (orphaned) |
| `packages/core/src/index.ts` | Move Services/Layers to internal |
| `packages/core/test/*.ts` | Fix naming, remove freeform |
| `packages/server/src/OpenScaffold.ts` | Delete providers map |
| `packages/server/src/http/Server.ts` | Delete providers map |
| `packages/server/src/store/*.ts` | Add schema validation |
| `packages/server/test/*.ts` | Fix naming |
| `packages/client/src/react/*.ts` | Fix type names, naming |
| `packages/client/test/*.ts` | Fix agentName |
| `apps/cli/**/*.ts` | Fix workflowName |
| `docs/**/*.md` | Remove freeform, ProviderRegistry refs |

---

## Appendix: Quick Reference

### What to DELETE

- `workflowEventToLegacy()` function
- `legacyEventToWorkflowEvent()` function
- `toSerializedEvent()` in dispatch.ts and subscribers.ts
- Event name mappings in dispatch.ts, runtime.ts, subscribers.ts
- `InMemory.ts` entire file
- `Domain/index.ts` file
- Deprecated `save()` method
- Legacy `providers` map
- Database migration code
- Commented-out imports
- All "ProviderRegistry is no longer needed" comments

### What to RENAME

| From | To |
|------|----|
| `workflowName` | `workflow` |
| `promptText` | `prompt` |
| `inputType` | `type` |
| `response` | `value` |
| `agentName` | `agent` |
| `input:response` | `input:received` |
| `state:updated` | `state:intent` / `state:checkpoint` |
| `UseFilteredEventsOptions` | `FilteredEventsOptions` |

### What to ADD

- Effect Schema validation at all JSON.parse boundaries
- Single canonical serialization path through `Domain/Events.ts`
