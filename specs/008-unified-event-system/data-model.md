# Data Model: Unified Event System

**Feature**: 008-unified-event-system
**Date**: 2025-12-27
**Status**: Complete

## Entity Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           UnifiedEventBus                                 │
│  ┌─────────────────┐    ┌───────────────────┐    ┌──────────────────┐    │
│  │ AsyncLocalStorage│───▶│   EventContext    │───▶│  EnrichedEvent   │    │
│  │    <context>     │    │ (session/phase/   │    │  (id, timestamp, │    │
│  │                  │    │  task/agent)      │    │   context, event)│    │
│  └─────────────────┘    └───────────────────┘    └──────────────────┘    │
│                                                            │              │
│                                                            ▼              │
│  ┌─────────────────┐                            ┌──────────────────┐     │
│  │   Subscription  │◀───────────────────────────│    BaseEvent     │     │
│  │   (filter,      │                            │ (workflow/agent/ │     │
│  │    listener)    │                            │  narrative/      │     │
│  │                 │                            │  session)        │     │
│  └─────────────────┘                            └──────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           Renderer System                                 │
│  ┌─────────────────┐    ┌───────────────────┐    ┌──────────────────┐    │
│  │ defineRenderer()│───▶│RendererDefinition │───▶│ IUnifiedRenderer │    │
│  │    (factory)    │    │ (name, state, on, │    │  (attach/detach/ │    │
│  │                 │    │  hooks)           │    │   lifecycle)     │    │
│  └─────────────────┘    └───────────────────┘    └──────────────────┘    │
│                                    │                                      │
│                                    ▼                                      │
│                         ┌───────────────────┐    ┌──────────────────┐    │
│                         │  RenderContext    │───▶│   RenderOutput   │    │
│                         │ (state, event,    │    │ (line, update,   │    │
│                         │  emit, config)    │    │  spinner, etc.)  │    │
│                         └───────────────────┘    └──────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### 1. EventContext

Context metadata attached to events. Propagated via AsyncLocalStorage.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | `string` | Yes | Set at bus creation, unique per run |
| phase | `{ name: string; number?: number }` | No | Active phase scope |
| task | `{ id: string; description?: string }` | No | Active task scope |
| agent | `{ name: string; type?: string }` | No | Active agent scope |

**Validation Rules**:
- `sessionId` must be a valid UUID string
- Nested scopes merge (inner overrides outer on conflicts)
- Empty context contains only `{ sessionId }`

**State Transitions**:
```
Empty → +session → +phase → +task → +agent
                         ↓
                    phase:complete → -task, -agent
```

---

### 2. EnrichedEvent<T>

Envelope wrapping any event with metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Unique event identifier (UUID) |
| timestamp | `Date` | Yes | When event was emitted |
| context | `EventContext` | Yes | Inherited + override context |
| event | `T extends BaseEvent` | Yes | Original event payload |

**Validation Rules**:
- `id` must be a valid UUIDv4
- `timestamp` must be a valid Date object
- `context` inherits from AsyncLocalStorage, override wins on conflicts
- `event` must have `type` discriminator field

---

### 3. BaseEvent (Union Type)

Discriminated union of all known event types.

#### 3.1 Workflow Events

| Type | Fields | Description |
|------|--------|-------------|
| `harness:start` | `tasks: ParsedTask[]`, `sessionId: string`, `mode: 'live' \| 'replay'` | Harness run begins |
| `harness:complete` | `summary: HarnessSummary` | Harness run ends |
| `phase:start` | `name: string`, `phaseNumber?: number` | Phase begins |
| `phase:complete` | `phaseNumber?: number` | Phase ends |
| `task:start` | `taskId: string` | Task begins |
| `task:complete` | `taskId: string`, `result?: unknown` | Task succeeds |
| `task:failed` | `taskId: string`, `error: string`, `stack?: string` | Task fails |

#### 3.2 Agent Events

| Type | Fields | Description |
|------|--------|-------------|
| `agent:start` | `agentName: string` | Agent session begins |
| `agent:thinking` | `content: string` | Agent reasoning output |
| `agent:text` | `content: string` | Agent text output |
| `agent:tool:start` | `toolName: string`, `input: unknown` | Tool call begins |
| `agent:tool:complete` | `toolName: string`, `result: unknown`, `isError?: boolean` | Tool call ends |
| `agent:complete` | `agentName: string`, `success: boolean` | Agent session ends |

#### 3.3 Narrative Events

| Type | Fields | Description |
|------|--------|-------------|
| `narrative` | `text: string`, `importance: 'critical' \| 'important' \| 'detailed'` | Human-readable progress |

#### 3.4 Session Events (Future)

| Type | Fields | Description |
|------|--------|-------------|
| `session:prompt` | `prompt: string` | User prompt input |
| `session:reply` | `reply: string` | Agent reply output |
| `session:abort` | `reason: string` | Session aborted |

#### 3.5 Extension Pattern

| Type | Fields | Description |
|------|--------|-------------|
| Custom | `type: string`, `[key: string]: unknown` | User-defined events |

