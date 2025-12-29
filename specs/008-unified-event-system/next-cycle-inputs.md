# Next Cycle Inputs

**Source**: Retrospective decisions from 008-unified-event-system
**Generated**: 2025-12-27T19:00:00Z

## Immediate Actions (Before Next Cycle)

### 1. Rebase to clean commit history

**Root Cause**: RC002 - Commit focus divergence - trivial utilities instead of feature code

**Problem**: 4 out of 5 commits on feature branch are unrelated add() function variants. Actual 008 feature implementation remains uncommitted.

**Immediate Steps**:
```bash
# 1. Interactive rebase to remove errant commits
git rebase -i 9e33e09  # merge base

# In editor, drop these commits:
# drop 172aa3d feat: implement add function for two numbers
# drop 83375cf feat: implement add function for adding two numbers
# drop 28171b1 feat: add function to add two numbers
# drop f209b97 feat: implement add function for two numbers

# 2. Stage all actual 008 feature code
git add specs/008-unified-event-system/spec.md
git add specs/008-unified-event-system/plan.md
git add specs/008-unified-event-system/data-model.md
git add specs/008-unified-event-system/research.md
git add specs/008-unified-event-system/quickstart.md
git add specs/008-unified-event-system/ANALYSIS.md
git add specs/008-unified-event-system/contracts/
git add packages/sdk/src/core/unified-event-bus.ts
git add packages/sdk/src/core/unified-events/
git add packages/sdk/src/harness/define-renderer.ts
git add packages/sdk/src/harness/event-context.ts
git add packages/sdk/src/harness/render-output.ts
git add packages/sdk/tests/unit/unified-event-bus.test.ts
git add packages/sdk/tests/unit/define-renderer.test.ts
git add packages/sdk/tests/integration/unified-events.test.ts

# 3. Create proper feature commits
git commit -m "feat(unified-events): add 008 spec and planning artifacts"
git commit -m "feat(unified-events): implement UnifiedEventBus with AsyncLocalStorage"
git commit -m "feat(unified-events): implement defineRenderer factory"
git commit -m "test(unified-events): add unit and integration tests"
```

---

## Decisions to Implement (Next Cycle)

### 1. Full delegation migration for HarnessInstance

**Root Cause**: RC003 - Dual-emit architecture deviation from spec

**Current State**:
- `phase()` and `task()` helpers emit to BOTH legacy `_emit()` AND unified bus
- `HarnessInstance.on()` manages separate `_subscriptions` array
- Two parallel event streams exist

**Target State (Delegation Pattern)**:
- `HarnessInstance.on()` delegates to `UnifiedEventBus.subscribe()`
- Single unified event stream through `UnifiedEventBus`
- All context propagation via `AsyncLocalStorage`

**Implementation Steps**:
1. Modify `HarnessInstance.on()` to call `this._unifiedBus.subscribe()` instead of managing `_subscriptions`
2. Remove separate `_unifiedBus.emit()` calls in `phase()` and `task()` helpers
3. Modify `_emit()` to forward events to unified bus (single source)
4. Update type mappings: `FluentHarnessEvent` → unified event types
5. Update all tests to verify delegation works correctly
6. Document breaking changes in CHANGELOG

**Files to Modify**:
- `packages/sdk/src/harness/harness-instance.ts` (lines 116-122, 168-190, 227-357)
- `packages/sdk/src/core/unified-event-bus.ts` (may need adapter methods)
- `packages/sdk/tests/unit/harness.test.ts`
- `packages/sdk/tests/integration/fluent-harness.test.ts`

**Breaking Changes**:
- Legacy subscribers will receive `EnrichedEvent<T>` wrapper instead of raw events
- Subscription API may need adapter layer for backward compatibility

---

### 2. Implement T029 integration test for SC-005

**Root Cause**: RC004 - Missing verification test for success criterion SC-005

**Deferred From**: 008-unified-event-system cycle

**Success Criterion**: SC-005 - Single subscription receives all event types

**Test Requirements**:
```typescript
// packages/sdk/tests/integration/unified-events.test.ts

describe("SC-005: Single subscription receives all event types", () => {
  it("should receive workflow, agent, narrative, and session events from single subscription", async () => {
    const bus = new UnifiedEventBus();
    const allEvents: EnrichedEvent<BaseEvent>[] = [];

    // Single wildcard subscription
    bus.subscribe("*", (event) => allEvents.push(event));

    // Emit different event types
    bus.scoped({ sessionId: "test" }, () => {
      bus.emit({ type: "harness:start", name: "test" });
      bus.emit({ type: "phase:start", name: "setup" });
      bus.emit({ type: "task:start", taskId: "t1" });
      bus.emit({ type: "agent:start", agentName: "parser" });
      bus.emit({ type: "narrative", text: "Starting...", importance: "info" });
      bus.emit({ type: "session:prompt", promptId: "p1" });
    });

    // Verify all event categories received
    expect(allEvents.length).toBe(6);
    expect(allEvents.map(e => e.event.type)).toContain("harness:start");
    expect(allEvents.map(e => e.event.type)).toContain("agent:start");
    expect(allEvents.map(e => e.event.type)).toContain("narrative");
    expect(allEvents.map(e => e.event.type)).toContain("session:prompt");
  });
});
```

**Priority**: First task in next implementation phase

---

## Skipped Decisions

- **RC001**: Git workflow breakdown - User decided not to address
  - Rationale: Not prioritized for next cycle
  - Risk: Same issue could recur without incremental commit enforcement

---

## Suggested Spec Additions

When creating the next feature spec, consider including:

1. **Architecture Decision Log**: Require ANALYSIS.md when implementation deviates from plan
2. **Commit Checkpoints**: Define when commits should occur (per-task vs per-phase)
3. **Success Criteria Tests**: Map each SC-XXX to specific test file/function

---

## Lessons Learned

| Lesson | Application |
|--------|-------------|
| Untracked work accumulates silently | Consider incremental commits at task level |
| Wrong-file commits corrupt history | Validate staged files match task scope |
| Architectural deviations need ADRs | Require ANALYSIS.md for spec divergence |
| Success criteria need explicit tests | Map each SC to test before marking complete |

---

**Generated by**: /oharnes.close
