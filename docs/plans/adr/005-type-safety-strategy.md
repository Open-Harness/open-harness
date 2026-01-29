# ADR-005: Type Safety Strategy

**Status:** Proposed
**Date:** 2026-01-29
**Decision Area:** Type Safety Strategy
**Related Issues:** TYPE-001 through TYPE-015

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

> **TODO:** Decide on approach after discussion

### Options to Consider

**Option A: Effect Schema at Boundaries**
```typescript
import { Schema } from "@effect/schema"

const EventPayloadSchema = Schema.union(
  Schema.struct({ type: Schema.literal("workflow:started"), ... }),
  Schema.struct({ type: Schema.literal("agent:output"), ... }),
  // ...
)

// At deserialization
const payload = Schema.decodeUnknownSync(EventPayloadSchema)(JSON.parse(raw))
```

**Option B: Zod Validation at Boundaries**
```typescript
const EventPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("workflow:started"), ... }),
  z.object({ type: z.literal("agent:output"), ... }),
])

const payload = EventPayloadSchema.parse(JSON.parse(raw))
```

**Option C: Type Guards**
```typescript
function isAgentOutputPayload(p: unknown): p is AgentOutputPayload {
  return typeof p === "object" && p !== null && "output" in p
}

// Usage
const parsed = JSON.parse(raw)
if (!isAgentOutputPayload(parsed)) throw new Error("Invalid payload")
```

**Option D: Accept Casts with Documentation**
- Keep casts but document why they're safe
- Add runtime assertions in development mode

---

## Validation Points

> **TODO:** Identify all points needing validation

| Location | What | Current | Proposed |
|----------|------|---------|----------|
| EventStoreLive | Event payloads | Cast | Schema decode |
| StateSnapshotStoreLive | State JSON | Cast | Schema decode |
| HttpClient | API responses | Cast | Schema decode |
| SSE parsing | Stream events | Cast | Schema decode |
| ID creation | Brand types | Cast | Factory with validation |

---

## Brand Type Strategy

> **TODO:** Decide on brand type validation

```typescript
// Current — no validation
const sessionId = crypto.randomUUID() as SessionId

// Option: Factory function
const sessionId = SessionId.create()  // Generates and brands
const sessionId = SessionId.parse(raw)  // Validates and brands
```

---

## Alternatives Considered

> **TODO:** Fill in after discussion

---

## Consequences

> **TODO:** Fill in after decision

---

## Implementation Notes

> **TODO:** Fill in after decision

---

## Related Files

- `packages/core/src/Engine/workflow.ts:226` — Double cast
- `packages/core/src/Domain/Ids.ts` — Brand types
- `packages/server/src/store/EventStoreLive.ts`
- `packages/server/src/store/StateSnapshotStoreLive.ts`
- `packages/client/src/HttpClient.ts`
