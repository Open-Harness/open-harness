# Alpha Prep Cleanup - Quality Gates Handoff

**CRITICAL**: Zero tolerance for errors. All linting and type errors must be resolved before merging.

## Status Summary

**Packages to fix:**
- `packages/kernel` - 16 biome errors, 5 warnings, 29 infos + 31 TypeScript errors
- `apps/horizon-agent` - TypeScript errors (TBD count)

**Philosophy**: We don't accept errors "because it's test code" or "because it's scripts". Every file in this repo must pass type checking and linting. If types are complex, we add type guards or helper functions. If SDK types changed, we adapt properly.

---

## Part 1: Biome Lint/Format Issues (packages/kernel)

### Issue Categories

#### 1. **Import Organization** (7 errors - CRITICAL)
**Rule**: `assist/source/organizeImports`
**Files affected**:
- scripts/live/delta-events-live.ts
- scripts/live/reproduce-issue-54.ts
- scripts/live/test-schema-file-support.ts
- scripts/live/test-structured-output.ts
- scripts/live/thinking-events-live.ts
- src/nodes/claude.agent.ts
- src/nodes/index.ts

**Fix approach**:
```bash
# Auto-fix with biome
cd packages/kernel
bun run check:fix  # or biome check . --write
```

**Verification**: Ensure imports are alphabetically sorted and unused imports removed.

---

#### 2. **Node.js Import Protocol** (10+ violations - INFO)
**Rule**: `lint/style/useNodejsImportProtocol`
**Pattern**: Missing `node:` prefix on builtin modules

**Examples**:
```typescript
// ❌ Wrong
import { mkdirSync } from "fs";
import { resolve } from "path";

// ✅ Correct
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
```

**Files affected**: All scripts in `scripts/live/`

**Fix approach**: Auto-fixable. Run `bun run check:fix`.

---

#### 3. **Template Literals vs String Concatenation** (11 infos)
**Rule**: `lint/style/useTemplate`
**Pattern**: String concatenation with `+` instead of template literals

**Examples**:
```typescript
// ❌ Wrong
console.log("\n" + "=".repeat(80));
const path = process.cwd() + "/" + filename;

// ✅ Correct
console.log(`\n${"=".repeat(80)}`);
const path = `${process.cwd()}/${filename}`;
```

**Fix approach**: Auto-fixable. Run `bun run check:fix`.

---

#### 4. **Unused Variables/Imports** (10 warnings/infos)
**Rule**: `lint/correctness/noUnusedVariables`, `lint/correctness/noUnusedImports`

**Fix approach**:
1. Review each unused variable - is it actually needed?
2. If debugging code, remove or comment appropriately
3. If parameter required by signature but unused, prefix with `_`: `_unusedParam`

**Manual review required** - don't blindly delete.

---

#### 5. **Literal Keys** (11 infos)
**Rule**: `lint/complexity/useLiteralKeys`
**Pattern**: Accessing object properties with bracket notation when dot notation works

**Example**:
```typescript
// ❌ Avoid (unless dynamic)
obj["propertyName"]

// ✅ Prefer
obj.propertyName
```

**Fix approach**: Auto-fixable in most cases.

---

#### 6. **Formatting** (9 files need formatting)
**Files**:
- scripts/live/capture-raw-sdk.ts
- scripts/live/reproduce-issue-54.ts
- scripts/live/test-schema-file-support.ts
- scripts/live/test-structured-output.ts
- scripts/live/thinking-events-live.ts
- src/core/types.ts
- tests/fixtures/schemas/greeting-schema.json
- tests/fixtures/schemas/reviewer-schema.json
- tests/unit/claude-node.test.ts

**Fix approach**:
```bash
bun run check:fix  # Formats all files
```

---

## Part 2: TypeScript Errors (packages/kernel)

### Error Categories

#### Category A: SDK Type Mismatches - `SDKResultMessage` (22 errors)

**Pattern**: Accessing `result` or `structured_output` on `SDKResultMessage` without type narrowing.

**Files affected**:
- scripts/live/reproduce-issue-54.ts (9 errors)
- scripts/live/test-structured-output.ts (9 errors)
- scripts/live/test-schema-file-support.ts (implied, needs verification)

**Root cause**: `SDKResultMessage` is a discriminated union. Not all subtypes have these properties.

