# ADR-001: Harness Architecture Consolidation

**Status**: Proposed
**Date**: 2025-12-28
**Context**: SDK Stabilization Phase

## Summary

The SDK harness module has accumulated three incompatible event systems and inconsistent naming across features 003, 007, 008, and 010. This ADR documents the overlaps and proposes a consolidation path with corrected naming conventions.

---

## Key Naming Decision

Following the Pino/Winston transport pattern:

| Current Name | New Name | Rationale |
|--------------|----------|-----------|
| `Transport` (interface) | `EventHub` | Bidirectional hub - events flow both ways (not just a source) |
| `Attachment` | `Transport` | Matches logging ecosystem - transports carry data to destinations |
| `toAttachment()` | `toTransport()` | Converts renderer to transport |
| `IUnifiedRenderer` | `Renderer` | Drop "Unified" prefix for clarity |

### The Pino Model (Our Inspiration)

```
Logger (source/hub)
  ↓
Transports[] (destinations)
  ├── pino-pretty → stdout
  ├── pino-http → HTTP endpoint
  └── pino-file → filesystem
```

### Our Corrected Model

```
HarnessInstance implements EventHub (bidirectional hub)
  ↓
Transports[] (like Pino)
  ├── ConsoleTransport → stdout
  ├── WebSocketTransport → WebSocket (bidirectional)
  └── MetricsTransport → monitoring system
```

### Why EventHub (not EventSource)

The hub is bidirectional:
- **Outbound**: `subscribe(listener)` - receive events
- **Inbound**: `reply()`, `send()`, `abort()` - send commands back

`EventSource` would imply one-way, which is incorrect.

---

## Problem Statement

### Current State: 26 Files, 3 Event Systems

The harness module grew organically across multiple features:
- **003-harness-renderer**: TaskHarness + IHarnessRenderer + HarnessEvent
- **007-fluent-harness-dx**: HarnessInstance + FluentHarnessEvent
- **008-unified-event-system**: UnifiedEventBus + BaseEvent + defineRenderer
- **010-transport-architecture**: SessionContext + Transport (→ EventHub) + Attachment (→ Transport)

Each feature added its own event types without consolidating existing ones.

---

## Issue 1: Three Incompatible Event Systems

### Event System A: `event-protocol.ts` (TaskHarness Domain)

```typescript
type HarnessEvent =
  | HarnessStartEvent | HarnessCompleteEvent | HarnessErrorEvent
  | PhaseStartEvent | PhaseCompleteEvent
  | TaskStartEvent | TaskNarrativeEvent | TaskCompleteEvent | TaskFailedEvent
  | ValidationStartEvent | ValidationCompleteEvent | ValidationFailedEvent
```

**Used by**: TaskHarness, BaseHarnessRenderer, ConsoleRenderer, ReplayController
**Domain**: Task parsing, coding, validation
**Status**: Stable, but domain-specific

### Event System B: `event-types.ts` (Fluent Harness)

```typescript
type FluentHarnessEvent =
  | PhaseEvent | TaskEvent | StepEvent | NarrativeEvent | ErrorEvent
  | RetryEvent | ParallelEvent | SessionEvent
```

**Used by**: HarnessInstance, control-flow helpers
**Domain**: Generic workflow execution
**Status**: Active, generic

### Event System C: `event-context.ts` (Unified Event Bus)

```typescript
type BaseEvent =
  | HarnessStartEvent | HarnessCompleteEvent
  | PhaseStartEvent | PhaseCompleteEvent
  | TaskStartEvent | TaskCompleteEvent | TaskFailedEvent
  | AgentStartEvent | AgentThinkingEvent | AgentTextEvent | AgentToolStartEvent | AgentToolCompleteEvent | AgentCompleteEvent
  | NarrativeEvent
  | SessionPromptEvent | SessionReplyEvent | SessionAbortEvent
  | ExtensionEvent
```

**Used by**: UnifiedEventBus, defineRenderer, processors
**Wrapped in**: `EnrichedEvent` (adds id, timestamp, context)
**Status**: Newest, broadest scope

### Conflicts

| Type | event-protocol.ts | event-types.ts | event-context.ts |
|------|-------------------|----------------|------------------|
| **SessionPromptEvent** | - | `{ promptId, prompt, choices?, timestamp }` | `{ promptId, prompt, choices?, ...BaseEventPayload }` |
| **NarrativeEvent** | `{ taskId, entry: NarrativeEntry }` | `{ agent, text, timestamp }` | `{ text, importance }` |
| **PhaseStartEvent** | `{ phase, phaseNumber }` | `{ phaseNumber, phase }` | `{ type, ...BaseEventPayload }` |

**Problem**: Types are subtly incompatible. No adapters exist.

---

## Issue 2: Legacy Renderer Pattern

### Legacy: `IHarnessRenderer` (003-harness-renderer)

```typescript
interface IHarnessRenderer {
  initialize(tasks: ParsedTask[], config: RendererConfig): Promise<void>;
  handleEvent(event: HarnessEvent): void;
  finalize(summary: HarnessSummary): Promise<void>;
}
```

**Consumes**: `HarnessEvent` from event-protocol.ts
**Problem**: Doesn't use the Transport pattern, tightly coupled to TaskHarness

### Modern: Transport Pattern (010-transport-architecture)

