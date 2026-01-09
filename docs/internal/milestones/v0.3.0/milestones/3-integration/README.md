# Milestone 3: Integration

**Status:** Planned
**Goal:** Full ecosystem works with signals (reporters, Vitest, providers).

---

## Exit Criteria

All must pass before moving to Milestone 4:

- [ ] Reporters subscribe to signal patterns
- [ ] Console reporter migrated to signal-based
- [ ] Metrics reporter migrated to signal-based
- [ ] Vitest helpers work with signal assertions
- [ ] `expect(result.signals).toContainSignal()` works
- [ ] All providers emit correct signals
- [ ] Existing tests migrate to reactive (or adapter works)
- [ ] No regressions from v0.2.0 behavior

---

## Epics

| ID | Epic | Scope | Complexity |
|----|------|-------|------------|
| I1 | Signal-Based Reporters | Reporter interface, migration | Medium |
| I2 | Vitest Integration | Test helpers, matchers | Medium |
| I3 | Provider Signal Emission | Consistent provider signals | Low |

---

## What Ships

At the end of Integration:

1. **New files:**
   - `src/reporters/signal-reporter.ts` - Base interface
   - `src/testing/signal-matchers.ts` - Vitest matchers

2. **Updated files:**
   - `src/reporters/console.ts` - Signal-based
   - `src/reporters/metrics.ts` - Signal-based
   - `src/providers/anthropic.ts` - Emit signals

3. **Tests:**
   - Reporter signal reception
   - Custom matcher tests
   - Provider signal verification

---

## Success Demo

```typescript
// This should work at end of Integration:

// Reporter subscribes to signals
const customReporter = {
  subscribe: ["node:*:completed", "flow:error"],
  onSignal: (signal) => {
    if (signal.name.includes(":completed")) {
      console.log(`Agent ${signal.nodeId} completed`);
    }
  },
};

// Vitest assertions on signals
expect(result.signals).toContainSignal("trade:proposed");
expect(result.signals).toContainSignal({
  name: "state:analysis:changed",
  payload: { confidence: expect.greaterThan(70) },
});

// Provider emits signals
// runReactive → provider:request → provider:response
// These signals are captured and can be replayed
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Matcher API design | Review existing jest/vitest patterns |
| Reporter migration breaks existing | Keep backward compat layer |

---

## Dependencies

- Milestone 2: Execution (E4 - Reactive Graph API)

---

## Estimated Duration

2 weeks
