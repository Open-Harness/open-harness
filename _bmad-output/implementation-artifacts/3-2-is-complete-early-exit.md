# Story 3.2: Implement isComplete Early Exit

**Status:** done

## Story

As a **developer building a finite harness**,
I want **`run()` to stop when `isComplete()` returns true**,
so that **my harness can complete based on state conditions**.

## Acceptance Criteria

1. **AC1:** Given a harness with isComplete() checking state.remaining <= 0 And initial state { remaining: 3 }, When execute() yields and updates remaining each time, Then run() stops after 3 yields And isComplete() returns true
2. **AC2:** Given a harness with default isComplete(), When run() executes, Then it only stops when execute() generator completes
3. **AC3:** Given a harness with isComplete returning true immediately, When run() starts, Then it still processes at least one yield before checking (check happens AFTER yield)

## Tasks / Subtasks

- [x] Task 1: Write failing tests for isComplete behavior (AC: 1-3)
  - [x] 1.1: Add isComplete test suite to `packages/sdk/tests/unit/harness.test.ts`
  - [x] 1.2: Create EarlyStopHarness test class with custom isComplete
  - [x] 1.3: Write test for run() stops when isComplete returns true (AC1)
  - [x] 1.4: Write test for default isComplete allows generator to complete (AC2)
  - [x] 1.5: Write test for isComplete check happens after yield processing (AC3)
  - [x] 1.6: Run tests and confirm they fail (or pass if 3.1 implemented correctly)

- [x] Task 2: Verify/enhance isComplete implementation (AC: 1-3)
  - [x] 2.1: Verify run() checks isComplete() AFTER recording each step
  - [x] 2.2: Verify break happens when isComplete() returns true
  - [x] 2.3: Verify default isComplete() returns false
  - [x] 2.4: Ensure at least one yield is processed before any isComplete check

- [x] Task 3: Verify all tests pass (AC: 1-3)
  - [x] 3.1: Run `bun test` to verify all isComplete tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/harness/base-harness.ts` (modify existing)
- **Test location:** `packages/sdk/tests/unit/harness.test.ts` (append to existing)
- **Pattern:** TDD - write tests first, verify implementation

### Technical Specifications

The `isComplete()` check should happen in the `run()` method AFTER each step is recorded:

```typescript
async run(): Promise<void> {
  for await (const { input, output } of this.execute()) {
    this.currentStep++;
    this.state.record(this.currentStep, input, output, { modified: [] });
    
    // Check AFTER recording - at least one step always processed
    if (this.isComplete()) break;
  }
}
```

### Key Implementation Details

1. **Check AFTER yield:** isComplete() is evaluated after step recording
2. **At least one step:** Even if isComplete() would return true, first yield is processed
3. **Default false:** Base implementation returns false, allowing generator to complete naturally
4. **User override:** Users override isComplete() to add state-based completion logic

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 397-420):

```typescript
describe('BaseHarness with custom isComplete', () => {
  class EarlyStopHarness extends BaseHarness<{ stopAt: number }, number, number> {
    async *execute() {
      let i = 0;
      while (true) {
        i++;
        yield { input: i, output: i };
        // Note: isComplete check happens in run() after yield
      }
    }

    isComplete(): boolean {
      return this.getCurrentStep() >= this.state.getState().stopAt;
    }
  }

  test('run() stops when isComplete returns true', async () => {
    const harness = new EarlyStopHarness({ initialState: { stopAt: 5 } });
    await harness.run();
    
    expect(harness.getCurrentStep()).toBe(5);
    expect(harness.getStepHistory().length).toBe(5);
  });
});
```

### Additional Test Cases

```typescript
// Test AC2: Default isComplete allows natural completion
describe('BaseHarness default isComplete', () => {
  class FiniteHarness extends BaseHarness<{}, string, string> {
    async *execute() {
      yield { input: 'a', output: 'A' };
      yield { input: 'b', output: 'B' };
      // Generator completes naturally
    }
  }

  test('completes when generator exhausts', async () => {
    const harness = new FiniteHarness({ initialState: {} });
    await harness.run();
    expect(harness.getCurrentStep()).toBe(2);
  });
});

// Test AC3: At least one yield processed
describe('BaseHarness isComplete timing', () => {
  class ImmediateCompleteHarness extends BaseHarness<{ done: boolean }, number, number> {
    async *execute() {
      yield { input: 1, output: 1 };
      yield { input: 2, output: 2 }; // Should not reach this
    }

    isComplete(): boolean {
      return this.state.getState().done; // true from start
    }
  }

  test('processes first yield even if isComplete true initially', async () => {
    const harness = new ImmediateCompleteHarness({ initialState: { done: true } });
    await harness.run();
    expect(harness.getCurrentStep()).toBe(1); // First yield processed
    expect(harness.getStepHistory().length).toBe(1);
  });
});
```

### Dependencies
- **Requires:** Story 3.1 (BaseHarness) must be complete
- **Modifies:** `packages/sdk/src/harness/base-harness.ts` (if needed)

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 4: Create BaseHarness - isComplete section]
- [Source: _bmad-output/epics-harness.md#Story 3.2: Implement isComplete Early Exit]
- [Source: _bmad-output/prd-harness.md#isComplete()]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Tests written first (TDD approach)
- All 40 tests passing (includes 3 new isComplete tests)
- Implementation already correct in Story 3.1 - isComplete() checked AFTER each yield
- Verified timing: at least one yield always processed before isComplete check

### Completion Notes List
- Added 3 comprehensive tests for isComplete behavior
- Verified run() checks isComplete() AFTER recording each step (correct implementation)
- Verified break happens when isComplete() returns true
- Verified default isComplete() returns false (allows natural completion)
- Verified at least one yield processed before any isComplete check (AC3)
- Fixed linting errors by adding override modifiers to test class methods
- No code changes needed - implementation from Story 3.1 was already correct

### File List
- `packages/sdk/src/harness/base-harness.ts` (no changes - implementation already correct)
- `packages/sdk/tests/unit/harness.test.ts` (modified - added 3 isComplete tests)

## Senior Developer Review (AI)

**Review Date:** 2024-12-24
**Reviewer:** Dev Agent (Amelia)
**Verdict:** PASS

### Acceptance Criteria Verification
- AC1: isComplete() checking state stops at correct point ✅
- AC2: Default isComplete() allows generator to complete ✅
- AC3: At least one yield before isComplete check ✅

### Issues Found
**Low:**
- [L-3.2-1] Story is a "verification story" pattern - could document this

### Tests Verified
- 3/3 isComplete tests passing
- 44 total harness tests passing

### Implementation Notes
- Story correctly verified existing implementation from 3.1
- No code changes needed - isComplete timing already correct

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - isComplete tests added, implementation verified correct from Story 3.1, all tests passing | Dev Agent (Amelia) |
| 2024-12-24 | Code review PASSED - status updated to done | Dev Agent (Amelia) |
