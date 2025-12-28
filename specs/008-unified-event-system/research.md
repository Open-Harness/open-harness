# Research: Unified Event System

**Feature**: 008-unified-event-system
**Date**: 2025-12-27
**Status**: Complete

## Research Summary

Three key unknowns were investigated before implementation planning:

| Unknown | Decision | Confidence |
|---------|----------|------------|
| AsyncLocalStorage with Promise.all | Works correctly - isolated context per branch | High |
| Integration strategy | UnifiedEventBus wraps EventBus (gradual migration) | High |
| Filter pattern matching | Custom glob-style prefix matching (no deps) | High |

---

## R1: AsyncLocalStorage with Promise.all

### Decision

**YES** - AsyncLocalStorage correctly maintains context isolation in `Promise.all()` when each parallel branch is wrapped in its own `run()` call.

### Rationale

AsyncLocalStorage uses Node.js's `async_hooks` API to track asynchronous execution contexts:

1. Each `asyncLocalStorage.run(context, fn)` call creates a new isolated context store
2. All async operations initiated WITHIN that fn automatically inherit that context
3. `Promise.all()` creates multiple concurrent promises, but each inherits the context from the `run()` scope that created it
4. The async_hooks mechanism tracks the async execution chain, preserving context across await boundaries

**Key insight**: The `run()` method "runs a function synchronously within a context and returns its return value. The store is not accessible outside of the callback function. The store is accessible to any asynchronous operations created within the callback."

This guarantees that:
```typescript
await Promise.all([
  bus.scoped({ task: { id: 'T1' } }, async () => { /* all events get T1 */ }),
  bus.scoped({ task: { id: 'T2' } }, async () => { /* all events get T2 */ }),
  bus.scoped({ task: { id: 'T3' } }, async () => { /* all events get T3 */ })
])
```

Each `scoped()` creates a separate AsyncLocalStorage context, and `Promise.all()` simply waits for all three independent contexts to complete - no sharing occurs.

**Performance**: ~5-10% CPU/memory overhead is acceptable per spec assumptions.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Continuation-Local Storage (cls-hooked) | Deprecated; AsyncLocalStorage is official Node.js recommendation since v12.17.0 |
| Manual context passing | Massive API surface changes; violates "automatic" context propagation goal |
| Zone.js (Angular) | Monkey-patches async primitives; not designed for Node.js server environments |
| Request-scoped DI containers | Requires framework buy-in; doesn't solve agent event use case |

### Implementation Pattern

```typescript
class UnifiedEventBus {
  private storage = new AsyncLocalStorage<EventContext>();

  scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T> {
    const parentContext = this.storage.getStore() || {};
    const mergedContext = { ...parentContext, ...context };
    return this.storage.run(mergedContext, fn);
  }

  current(): EventContext {
    return this.storage.getStore() || { sessionId: this.sessionId };
  }
}
```

---

## R2: EventBus Integration Strategy

### Decision

**UnifiedEventBus wraps EventBus internally** (Option 2) with a legacy adapter for backward compatibility.

### Rationale

This approach is superior for this specific context because:

1. **Clean Phase 1 Coexistence**: UnifiedEventBus can internally forward agent events to the legacy EventBus during migration, allowing both systems to operate simultaneously.

2. **AsyncLocalStorage Integration**: Wrapping allows UnifiedEventBus to be a clean implementation with AsyncLocalStorage at its core, while EventBus remains unchanged.

3. **Backward Compatibility (FR-007)**: `HarnessInstance.on()` can be adapted to subscribe to UnifiedEventBus with a simple mapping layer.

4. **Migration Path Alignment**:
   - Phase 1: UnifiedEventBus wraps EventBus, both active
   - Phase 2: Agents inject UnifiedEventBus via new token, still publish to old bus via wrapper
   - Phase 3: HarnessInstance uses UnifiedEventBus internally, `.on()` becomes thin wrapper
   - Phase 4: `defineRenderer()` API uses pure UnifiedEventBus
   - Phase 5: Remove wrapper forwarding, deprecate EventBus token

