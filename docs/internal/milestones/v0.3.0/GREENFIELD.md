# v0.3.0 Greenfield Rewrite

**Status:** Planning
**Approach:** Clean break - delete old, build new from first principles

---

## Overview

v0.3.0 is a complete rewrite built on first principles:

1. **One primitive**: Signals
2. **One runtime**: SignalBus (internal)
3. **One interface**: Provider (what AI SDKs implement)
4. **One system**: Harness (what users configure)

**Why clean break:**
- Pre-alpha, no external users
- Signal paradigm is fundamentally different
- Current architecture is over-engineered (traits + adapters + registries + nodes + edges)
- Cleaner to start fresh than refactor

---

## What Gets Deleted

### Provider Layer (Simplified)

```
packages/internal/core/src/providers/
├── trait.ts              # DELETE - replaced by simpler Provider interface
├── adapter.ts            # DELETE - no adapters needed
├── context.ts            # SIMPLIFY - RunContext is minimal
├── events.ts             # DELETE - providers yield Signals directly
├── errors.ts             # KEEP - ProviderError still useful
└── types.ts              # REWRITE - Provider interface

packages/internal/core/src/nodes/
├── registry.ts           # DELETE - pass providers directly
└── types.ts              # DELETE - no node concept
```

### Runtime Layer (Replaced by SignalBus)

```
packages/internal/core/src/runtime/
├── compiler/             # DELETE - Graph compilation
│   ├── compiler.ts       #   GraphCompiler, adjacency maps
│   └── scheduler.ts      #   Topological sort, nextReadyNodes
├── execution/            # DELETE - DAG execution
│   ├── runtime.ts        #   Main loop, edge evaluation
│   └── executor.ts       #   Replaced by SignalBus
├── expressions/          # KEEP - Template bindings still needed
│   ├── bindings.ts
│   └── when.ts           # DELETE - Edge conditions gone
└── events.ts             # DELETE - RuntimeEventPayload gone
```

### State Layer (Simplified)

```
packages/internal/core/src/state/
├── types.ts              # REWRITE - Remove EdgeDefinition, Node types
├── snapshot.ts           # DELETE - No snapshots, just signals
└── state.ts              # REWRITE - Zustand + auto-emit
```

### API Layer (Rewritten)

```
packages/internal/core/src/api/
├── harness.ts            # DELETE - replaced by createHarness()
├── agent.ts              # REWRITE - Add activateOn/emits/provider
├── run.ts                # REWRITE - Simple run against provider
└── defaults.ts           # KEEP - setDefaultProvider()
```

### Recording Layer (Simplified)

```
packages/internal/core/src/recording/
├── types.ts              # REWRITE - Recording = Signal[]
├── recorder.ts           # SIMPLIFY - Just append signals
└── replayer.ts           # SIMPLIFY - Inject provider responses
```

**Estimated deletion:** ~2,500 LOC
**Estimated new code:** ~500-800 LOC
**Net reduction:** ~70-80% smaller core

---

## New Package Structure

```
packages/
├── core/                           # @open-harness/core
│   └── src/
│       ├── signal.ts               # Signal type
│       ├── provider.ts             # Provider interface
│       ├── harness.ts              # Harness interface
│       ├── errors.ts               # ProviderError (kept)
│       └── index.ts
│
├── signals/                        # @open-harness/signals
│   └── src/
│       ├── bus.ts                  # SignalBus (internal routing)
│       ├── store.ts                # SignalStore interface
│       ├── snapshot.ts             # snapshot() derivation
│       ├── player.ts               # Player API (step, rewind, goto)
│       └── index.ts
│
├── stores/
│   ├── signal-store-memory/        # @open-harness/signal-store-memory
│   │   └── src/
│   │       └── memory-signal-store.ts
│   │
│   ├── signal-store-sqlite/        # @open-harness/signal-store-sqlite
│   │   └── src/
│   │       └── sqlite-signal-store.ts
│   │
│   └── signal-store-testing/       # @open-harness/signal-store-testing
│       └── src/
│           └── contracts/
│               └── signal-store-contract.ts
│
├── providers/
│   ├── claude/                     # @open-harness/provider-claude
│   │   └── src/
│   │       ├── claude-provider.ts
│   │       └── index.ts
│   │
│   └── openai/                     # @open-harness/provider-openai
│       └── src/
│           ├── openai-provider.ts
│           └── index.ts
│
├── harness/                        # @open-harness/harness
│   └── src/
│       ├── create-harness.ts       # Factory function
│       ├── agent.ts                # agent() with activateOn/emits
│       ├── run.ts                  # Run execution
│       ├── state.ts                # createReactiveStore (Zustand + auto-emit)
│       ├── telemetry.ts            # Wide event subscriber
│       └── index.ts
│
├── testing/
│   └── vitest/                     # @open-harness/signals-vitest
│       └── src/
│           ├── matchers.ts         # toMatchSignal, toMatchTrajectory, etc.
│           ├── player.ts           # createPlayer() for tests
│           ├── snapshot.ts         # snapshot helpers
│           ├── test-harness.ts     # createTestHarness()
│           └── index.ts
│
└── examples/
    ├── hello-world/                # Simple single agent
    ├── trading-bot/                # Flagship multi-agent example
    ├── multi-provider/             # Claude + OpenAI
    └── recording-replay/           # Recording and replay demo
```