```typescript
// EventHub (what harness implements)
interface EventHub {
  subscribe(filter?, listener): Unsubscribe;
  send(message): void;
  sendTo(agent, message): void;
  reply(promptId, response): void;
  abort(reason?): void;
  readonly status: TransportStatus;
  readonly sessionActive: boolean;
}

// Transport (what attaches to the hub)
type Transport = (hub: EventHub) => Cleanup;
```

**Problem**: TaskHarness should use this pattern but doesn't.

---

## Issue 3: Duplicate Type Names

| Name | Location 1 | Location 2 | Conflict |
|------|------------|------------|----------|
| `RendererConfig` | renderer-interface.ts | define-renderer.ts | Different fields |
| `NarrativeEvent` | event-protocol.ts | event-types.ts + event-context.ts | Different structures |
| `SessionPromptEvent` | event-types.ts | event-context.ts | Subtly incompatible |
| `PhaseStartEvent` | All three systems | Different payloads | |

---

## Decisions

### 1. Canonical Event System: `event-context.ts` (BaseEvent)

**Rationale**:
1. Broadest scope (harness, phase, task, agent, session)
2. Has `EnrichedEvent` wrapper with metadata
3. Has `EventContext` for hierarchical scoping
4. Designed for the unified event bus (DI-friendly)
5. Most recent/intentional design

### 2. Canonical Pattern: EventHub + Transport

**Rationale**:
1. Follows Pino/Winston ecosystem conventions
2. Bidirectional (not just one-way like renderers)
3. Composable via `.attach()` chaining
4. Clear separation: hub is the source, transports are destinations

### 3. Rename Types

| Current | New |
|---------|-----|
| `Transport` (interface) | `EventHub` |
| `Attachment` | `Transport` |
| `toAttachment()` | `toTransport()` |
| `IUnifiedRenderer` | `Renderer` |

### 4. Migration Path

```
Phase 1: Rename Types
├── Transport interface → EventHub
├── Attachment type → Transport
├── toAttachment() → toTransport()
└── Update all imports

Phase 2: Create Adapters
├── HarnessEvent → BaseEvent adapter
├── IHarnessRenderer → Transport wrapper
└── FluentHarnessEvent → BaseEvent mapper

Phase 3: Deprecate Legacy
├── Mark event-protocol.ts types as @deprecated
├── Mark IHarnessRenderer as @deprecated
├── Update TaskHarness to emit via UnifiedEventBus

Phase 4: Remove (major version)
├── Remove event-protocol.ts
├── Remove duplicate types from event-types.ts
├── Consolidate to single event system
```

---

## Consequences

### Positive
- Clear naming following industry patterns (Pino, Winston)
- Single source of truth for events
- Transports work across all harness types
- Cleaner API surface for SDK consumers
- Easier to document and teach

### Negative
- Breaking change for Transport interface consumers
- Breaking change for Attachment type consumers
- Migration effort required
- Adapters add temporary complexity

### Risks
- Subtle type incompatibilities may cause runtime issues
- Performance overhead from adapters (minor)

---

## Current File Map

### Keep (Canonical)
- `harness-instance.ts` - Fluent API runtime (update to implement EventHub)
- `define-renderer.ts` - Renderer factory (update toAttachment → toTransport)
- `event-context.ts` - Canonical event types
- `session-context.ts` - Interactive workflow context
- `async-queue.ts` - Message queue
- `control-flow.ts` - retry/parallel helpers
- `state.ts` - Generic persistent state
- `backoff.ts` - Rate limit utilities (keep calculateDelay, isRateLimitError)

### Adapt/Migrate
- `task-harness.ts` - Migrate to emit BaseEvent, use Transport pattern
- `console-renderer.ts` - Convert to Transport
- `base-renderer.ts` - Create adapter
- `event-protocol.ts` - Create mapper to BaseEvent

### Consolidate
- `event-types.ts` - Remove duplicates (SessionPromptEvent, NarrativeEvent)
- `renderer-interface.ts` - Merge into define-renderer.ts

### Deprecate (Phase 4)
- `composite-renderer.ts` - Use multiple transports instead
- `replay-controller.ts` - Update to use unified events
- `harness-recorder.ts` - Modernize or remove

---

## Action Items

1. [ ] Rename `Transport` interface → `EventHub` in types.ts
2. [ ] Rename `Attachment` type → `Transport` in types.ts
3. [ ] Rename `toAttachment()` → `toTransport()` in define-renderer.ts
4. [ ] Update HarnessInstance to `implements EventHub`
5. [ ] Create `eventAdapter.ts` with `toBaseEvent(harnessEvent: HarnessEvent): BaseEvent`
6. [ ] Create `rendererAdapter.ts` to wrap `IHarnessRenderer` as `Transport`
7. [ ] Add `@deprecated` JSDoc to legacy types
8. [ ] Update `index.ts` exports with clear naming
9. [ ] Update WHICH-API.md with new terminology
10. [ ] Create migration guide for SDK consumers

---

## Related

- [003-harness-renderer spec](../003-harness-renderer/)
- [007-fluent-harness-dx spec](../007-fluent-harness-dx/)
- [008-unified-event-system spec](../008-unified-event-system/)
- [010-transport-architecture spec](../010-transport-architecture/)
