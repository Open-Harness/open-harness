# Story 1.1: Create Harness Types

**Status:** review

## Story

As a **developer using the SDK**,
I want **well-defined TypeScript interfaces for harness concepts**,
so that **I have type safety and clear contracts**.

## Acceptance Criteria

1. **AC1:** Given a developer imports types from harness/types, When they use `Step<TInput, TOutput>`, Then it has stepNumber, timestamp, input, output, stateDelta fields
2. **AC2:** Given a developer uses `StateDelta`, When they track modifications, Then it has modified[] array and optional summary
3. **AC3:** Given a developer uses `LoadedContext<TState>`, When they access bounded context, Then it has state, recentSteps, relevantKnowledge fields
4. **AC4:** Given a developer uses `HarnessConfig<TState>`, When they configure a harness, Then it has initialState and optional maxContextSteps
5. **AC5:** Given a developer uses `StepYield<TInput, TOutput>`, When yielding from execute(), Then it has input and output fields
6. **AC6:** Given a developer uses `Constraints`, When setting agent constraints, Then it provides a flexible key-value structure

## Tasks / Subtasks

- [x] Task 1: Write failing tests for type interfaces (AC: 1-6)
  - [x] 1.1: Create test file `packages/sdk/tests/unit/harness.test.ts`
  - [x] 1.2: Write test for `Step<TInput, TOutput>` interface
  - [x] 1.3: Write test for `StateDelta` interface
  - [x] 1.4: Write test for `LoadedContext<TState>` interface
  - [x] 1.5: Write test for `HarnessConfig<TState>` interface
  - [x] 1.6: Write test for `StepYield<TInput, TOutput>` type
  - [x] 1.7: Write test for `Constraints` interface
  - [x] 1.8: Run tests and confirm they fail (types not yet created)

- [x] Task 2: Implement type definitions (AC: 1-6)
  - [x] 2.1: Create `packages/sdk/src/harness/types.ts` file
  - [x] 2.2: Implement `StateDelta` interface with modified[] and optional summary
  - [x] 2.3: Implement `Step<TInput, TOutput>` interface with all required fields
  - [x] 2.4: Implement `Constraints` interface (flexible key-value)
  - [x] 2.5: Implement `LoadedContext<TState>` interface
  - [x] 2.6: Implement `HarnessConfig<TState>` interface
  - [x] 2.7: Implement `StepYield<TInput, TOutput>` type
  - [x] 2.8: Implement `PersistentStateConfig<TState>` interface
  - [x] 2.9: Implement `AgentConfig<TState, TInput, TOutput>` interface
  - [x] 2.10: Implement `AgentRunParams<TState, TInput, TOutput>` interface

- [x] Task 3: Verify all tests pass (AC: 1-6)
  - [x] 3.1: Run `bun test` to verify all type tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/harness/types.ts`
- **Test location:** `packages/sdk/tests/unit/harness.test.ts`
- **Pattern:** TDD - write tests first, then implement
- **Framework:** Bun test framework (`bun:test`)

### Technical Specifications

#### Step Interface
```typescript
interface Step<TInput, TOutput> {
  stepNumber: number;
  timestamp: number;
  input: TInput;
  output: TOutput;
  stateDelta: StateDelta;
}
```

#### StateDelta Interface
```typescript
interface StateDelta {
  modified: string[];
  summary?: string;
}
```

#### LoadedContext Interface
```typescript
interface LoadedContext<TState> {
  state: TState;
  recentSteps: Step<unknown, unknown>[];
  relevantKnowledge: Record<string, unknown>;
}
```

#### HarnessConfig Interface
```typescript
interface HarnessConfig<TState> {
  initialState: TState;
  maxContextSteps?: number;
}
```

#### StepYield Type
```typescript
type StepYield<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
};
```

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 126-159):

```typescript
import { describe, test, expect } from 'bun:test';
import type { Step, StateDelta, Constraints, LoadedContext } from '../../src/harness/types.js';

describe('Harness Types', () => {
  test('Step interface has required fields', () => {
    const step: Step<string, number> = {
      stepNumber: 1,
      timestamp: Date.now(),
      input: 'test',
      output: 42,
      stateDelta: { modified: [] }
    };
    expect(step.stepNumber).toBe(1);
    expect(step.input).toBe('test');
    expect(step.output).toBe(42);
  });

  test('StateDelta tracks modifications', () => {
    const delta: StateDelta = {
      modified: ['balance', 'position'],
      summary: 'Updated portfolio'
    };
    expect(delta.modified).toContain('balance');
  });

  test('LoadedContext provides bounded state', () => {
    const context: LoadedContext<{ count: number }> = {
      state: { count: 5 },
      recentSteps: [],
      relevantKnowledge: {}
    };
    expect(context.state.count).toBe(5);
  });
});
```

### Project Structure Notes

- **SDK package:** `packages/sdk/`
- **New harness module:** `packages/sdk/src/harness/`
- **Tests alongside source:** `packages/sdk/tests/unit/harness.test.ts`
- **ESM imports:** Use `.js` extension in imports (TypeScript convention for ESM)
- **No decorators:** Types are plain interfaces, no DI needed

### Dependencies
- None external (pure TypeScript interfaces)
- No internal SDK dependencies for types

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 1: Create Types]
- [Source: _bmad-output/epics-harness.md#Story 1.1: Create Harness Types]
- [Source: _bmad-output/prd-harness.md#TypeScript Types]
- [Source: packages/sdk/src/runner/models.ts] (pattern reference for type definitions)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

N/A

### Completion Notes List

- All acceptance criteria met (AC1-AC6)
- Implemented all required interfaces: Step, StateDelta, LoadedContext, HarnessConfig, StepYield, Constraints
- Implemented additional interfaces per Task 2: PersistentStateConfig, AgentConfig, AgentRunParams
- All 12 tests passing
- TypeScript types compile correctly (harness types have no errors)
- Note: Project has pre-existing TypeScript errors in other files, but harness types are clean
- Fixed linter error: added optional chaining for array access in test

### File List

- `packages/sdk/src/harness/types.ts` (new) - All type definitions implemented
- `packages/sdk/tests/unit/harness.test.ts` (new) - 12 comprehensive tests covering all ACs

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Implementation completed - all tasks done, all tests passing | Dev Agent (Amelia) |