5. **DI Token Strategy**: Create `IUnifiedEventBusToken` separate from `IEventBusToken`.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| UnifiedEventBus extends EventBus | Couples to implementation details; breaks SOLID; can't have both tokens in DI |
| EventBus delegates to UnifiedEventBus | Modifies stable legacy code; violates Open/Closed Principle |
| Complete replacement with adapter | No gradual migration; contradicts Migration Path Phase 1 |

### Implementation Sketch

```typescript
class UnifiedEventBus {
  constructor(
    private legacyBus: IEventBus | null = inject(IEventBusToken, { optional: true }) ?? null,
    private storage = new AsyncLocalStorage<EventContext>()
  ) {}

  emit(event: BaseEvent, override?: Partial<EventContext>): void {
    const enriched = this.enrich(event, override);
    this.deliverToSubscribers(enriched);

    // PHASE 1 ONLY: Forward agent events to legacy bus
    if (this.legacyBus && isAgentEvent(event)) {
      this.legacyBus.publish(event as AgentEvent);
    }
  }
}
```

---

## R3: Event Filter Pattern Matching

### Decision

**Custom glob-style prefix matching** using simple string operations (~20 lines, zero dependencies).

### Rationale

1. **Performance**: O(n*p*k) where n=listeners, p=patterns, k=pattern length. Acceptable for <1000 listeners.

2. **Syntax Simplicity**: The spec shows three filter patterns needed:
   - `'*'` → match all events
   - `'task:*'` → prefix matching
   - `['task:start', 'agent:tool:*']` → array of mixed patterns

3. **Zero Dependencies**: Existing EventBus uses zero dependencies. Adding picomatch/micromatch would introduce unnecessary weight.

4. **TypeScript-First**: Full type safety on event type strings.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| picomatch library | 19KB dependency for 20-line functionality; overkill for simple prefix matching |
| Full regex patterns | Poor DX; error-prone; users would write `/^task:.*/` instead of `'task:*'` |
| EventEmitter2 library | 15KB+ dependency; requires converting to namespaced format; unused features |

### Implementation

```typescript
function matchesFilter(eventType: string, filter: string | string[]): boolean {
  const patterns = Array.isArray(filter) ? filter : [filter];

  return patterns.some(pattern => {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return eventType.startsWith(pattern.slice(0, -1));
    }
    return eventType === pattern;
  });
}
```

### Performance Analysis

| Metric | Value |
|--------|-------|
| Time complexity per emit | O(L × P × K) |
| Typical case | 5 listeners × 3 patterns × 15 chars = 225 comparisons |
| Per-event overhead | ~225ns (negligible) |
| For 1000-event workflow | ~0.5ms total overhead |

**Scalability limit**: Becomes problematic at >100 listeners with >20 patterns each. Not a concern for this system (max ~10 renderers typically).

---

## Sources

- [Node.js AsyncLocalStorage Documentation](https://nodejs.org/api/async_context.html)
- [Asynchronous Context Isolation in NodeJS](https://medium.com/@not.achraf/asynchronous-context-isolation-in-nodejs-and-why-you-should-know-about-it-1b9b03c2fb2d)
- [AsyncLocalStorage in Node.js 2025: Context Propagation](https://medium.com/@asierr/asynclocalstorage-in-node-js-2025-your-secret-weapon-for-context-propagation-%EF%B8%8F-a0e8ca9deef6)
- [How to Implement an Event Bus in TypeScript - This Dot Labs](https://www.thisdot.co/blog/how-to-implement-an-event-bus-in-typescript)
- [Implementing Design Patterns in TypeScript: Delegation, Observer, Interceptor](https://medium.com/swlh/implementing-known-design-patterns-in-typescript-delegation-observer-and-interceptor-b18ea385f4c6)
- [EventEmitter2: Node.js Event Emitter with Wildcards](https://github.com/EventEmitter2/EventEmitter2)
- [Picomatch: Blazing Fast Glob Matcher](https://github.com/micromatch/picomatch)