**Fix approach - Option 1: Type guards**
```typescript
function isSuccessResult(msg: SDKResultMessage): msg is SDKSuccessMessage {
  return msg.type === "result" && msg.subtype === "success";
}

// Usage
if (isSuccessResult(resultMsg)) {
  console.log(resultMsg.result);  // ✅ Safe
  console.log(resultMsg.structured_output);  // ✅ Safe
}
```

**Fix approach - Option 2: Type assertion with validation**
```typescript
if (resultMsg.type === "result" && "result" in resultMsg) {
  const successMsg = resultMsg as SDKSuccessMessage;
  console.log(successMsg.result);
}
```

**Fix approach - Option 3: Optional chaining**
```typescript
// If it's OK for these to be undefined
console.log(resultMsg.result ?? "No result");
console.log(resultMsg.structured_output ?? null);
```

**Recommendation**: Use type guards (Option 1) for clarity and type safety.

---

#### Category B: Missing `cancel` Property - `NodeRunContext` (3 errors)

**Files affected**:
- scripts/live/test-schema-file-support.ts (3 errors at lines 60, 110, 143)

**Pattern**: Mock `NodeRunContext` objects missing the `cancel` property.

**Error**:
```
Property 'cancel' is missing in type '{ nodeId: string; ... }'
but required in type 'NodeRunContext'.
```

**Fix approach**: Add the `cancel` method to mock contexts.

```typescript
const mockContext: NodeRunContext = {
  nodeId: "test",
  runId: "run-123",
  emit: (event: unknown) => {},
  state: {
    get: () => undefined,
    set: () => {}
  },
  inbox: {
    next: () => undefined
  },
  getAgentSession: () => undefined,
  setAgentSession: (id: string) => {},
  resumeMessage: undefined,
  events: [],
  cancel: { isCancelled: false }  // ✅ Add this
};
```

**Note**: Check `NodeRunContext` type definition to ensure `cancel` shape matches.

---

#### Category C: Undefined Properties - `text` (2 errors)

**Files affected**:
- scripts/record-fixtures.ts (line 28)
- src/nodes/claude.agent.ts (line 406)

**Pattern**: Assigning `string | undefined` to `string`.

**Error 1 - record-fixtures.ts**:
```typescript
// Issue: ClaudeAgentOutput.text is `string | undefined`
// But FixtureOutput.text expects `string`
Type 'ClaudeAgentOutput' is not assignable to type 'FixtureOutput'.
  Types of property 'text' are incompatible.
```

**Fix approach**:
```typescript
// Option 1: Provide default
const fixture: FixtureOutput = {
  ...output,
  text: output.text ?? ""  // ✅ Guarantee string
};

// Option 2: Assert non-null (if you're certain)
const fixture: FixtureOutput = {
  ...output,
  text: output.text!  // ⚠️ Only if you're sure it's never undefined
};

// Option 3: Update FixtureOutput type to allow undefined
// (if that's the actual contract)
```

**Error 2 - claude.agent.ts (line 406)**:
Similar issue - review context and apply same fix pattern.

---

#### Category D: Type Assertion Issues - `structured_output` (5 errors)

**Files affected**:
- tests/unit/claude-node.test.ts (lines 51, 71, 89, 110, 118)

**Pattern**: Unsafe type conversions.

**Error**:
```typescript
error TS2352: Conversion of type
'{ [key: string]: unknown; type: string; } | undefined'
to type '{ content: string; }' may be a mistake...
```

**Fix approach**: Add proper type validation.

**Before** (unsafe):
```typescript
const output = result.structured_output as { content: string };
```

**After** (safe):
```typescript
// Option 1: Runtime validation
function isContentOutput(obj: unknown): obj is { content: string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "content" in obj &&
    typeof (obj as any).content === "string"
  );
}

const output = result.structured_output;
if (isContentOutput(output)) {
  console.log(output.content);  // ✅ Type-safe
}

// Option 2: Zod schema validation (if available)
const ContentSchema = z.object({ content: z.string() });
const output = ContentSchema.parse(result.structured_output);
```

**Recommendation**: Use runtime validation (Option 1) for test assertions.

---

#### Category E: Possible Undefined Access (2 errors)

**Files affected**:
- scripts/live/capture-raw-sdk.ts (lines 88, 190)

**Pattern**: `Object is possibly 'undefined'`

