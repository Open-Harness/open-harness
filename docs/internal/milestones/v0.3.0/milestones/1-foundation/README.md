# Milestone 1: Foundation

**Status:** Planned
**Goal:** Prove the signal-based model works with a single reactive agent.

---

## Exit Criteria

All must pass before moving to Milestone 2:

- [ ] `SignalBus` dispatches signals correctly
- [ ] Single agent activates on `flow:start` signal
- [ ] Agent emits custom signals (e.g., `analysis:complete`)
- [ ] Signal recording captures full trace (all signals)
- [ ] Replay works from signal recording (deterministic)
- [ ] Causality chain populated correctly
- [ ] Basic tests pass (no regressions)

---

## Epics

| ID | Epic | Scope | Complexity |
|----|------|-------|------------|
| F1 | Signal Primitives | Signal type, SignalBus, pattern matching | Medium |
| F2 | Basic Reactive Agent | `activateOn`, `emits`, single-agent execution | Medium |
| F3 | Signal Recording | Event-sourced recording, replay | High |

---

## What Ships

At the end of Foundation:

1. **New files:**
   - `src/signals/types.ts` - Signal type definitions
   - `src/signals/bus.ts` - SignalBus implementation
   - `src/signals/signal.ts` - `signal()` helper
   - `src/reactive/run.ts` - `runReactive()` for single agent

2. **Updated files:**
   - `src/api/agent.ts` - `activateOn`, `emits`, `when` properties
   - `src/recording/types.ts` - `SignalRecording` type

3. **Tests:**
   - SignalBus unit tests
   - Single reactive agent integration test
   - Signal recording/replay test

---

## Success Demo

```typescript
// This should work at end of Foundation:
const analyst = agent({
  prompt: "Analyze the input: {{ flow.input }}",
  activateOn: [signal("flow:start")],
  emits: ["analysis:complete"],
});

const result = await runReactive(analyst, { input: "market data" });

// Signals captured
expect(result.signals).toContainSignal("flow:start");
expect(result.signals).toContainSignal("node:analyst:activated");
expect(result.signals).toContainSignal("analysis:complete");

// Replay works
const replay = await runReactive(analyst, { input: "market data" }, {
  fixture: "analyst-test",
  mode: "replay",
});
expect(replay.output).toEqual(result.output);
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| SignalBus complexity | Start simple, iterate |
| Recording format change | Design for migration |
| Performance overhead | Benchmark early |

---

## Dependencies

None - this is the first milestone.

---

## Estimated Duration

2-3 weeks
