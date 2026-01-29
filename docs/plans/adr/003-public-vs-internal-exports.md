# ADR-003: Public vs Internal Exports

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Public vs Internal Exports
**Related Issues:** ARCH-004, ARCH-006, ARCH-007, API-008, API-009, DEAD-003, DEAD-004, DEAD-005, DEAD-006

---

## Context

The codebase exports many internal implementation details that users shouldn't need:

| Package | Issue | Examples |
|---------|-------|----------|
| `@open-scaffold/core` | 97 exports, many internal | Services, Layers, SessionContext |
| `@open-scaffold/core` | Provider infrastructure too public | `runAgentDef` (Note: `ProviderRegistry` deleted per [ADR-010](./010-provider-ownership-model.md)) |
| `@open-scaffold/server` | Route handlers exported individually | 10 handlers users should never import |
| `@open-scaffold/server` | SSE utilities exposed | Implementation details |
| `@open-scaffold/client` | Reconnect internals exposed | `sseReconnectSchedule` |

### Problems Identified

1. **Too many exports** — Users overwhelmed by choice
2. **Internal details leaked** — Services, Layers are advanced/internal
3. **No `@internal` markers** — Unclear what's public vs internal
4. **Route handlers exposed** — Users should use `createServer()`, not individual routes

---

## Decision

### Summary

1. **Expose one public entrypoint per package** (clean, minimal API).
2. **Move advanced/implementation exports behind an explicit `/internal` entrypoint**.
3. **Additionally mark internal exports with JSDoc `@internal`** to improve IDE guidance.

### Chosen Approach

**Option A (Separate Entry Points) + Option C (JSDoc `@internal`)**

Public usage:

```typescript
// Public API only
import { run, workflow, agent } from "@open-scaffold/core"
import { createServer } from "@open-scaffold/server"
import { WorkflowClient } from "@open-scaffold/client"
```

Advanced/explicit usage:

```typescript
// Advanced / internal entrypoints (explicit opt-in)
import { Services, Layers } from "@open-scaffold/core/internal"
import { Server, ServerError } from "@open-scaffold/server/internal"
import { sseReconnectSchedule } from "@open-scaffold/client/internal"
```

---

## What Should Be Public

Public exports are the stable, user-facing API.

| Category | Exports |
|----------|---------|
| Core API | `run`, `workflow`, `agent`, `state`, `phase` |
| Types | `WorkflowDef`, `AgentDef`, `WorkflowResult`, event types |
| IDs | `SessionId`, `WorkflowId`, `EventId` (branded types) |
| Errors | Public error classes |

---

## What Should Be Internal

Internal exports are implementation details or advanced hooks.

| Category | Exports |
|----------|---------|
| Services | `EventStore`, `EventBus`, `ProviderRecorder`, etc. |
| Layers | All Layer implementations |
| Provider internals | `runAgentDef` (Note: `ProviderRegistry` deleted per [ADR-010](./010-provider-ownership-model.md)) |
| Utilities | `computeStateAt`, internal helpers |

Additionally, for `@open-scaffold/server` specifically:

- Individual route handlers and SSE helpers are internal by default.
- The public server surface should be a single creation path (see ADR-009).

---

## Alternatives Considered

### Option A: Separate entry points (chosen)

- Strongest protection against accidental internal imports.
- Lets us keep a minimal public API while still supporting advanced use cases.

### Option B: Single entry with `internal` namespace (rejected)

- Internals remain highly discoverable and easy to depend on.
- Encourages accidental usage and makes public surface feel larger than it is.

### Option C: JSDoc `@internal` only (rejected as sole approach)

- Helps IDE autocomplete, but does not prevent direct imports.
- Depends on tooling behavior; does not enforce API boundaries.

---

## Consequences

### Positive

- Clear separation of stable public API vs advanced/internal API.
- Easier to keep public API small and consistent.
- Reduces accidental coupling to implementation details.

### Negative

- Requires maintaining `/internal` entrypoints.
- Some users relying on internals will need import path changes.

---

## Implementation Notes

1. Add `/internal` entrypoints to each package via `package.json` `exports`.
2. Move advanced exports (Services/Layers, routes/SSE utilities, reconnect internals) behind `/internal`.
3. Add JSDoc `/** @internal */` to internal symbols to improve IDE guidance.
4. Keep public `index.ts` surfaces minimal and consistent with ADR-001 and ADR-009.

---

## Related Files

- `packages/core/src/index.ts`
- `packages/server/src/index.ts`
- `packages/client/src/index.ts`
