# Unified Cleanup PRD: ADR Convergence & Codebase Consolidation

**Date:** 2026-01-30
**Status:** Draft
**Context:** Combines insights from `comprehensive-codebase-audit.md` and `adr-convergence-audit-report.md`

> **CRITICAL CONTEXT:** This project has **ZERO external users**. All "backwards compatibility" and "legacy" code is unnecessary and should be removed.

---

## Executive Summary

The codebase has accumulated technical debt from an incomplete migration. The ADRs define a canonical event system (`Domain/Events.ts`), but the runtime still converts everything to legacy formats before storage/transmission. This creates:

- **4 duplicate serializers** with conflicting event name mappings
- **3 incompatible HITL schema generations** (correlation IDs get dropped)
- **Map-based mocks** that violate MUST-002
- **35+ naming inconsistencies** violating ADR-008
- **State derivation pinned to legacy** event names

The fix is conceptually simple: **delete all legacy conversion code and use `Domain/Events.ts` as the single source of truth**.

---

## 0. CRITICAL GAPS (Must Address for Zero Legacy)

These items are **often overlooked** but will leave legacy artifacts if not addressed:

### 0.1 Public API Returns Legacy Format

```typescript
// types.ts:329-340
export interface WorkflowResult<S> {
  readonly events: ReadonlyArray<AnyEvent>  // ← PUBLIC API IS AnyEvent!
}

// runtime.ts:993-995
const allEvents = allWorkflowEvents.map(workflowEventToLegacy)  // ← Converts to legacy
```

**Impact:** All callers expect `AnyEvent[]`. Must change to `SerializedEvent[]` or `WorkflowEvent[]`.

### 0.2 StateIntent Has Backwards-Compat Field

```typescript
// Domain/Events.ts:96-99
export class StateIntent extends Data.TaggedClass("StateIntent")<{
  /** The new state after applying patches (for observer compatibility) */
  readonly state: unknown  // ← LEGACY FIELD IN CANONICAL EVENT
}>
```

**Decision needed:** Remove this field or keep it? If observers need state, they should derive from patches.

### 0.3 EVENTS Constant Has Legacy Names

```typescript
// types.ts:85-97
export const EVENTS = {
  STATE_UPDATED: "state:updated",     // ← Wrong (should be state:intent/checkpoint)
  INPUT_RESPONSE: "input:response"    // ← Wrong (should be input:received)
} as const
```

**Action:** Delete or update this constant. It's used by `workflowEventToLegacy`.

### 0.4 execute.ts Imports InMemory (Blocks Deletion)

```typescript
// execute.ts:16
import { InMemoryEventBus } from "../Layers/InMemory.js"
```

**Action:** Update `execute.ts` to use real implementations before deleting `InMemory.ts`.

### 0.5 Duplicate EventId Definitions

| Location | Defines |
|----------|---------|
| `types.ts:46-56` | `EventIdSchema`, `makeEventId`, `parseEventId` |
| `Domain/Ids.ts` | `EventId`, `makeEventId`, `SessionId`, etc. |

**Action:** Consolidate to one location (probably `Domain/Ids.ts`).

### 0.6 ProviderRecorderLive Has Legacy Table Lookup

```typescript
// ProviderRecorderLive.ts:111
// First check legacy provider_recordings table
```

**Action:** Remove dual-table lookup. Use only new table structure.

### 0.7 runAgentDef Returns Legacy AnyEvent Format

```typescript
// runtime.ts:360-377
// Note: runAgentDef returns legacy AnyEvent format, we convert and publish via EventHub
for (const legacyEvent of result.events) {
  const workflowEvent = legacyEventToWorkflowEvent(legacyEvent, agent.name)
```

**Action:** Update `runAgentDef` to return `WorkflowEvent[]` directly, or keep the conversion as a bridge (document explicitly).

### 0.8 Tests Lock In Legacy Format

```typescript
// hitl.test.ts:8-11
* NOTE: Event payloads use LEGACY wire format (promptText, inputType, response)
* produced by workflowEventToLegacy() for backwards compatibility with storage
```

**Action:** Tests must be **rewritten**, not just updated. They currently enforce legacy behavior.

### 0.9 Wire Timestamp + SSE Transport Are Currently Incompatible

Today there are *multiple* assumptions about the SSE/wire event shape:

