# v0.3.0 DX Audit Fixes - Ralph Loop Prompt

Fix all blocking issues identified in the v0.3.0 DX Audit.

## Issue Manifest

Reference: `.claude/reports/v030-dx-audit-2026-01-11.yaml`

### BLOCK-001: recording-replay Snapshot API
**File**: `examples/recording-replay/index.ts`
**Lines**: 165-166
**Problem**: Uses `snap.provider.text` and `snap.provider.running` but `Snapshot` type has no `.provider` property
**Fix**:
1. Read the current Snapshot type definition to understand v0.3.0 API
2. Update lines 165-166 to use correct properties
3. The Snapshot likely has direct properties like `snap.text` or similar

### BLOCK-002: Legacy API in speckit/level-2 README
**File**: `examples/speckit/level-2/README.md`
**Lines**: 31, 35
**Problem**: Uses `setDefaultProvider` and `createClaudeNode` which don't exist in v0.3.0
**Fix**:
1. Replace `setDefaultProvider` with `setDefaultHarness`
2. Replace `createClaudeNode()` with `new ClaudeHarness()`
3. Update any imports to use `@open-harness/core`

### BLOCK-003: Legacy signal names (4 files)
**Files**:
1. `packages/internal/signals/tests/metrics-reporter.test.ts` (lines 63, 84)
2. `packages/open-harness/vitest/src/matchers.ts` (line 242)
3. `packages/open-harness/vitest/src/types.ts` (line 83)
4. `packages/internal/core/src/api/debug.ts` (lines 123-129)

**Problem**: References `provider:start`, `provider:end`, `provider:error` instead of `harness:*`
**Fix**:
1. Replace all `provider:start` with `harness:start`
2. Replace all `provider:end` with `harness:end`
3. Replace all `provider:error` with `harness:error`

## Workflow Per Iteration

1. **Check progress**
   - Read git status to see what's already been fixed
   - Read the audit report to see remaining issues

2. **Fix one issue at a time**
   - Start with BLOCK-001, then BLOCK-002, then BLOCK-003
   - After each fix, verify with typecheck/grep

3. **Verify after each fix**
   ```bash
   # After BLOCK-001
   bun x tsc --noEmit examples/recording-replay/index.ts

   # After BLOCK-002
   grep -n "setDefaultProvider\|createClaudeNode" examples/speckit/level-2/README.md

   # After BLOCK-003
   grep -rn "provider:start\|provider:end\|provider:error" packages/
   ```

4. **Run full validation when all fixed**
   ```bash
   bun run typecheck
   bun run test
   ```

## Completion Criteria

ALL of these must be true:
- [ ] BLOCK-001: `examples/recording-replay/index.ts` compiles without errors
- [ ] BLOCK-002: No `setDefaultProvider` or `createClaudeNode` in README
- [ ] BLOCK-003: Zero results from `grep -r "provider:start\|provider:end\|provider:error" packages/`
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Completion Promise

When ALL criteria above are met, output:

<promise>V030_DX_AUDIT_COMPLETE</promise>

## Escape Hatch

If after 10 iterations you cannot complete:
1. Document what's blocking in `.claude/reports/v030-dx-fixes-blocked.md`
2. List attempted solutions
3. Output: <promise>V030_DX_AUDIT_BLOCKED</promise>
