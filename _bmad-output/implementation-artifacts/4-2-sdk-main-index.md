# Story 4.2: Update SDK Main Index

**Status:** review

## Story

As a **developer using the SDK**,
I want **harness primitives exported from the main SDK package**,
so that **I can import everything from one place**.

## Acceptance Criteria

1. **AC1:** Given I import from the SDK package (src/index.ts), When I check exports, Then BaseHarness, Agent, PersistentState are available
2. **AC2:** Given I import from the SDK package, When I check type exports, Then harness types are available

## Tasks / Subtasks

- [x] Task 1: Write failing tests for SDK exports (AC: 1-2)
  - [x] 1.1: Add SDK exports test to `packages/sdk/tests/unit/harness.test.ts`
  - [x] 1.2: Write test for SDK exports harness primitives (AC1)
  - [x] 1.3: Run tests and confirm they fail

- [x] Task 2: Update SDK main index (AC: 1-2)
  - [x] 2.1: Open `packages/sdk/src/index.ts`
  - [x] 2.2: Add export statement: `export * from './harness/index.js'`
  - [x] 2.3: Verify no naming conflicts with existing exports

- [x] Task 3: Verify all tests pass (AC: 1-2)
  - [x] 3.1: Run `bun test` to verify all SDK export tests pass
  - [x] 3.2: Verify TypeScript compilation succeeds
  - [x] 3.3: Verify no breaking changes to existing exports

## Dev Notes

### Architecture Requirements
- **File location:** `packages/sdk/src/index.ts` (modify existing)
- **Test location:** `packages/sdk/tests/unit/harness.test.ts` (append to existing)
- **Pattern:** TDD - write tests first, then implement

### Technical Specifications

Add to existing `packages/sdk/src/index.ts`:

```typescript
// Existing exports...

// Harness primitives
export * from './harness/index.js';
```

### Key Implementation Details

1. **Non-breaking:** Adding exports should not break existing imports
2. **Namespace check:** Ensure no naming conflicts with existing SDK exports
3. **ESM imports:** Use `.js` extension

### Test Code Reference
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 528-539):

```typescript
describe('SDK Exports', () => {
  test('SDK exports harness primitives', async () => {
    const sdk = await import('../../src/index.js');
    
    expect(sdk.BaseHarness).toBeDefined();
    expect(sdk.Agent).toBeDefined();
    expect(sdk.PersistentState).toBeDefined();
  });
});
```

### Existing SDK Exports to Check

Review `packages/sdk/src/index.ts` for potential conflicts:
- Existing Agent class? (unlikely to conflict if in different namespace)
- Check all existing exports before adding harness exports

### Dependencies
- **Requires:** Story 4.1 (harness index) must be complete
- **Modifies:** `packages/sdk/src/index.ts`

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 6: Update SDK Index]
- [Source: _bmad-output/epics-harness.md#Story 4.2: Update SDK Main Index]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Tests written first (TDD approach)
- All 44 tests passing (includes 2 new SDK export tests)
- No naming conflicts detected with existing exports

### Completion Notes List
- Updated SDK main index.ts to export harness primitives
- Added `export * from './harness/index.js'` to index.ts
- Verified no naming conflicts (BaseAgent vs BaseHarness, different namespaces)
- Added 2 tests for SDK exports (AC1-2)
- All tests passing
- No breaking changes to existing exports

### File List
- `packages/sdk/src/index.ts` (modified - added harness exports)
- `packages/sdk/tests/unit/harness.test.ts` (modified - added 2 SDK export tests)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - SDK main index updated with harness exports, all tests passing | Dev Agent (Amelia) |
