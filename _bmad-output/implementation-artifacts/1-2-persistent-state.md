# Story 1.2: Create PersistentState Class

**Status:** review

## Story

As a **harness developer**,
I want **a `PersistentState` class that manages state and history**,
so that **my harness has persistent memory across steps**.

## Acceptance Criteria

1. **AC1:** Given a new PersistentState with initialState { count: 0 }, When I call getState(), Then it returns { count: 0 }
2. **AC2:** Given a PersistentState instance, When I call updateState(s => ({ count: s.count + 1 })), Then getState() returns { count: 1 }
3. **AC3:** Given a PersistentState with maxContextSteps: 5 and 10 recorded steps, When I call loadContext(), Then recentSteps has exactly 5 items (most recent)
4. **AC4:** Given a PersistentState with 3 recorded steps, When I call getRecentSteps(2), Then it returns the last 2 steps in order
5. **AC5:** Given a PersistentState, When I call record(stepNumber, input, output, stateDelta), Then getStepHistory() includes the new step

## Tasks / Subtasks

- [x] Task 1: Write failing tests for PersistentState class (AC: 1-5)
  - [x] 1.1: Create test file `packages/sdk/tests/unit/harness.test.ts` (add to existing file)
  - [x] 1.2: Write test for initialization with initialState (AC1)
  - [x] 1.3: Write test for updateState() method (AC2)
  - [x] 1.4: Write test for loadContext() bounded context (AC3)
  - [x] 1.5: Write test for getRecentSteps() method (AC4)
  - [x] 1.6: Write test for record() and getStepHistory() methods (AC5)
  - [x] 1.7: Run tests and confirm they fail (class not yet created)

- [x] Task 2: Implement PersistentState class (AC: 1-5)
  - [x] 2.1: Create `packages/sdk/src/harness/state.ts` file
  - [x] 2.2: Import types from `./types.js` (Step, StateDelta, LoadedContext, PersistentStateConfig)
  - [x] 2.3: Implement constructor with PersistentStateConfig<TState>
  - [x] 2.4: Implement getState(): TState method
  - [x] 2.5: Implement updateState(updater: (state: TState) => TState): void method
  - [x] 2.6: Implement record(stepNumber, input, output, stateDelta): void method
  - [x] 2.7: Implement getStepHistory(): Step<TInput, TOutput>[] method
  - [x] 2.8: Implement getRecentSteps(count: number): Step<TInput, TOutput>[] method
  - [x] 2.9: Implement loadContext(): LoadedContext<TState> method with bounded steps
  - [x] 2.10: Ensure maxContextSteps defaults to 10 if not provided

- [x] Task 3: Verify all tests pass (AC: 1-5)
  - [x] 3.1: Run `bun test` to verify all PersistentState tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds
  - [x] 3.3: Verify no regressions in existing harness type tests

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/harness/state.ts`
- **Test location:** `packages/sdk/tests/unit/harness.test.ts` (add to existing test file)
- **Pattern:** TDD - write tests first, then implement
- **Framework:** Bun test framework (`bun:test`)
- **Dependencies:** Uses types from `./types.js` (Step, StateDelta, LoadedContext, PersistentStateConfig)

### Technical Specifications

#### PersistentState Class Signature
```typescript
export class PersistentState<TState, TInput = unknown, TOutput = unknown> {
  constructor(config: PersistentStateConfig<TState>);
  getState(): TState;
  updateState(updater: (state: TState) => TState): void;
  record(stepNumber: number, input: TInput, output: TOutput, stateDelta: StateDelta): void;
  getStepHistory(): Step<TInput, TOutput>[];
  getRecentSteps(count: number): Step<TInput, TOutput>[];
  loadContext(): LoadedContext<TState>;
}
```

#### Constructor Requirements
- Takes `PersistentStateConfig<TState>` which has:
  - `initialState: TState` (required)
  - `maxContextSteps?: number` (optional, defaults to 10)
- Stores state internally (private field)
- Initializes empty step history array
- Stores maxContextSteps for bounded context

#### State Management
- State must be immutable - `updateState()` creates new state object
- State persists across `record()` calls
- `getState()` returns current state snapshot

#### Step History Management
- `record()` creates Step object with:
  - stepNumber (provided)
  - timestamp (Date.now())
  - input (provided)
  - output (provided)
  - stateDelta (provided)
- Steps stored in chronological order (oldest first)
- `getStepHistory()` returns full history array
- `getRecentSteps(count)` returns last N steps (most recent first)

#### Bounded Context
- `loadContext()` returns `LoadedContext<TState>` with:
  - `state`: current state snapshot
  - `recentSteps`: bounded to maxContextSteps (most recent steps)
  - `relevantKnowledge`: empty Record<string, unknown> for now
- If history has fewer steps than maxContextSteps, return all steps
- If history has more steps, return only the most recent maxContextSteps
- Steps in recentSteps should be ordered most recent first (reverse chronological)

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 177-230):

```typescript
import { describe, test, expect } from 'bun:test';
import { PersistentState } from '../../src/harness/state.js';

