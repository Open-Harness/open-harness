# Next Cycle Inputs: 005-monologue-system

**Generated**: 2025-12-26
**Source**: Retrospective and close cycle analysis
**Grade**: A-

---

## Successes to Replicate

### 1. Linear Spec → Tasks → Implementation Workflow
The 005-monologue-system followed a disciplined progression:
- Spec articulated first (16:11)
- Tasks generated from spec (16:50)
- Final verification scenario added (17:15)
- Implementation delivered matching tasks (20:30)

**Key insight**: No prototype code was consulted during implementation. The spec documents were the sole source of truth.

### 2. Comprehensive Test Strategy Defined Upfront
Test files and mock infrastructure planned in tasks.md before implementation:
- Unit tests per user story
- Mock LLM injection for isolated testing
- E2E tests with real Haiku calls

**Result**: 74 monologue-specific tests, 219/222 total passing (98.6%)

### 3. All File Paths Specified in Tasks.md
Every task included exact file paths. The file-auditor verified 27/27 paths correct.

**Benefit**: Zero file location confusion (contrast with 003-harness-renderer which had renderer/harness confusion)

### 4. Architectural Decisions Documented in research.md
When UNKNOWN items arose during spec, they were researched and documented:
- UNKNOWN-1 through UNKNOWN-5 resolved with rationale
- Enabled justified deferral (RC003) with clear reference

---

## Anti-Patterns to Avoid

### 1. Underestimating Subprocess Execution Time
**Source**: RC001
**Issue**: Test timeout of 60s was insufficient for Claude Code subprocess startup + execution
**Fix applied**: Increased to 120s

**Rule for future**: When agents spawn subprocesses (especially Claude Code), use 120s+ timeouts in tests.

### 2. Assuming LLM Output is Well-Formed
**Source**: RC002
**Issue**: Parser assumed validationCriteria would never be empty strings
**Fix applied**: Added sanitizeResult() to handle edge cases before Zod validation

**Rule for future**: Always sanitize LLM output before schema validation. LLMs don't guarantee field completeness.

### 3. Documentation Lag After Implementation Evolution
**Source**: RC004
**Issue**: research.md specified `@anthropic-ai/sdk` but implementation used `query()` from `claude-agent-sdk`
**Fix needed**: Update research.md line 164

**Rule for future**: Update spec docs immediately when implementation deviates from specification.

---

## Process Improvements

### 1. Realistic Test Timeouts for Subprocess Agents
```typescript
// BEFORE: Insufficient for subprocess startup
{ timeout: 60000 }

// AFTER: Accounts for subprocess overhead
{ timeout: 120000 }
```

### 2. LLM Output Sanitization Pattern
```typescript
private sanitizeResult(result: ParserAgentOutput): ParserAgentOutput {
  return {
    ...result,
    tasks: result.tasks.map((task) => ({
      ...task,
      // Replace empty strings with derived defaults
      validationCriteria: task.validationCriteria?.trim() ||
        `Complete task: ${task.description.slice(0, 50)}`,
    })),
  };
}
```

### 3. Immediate Documentation Sync
After any implementation decision that differs from spec:
1. Note the deviation
2. Update research.md or relevant spec doc within same commit
3. Add comment in code referencing the spec update

---

## Deferred Items (Follow-up Features)

### TaskHarness Refactoring (from RC003)
**What**: 24 `emitNarrative()` calls in TaskHarness need migration
**Why deferred**: These are STATUS events (third-person), not NARRATIVES (first-person LLM summaries)
**Migration path**: Convert to `emitEvent({ type: "harness:status" })` in separate feature

**Suggested feature name**: `006-harness-event-protocol`

---

## Verification Gates That Would Have Caught Issues

| Gate | Would Catch | Current Status |
|------|-------------|----------------|
| Test timeout verification | RC001 (subprocess timing) | Tests run but timeout not validated |
| LLM output schema pre-check | RC002 (empty strings) | Schema validates but sanitization missing |
| Doc sync verification | RC004 (research.md drift) | No automated check |

### Recommended New Gates

1. **Subprocess Timeout Gate**
   - Trigger: Before merging tests that spawn subprocesses
   - Check: Verify timeout >= 120s for subprocess-based agents
   - Severity: critical

2. **LLM Output Sanitization Gate**
   - Trigger: Before validating LLM output with Zod
   - Check: Run sanitization pass first
   - Severity: medium

---

## Comparison to Previous Cycle

| Metric | 003-harness-renderer | 005-monologue-system |
|--------|---------------------|---------------------|
| Root cause severity | High (architectural) | Low (infrastructure) |
| Missing modules | Monologue skipped | All 7 implemented |
| File location errors | Multiple | Zero (27/27 correct) |
| Prototype contamination | Critical issue | None |
| Test pass rate | Lower | 98.6% (219/222) |

**Key difference**: 005 failures are fundamentally different in nature - infrastructure tuning vs architectural confusion.

---

## Summary

The 005-monologue-system cycle demonstrates significant improvement over 003-harness-renderer:
- All previous anti-patterns avoided
- New issues are infrastructure-level, not architectural
- High test coverage maintained throughout
- Clear decision documentation enables justified deferral

**Recommendation for next feature**: Apply subprocess timeout rule and LLM sanitization pattern from the start.
