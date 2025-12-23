# Story 4.1: Create Harness Index Exports

**Status:** review

## Story

As a **developer using the SDK**,
I want **to import harness primitives from a single location**,
so that **I have a clean API surface**.

## Acceptance Criteria

1. **AC1:** Given I import from 'harness/index', When I check exports, Then BaseHarness, Agent, PersistentState are available
2. **AC2:** Given I import types from 'harness/index', When I check type exports, Then Step, StateDelta, Constraints, LoadedContext, HarnessConfig are available

## Tasks / Subtasks

- [x] Task 1: Write failing tests for harness exports (AC: 1-2)
  - [x] 1.1: Add exports test suite to `packages/sdk/tests/unit/harness.test.ts`
  - [x] 1.2: Write test for exports all harness primitives (AC1)
  - [x] 1.3: Run tests and confirm they fail

- [x] Task 2: Implement harness index exports (AC: 1-2)
  - [x] 2.1: Create `packages/sdk/src/harness/index.ts` file
  - [x] 2.2: Export BaseHarness from `./base-harness.js`
  - [x] 2.3: Export Agent from `./agent.js`
  - [x] 2.4: Export PersistentState from `./state.js`
  - [x] 2.5: Export all types from `./types.js`

- [x] Task 3: Verify all tests pass (AC: 1-2)
  - [x] 3.1: Run `bun test` to verify all export tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/harness/index.ts`
- **Test location:** `packages/sdk/tests/unit/harness.test.ts` (append to existing)
- **Pattern:** TDD - write tests first, then implement

### Technical Specifications

```typescript
// packages/sdk/src/harness/index.ts

// Classes
export { BaseHarness } from './base-harness.js';
export { Agent } from './agent.js';
export { PersistentState } from './state.js';

// Types
export type {
  Step,
  StateDelta,
  Constraints,
  LoadedContext,
  HarnessConfig,
  StepYield,
  PersistentStateConfig,
  AgentConfig,
  AgentRunParams,
} from './types.js';
```

### Key Implementation Details

1. **ESM imports:** Use `.js` extension in imports (TypeScript ESM convention)
2. **Re-export pattern:** Simple re-exports from individual modules
3. **Type exports:** Use `export type` for type-only exports

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 503-515):

```typescript
describe('Harness Exports', () => {
  test('exports all harness primitives', async () => {
    const exports = await import('../../src/harness/index.js');
    
    expect(exports.BaseHarness).toBeDefined();
    expect(exports.Agent).toBeDefined();
    expect(exports.PersistentState).toBeDefined();
  });
});
```

### Dependencies
- **Requires:** Stories 1.1, 1.2, 2.1, 3.1, 3.2 must be complete
- **All harness modules must exist before creating index**

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 5: Create Index Exports]
- [Source: _bmad-output/epics-harness.md#Story 4.1: Create Harness Index Exports]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Tests written first (TDD approach)
- All 44 tests passing (42 previous + 2 new export tests)
- Created harness index.ts with all exports

### Completion Notes List
- Created harness/index.ts with exports for BaseHarness, Agent, PersistentState
- Exported all types: Step, StateDelta, Constraints, LoadedContext, HarnessConfig, StepYield, PersistentStateConfig, AgentConfig, AgentRunParams
- Added 2 tests for harness exports (AC1-2)
- All tests passing
- TypeScript compilation verified

### File List
- `packages/sdk/src/harness/index.ts` (new - harness index exports)
- `packages/sdk/tests/unit/harness.test.ts` (modified - added 2 export tests)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - harness index exports created, all tests passing | Dev Agent (Amelia) |