- Server SSE currently does `JSON.stringify(AnyEvent)` which turns `Date` into an **ISO string**.
- `client/src/HttpClient.ts` validates SSE timestamps as **DateFromString**.
- `client/src/react/primitives/subscription.ts` assumes SSE timestamps are **number** (ms) and that state events are `state:intent/state:checkpoint`.

**Action:** The cleanup must explicitly choose and enforce a **single wire event shape** (including timestamp encoding) across server SSE, EventStore, and all client ingestion paths.

### 0.10 Legacy React Client Surface Still Exists

Even if HITL schemas are fixed, the codebase will still contain legacy UI surface unless removed:

- `packages/client/src/react/Provider.tsx` (legacy Provider)
- `packages/client/src/react/hooks.ts` (legacy mega-hooks + legacy HITL parsing)
- legacy exports from `packages/client/src/react/index.ts`

**Action:** Delete these files/exports (since there are no external users) and leave only the ADR-013 hooks architecture.

### 0.11 “No Warnings” Includes Toolchain Warnings

`bun run typecheck` currently emits a Turborepo warning about parsing `bun.lock`.

**Action:** Add a task to eliminate all toolchain warnings so CI/local runs are truly clean.

---

## 1. What The System Actually Does Today

### Event Flow (Observed)

```
WorkflowEvent (Domain/Events.ts)
    │
    ├─► runtime.ts: workflowEventToLegacy()
    │       ├─► Changes event names (state:intent → state:updated)
    │       ├─► Changes field names (prompt → promptText, value → response)
    │       ├─► DROPS correlation ID from HITL events
    │       └─► Outputs AnyEvent with Date timestamp
    │
    ├─► dispatch.ts: toSerializedEvent()  [DUPLICATE]
    │       └─► Same transformations, different file
    │
    └─► subscribers.ts: toSerializedEvent()  [DUPLICATE]
            └─► Same transformations, different file
```

### Wire Format Actually Sent

| Domain Event | Domain Name | Wire Name (Actual) | Lost Information |
|--------------|-------------|-------------------|------------------|
| `StateIntent` | `state:intent` | `state:updated` | Intent vs Checkpoint distinction |
| `StateCheckpoint` | `state:checkpoint` | `state:updated` | Intent vs Checkpoint distinction |
| `SessionForked` | `session:forked` | `workflow:started` | Fork lineage |
| `InputReceived` | `input:received` | `input:response` | Consistency |
| `InputRequested` | payload: `{id, prompt, type}` | `{promptText, inputType}` | Correlation ID |
| `InputReceived` | payload: `{id, value, approved}` | `{response}` | Correlation ID, approval flag |

### HITL Schema Generations

| Generation | Location | Schema | Status |
|------------|----------|--------|--------|
| 1 (Canonical) | `Domain/Events.ts` | `{id, prompt, type}` / `{id, value, approved}` | Defined but unused |
| 2 (Wire) | `runtime.ts`, `dispatch.ts` | `{promptText, inputType}` / `{response}` | Actually sent |
| 3 (Client) | `client/hooks.ts` | `{interactionId, agent, prompt}` | Expected by hooks |

**Result:** Client hooks will never match wire format. HITL UIs are broken.

---

## 2. Issue Inventory

### 2.1 Duplicate Serializers (4 copies)

| File | Function | Event Names | Payload Transform | Status |
|------|----------|-------------|-------------------|--------|
| `Domain/Events.ts:335` | `toSerializedEvent` | ✅ Correct (`state:intent`, etc.) | ✅ None | **CANONICAL** |
| `runtime.ts:159` | `workflowEventToLegacy` | ❌ Legacy (`state:updated`) | ❌ Legacy fields | DELETE |
| `dispatch.ts:258` | `toSerializedEvent` | ❌ Legacy | ❌ Legacy fields | DELETE |
| `subscribers.ts:56` | `toSerializedEvent` | ❌ Legacy | ❌ None | DELETE |

**Action:** Delete all except `Domain/Events.ts`. Update all callers to import from Domain.

### 2.2 Duplicate Event Name Mappings (4 copies)

| File | Variable | Conflicts |
|------|----------|-----------|
| `Domain/Events.ts:295` | `tagToEventName` | ✅ Canonical |
| `runtime.ts:161` | `nameMap` (inline) | ❌ Uses `EVENTS.*` constants |
| `dispatch.ts:260` | `nameMap` (inline) | ❌ Hardcoded strings |
| `subscribers.ts:34` | `tagToEventName` | ❌ Hardcoded strings |

