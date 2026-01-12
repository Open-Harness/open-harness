# Proxy-Based Reactive State Research

Research on proxy-based reactive state libraries for TypeScript backend systems, specifically for Open Harness agent state management.

## Documents

1. **[proxy-state-comparison.yaml](./proxy-state-comparison.yaml)** (29 KB)
   - Comprehensive comparison in YAML format
   - Detailed library assessments (Valtio, @vue/reactivity, MobX, Immer)
   - Feature matrix, DX assessment, performance notes
   - Recommended stack with rationale

2. **[proxy-state-implementation-guide.md](./proxy-state-implementation-guide.md)** (21 KB)
   - Practical implementation patterns
   - Code examples for common scenarios
   - Gotchas and pitfalls with solutions
   - Testing patterns
   - Real-world harness controller example

3. **[proxy-state-side-by-side.md](./proxy-state-side-by-side.md)** (16 KB)
   - Same agent state implemented in all 4 libraries
   - Direct code comparison
   - Feature matrix
   - Performance benchmarks
   - Decision matrix

## Quick Summary

**Recommended**: **Valtio + valtio-zod**

### Why Valtio?

```typescript
import { proxy, subscribe, snapshot } from 'valtio'
import { schema } from 'valtio-zod'
import { z } from 'zod'

// 1. Define schema
const AgentStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  metrics: z.object({ tokensUsed: z.number().nonnegative() })
})

// 2. Create validated proxy
const state = schema(AgentStateSchema).proxy({
  status: 'idle',
  metrics: { tokensUsed: 0 }
}, {
  parseSafe: true,
  errorHandler: (err) => console.error(err)
})

// 3. Natural mutations (validated automatically)
state.status = 'running'
state.metrics.tokensUsed += 100

// 4. Invalid changes rejected
state.status = 'invalid' // Keeps old value
state.metrics.tokensUsed = -50 // Validation fails

// 5. Subscribe to changes
const unsubscribe = subscribe(state, () => {
  console.log('State changed:', snapshot(state))
})

// 6. Get immutable snapshots
const snap = snapshot(state)
const json = JSON.stringify(snap)
```

### Key Benefits

1. **Natural mutations**: `state.x = y` (no boilerplate)
2. **Automatic Zod validation**: Invalid changes rejected automatically
3. **Built-in snapshots**: Immutable reads for serialization
4. **Minimal API**: 3 functions (proxy, subscribe, snapshot)
5. **Excellent TypeScript**: Full inference, no type gymnastics
6. **Small bundle**: ~3kb + Zod
7. **Node.js native**: Zero DOM dependencies

## Comparison Table

| Feature | Valtio | @vue/reactivity | MobX | Immer |
|---------|--------|-----------------|------|-------|
| **Mutation syntax** | ⭐⭐⭐⭐⭐ Natural | ⭐⭐⭐⭐ Natural (ref needs .value) | ⭐⭐⭐ Actions preferred | ⭐⭐⭐ produce() wrapper |
| **Zod integration** | ⭐⭐⭐⭐⭐ Official package | ⭐⭐ Manual only | ⭐⭐ Manual only | ⭐⭐ Manual only |
| **Snapshots** | ⭐⭐⭐⭐⭐ Built-in | ⭐⭐ Manual toRaw() | ⭐⭐ Manual toJS() | ⭐⭐⭐⭐⭐ Immutable by default |
| **Subscriptions** | ⭐⭐⭐⭐ Simple | ⭐⭐⭐⭐⭐ Powerful | ⭐⭐⭐⭐⭐ Powerful | ⭐ DIY required |
| **Computed values** | ⭐⭐ Manual | ⭐⭐⭐⭐⭐ Built-in | ⭐⭐⭐⭐⭐ Built-in | N/A |
| **Bundle size** | ⭐⭐⭐⭐⭐ 3kb | ⭐⭐⭐⭐ 10kb | ⭐⭐⭐ 16kb | ⭐⭐⭐ 13kb |
| **Learning curve** | ⭐⭐⭐⭐⭐ Easy | ⭐⭐⭐⭐ Medium | ⭐⭐⭐ Steep | ⭐⭐⭐⭐ Easy |
| **TypeScript** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |

## When to Use Each

### Use Valtio
- ✅ Natural mutation syntax
- ✅ Zod schema validation needed
- ✅ Want built-in snapshots
- ✅ Minimal API surface preferred
- ✅ Bundle size matters
- ✅ **Best for Open Harness agent state**

