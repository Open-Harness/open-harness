# Story 3.1: Create BaseHarness Abstract Class

**Status:** done

## Story

As a **developer building an autonomous agent**,
I want **a `BaseHarness` base class I can extend**,
so that **I get step tracking infrastructure while owning my execution logic**.

## Acceptance Criteria

1. **AC1:** Given a class extending BaseHarness, When I implement execute() as an AsyncGenerator, Then I can yield { input, output } pairs
2. **AC2:** Given a harness instance, When I call run(), Then it iterates my execute() generator until complete
3. **AC3:** Given a harness with execute() yielding 3 items, When run() completes, Then getCurrentStep() returns 3 And getStepHistory() has 3 entries
4. **AC4:** Given a harness, When run() iterates, Then each yield auto-increments currentStep And each yield auto-records to stepHistory
5. **AC5:** Given a harness with initial state { count: 42 }, When I call getState(), Then it returns { count: 42 }
6. **AC6:** Given a harness that updates state during execute(), When multiple yields occur, Then state changes persist and are visible in subsequent iterations

## Tasks / Subtasks

- [x] Task 1: Write failing tests for BaseHarness (AC: 1-6)
  - [x] 1.1: Add BaseHarness test suite to `packages/sdk/tests/unit/harness.test.ts`
  - [x] 1.2: Create SimpleHarness test class that yields 3 items
  - [x] 1.3: Write test for initializes with step 0 (AC3)
  - [x] 1.4: Write test for run() executes all yields from execute() (AC2, AC3)
  - [x] 1.5: Write test for run() records each step in history (AC4)
  - [x] 1.6: Write test for getState returns current state (AC5)
  - [x] 1.7: Write test for isComplete defaults to false
  - [x] 1.8: Create CountingHarness test class with state updates
  - [x] 1.9: Write test for state persists across steps (AC6)
  - [x] 1.10: Write test for harness with agents (AgentHarness pattern)
  - [x] 1.11: Write test for async delays / polling pattern
  - [x] 1.12: Run tests and confirm they fail

- [x] Task 2: Implement BaseHarness abstract class (AC: 1-6)
  - [x] 2.1: Create `packages/sdk/src/harness/base-harness.ts` file
  - [x] 2.2: Import PersistentState from `./state.js` and types from `./types.js`
  - [x] 2.3: Implement abstract class with generics `<TState, TInput, TOutput>`
  - [x] 2.4: Implement protected `currentStep: number` (starts at 0)
  - [x] 2.5: Implement protected `state: PersistentState<TState, TInput, TOutput>`
  - [x] 2.6: Implement constructor with HarnessConfig
  - [x] 2.7: Declare abstract `execute(): AsyncGenerator<StepYield<TInput, TOutput>>`
  - [x] 2.8: Implement `run(): Promise<void>` - iterates execute(), records steps
  - [x] 2.9: Implement protected `loadContext(): LoadedContext<TState>`
  - [x] 2.10: Implement `isComplete(): boolean` (default false)
  - [x] 2.11: Implement `getCurrentStep(): number`
  - [x] 2.12: Implement `getStepHistory(): Step<TInput, TOutput>[]`
  - [x] 2.13: Implement `getState(): TState`

- [x] Task 3: Verify all tests pass (AC: 1-6)
  - [x] 3.1: Run `bun test` to verify all BaseHarness tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/harness/base-harness.ts`
- **Test location:** `packages/sdk/tests/unit/harness.test.ts` (append to existing)
- **Pattern:** TDD - write tests first, then implement

### Technical Specifications

```typescript
abstract class BaseHarness<TState, TInput, TOutput> {
  protected currentStep: number = 0;
  protected state: PersistentState<TState, TInput, TOutput>;

  constructor(config: HarnessConfig<TState>);

  // User MUST implement - yields { input, output } pairs
  protected abstract execute(): AsyncGenerator<StepYield<TInput, TOutput>>;

  // Framework runs the harness - iterates execute()
  async run(): Promise<void>;

  // Protected helpers for subclasses
  protected loadContext(): LoadedContext<TState>;

  // User MAY override
  isComplete(): boolean;

  // Public getters
  getCurrentStep(): number;
  getStepHistory(): Step<TInput, TOutput>[];
  getState(): TState;
}
```

### Key Implementation Details

1. **run() owns the loop:** `for await (const { input, output } of this.execute()) { ... }`
2. **Auto-increment:** currentStep++ happens AFTER each yield is processed
3. **Auto-record:** `this.state.record(this.currentStep, input, output, { modified: [] })` after each yield
4. **isComplete check:** Check AFTER recording, break if true
5. **Protected state:** Subclasses can call `this.state.updateState()` in their execute()

### The Core run() Implementation

```typescript
async run(): Promise<void> {
  for await (const { input, output } of this.execute()) {
    this.currentStep++;
    this.state.record(this.currentStep, input, output, { modified: [] });
    
    if (this.isComplete()) break;
  }
}
```

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 325-395):

```typescript
describe('BaseHarness', () => {
  class SimpleHarness extends BaseHarness<{ count: number }, string, string> {
    private items = ['a', 'b', 'c'];
    
    async *execute() {
      for (const item of this.items) {
        const output = `processed: ${item}`;
        yield { input: item, output };
      }
    }
  }

  test('initializes with step 0', () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    expect(harness.getCurrentStep()).toBe(0);
  });

  test('run() executes all yields from execute()', async () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    await harness.run();
    expect(harness.getCurrentStep()).toBe(3);
  });

  test('run() records each step in history', async () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    await harness.run();
    
    const history = harness.getStepHistory();
    expect(history.length).toBe(3);
    expect(history[0]).toMatchObject({ stepNumber: 1, input: 'a', output: 'processed: a' });
  });

  test('getState returns current state', () => {
    const harness = new SimpleHarness({ initialState: { count: 42 } });
    expect(harness.getState()).toEqual({ count: 42 });
  });

  test('isComplete defaults to false', () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    expect(harness.isComplete()).toBe(false);
  });
});

