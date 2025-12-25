# Story 1.1a: Fix Agent Types

**Status:** done

## Story

As a **developer implementing the Agent class**,
I want **AgentConfig and AgentRunParams types to match the tech-spec**,
so that **Story 2.1 (Agent class) can be implemented correctly**.

## Background

Story 1.1 was implemented but the `AgentConfig` and `AgentRunParams` interfaces don't match the tech-spec requirements. This story fixes those types before Story 2.1 can proceed.

## Acceptance Criteria

1. **AC1:** Given AgentConfig interface, Then name is OPTIONAL (not required)
2. **AC2:** Given AgentConfig interface, Then it has a required `run` function that takes AgentRunParams and returns Promise<TOutput>
3. **AC3:** Given AgentConfig interface, Then it has an optional `isComplete` function that takes TState and returns boolean
4. **AC4:** Given AgentRunParams interface, Then it has: input, context (TState), stepNumber, stepHistory, constraints
5. **AC5:** Given existing harness type tests, Then they still pass after changes

## Tasks / Subtasks

- [x] Task 1: Update AgentConfig interface (AC: 1-3)
  - [x] 1.1: Open `packages/sdk/src/harness/types.ts`
  - [x] 1.2: Change `name: string` to `name?: string` (make optional)
  - [x] 1.3: Remove `constraints?: Constraints` (not needed at config level)
  - [x] 1.4: Remove `initialState?: TState` (not needed)
  - [x] 1.5: Add `run: (params: AgentRunParams<TState, TInput, TOutput>) => Promise<TOutput>`
  - [x] 1.6: Add `isComplete?: (state: TState) => boolean`

- [x] Task 2: Update AgentRunParams interface (AC: 4)
  - [x] 2.1: Rename `state: TState` to `context: TState`
  - [x] 2.2: Remove `context?: LoadedContext<TState>` (redundant)
  - [x] 2.3: Add `stepNumber: number`
  - [x] 2.4: Add `stepHistory: Step<TInput, TOutput>[]`
  - [x] 2.5: Add `constraints: Constraints`

- [x] Task 3: Verify tests pass (AC: 5)
  - [x] 3.1: Run `bun test packages/sdk/tests/unit/harness.test.ts`
  - [x] 3.2: Verify TypeScript compilation succeeds

## Dev Notes

### Current (Wrong) Implementation

```typescript
// WRONG - needs fixing
export interface AgentConfig<TState, _TInput, _TOutput> {
  name: string;  // Should be optional
  constraints?: Constraints;  // Remove
  initialState?: TState;  // Remove
  // MISSING: run, isComplete
}

export interface AgentRunParams<TState, TInput, _TOutput> {
  input: TInput;
  state: TState;  // Rename to context
  context?: LoadedContext<TState>;  // Remove
  // MISSING: stepNumber, stepHistory, constraints
}
```

### Correct Implementation (from tech-spec)

```typescript
// CORRECT - target state
export interface AgentConfig<TState, TInput, TOutput> {
  /** Optional agent name (defaults to 'Agent' in implementation) */
  name?: string;
  /** Required: The run function that executes the agent */
  run: (params: AgentRunParams<TState, TInput, TOutput>) => Promise<TOutput>;
  /** Optional: Function to check if agent/harness is complete */
  isComplete?: (state: TState) => boolean;
}

export interface AgentRunParams<TState, TInput, TOutput> {
  /** Input data for this run */
  input: TInput;
  /** Current state context */
  context: TState;
  /** Current step number */
  stepNumber: number;
  /** History of previous steps */
  stepHistory: Step<TInput, TOutput>[];
  /** Constraints for this run */
  constraints: Constraints;
}
```

### Why This Matters

Story 2.1 (Agent class) uses these types:
```typescript
const agent = new Agent<State, Input, Output>({
  name: 'MyAgent',  // Optional
  run: async (params) => { ... },  // Required
  isComplete: (state) => state.done  // Optional
});

await agent.run({
  input: data,
  context: currentState,
  stepNumber: 5,
  stepHistory: history,
  constraints: { maxTokens: 1000 }
});
```

Without the correct types, the Agent class implementation will fail TypeScript compilation.

### File Location
- `packages/sdk/src/harness/types.ts` (modify existing)

### References
- [Source: _bmad-output/tech-spec-harness-sdk.md lines 248-310]
- [Source: _bmad-output/epics-harness.md#Story 2.1]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Tests written first (TDD approach)
- All 24 tests passing (12 original + 7 new AgentConfig/AgentRunParams tests + 5 PersistentState tests)
- TypeScript compilation verified
- Fixed missing `maxContextSteps` in `PersistentStateConfig` interface (bug from Story 1.2)

### Completion Notes List
- Updated `AgentConfig` to match tech-spec: name optional, added required `run` function, added optional `isComplete` function
- Updated `AgentRunParams` to match tech-spec: renamed `state` to `context`, added `stepNumber`, `stepHistory`, `constraints`
- Removed unused type parameters (changed `_TInput`, `_TOutput` to `TInput`, `TOutput`)
- Added 7 comprehensive tests for AgentConfig and AgentRunParams covering all acceptance criteria
- Fixed `PersistentStateConfig` interface to include `maxContextSteps` property (was missing, causing lint error)

### File List
- `packages/sdk/src/harness/types.ts` (modified - AgentConfig, AgentRunParams, PersistentStateConfig)
- `packages/sdk/tests/unit/harness.test.ts` (modified - added 7 new tests for AgentConfig/AgentRunParams)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created to fix type mismatch discovered in validation | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - AgentConfig and AgentRunParams updated to match tech-spec, all tests passing | Dev Agent (Amelia) |
| 2024-12-24 | Code review PASSED - All ACs verified, marking as done | Code Review (Amelia) |