**Action:** Delete all except `Domain/Events.ts`. Export and reuse.

### 2.3 Legacy Payload Transformations (2 copies)

Both `runtime.ts:181-202` and `dispatch.ts:279-299` contain identical code:

```typescript
if (_tag === "InputRequested") {
  finalPayload = {
    promptText: reqPayload.prompt,
    inputType: reqPayload.type,
  }
} else if (_tag === "InputReceived") {
  finalPayload = {
    response: recPayload.value
  }
}
```

**Action:** Delete entirely. Pass payload through unchanged.

### 2.4 HITL Schema Mismatch

| Component | Expected Format | Status |
|-----------|-----------------|--------|
| `Domain/Events.ts` | `{id, prompt, type}` | ✅ Correct |
| Wire (after conversion) | `{promptText, inputType}` | ❌ Legacy |
| `client/hooks.ts` | `{interactionId, agent, prompt}` | ❌ Different |
| Server tests | `{promptText, inputType}` | ❌ Validates legacy |

**Action:**
1. Delete legacy conversion
2. Update client hooks to expect `{id, prompt, type}`
3. Update tests to validate canonical format

### 2.5 InMemory.ts Violates MUST-002

| Layer | Implementation | Violation |
|-------|----------------|-----------|
| `InMemoryEventStore` | `Map<string, AnyEvent[]>` | Should use LibSQL `:memory:` |
| `InMemoryEventBus` | `publish: () => Effect.void` | Noop - hides integration bugs |
| `InMemoryProviderRecorder` | `Map<string, RecordingEntry>` | Should use LibSQL `:memory:` |

**Action:** Delete `InMemory.ts` entirely. Use real implementations with `:memory:` in tests.

### 2.6 Naming Inconsistencies (35+ violations)

| Old Name | Correct Name | Locations | ADR |
|----------|--------------|-----------|-----|
| `workflowName` | `workflow` | 19 | ADR-008 |
| `promptText` | `prompt` | 6 | ADR-008 |
| `inputType` | `type` | 6 | ADR-008 |
| `response` | `value` | 2 | ADR-008 |
| `agentName` | `agent` | 5 (tests) | ADR-008 |
| `UseFilteredEventsOptions` | `FilteredEventsOptions` | 1 | ADR-008 |
| `UseStateAtResult` | `StateAtResult` | 1 | ADR-008 |

**Action:** Global find/replace with verification.

### 2.7 State Derivation Depends on Legacy Names

| Function | Looks For | Status |
|----------|-----------|--------|
| `computeStateAt` | `"state:updated"` | ❌ Legacy |
| `deriveState` | Both `WorkflowEvent` and `AnyEvent` | ❌ Dual-format |
| Server routes | Call `computeStateAt` | ❌ Depends on legacy |

**Action:** Update to look for `"state:intent"` and `"state:checkpoint"`.

### 2.8 Dead Code

| Item | Location | Action |
|------|----------|--------|
| `deriveStateOptimized` | `utils.ts:138` | DELETE (unused) |
| `makeStoreSubscriber` | `subscribers.ts:87` | DELETE (runtime bypasses) |
| `makeBusSubscriber` | `subscribers.ts:130` | DELETE (runtime bypasses) |
| `makeObserverSubscriber` | `subscribers.ts:164` | DELETE (runtime bypasses) |
| `Domain/index.ts` | `Domain/index.ts` | DELETE (orphaned) |
| Commented imports | `runtime.ts:39-40` | DELETE |

### 2.9 Constitution Violations

| Rule | Violation | Location | Action |
|------|-----------|----------|--------|
| MUST-002 | Map-based mocks | `InMemory.ts` | DELETE file |
| MUST-006 | `JSON.parse` without schema | `LibSQL.ts:71`, `ProviderRecorderLive.ts:64,66,144,145`, `subscription.ts:74` | Add Effect Schema |

### 2.10 ADR Violations

| ADR | Violation | Location | Action |
|-----|-----------|----------|--------|
| ADR-002 | `"freeform"` type exists | Tests, docs | DELETE |
| ADR-003 | `Services`/`Layers` exported from main | `index.ts` | Move to `/internal` |
| ADR-007 | `Workflow*` error names | `index.ts` | Rename to `Phase*` etc. |
| ADR-008 | Naming conventions | 35+ locations | See 2.6 |

### 2.11 Documentation Drift

