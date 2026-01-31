# Unified Cleanup Phase 1 Summary

**Date:** 2026-01-31
**Status:** Complete (with remaining items identified)

## What Was Accomplished

### Phase 0-12: Core Cleanup

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Critical Decisions (D1-D8) | Done |
| 1 | Consolidate Serialization | Done |
| 1.5 | Wire Format + Transport Convergence | Done |
| 2 | Fix HITL End-to-End | Done |
| 3 | Delete Mocks, Use Real Implementations | Done |
| 4 | Fix Naming Everywhere (ADR-008) | Done |
| 5 | Update State Derivation | Done |
| 6 | Add Schema Validation at Boundaries | Done |
| 7 | Consolidate ID Definitions | Done |
| 8 | ProviderRecorder Single Table Structure | Done |
| 9 | Delete Dead Code | Done |
| 10 | Fix Public API Surface | Done |
| 10.5 | Delete Legacy React Surface | Done |
| 11 | Update Documentation | Done |
| 12 | Fix Toolchain Warnings | Done |

### Key Changes Made

1. **Toolchain Fixes**
   - Added `"name": "open-harness"` to root package.json (fixes Turborepo bun.lock parsing)
   - Updated `packageManager` to `bun@1.3.8`
   - Updated `turbo` to `^2.8.1-canary.1`
   - Zero warnings from `bun run typecheck` and `bun run lint`

2. **Legacy React Surface Deleted**
   - Removed `packages/client/src/react/Provider.tsx`
   - Removed `packages/client/src/react/context.ts`
   - Removed `packages/client/src/react/hooks.ts`
   - Removed `packages/client/test/hooks.test.tsx`

3. **CLI Commands Updated**
   - Removed dead `providers` field from `OpenScaffoldConfig`
   - Updated `list.ts`, `replay.tsx`, `run.tsx` to not use providers registry

4. **Event Names Fixed**
   - Updated `useEventStream.ts` to use `state:intent`/`state:checkpoint` (not `state:updated`)
   - Updated comments to use `input:received` (not `input:response`)

5. **Documentation Updated**
   - Removed `ProviderRegistry` from architecture.md
   - Added ADR-010 agent ownership model documentation
   - Fixed Layers folder documentation

6. **Services Namespace Export**
   - Changed `internal.ts` to use `export * as Services from` (namespace export)
   - Updated all server imports to use `Services.EventBus`, etc.

## Remaining Issues Identified

### 1. `EVENTS` Constant Still Used (~120 usages)

The deprecated `EVENTS` constant from `types.ts` is still deeply embedded:

**Production code (8 files):**
- `core/src/Engine/types.ts` - 14 type definitions
- `core/src/Engine/runtime.ts` - 6 switch cases
- `core/src/Engine/provider.ts` - 6 event emissions
- `core/src/Engine/utils.ts` - 2 state checks
- `server/src/http/Routes.ts` - 2 route handlers
- `client/src/react/hooks/useWorkflowHITL.ts` - 3 event filters
- `client/src/react/hooks/useWorkflow.ts` - 2 status checks

**Test code (14 files):**
- All use `EVENTS.*` for assertions and event creation

**Replacement:** `tagToEventName` from `Domain/Events.ts`

### 2. `ProviderRecorder.save()` Still Used (3 callers)

- `packages/testing/src/record.ts:122`
- `packages/server/test/provider-recording.test.ts:84,168`

**Replacement:** `startRecording` / `appendEvent` / `finalizeRecording`

## Validation Results

| Check | Result |
|-------|--------|
| `bun run lint` | Zero errors/warnings |
| `bun run typecheck` | Zero errors/warnings |
| `bun run test` | 412 tests passing |
| `workflowEventToLegacy` | 0 usages (only a comment) |
| `legacyEventToWorkflowEvent` | 0 usages |
| `promptText` | 0 usages |
| `inputType` | 0 usages |
| `state:updated` | 0 usages |
| `input:response` | 0 usages |
| `backward.?compat` | 0 usages |
| `TODO/FIXME/XXX` | 0 usages |

## Next Steps Required

1. **Migrate all `EVENTS.*` usages to `tagToEventName`** (~120 changes)
2. **Migrate `recorder.save()` to incremental recording API** (3 changes)
3. **Delete the `EVENTS` constant entirely**
4. **Delete `ProviderRecorder.save()` method**
5. **Comprehensive audit for any other legacy patterns**
