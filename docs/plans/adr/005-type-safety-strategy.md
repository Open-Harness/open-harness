# ADR-005: Type Safety Strategy

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Type Safety Strategy
**Related Issues:** TYPE-002, TYPE-003, TYPE-004, TYPE-006, TYPE-007, TYPE-008, TYPE-009, TYPE-010, TYPE-011, TYPE-012, TYPE-013
**Resolves:** TYPE-004, TYPE-006, TYPE-009, TYPE-010, TYPE-011, TYPE-012, TYPE-013
**Superseded by Other ADRs:** TYPE-001 (ADR-008), TYPE-005 (ADR-004), TYPE-014 (ADR-002), TYPE-015 (ADR-006)

---

## Context

The codebase has **15+ type safety violations** across packages:

| Severity | Count | Examples |
|----------|-------|----------|
| CRITICAL | 2 | JSON.parse without validation in stores |
| HIGH | 1 | Double cast `as unknown as Record` in workflow.ts |
| MEDIUM | 12+ | ID brand casts, event payload casts |

### Root Cause Patterns

1. **Brand Type Boundary** — UUID strings need casting to branded types (`SessionId`, `EventId`)
2. **JSON Deserialization** — `JSON.parse()` returns `unknown`, needs runtime validation
3. **Generic Type Loss** — Generic `<S>` parameters lose type info at storage boundaries
4. **Event Payloads** — Discriminated unions accessed via unsafe casts vs type guards

### Critical Violations

```typescript
// workflow.ts:226 — defeats type safety
const result = value as unknown as Record<string, unknown>

// EventStoreLive.ts:40 — no validation
const payload = JSON.parse(row.payload) as EventPayload

// StateSnapshotStoreLive.ts:36 — no validation
const state = JSON.parse(row.state_json) as S
```

---

## Decision

**Use Effect Schema (`@effect/schema`) for validation at system boundaries only.**

Internal code already has compile-time type safety via:
- `Data.TaggedClass` events (ADR-004)
- Structured HITL payloads (ADR-002)
- Event-sourced state derivation (ADR-006)

Schema validation is required only where data crosses untrusted boundaries: storage, network, and external IDs.

### Why Effect Schema (Not Zod/Guards/Casts)

| Criterion | Effect Schema | Why It Wins |
|-----------|---------------|-------------|
| Effect Alignment | **Native** | `Schema.decodeUnknown` composes with `Effect.mapError`, `Effect.flatMap` |
| Error Handling | **Structured** | Decode failures become typed errors in Effect channels |
| Type Derivation | **Bidirectional** | Derive TypeScript types from schemas; single source of truth |
| Composability | **High** | Build small schemas, compose into larger ones |
| Performance | Acceptable | Validation only at boundaries, not hot paths |

Zod would require wrapping `parse()` in `Effect.tryCatch` constantly — two error models. Type guards don't compose and are error-prone. Casts don't solve the problem.

---

## Scope: Boundaries Only

### Validated by This ADR (Effect Schema)

| Issue | Location | Schema Use |
|-------|----------|------------|
| TYPE-004 | `Domain/Ids.ts` | `Schema.String.pipe(Schema.pattern(...), Schema.brand(...))` |
| TYPE-006 | `Layers/LibSQL.ts` | Schema for deserialized rows |
| TYPE-009 | `Layers/InMemory.ts` | ID validation on key conversion |
| TYPE-010 | `server/store/StateSnapshotStoreLive.ts` | `StateCheckpoint` schema |
| TYPE-011 | `server/store/EventStoreLive.ts` | `StoredEvent` schema |
| TYPE-012 | `client/HttpClient.ts` | API response schemas |
| TYPE-013 | `client/HttpClient.ts` | SSE message schema |

### Resolved by Other ADRs (No Schema Needed)

| Issue | Resolved By | How |
|-------|-------------|-----|
| TYPE-001 | ADR-008 | Consolidates duplicate `Event<N,P>` definitions to single source |
| TYPE-005 | ADR-004 | `Data.TaggedClass` provides compile-time type-safe event access |
| TYPE-014 | ADR-002 | `usePendingInteractions` hook rewritten with new HITL payload types |
| TYPE-015 | ADR-006 | `computeStateAt` replaced by `deriveState`; no casts needed |

### Out of Scope / Still Relevant

| Issue | Status | Notes |
|-------|--------|-------|
| TYPE-002 | Open | `StateSnapshot` export consolidation — implementation detail |
| TYPE-003 | Verify | Double cast in `workflow.ts` — check if still exists post-ADR-006 |
| TYPE-007 | Verify | State cast in `StateCache.ts` — verify with ADR-006 implementation |
| TYPE-008 | Accept | Zod cast in `provider.ts` — Zod kept for agent `output` schemas by design (ADR-010) |