| File | Issue | Action |
|------|-------|--------|
| `docs/architecture.md` | Documents `ProviderRegistry` | UPDATE |
| `packages/core/README.md` | Documents `"freeform"` | UPDATE |
| `docs/building-workflows.md` | Mentions freeform | UPDATE |
| `docs/api/hitl.md` | Mentions freeform | UPDATE |
| Multiple files | "Per ADR-010..." comments | DELETE |

---

## 3. Remediation Plan

### Phase 0: Critical Decisions (BEFORE STARTING)

Before any code changes, decide:

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **D1:** StateIntent `state` field | Keep (convenience) vs Remove (pure event sourcing) | **Remove** - derive from patches |
| **D2:** WorkflowResult.events type | `AnyEvent[]` vs `SerializedEvent[]` vs `WorkflowEvent[]` | **`SerializedEvent[]`** - wire format |
| **D3:** Keep EVENTS constant? | Delete vs Update values | **Delete** - use `tagToEventName` |
| **D4:** Provider bridge approach | Fix `runAgentDef` to emit canonical events vs Keep conversion | **Fix `runAgentDef`** - zero legacy means no bridge |
| **D5:** Timestamp encoding on the wire | `number` (ms) vs ISO string | **`number` (ms)** (matches `Domain/Events.ts` SerializedEvent) |
| **D6:** SSE client transport | `EventSource` vs fetch+parser | **One approach only** (pick and delete the other) |
| **D7:** Event persistence contract | Store `SerializedEvent` vs store `WorkflowEvent` vs keep `AnyEvent` | **Store `SerializedEvent`** (stable JSON boundary) |
| **D8:** Subscriber model (ADR-004) | Fiber subscribers vs synchronous dispatch | **Decide and make code match** (no dead modules) |

### Phase 1: Consolidate Serialization (HIGH PRIORITY)

**Goal:** Single source of truth for event serialization.

| Task | File | Action |
|------|------|--------|
| 1.1 | `Domain/Events.ts` | Export `toSerializedEvent` and `tagToEventName` |
| 1.2 | `runtime.ts` | DELETE `workflowEventToLegacy`, import from Domain |
| 1.3 | `dispatch.ts` | DELETE `toSerializedEvent`, import from Domain |
| 1.4 | `subscribers.ts` | DELETE `toSerializedEvent` and `tagToEventName`, import from Domain |
| 1.5 | `types.ts` | DELETE `EVENTS` constant (or update to canonical names) |
| 1.6 | `types.ts` | Change `WorkflowResult.events` to `ReadonlyArray<SerializedEvent>` |
| 1.7 | All callers | Update imports |

**Risk:** This changes wire format AND public API. All consumers must update.

### Phase 1.5: Wire Format + Transport Convergence (REQUIRED for “One Way Only”)

**Goal:** One event format on the wire and in persistence: `SerializedEvent` from `Domain/Events.ts`.

| Task | Component | Action |
|------|----------|--------|
| 1.5.1 | `Services/EventStore` | Change service contract to persist/read `SerializedEvent` (not `AnyEvent`). |
| 1.5.2 | `Services/EventBus` | Change bus contract to publish/subscribe `SerializedEvent`. |
| 1.5.3 | Server SSE | Ensure SSE sends the exact `SerializedEvent` JSON (timestamp number). |
| 1.5.4 | Server store | Update `EventStoreLive` encode/decode to match `SerializedEvent` (timestamp number). |
| 1.5.5 | Client ingestion | Make **one** SSE ingestion implementation canonical; delete the other.
| 1.5.6 | Client validation | Align all client schemas/parsers to `SerializedEvent` (timestamp number). |
| 1.5.7 | Tests | Rewrite any tests that assert `AnyEvent`/Date timestamps to assert `SerializedEvent`. |

### Phase 2: Fix HITL End-to-End (HIGH PRIORITY)

**Goal:** Single HITL schema from Domain to Client.

| Task | Action |
|------|--------|
| 2.1 | Remove legacy payload transformation from runtime.ts and dispatch.ts |
| 2.2 | Update `client/hooks.ts` to expect `{id, prompt, type}` |
| 2.3 | Update server tests to validate canonical format |
| 2.4 | Delete `"freeform"` from all code and docs |

### Phase 3: Delete Mocks, Use Real Implementations (HIGH PRIORITY)

**Goal:** All tests use real implementations with `:memory:`.