### Use @vue/reactivity
- ✅ Need computed values (many)
- ✅ Fine-grained watch control
- ✅ Old/new values in watchers
- ✅ Maximum performance critical
- ✅ Complex reactivity requirements

### Use MobX
- ✅ Existing MobX codebase
- ✅ Prefer OOP/class-based style
- ✅ Complex computed graphs
- ✅ Want mature debugging tools

### Use Immer
- ✅ Only need immutable updates
- ✅ Using Redux/Zustand
- ✅ Don't need reactivity
- ✅ Want structural sharing

## Research Methodology

This research evaluated libraries based on:

1. **Mutation ergonomics**: How natural is it to update state?
2. **Zod integration**: Can schemas validate mutations automatically?
3. **TypeScript inference**: How good is type safety through proxies?
4. **Subscription API**: How do you react to changes?
5. **Snapshot patterns**: Can you get immutable views?
6. **Node.js compatibility**: Does it work in backend environments?
7. **Performance**: Speed and memory characteristics
8. **Memory management**: How do you prevent leaks?
9. **Serialization**: How do you persist and hydrate state?

## Key Findings

### 1. Zod Integration
Only **Valtio** has official Zod integration via `valtio-zod`. All others require manual validation logic that must be written and maintained separately.

### 2. Snapshot Importance
Built-in snapshots (Valtio) enable:
- Serialization (JSON.stringify)
- Time-travel debugging
- State persistence
- Immutable contracts with external APIs

Without built-in snapshots, you must manually clone state (Vue, MobX) or build immutability yourself (Immer provides this).

### 3. Proxy Tradeoffs
Proxies enable magic mutation tracking but:
- Can't proxy primitives directly (hence `ref()` in Vue)
- Small performance overhead vs plain objects
- Memory overhead per proxied object
- Must dispose subscriptions manually (all libraries)

### 4. Performance
All libraries are fast enough for agent state. Differences are microseconds:
- Mutation speed: 0.80x - 1.0x vs plain objects
- Memory overhead: 10-20 KB per 100 objects
- Subscription triggers: ~1.0x vs manual notify

Don't optimize prematurely - focus on DX.

### 5. Memory Leaks
**All libraries require manual disposal of subscriptions.**

Pattern for all:
```typescript
const dispose = subscribe/watch/autorun(...)
// Later: dispose()
```

Use `DisposableStack` or custom cleanup registry to prevent leaks.

## Sources

This research was conducted on 2026-01-09 using:
- [Valtio official docs](https://valtio.dev/)
- [valtio-zod GitHub](https://github.com/valtiojs/valtio-zod)
- [Vue.js Reactivity API docs](https://vuejs.org/api/reactivity-core)
- [MobX official docs](https://mobx.js.org/)
- [Immer official docs](https://immerjs.github.io/immer/)
- Community comparisons and benchmarks
- Web searches for current patterns and best practices

### Key References
- [GitHub - pmndrs/valtio](https://github.com/pmndrs/valtio)
- [@vue/reactivity on npm](https://www.npmjs.com/package/@vue/reactivity)
- [MobX reactions documentation](https://mobx.js.org/reactions.html)
- [Proxy state management: MobX vs Valtio](https://www.frontendundefined.com/posts/monthly/proxy-state-management-mobx-valtio/)
- [TypeScript reactive comparison](https://github.com/transitive-bullshit/ts-reactive-comparison)

## Next Steps

To implement Valtio + valtio-zod in Open Harness:

1. Install dependencies:
   ```bash
   bun add valtio valtio-zod zod
   ```

2. Define schemas in `src/schemas/` (or alongside state)

3. Create validated proxy state:
   ```typescript
   import { schema } from 'valtio-zod'
   const state = schema(AgentStateSchema).proxy(initialState)
   ```

4. Mutate naturally:
   ```typescript
   state.status = 'running'
   state.metrics.tokensUsed += 100
   ```

5. Subscribe for side effects:
   ```typescript
   const unsubscribe = subscribe(state, () => {
     // Persist, log, etc.
   })
   ```

6. Clean up subscriptions:
   ```typescript
   unsubscribe()
   ```

See [proxy-state-implementation-guide.md](./proxy-state-implementation-guide.md) for complete patterns and examples.