**Fix approach**:
```typescript
// Before
someObject.property  // ❌ If someObject might be undefined

// After - Option 1: Optional chaining
someObject?.property

// After - Option 2: Guard check
if (someObject) {
  someObject.property  // ✅ Safe
}

// After - Option 3: Non-null assertion (if you're certain)
someObject!.property  // ⚠️ Only if you're absolutely sure
```

**Recommendation**: Use optional chaining (Option 1) unless you need to handle the undefined case differently.

---

## Part 3: TypeScript Errors (apps/horizon-agent)

**Total errors**: 11 (10 in tests/integration.test.ts + 1 from kernel dependency)

### Error Categories

#### Category F: Missing/Removed Kernel Exports (7 errors)

**File**: tests/integration.test.ts

**Errors**:
- `EnrichedEvent` - no longer exported
- `FlowYaml` - no longer exported
- `controlForeachNode` - no longer exported
- `controlNoopNode` - no longer exported
- `executeFlow` - no longer exported
- `HubImpl` - no longer exported
- `NodeRegistry` - only type exported, not value

**Root cause**: These are V2 kernel APIs that were removed. The integration test is testing old functionality.

**Fix approach - Option 1: Update test to V3 API**
```typescript
// Old V2 API
import { executeFlow, HubImpl, controlForeachNode } from "@open-harness/kernel";

// New V3 API
import { createRuntime, parseFlowYaml, DefaultNodeRegistry } from "@open-harness/kernel";
```

**Fix approach - Option 2: Delete the test**
If this test is testing V2-specific behavior that no longer exists, delete it entirely.

**Fix approach - Option 3: Mark test as skipped temporarily**
```typescript
test.skip("integration test - needs V3 migration", () => {
  // Old test code
});
```

**Recommendation**: Review what the test validates. If it's important functionality, migrate to V3 API. If it's testing removed features, delete it.

---

#### Category G: Implicit Any Types (3 errors)

**File**: tests/integration.test.ts (lines 38, 65, 88)

**Pattern**: Parameters without type annotations in test functions.

**Error**:
```
Parameter '_ctx' implicitly has an 'any' type.
```

**Fix approach**:
```typescript
// Before
const myNode = (input: any, _ctx) => {  // ❌ _ctx has implicit any
  return input;
};

// After
import type { NodeRunContext } from "@open-harness/kernel";

const myNode = (input: any, _ctx: NodeRunContext) => {  // ✅ Typed
  return input;
};
```

**Note**: Since parameter is prefixed with `_`, it's intentionally unused. Still needs type annotation to satisfy strict TypeScript.

---

#### Category H: Kernel Dependency Error (1 error)

**File**: ../../packages/kernel/src/nodes/claude.agent.ts (line 406)

**This is the same Category C error from Part 2**. Will be fixed when kernel is fixed.

**No action needed in horizon-agent** - fixing kernel fixes this.

---

## Execution Plan

### Phase 1: Auto-fix (5 minutes)
```bash
cd packages/kernel
bun run check:fix  # Auto-fixes formatting, imports, templates, etc.
git diff  # Review changes
git add -u && git commit -m "chore: auto-fix biome lint issues"
```

### Phase 2: Manual TypeScript Fixes (30-60 minutes)

**Priority order**:
1. **Category B** (Missing cancel) - Add cancel to mocks (3 files)
2. **Category C** (text undefined) - Fix output types (2 files)
3. **Category A** (SDK types) - Add type guards for SDKResultMessage (3 files)
4. **Category D** (Type assertions) - Add runtime validation (1 file)
5. **Category E** (Undefined access) - Add optional chaining (1 file)

**Approach for each**:
1. Fix one category completely
2. Run `bun run typecheck`
3. Verify count reduced
4. Commit: `chore(kernel): fix [category] type errors`
5. Move to next category

### Phase 3: Horizon Agent Cleanup (15-30 minutes)

**File to fix**: `tests/integration.test.ts`

**Priority order**:
1. **Category G** (Implicit any) - Add type annotations (3 locations)
2. **Category F** (Missing exports) - Migrate or delete test

**For Category F**, investigate the test first:
```bash
# Read the test to understand what it validates
cat apps/horizon-agent/tests/integration.test.ts
```