| Task | Action |
|------|--------|
| 3.1 | Update `execute.ts` to NOT import `InMemoryEventBus` (blocking) |
| 3.2 | DELETE `packages/core/src/Layers/InMemory.ts` entirely |
| 3.3 | Update all test files to use LibSQL `:memory:` layers |
| 3.4 | Verify all tests still pass |

**Also required:** remove any Map-based “fallback” layers that remain in server code (e.g., in-memory recorder fallbacks) so the repo has exactly one implementation per service.

### Phase 4: Fix Naming Everywhere (MEDIUM PRIORITY)

**Goal:** Consistent field names per ADR-008.

| Task | Find | Replace |
|------|------|---------|
| 4.1 | `workflowName` | `workflow` |
| 4.2 | `promptText` | `prompt` |
| 4.3 | `inputType` (as field) | `type` |
| 4.4 | `response` (in InputReceived) | `value` |
| 4.5 | `agentName` | `agent` |
| 4.6 | `UseFilteredEventsOptions` | `FilteredEventsOptions` |

### Phase 5: Update State Derivation (MEDIUM PRIORITY)

**Goal:** State derivation works with canonical event names.

| Task | Action |
|------|--------|
| 5.1 | Update `computeStateAt` to look for `state:intent` and `state:checkpoint` |
| 5.2 | Remove dual-format support from `deriveState` |
| 5.3 | Update server routes that call `computeStateAt` |

### Phase 6: Add Schema Validation (MEDIUM PRIORITY)

**Goal:** No unvalidated `JSON.parse` at system boundaries.

| Task | File | Action |
|------|------|--------|
| 6.1 | `LibSQL.ts:71` | Add Effect Schema for event payload |
| 6.2 | `ProviderRecorderLive.ts:64,66,144,145` | Add Effect Schema |
| 6.3 | `subscription.ts:74` | Add Effect Schema for SSE events |

### Phase 7: Consolidate ID Definitions (MEDIUM PRIORITY)

**Goal:** Single location for ID schemas and generators.

| Task | Action |
|------|--------|
| 7.1 | Keep ID definitions in `Domain/Ids.ts` (already has SessionId, etc.) |
| 7.2 | DELETE `EventIdSchema`, `makeEventId`, `parseEventId` from `types.ts` |
| 7.3 | Update all imports to use `Domain/Ids.ts` |

### Phase 8: Remove Legacy Table Lookups (MEDIUM PRIORITY)

**Goal:** Single table structure for ProviderRecorder.

| Task | Action |
|------|--------|
| 8.1 | Remove "First check legacy provider_recordings table" code from `ProviderRecorderLive.ts` |
| 8.2 | Remove legacy store check from `Server.ts:88` |
| 8.3 | Verify recordings still work |

### Phase 9: Delete Dead Code (LOW PRIORITY)

| Task | Action |
|------|--------|
| 9.1 | DELETE `deriveStateOptimized` from utils.ts |
| 9.2 | DELETE `makeStoreSubscriber`, `makeBusSubscriber`, `makeObserverSubscriber` from subscribers.ts |
| 9.3 | DELETE `Domain/index.ts` |
| 9.4 | DELETE commented imports from runtime.ts |
| 9.5 | DELETE "Per ADR-010..." comments |
| 9.6 | DELETE `legacyEventToWorkflowEvent` from runtime.ts (after provider bridge is addressed) |

### Phase 10: Fix Public API Surface (LOW PRIORITY)

| Task | Action |
|------|--------|
| 10.1 | Move `Services` and `Layers` exports to `/internal` |
| 10.2 | Rename `Workflow*` errors per ADR-007 |
| 10.3 | Remove legacy `WorkflowProvider` export from client |

### Phase 10.5: Delete Legacy React Surface (REQUIRED for “Zero Legacy”)

Since there are **no external users**, the cleanup should fully delete the legacy React API surface:

| Task | Action |
|------|--------|
| 10.5.1 | Delete `packages/client/src/react/Provider.tsx` |
| 10.5.2 | Delete `packages/client/src/react/context.ts` if only used by the legacy provider |
| 10.5.3 | Delete `packages/client/src/react/hooks.ts` (legacy mega-hooks) |
| 10.5.4 | Remove legacy exports from `packages/client/src/react/index.ts` |
| 10.5.5 | Update any internal usages/tests to use the ADR-013 hooks (`react/hooks/*`) only |

### Phase 11: Update Documentation (LOW PRIORITY)

