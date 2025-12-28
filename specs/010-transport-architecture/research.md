# Research: Transport Architecture

**Feature**: 010-transport-architecture
**Date**: 2025-12-27

## Summary

No unknowns required research. The technical context is fully understood from the existing codebase:

- **UnifiedEventBus** already provides AsyncLocalStorage context propagation (008-unified-event-system)
- **HarnessInstance** already has `.on()` for event subscription and `.run()` for execution
- **Event types** are well-defined in `harness/event-context.ts`
- **Dependency injection** patterns are established with Needle DI

## Decisions Made During Spec

The following decisions were documented as assumptions in the spec:

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Attachment error isolation | Other attachments still receive events | Follows established pattern in UnifiedEventBus (listener errors logged, not propagated) |
| waitForUser timeout | Configurable, default blocks indefinitely | Matches common async primitive patterns; caller can compose with Promise.race for timeouts |
| attach() after run() | Throws error | Attachments must be registered before execution to ensure consistent event delivery |
| Multiple replies | First wins, subsequent ignored | Standard promise-resolution semantics |
| abort() idempotency | Idempotent (no-op on second call) | AbortController standard behavior |

## Architectural Patterns Applied

### Pattern 1: Transport IS HarnessInstance

Rather than `harness.transport().subscribe()`, the instance itself implements Transport:

```typescript
harness.create(input)
  .attach(renderer)  // instance.attach()
  .run()             // instance.run()
```

**Rationale**: Cleaner API, fewer indirections, matches existing `.on().run()` pattern.

### Pattern 2: Functional Attachments

```typescript
type Attachment = (transport: Transport) => Cleanup;
```

**Rationale**: Maximum flexibility. React useEffect cleanup pattern. No class hierarchies.

### Pattern 3: Session Mode Toggle

Commands only processed when `startSession()` called. This allows:
- `run()` for fire-and-forget (existing behavior preserved)
- `startSession().complete()` for interactive mode

**Rationale**: Backward compatible. Commands are no-ops in non-session mode.

## Dependencies Reviewed

| Dependency | Purpose | Notes |
|------------|---------|-------|
| @anthropic-ai/claude-agent-sdk | Agent execution | Unchanged |
| @needle-di/core | Dependency injection | UnifiedEventBus already injectable |
| zod | Schema validation | Will use for UserResponse validation |
| node:async_hooks | AsyncLocalStorage | Already used by UnifiedEventBus |

## No Additional Research Required

The spec and existing codebase provide sufficient context for implementation.
