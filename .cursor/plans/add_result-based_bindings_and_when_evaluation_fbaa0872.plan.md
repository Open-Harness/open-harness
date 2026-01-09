---
name: Add Result-based bindings and when evaluation
overview: Add Result-based versions of `resolveBindings` and `evaluateWhen` functions, update `runtime.ts` to use them with proper error handling, and ensure all quality gates pass (no TypeScript errors, no Biome warnings, no test regressions).
todos:
  - id: "1"
    content: Add Result-based functions to bindings.ts (resolveBindingStringResult, resolveBindingsResult, resolveValueResult)
    status: completed
  - id: "2"
    content: Add Result-based functions to when.ts (evaluateWhenASTResult, evaluateWhenResult)
    status: completed
  - id: "3"
    content: "Update runtime.ts: add error conversion helper and update 6 call sites to use Result-based versions"
    status: completed
  - id: "4"
    content: Add tests for resolveBindingsResult in bindings.test.ts
    status: completed
  - id: "5"
    content: Add tests for evaluateWhenResult in when.test.ts
    status: completed
  - id: "6"
    content: Run typecheck and fix TypeScript errors
    status: completed
  - id: "7"
    content: Run lint and fix Biome warnings/errors
    status: completed
  - id: "8"
    content: Run tests and verify no regressions, all new tests pass
    status: completed
isProject: false
---

# Add Result-based bindings and when evaluation

## Problem

The runtime calls `resolveBindings` and `evaluateWhen` which internally use `evaluateExpression` (throwing API). Syntax errors in bindings/when expressions crash the runtime instead of being handled gracefully as `ExecutionError`.

## Solution

Add Result-based versions that return `ExpressionResult<T>`, update runtime to use them, and convert `ExpressionError` to `ExecutionError` for consistent error handling.

## Implementation Steps

### 1. Add Result-based functions to `bindings.ts`

**File**: `packages/internal/core/src/runtime/expressions/bindings.ts`

- Import `evaluateExpressionResult`, `evaluateTemplateResult`, `resolveTemplateResult` from `./expressions.js`
- Import `ExpressionResult`, `ok` from `neverthrow` and `./errors.js`
- Add `resolveBindingStringResult(template, context): Promise<ExpressionResult<unknown>>`
- Use `evaluateExpressionResult` for pure bindings
- Use `evaluateTemplateResult` for mixed templates
- Add `resolveBindingsResult<T>(input, context): Promise<ExpressionResult<T>>`
- Calls internal `resolveValueResult`
- Add `resolveValueResult(value, context): Promise<ExpressionResult<unknown>>`
- Handle strings: call `resolveBindingStringResult`
- Handle arrays: map all items, fail-fast on first error, unwrap all values on success
- Handle objects: resolve all entries, fail-fast on first error, build object on success
- Handle primitives: return `ok(value)`

### 2. Add Result-based functions to `when.ts`

**File**: `packages/internal/core/src/runtime/expressions/when.ts`

- Import `evaluateExpressionResult` from `./expressions.js`
- Import `ExpressionResult`, `ok` from `neverthrow` and `./errors.js`
- Add `evaluateWhenASTResult(expr, context): Promise<ExpressionResult<boolean>>`
- Handle `equals`: use `evaluateExpressionResult`, check for errors, compare values
- Handle `not`: recursively evaluate, flip result on success
- Handle `and`: fail-fast on first false or error
- Handle `or`: return true on first true, fail-fast on errors
- Add `evaluateWhenResult(expr, context): Promise<ExpressionResult<boolean>>`
- Return `ok(true)` for undefined/null
- For strings: use `evaluateExpressionResult`, coerce to boolean
- For AST: call `evaluateWhenASTResult`

### 3. Update `runtime.ts` to use Result-based versions

**File**: `packages/internal/core/src/runtime/execution/runtime.ts`

- Import `resolveBindingsResult` from `../expressions/bindings.js`
- Import `evaluateWhenResult` from `../expressions/when.js`
- Import `ExpressionError` from `../expressions/errors.js`
- Add helper `convertExpressionErrorToExecutionError(exprError, message, nodeId?, runId?): ExecutionError`
- Creates `ExecutionError` with code `INPUT_VALIDATION_ERROR`, preserves original error

**Update 5 call sites:**

1. **Line ~381** - `evaluateWhen` for node `when` condition:

- Call `evaluateWhenResult`
- On error: set node status to "failed", emit error event, handle `continueOnError` policy
- On success: use `shouldRun` value

2. **Line ~416** - `resolveBindings` for node input:

- Call `resolveBindingsResult`
- On error: set node status to "failed", emit error event, handle `continueOnError` policy, `continue`
- On success: use `resolvedInput` value

3. **Line ~580** - `evaluateWhen` for edge `when` condition:

- Call `evaluateWhenResult`
- On error: mark edge as "failed", emit edge error event, `continue`
- On success: use `shouldFire` value

4. **Line ~624** - `resolveBindings` for forEach iteration:

- Call `resolveBindingsResult`
- On error: throw `ExecutionError` (wrapped) or handle gracefully
- On success: use `resolved.value`

5. **Line ~646** - `evaluateWhen` for forEach iteration:

- Call `evaluateWhenResult`
- On error: handle gracefully (skip iteration or fail)
- On success: use `shouldRun` value

6. **Line ~671** - `resolveBindings` for forEach iteration input:

- Call `resolveBindingsResult`
- On error: handle gracefully (skip iteration or fail)
- On success: use `resolvedInput` value

### 4. Add tests for Result-based functions

**File**: `packages/open-harness/core/tests/unit/bindings.test.ts`

- Add `describe("resolveBindingsResult")` block:
- Test successful resolution (nested paths, arrays, objects)
- Test syntax error handling (invalid JSONata expression)
- Test missing path handling (returns undefined, not error)
- Test error propagation through nested structures

**File**: `packages/open-harness/core/tests/unit/when.test.ts`

- Add `describe("evaluateWhenResult")` block:
- Test successful evaluation (all existing cases)
- Test syntax error handling (invalid JSONata expression)
- Test error propagation through AST (and/or/not)
- Test missing path handling (returns false, not error)

### 5. Quality Gates

**TypeScript**:

- Run `bun run typecheck` in `packages/internal/core`
- Fix any type errors (imports, return types, generic constraints)

**Biome**:

- Run `bun run lint` in `packages/internal/core`
- Fix formatting, unused imports, any warnings

**Tests**:

- Run `bun run test` in `packages/open-harness/core`
- Ensure all existing tests pass (no regressions)
- Verify new Result-based tests pass
- Check runtime integration tests if they exist

**Manual verification**:

- Verify error messages are clear and include context
- Verify error handling respects `continueOnError` policy
- Verify edge error handling doesn't crash runtime

## Files to Modify

1. `packages/internal/core/src/runtime/expressions/bindings.ts` - Add Result-based functions
2. `packages/internal/core/src/runtime/expressions/when.ts` - Add Result-based functions
3. `packages/internal/core/src/runtime/execution/runtime.ts` - Update 6 call sites
4. `packages/open-harness/core/tests/unit/bindings.test.ts` - Add tests
5. `packages/open-harness/core/tests/unit/when.test.ts` - Add tests

## Notes

- Keep existing throwing APIs (`resolveBindings`, `evaluateWhen`) for backward compatibility
- Result-based versions are marked `@internal` for internal use
- Error conversion preserves original `ExpressionError` in `ExecutionError.originalError`
- Fail-fast strategy: first error in arrays/objects stops processing (can be enhanced later)