| Task | Action |
|------|--------|
| 11.1 | Remove `ProviderRegistry` from architecture.md |
| 11.2 | Remove `"freeform"` from all docs |
| 11.3 | Update HITL documentation with canonical schema |
| 11.4 | Remove all "backward compatibility" comments from code |
| 11.5 | Update any remaining references to legacy event names |

---

## 4. Success Criteria

### Wire Format After Cleanup

```typescript
// All events use Domain/Events.ts format:
{
  id: "uuid-here",
  name: "state:intent",  // NOT "state:updated"
  payload: {
    intentId: "...",
    state: {...},
    patches: [...],
  },
  timestamp: 1706627400000  // numeric, NOT Date
}

// HITL events preserve correlation:
{
  id: "uuid-here",
  name: "input:requested",
  payload: {
    id: "correlation-id",  // NOT dropped
    prompt: "Approve?",    // NOT "promptText"
    type: "approval",      // NOT "inputType"
  },
  timestamp: 1706627400000
}
```

### Codebase After Cleanup

**Serialization:**
- [ ] Single `toSerializedEvent` in `Domain/Events.ts`
- [ ] Single `tagToEventName` in `Domain/Events.ts`
- [ ] Zero occurrences of `workflowEventToLegacy`
- [ ] Zero occurrences of `legacyEventToWorkflowEvent`
- [ ] `EVENTS` constant deleted or updated
- [ ] `WorkflowResult.events` typed as `SerializedEvent[]`

**Naming:**
- [ ] Zero occurrences of `promptText`, `inputType`, `agentName`, `workflowName` as field names
- [ ] Zero occurrences of `"freeform"` in HITL
- [ ] Zero occurrences of `state:updated`, `input:response` in event names (except migrations)

**Mocks:**
- [ ] `InMemory.ts` deleted
- [ ] Zero `Map<>`-based service implementations
- [ ] All tests use LibSQL `:memory:` or real implementations

**IDs:**
- [ ] Single `EventId` definition in `Domain/Ids.ts`
- [ ] Zero duplicate `makeEventId` functions

**Schema:**
- [ ] Zero `JSON.parse` without Effect Schema at boundaries
- [ ] All SSE parsing uses Schema

**Legacy:**
- [ ] Zero "backward compatibility" comments
- [ ] Zero "legacy" comments (except historical notes)
- [ ] Zero dual-table lookups in ProviderRecorder
- [ ] All tests validate canonical format

**Quality:**
- [ ] `bun run lint` — zero warnings, zero errors
- [ ] `bun run typecheck` — zero warnings, zero errors
- [ ] `bun run test` — all pass

### Grep Validations

```bash
# Should return 0 results after cleanup:
rg "workflowEventToLegacy" packages/
rg "legacyEventToWorkflowEvent" packages/
rg "promptText" packages/ --type ts
rg "inputType" packages/ --type ts  # (as field name, not in comments)
rg "agentName" packages/ --type ts
rg "workflowName" packages/ --type ts
rg '"freeform"' packages/
rg "InMemory" packages/core/src/Layers/
rg "state:updated" packages/ --type ts  # (except migrations)
rg "input:response" packages/ --type ts
rg "backward.?compat" packages/ -i
rg "for.?legacy" packages/ -i
rg "First check legacy" packages/

# No TODOs/FIXMEs/deprecations remain:
rg "\\bTODO\\b|\\bFIXME\\b|\\bXXX\\b" packages/
rg "@deprecated" packages/

# No Map-based service implementations remain:
rg "new Map<" packages/

# These should pass:
bun run lint
bun run typecheck
bun run test
```

---

## 5. Files Requiring Changes

### DELETE Entirely
- `packages/core/src/Layers/InMemory.ts`
- `packages/core/src/Domain/index.ts`

### Major Changes (Breaking)
| File | Changes |
|------|---------|
| `packages/core/src/Engine/runtime.ts` | Delete `workflowEventToLegacy`, `legacyEventToWorkflowEvent`, use Domain serializer |
| `packages/core/src/Engine/dispatch.ts` | Delete `toSerializedEvent`, use Domain serializer |
| `packages/core/src/Engine/subscribers.ts` | Delete serialization code, delete dead subscriber functions |
| `packages/core/src/Engine/types.ts` | Delete `EVENTS` constant, change `WorkflowResult.events` type, rename `workflowName`, `response`, delete duplicate `EventId` defs |
| `packages/core/src/Engine/execute.ts` | Remove `InMemoryEventBus` import, use real implementation |
| `packages/core/src/Engine/utils.ts` | Update state derivation, remove dual-format support |
| `packages/core/src/Domain/Events.ts` | Decision: remove `state` field from StateIntent? |
| `packages/client/src/react/hooks.ts` | Update HITL schema expectations (`interactionId` → `id`) |
| `packages/server/test/hitl-integration.test.ts` | REWRITE to validate canonical format |
| `packages/core/test/hitl.test.ts` | REWRITE to validate canonical format |