---

## Schema Patterns

### ID Validation (TYPE-004, TYPE-009)

```typescript
import { Schema } from "@effect/schema"

const SessionId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  Schema.brand("SessionId")
)

type SessionId = Schema.Schema.Type<typeof SessionId>

// Usage
const id = yield* Schema.decodeUnknown(SessionId)(rawId).pipe(
  Effect.mapError(() => new ValidationError("Invalid session ID format"))
)
```

### Store Boundary (TYPE-010, TYPE-011)

```typescript
const StoredEvent = Schema.Struct({
  id: EventIdSchema,
  name: Schema.String,
  payload: Schema.Unknown,
  timestamp: Schema.Number,
  causedBy: Schema.optional(EventIdSchema)
})

// In EventStoreLive.ts
const event = yield* Schema.decodeUnknown(StoredEvent)(JSON.parse(row.payload)).pipe(
  Effect.mapError((err) => new StoreError({ cause: `Invalid event: ${err}` }))
)
```

### API Boundary (TYPE-012, TYPE-013)

```typescript
const ApiResponse = Schema.Struct({
  sessionId: SessionIdSchema,
  events: Schema.Array(SerializedEventSchema),
  state: Schema.Unknown
})

// HttpClient returns decoded + validated data
const response = yield* fetch(url).then(r => r.json()).pipe(
  Effect.flatMap(Schema.decodeUnknown(ApiResponse)),
  Effect.mapError((err) => new HttpError({ cause: err }))
)
```

---

## What We Do NOT Validate

Don't add Schema overhead where compile-time types already suffice:

```typescript
// ❌ Don't do this — Data.TaggedClass already type-safe
const event = new AgentStarted({ agent: "planner" })
const payload = Schema.decodeUnknown(AgentStartedSchema)(event)  // Redundant!

// ✅ Internal flow stays pure TypeScript
const handleEvent = (event: WorkflowEvent) => {
  if (event._tag === "AgentStarted") {
    event.agent  // string — compile-time guaranteed
  }
}
```

---

## Alternatives Considered

### Option B: Zod
- **Rejected:** Excellent DX, but requires `Effect.tryCatch` bridging. Two error models in an Effect codebase is friction.

### Option C: Type Guards  
- **Rejected:** Manual guards don't compose, easy to write incomplete checks, no automatic error paths.

### Option D: Documented Casts
- **Rejected:** Casts are lies. False sense of security. Violates "explicit errors" philosophy of Effect.

---

## Consequences

### Positive
- **Runtime safety** at all data boundaries (storage, network, external IDs)
- **Effect-idiomatic** error handling — decode failures in `Effect` channels
- **Single source of truth** — types derived from schemas
- **Gradual migration** — add schemas incrementally at each boundary

### Negative  
- **Bundle cost** — `@effect/schema` adds ~15KB (acceptable for this use case)
- **Verbosity** — More boilerplate than Zod for complex unions
- **Learning curve** — Team must learn Effect Schema patterns

### Migration Path
1. Add `@effect/schema` dependency
2. Create ID schemas (`SessionId`, `EventId`, `WorkflowId`) — replaces casts
3. Add store schemas (`StoredEvent`, `StateCheckpoint`) — replaces JSON.parse casts
4. Add API schemas in `HttpClient` — replaces response.json() casts
5. Remove remaining unsafe casts as touched

---

## Implementation Notes

### Files Requiring Schema Addition

| File | Schema For | Replaces |
|------|-----------|----------|
| `packages/core/src/Domain/Ids.ts` | Branded ID types | UUID casts |
| `packages/core/src/Layers/LibSQL.ts` | Row deserialization | JSON.parse casts |
| `packages/server/src/store/EventStoreLive.ts` | `StoredEvent` | payload cast |
| `packages/server/src/store/StateSnapshotStoreLive.ts` | `StateCheckpoint` | state_json cast |
| `packages/client/src/HttpClient.ts` | API responses, SSE | response.json() casts |

### Files Already Safe (No Changes)

| File | Why Safe |
|------|----------|
| `packages/core/src/Engine/runtime.ts` | `Data.TaggedClass` events (ADR-004) |
| `packages/core/src/Engine/types.ts` | Consolidated event types (ADR-008) |
| `packages/client/src/react/hooks.ts` | Rewritten with typed payloads (ADR-002) |
| `packages/core/src/Engine/utils.ts` | `deriveState` replaces `computeStateAt` (ADR-006) |

---

## Related Files

- `packages/core/src/Engine/workflow.ts:226` — Double cast
- `packages/core/src/Domain/Ids.ts` — Brand types
- `packages/server/src/store/EventStoreLive.ts`
- `packages/server/src/store/StateSnapshotStoreLive.ts`
- `packages/client/src/HttpClient.ts`
