# V0.3.0 Strict Quality Sweep - Zero Warnings

## Mission
Perform a comprehensive quality sweep of the Open Harness v0.3.0 codebase. This codebase is meant to be an **exemplar of how to build agentic software** - it must have zero warnings, proper type safety, and pristine documentation.

## Philosophy
This is a framework that teaches others how to build AI agents. Every file should be:
- **Type-safe**: No `!` assertions, proper type guards everywhere
- **Lint-clean**: Zero warnings, not even in test files
- **Well-documented**: READMEs accurate and up-to-date
- **Consistent**: Same patterns used everywhere

## Review Strategy: Fan-Out → Fan-In

Launch 6 parallel review agents, then synthesize findings.

---

## Agent 1: Lint Warning Eliminator

**Mission:** Find and document ALL lint warnings across the codebase.

```bash
# Run this first
bun run lint 2>&1 | tee lint-output.txt
```

**Focus Areas:**
- `noNonNullAssertion` warnings in test files
- `noUnusedImports` warnings
- Any other Biome warnings

**For each warning, document:**
```yaml
- file: <path>
  line: <number>
  rule: <biome rule>
  current: <current code>
  fix: <proper fix using type guards>
```

**Type Guard Patterns to Use:**
```typescript
// BAD: Non-null assertion
expect(result.usage!.inputTokens).toBe(10);

// GOOD: Type guard with early return
const usage = result.usage;
expect(usage).toBeDefined();
if (!usage) throw new Error("Usage should be defined");
expect(usage.inputTokens).toBe(10);

// GOOD: Using assert helper
function assertDefined<T>(val: T | undefined | null, msg?: string): asserts val is T {
  if (val == null) throw new Error(msg ?? "Value should be defined");
}
assertDefined(result.usage);
expect(result.usage.inputTokens).toBe(10);
```

---

## Agent 2: Type Safety Auditor

**Mission:** Find all type safety issues that could be improved.

**Search Patterns:**
```bash
# Non-null assertions
grep -rn '!\.' packages/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"

# Type assertions that might be unsafe
grep -rn ' as ' packages/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"

# Any type usage
grep -rn ': any' packages/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"

# Unknown without narrowing
grep -rn ': unknown' packages/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
```

**For each issue, assess:**
- Is this a legitimate use case or lazy typing?
- What's the proper type-safe alternative?
- Priority: high (public API), medium (internal), low (test-only)

---

## Agent 3: README Freshness Checker

**Mission:** Verify ALL package READMEs are accurate and current.

**Files to Check:**
```
packages/README.md
packages/internal/core/README.md
packages/internal/core/src/api/README.md
packages/internal/core/src/persistence/README.md
packages/internal/signals/README.md
packages/internal/signals-core/README.md
packages/open-harness/core/README.md
packages/open-harness/server/README.md
packages/open-harness/vitest/README.md
packages/open-harness/testing/README.md
packages/adapters/harnesses/claude/README.md
packages/adapters/harnesses/openai/README.md
examples/*/README.md
```

**For each README, verify:**
1. Code examples compile (correct imports, function names)
2. API descriptions match actual exports
3. No references to old naming (Provider, createHarness for orchestration)
4. Links are not broken
5. Examples use v0.3.0 patterns (createWorkflow, ClaudeHarness, workflow:start)

---

## Agent 4: Test Quality Auditor

**Mission:** Ensure tests are exemplary, not just functional.

**Check for:**
1. Tests using `!` non-null assertions (fix with proper guards)
2. Tests with `as` type assertions (should use proper narrowing)
3. Tests missing error case coverage
4. Flaky patterns (timing, race conditions)
5. Mock patterns that could mask real bugs

**Test files to review:**
```
packages/*/tests/*.test.ts
packages/*/src/**/*.test.ts
packages/adapters/harnesses/*/tests/*.test.ts
```

---

## Agent 5: JSDoc & Comment Auditor

**Mission:** Ensure all public APIs have quality JSDoc.

**Check for:**
1. Missing JSDoc on exported functions/classes/types
2. JSDoc examples that use old API patterns
3. Comments referencing old terminology (Provider, etc.)
4. Outdated TODO comments
5. Dead commented-out code

**Search Patterns:**
```bash
# Functions without JSDoc
grep -B1 "export function" packages/ -rn --include="*.ts" | grep -v "/**"

# Old terminology in comments
grep -rn "provider:" packages/ --include="*.ts" | grep -E "//|/\*"
```

---

## Agent 6: Consistency Auditor

**Mission:** Ensure consistent patterns across the codebase.

**Check for:**
1. Signal naming consistency (harness:*, workflow:*, agent:*)
2. Error handling patterns (are they consistent?)
3. Import style consistency
4. Naming conventions (camelCase, PascalCase usage)
5. File structure patterns

**Specific Checks:**
- All signal constants use `HARNESS_SIGNALS` or `WORKFLOW_SIGNALS`
- All harnesses extend proper base interface
- All tests use same assertion patterns
- All READMEs follow same structure

---

## Synthesis

After all agents complete, produce:

```yaml
quality_sweep_report:
  timestamp: "<ISO-8601>"

  summary:
    total_issues: <count>
    lint_warnings: <count>
    type_safety_issues: <count>
    stale_docs: <count>
    test_quality_issues: <count>
    jsdoc_gaps: <count>
    consistency_issues: <count>

  by_priority:
    critical:  # Must fix - breaks build or public API
      - issue: <description>
        file: <path>
        fix: <action>
    high:      # Should fix - affects code quality
      - ...
    medium:    # Nice to fix - polish
      - ...

  lint_warnings:
    - file: <path>
      line: <number>
      rule: <rule>
      fix: <code change>

  type_safety_fixes:
    - file: <path>
      current: <code>
      improved: <code>
      reason: <why>

  readme_updates:
    - file: <path>
      issues: [<list>]

  action_plan:
    - description: <what to do>
      files: [<affected files>]
      effort: small|medium|large
```

---

## Success Criteria

The sweep is successful when:

1. **Zero Lint Warnings**
   ```bash
   bun run lint  # No warnings, not even in tests
   ```

2. **Zero Non-Null Assertions in Tests**
   ```bash
   grep -rn '!\.' packages/*/tests/ | wc -l  # Should be 0
   ```

3. **All READMEs Current**
   - Every code example compiles
   - Every API reference is accurate
   - No old terminology

4. **Consistent Patterns**
   - Same error handling everywhere
   - Same test structure everywhere
   - Same JSDoc style everywhere

---

## Execution

1. Run `bun run lint` and capture ALL output
2. Launch all 6 agents in parallel with their specific missions
3. Collect findings
4. Synthesize into prioritized action plan
5. Fix issues in priority order
6. Verify zero warnings remain

This codebase should be the gold standard for agentic framework code quality.