### Medium Changes
| File | Changes |
|------|---------|
| `packages/server/src/store/ProviderRecorderLive.ts` | Remove legacy table lookup, add schema validation |
| `packages/server/src/http/Server.ts` | Remove legacy store check, remove `providers` map |
| `packages/server/src/OpenScaffold.ts` | Remove `providers` map |
| `packages/core/src/Domain/Ids.ts` | Ensure all ID types consolidated here |
| `packages/core/src/index.ts` | Move internals to `/internal`, update exports |

### Minor Changes
| File | Changes |
|------|---------|
| `packages/core/src/Layers/LibSQL.ts` | Add schema validation |
| `packages/client/src/react/primitives/subscription.ts` | Add schema validation |
| `packages/client/src/react/index.ts` | Remove `WorkflowProvider` legacy export |
| `docs/*.md` | Remove freeform, ProviderRegistry, "backward compat" references |
| `packages/core/src/Services/StateProjection.ts` | Remove "backward compat" comments |

---

## 6. Appendix: Quick Reference

### What to DELETE

```
# Functions
workflowEventToLegacy()           → DELETE (runtime.ts)
legacyEventToWorkflowEvent()      → DELETE (runtime.ts)
toSerializedEvent()               → DELETE (dispatch.ts, subscribers.ts)
tagToEventName                    → DELETE (subscribers.ts)
makeStoreSubscriber               → DELETE (subscribers.ts, unused)
makeBusSubscriber                 → DELETE (subscribers.ts, unused)
makeObserverSubscriber            → DELETE (subscribers.ts, unused)
deriveStateOptimized              → DELETE (utils.ts, unused)
deprecated save() method          → DELETE (ProviderRecorder)

# Constants/Types
EVENTS constant                   → DELETE (types.ts, replaced by tagToEventName)
EventIdSchema in types.ts         → DELETE (duplicate of Domain/Ids.ts)
makeEventId in types.ts           → DELETE (duplicate of Domain/Ids.ts)

# Files
InMemory.ts                       → DELETE (entire file)
Domain/index.ts                   → DELETE (orphaned)

# Code Paths
Legacy table lookup               → DELETE (ProviderRecorderLive.ts, Server.ts)
Legacy providers map              → DELETE (OpenScaffold.ts, Server.ts)
WorkflowProvider export           → DELETE (client/react/index.ts)

# Comments
"backward compatibility"          → DELETE all occurrences
"for legacy"                      → DELETE all occurrences
"Per ADR-010..."                  → DELETE all occurrences
```

### What to RENAME

| From | To |
|------|----|
| `workflowName` | `workflow` |
| `promptText` | `prompt` |
| `inputType` | `type` |
| `response` (InputReceived) | `value` |
| `agentName` | `agent` |
| `interactionId` | `id` |
| `state:updated` | `state:intent` / `state:checkpoint` |
| `input:response` | `input:received` |
| `workflow:started` (for SessionForked) | `session:forked` |

### What to CHANGE

| Item | From | To |
|------|------|-----|
| `WorkflowResult.events` | `ReadonlyArray<AnyEvent>` | `ReadonlyArray<SerializedEvent>` |
| `StateIntent.state` field | Present (for observer compat) | **DECISION NEEDED** |
| Dual-format `deriveState` | Accepts both formats | Accept only `WorkflowEvent` or `SerializedEvent` |

### What to ADD

- Effect Schema validation at all `JSON.parse` boundaries
- Single canonical import path for serialization (`Domain/Events.ts`)
- Proper test fixtures in canonical format (replacing legacy fixtures)

### What to REWRITE (Not Just Update)

These tests enforce legacy behavior and must be rewritten from scratch:

- `packages/core/test/hitl.test.ts`
- `packages/server/test/hitl-integration.test.ts`
- Any test that asserts `promptText`, `inputType`, or `response` field names
