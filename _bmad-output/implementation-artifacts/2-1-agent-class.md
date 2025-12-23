# Story 2.1: Create Agent Class

**Status:** done

## Story

As a **harness developer**,
I want **an `Agent` class that wraps my agent logic**,
so that **my agents receive step context when running**.

## Acceptance Criteria

1. **AC1:** Given an Agent with a run function, When I call agent.run({ input, context, stepNumber, stepHistory, constraints }), Then my run function receives all those parameters
2. **AC2:** Given an Agent with name: 'MyAgent', When I access agent.name, Then it returns 'MyAgent'
3. **AC3:** Given an Agent without a name, When I access agent.name, Then it defaults to 'Agent'
4. **AC4:** Given an Agent with isComplete function, When I call agent.isComplete(state), Then it returns the result of my isComplete function
5. **AC5:** Given an Agent without isComplete, When I call agent.isComplete(state), Then it returns false

## Tasks / Subtasks

- [x] Task 0: Fix AgentConfig and AgentRunParams types (BLOCKING)
  - [x] 0.1: Open `packages/sdk/src/harness/types.ts`
  - [x] 0.2: Update AgentConfig: make `name` optional, add `run` function, add `isComplete` optional
  - [x] 0.3: Update AgentRunParams: rename `state` to `context`, add `stepNumber`, `stepHistory`, `constraints`
  - [x] 0.4: Remove unused fields from AgentConfig (`constraints`, `initialState`)
  - [x] 0.5: Verify existing tests still pass with `bun test`
  - [x] 0.6: SKIPPED - Story 1.1a already fixed types

- [x] Task 1: Write failing tests for Agent class (AC: 1-5)
  - [x] 1.1: Add Agent test suite to `packages/sdk/tests/unit/harness.test.ts`
  - [x] 1.2: Write test for run() calls provided function with all params (AC1)
  - [x] 1.3: Write test for agent has name property (AC2)
  - [x] 1.4: Write test for name defaults to "Agent" (AC3)
  - [x] 1.5: Write test for isComplete uses provided function (AC4)
  - [x] 1.6: Write test for isComplete defaults to false (AC5)
  - [x] 1.7: Run tests and confirm they fail

- [x] Task 2: Implement Agent class (AC: 1-5)
  - [x] 2.1: Create `packages/sdk/src/harness/agent.ts` file
  - [x] 2.2: Import types from `./types.js`
  - [x] 2.3: Implement Agent class with generics `<TState, TInput, TOutput>`
  - [x] 2.4: Implement constructor with AgentConfig
  - [x] 2.5: Implement `name: string` property with default 'Agent'
  - [x] 2.6: Implement `run(params: AgentRunParams): Promise<TOutput>`
  - [x] 2.7: Implement `isComplete(state: TState): boolean` with default false

- [x] Task 3: Verify all tests pass (AC: 1-5)
  - [x] 3.1: Run `bun test` to verify all Agent tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/harness/agent.ts`
- **Test location:** `packages/sdk/tests/unit/harness.test.ts` (append to existing)
- **Pattern:** TDD - write tests first, then implement

### Technical Specifications

```typescript
interface AgentConfig<TState, TInput, TOutput> {
  name?: string;
  run: (params: AgentRunParams<TState, TInput, TOutput>) => Promise<TOutput>;
  isComplete?: (state: TState) => boolean;
}

interface AgentRunParams<TState, TInput, TOutput> {
  input: TInput;
  context: TState;
  stepNumber: number;
  stepHistory: Step<TInput, TOutput>[];
  constraints: Constraints;
}

class Agent<TState, TInput, TOutput> {
  readonly name: string;
  
  constructor(config: AgentConfig<TState, TInput, TOutput>);
  