**Validation Rules**:
- All events MUST have `type` field for discrimination
- Event type follows hierarchical naming: `category:action` or `category:subcategory:action`
- Extension events MUST NOT use reserved prefixes (`harness:`, `phase:`, `task:`, `agent:`, `narrative`, `session:`)

---

### 4. UnifiedEventBus

Central event infrastructure with AsyncLocalStorage context propagation.

| Method | Signature | Description |
|--------|-----------|-------------|
| `scoped` | `<T>(ctx: Partial<EventContext>, fn: () => T \| Promise<T>): T \| Promise<T>` | Execute with context |
| `emit` | `(event: BaseEvent, override?: Partial<EventContext>): void` | Emit event with auto-context |
| `subscribe` | `(filter?: string \| string[], listener: Listener): Unsubscribe` | Subscribe to events |
| `current` | `(): EventContext` | Get current context |
| `clear` | `(): void` | Remove all subscribers |

**Validation Rules**:
- Constructor MUST throw if AsyncLocalStorage unavailable
- `emit()` auto-attaches context from AsyncLocalStorage
- `subscribe()` with no filter equals `'*'` (all events)
- Listener errors logged but do NOT crash emission

**State Transitions**:
```
created → scoped() → [nested scopes] → emit() → deliver to subscribers
                                              ↓
                                         scope exits → context reverts
```

---

### 5. IUnifiedRenderer

Interface for renderers consuming unified events.

| Method | Signature | Description |
|--------|-----------|-------------|
| `attach` | `(bus: UnifiedEventBus): void` | Connect to event bus |
| `detach` | `(): void` | Disconnect from event bus |
| `onStart` | `(context: RenderContext): void` | Called when harness starts |
| `onComplete` | `(context: RenderContext): void` | Called when harness completes |

---

### 6. RendererDefinition<TState>

Configuration object for `defineRenderer()` factory.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | `string` | Yes | Renderer identifier |
| state | `() => TState` | No | Initial state factory |
| on | `Record<string, EventHandler<TState>>` | Yes | Event handlers by type |
| onStart | `(ctx: RenderContext<TState>) => void` | No | Lifecycle hook |
| onComplete | `(ctx: RenderContext<TState>) => void` | No | Lifecycle hook |

**Validation Rules**:
- `name` must be non-empty string
- `on` keys must be valid event type patterns (exact or wildcard)
- State factory is called fresh for each `attach()`

---

### 7. RenderContext<TState>

Object passed to event handlers.

| Field | Type | Description |
|-------|------|-------------|
| state | `TState` | Mutable renderer state |
| event | `EnrichedEvent<BaseEvent>` | Current event being handled |
| emit | `(type: string, data: unknown) => void` | Emit custom events |
| config | `RendererConfig` | Renderer configuration |
| output | `RenderOutput` | Terminal output helpers |

---

### 8. RenderOutput

Output helpers for terminal rendering.

| Method | Signature | Description |
|--------|-----------|-------------|
| `line` | `(text: string): void` | Write line to output |
| `update` | `(lineId: string, text: string): void` | Update existing line |
| `spinner` | `(text: string): Spinner` | Show spinner with text |
| `progress` | `(current: number, total: number): void` | Show progress bar |
| `clear` | `(): void` | Clear output |
| `newline` | `(): void` | Add blank line |

---

## Entity Relationships

```
UnifiedEventBus 1──────────* Subscription
       │
       ├─────────────────────1 AsyncLocalStorage<EventContext>
       │
       └─────────emit────────* EnrichedEvent<T>
                                    │
                                    ├──1 EventContext
                                    │
                                    └──1 BaseEvent (discriminated union)
                                              │
                                              ├── WorkflowEvent
                                              ├── AgentEvent
                                              ├── NarrativeEvent
                                              ├── SessionEvent
                                              └── ExtensionEvent

defineRenderer() ─────────▶ RendererDefinition ─────────▶ IUnifiedRenderer
                                    │
                                    └──on handlers receive──▶ RenderContext
                                                                   │
                                                                   └──output──▶ RenderOutput
```

---

## Integration Points

### With Existing EventBus

```
UnifiedEventBus ─────wraps────▶ EventBus (legacy)
       │                              │
       ├──emit(AgentEvent)───forward──┤  (Phase 1-4)
       │                              │
       └──deprecate──────────remove───┘  (Phase 5)
```

### With HarnessInstance

```
HarnessInstance
       │
       ├──.on() ───delegates to───▶ UnifiedEventBus.subscribe()
       │
       ├──phase() ───calls───▶ UnifiedEventBus.scoped({ phase })
       │
       └──task() ───calls───▶ UnifiedEventBus.scoped({ task })
```

### With Agents

```
BaseAnthropicAgent
       │
       ├──inject───▶ IUnifiedEventBusToken
       │
       └──emit(agent:*) ───through───▶ UnifiedEventBus
                                              │
                                              └──context.task auto-attached from scope
```
