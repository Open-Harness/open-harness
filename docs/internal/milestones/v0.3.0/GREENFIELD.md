# v0.3.0 Greenfield Rewrite

**Status:** Planning
**Approach:** Clean break - delete old, build new

---

## Overview

v0.3.0 is a complete rewrite. No migration, no backward compatibility. We delete the existing DAG-based core and replace it with a signal-based reactive system.

**Why clean break:**
- Pre-alpha, no external users
- ~1,000+ LOC of obsolete orchestration code
- Signal paradigm is fundamentally different
- Cleaner to start fresh than refactor

---

## What Gets Deleted

```
packages/internal/core/src/
├── runtime/
│   ├── compiler/           # DELETE - Graph compilation
│   │   ├── compiler.ts     #   GraphCompiler, adjacency maps
│   │   └── scheduler.ts    #   Topological sort, nextReadyNodes
│   ├── execution/          # DELETE - DAG execution
│   │   ├── runtime.ts      #   Main loop, edge evaluation
│   │   └── executor.ts     #   Keep concepts, rewrite for signals
│   └── expressions/        # KEEP - Bindings still needed
│       ├── bindings.ts
│       └── when.ts         # DELETE - Edge conditions gone
├── state/
│   ├── types.ts            # REWRITE - Remove EdgeDefinition, simplify
│   ├── snapshot.ts         # REWRITE - Remove edgeStatus, loopCounters
│   └── state.ts            # KEEP - StateStore interface
├── api/
│   ├── harness.ts          # DELETE - Edges gone, replaced by reactive()
│   ├── agent.ts            # REWRITE - Add activateOn/emits
│   └── run.ts              # REWRITE - runReactive()
└── recording/              # REWRITE - Signal log format
```

**Estimated deletion:** ~1,500 LOC
**Estimated new code:** ~900 LOC
**Net reduction:** ~40% smaller core

---

## New Structure

```
packages/internal/core/src/
├── signals/                    # NEW - Core primitive
│   ├── types.ts                # Signal<T>, SignalRef
│   ├── bus.ts                  # SignalBus
│   └── index.ts
│
├── agents/                     # REWRITTEN
│   ├── types.ts                # AgentConfig with activateOn/emits
│   ├── agent.ts                # agent() factory
│   └── index.ts
│
├── state/                      # SIMPLIFIED
│   ├── types.ts                # StateFactory (Zustand)
│   ├── proxy.ts                # Auto-emit on change
│   └── index.ts
│
├── reactive/                   # NEW - Replaces runtime/
│   ├── types.ts                # ReactiveGraph, ReactiveResult
│   ├── graph.ts                # reactive() factory
│   ├── dispatcher.ts           # Signal dispatch loop
│   └── index.ts
│
├── recording/                  # SIMPLIFIED
│   ├── types.ts                # SignalRecording
│   ├── recorder.ts             # Append to signal log
│   ├── replayer.ts             # Inject provider responses
│   └── index.ts
│
├── providers/                  # UNCHANGED
│   └── types.ts
│
├── bindings/                   # KEPT from runtime/expressions
│   └── bindings.ts
│
├── api/                        # PUBLIC SURFACE
│   ├── run.ts                  # runReactive()
│   ├── defaults.ts             # setDefaultProvider()
│   └── index.ts
│
└── index.ts                    # Re-exports
```

---

## Public API (Final)

```typescript
// === Core Primitives ===
export { signal } from "./signals";
export { agent } from "./agents";
export { reactive, runReactive } from "./reactive";

// === Types ===
export type { Signal, SignalBus } from "./signals";
export type { AgentConfig } from "./agents";
export type { ReactiveGraph, ReactiveResult } from "./reactive";
export type { SignalRecording } from "./recording";

// === Configuration ===
export { setDefaultProvider, setDefaultStore } from "./api/defaults";
```

**That's it.** Three functions: `signal()`, `agent()`, `reactive()`. One runner: `runReactive()`.

---

## Implementation Order

### Week 1-2: Signals + Agents
```
1. Delete old runtime/, keep shell
2. Implement signals/types.ts
3. Implement signals/bus.ts
4. Rewrite agents/types.ts (add activateOn/emits)
5. Rewrite agents/agent.ts
6. Unit tests for SignalBus
```

### Week 3-4: Reactive Runtime
```
1. Implement reactive/types.ts
2. Implement reactive/dispatcher.ts
3. Implement reactive/graph.ts (reactive factory)
4. Implement state/proxy.ts (Zustand + auto-emit)
5. Integration tests: multi-agent signal passing
```

### Week 5: Recording
```
1. Rewrite recording/types.ts (signal log format)
2. Implement recording/recorder.ts
3. Implement recording/replayer.ts
4. Fixture tests
```

### Week 6: Polish
```
1. Implement api/run.ts (runReactive)
2. Update server package for signals
3. Trading agent example
4. Documentation
```

---

## Files to Delete (Day 1)

These files are deleted at the start of v0.3.0 work:

```bash
# Graph compilation (obsolete)
rm -rf packages/internal/core/src/runtime/compiler/

# Edge evaluation (obsolete)
rm packages/internal/core/src/runtime/expressions/when.ts

# Old API
rm packages/internal/core/src/api/harness.ts
```

These files are gutted and rewritten:

```bash
# Keep file, rewrite contents
packages/internal/core/src/state/types.ts      # Remove EdgeDefinition
packages/internal/core/src/state/snapshot.ts   # Remove edgeStatus, loopCounters
packages/internal/core/src/api/run.ts          # runReactive instead of run
packages/internal/core/src/api/agent.ts        # Add activateOn/emits
packages/internal/core/src/recording/types.ts  # Signal log format
```

---

## No Migration

- No `harnessToReactive()` adapter
- No deprecation warnings
- No v0.2.0 → v0.3.0 guide
- Old API simply stops existing
- Examples rewritten from scratch

---

## Success Criteria

v0.3.0 is done when:

1. [ ] Old runtime/ deleted
2. [ ] SignalBus works with pattern matching
3. [ ] Agents activate on signals
4. [ ] State changes emit signals
5. [ ] Parallel execution works
6. [ ] Recording is signal log
7. [ ] Replay is deterministic
8. [ ] Trading example complete
9. [ ] All tests pass
10. [ ] Core is <1,000 LOC