**Key Changes from v0.2.0:**
- Monorepo packages instead of internal/core, internal/server split
- Unified signal-store replaces run-store + recording-store
- Dedicated provider packages
- Dedicated testing package with Vitest matchers

---

## Public API (Final)

```typescript
// === Core Primitives ===
export { signal } from "./signals";
export { agent } from "./agents";
export { createHarness } from "./harness";

// === Types ===
export type { Signal, SignalBus } from "./signals";
export type { Provider, ProviderInput, ProviderOutput, RunContext } from "./providers";
export type { AgentConfig, Agent } from "./agents";
export type { Harness, HarnessConfig, HarnessResult } from "./harness";
export type { Recording } from "./recording";

// === Configuration ===
export { setDefaultProvider } from "./api/defaults";

// === Running ===
export { run } from "./api/run";
```

**That's it.** Three factories: `signal()`, `agent()`, `createHarness()`. One runner: `run()`.

---

## Implementation Order

### Phase 0: Core Infrastructure
```
P0-1. Signal Primitives (Signal type, SignalBus)
P0-2. Provider Interface (Provider, ProviderInput/Output, RunContext)
P0-3. SignalStore & Recording (MemorySignalStore, SqliteSignalStore, Snapshot, Player)
P0-4. Claude Provider Migration (new interface, streaming signals)
P0-5. OpenAI Provider (validate abstraction with second SDK)

Quality Gate: Both providers pass same test suite, cross-provider recording works
```

### Milestone 1: Agent Foundation
```
F1. Basic Reactive Agent (activateOn, emits, when, per-agent provider)
F2. Template Expansion ({{ state.x }} in prompts)

Quality Gate: Single agent tests pass, guard conditions work
```

### Milestone 2: Execution
```
E1. Multi-Agent Signals (signal passing, causality tracking)
E2. State as Signals (Zustand + auto-emit)
E3. Parallel Execution (concurrent activation, quiescence)
E4. Harness API (createHarness())
E5. Telemetry (wide events derived from signals)

Quality Gate: Multi-agent, state, parallel, harness, telemetry tests pass
```

### Milestone 3: Integration
```
I1. Signal-Based Reporters (subscribe patterns)
I2. Vitest Integration (@open-harness/signals-vitest)
I3. Provider Signal Schema (consistent signals across providers)

Quality Gate: All tests pass, typecheck, lint
```

### Milestone 4: Polish
```
P1. Examples Update (all examples rewritten)
P2. Documentation Cleanup (delete old, start fresh)
P3. Internal Documentation (README in every folder)
P4. Cleanup & Deletion (remove old stores, providers, code)

Quality Gate: Build, docs build, manual walkthrough
```

---

## Files/Packages to Delete

### At End of Sprint (Milestone 4: P4)

```bash
# Old stores (replaced by signal-store)
rm -rf packages/stores/run-store/
rm -rf packages/stores/recording-store/

# Old provider abstractions
rm packages/internal/core/src/providers/trait.ts
rm packages/internal/core/src/providers/adapter.ts

# Node/Registry (no graphs)
rm -rf packages/internal/core/src/nodes/

# Graph compilation (obsolete)
rm -rf packages/internal/core/src/runtime/compiler/

# Edge evaluation (obsolete)
rm packages/internal/core/src/runtime/expressions/when.ts

# Old runtime events
rm packages/internal/core/src/runtime/events.ts

# Old harness API
rm packages/internal/core/src/api/harness.ts

# Old documentation (start fresh)
# DELETE all v0.2.0 docs content from docs site
# DELETE 020, 030 versioned sections
```

### Files to Rewrite (not delete)

```bash
# Keep file, rewrite contents
packages/internal/core/src/state/types.ts      # Remove EdgeDefinition
packages/internal/core/src/state/snapshot.ts   # Remove entirely (signals replace)
packages/internal/core/src/api/run.ts          # Simplified run
packages/internal/core/src/api/agent.ts        # Add activateOn/emits/provider
packages/internal/core/src/recording/types.ts  # Recording = Signal[]
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

### Phase 0
1. [ ] Signal type and SignalBus work
2. [ ] Provider interface works with Claude + OpenAI
3. [ ] SignalStore (memory + SQLite) works
4. [ ] Snapshot and Player APIs work
5. [ ] Cross-provider recording/replay works

### Milestones 1-2
6. [ ] Agents activate on signals with guards
7. [ ] Per-agent provider override works
8. [ ] State changes emit signals
9. [ ] Parallel execution works
10. [ ] Telemetry emits wide events

### Milestones 3-4
11. [ ] @open-harness/signals-vitest matchers work
12. [ ] All examples updated and working
13. [ ] Documentation completely rewritten (clean slate)
14. [ ] Old stores deleted (run-store, recording-store)
15. [ ] All tests pass
16. [ ] Core is <1,000 LOC