describe('BaseHarness with state updates', () => {
  class CountingHarness extends BaseHarness<{ count: number }, number, number> {
    async *execute() {
      for (let i = 1; i <= 3; i++) {
        this.state.updateState(s => ({ count: s.count + i }));
        yield { input: i, output: i * 2 };
      }
    }
  }

  test('state persists across steps', async () => {
    const harness = new CountingHarness({ initialState: { count: 0 } });
    await harness.run();
    expect(harness.getState()).toEqual({ count: 6 }); // 0 + 1 + 2 + 3
  });
});

describe('BaseHarness with agents', () => {
  class AgentHarness extends BaseHarness<{ value: number }, string, string> {
    private agent = new Agent<{ value: number }, string, string>({
      name: 'TestAgent',
      run: async ({ input, stepNumber, context }) => {
        return `step ${stepNumber}: ${input} (value: ${context.value})`;
      }
    });

    private inputs = ['first', 'second'];

    async *execute() {
      for (const input of this.inputs) {
        const context = this.loadContext();
        const output = await this.agent.run({
          input,
          context: context.state,
          stepNumber: this.currentStep + 1,
          stepHistory: this.getStepHistory(),
          constraints: {}
        });
        yield { input, output };
      }
    }
  }

  test('agents receive step context', async () => {
    const harness = new AgentHarness({ initialState: { value: 100 } });
    await harness.run();
    
    const history = harness.getStepHistory();
    expect(history[0].output).toBe('step 1: first (value: 100)');
    expect(history[1].output).toBe('step 2: second (value: 100)');
  });
});

describe('BaseHarness with async delays (time-based simulation)', () => {
  class PollingHarness extends BaseHarness<{}, number, number> {
    private pollCount = 0;
    private maxPolls = 3;

    async *execute() {
      while (this.pollCount < this.maxPolls) {
        this.pollCount++;
        const input = this.pollCount;
        const output = input * 10;
        yield { input, output };
        
        // Simulate polling delay (in real usage: await sleep(5000))
        await Promise.resolve(); // Just yield control
      }
    }
  }

  test('polling pattern works', async () => {
    const harness = new PollingHarness({ initialState: {} });
    await harness.run();
    
    expect(harness.getCurrentStep()).toBe(3);
    expect(harness.getStepHistory().map(s => s.output)).toEqual([10, 20, 30]);
  });
});
```

### Dependencies
- **Requires:** Story 1.1 (types), Story 1.2 (PersistentState) must be complete
- **Note:** Story 2.1 (Agent) is NOT a dependency - Agent uses BaseHarness, not vice versa
- **Uses:** `PersistentState`, `Step`, `StepYield`, `LoadedContext`, `HarnessConfig`

### Anti-Pattern Warnings

1. **DO NOT call run() from execute()** - This causes infinite recursion
2. **DO NOT use `return value` in generator** - Use `yield` only, generators return `{ done: true, value: undefined }`
3. **DO NOT forget to call state.record()** - The framework handles this, but if overriding run(), ensure recording happens

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 4: Create BaseHarness]
- [Source: _bmad-output/epics-harness.md#Story 3.1: Create BaseHarness Abstract Class]
- [Source: _bmad-output/prd-harness.md#BaseHarness abstract class]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Tests written first (TDD approach)
- All 40 tests passing (29 previous + 11 new BaseHarness tests)
- BaseHarness implementation follows AsyncGenerator pattern exactly as specified
- isComplete() check happens AFTER each yield (ensures at least one step processed)

### Completion Notes List
- Created BaseHarness abstract class with AsyncGenerator pattern
- Implemented run() method that iterates execute() generator and auto-records steps
- Implemented protected loadContext() for agent integration
- Implemented isComplete() with default false (allows natural generator completion)
- All 6 acceptance criteria covered by tests
- Added test classes: SimpleHarness, CountingHarness, AgentHarness, PollingHarness
- TypeScript compilation verified
- All linting errors resolved (added override modifiers)

### File List
- `packages/sdk/src/harness/base-harness.ts` (new - BaseHarness abstract class)
- `packages/sdk/tests/unit/harness.test.ts` (modified - added 11 BaseHarness tests)

## Senior Developer Review (AI)

**Review Date:** 2024-12-24
**Reviewer:** Dev Agent (Amelia)
**Verdict:** PASS

### Acceptance Criteria Verification
- AC1: extend BaseHarness, implement execute() as AsyncGenerator ✅
- AC2: run() iterates execute() generator ✅
- AC3: getCurrentStep() returns step count, getStepHistory() has entries ✅
- AC4: Each yield auto-increments and auto-records ✅
- AC5: getState() returns initial state ✅
- AC6: State persists across steps ✅

### Issues Found
**Medium:**
- [M-3.1-1] Empty stateDelta in record() - always passes { modified: [] }

**Low:**
- [L-3.1-1] Protected currentStep could be made private
- [L-3.1-2] Missing JSDoc on execute() timing relationship

### Tests Verified
- 11/11 BaseHarness tests passing
- 44 total harness tests passing

### Examples Verified
- CodingHarness runs successfully (3 tickets)
- TradingHarness runs successfully (10 iterations)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - BaseHarness abstract class created with all acceptance criteria met, all tests passing | Dev Agent (Amelia) |
| 2024-12-24 | Code review PASSED - status updated to done | Dev Agent (Amelia) |