Then decide:
- **If important**: Migrate to V3 API (refer to packages/kernel examples)
- **If obsolete**: Delete the file
- **If unsure**: Skip the test with `.skip()` and file a GitHub issue

**After kernel is fixed**, Category H resolves automatically.

### Phase 4: Final Verification (5 minutes)
```bash
# From repo root
bun install  # Ensure deps fresh
cd packages/kernel && bun run typecheck && bun run check
cd ../../apps/horizon-agent && bun run typecheck
# Both should exit 0 with no errors
```

---

## Part 4: Docs App Linting (apps/docs)

**Status**: Minor linting issues, types pass

### Issue Categories

#### Biome Config Schema Mismatch
**File**: `biome.json`
**Issue**: Schema version 2.2.0 doesn't match CLI 2.3.10

**Fix**:
```bash
cd apps/docs
biome migrate  # Updates config to current version
```

#### Non-null Assertions (4 warnings)
**Rule**: `lint/style/noNonNullAssertion`
**Files**:
- `scripts/sync-kernel-docs.ts` (lines 177, 277, 359, 372)

**Pattern**: Using `!` operator on array access

**Fix approach**:
```typescript
// Before
const link = links[k]!;  // ❌ Non-null assertion

// After - Option 1: Guard check
const link = links[k];
if (!link) continue;
// Use link safely here

// After - Option 2: Optional chaining (if safe to skip)
const link = links[k];
if (link) {
  // Process link
}
```

#### Explicit Any (1 warning)
**File**: `src/app/docs/[[...slug]]/page.tsx` (line 51)
**Pattern**: Using `as any` cast

**Fix approach**:
```typescript
// Before
a: createRelativeLink(source, page) as any,

// After: Define proper type
a: createRelativeLink(source, page) as ComponentType<AnchorHTMLAttributes<HTMLAnchorElement>>
// Or if the type is too complex, at least add a comment explaining why
```

#### CSS !important (2 auto-fixable)
**File**: `src/app/global.css` (lines 8, 14)
**Pattern**: Using `!important` in CSS

**Fix**: Auto-fixable with `biome check --write`

---

## Success Criteria

**Before pushing**:
- [ ] `cd packages/kernel && bun run check` exits 0 (no errors, warnings, or infos)
- [ ] `cd packages/kernel && bun run typecheck` exits 0 (no type errors)
- [ ] `cd apps/horizon-agent && bun run typecheck` exits 0 (no type errors)
- [ ] `cd apps/docs && biome check .` exits 0 (no errors, warnings, or infos)
- [ ] `cd apps/docs && bun run types:check` exits 0 (already passing)
- [ ] All changes committed with clear, categorized commit messages
- [ ] Git status clean

**Zero tolerance** - if any check fails, the work is not done.

---

## Notes for Agents

1. **Don't skip errors**: Every single error must be fixed. "It's just a script" is not an excuse.

2. **Understand before fixing**: Read the error, understand the type mismatch, then apply the correct fix. Don't blindly cast types.

3. **Use type guards**: When dealing with discriminated unions (like `SDKResultMessage`), write proper type guard functions. This makes code safer and more maintainable.

4. **Test your fixes**: After each category, run the type checker. Make sure errors decrease, not increase.

5. **Commit incrementally**: Don't fix everything then commit once. Commit after each category so progress is tracked.

6. **When stuck**: If a type error seems impossible to fix, it might indicate:
   - The SDK types changed and we're using deprecated API
   - The test is testing something that no longer exists
   - The types are correct and our code has a real bug

   In these cases, ask for guidance rather than forcing a fix.

---

## Handoff Questions

Before you start, answer these:

1. Have you read the entire manifest?
2. Do you understand the zero-tolerance policy?
3. Are you clear on the difference between auto-fixable (Phase 1) and manual fixes (Phase 2)?
4. Do you know how to write type guards for discriminated unions?
5. Are you prepared to commit after each category of fixes?

If you answered "no" to any, re-read the relevant section before proceeding.

---

## Final Checkpoint

When complete, this should be true:

```bash
cd /Users/abuusama/projects/open-harness/open-harness

# All these exit with code 0
cd packages/kernel && bun run check
cd packages/kernel && bun run typecheck
cd ../../apps/horizon-agent && bun run typecheck

echo "✅ Alpha prep cleanup complete - zero errors"
```

**Only then** are we ready to push.