  run(params: AgentRunParams<TState, TInput, TOutput>): Promise<TOutput>;
  isComplete(state: TState): boolean;
}
```

### Key Implementation Details

1. **Simple wrapper:** Agent is a thin wrapper around user's run function
2. **Default name:** If no name provided, use 'Agent'
3. **Default isComplete:** If no isComplete provided, always return false
4. **Async run:** run() is always async, returns Promise<TOutput>

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 248-310):

```typescript
describe('Agent', () => {
  test('run() calls provided function with all params', async () => {
    let capturedParams: any = null;
    
    const agent = new Agent<{ x: number }, string, number>({
      name: 'TestAgent',
      run: async (params) => {
        capturedParams = params;
        return 42;
      }
    });

    const result = await agent.run({
      input: 'hello',
      context: { x: 1 },
      stepNumber: 5,
      stepHistory: [],
      constraints: {}
    });

    expect(result).toBe(42);
    expect(capturedParams.input).toBe('hello');
    expect(capturedParams.stepNumber).toBe(5);
    expect(capturedParams.context).toEqual({ x: 1 });
  });

  test('agent has name property', () => {
    const agent = new Agent({
      name: 'MyAgent',
      run: async () => 'ok'
    });
    expect(agent.name).toBe('MyAgent');
  });

  test('name defaults to "Agent"', () => {
    const agent = new Agent({
      run: async () => 'ok'
    });
    expect(agent.name).toBe('Agent');
  });

  test('isComplete uses provided function', () => {
    const agent = new Agent<{ done: boolean }, string, string>({
      run: async () => 'ok',
      isComplete: (state) => state.done
    });

    expect(agent.isComplete({ done: false })).toBe(false);
    expect(agent.isComplete({ done: true })).toBe(true);
  });

  test('isComplete defaults to false when not provided', () => {
    const agent = new Agent<{}, string, string>({
      run: async () => 'ok'
    });

    expect(agent.isComplete({})).toBe(false);
  });
});
```

### Dependencies
- **Requires:** Story 1.1 (types) must be complete
- **CRITICAL:** Types in 1.1 need fixing - Task 0 handles this
- **Types needed:** `Step`, `Constraints`, `AgentConfig`, `AgentRunParams`

### Type Fix Details (Task 0)

The current `AgentConfig` and `AgentRunParams` in types.ts are wrong. Fix them:

**Current (WRONG):**
```typescript
interface AgentConfig<TState, _TInput, _TOutput> {
  name: string;  // WRONG: should be optional
  constraints?: Constraints;  // REMOVE
  initialState?: TState;  // REMOVE
  // MISSING: run, isComplete
}

interface AgentRunParams<TState, TInput, _TOutput> {
  input: TInput;
  state: TState;  // WRONG: rename to context
  context?: LoadedContext<TState>;  // REMOVE
  // MISSING: stepNumber, stepHistory, constraints
}
```

**Target (CORRECT):**
```typescript
interface AgentConfig<TState, TInput, TOutput> {
  name?: string;
  run: (params: AgentRunParams<TState, TInput, TOutput>) => Promise<TOutput>;
  isComplete?: (state: TState) => boolean;
}

interface AgentRunParams<TState, TInput, TOutput> {
  input: TInput;
  context: TState;
  stepNumber: number;
  stepHistory: Step<TInput, TOutput>[];
  constraints: Constraints;
}
```

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 3: Create Agent]
- [Source: _bmad-output/epics-harness.md#Story 2.1: Create Agent Class]
- [Source: _bmad-output/prd-harness.md#Agent class]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Task 0 skipped - Story 1.1a already fixed AgentConfig/AgentRunParams types
- Tests written first (TDD approach)
- All 29 tests passing (24 previous + 5 new Agent tests)
- Fixed TypeScript narrowing issue in test by using `undefined` instead of `null`
- Fixed lint warnings by replacing `{}` with `Record<string, never>`

### Completion Notes List
- Created Agent class as thin wrapper around user's run function
- Implemented name property with default 'Agent' when not provided
- Implemented run() method that calls user's run function with all params
- Implemented isComplete() method with default false when not provided
- All 5 acceptance criteria covered by tests
- TypeScript compilation verified
- All linting errors resolved

### File List
- `packages/sdk/src/harness/agent.ts` (new - Agent class implementation)
- `packages/sdk/tests/unit/harness.test.ts` (modified - added 5 Agent tests)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - Agent class created with all acceptance criteria met, all tests passing | Dev Agent (Amelia) |
| 2024-12-24 | Code review PASSED - All ACs verified, clean implementation | Code Review (Amelia) |