describe('PersistentState', () => {
  test('initializes with provided state', () => {
    const state = new PersistentState({ initialState: { count: 0 } });
    expect(state.getState()).toEqual({ count: 0 });
  });

  test('updateState modifies state immutably', () => {
    const state = new PersistentState({ initialState: { count: 0 } });
    state.updateState(s => ({ count: s.count + 1 }));
    expect(state.getState()).toEqual({ count: 1 });
  });

  test('record adds step to history', () => {
    const state = new PersistentState({ initialState: {} });
    state.record(1, 'input-a', 'output-a', { modified: [] });
    state.record(2, 'input-b', 'output-b', { modified: [] });
    
    const history = state.getStepHistory();
    expect(history.length).toBe(2);
    expect(history[0].stepNumber).toBe(1);
    expect(history[1].stepNumber).toBe(2);
  });

  test('loadContext returns bounded context', () => {
    const state = new PersistentState({ 
      initialState: { count: 0 },
      maxContextSteps: 5 
    });
    
    // Record 10 steps
    for (let i = 1; i <= 10; i++) {
      state.record(i, `input-${i}`, `output-${i}`, { modified: [] });
    }
    
    const context = state.loadContext();
    expect(context.recentSteps.length).toBe(5); // Bounded to maxContextSteps
    expect(context.recentSteps[0].stepNumber).toBe(6); // Most recent 5
    expect(context.state).toEqual({ count: 0 });
  });

  test('getRecentSteps returns last N steps', () => {
    const state = new PersistentState({ initialState: {} });
    state.record(1, 'a', 'A', { modified: [] });
    state.record(2, 'b', 'B', { modified: [] });
    state.record(3, 'c', 'C', { modified: [] });
    
    const recent = state.getRecentSteps(2);
    expect(recent.length).toBe(2);
    expect(recent[0].input).toBe('b');
    expect(recent[1].input).toBe('c');
  });
});
```

### Previous Story Intelligence (Story 1.1)

**Key Learnings:**
- Types are already implemented in `packages/sdk/src/harness/types.ts`
- Test file exists at `packages/sdk/tests/unit/harness.test.ts` - ADD tests to existing file, don't create new one
- Use `.js` extension in imports (TypeScript ESM convention)
- Follow TDD pattern strictly - tests first, then implementation
- All tests use `bun:test` framework
- Type definitions use interfaces (not types) per story requirements
- Project uses Bun, not Node.js/npm/pnpm

**Files Created in Story 1.1:**
- `packages/sdk/src/harness/types.ts` - Contains all type definitions including `PersistentStateConfig<TState>`
- `packages/sdk/tests/unit/harness.test.ts` - Contains harness type tests

**Patterns Established:**
- File structure: `packages/sdk/src/harness/` for harness module
- Test structure: `packages/sdk/tests/unit/harness.test.ts` for all harness tests
- Import pattern: `import { ... } from '../../src/harness/types.js'`
- Test organization: Use `describe()` blocks to group related tests

**What to Reuse:**
- Import `Step`, `StateDelta`, `LoadedContext`, `PersistentStateConfig` from `./types.js`
- Follow same test structure and naming conventions
- Use same file organization patterns

### Project Structure Notes

- **SDK package:** `packages/sdk/`
- **Harness module:** `packages/sdk/src/harness/` (already exists from Story 1.1)
- **Test file:** `packages/sdk/tests/unit/harness.test.ts` (already exists - ADD to it)
- **ESM imports:** Use `.js` extension in imports (TypeScript convention for ESM)
- **No DI needed:** Plain class, no decorators or dependency injection
- **State management:** Immutable updates pattern (functional update)

### Architecture Compliance

From `docs/architecture-sdk.md`:
- SDK follows clean architecture with clear separation of concerns
- Type-safe TypeScript throughout
- No async generators exposed (this class doesn't use generators)
- Promise-based APIs (this class uses synchronous methods)
- Follow existing patterns from `BaseAgent` and `TaskList` for state management

**State Management Pattern:**
- Similar to `TaskList` in `workflow/task-list.ts` - maintains internal state
- State updates should be immutable (functional programming pattern)
- No external dependencies beyond types

### Dependencies

- **Internal:** `./types.js` (Step, StateDelta, LoadedContext, PersistentStateConfig)
- **External:** None (pure TypeScript class)
- **Runtime:** Bun runtime (no Node.js specific APIs)

### Implementation Notes

**Critical Implementation Details:**
1. **State Immutability:** `updateState()` must create new state object, not mutate existing
2. **Step Ordering:** Steps stored chronologically (oldest first), but `getRecentSteps()` and `loadContext()` return most recent first
3. **Bounded Context:** `loadContext()` must respect `maxContextSteps` limit - return only most recent N steps
4. **Default maxContextSteps:** If not provided in config, default to 10
5. **Timestamp:** Use `Date.now()` for step timestamps (number, not Date object)

**Edge Cases to Handle:**
- Empty step history: `getRecentSteps(5)` on empty history returns empty array
- Fewer steps than maxContextSteps: `loadContext()` returns all available steps
- State updates: Ensure immutability - don't mutate original state object

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 2: Create PersistentState]
- [Source: _bmad-output/epics-harness.md#Story 1.2: Create PersistentState Class]
- [Source: _bmad-output/prd-harness.md#PersistentState]
- [Source: packages/sdk/src/harness/types.ts] (type definitions)
- [Source: packages/sdk/src/workflow/task-list.ts] (state management pattern reference)
- [Source: packages/sdk/src/runner/models.ts] (type pattern reference)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

N/A

### Completion Notes List

- All acceptance criteria met (AC1-AC5)
- Implemented PersistentState class with all required methods
- State management uses immutable update pattern
- Step history stored chronologically (oldest first)
- Bounded context implemented with maxContextSteps (default: 10)
- All 5 PersistentState tests passing
- No regressions in existing 12 harness type tests
- Total: 17 tests passing (12 type tests + 5 PersistentState tests)
- TypeScript compilation successful
- Note: getRecentSteps() returns steps in chronological order (matching test expectations)

### File List

- `packages/sdk/src/harness/state.ts` (new) - PersistentState class implementation
- `packages/sdk/tests/unit/harness.test.ts` (modified) - Added 5 PersistentState tests

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from epics and tech-spec | Dev Agent (Amelia) |
| 2024-12-24 | Implementation completed - all tasks done, all tests passing | Dev Agent (Amelia) |

