# Legacy Code Audit Report

**Date:** 2026-01-31
**Branch:** `ralphy/opus-run`
**Auditor:** Claude Opus 4.5

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| @deprecated markers | 2 | Active, migration paths exist |
| TODO/FIXME/HACK | 0 | Clean ✓ |
| Type casting escapes (`as unknown as`) | 0 | Clean ✓ (was 9, refactored) |
| ESLint bypasses | 1 | Justified ✓ |
| @ts-ignore | 0 | Clean ✓ |
| Loose `any` typing | 0 | Clean ✓ |
| Dual implementations | 0 | Clean ✓ |
| Dead code | 0 | Clean ✓ |

**Overall Technical Debt Level: LOW**

---

## Category 1: @deprecated Markers

### 1.1 ProviderRecorder.save()

**Location:** `packages/core/src/Services/ProviderRecorder.ts:61`

```typescript
/**
 * @deprecated Use startRecording, appendEvent, finalizeRecording for crash-safe incremental recording.
 */
readonly save: (entry: Omit<RecordingEntry, "recordedAt">) => Effect.Effect<void, StoreError>
```

**Action:** DELETE after verifying no callers. The incremental API is the canonical approach.

### 1.2 EVENTS Constant

**Location:** `packages/core/src/Engine/types.ts:55`

```typescript
/**
 * @deprecated Use tagToEventName from Domain/Events.ts instead.
 */
export const EVENTS = { ... }
```

**Action:** DELETE and update any remaining imports to use `tagToEventName`.

---

## Category 2: Type Casting Escapes (`as unknown as`)

### Current State

All 9 instances are in test files for validation testing:

| File | Line | Context |
|------|------|---------|
| `packages/core/test/workflow.test.ts` | 93 | `initialState: undefined as unknown as TestState` |
| `packages/core/test/workflow.test.ts` | 105 | `start: undefined as unknown as () => void` |
| `packages/core/test/workflow.test.ts` | 119 | `} as unknown as SimpleWorkflowDef<TestState>` |
| `packages/core/test/workflow.test.ts` | 129 | `} as unknown as SimpleWorkflowDef<TestState>` |
| `packages/core/test/workflow.test.ts` | 153 | `} as unknown as PhaseWorkflowDef<...>` |
| `packages/core/test/agent.test.ts` | 82 | `provider: undefined as unknown as AgentProvider` |
| `packages/core/test/agent.test.ts` | 95 | `output: undefined as unknown as z.ZodType<unknown>` |
| `packages/core/test/agent.test.ts` | 108 | `prompt: undefined as unknown as () => string` |
| `packages/core/test/agent.test.ts` | 121 | `update: undefined as unknown as () => void` |

### Problem

These type casts bypass TypeScript's type system to test validation. While previously acceptable per CLAUDE.md exceptions, we can now tighten this rule.

### Solution

The `workflow()` function already uses `Schema.decodeUnknownSync(WorkflowDefSchema)` internally (ADR-005). The proper fix is:

1. **For `workflow()`**: Export a `validateWorkflowDef(input: unknown)` function
2. **For `agent()`**: Add Effect Schema validation (like `workflow()` has)
3. **Tests**: Call validation functions directly with untyped inputs

### Why `satisfies` Won't Work

`satisfies` is compile-time type checking for *valid* data. It cannot be used to test with invalid inputs because:

```typescript
// ❌ Won't compile - satisfies rejects invalid data
const bad = { initialState: undefined } satisfies WorkflowDef  // Type error!

// ✅ Correct - validation functions accept unknown
validateWorkflowDef({ initialState: undefined })  // Runtime error (testable)
```

### Recommended Pattern

```typescript
// Export validation function in workflow.ts
export function validateWorkflowDef(input: unknown): WorkflowDef<unknown, unknown, string> {
  // Existing validation logic, but with unknown input type
  return workflow(input as WorkflowDef<unknown, unknown, string>)
}

// In tests - no type casting needed
it("throws if initialState is undefined", () => {
  expect(() => validateWorkflowDef({
    name: "test",
    initialState: undefined,
    start: () => {},
    agent: simpleAgent
  })).toThrow("Workflow \"test\" requires 'initialState' field")
})
```

---

## Category 3: ESLint Bypass

### 3.1 execute.ts prefer-const

**Location:** `packages/core/src/Engine/execute.ts:340`

```typescript
// eslint-disable-next-line prefer-const -- fiber is declared outside this scope for use in abort handlers
```

**Assessment:** JUSTIFIED. The fiber variable must be `let` for assignment in an Effect chain and access by abort handlers.

**Action:** None required.

---

## Category 4: Documentation Remnants

These are informational comments about completed cleanup work:

| File | Line | Content | Action |
|------|------|---------|--------|
| `runtime.ts` | 151 | `// Note: workflowEventToLegacy removed...` | DELETE |
| `run.ts` | 341-357 | Legacy function removal documentation | DELETE |
| `internal.ts` | 86 | `// These are removed from public API...` | KEEP (explains design) |

---

## Category 5: Intentional Design (NOT Debt)

These patterns are intentional and should remain:

### 5.1 Database Migration (`Migrations.ts:125-180`)
Proper idempotent schema evolution from `agent_fixtures` → `provider_recordings`.

### 5.2 Compatibility Bridge (`runtime.ts:145, 532`)
`onEvent` callback and `inputQueue` fallback for `execute.ts` async iterator compatibility.

### 5.3 Test Edge Cases
Type casts in tests were intentionally testing validation - but we're now tightening this.

---

## Action Items

### Priority 1: Tighten Type Casting Rule ✅ COMPLETED

1. [x] Add `validateWorkflowDef(input: unknown)` to `workflow.ts`
2. [x] Add `validateAgentDef(input: unknown)` to `agent.ts`
3. [x] Refactor `workflow.test.ts` validation tests to use `validateWorkflowDef`
4. [x] Refactor `agent.test.ts` validation tests to use `validateAgentDef`
5. [x] Update CLAUDE.md to replace "intentional edge case testing" with explicit validation testing guidance

### Priority 2: Delete Deprecated Code

1. [ ] Delete `EVENTS` constant from `types.ts`
2. [ ] Update imports in `workflow.test.ts:15` to use `tagToEventName`
3. [ ] Delete `ProviderRecorder.save()` method (verify no callers first)

### Priority 3: Clean Documentation

1. [ ] Delete comment at `runtime.ts:151`
2. [ ] Delete comment block at `run.ts:341-357`

---

## Updated CLAUDE.md Rule

Replace the current exception:

```markdown
### Exceptions

- **Error narrowing in catch blocks is acceptable**: `catch (e) { const err = e as MyError }`
- ~~**Intentional edge case testing**: `undefined as unknown as SomeType`~~
```

With:

```markdown
### Exceptions

- **Error narrowing in catch blocks is acceptable**: `catch (e) { const err = e as MyError }`
- **Validation testing**: Use validation functions that accept `unknown`, not type casts
```

---

## Appendix: Search Patterns Used

```
@deprecated
TODO|FIXME|XXX|HACK
backward.?compat|backwards.?compat
as unknown as
// eslint-disable
@ts-ignore|@ts-expect-error
\bany\b
```
