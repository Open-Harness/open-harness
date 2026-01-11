# Milestone 2: Execution

**Status:** Planned
**Goal:** Multi-agent workflows with state integration and parallelism.

---

## Exit Criteria

All must pass before moving to Milestone 3:

- [ ] Multiple agents pass signals to each other
- [ ] State changes emit signals automatically (Zustand integration)
- [ ] `state:X:changed` signals trigger agent activation
- [ ] Parallel execution works (multiple agents on same signal)
- [ ] Quiescence detection works (know when workflow is done)
- [ ] `reactive()` API is complete and usable
- [ ] All tests pass, no regressions

---

## Epics

| ID | Epic | Scope | Complexity |
|----|------|-------|------------|
| E1 | Multi-Agent Signals | Signal passing, causality | Medium |
| E2 | State as Signals | Zustand, auto-emit, templates | High |
| E3 | Parallel Execution | Concurrent activation, quiescence | High |
| E4 | Reactive Graph API | Full `reactive()`, migration adapter | Medium |

---

## What Ships

At the end of Execution:

1. **New files:**
   - `src/reactive/graph.ts` - `reactive()` function
   - `src/reactive/runtime.ts` - ReactiveRuntime
   - `src/state/proxy.ts` - State-to-signal proxy
   - `src/state/zustand.ts` - Zustand integration

2. **Updated files:**
   - `src/signals/bus.ts` - Parallel dispatch, quiescence
   - `src/reactive/run.ts` - Multi-agent support

3. **Tests:**
   - Multi-agent signal passing
   - State mutation → signal tests
   - Parallel execution verification
   - Complex workflow tests

---

## Success Demo

```typescript
// This should work at end of Execution:
const tradingBot = reactive({
  agents: { analyst, trader, reviewer },
  createState: createTradeStore,
  endWhen: (state) => state.trades.some(t => t.executed),
});

// State changes trigger signals
store.getState().updateAnalysis({ confidence: 85 });
// → emits "state:analysis:changed"
// → trader activates (subscribes to analysis changes)

// Parallel execution
// Both analyst and riskAnalyzer subscribe to "flow:start"
// Both run concurrently

// Quiescence
// Runtime waits until no pending signals and no active nodes
const result = await runReactive(tradingBot, { input: "..." });
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Race conditions in parallel | Careful state isolation |
| Zustand integration complexity | Spike first, then implement |
| Quiescence edge cases | Comprehensive test suite |
| Performance with many signals | Benchmark, optimize |

---

## Dependencies

- Milestone 1: Foundation (F1, F2, F3)

---

## Estimated Duration

3-4 weeks
